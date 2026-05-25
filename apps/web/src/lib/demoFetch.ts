/**
 * In-browser handler that mimics the Mickey API for the deployed Vercel demo.
 * Returns a `Response` so callers can keep using their existing fetch logic.
 *
 * Pattern: match the URL path + method, mutate `store`, return JSON.
 */
import { store, ORG, newId, type Task, type TaskState, type Role } from './demoSeed';

function ok(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}
function notFound(): Response {
  return new Response(JSON.stringify({ error: 'demo: route not implemented' }), { status: 404, headers: { 'content-type': 'application/json' } });
}

function userByLogin(idOrEmailOrPhone: string) {
  return store.users.find((u) => u.email === idOrEmailOrPhone || u.phone === idOrEmailOrPhone);
}

function tokenFor(userId: string): string {
  // Synthetic token — not a real JWT. The dashboard only stores/sends it; it
  // doesn't verify the signature on the client side.
  return `demo.${btoa(userId)}.${Date.now()}`;
}

const APPROVAL_ADVANCE: Record<TaskState, TaskState | null> = {
  PROOF_SUBMITTED: 'SUPERVISOR_APPROVED',
  SUPERVISOR_APPROVED: 'QUALITY_APPROVED',
  QUALITY_APPROVED: 'MANAGER_APPROVED',
  MANAGER_APPROVED: 'CLOSED',
  DRAFT: null, ASSIGNED: null, ACCEPTED: null, IN_PROGRESS: null,
  CLIENT_ACKNOWLEDGED: 'CLOSED', CLOSED: null, REJECTED: null, REWORK: null, BLOCKED: null,
};

const PENDING_FOR_ROLE: Record<Role, TaskState[]> = {
  supervisor: ['PROOF_SUBMITTED'],
  quality:    ['SUPERVISOR_APPROVED'],
  manager:    ['QUALITY_APPROVED'],
  client:     ['MANAGER_APPROVED'],
  worker: [], ceo: [], accounts: [],
};

function decorate(t: Task): Task {
  return { ...t, reworkCount: t.reworkCount ?? 0, referenceImageUrl: t.referenceImageUrl ?? null };
}

