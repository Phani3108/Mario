import type { FastifyInstance } from 'fastify';
import { eq, and, gte, lte, asc } from 'drizzle-orm';
import { z } from 'zod';
import { getDb, contracts, costRates, timesheetEntries, users, sites } from '@siteflow/db';
import { CreateContract, SetCostRate } from '@siteflow/shared';

const FINANCE_READ = new Set(['ceo', 'accounts', 'manager']);
const FINANCE_WRITE = new Set(['ceo', 'accounts']);

function startOfDay(d: Date) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
function endOfDay(d: Date) { const x = new Date(d); x.setHours(23, 59, 59, 999); return x; }

export async function financeRoutes(app: FastifyInstance) {
  app.get('/finance/contracts', { preHandler: [app.authenticate] }, async (req, reply) => {
    const u = req.user;
    if (!FINANCE_READ.has(u.role)) return reply.code(403).send({ error: 'forbidden' });
    const db = getDb();
    return db.select().from(contracts).where(eq(contracts.orgId, u.orgId)).orderBy(asc(contracts.createdAt));
  });

  app.post('/finance/contracts', {
    preHandler: [app.authenticate],
    schema: { body: CreateContract },
  }, async (req, reply) => {
    const u = req.user;
    if (!FINANCE_WRITE.has(u.role)) return reply.code(403).send({ error: 'forbidden' });
    const body = req.body as z.infer<typeof CreateContract>;
    const db = getDb();
    const [row] = await db.insert(contracts).values({
      orgId: u.orgId,
      siteId: body.siteId,
      clientName: body.clientName,
      totalValue: body.totalValue,
      currency: body.currency,
      startDate: body.startDate ? new Date(body.startDate) : null,
      endDate: body.endDate ? new Date(body.endDate) : null,
    }).returning();
    return row;
  });

  app.get('/finance/rates', { preHandler: [app.authenticate] }, async (req, reply) => {
    const u = req.user;
    if (!FINANCE_READ.has(u.role)) return reply.code(403).send({ error: 'forbidden' });
    const db = getDb();
    return db.select().from(costRates).where(eq(costRates.orgId, u.orgId));
  });

  app.post('/finance/rates', {
    preHandler: [app.authenticate],
    schema: { body: SetCostRate },
  }, async (req, reply) => {
    const u = req.user;
    if (!FINANCE_WRITE.has(u.role)) return reply.code(403).send({ error: 'forbidden' });
    const body = req.body as z.infer<typeof SetCostRate>;
    const db = getDb();
    const existing = await db.select().from(costRates)
      .where(and(eq(costRates.orgId, u.orgId), eq(costRates.role, body.role)));
    if (existing.length > 0) {
      const [row] = await db.update(costRates)
        .set({ hourlyRate: body.hourlyRate, currency: body.currency, updatedAt: new Date() })
        .where(eq(costRates.id, existing[0]!.id))
        .returning();
      return row;
    }
    const [row] = await db.insert(costRates).values({
      orgId: u.orgId, role: body.role, hourlyRate: body.hourlyRate, currency: body.currency,
    }).returning();
    return row;
  });

  // Site P&L: contract value vs. labor cost-to-date from timesheets.
  app.get('/finance/site-pnl/:siteId', { preHandler: [app.authenticate] }, async (req, reply) => {
    const u = req.user;
    if (!FINANCE_READ.has(u.role)) return reply.code(403).send({ error: 'forbidden' });
    const { siteId } = req.params as { siteId: string };
    const db = getDb();

    const [site] = await db.select().from(sites).where(eq(sites.id, siteId));
    if (!site) return reply.code(404).send({ error: 'site not found' });
    const [contract] = await db.select().from(contracts).where(eq(contracts.siteId, siteId));
    const rates = await db.select().from(costRates).where(eq(costRates.orgId, u.orgId));
    const rateByRole = new Map<string, number>(rates.map((r) => [r.role as string, r.hourlyRate]));

    // All punches at site, joined to user role
    const punches = await db
      .select({
        userId: timesheetEntries.userId,
        kind: timesheetEntries.kind,
        punchedAt: timesheetEntries.punchedAt,
        role: users.role,
      })
      .from(timesheetEntries)
      .innerJoin(users, eq(users.id, timesheetEntries.userId))
      .where(eq(timesheetEntries.siteId, siteId))
      .orderBy(asc(timesheetEntries.punchedAt));

    // Group per (userId, calendar day) and compute hours = exit-entry minus lunch
    type Day = { entry?: Date; lunchOut?: Date; lunchIn?: Date; exit?: Date; role: string };
    const days = new Map<string, Day>();
    for (const p of punches) {
      const day = new Date(p.punchedAt).toISOString().slice(0, 10);
      const k = `${p.userId}|${day}`;
      const slot = days.get(k) ?? { role: p.role };
      if (p.kind === 'ENTRY') slot.entry = p.punchedAt;
      else if (p.kind === 'LUNCH_OUT') slot.lunchOut = p.punchedAt;
      else if (p.kind === 'LUNCH_IN') slot.lunchIn = p.punchedAt;
      else if (p.kind === 'EXIT') slot.exit = p.punchedAt;
      days.set(k, slot);
    }

    let laborCost = 0;
    let laborHours = 0;
    const byRole: Record<string, { hours: number; cost: number }> = {};
    for (const d of days.values()) {
      if (!d.entry) continue;
      const endTs = d.exit ?? new Date();
      let ms = endTs.getTime() - d.entry.getTime();
      if (d.lunchOut && d.lunchIn) ms -= d.lunchIn.getTime() - d.lunchOut.getTime();
      const hours = Math.max(0, ms / 3_600_000);
      const rate = rateByRole.get(d.role) ?? 0;
      const cost = hours * rate;
      laborHours += hours;
      laborCost += cost;
      const bucket = byRole[d.role] ?? (byRole[d.role] = { hours: 0, cost: 0 });
      bucket.hours += hours;
      bucket.cost += cost;
    }

    return {
      site: { id: site.id, name: site.name },
      contract: contract ?? null,
      laborHoursToDate: Math.round(laborHours * 10) / 10,
      laborCostToDate: Math.round(laborCost),
      byRole,
    };
  });

  // Payroll CSV for an arbitrary [from, to] window — date params are inclusive ISO dates.
  app.get('/finance/payroll-csv', { preHandler: [app.authenticate] }, async (req, reply) => {
    const u = req.user;
    if (!FINANCE_READ.has(u.role)) return reply.code(403).send({ error: 'forbidden' });
    const q = req.query as { from?: string; to?: string };
    const from = startOfDay(q.from ? new Date(q.from) : new Date());
    const to = endOfDay(q.to ? new Date(q.to) : new Date());
    const db = getDb();

    const rows = await db
      .select({
        userId: timesheetEntries.userId,
        userName: users.name,
        role: users.role,
        kind: timesheetEntries.kind,
        punchedAt: timesheetEntries.punchedAt,
      })
      .from(timesheetEntries)
      .innerJoin(users, eq(users.id, timesheetEntries.userId))
      .where(and(
        gte(timesheetEntries.punchedAt, from),
        lte(timesheetEntries.punchedAt, to),
        eq(users.orgId, u.orgId),
      ))
      .orderBy(asc(users.name), asc(timesheetEntries.punchedAt));

    const rates = await db.select().from(costRates).where(eq(costRates.orgId, u.orgId));
    const rateByRole = new Map<string, number>(rates.map((r) => [r.role as string, r.hourlyRate]));

    type Day = { entry?: Date; lunchOut?: Date; lunchIn?: Date; exit?: Date; name: string; role: string };
    const days = new Map<string, Day>();
    for (const r of rows) {
      const day = new Date(r.punchedAt).toISOString().slice(0, 10);
      const k = `${r.userId}|${day}`;
      const slot = days.get(k) ?? { name: r.userName, role: r.role };
      if (r.kind === 'ENTRY') slot.entry = r.punchedAt;
      else if (r.kind === 'LUNCH_OUT') slot.lunchOut = r.punchedAt;
      else if (r.kind === 'LUNCH_IN') slot.lunchIn = r.punchedAt;
      else if (r.kind === 'EXIT') slot.exit = r.punchedAt;
      days.set(k, slot);
    }

    const out: string[] = ['date,user,role,hours,rate_inr_per_hr,pay_inr'];
    for (const [k, d] of [...days.entries()].sort()) {
      const day = k.split('|')[1];
      if (!d.entry) continue;
      const endTs = d.exit ?? new Date();
      let ms = endTs.getTime() - d.entry.getTime();
      if (d.lunchOut && d.lunchIn) ms -= d.lunchIn.getTime() - d.lunchOut.getTime();
      const hours = Math.max(0, ms / 3_600_000);
      const rate = rateByRole.get(d.role) ?? 0;
      const pay = Math.round(hours * rate);
      out.push(`${day},"${d.name}",${d.role},${hours.toFixed(2)},${rate},${pay}`);
    }

    reply.header('content-type', 'text/csv');
    reply.header('content-disposition',
      `attachment; filename="payroll_${from.toISOString().slice(0,10)}_to_${to.toISOString().slice(0,10)}.csv"`);
    return out.join('\n');
  });
}
