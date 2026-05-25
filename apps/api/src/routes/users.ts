import type { FastifyInstance } from 'fastify';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { getDb, users } from '@siteflow/db';
import { CreateEmployee } from '@siteflow/shared';
import { notify } from '../lib/notify';

const HR_ROLES = ['manager', 'ceo', 'accounts'] as const;

export async function userRoutes(app: FastifyInstance) {
  // List users at the caller's site (used by manager/supervisor to assign work).
  app.get('/users', { preHandler: [app.authenticate] }, async (req, reply) => {
    const u = req.user;
    if (!['manager', 'supervisor', 'quality', 'ceo', 'accounts'].includes(u.role)) {
      return reply.code(403).send({ error: 'forbidden' });
    }
    const db = getDb();
    const q = req.query as { role?: string; all?: string };
    const scopeOrg = q.all === '1' || u.role === 'ceo' || u.role === 'accounts';

    if (scopeOrg) {
      const where = q.role
        ? and(eq(users.orgId, u.orgId), eq(users.role, q.role as any))
        : eq(users.orgId, u.orgId);
      return db.select({
        id: users.id, name: users.name, role: users.role,
        phone: users.phone, email: users.email, active: users.active,
        siteId: users.siteId, joiningDate: users.joiningDate,
        salaryMonthly: users.salaryMonthly,
      }).from(users).where(where);
    }

    if (!u.siteId) return [];
    const where = q.role
      ? and(eq(users.siteId, u.siteId), eq(users.role, q.role as any))
      : eq(users.siteId, u.siteId);
    return db.select({
      id: users.id, name: users.name, role: users.role,
      phone: users.phone, email: users.email, active: users.active,
      siteId: users.siteId, joiningDate: users.joiningDate,
      salaryMonthly: users.salaryMonthly,
    }).from(users).where(where);
  });

  // Create a new employee. Auto-sends WhatsApp welcome with login hint.
  app.post('/users', { preHandler: [app.authenticate], schema: { body: CreateEmployee } }, async (req, reply) => {
    const u = req.user;
    if (!HR_ROLES.includes(u.role as typeof HR_ROLES[number])) {
      return reply.code(403).send({ error: 'only manager/ceo/accounts can create employees' });
    }
    const body = req.body as z.infer<typeof CreateEmployee>;
    const db = getDb();
    const [row] = await db.insert(users).values({
      orgId: u.orgId,
      name: body.name,
      role: body.role,
      phone: body.phone,
      email: body.email,
      siteId: body.siteId,
      joiningDate: body.joiningDate ? new Date(body.joiningDate) : null,
      salaryMonthly: body.salaryMonthly,
    }).returning();
    if (!row) return reply.code(500).send({ error: 'failed to create' });

    const loginId = row.phone ?? row.email ?? '';
    await notify({
      orgId: u.orgId,
      userId: row.id,
      kind: 'WELCOME',
      title: 'Welcome to Mario',
      body: `Hi ${row.name}, your login is ${loginId}. Install the Mario app and sign in to see your tasks. Joining: ${row.joiningDate ? new Date(row.joiningDate).toDateString() : 'TBD'}.`,
      whatsapp: true,
    });

    return row;
  });
}

