import type { FastifyInstance } from 'fastify';
import { eq, and, inArray, desc, count, sql } from 'drizzle-orm';
import { z } from 'zod';
import { getDb, tasks, users, sites, proofArtifacts, auditEvents, sopProtocols } from '@siteflow/db';
import { CreateTask, AssignTaskRequest, nextState, expectedApprover, type TaskState } from '@siteflow/shared';
import { notify } from '../lib/notify';
import { openSegment } from '../lib/timeSegments';
import { presignGet, toPublicUrl } from '../s3.js';

/** Decorate task rows with reworkCount + referenceImageUrl (presigned, short-lived). */
async function decorateTasks<T extends { id: string; sopProtocolId: string | null }>(rows: T[]) {
  if (rows.length === 0) return rows;
  const db = getDb();
  const ids = rows.map((r) => r.id);
  const reworkRows = await db
    .select({ taskId: auditEvents.taskId, c: sql<number>`count(*)::int` })
    .from(auditEvents)
    .where(and(inArray(auditEvents.taskId, ids), eq(auditEvents.eventType, 'REJECT')))
    .groupBy(auditEvents.taskId);
  const reworkMap = new Map(reworkRows.map((r) => [r.taskId!, r.c]));

  const sopIds = Array.from(new Set(rows.map((r) => r.sopProtocolId).filter((x): x is string => !!x)));
  const refMap = new Map<string, string>();
  if (sopIds.length > 0) {
    const sops = await db.select({ id: sopProtocols.id, key: sopProtocols.refMediaS3Key })
      .from(sopProtocols).where(inArray(sopProtocols.id, sopIds));
    await Promise.all(sops.map(async (s) => {
      if (s.key) refMap.set(s.id, toPublicUrl(await presignGet(s.key, 600)));
    }));
  }
  return rows.map((r) => ({
    ...r,
    reworkCount: reworkMap.get(r.id) ?? 0,
    referenceImageUrl: r.sopProtocolId ? refMap.get(r.sopProtocolId) ?? null : null,
  }));
}

