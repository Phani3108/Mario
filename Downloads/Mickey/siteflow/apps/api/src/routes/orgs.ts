import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { getDb, organizations, users, orgSettings } from '@siteflow/db';
import { OrgSignupRequest, UpdateOrgSettings } from '@siteflow/shared';
import { presignPut, presignGet, toPublicUrl } from '../s3.js';
import { verifySignupToken } from './auth.js';

const TRIAL_DAYS = 14;

export async function orgRoutes(app: FastifyInstance) {
  /**
   * Contractor self-serve signup. Caller must have just hit /auth/otp/verify
   * with purpose=SIGNUP and the same phone, which yields a short-lived
   * signupToken proving phone ownership.
   *
   * Creates: organization + founder user (role=ceo) + orgSettings row.
   * Returns: JWT for the newly-minted CEO so the client lands logged-in.
   */
  app.post('/orgs/signup', { schema: { body: OrgSignupRequest } }, async (req, reply) => {
    const body = req.body as z.infer<typeof OrgSignupRequest>;
    if (!verifySignupToken(app, body.signupToken, body.phone)) {
      return reply.code(401).send({ error: 'invalid or expired signup token' });
    }
    const db = getDb();

    // Phone uniqueness — refuse if a user with this phone already exists.
    const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.phone, body.phone)).limit(1);
    if (existing) return reply.code(409).send({ error: 'phone already registered; sign in instead' });

    const [org] = await db.insert(organizations).values({ name: body.companyName }).returning();
    if (!org) return reply.code(500).send({ error: 'failed to create org' });

    const [founder] = await db.insert(users).values({
      orgId: org.id,
      name: body.founderName,
      role: 'ceo',
      phone: body.phone,
      email: body.email ?? null,
      siteId: null,
    }).returning();
    if (!founder) return reply.code(500).send({ error: 'failed to create founder' });

    await db.insert(orgSettings).values({
      orgId: org.id,
      accentColor: body.accentColor,
      currency: body.currency,
      primaryCity: body.primaryCity ?? null,
      trialEndsAt: new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000),
    });

    const token = await reply.jwtSign(
      { sub: founder.id, name: founder.name, role: founder.role, siteId: null, orgId: org.id },
      { expiresIn: '12h' },
    );
    return {
      token,
      org: { id: org.id, name: org.name },
      user: { id: founder.id, name: founder.name, role: founder.role, siteId: null, orgId: org.id },
    };
  });

  // ---------- Org branding / settings ----------

  app.get('/orgs/me', { preHandler: [app.authenticate] }, async (req) => {
    const u = req.user;
    const db = getDb();
    const [org] = await db.select().from(organizations).where(eq(organizations.id, u.orgId)).limit(1);
    const [settings] = await db.select().from(orgSettings).where(eq(orgSettings.orgId, u.orgId)).limit(1);
    let logoUrl: string | null = null;
    if (settings?.logoS3Key) {
      logoUrl = toPublicUrl(await presignGet(settings.logoS3Key, 3600 * 12));
    }
    return {
      org,
      settings: settings ?? null,
      logoUrl,
    };
  });

  app.patch('/orgs/me', {
    preHandler: [app.authenticate],
    schema: { body: UpdateOrgSettings },
  }, async (req, reply) => {
    const u = req.user;
    if (u.role !== 'ceo' && u.role !== 'manager') {
      return reply.code(403).send({ error: 'only ceo/manager can edit org settings' });
    }
    const body = req.body as z.infer<typeof UpdateOrgSettings>;
    const db = getDb();
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    for (const [k, v] of Object.entries(body)) if (v !== undefined) updates[k] = v;
    if (Object.keys(updates).length === 1) return { ok: true };
    await db.update(orgSettings).set(updates).where(eq(orgSettings.orgId, u.orgId));
    return { ok: true };
  });

  /** Issues a presigned PUT URL the client uses to upload the org logo directly to S3. */
  app.post('/orgs/me/logo-presign', {
    preHandler: [app.authenticate],
    schema: { body: z.object({ contentType: z.string().regex(/^image\/(png|jpe?g|webp|svg\+xml)$/) }) },
  }, async (req, reply) => {
    const u = req.user;
    if (u.role !== 'ceo' && u.role !== 'manager') {
      return reply.code(403).send({ error: 'only ceo/manager can change logo' });
    }
    const { contentType } = req.body as { contentType: string };
    const ext = contentType.split('/')[1]?.replace('+xml', '') ?? 'png';
    const key = `org-assets/${u.orgId}/logo-${Date.now()}.${ext}`;
    const putUrl = toPublicUrl(await presignPut(key, contentType, 600));

    const db = getDb();
    await db.update(orgSettings).set({ logoS3Key: key, updatedAt: new Date() }).where(eq(orgSettings.orgId, u.orgId));

    return { uploadUrl: putUrl, key };
  });
}
