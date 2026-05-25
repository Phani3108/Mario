import type { FastifyInstance } from 'fastify';
import { and, asc, eq, gte, lte } from 'drizzle-orm';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { getDb, timesheetEntries, users, sites } from '@siteflow/db';
import {
  PunchRequest, PresignSelfieRequest, haversineMeters,
} from '@siteflow/shared';
import { presignPut, presignGet, toPublicUrl } from '../s3.js';

function startOfDay(d = new Date()) {
  const x = new Date(d); x.setHours(0, 0, 0, 0); return x;
}
function endOfDay(d = new Date()) {
  const x = new Date(d); x.setHours(23, 59, 59, 999); return x;
}

export async function timesheetRoutes(app: FastifyInstance) {
  app.post('/timesheets/selfie/presign', {
    preHandler: [app.authenticate],
    schema: { body: PresignSelfieRequest },
  }, async (req) => {
    const body = req.body as z.infer<typeof PresignSelfieRequest>;
    const u = req.user;
    const ext = body.mimeType === 'image/png' ? 'png' : body.mimeType === 'image/webp' ? 'webp' : 'jpg';
    const key = `selfies/${u.orgId}/${u.sub}/${randomUUID()}.${ext}`;
    const url = toPublicUrl(await presignPut(key, body.mimeType, 300));
    return { uploadUrl: url, s3Key: key, expiresInSec: 300 };
  });

  app.post('/timesheets/punch', {
    preHandler: [app.authenticate],
    schema: { body: PunchRequest },
  }, async (req, reply) => {
    const body = req.body as z.infer<typeof PunchRequest>;
    const u = req.user;
    const db = getDb();
    if (!u.siteId) return reply.code(400).send({ error: 'no site assigned to user' });

    const [site] = await db.select().from(sites).where(eq(sites.id, u.siteId));
    if (!site) return reply.code(500).send({ error: 'site missing' });

    const distance = Math.round(haversineMeters(
      { lat: site.lat, lng: site.lng },
      { lat: body.lat, lng: body.lng },
    ));
    const inside = distance <= site.geofenceRadiusM;

    const [row] = await db.insert(timesheetEntries).values({
      userId: u.sub,
      siteId: u.siteId,
      kind: body.kind,
      selfieS3Key: body.selfieS3Key,
      lat: body.lat,
      lng: body.lng,
      insideGeofence: inside,
      punchedAt: body.capturedAt ? new Date(body.capturedAt) : new Date(),
    }).returning();
    return { entry: row, geofence: { inside, distanceM: distance, radiusM: site.geofenceRadiusM } };
  });

  app.get('/timesheets/me/today', { preHandler: [app.authenticate] }, async (req) => {
    const u = req.user;
    const db = getDb();
    return db.select().from(timesheetEntries).where(and(
      eq(timesheetEntries.userId, u.sub),
      gte(timesheetEntries.punchedAt, startOfDay()),
      lte(timesheetEntries.punchedAt, endOfDay()),
    )).orderBy(asc(timesheetEntries.punchedAt));
  });

  // Supervisor/manager: today's entries for the site, joined with user name.
  app.get('/timesheets/today', { preHandler: [app.authenticate] }, async (req, reply) => {
    const u = req.user;
    if (!['supervisor', 'manager', 'quality', 'ceo', 'accounts'].includes(u.role)) {
      return reply.code(403).send({ error: 'forbidden' });
    }
    if (!u.siteId) return [];
    const db = getDb();
    const rows = await db.select({
      id: timesheetEntries.id,
      userId: timesheetEntries.userId,
      userName: users.name,
      kind: timesheetEntries.kind,
      insideGeofence: timesheetEntries.insideGeofence,
      lat: timesheetEntries.lat,
      lng: timesheetEntries.lng,
      selfieS3Key: timesheetEntries.selfieS3Key,
      punchedAt: timesheetEntries.punchedAt,
    }).from(timesheetEntries)
      .innerJoin(users, eq(users.id, timesheetEntries.userId))
      .where(and(
        eq(timesheetEntries.siteId, u.siteId),
        gte(timesheetEntries.punchedAt, startOfDay()),
        lte(timesheetEntries.punchedAt, endOfDay()),
      ))
      .orderBy(asc(timesheetEntries.punchedAt));
    return rows;
  });

  app.get('/timesheets/selfie/:id/view-url', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const db = getDb();
    const [e] = await db.select().from(timesheetEntries).where(eq(timesheetEntries.id, id));
    if (!e || !e.selfieS3Key) return reply.code(404).send({ error: 'not found' });
    const url = toPublicUrl(await presignGet(e.selfieS3Key, 300));
    return { url, expiresInSec: 300 };
  });
}
