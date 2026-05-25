import type { FastifyInstance } from 'fastify';
import { eq, and, sql, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { getDb, tasks, approvals, auditEvents, users } from '@siteflow/db';
import { notify } from '../lib/notify';
import {
  ApproveRequest, RejectRequest,
  nextState, expectedApprover,
} from '@siteflow/shared';

export async function approvalRoutes(app: FastifyInstance) {
  app.post('/approvals/approve', {
    preHandler: [app.authenticate],
    schema: { body: ApproveRequest },
  }, async (req, reply) => {
    const body = req.body as z.infer<typeof ApproveRequest>;
    const u = req.user;
    const db = getDb();
    const [task] = await db.select().from(tasks).where(eq(tasks.id, body.taskId));
    if (!task) return reply.code(404).send({ error: 'task not found' });

    const expected = expectedApprover(task.state);
    if (expected !== u.role) {
      return reply.code(409).send({
        error: `task in state ${task.state} expects ${expected ?? 'no one'}, not ${u.role}`,
      });
    }

    const isClient = u.role === 'client';
    const to = nextState(task.state,
      isClient
        ? { type: 'ACKNOWLEDGE', by: u.sub }
        : { type: 'APPROVE', by: u.sub, byRole: u.role, note: body.note },
    );

    await db.insert(approvals).values({
      taskId: task.id, byUserId: u.sub, byRole: u.role,
      decision: 'APPROVE', note: body.note,
    });

    const [updated] = await db.update(tasks)
      .set({ state: to, updatedAt: new Date() })
      .where(eq(tasks.id, task.id))
      .returning();

    await db.insert(auditEvents).values({
      taskId: task.id, actorUserId: u.sub, actorRole: u.role,
      eventType: isClient ? 'ACKNOWLEDGE' : 'APPROVE',
      fromState: task.state, toState: to,
      payload: { note: body.note },
    });

    // Quality-sampling skip: when supervisor approves a non-sampled task,
    // auto-advance past the quality stage with a synthetic audit event.
    if (u.role === 'supervisor' && to === 'SUPERVISOR_APPROVED' && task.qualitySampled === false) {
      const [skipped] = await db.update(tasks)
        .set({ state: 'QUALITY_APPROVED', updatedAt: new Date() })
        .where(eq(tasks.id, task.id))
        .returning();
      await db.insert(auditEvents).values({
        taskId: task.id, actorUserId: u.sub, actorRole: u.role,
        eventType: 'QUALITY_AUTO_SKIP',
        fromState: 'SUPERVISOR_APPROVED', toState: 'QUALITY_APPROVED',
        payload: { reason: 'task not in quality sample' },
      });
      return skipped;
    }

    // Auto-close after client ack (only path to CLOSED today)
    if (to === 'CLIENT_ACKNOWLEDGED') {
      const [closed] = await db.update(tasks)
        .set({ state: 'CLOSED', updatedAt: new Date() })
        .where(eq(tasks.id, task.id))
        .returning();
      await db.insert(auditEvents).values({
        taskId: task.id, actorUserId: u.sub, actorRole: u.role,
        eventType: 'AUTO_CLOSE',
        fromState: 'CLIENT_ACKNOWLEDGED', toState: 'CLOSED',
      });
      return closed;
    }

    return updated;
  });

  app.post('/approvals/reject', {
    preHandler: [app.authenticate],
    schema: { body: RejectRequest },
  }, async (req, reply) => {
    const body = req.body as z.infer<typeof RejectRequest>;
    const u = req.user;
    const db = getDb();
    const [task] = await db.select().from(tasks).where(eq(tasks.id, body.taskId));
    if (!task) return reply.code(404).send({ error: 'task not found' });

    const expected = expectedApprover(task.state);
    if (expected !== u.role) {
      return reply.code(409).send({
        error: `task in state ${task.state} cannot be rejected by ${u.role}`,
      });
    }

    const to = nextState(task.state, { type: 'REJECT', by: u.sub, byRole: u.role, reason: body.reason });

    await db.insert(approvals).values({
      taskId: task.id, byUserId: u.sub, byRole: u.role,
      decision: 'REJECT', reason: body.reason,
    });

    const [updated] = await db.update(tasks)
      .set({ state: to, updatedAt: new Date() })
      .where(eq(tasks.id, task.id))
      .returning();

    await db.insert(auditEvents).values({
      taskId: task.id, actorUserId: u.sub, actorRole: u.role,
      eventType: 'REJECT',
      fromState: task.state, toState: to,
      payload: { reason: body.reason },
    });

    if (task.assigneeUserId) {
      await notify({
        orgId: u.orgId, userId: task.assigneeUserId, kind: 'TASK_REJECTED',
        title: 'Rework needed',
        body: `${u.name} sent "${task.title}" back. Reason: ${body.reason}`,
        taskId: task.id, whatsapp: true,
      });
    }

    // Critical-failure escalation: if this task has been rejected ≥3 times,
    // alert all supervisors + the manager at the site so they can intervene.
    const rejectCountRow = await db
      .select({ rejects: sql<number>`count(*)::int` })
      .from(auditEvents)
      .where(and(eq(auditEvents.taskId, task.id), eq(auditEvents.eventType, 'REJECT')));
    const rejects = rejectCountRow[0]?.rejects ?? 0;
    if (rejects >= 3) {
      const escalateTo = await db.select({ id: users.id }).from(users).where(and(
        eq(users.siteId, task.siteId),
        eq(users.active, true),
        inArray(users.role, ['supervisor', 'manager']),
      ));
      for (const r of escalateTo) {
        await notify({
          orgId: u.orgId, userId: r.id, kind: 'CRITICAL_FAILURE',
          title: 'Critical failure on task',
          body: `"${task.title}" has been rejected ${rejects} times. Please investigate.`,
          taskId: task.id, whatsapp: true,
        });
      }
    }

    return updated;
  });
}
