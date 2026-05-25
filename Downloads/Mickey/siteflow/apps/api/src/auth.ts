import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { JwtClaims } from '@siteflow/shared';
import { ROLES, type Role } from '@siteflow/shared';

declare module 'fastify' {
  interface FastifyRequest {
    user: JwtClaims;
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: Omit<JwtClaims, 'iat' | 'exp' | 'iss'>;
    user: JwtClaims;
  }
}

export async function requireAuth(req: FastifyRequest) {
  await req.jwtVerify();
}

export function requireRole(...allowed: Role[]) {
  const set = new Set<Role>(allowed);
  return async function (req: FastifyRequest) {
    await req.jwtVerify();
    if (!set.has(req.user.role)) {
      const err: any = new Error(`role ${req.user.role} not allowed; need one of ${[...set].join(', ')}`);
      err.statusCode = 403;
      throw err;
    }
  };
}

export function isValidRole(r: string): r is Role {
  return (ROLES as readonly string[]).includes(r);
}

export async function registerAuthDecorator(app: FastifyInstance) {
  app.decorate('requireAuth', requireAuth);
}