export async function taskRoutes(app: FastifyInstance) {
  // List tasks the caller can see.
  // employee → tasks assigned to them
  // supervisor/quality/manager → all tasks at their site
  // others → empty (extend later)
  app.get('/tasks', { preHandler: [app.authenticate] }, async (req) => {
    const db = getDb();
    const u = req.user;
    let rows;
    if (u.role === 'employee') {
      rows = await db.select().from(tasks)
        .where(eq(tasks.assigneeUserId, u.sub))
        .orderBy(desc(tasks.updatedAt));
    } else if (!u.siteId) {
      return [];
    } else {
      rows = await db.select().from(tasks)
        .where(eq(tasks.siteId, u.siteId))
        .orderBy(desc(tasks.updatedAt));
    }
    return decorateTasks(rows);
  });

  // Manager/Supervisor creates and assigns a task.
  app.post('/tasks', {
    preHandler: [app.authenticate],
    schema: { body: CreateTask },
  }, async (req, reply) => {
    const u = req.user;
    if (u.role !== 'manager' && u.role !== 'supervisor') {
      return reply.code(403).send({ error: 'only manager/supervisor can create tasks' });
    }
    const body = req.body as z.infer<typeof CreateTask>;
    const db = getDb();

    // Validate foreign keys belong to caller's org BEFORE attempting insert,
    // so the client gets a useful 400 instead of an opaque Drizzle 500.
    const [site] = await db.select().from(sites).where(eq(sites.id, body.siteId)).limit(1);
    if (!site || site.orgId !== u.orgId) {
      return reply.code(400).send({ error: 'siteId does not belong to your organization' });
    }
    if (body.assigneeUserId) {
      const [assignee] = await db.select().from(users).where(eq(users.id, body.assigneeUserId)).limit(1);
      if (!assignee || assignee.orgId !== u.orgId) {
        return reply.code(400).send({ error: 'assigneeUserId is not in your organization' });
      }
    }
    if (body.sopProtocolId) {
      const [sop] = await db.select().from(sopProtocols).where(eq(sopProtocols.id, body.sopProtocolId)).limit(1);
      if (!sop || sop.orgId !== u.orgId) {
        return reply.code(400).send({ error: 'sopProtocolId is not in your organization' });
      }
    }
    if (body.plannedStart && body.plannedEnd && new Date(body.plannedStart) >= new Date(body.plannedEnd)) {
      return reply.code(400).send({ error: 'plannedStart must be before plannedEnd' });
    }

    const initialState: TaskState = body.assigneeUserId ? 'ASSIGNED' : 'DRAFT';

    // Quality sampling: 1 in N tasks per (site, trade) gets sampled.
    // N is taken from the SOP protocol if set, else default to 3.
    let sampleRate = 3;
    if (body.sopProtocolId) {
      const [sop] = await db.select().from(sopProtocols).where(eq(sopProtocols.id, body.sopProtocolId));
      if (sop) sampleRate = sop.sampleRatePerN;
    }
    const countRows = await db
      .select({ value: count() }).from(tasks)
      .where(and(eq(tasks.siteId, body.siteId), eq(tasks.trade, body.trade)));
    const existingCount = countRows[0]?.value ?? 0;
    const qualitySampled = existingCount % sampleRate === 0;

    const [row] = await db.insert(tasks).values({
      siteId: body.siteId,
      title: body.title,
      trade: body.trade,
      location: body.location,
      assigneeUserId: body.assigneeUserId,
      plannedStart: body.plannedStart ? new Date(body.plannedStart) : null,
      plannedEnd: body.plannedEnd ? new Date(body.plannedEnd) : null,
      sopProtocolId: body.sopProtocolId,
      createdByUserId: u.sub,
      state: initialState,
      qualitySampled,
    }).returning();
    if (!row) return reply.code(500).send({ error: 'failed to create task' });

    await db.insert(auditEvents).values({
      taskId: row.id,
      actorUserId: u.sub,
      actorRole: u.role,
      eventType: body.assigneeUserId ? 'ASSIGN' : 'CREATE',
      fromState: 'DRAFT',
      toState: initialState,
      payload: { title: body.title, assigneeUserId: body.assigneeUserId },
    });

    if (body.assigneeUserId) {
      await notify({
        orgId: u.orgId, userId: body.assigneeUserId, kind: 'TASK_ASSIGNED',
        title: 'New task assigned',
        body: `${body.title} · ${body.location}. Open the Mario app and tap ACCEPT to start the timer.`,
        taskId: row.id, whatsapp: true,
      });
    }

    return row;
  });

  // Get task detail + recent proofs + audit trail
  app.get('/tasks/:id', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const db = getDb();
    const [task] = await db.select().from(tasks).where(eq(tasks.id, id));
    if (!task) return reply.code(404).send({ error: 'not found' });

    const proofs = await db.select().from(proofArtifacts)
      .where(eq(proofArtifacts.taskId, id))
      .orderBy(desc(proofArtifacts.capturedAt));
    const audit = await db.select().from(auditEvents)
      .where(eq(auditEvents.taskId, id))
      .orderBy(desc(auditEvents.createdAt))
      .limit(50);

    const [decorated] = await decorateTasks([task]);
    return { task: decorated, proofs, audit };
  });

  // Employee starts a task (records actualStart, transitions ASSIGNED|REWORK → IN_PROGRESS)
  app.post('/tasks/:id/start', {
    preHandler: [app.authenticate],
    schema: {
      body: z.object({ lat: z.number(), lng: z.number() }),
    },
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const { lat, lng } = req.body as { lat: number; lng: number };
    const u = req.user;
    const db = getDb();
    const [task] = await db.select().from(tasks).where(eq(tasks.id, id));
    if (!task) return reply.code(404).send({ error: 'not found' });
    if (task.assigneeUserId !== u.sub) return reply.code(403).send({ error: 'not your task' });

    const wasRework = task.state === 'REWORK';
    const to = nextState(task.state, { type: 'START', by: u.sub, at: new Date(), lat, lng });
    const [updated] = await db.update(tasks)
      .set({ state: to, actualStart: task.actualStart ?? new Date(), updatedAt: new Date() })
      .where(eq(tasks.id, id))
      .returning();

    await openSegment({
      userId: u.sub, taskId: id, siteId: task.siteId,
      activityType: wasRework ? 'REWORK' : 'WORK',
      orgId: u.orgId, userRole: u.role,
    });

    await db.insert(auditEvents).values({
      taskId: id, actorUserId: u.sub, actorRole: u.role,
      eventType: 'START', fromState: task.state, toState: to,
      payload: { lat, lng, activityType: wasRework ? 'REWORK' : 'WORK' },
    });

    return updated;
  });

  // Read-only: list pending approvals routed to the caller's role
  app.get('/approvals/pending', { preHandler: [app.authenticate] }, async (req) => {
    const u = req.user;
    const db = getDb();
    if (!u.siteId) return [];
    const targetStates: TaskState[] =
      u.role === 'supervisor' ? ['PROOF_SUBMITTED'] :
      u.role === 'quality'    ? ['SUPERVISOR_APPROVED'] :
      u.role === 'manager'    ? ['QUALITY_APPROVED'] :
      u.role === 'client'     ? ['MANAGER_APPROVED'] :
      [];
    if (targetStates.length === 0) return [];

    const rows = await db.select().from(tasks)
      .where(and(eq(tasks.siteId, u.siteId), inArray(tasks.state, targetStates)))
      .orderBy(desc(tasks.updatedAt));
    return decorateTasks(rows);
  });

  app.get('/health', async () => ({ ok: true, expectedApprover: expectedApprover('PROOF_SUBMITTED') }));

  // Manager/supervisor reassigns a task. DRAFT → ASSIGNED transition handled implicitly.
  app.patch('/tasks/:id/assign', {
    preHandler: [app.authenticate],
    schema: { body: AssignTaskRequest },
  }, async (req, reply) => {
    const u = req.user;
    if (u.role !== 'manager' && u.role !== 'supervisor') {
      return reply.code(403).send({ error: 'only manager/supervisor can reassign' });
    }
    const { id } = req.params as { id: string };
    const body = req.body as { assigneeUserId: string | null };
    const db = getDb();
    const [task] = await db.select().from(tasks).where(eq(tasks.id, id));
    if (!task) return reply.code(404).send({ error: 'not found' });

    const fromState = task.state;
    const toState: TaskState =
      body.assigneeUserId == null ? 'DRAFT'
      : fromState === 'DRAFT' ? 'ASSIGNED'
      : fromState;

    const [updated] = await db.update(tasks)
      .set({ assigneeUserId: body.assigneeUserId, state: toState, updatedAt: new Date() })
      .where(eq(tasks.id, id))
      .returning();

    await db.insert(auditEvents).values({
      taskId: id, actorUserId: u.sub, actorRole: u.role,
      eventType: body.assigneeUserId ? 'ASSIGN' : 'UNASSIGN',
      fromState, toState,
      payload: { assigneeUserId: body.assigneeUserId },
    });
    if (body.assigneeUserId) {
      await notify({
        orgId: u.orgId, userId: body.assigneeUserId, kind: 'TASK_ASSIGNED',
        title: 'Task reassigned to you',
        body: `${task.title} · ${task.location}. Tap ACCEPT to begin the timer.`,
        taskId: id, whatsapp: true,
      });
    }
    return updated;
  });

  // Employee accepts an assigned task. Starts the acceptance clock; START still records actualStart.
  app.post('/tasks/:id/accept', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const u = req.user;
    const db = getDb();
    const [task] = await db.select().from(tasks).where(eq(tasks.id, id));
    if (!task) return reply.code(404).send({ error: 'not found' });
    if (task.assigneeUserId !== u.sub) return reply.code(403).send({ error: 'not your task' });
    const to = nextState(task.state, { type: 'ACCEPT', by: u.sub, at: new Date() });
    const [updated] = await db.update(tasks)
      .set({ state: to, acceptedAt: new Date(), updatedAt: new Date() })
      .where(eq(tasks.id, id))
      .returning();
    await db.insert(auditEvents).values({
      taskId: id, actorUserId: u.sub, actorRole: u.role,
      eventType: 'ACCEPT', fromState: task.state, toState: to,
    });
    if (task.createdByUserId) {
      await notify({
        orgId: u.orgId, userId: task.createdByUserId, kind: 'TASK_ACCEPTED',
        title: 'Task accepted',
        body: `${u.name} accepted "${task.title}". Timer started.`,
        taskId: id,
      });
    }
    return updated;
  });
}
