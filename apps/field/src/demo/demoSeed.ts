/**
 * In-browser demo seed. Mirrors what packages/db/src/seed.ts creates so the
 * web app can run with zero backend on Vercel. The store is mutable in-memory
 * — POST /tasks etc. write to it and the dashboard reflects the change for
 * the rest of the session.
 *
 * All IDs are deterministic strings (not UUIDs) so the demo data is easy to
 * reason about. The dev API issues real UUIDs in production mode.
 */

export type Role = 'employee' | 'supervisor' | 'quality' | 'manager' | 'client' | 'ceo' | 'accounts';
export type TaskState =
  | 'DRAFT' | 'ASSIGNED' | 'ACCEPTED' | 'IN_PROGRESS' | 'PROOF_SUBMITTED'
  | 'SUPERVISOR_APPROVED' | 'QUALITY_APPROVED' | 'MANAGER_APPROVED'
  | 'CLIENT_ACKNOWLEDGED' | 'CLOSED' | 'REJECTED' | 'REWORK' | 'BLOCKED';

export interface Site { id: string; orgId: string; name: string; address: string; lat: number; lng: number; geofenceRadiusM: number; kind: string; createdAt: string }
export interface UserRow { id: string; orgId: string; name: string; role: Role; phone: string | null; email: string | null; siteId: string | null; active: boolean }
export interface Task {
  id: string; siteId: string; title: string; trade: string; location: string;
  state: TaskState; assigneeUserId: string | null; createdByUserId: string | null;
  plannedStart: string | null; plannedEnd: string | null;
  actualStart: string | null; actualEnd: string | null;
  sopProtocolId: string | null; qualitySampled: boolean; acceptedAt: string | null;
  createdAt: string; updatedAt: string;
  reworkCount?: number; referenceImageUrl?: string | null;
}
export interface Sop { id: string; orgId: string; trade: string; title: string; version: string; instructions: string; requiredTests: string[]; sampleRatePerN: number; refMediaS3Key: string | null }
export interface Contract { id: string; orgId: string; siteId: string; clientName: string; totalValue: number; currency: string; startDate: string; endDate: string }
export interface CostRate { id: string; orgId: string; role: Role; hourlyRate: number; currency: string }
export interface OrgSettings { accentColor: string; currency: string; primaryCity: string; defaultGeofenceRadiusM: number; logoS3Key: string | null }

const ORG_ID = 'org_sunrise';
const NOW = () => new Date().toISOString();
const HOURS = (h: number) => new Date(Date.now() + h * 3_600_000).toISOString();

interface SiteSpec {
  id: string; name: string; address: string; lat: number; lng: number; clientName: string; totalValueCr: number;
  supervisor: { id: string; name: string; phone: string };
  employees: { id: string; name: string; phone: string }[];
  tasks: { id: string; title: string; trade: string; location: string; state: TaskState; offsetH: [number, number]; assigneeIdx?: number }[];
}

