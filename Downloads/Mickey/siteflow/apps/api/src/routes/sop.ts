import type { FastifyInstance } from 'fastify';
import { eq, desc } from 'drizzle-orm';
import { z } from 'zod';
import { getDb, sopProtocols } from '@siteflow/db';
import { CreateSopProtocol } from '@siteflow/shared';

export async function sopRoutes(app: FastifyInstance) {
  app.get('/sop', { preHandler: [app.authenticate] }, async (req) => {
    const db = getDb();
    return db.select().from(sopProtocols)
      .where(eq(sopProtocols.orgId, req.user.orgId))
      .orderBy(desc(sopProtocols.createdAt));
  });

  app.post('/sop', {
    preHandler: [app.authenticate],
    schema: { body: CreateSopProtocol },
  }, async (req, reply) => {
    const u = req.user;
    if (u.role !== 'manager' && u.role !== 'quality') {
      return reply.code(403).send({ error: 'only manager/quality can create SOPs' });
    }
    const body = req.body as z.infer<typeof CreateSopProtocol>;
    const db = getDb();
    const [row] = await db.insert(sopProtocols).values({
      orgId: u.orgId,
      trade: body.trade,
      title: body.title,
      version: body.version,
      instructions: body.instructions,
      requiredTests: body.requiredTests,
      sampleRatePerN: body.sampleRatePerN,
      refMediaS3Key: body.refMediaS3Key,
    }).returning();
    return row;
  });
}