export async function demoFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const url = new URL(input, 'http://localhost');
  const path = url.pathname;
  const method = (init.method ?? 'GET').toUpperCase();
  const body: any = init.body ? safeJson(init.body) : undefined;

  // ---------- AUTH ----------
  if (path === '/auth/login' && method === 'POST') {
    const user = userByLogin(body?.phoneOrEmail ?? '');
    if (!user) return ok({ error: 'unknown user' }, 401);
    return ok({
      token: tokenFor(user.id),
      user: { id: user.id, name: user.name, role: user.role, siteId: user.siteId, orgId: user.orgId },
    });
  }
  if (path === '/auth/me' && method === 'GET') {
    // In demo we trust the cached user blob in localStorage; this endpoint is just a probe.
    return ok({ ok: true });
  }
  if (path.startsWith('/auth/otp/')) {
    // Pretend OTP "sent" — devCode is always 000000.
    return ok({ ok: true, ttlSec: 300, devCode: '000000' });
  }

  // ---------- ORG ----------
  if (path === '/orgs/me' && method === 'GET') {
    return ok({ org: ORG, settings: store.settings, logoUrl: null });
  }
  if (path === '/orgs/me' && method === 'PATCH') {
    Object.assign(store.settings, body ?? {});
    return ok({ ok: true });
  }
  if (path === '/orgs/me/logo-presign' && method === 'POST') {
    return ok({ error: 'logo upload disabled in demo mode — connect a real API to enable.' }, 400);
  }

  // ---------- SITES ----------
  if (path === '/sites' && method === 'GET') {
    return ok(store.sites);
  }
  if (path === '/sites' && method === 'POST') {
    const site = {
      id: newId('site'), orgId: ORG.id, name: body?.name ?? 'New project',
      kind: body?.kind ?? 'APARTMENT', address: body?.address ?? '',
      lat: body?.lat ?? 17.4474, lng: body?.lng ?? 78.3762,
      geofenceRadiusM: body?.geofenceRadiusM ?? 150, createdAt: new Date().toISOString(),
    };
    store.sites.push(site);
    return ok(site);
  }

  // ---------- USERS ----------
  if (path === '/users' && method === 'GET') {
    return ok(store.users);
  }
  if (path === '/users' && method === 'POST') {
    const u = {
      id: newId('user'), orgId: ORG.id, name: body?.name ?? 'New user',
      role: (body?.role ?? 'worker') as Role,
      phone: body?.phone ?? null, email: body?.email ?? null,
      siteId: body?.siteId ?? null, active: true,
    };
    store.users.push(u);
    return ok(u);
  }

  // ---------- TASKS ----------
  if (path === '/tasks' && method === 'GET') {
    return ok(store.tasks.map(decorate));
  }
  if (path === '/tasks' && method === 'POST') {
    if (!body?.siteId || !store.sites.find((s) => s.id === body.siteId)) {
      return ok({ error: 'siteId does not belong to your organization' }, 400);
    }
    if (body.assigneeUserId && !store.users.find((u) => u.id === body.assigneeUserId)) {
      return ok({ error: 'assigneeUserId is not in your organization' }, 400);
    }
    const task: Task = {
      id: newId('task'), siteId: body.siteId, title: body.title ?? 'New task',
      trade: body.trade ?? 'Tiling', location: body.location ?? '',
      state: body.assigneeUserId ? 'ASSIGNED' : 'DRAFT',
      assigneeUserId: body.assigneeUserId ?? null, createdByUserId: 'u_manager',
      plannedStart: body.plannedStart ?? null, plannedEnd: body.plannedEnd ?? null,
      actualStart: null, actualEnd: null,
      sopProtocolId: body.sopProtocolId ?? null, qualitySampled: true, acceptedAt: null,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      reworkCount: 0, referenceImageUrl: null,
    };
    store.tasks.unshift(task);
    return ok(task);
  }
  const taskIdMatch = path.match(/^\/tasks\/([^/]+)$/);
  if (taskIdMatch && method === 'GET') {
    const t = store.tasks.find((x) => x.id === taskIdMatch[1]);
    if (!t) return notFound();
    return ok({ task: decorate(t), proofs: [], audit: [] });
  }
  const assignMatch = path.match(/^\/tasks\/([^/]+)\/assign$/);
  if (assignMatch && method === 'PATCH') {
    const t = store.tasks.find((x) => x.id === assignMatch[1]);
    if (!t) return notFound();
    t.assigneeUserId = body?.assigneeUserId ?? null;
    if (t.assigneeUserId && t.state === 'DRAFT') t.state = 'ASSIGNED';
    if (!t.assigneeUserId) t.state = 'DRAFT';
    t.updatedAt = new Date().toISOString();
    return ok(decorate(t));
  }

  // ---------- APPROVALS ----------
  if (path === '/approvals/pending' && method === 'GET') {
    // Caller's role is encoded only in the cached user blob; for demo simplicity
    // return everything currently pending across the four approval stages.
    const states: TaskState[] = ['PROOF_SUBMITTED', 'SUPERVISOR_APPROVED', 'QUALITY_APPROVED', 'MANAGER_APPROVED'];
    return ok(store.tasks.filter((t) => states.includes(t.state)).map(decorate));
  }
  if (path === '/approvals/approve' && method === 'POST') {
    const t = store.tasks.find((x) => x.id === body?.taskId);
    if (!t) return notFound();
    const next = APPROVAL_ADVANCE[t.state];
    if (!next) return ok({ error: `cannot approve from ${t.state}` }, 400);
    t.state = next;
    if (next === 'CLOSED') t.actualEnd = new Date().toISOString();
    t.updatedAt = new Date().toISOString();
    return ok(decorate(t));
  }
  if (path === '/approvals/reject' && method === 'POST') {
    const t = store.tasks.find((x) => x.id === body?.taskId);
    if (!t) return notFound();
    t.state = 'REWORK';
    t.reworkCount = (t.reworkCount ?? 0) + 1;
    t.updatedAt = new Date().toISOString();
    return ok(decorate(t));
  }

  // ---------- SOP, TIMESHEETS, FINANCE, NOTIFICATIONS, OUTBOX ----------
  if (path === '/sop' && method === 'GET') return ok(store.sops);
  if (path === '/sop' && method === 'POST') {
    const s = { ...body, id: newId('sop'), orgId: ORG.id, version: 'v1', refMediaS3Key: null };
    store.sops.push(s);
    return ok(s);
  }
  if (path === '/timesheets/today' && method === 'GET') return ok([]);
  if (path === '/finance/contracts' && method === 'GET') return ok(store.contracts);
  if (path === '/finance/rates' && method === 'GET')    return ok(store.costRates);
  if (path.startsWith('/finance/site-pnl/') && method === 'GET') {
    const siteId = path.split('/').pop()!;
    const contract = store.contracts.find((c) => c.siteId === siteId);
    return ok({
      siteId, contractValue: contract?.totalValue ?? 0,
      laborCostToDate: Math.floor((contract?.totalValue ?? 0) * 0.18),
      currency: 'INR',
    });
  }
  if (path === '/whatsapp/outbox' && method === 'GET') return ok([]);
  if (path.startsWith('/notifications')) return ok([]);

  // Unknown route — return empty array so list-views don't crash.
  return ok([]);
}

function safeJson(b: BodyInit): any {
  try { return typeof b === 'string' ? JSON.parse(b) : null; } catch { return null; }
}
