import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { eq, or, and, isNull, gt, desc } from 'drizzle-orm';
import { createHash, randomInt } from 'node:crypto';
import { getDb, users, otpChallenges } from '@siteflow/db';
import { LoginRequest, OtpRequest, OtpVerify } from '@siteflow/shared';
import { env } from '../env.js';
import { sendOtp } from '../lib/msg91.js';

const OTP_TTL_MS = 5 * 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;

function hashCode(code: string, phone: string): string {
  return createHash('sha256').update(`${phone}:${code}:${env.jwtSecret}`).digest('hex');
}

function genCode(): string {
  return String(randomInt(100000, 1000000));
}

export async function authRoutes(app: FastifyInstance) {
  // ---------- OTP ----------

  app.post('/auth/otp/request', {
    schema: { body: OtpRequest },
  }, async (req, reply) => {
    const { phone, purpose } = req.body as z.infer<typeof OtpRequest>;
    const db = getDb();

    if (purpose === 'LOGIN') {
      const [u] = await db.select({ id: users.id, active: users.active })
        .from(users).where(eq(users.phone, phone)).limit(1);
      if (!u || !u.active) return reply.code(404).send({ error: 'no account for this phone' });
    }

    const code = genCode();
    await db.insert(otpChallenges).values({
      phone,
      codeHash: hashCode(code, phone),
      purpose,
      expiresAt: new Date(Date.now() + OTP_TTL_MS),
    });
    await sendOtp(phone, code, purpose);
    // Dev convenience: echo the code so the UI can auto-fill it. Disabled
    // automatically when DEV_AUTH=false (i.e. prod).
    if (env.devAuth) return { ok: true, ttlSec: OTP_TTL_MS / 1000, devCode: code };
    return { ok: true, ttlSec: OTP_TTL_MS / 1000 };
  });

  app.post('/auth/otp/verify', {
    schema: { body: OtpVerify },
  }, async (req, reply) => {
    const { phone, code, purpose } = req.body as z.infer<typeof OtpVerify>;
    const db = getDb();

    const candidates = await db.select().from(otpChallenges).where(and(
      eq(otpChallenges.phone, phone),
      eq(otpChallenges.purpose, purpose),
      isNull(otpChallenges.consumedAt),
      gt(otpChallenges.expiresAt, new Date()),
    )).orderBy(desc(otpChallenges.createdAt)).limit(1);

    const challenge = candidates[0];
    if (!challenge) return reply.code(401).send({ error: 'no active code; request a new one' });
    if (challenge.attempts >= OTP_MAX_ATTEMPTS) {
      return reply.code(429).send({ error: 'too many attempts; request a new code' });
    }
    if (challenge.codeHash !== hashCode(code, phone)) {
      await db.update(otpChallenges)
        .set({ attempts: challenge.attempts + 1 })
        .where(eq(otpChallenges.id, challenge.id));
      return reply.code(401).send({ error: 'invalid code' });
    }

    await db.update(otpChallenges)
      .set({ consumedAt: new Date() })
      .where(eq(otpChallenges.id, challenge.id));

    if (purpose === 'LOGIN') {
      const [u] = await db.select().from(users).where(eq(users.phone, phone)).limit(1);
      if (!u) return reply.code(404).send({ error: 'no account for this phone' });
      const token = await reply.jwtSign(
        { sub: u.id, name: u.name, role: u.role, siteId: u.siteId, orgId: u.orgId },
        { expiresIn: '12h' },
      );
      return { token, user: { id: u.id, name: u.name, role: u.role, siteId: u.siteId, orgId: u.orgId } };
    }

    // SIGNUP: hand back a short-lived signup token. The /orgs/signup route requires it.
    const signupToken = await reply.jwtSign(
      { kind: 'signup', phone } as unknown as Parameters<typeof reply.jwtSign>[0],
      { expiresIn: '15m' },
    );
    return { signupToken, phone };
  });

  // ---------- Dev login (kept behind DEV_AUTH flag for local seed accounts) ----------

  app.post('/auth/login', {
    schema: { body: LoginRequest },
  }, async (req, reply) => {
    if (!env.devAuth) return reply.code(404).send({ error: 'dev auth disabled' });
    const { phoneOrEmail } = req.body as z.infer<typeof LoginRequest>;
    const db = getDb();
    const found = await db.select().from(users)
      .where(or(eq(users.phone, phoneOrEmail), eq(users.email, phoneOrEmail))).limit(1);
    const u = found.at(0);
    if (!u || !u.active) return reply.code(401).send({ error: 'unknown user' });

    const token = await reply.jwtSign(
      { sub: u.id, name: u.name, role: u.role, siteId: u.siteId, orgId: u.orgId },
      { expiresIn: '12h' },
    );
    return {
      token,
      user: { id: u.id, name: u.name, role: u.role, siteId: u.siteId, orgId: u.orgId },
    };
  });

  app.get('/auth/me', { preHandler: [app.authenticate] }, async (req) => {
    return req.user;
  });
}

/** Used by /orgs/signup to verify the short-lived signup token issued at OTP-verify. */
export function verifySignupToken(app: FastifyInstance, token: string, phone: string): boolean {
  try {
    const decoded = app.jwt.verify<{ kind: string; phone: string }>(token);
    return decoded.kind === 'signup' && decoded.phone === phone;
  } catch {
    return false;
  }
}
