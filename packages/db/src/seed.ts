/**
 * Mario demo seed — Hyderabad market.
 *
 * Creates one org ("Sunrise Builders") with five real Hyderabad projects, each
 * geofenced to its actual neighbourhood, with a 1-supervisor + 3-worker crew,
 * SOP-linked tasks across the full state machine (DRAFT → CLOSED including
 * IN_PROGRESS, PROOF_SUBMITTED, REWORK), one contract per site, four cost
 * rates. Idempotent: re-running upserts on (org name, site name, phone, email).
 */
import {
  getDb,
  organizations,
  sites,
  users,
  tasks,
  sopProtocols,
  contracts,
  costRates,
  orgSettings,
} from './index';
import { eq, and } from 'drizzle-orm';

type Trade = 'Tiling' | 'Painting' | 'Plastering' | 'Marble' | 'RCC' | 'Electrical';
type TaskState =
  | 'DRAFT' | 'ASSIGNED' | 'ACCEPTED' | 'IN_PROGRESS' | 'PROOF_SUBMITTED'
  | 'SUPERVISOR_APPROVED' | 'QUALITY_APPROVED' | 'MANAGER_APPROVED'
  | 'CLIENT_ACKNOWLEDGED' | 'CLOSED' | 'REJECTED' | 'REWORK' | 'BLOCKED';

interface SiteSpec {
  name: string;
  address: string;
  lat: number;
  lng: number;
  clientName: string;
  totalValueCr: number; // crores INR
  // Crew: 1 supervisor + 3 workers. Numbers are appended to the +9100 prefix.
  supervisorPhone: string;
  supervisorName: string;
  workers: { name: string; phone: string }[];
  tasks: { title: string; trade: Trade; location: string; state: TaskState; offsetH: [number, number]; assigneeIdx?: number }[];
}

