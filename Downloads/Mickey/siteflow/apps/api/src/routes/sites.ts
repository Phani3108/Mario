import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { getDb, sites } from '@siteflow/db';
import { CreateSite } from '@siteflow/shared';

const WRITE_ROLES = ['manager', 'ceo', 'accounts'] as const;

export async function siteRoutes(app: FastifyInstance) {
  app.get('/sites', { preHandler: [app.authenticate] }, async (req) => {
    const db = getDb();
    return db.select().from(sites).where(eq(sites.orgId, req.user.orgId));
  });

  app.post('/sites', { preHandler: [app.authenticate], schema: { body: CreateSite } }, async (req, reply) => {
    const u = req.user;
    if (!WRITE_ROLES.includes(u.role as typeof WRITE_ROLES[number])) {
      return reply.code(403).send({ error: 'only manager/ceo/accounts can create sites' });
    }
    const body = req.body as z.infer<typeof CreateSite>;
    const db = getDb();
    const [row] = await db.insert(sites).values({
      orgId: u.orgId,
      name: body.name,
      kind: body.kind,
      address: body.address,
      lat: body.lat,
      lng: body.lng,
      geofenceRadiusM: body.geofenceRadiusM,
    }).returning();
    return row;
  });
}