const SITES_SPEC: SiteSpec[] = [
  {
    id: 'site_bhooja', name: 'My Home Bhooja – Tower 4', address: 'Hitech City, Hyderabad 500081',
    lat: 17.4474, lng: 78.3762, clientName: 'My Home Constructions Pvt Ltd', totalValueCr: 78,
    supervisor: { id: 'u_sup_bhooja', name: 'P. Singh', phone: '+919000000110' },
    employees: [
      { id: 'u_w_bhooja_1', name: 'R. Kumar', phone: '+919000000111' },
      { id: 'u_w_bhooja_2', name: 'S. Devi',  phone: '+919000000112' },
      { id: 'u_w_bhooja_3', name: 'M. Yadav', phone: '+919000000113' },
    ],
    tasks: [
      { id: 't_b1', title: 'Vitrified tiling · Living', trade: 'Tiling',     location: 'T4-F12-Living',  state: 'IN_PROGRESS',     offsetH: [0, 6],   assigneeIdx: 0 },
      { id: 't_b2', title: 'Emulsion · Master bedroom', trade: 'Painting',   location: 'T4-F12-MBR',     state: 'PROOF_SUBMITTED', offsetH: [2, 5],   assigneeIdx: 1 },
      { id: 't_b3', title: 'Plaster · Bath 2 wall',     trade: 'Plastering', location: 'T4-F12-Bath 2',  state: 'REWORK',          offsetH: [-4, 0],  assigneeIdx: 2 },
      { id: 't_b4', title: 'Marble · Foyer',            trade: 'Marble',     location: 'T4-F12-Foyer',   state: 'ASSIGNED',        offsetH: [8, 14],  assigneeIdx: 0 },
      { id: 't_b5', title: 'Conduit pull · Kitchen',    trade: 'Electrical', location: 'T4-F12-Kitchen', state: 'CLOSED',          offsetH: [-26, -22] },
      { id: 't_b6', title: 'RCC slab · F13',            trade: 'RCC',        location: 'T4-F13-Slab',    state: 'DRAFT',           offsetH: [48, 96] },
      { id: 't_b7', title: 'Tile grouting · Bath 2',    trade: 'Tiling',     location: 'T4-F12-Bath 2',  state: 'ASSIGNED',        offsetH: [10, 13], assigneeIdx: 1 },
    ],
  },
  {
    id: 'site_aparna', name: 'Aparna Sarovar Zenith – Block B', address: 'Nallagandla, Hyderabad 500019',
    lat: 17.4732, lng: 78.3142, clientName: 'Aparna Constructions & Estates', totalValueCr: 120,
    supervisor: { id: 'u_sup_aparna', name: 'V. Reddy', phone: '+919000000120' },
    employees: [
      { id: 'u_w_aparna_1', name: 'N. Babu',   phone: '+919000000121' },
      { id: 'u_w_aparna_2', name: 'L. Prasad', phone: '+919000000122' },
      { id: 'u_w_aparna_3', name: 'A. Khan',   phone: '+919000000123' },
    ],
    tasks: [
      { id: 't_a1', title: 'Painting · Common lobby',   trade: 'Painting',   location: 'B-Ground-Lobby', state: 'IN_PROGRESS',         offsetH: [0, 4],   assigneeIdx: 0 },
      { id: 't_a2', title: 'Tiling · Balcony',          trade: 'Tiling',     location: 'B-F8-Balcony',   state: 'SUPERVISOR_APPROVED', offsetH: [-3, 1],  assigneeIdx: 1 },
      { id: 't_a3', title: 'Plaster · Bedroom ceiling', trade: 'Plastering', location: 'B-F8-Bedroom 2', state: 'CLOSED',              offsetH: [-30, -26] },
      { id: 't_a4', title: 'Marble · Master bath',      trade: 'Marble',     location: 'B-F8-MBath',     state: 'ASSIGNED',            offsetH: [12, 20], assigneeIdx: 2 },
      { id: 't_a5', title: 'Electrical · DB panel',     trade: 'Electrical', location: 'B-Ground-DB',    state: 'ACCEPTED',            offsetH: [1, 5],   assigneeIdx: 0 },
      { id: 't_a6', title: 'Vitrified · F9 entry',      trade: 'Tiling',     location: 'B-F9-Entry',     state: 'DRAFT',               offsetH: [24, 30] },
    ],
  },
  {
    id: 'site_raja', name: 'Rajapushpa Atria – Phase 2', address: 'Kokapet, Hyderabad 500075',
    lat: 17.4126, lng: 78.3343, clientName: 'Rajapushpa Properties Pvt Ltd', totalValueCr: 95,
    supervisor: { id: 'u_sup_raja', name: 'K. Murthy', phone: '+919000000130' },
    employees: [
      { id: 'u_w_raja_1', name: 'J. Rao',   phone: '+919000000131' },
      { id: 'u_w_raja_2', name: 'B. Lal',   phone: '+919000000132' },
      { id: 'u_w_raja_3', name: 'T. Anand', phone: '+919000000133' },
    ],
    tasks: [
      { id: 't_r1', title: 'Tile · Bath 1',              trade: 'Tiling',     location: 'A2-F6-Bath 1',  state: 'QUALITY_APPROVED', offsetH: [-6, -2], assigneeIdx: 0 },
      { id: 't_r2', title: 'Plaster · Living wall',      trade: 'Plastering', location: 'A2-F6-Living',  state: 'IN_PROGRESS',      offsetH: [0, 5],   assigneeIdx: 1 },
      { id: 't_r3', title: 'Marble · Pooja room',        trade: 'Marble',     location: 'A2-F6-Pooja',   state: 'MANAGER_APPROVED', offsetH: [-10, -6], assigneeIdx: 2 },
      { id: 't_r4', title: 'Painting · External façade', trade: 'Painting',   location: 'A2-Ext-East',   state: 'DRAFT',            offsetH: [72, 200] },
      { id: 't_r5', title: 'RCC · Beam casting F7',      trade: 'RCC',        location: 'A2-F7-Beam',    state: 'REWORK',           offsetH: [-2, 2],  assigneeIdx: 0 },
      { id: 't_r6', title: 'Conduit · F6 South',         trade: 'Electrical', location: 'A2-F6-South',   state: 'ASSIGNED',         offsetH: [6, 12],  assigneeIdx: 1 },
      { id: 't_r7', title: 'Tile · Kitchen dado',        trade: 'Tiling',     location: 'A2-F6-Kitchen', state: 'CLOSED',           offsetH: [-48, -42] },
    ],
  },
  {
    id: 'site_pres', name: 'Prestige High Fields – Tower 6', address: 'Gachibowli, Hyderabad 500032',
    lat: 17.4401, lng: 78.3489, clientName: 'Prestige Estates Projects Ltd', totalValueCr: 145,
    supervisor: { id: 'u_sup_pres', name: 'H. Iyer', phone: '+919000000140' },
    employees: [
      { id: 'u_w_pres_1', name: 'C. Vinay',  phone: '+919000000141' },
      { id: 'u_w_pres_2', name: 'P. Naidu',  phone: '+919000000142' },
      { id: 'u_w_pres_3', name: 'S. Mahesh', phone: '+919000000143' },
    ],
    tasks: [
      { id: 't_p1', title: 'Vitrified tiling · Living',     trade: 'Tiling',     location: 'T6-F18-Living', state: 'PROOF_SUBMITTED',     offsetH: [1, 4],   assigneeIdx: 0 },
      { id: 't_p2', title: 'Emulsion · Hall + dining',      trade: 'Painting',   location: 'T6-F18-Hall',   state: 'ASSIGNED',            offsetH: [6, 12],  assigneeIdx: 1 },
      { id: 't_p3', title: 'Marble · MBR floor',            trade: 'Marble',     location: 'T6-F18-MBR',    state: 'SUPERVISOR_APPROVED', offsetH: [-4, 0],  assigneeIdx: 2 },
      { id: 't_p4', title: 'Plaster · Bath 2',              trade: 'Plastering', location: 'T6-F18-Bath 2', state: 'IN_PROGRESS',         offsetH: [0, 6],   assigneeIdx: 0 },
      { id: 't_p5', title: 'RCC · Slab pour F19',           trade: 'RCC',        location: 'T6-F19-Slab',   state: 'DRAFT',               offsetH: [120, 168] },
      { id: 't_p6', title: 'Electrical · Penthouse rough',  trade: 'Electrical', location: 'T6-PH-Wiring',  state: 'ACCEPTED',            offsetH: [2, 8],   assigneeIdx: 1 },
      { id: 't_p7', title: 'Marble · Foyer polishing',      trade: 'Marble',     location: 'T6-F18-Foyer',  state: 'CLOSED',              offsetH: [-72, -66] },
      { id: 't_p8', title: 'Tile dado · Kitchen',           trade: 'Tiling',     location: 'T6-F18-Kitchen',state: 'REWORK',              offsetH: [-3, 1],  assigneeIdx: 2 },
    ],
  },
  {
    id: 'site_suma', name: 'Sumadhura Acropolis – Penthouse Block', address: 'Gachibowli, Hyderabad 500032',
    lat: 17.4378, lng: 78.3520, clientName: 'Sumadhura Infracon Pvt Ltd', totalValueCr: 62,
    supervisor: { id: 'u_sup_suma', name: 'D. Pillai', phone: '+919000000150' },
    employees: [
      { id: 'u_w_suma_1', name: 'G. Suresh',  phone: '+919000000151' },
      { id: 'u_w_suma_2', name: 'V. Kiran',   phone: '+919000000152' },
      { id: 'u_w_suma_3', name: 'N. Bhaskar', phone: '+919000000153' },
    ],
    tasks: [
      { id: 't_s1', title: 'Marble · Penthouse living',     trade: 'Marble',     location: 'PH-F22-Living',  state: 'IN_PROGRESS',      offsetH: [0, 8],   assigneeIdx: 0 },
      { id: 't_s2', title: 'Painting · Penthouse hall',     trade: 'Painting',   location: 'PH-F22-Hall',    state: 'MANAGER_APPROVED', offsetH: [-12, -6], assigneeIdx: 1 },
      { id: 't_s3', title: 'Vitrified · Service balcony',   trade: 'Tiling',     location: 'PH-F22-SBal',    state: 'ASSIGNED',         offsetH: [10, 14], assigneeIdx: 2 },
      { id: 't_s4', title: 'Plaster · Servant quarters',    trade: 'Plastering', location: 'PH-F22-SQ',      state: 'CLOSED',           offsetH: [-96, -90] },
      { id: 't_s5', title: 'Electrical · Smart-home panel', trade: 'Electrical', location: 'PH-F22-Panel',   state: 'PROOF_SUBMITTED',  offsetH: [2, 5],   assigneeIdx: 0 },
      { id: 't_s6', title: 'RCC · Terrace overhead tank',   trade: 'RCC',        location: 'PH-Terrace-OHT', state: 'DRAFT',            offsetH: [48, 96] },
    ],
  },
];