// Five real Hyderabad residential developments. Coordinates are the actual
// project neighbourhoods so the 150m geofence demo is realistic.
const SITES: SiteSpec[] = [
  {
    name: 'My Home Bhooja – Tower 4',
    address: 'Hitech City, Hyderabad 500081',
    lat: 17.4474,
    lng: 78.3762,
    clientName: 'My Home Constructions Pvt Ltd',
    totalValueCr: 78,
    supervisorPhone: '+919000000110',
    supervisorName: 'P. Singh',
    workers: [
      { name: 'R. Kumar', phone: '+919000000111' },
      { name: 'S. Devi',  phone: '+919000000112' },
      { name: 'M. Yadav', phone: '+919000000113' },
    ],
    tasks: [
      { title: 'Vitrified tiling · Living', trade: 'Tiling',     location: 'T4-F12-Living',    state: 'IN_PROGRESS',     offsetH: [0, 6],   assigneeIdx: 0 },
      { title: 'Emulsion · Master bedroom', trade: 'Painting',   location: 'T4-F12-MBR',       state: 'PROOF_SUBMITTED', offsetH: [2, 5],   assigneeIdx: 1 },
      { title: 'Plaster · Bath 2 wall',     trade: 'Plastering', location: 'T4-F12-Bath 2',    state: 'REWORK',          offsetH: [-4, 0],  assigneeIdx: 2 },
      { title: 'Marble · Foyer',            trade: 'Marble',     location: 'T4-F12-Foyer',     state: 'ASSIGNED',        offsetH: [8, 14],  assigneeIdx: 0 },
      { title: 'Conduit pull · Kitchen',    trade: 'Electrical', location: 'T4-F12-Kitchen',   state: 'CLOSED',          offsetH: [-26, -22] },
      { title: 'RCC slab · F13',            trade: 'RCC',        location: 'T4-F13-Slab',      state: 'DRAFT',           offsetH: [48, 96] },
      { title: 'Tile grouting · Bath 2',    trade: 'Tiling',     location: 'T4-F12-Bath 2',    state: 'ASSIGNED',        offsetH: [10, 13], assigneeIdx: 1 },
    ],
  },
  {
    name: 'Aparna Sarovar Zenith – Block B',
    address: 'Nallagandla, Hyderabad 500019',
    lat: 17.4732,
    lng: 78.3142,
    clientName: 'Aparna Constructions & Estates',
    totalValueCr: 120,
    supervisorPhone: '+919000000120',
    supervisorName: 'V. Reddy',
    workers: [
      { name: 'N. Babu',    phone: '+919000000121' },
      { name: 'L. Prasad',  phone: '+919000000122' },
      { name: 'A. Khan',    phone: '+919000000123' },
    ],
    tasks: [
      { title: 'Painting · Common lobby',    trade: 'Painting',   location: 'B-Ground-Lobby',  state: 'IN_PROGRESS',     offsetH: [0, 4],   assigneeIdx: 0 },
      { title: 'Tiling · Balcony',           trade: 'Tiling',     location: 'B-F8-Balcony',    state: 'SUPERVISOR_APPROVED', offsetH: [-3, 1],  assigneeIdx: 1 },
      { title: 'Plaster · Bedroom ceiling',  trade: 'Plastering', location: 'B-F8-Bedroom 2',  state: 'CLOSED',          offsetH: [-30, -26] },
      { title: 'Marble · Master bath',       trade: 'Marble',     location: 'B-F8-MBath',      state: 'ASSIGNED',        offsetH: [12, 20], assigneeIdx: 2 },
      { title: 'Electrical · DB panel',      trade: 'Electrical', location: 'B-Ground-DB',     state: 'ACCEPTED',        offsetH: [1, 5],   assigneeIdx: 0 },
      { title: 'Vitrified · F9 entry',       trade: 'Tiling',     location: 'B-F9-Entry',      state: 'DRAFT',           offsetH: [24, 30] },
    ],
  },
  {
    name: 'Rajapushpa Atria – Phase 2',
    address: 'Kokapet, Hyderabad 500075',
    lat: 17.4126,
    lng: 78.3343,
    clientName: 'Rajapushpa Properties Pvt Ltd',
    totalValueCr: 95,
    supervisorPhone: '+919000000130',
    supervisorName: 'K. Murthy',
    workers: [
      { name: 'J. Rao',   phone: '+919000000131' },
      { name: 'B. Lal',   phone: '+919000000132' },
      { name: 'T. Anand', phone: '+919000000133' },
    ],
    tasks: [
      { title: 'Tile · Bath 1',              trade: 'Tiling',     location: 'A2-F6-Bath 1',    state: 'QUALITY_APPROVED', offsetH: [-6, -2], assigneeIdx: 0 },
      { title: 'Plaster · Living wall',      trade: 'Plastering', location: 'A2-F6-Living',    state: 'IN_PROGRESS',     offsetH: [0, 5],   assigneeIdx: 1 },
      { title: 'Marble · Pooja room',        trade: 'Marble',     location: 'A2-F6-Pooja',     state: 'MANAGER_APPROVED', offsetH: [-10, -6], assigneeIdx: 2 },
      { title: 'Painting · External façade', trade: 'Painting',   location: 'A2-Ext-East',     state: 'DRAFT',           offsetH: [72, 200] },
      { title: 'RCC · Beam casting F7',      trade: 'RCC',        location: 'A2-F7-Beam',      state: 'REWORK',          offsetH: [-2, 2],  assigneeIdx: 0 },
      { title: 'Conduit · F6 South',         trade: 'Electrical', location: 'A2-F6-South',     state: 'ASSIGNED',        offsetH: [6, 12],  assigneeIdx: 1 },
      { title: 'Tile · Kitchen dado',        trade: 'Tiling',     location: 'A2-F6-Kitchen',   state: 'CLOSED',          offsetH: [-48, -42] },
    ],
  },
  {
    name: 'Prestige High Fields – Tower 6',
    address: 'Gachibowli, Hyderabad 500032',
    lat: 17.4401,
    lng: 78.3489,
    clientName: 'Prestige Estates Projects Ltd',
    totalValueCr: 145,
    supervisorPhone: '+919000000140',
    supervisorName: 'H. Iyer',
    workers: [
      { name: 'C. Vinay',  phone: '+919000000141' },
      { name: 'P. Naidu',  phone: '+919000000142' },
      { name: 'S. Mahesh', phone: '+919000000143' },
    ],
    tasks: [
      { title: 'Vitrified tiling · Living',     trade: 'Tiling',     location: 'T6-F18-Living', state: 'PROOF_SUBMITTED', offsetH: [1, 4],   assigneeIdx: 0 },
      { title: 'Emulsion · Hall + dining',      trade: 'Painting',   location: 'T6-F18-Hall',   state: 'ASSIGNED',        offsetH: [6, 12],  assigneeIdx: 1 },
      { title: 'Marble · MBR floor',            trade: 'Marble',     location: 'T6-F18-MBR',    state: 'SUPERVISOR_APPROVED', offsetH: [-4, 0], assigneeIdx: 2 },
      { title: 'Plaster · Bath 2',              trade: 'Plastering', location: 'T6-F18-Bath 2', state: 'IN_PROGRESS',     offsetH: [0, 6],   assigneeIdx: 0 },
      { title: 'RCC · Slab pour F19',           trade: 'RCC',        location: 'T6-F19-Slab',   state: 'DRAFT',           offsetH: [120, 168] },
      { title: 'Electrical · Penthouse rough',  trade: 'Electrical', location: 'T6-PH-Wiring',  state: 'ACCEPTED',        offsetH: [2, 8],   assigneeIdx: 1 },
      { title: 'Marble · Foyer polishing',      trade: 'Marble',     location: 'T6-F18-Foyer',  state: 'CLOSED',          offsetH: [-72, -66] },
      { title: 'Tile dado · Kitchen',           trade: 'Tiling',     location: 'T6-F18-Kitchen',state: 'REWORK',          offsetH: [-3, 1],  assigneeIdx: 2 },
    ],
  },
  {
    name: 'Sumadhura Acropolis – Penthouse Block',
    address: 'Gachibowli, Hyderabad 500032',
    lat: 17.4378,
    lng: 78.3520,
    clientName: 'Sumadhura Infracon Pvt Ltd',
    totalValueCr: 62,
    supervisorPhone: '+919000000150',
    supervisorName: 'D. Pillai',
    workers: [
      { name: 'G. Suresh',  phone: '+919000000151' },
      { name: 'V. Kiran',   phone: '+919000000152' },
      { name: 'N. Bhaskar', phone: '+919000000153' },
    ],
    tasks: [
      { title: 'Marble · Penthouse living',     trade: 'Marble',     location: 'PH-F22-Living', state: 'IN_PROGRESS',     offsetH: [0, 8],   assigneeIdx: 0 },
      { title: 'Painting · Penthouse hall',     trade: 'Painting',   location: 'PH-F22-Hall',   state: 'MANAGER_APPROVED', offsetH: [-12, -6], assigneeIdx: 1 },
      { title: 'Vitrified · Service balcony',   trade: 'Tiling',     location: 'PH-F22-SBal',   state: 'ASSIGNED',        offsetH: [10, 14], assigneeIdx: 2 },
      { title: 'Plaster · Servant quarters',    trade: 'Plastering', location: 'PH-F22-SQ',     state: 'CLOSED',          offsetH: [-96, -90] },
      { title: 'Electrical · Smart-home panel', trade: 'Electrical', location: 'PH-F22-Panel',  state: 'PROOF_SUBMITTED', offsetH: [2, 5],   assigneeIdx: 0 },
      { title: 'RCC · Terrace overhead tank',   trade: 'RCC',        location: 'PH-Terrace-OHT',state: 'DRAFT',           offsetH: [48, 96] },
    ],
  },
];

