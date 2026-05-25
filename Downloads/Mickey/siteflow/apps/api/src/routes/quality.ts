import type { FastifyInstance } from 'fastify';
import { eq, desc } from 'drizzle-orm';
import { z } from 'zod';
import { getDb, qualityTests, tasks, auditEvents } from '@siteflow/db';
import { RecordQualityTest } from '@siteflow/shared';

export async function qualityRoutes(app: FastifyInstance) {
  app.get('/quality/tests/:taskId', { preHandler: [app.authenticate] }, async (req) => {
    const { taskId } = req.params as { taskId: string };
    const db = getDb();
    return db.select().from(qualityTests)
      .where(eq(qualityTests.taskId, taskId))
      .orderBy(desc(qualityTests.createdAt));
  });

  app.post('/quality/tests', {
    preHandler: [app.authenticate],
    schema: { body: RecordQualityTest },
  }, async (req, reply) => {
    const u = req.user;
    if (u.role !== 'quality') {
      return reply.code(403).send({ error: 'only quality role can record tests' });
    }
    const body = req.body as z.infer<typeof RecordQualityTest>;
    const db = getDb();
    const [task] = await db.select().from(tasks).where(eq(tasks.id, body.taskId));
    if (!task) return reply.code(404).send({ error: 'task not found' });

    const [row] = await db.insert(qualityTests).values({
      taskId: body.taskId,
      sopProtocolId: task.sopProtocolId,
      byUserId: u.sub,
      kind: body.kind,
      result: body.result,
      measurement: body.measurement,
      note: body.note,
    }).returning();

    await db.insert(auditEvents).values({
      taskId: body.taskId, actorUserId: u.sub, actorRole: u.role,
      eventType: 'QUALITY_TEST',
      payload: { kind: body.kind, result: body.result, measurement: body.measurement },
    });
    return row;
  });
}