const SOP_SPEC: { id: string; trade: string; title: string; sampleRatePerN: number; instructions: string; requiredTests: string[] }[] = [
  { id: 'sop_tile',  trade: 'Tiling',     title: 'Floor & wall tiling — bathroom', sampleRatePerN: 3, instructions: 'Substrate level ±2mm/2m. Notch trowel 8mm. Hollow-tap each tile within 24h.', requiredTests: ['VISUAL', 'TILE_HOLLOW_TAP'] },
  { id: 'sop_paint', trade: 'Painting',   title: 'Emulsion 2-coat interior',       sampleRatePerN: 4, instructions: 'Primer @ 8–10sqm/L. Sand between coats. Dry film 80–100μm total.', requiredTests: ['VISUAL', 'PAINT_SCRATCH'] },
  { id: 'sop_plast', trade: 'Plastering', title: 'Internal wall plaster 12mm',     sampleRatePerN: 3, instructions: 'Hack RCC for key. CM 1:4. Plumb ±3mm/3m. Cure 7 days.', requiredTests: ['VISUAL', 'PLUMB_LINE'] },
  { id: 'sop_marb',  trade: 'Marble',     title: 'Marble flooring laying',         sampleRatePerN: 2, instructions: 'Bed mortar CM 1:4, 25mm avg. Level ±1mm/2m using blue light. Polish in 3 stages.', requiredTests: ['MARBLE_LEVEL', 'BLUE_LIGHT_FLATNESS'] },
  { id: 'sop_rcc',   trade: 'RCC',        title: 'Slab concrete pour M25',         sampleRatePerN: 1, instructions: 'Slump 75±25mm. Cube samples per 30m³. Vibrate <1m spacing.', requiredTests: ['VISUAL'] },
  { id: 'sop_elec',  trade: 'Electrical', title: 'Conduit & wiring rough-in',      sampleRatePerN: 3, instructions: 'PVC conduits per drawing. Pull-through after wall closure check.', requiredTests: ['VISUAL'] },
];

