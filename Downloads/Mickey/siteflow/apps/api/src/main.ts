import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import sensible from '@fastify/sensible';
import {
  validatorCompiler,
  serializerCompiler,
  ZodTypeProvider,
} from 'fastify-type-provider-zod';
import { env } from './env';
import { authRoutes } from './routes/auth';
import { taskRoutes } from './routes/tasks';
import { proofRoutes } from './routes/proofs';
import { approvalRoutes } from './routes/approvals';
import { timesheetRoutes } from './routes/timesheets';
import { userRoutes } from './routes/users';
import { sopRoutes } from './routes/sop';
import { qualityRoutes } from './routes/quality';
import { financeRoutes } from './routes/finance';
import { siteRoutes } from './routes/sites';
import { notificationRoutes } from './routes/notifications';
import { orgRoutes } from './routes/orgs';

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (req: any, reply: any) => Promise<void>;
  }
}

async function build() {
  const app = Fastify({ logger: { transport: { target: 'pino-pretty' } } })
    .withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  await app.register(sensible);
  await app.register(cors, { origin: env.corsOrigins, credentials: true });
  await app.register(jwt, {
    secret: env.jwtSecret,
    sign: { iss: env.jwtIssuer },
    verify: { allowedIss: env.jwtIssuer },
  });

  app.decorate('authenticate', async function (req: any, reply: any) {
    try {
      await req.jwtVerify();
    } catch {
      reply.code(401).send({ error: 'unauthorized' });
    }
  });

  app.get('/', async () => ({ name: 'siteflow-api', version: '0.0.1' }));

  await app.register(authRoutes);
  await app.register(taskRoutes);
  await app.register(proofRoutes);
  await app.register(approvalRoutes);
  await app.register(timesheetRoutes);
  await app.register(userRoutes);
  await app.register(sopRoutes);
  await app.register(qualityRoutes);
  await app.register(financeRoutes);
  await app.register(siteRoutes);
  await app.register(notificationRoutes);
  await app.register(orgRoutes);

  return app;
}

build()
  .then((app) => app.listen({ port: env.port, host: '0.0.0.0' }))
  .then((addr) => console.log(`api listening on ${addr}`))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