async function main() {
  const db = getDb();
  const now = new Date();
  const plus = (h: number) => new Date(now.getTime() + h * 3_600_000);

  // ---------- Organization ----------
  const existingOrgs = await db.select().from(organizations);
  const org =
    existingOrgs.at(0) ??
    (await db.insert(organizations).values({ name: 'Sunrise Builders Pvt Ltd' }).returning()).at(0)!;
  console.log('org:', org.id, org.name);

  // ---------- Branding ----------
  const existingSettings = await db.select().from(orgSettings).where(eq(orgSettings.orgId, org.id));
  if (existingSettings.length === 0) {
    await db.insert(orgSettings).values({
      orgId: org.id,
      accentColor: '#F59E0B',
      currency: 'INR',
      primaryCity: 'Hyderabad',
      defaultGeofenceRadiusM: 150,
      trialEndsAt: plus(365 * 24),
      taskCap: 9999,
    });
    console.log('  + org settings (Hyderabad)');
  }

  // ---------- Desk users (org-wide, site-agnostic) ----------
  const deskUsers = [
    { name: 'M. Iyer',   role: 'quality'  as const, phone: null, email: 'quality@siteflow.local',  siteId: null },
    { name: 'V. Rao',    role: 'manager'  as const, phone: null, email: 'manager@siteflow.local',  siteId: null },
    { name: 'A. Sharma', role: 'client'   as const, phone: null, email: 'client@siteflow.local',   siteId: null },
    { name: 'D. Patel',  role: 'ceo'      as const, phone: null, email: 'ceo@siteflow.local',      siteId: null },
    { name: 'K. Mehta',  role: 'accounts' as const, phone: null, email: 'accounts@siteflow.local', siteId: null },
  ];
  for (const u of deskUsers) {
    const found = await db.select().from(users).where(and(eq(users.orgId, org.id), eq(users.email, u.email!)));
    if (found.length === 0) {
      await db.insert(users).values({ ...u, orgId: org.id });
      console.log('  + desk user', u.name, u.role);
    }
  }

  // ---------- Sites + crews + tasks ----------
  for (const spec of SITES) {
    const existingSite = await db.select().from(sites)
      .where(and(eq(sites.orgId, org.id), eq(sites.name, spec.name)));
    const site = existingSite.at(0) ?? (await db.insert(sites).values({
      orgId: org.id,
      name: spec.name,
      address: spec.address,
      lat: spec.lat,
      lng: spec.lng,
      geofenceRadiusM: 150,
    }).returning()).at(0)!;
    console.log('site:', site.name, `(${site.lat.toFixed(4)}, ${site.lng.toFixed(4)})`);

    // Supervisor
    const supExisting = await db.select().from(users).where(eq(users.phone, spec.supervisorPhone));
    let supervisor = supExisting.at(0);
    if (!supervisor) {
      const [created] = await db.insert(users).values({
        orgId: org.id,
        name: spec.supervisorName,
        role: 'supervisor',
        phone: spec.supervisorPhone,
        siteId: site.id,
      }).returning();
      supervisor = created;
      console.log('  + supervisor', spec.supervisorName);
    } else if (supervisor.siteId !== site.id) {
      await db.update(users).set({ siteId: site.id }).where(eq(users.id, supervisor.id));
    }

    // Workers
    const workerRows: { id: string }[] = [];
    for (const w of spec.workers) {
      const existing = await db.select().from(users).where(eq(users.phone, w.phone));
      let row = existing.at(0);
      if (!row) {
        const [created] = await db.insert(users).values({
          orgId: org.id, name: w.name, role: 'worker', phone: w.phone, siteId: site.id,
        }).returning();
        row = created;
        console.log('  + worker', w.name);
      } else if (row.siteId !== site.id) {
        await db.update(users).set({ siteId: site.id }).where(eq(users.id, row.id));
      }
      workerRows.push({ id: row.id });
    }

    // Skip task seeding if this site already has tasks (idempotent).
    const existingTasks = await db.select().from(tasks).where(eq(tasks.siteId, site.id));
    if (existingTasks.length === 0) {
      for (const t of spec.tasks) {
        const assignee = t.assigneeIdx != null ? workerRows[t.assigneeIdx]?.id : null;
        const actualStart =
          ['IN_PROGRESS', 'PROOF_SUBMITTED', 'SUPERVISOR_APPROVED', 'QUALITY_APPROVED',
           'MANAGER_APPROVED', 'CLIENT_ACKNOWLEDGED', 'CLOSED', 'REWORK'].includes(t.state)
            ? plus(t.offsetH[0]) : null;
        const actualEnd =
          ['CLOSED', 'CLIENT_ACKNOWLEDGED', 'MANAGER_APPROVED'].includes(t.state)
            ? plus(t.offsetH[1]) : null;
        await db.insert(tasks).values({
          siteId: site.id,
          title: t.title,
          trade: t.trade,
          location: t.location,
          assigneeUserId: assignee ?? null,
          createdByUserId: supervisor!.id,
          state: t.state,
          plannedStart: plus(t.offsetH[0]),
          plannedEnd: plus(t.offsetH[1]),
          actualStart,
          actualEnd,
        });
      }
      console.log(`  + ${spec.tasks.length} tasks`);
    }

    // One contract per site (idempotent on site id).
    const existingContracts = await db.select().from(contracts).where(eq(contracts.siteId, site.id));
    if (existingContracts.length === 0) {
      await db.insert(contracts).values({
        orgId: org.id, siteId: site.id,
        clientName: spec.clientName,
        totalValue: spec.totalValueCr * 1_00_00_000,
        currency: 'INR',
        startDate: new Date('2026-01-15'),
        endDate: new Date('2027-12-31'),
      });
      console.log('  + contract', spec.clientName, `(₹${spec.totalValueCr} cr)`);
    }
  }

  // ---------- SOP library (org-wide reference content) ----------
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
        orgId: org.id, trade: 'Marble', title: 'Marble flooring laying',
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

  // ---------- Cost rates per role (₹/hr) ----------
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

  // ---------- Pin desk users to the first site so /tasks listings work ----------
  const firstSite = (await db.select().from(sites).where(eq(sites.orgId, org.id))).at(0);
  if (firstSite) {
    for (const role of ['quality', 'manager', 'client'] as const) {
      await db.update(users).set({ siteId: firstSite.id })
        .where(and(eq(users.orgId, org.id), eq(users.role, role)));
    }
  }

  console.log('seed complete.');
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
