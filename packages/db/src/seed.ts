/**
 * Dev seed: one org, one site (Prestige Tower B, Bangalore coords),
 * one user per role. Idempotent — re-running upserts by phone/email.
 */
import { getDb, organizations, sites, users, tasks, sopProtocols, contracts, costRates, orgSettings } from './index';
import { eq, and } from 'drizzle-orm';

async function main() {
  const db = getDb();

  const existingOrgs = await db.select().from(organizations);
  const org =
    existingOrgs.at(0) ??
    (await db.insert(organizations).values({ name: 'Sunrise Builders Pvt Ltd' }).returning()).at(0)!;
  console.log('org:', org.id, org.name);

  // Org branding settings (idempotent).
  const existingSettings = await db.select().from(orgSettings).where(eq(orgSettings.orgId, org.id));
  if (existingSettings.length === 0) {
    await db.insert(orgSettings).values({
      orgId: org.id,
      accentColor: '#F59E0B',
      currency: 'INR',
      primaryCity: 'Bengaluru',
      defaultGeofenceRadiusM: 150,
      trialEndsAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // dev: 1y trial
      taskCap: 9999,
    });
    console.log('  + org settings');
  }

  const existingSites = await db.select().from(sites).where(eq(sites.orgId, org.id));
  const site =
    existingSites.at(0) ??
    (await db
      .insert(sites)
      .values({
        orgId: org.id,
        name: 'Prestige Tower B',
        address: 'Whitefield, Bengaluru',
        lat: 12.9698,
        lng: 77.7499,
        geofenceRadiusM: 150,
      })
      .returning()).at(0)!;
  console.log('site:', site.id, site.name);

  const seedUsers = [
    { name: 'R. Kumar',  role: 'worker'     as const, phone: '+919000000001', email: null,                       siteId: site.id },
    { name: 'S. Devi',   role: 'worker'     as const, phone: '+919000000002', email: null,                       siteId: site.id },
    { name: 'P. Singh',  role: 'supervisor' as const, phone: '+919000000010', email: null,                       siteId: site.id },
    { name: 'M. Iyer',   role: 'quality'    as const, phone: null,            email: 'quality@siteflow.local',   siteId: site.id },
    { name: 'V. Rao',    role: 'manager'    as const, phone: null,            email: 'manager@siteflow.local',   siteId: site.id },
    { name: 'A. Sharma', role: 'client'     as const, phone: null,            email: 'client@siteflow.local',    siteId: site.id },
    { name: 'D. Patel',  role: 'ceo'        as const, phone: null,            email: 'ceo@siteflow.local',       siteId: null    },
    { name: 'K. Mehta',  role: 'accounts'   as const, phone: null,            email: 'accounts@siteflow.local',  siteId: null    },
  ];

  for (const u of seedUsers) {
    const where = u.phone
      ? eq(users.phone, u.phone)
      : eq(users.email, u.email!);
    const found = await db.select().from(users).where(and(eq(users.orgId, org.id), where));
    if (found.length === 0) {
      await db.insert(users).values({ ...u, orgId: org.id });
      console.log('  + user', u.name, u.role);
    }
  }

  // Demo tasks — only seed if site has none. Safe on re-run.
  const existingTasks = await db.select().from(tasks).where(eq(tasks.siteId, site.id));
  if (existingTasks.length === 0) {
    const [worker] = await db.select().from(users).where(eq(users.phone, '+919000000001'));
    const [supervisor] = await db.select().from(users).where(eq(users.phone, '+919000000010'));
    if (!worker || !supervisor) throw new Error('seed: expected worker and supervisor users to exist');
    const now = new Date();
    const plus = (h: number) => new Date(now.getTime() + h * 3600_000);
    await db.insert(tasks).values([
      {
        siteId: site.id, title: 'Tile · Bath 2', trade: 'Tiling', location: 'B2-F7-Bath 2',
        assigneeUserId: worker.id, createdByUserId: supervisor.id,
        state: 'ASSIGNED',
        plannedStart: plus(0), plannedEnd: plus(3),
      },
      {
        siteId: site.id, title: 'Grouting · Bath 2', trade: 'Tiling', location: 'B2-F7-Bath 2',
        assigneeUserId: worker.id, createdByUserId: supervisor.id,
        state: 'ASSIGNED',
        plannedStart: plus(4), plannedEnd: plus(7),
      },
    ]);
    console.log('  + 2 demo tasks for', worker.name);
  }

  // ---------- M2: SOP library reference content ----------
  const existingSops = await db.select().from(sopProtocols).where(eq(sopProtocols.orgId, org.id));
  if (existingSops.length === 0) {
    await db.insert(sopProtocols).values([
      {
        orgId: org.id, trade: 'Tiling', title: 'Floor & wall tiling — bathroom',
        instructions: 'Substrate level ±2mm/2m. Notch trowel 8mm. Hollow-tap each tile within 24h. Joints 2mm, grouted T+48h.',
        requiredTests: ['VISUAL', 'TILE_HOLLOW_TAP'], sampleRatePerN: 3,
      },
      {
        orgId: org.id, trade: 'Painting', title: 'Emulsion 2-coat interior',
        instructions: 'Primer @ 8–10sqm/L. Sand between coats. Dry film 80–100μm total. No brush marks visible at 1m.',
        requiredTests: ['VISUAL', 'PAINT_SCRATCH'], sampleRatePerN: 4,
      },
      {
        orgId: org.id, trade: 'Plastering', title: 'Internal wall plaster 12mm',
        instructions: 'Hack RCC for key. CM 1:4. Plumb ±3mm/3m. Cure 7 days.',
        requiredTests: ['VISUAL', 'PLUMB_LINE'], sampleRatePerN: 3,
      },
      {
        orgId: org.id, trade: 'Marble',  title: 'Marble flooring laying',
        instructions: 'Bed mortar CM 1:4, 25mm avg. Level ±1mm/2m using blue light. Polish in 3 stages.',
        requiredTests: ['MARBLE_LEVEL', 'BLUE_LIGHT_FLATNESS'], sampleRatePerN: 2,
      },
      {
        orgId: org.id, trade: 'RCC', title: 'Slab concrete pour M25',
        instructions: 'Slump 75±25mm. Cube samples per 30m³. Vibrate <1m spacing. Cure 14 days minimum.',
        requiredTests: ['VISUAL'], sampleRatePerN: 1,
      },
      {
        orgId: org.id, trade: 'Electrical', title: 'Conduit & wiring rough-in',
        instructions: 'PVC conduits per drawing. Pull-through after wall closure check. Megger test before plaster.',
        requiredTests: ['VISUAL'], sampleRatePerN: 3,
      },
    ]);
    console.log('  + 6 SOP protocols');
  }

  // ---------- M3: contracts ----------
  const existingContracts = await db.select().from(contracts).where(eq(contracts.siteId, site.id));
  if (existingContracts.length === 0) {
    await db.insert(contracts).values({
      orgId: org.id, siteId: site.id,
      clientName: 'Prestige Estates Pvt Ltd',
      totalValue: 42_00_00_000, // ₹42 cr
      currency: 'INR',
      startDate: new Date('2026-01-15'),
      endDate: new Date('2027-06-30'),
    });
    console.log('  + contract for', site.name);
  }

  // ---------- M3: default cost rates per role (₹/hr) ----------
  const existingRates = await db.select().from(costRates).where(eq(costRates.orgId, org.id));
  if (existingRates.length === 0) {
    await db.insert(costRates).values([
      { orgId: org.id, role: 'worker',     hourlyRate: 220, currency: 'INR' },
      { orgId: org.id, role: 'supervisor', hourlyRate: 450, currency: 'INR' },
      { orgId: org.id, role: 'quality',    hourlyRate: 600, currency: 'INR' },
      { orgId: org.id, role: 'manager',    hourlyRate: 950, currency: 'INR' },
    ]);
    console.log('  + 4 cost rates');
  }

  console.log('seed complete.');
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
