import type { FastifyInstance } from 'fastify';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import {
  getDb, tasks, sites, proofArtifacts, auditEvents, users,
} from '@siteflow/db';
import {
  PresignProofRequest, FinalizeProofRequest,
  nextState, haversineMeters,
} from '@siteflow/shared';
import { presignPut, presignGet, toPublicUrl } from '../s3.js';
import { notify } from '../lib/notify';
import { closeOpenSegment } from '../lib/timeSegments';

export async function proofRoutes(app: FastifyInstance) {
  /**
   * Step 1 of upload: client asks for a presigned PUT URL.
   * Server enforces: caller is the task assignee, task is in a state that accepts proof,
   * and the GPS point is recorded for downstream geofence check.
   */
  app.post('/proofs/presign', {
    preHandler: [app.authenticate],
    schema: { body: PresignProofRequest },
  }, async (req, reply) => {
    const body = req.body as z.infer<typeof PresignProofRequest>;
    const u = req.user;
    const db = getDb();
    const [task] = await db.select().from(tasks).where(eq(tasks.id, body.taskId));
    if (!task) return reply.code(404).send({ error: 'task not found' });
    if (task.assigneeUserId !== u.sub) return reply.code(403).send({ error: 'not your task' });
    if (task.state !== 'IN_PROGRESS' && task.state !== 'REWORK') {
      return reply.code(409).send({ error: `cannot submit proof from state ${task.state}` });
    }

    const ext = body.mimeType === 'image/png' ? 'png' : body.mimeType === 'image/webp' ? 'webp' : 'jpg';
    const key = `proofs/${task.siteId}/${task.id}/${randomUUID()}.${ext}`;
    const url = toPublicUrl(await presignPut(key, body.mimeType, 300));

    return { uploadUrl: url, s3Key: key, expiresInSec: 300 };
  });

  /**
   * Step 2: client confirms the upload succeeded. Server records the proof,
   * runs geofence check, then advances the task state machine.
   */
  app.post('/proofs/finalize', {
    preHandler: [app.authenticate],
    schema: { body: FinalizeProofRequest },
  }, async (req, reply) => {
    const body = req.body as z.infer<typeof FinalizeProofRequest>;
    const u = req.user;
    const db = getDb();

    const [task] = await db.select().from(tasks).where(eq(tasks.id, body.taskId));
    if (!task) return reply.code(404).send({ error: 'task not found' });
    if (task.assigneeUserId !== u.sub) return reply.code(403).send({ error: 'not your task' });
    if (task.state !== 'IN_PROGRESS' && task.state !== 'REWORK') {
      return reply.code(409).send({ error: `cannot finalize from state ${task.state}` });
    }

    const [site] = await db.select().from(sites).where(eq(sites.id, task.siteId));
    if (!site) return reply.code(500).send({ error: 'site missing for task' });
    const distance = Math.round(haversineMeters(
      { lat: site.lat, lng: site.lng },
      { lat: body.lat, lng: body.lng },
    ));
    const inside = distance <= site.geofenceRadiusM;

    const [proof] = await db.insert(proofArtifacts).values({
      taskId: task.id,
      capturedByUserId: u.sub,
      s3Key: body.s3Key,
      mimeType: body.mimeType,
      capturedAt: new Date(body.capturedAt),
      lat: body.lat,
      lng: body.lng,
      deviceId: body.deviceId,
      insideGeofence: inside,
      geofenceDistanceM: distance,
      note: body.note,
    }).returning();
    if (!proof) return reply.code(500).send({ error: 'failed to insert proof' });

    const to = nextState(task.state, { type: 'SUBMIT_PROOF', by: u.sub, proofArtifactId: proof.id });
    const [updated] = await db.update(tasks)
      .set({ state: to, actualEnd: new Date(), updatedAt: new Date() })
      .where(eq(tasks.id, task.id))
      .returning();

    await db.insert(auditEvents).values({
      taskId: task.id,
      actorUserId: u.sub,
      actorRole: u.role,
      eventType: 'SUBMIT_PROOF',
      fromState: task.state,
      toState: to,
      payload: { proofId: proof.id, insideGeofence: inside, geofenceDistanceM: distance },
    });

    await closeOpenSegment(u.sub, task.id);

    // Notify on-duty supervisors at the same site.
    const supervisors = await db.select({ id: users.id }).from(users)
      .where(and(eq(users.siteId, task.siteId), eq(users.role, 'supervisor'), eq(users.active, true)));
    for (const s of supervisors) {
      await notify({
        orgId: u.orgId, userId: s.id, kind: 'APPROVAL_PENDING',
        title: 'Proof awaiting your review',
        body: `${u.name} submitted proof for "${task.title}" · ${task.location}.`,
        taskId: task.id,
      });
    }

    return { task: updated, proof, geofence: { inside, distanceM: distance, radiusM: site.geofenceRadiusM } };
  });

  /** Return a short-lived GET URL for viewing a proof in the dashboard. */
  app.get('/proofs/:id/view-url', {
    preHandler: [app.authenticate],
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const db = getDb();
    const [p] = await db.select().from(proofArtifacts).where(eq(proofArtifacts.id, id));
    if (!p) return reply.code(404).send({ error: 'not found' });
    const url = toPublicUrl(await presignGet(p.s3Key, 300));
    return { url, expiresInSec: 300 };
  });
}
