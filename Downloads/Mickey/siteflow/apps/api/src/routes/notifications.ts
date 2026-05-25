import type { FastifyInstance } from 'fastify';
import { and, eq, desc, isNull } from 'drizzle-orm';
import { getDb, notifications, whatsappOutbox } from '@siteflow/db';

const OUTBOX_ROLES = ['manager', 'ceo', 'accounts'] as const;

export async function notificationRoutes(app: FastifyInstance) {
  // Caller's notifications, newest first.
  app.get('/notifications', { preHandler: [app.authenticate] }, async (req) => {
    const db = getDb();
    const q = req.query as { unread?: string };
    const where = q.unread === '1'
      ? and(eq(notifications.userId, req.user.sub), isNull(notifications.readAt))
      : eq(notifications.userId, req.user.sub);
    return db.select().from(notifications).where(where).orderBy(desc(notifications.createdAt)).limit(50);
  });

  app.post('/notifications/:id/read', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const db = getDb();
    const [row] = await db.update(notifications)
      .set({ readAt: new Date() })
      .where(and(eq(notifications.id, id), eq(notifications.userId, req.user.sub)))
      .returning();
    if (!row) return reply.code(404).send({ error: 'not found' });
    return row;
  });

  // WhatsApp outbox — manager/CEO/accounts visibility into queued messages.
  app.get('/whatsapp/outbox', { preHandler: [app.authenticate] }, async (req, reply) => {
    const u = req.user;
    if (!OUTBOX_ROLES.includes(u.role as typeof OUTBOX_ROLES[number])) {
      return reply.code(403).send({ error: 'forbidden' });
    }
    const db = getDb();
    return db.select().from(whatsappOutbox)
      .where(eq(whatsappOutbox.orgId, u.orgId))
      .orderBy(desc(whatsappOutbox.createdAt))
      .limit(100);
  });
}