function buildInitialStore() {
  const sites: Site[] = SITES_SPEC.map((s) => ({
    id: s.id, orgId: ORG_ID, name: s.name, address: s.address, kind: 'APARTMENT',
    lat: s.lat, lng: s.lng, geofenceRadiusM: 150, createdAt: NOW(),
  }));
  const firstSiteId = sites[0]!.id;

  const deskUsers: UserRow[] = [
    { id: 'u_quality',  orgId: ORG_ID, name: 'M. Iyer',   role: 'quality',  phone: null, email: 'quality@siteflow.local',  siteId: firstSiteId, active: true },
    { id: 'u_manager',  orgId: ORG_ID, name: 'V. Rao',    role: 'manager',  phone: null, email: 'manager@siteflow.local',  siteId: firstSiteId, active: true },
    { id: 'u_client',   orgId: ORG_ID, name: 'A. Sharma', role: 'client',   phone: null, email: 'client@siteflow.local',   siteId: firstSiteId, active: true },
    { id: 'u_ceo',      orgId: ORG_ID, name: 'D. Patel',  role: 'ceo',      phone: null, email: 'ceo@siteflow.local',      siteId: null, active: true },
    { id: 'u_accounts', orgId: ORG_ID, name: 'K. Mehta',  role: 'accounts', phone: null, email: 'accounts@siteflow.local', siteId: null, active: true },
  ];

  const fieldUsers: UserRow[] = SITES_SPEC.flatMap((s) => [
    { id: s.supervisor.id, orgId: ORG_ID, name: s.supervisor.name, role: 'supervisor' as Role, phone: s.supervisor.phone, email: null, siteId: s.id, active: true },
    ...s.employees.map((w) => ({ id: w.id, orgId: ORG_ID, name: w.name, role: 'employee' as Role, phone: w.phone, email: null, siteId: s.id, active: true })),
  ]);

  const users = [...deskUsers, ...fieldUsers];

  const tasks: Task[] = SITES_SPEC.flatMap((s) => s.tasks.map((t): Task => {
    const assigneeId = t.assigneeIdx != null ? s.employees[t.assigneeIdx]!.id : null;
    const actualStart = ['IN_PROGRESS', 'PROOF_SUBMITTED', 'SUPERVISOR_APPROVED', 'QUALITY_APPROVED', 'MANAGER_APPROVED', 'CLIENT_ACKNOWLEDGED', 'CLOSED', 'REWORK'].includes(t.state) ? HOURS(t.offsetH[0]) : null;
    const actualEnd = ['CLOSED', 'CLIENT_ACKNOWLEDGED', 'MANAGER_APPROVED'].includes(t.state) ? HOURS(t.offsetH[1]) : null;
    const trade = t.trade.toLowerCase();
    const sop = SOP_SPEC.find((x) => x.trade.toLowerCase() === trade);
    return {
      id: t.id, siteId: s.id, title: t.title, trade: t.trade, location: t.location,
      state: t.state, assigneeUserId: assigneeId, createdByUserId: s.supervisor.id,
      plannedStart: HOURS(t.offsetH[0]), plannedEnd: HOURS(t.offsetH[1]),
      actualStart, actualEnd, sopProtocolId: sop?.id ?? null,
      qualitySampled: true, acceptedAt: null, createdAt: NOW(), updatedAt: NOW(),
      reworkCount: t.state === 'REWORK' ? 1 : 0, referenceImageUrl: null,
    };
  }));

  const sops: Sop[] = SOP_SPEC.map((s) => ({
    id: s.id, orgId: ORG_ID, trade: s.trade, title: s.title, version: 'v1',
    instructions: s.instructions, requiredTests: s.requiredTests, sampleRatePerN: s.sampleRatePerN, refMediaS3Key: null,
  }));

  const contracts: Contract[] = SITES_SPEC.map((s, i) => ({
    id: `contract_${i}`, orgId: ORG_ID, siteId: s.id, clientName: s.clientName,
    totalValue: s.totalValueCr * 1_00_00_000, currency: 'INR',
    startDate: '2026-01-15T00:00:00.000Z', endDate: '2027-12-31T00:00:00.000Z',
  }));

  const costRates: CostRate[] = [
    { id: 'rate_w',  orgId: ORG_ID, role: 'employee',     hourlyRate: 220, currency: 'INR' },
    { id: 'rate_s',  orgId: ORG_ID, role: 'supervisor', hourlyRate: 450, currency: 'INR' },
    { id: 'rate_q',  orgId: ORG_ID, role: 'quality',    hourlyRate: 600, currency: 'INR' },
    { id: 'rate_m',  orgId: ORG_ID, role: 'manager',    hourlyRate: 950, currency: 'INR' },
  ];

  const settings: OrgSettings = {
    accentColor: '#E97300', currency: 'INR', primaryCity: 'Hyderabad',
    defaultGeofenceRadiusM: 150, logoS3Key: null,
  };

  return { sites, users, tasks, sops, contracts, costRates, settings };
}

export const store = buildInitialStore();
export const ORG = { id: ORG_ID, name: 'Sunrise Builders Pvt Ltd', createdAt: NOW() };

export function newId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}
