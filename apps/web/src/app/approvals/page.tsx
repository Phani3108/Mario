'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MarioMark } from '../../components/MarioLogo';
import { apiFetch, isDemo } from '../../lib/api';
import { useT, localizedRole } from '../../lib/i18n';
import { LangToggle } from '../../components/LangToggle';
import { QualityView } from './QualityView';
import { SupervisorView } from './SupervisorView';
import { ManagerView } from './ManagerView';
import { CEOView } from './CEOView';

type Task = {
  id: string;
  title: string;
  trade: string;
  location: string;
  state: string;
  actualStart: string | null;
  actualEnd: string | null;
  plannedStart: string | null;
  plannedEnd: string | null;
  updatedAt: string;
  referenceImageUrl?: string | null;
  reworkCount?: number;
};

type ProofView = { url: string };

// labelKey is an i18n dict key; render with t(labelKey).
const NAV: { key: View; labelKey: string }[] = [
  { key: 'my-tasks',   labelKey: 'navMyTasks' },
  { key: 'command',    labelKey: 'mgrTitle' },
  { key: 'approvals',  labelKey: 'navApprovals' },
  { key: 'tasks',      labelKey: 'navTasks' },
  { key: 'timesheets', labelKey: 'navTimesheets' },
  { key: 'sop',        labelKey: 'navSop' },
  { key: 'rework',     labelKey: 'navRework' },
  { key: 'reports',    labelKey: 'navReports' },
  { key: 'sites',      labelKey: 'navSitesAdmin' },
  { key: 'people',     labelKey: 'navPeople' },
  { key: 'outbox',     labelKey: 'navOutbox' },
];

type View = 'my-tasks' | 'command' | 'approvals' | 'tasks' | 'timesheets' | 'sop' | 'rework' | 'reports' | 'sites' | 'people' | 'outbox';
type Site = { id: string; label: string; active: boolean };

// Per-persona sidebar. Ordered: first entry is also the persona's default view
// when they land on the dashboard. The plan's six personas + the existing
// client role each get only the tools they actually need.
const ROLE_NAV: Record<string, View[]> = {
  employee:   ['my-tasks'],
  supervisor: ['approvals', 'tasks', 'timesheets', 'people', 'rework'],
  quality:    ['approvals', 'sop', 'rework', 'tasks'],
  manager:    ['command', 'approvals', 'tasks', 'timesheets', 'sop', 'rework', 'reports', 'sites', 'people', 'outbox'],
  accounts:   ['timesheets', 'reports', 'outbox'],
  ceo:        ['command', 'reports', 'sites', 'people', 'outbox', 'tasks', 'approvals'],
  client:     ['approvals', 'reports'],
};

function navForRole(role: string | undefined | null): typeof NAV {
  if (!role || !ROLE_NAV[role]) return NAV; // fallback: show everything
  const allowed = new Set(ROLE_NAV[role]);
  return NAV.filter((n) => allowed.has(n.key));
}

function defaultViewForRole(role: string | undefined | null): View {
  if (!role || !ROLE_NAV[role] || ROLE_NAV[role].length === 0) return 'approvals';
  return ROLE_NAV[role][0] as View;
}

function tradeClass(trade: string): string {
  const t = trade.toLowerCase();
  if (t.includes('tile') || t.includes('grout')) return 'tile-photo';
  if (t.includes('paint')) return 'paint-photo';
  if (t.includes('plaster')) return 'plaster-photo';
  if (t.includes('bath') || t.includes('plumb')) return 'bath-photo';
  if (t.includes('rcc') || t.includes('slab') || t.includes('concrete')) return 'rcc-photo';
  return 'photo-thumb';
}

function fmt(ts: string | null): string {
  if (!ts) return '';
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function ApprovalsPage() {
  const router = useRouter();
  const t = useT();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [user, setUser] = useState<{ name: string; role: string; siteId: string | null } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [proofUrls, setProofUrls] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('all');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [mobileNav, setMobileNav] = useState(false);
  const [view, setView] = useState<View>('approvals');
  const [activeSite, setActiveSite] = useState<string>('');
  const [sitesList, setSitesList] = useState<Site[]>([]);
  const [orgInfo, setOrgInfo] = useState<{ name: string; logoUrl: string | null }>({ name: 'Mario', logoUrl: null });
  const [showNewSite, setShowNewSite] = useState(false);
  const [showNewTask, setShowNewTask] = useState(false);
  // For Quality view's WORKER column — keyed by user id.
  const [allUsers, setAllUsers] = useState<{ id: string; name: string }[]>([]);

  const token = typeof window !== 'undefined' ? localStorage.getItem('sf_token') : null;

  const headers = useCallback(
    () => ({ 'content-type': 'application/json', authorization: `Bearer ${token}` }),
    [token],
  );

  const load = useCallback(async () => {
    if (!token) { router.replace('/'); return; }
    setError(null);
    try {
      const cachedUser = JSON.parse(localStorage.getItem('sf_user') ?? 'null');
      if (cachedUser) {
        setUser(cachedUser);
        // Persona-default landing view: only fire on the first load (when
        // view is still the initial 'approvals') so we don't yank the user
        // away from a tab they've actively switched to.
        const defaultView = defaultViewForRole(cachedUser.role);
        setView((cur) => (cur === 'approvals' && defaultView !== 'approvals' ? defaultView : cur));
      }

      const [pendingRes, sitesRes, orgRes, usersRes] = await Promise.all([
        apiFetch(`/approvals/pending`, { headers: headers() }),
        apiFetch(`/sites`, { headers: headers() }),
        apiFetch(`/orgs/me`, { headers: headers() }),
        apiFetch(`/users`, { headers: headers() }),
      ]);
      if (pendingRes.status === 401 || sitesRes.status === 401) {
        localStorage.removeItem('sf_token');
        router.replace('/');
        return;
      }
      const pendingTasks: Task[] = pendingRes.ok ? await pendingRes.json() : [];
      const siteRows: { id: string; name: string }[] = sitesRes.ok ? await sitesRes.json() : [];
      const sitesMapped: Site[] = siteRows.map((s) => ({ id: s.id, label: s.name, active: true }));
      setTasks(pendingTasks);
      setSitesList(sitesMapped);
      if (!activeSite && sitesMapped.length > 0 && sitesMapped[0]) setActiveSite(sitesMapped[0].id);
      if (orgRes.ok) {
        const data: { org: { name: string }; logoUrl: string | null } = await orgRes.json();
        setOrgInfo({ name: data.org?.name ?? 'Mario', logoUrl: data.logoUrl ?? null });
      }
      if (usersRes.ok) {
        const j = await usersRes.json().catch(() => []);
        setAllUsers(Array.isArray(j) ? j.map((u: any) => ({ id: u.id, name: u.name })) : []);
      }
    } catch (e: any) {
      setError(e?.message ?? 'failed to load dashboard');
    }
  }, [token, headers, router, activeSite]);

  useEffect(() => { load(); }, [load]);

  // Deep-link from the landing page: /approvals?new=site opens the NewSiteModal
  // straight away and switches to the Sites tab so the list refresh is visible.
  // (Read window.location.search directly — useSearchParams() requires a
  // <Suspense> boundary under static export, which we don't have.)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const sp = new URLSearchParams(window.location.search);
    if (sp.get('new') === 'site') {
      setShowNewSite(true);
      setView('sites');
      sp.delete('new');
      const url = new URL(window.location.href);
      url.search = sp.toString();
      window.history.replaceState({}, '', url.toString());
    }
  }, []);

  async function act(taskId: string, kind: 'approve' | 'reject') {
    setBusyId(taskId);
    setError(null);
    try {
      const body = kind === 'approve'
        ? { taskId }
        : { taskId, reason: prompt('Reject reason?') ?? 'no reason given' };
      const res = await apiFetch(`/approvals/${kind}`, {
        method: 'POST', headers: headers(), body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? 'failed');
      setSelected((s) => { const n = new Set(s); n.delete(taskId); return n; });
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusyId(null);
    }
  }

  function logout() {
    localStorage.removeItem('sf_token');
    localStorage.removeItem('sf_user');
    router.replace('/');
  }

  const trades = useMemo(() => {
    const counts: Record<string, number> = {};
    tasks.forEach((t) => { counts[t.trade] = (counts[t.trade] ?? 0) + 1; });
    return Object.entries(counts);
  }, [tasks]);

  const visible = useMemo(
    () => filter === 'all' ? tasks : tasks.filter((t) => t.trade === filter),
    [tasks, filter],
  );

  function toggle(id: string) {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }

  async function bulkApprove() {
    const ids = Array.from(selected);
    for (const id of ids) {
      await act(id, 'approve'); // sequential keeps audit order
    }
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-slate-900 flex flex-col">
      {/* ---------- Top bar (dark, mock-parity) ---------- */}
      <header className="bg-slate-950 text-slate-100 border-b border-slate-800 sticky top-0 z-30">
        <div className="px-4 sm:px-6 py-3 flex items-center gap-3">
          <button
            onClick={() => setMobileNav((v) => !v)}
            className="md:hidden w-9 h-9 grid place-items-center rounded-lg bg-slate-800 border border-slate-700"
            aria-label="menu"
          >
            <span className="block w-4 h-px bg-slate-200 relative before:content-[''] before:block before:absolute before:-top-1.5 before:left-0 before:w-4 before:h-px before:bg-slate-200 after:content-[''] after:block after:absolute after:top-1.5 after:left-0 after:w-4 after:h-px after:bg-slate-200" />
          </button>
          <a href="/" className="flex items-center gap-2 group" aria-label="Mario home">
            {orgInfo.logoUrl ? (
              <img src={orgInfo.logoUrl} alt={orgInfo.name} className="w-9 h-9 rounded-md object-contain bg-white p-0.5 group-hover:scale-105 transition" />
            ) : (
              <MarioMark size={36} className="group-hover:scale-105 transition" />
            )}
            <div className="leading-tight">
              <div className="font-extrabold tracking-tight">{orgInfo.name}</div>
              <div className="text-[10px] text-slate-400 hidden sm:block">
                {sitesList.find((s) => s.id === activeSite)?.label ?? '—'} / {(() => { const e = NAV.find((n) => n.key === view); return e ? t(e.labelKey as any) : ''; })()}
              </div>
            </div>
          </a>
          <div className="ml-auto flex items-center gap-2 text-xs">
            <span className="hidden sm:inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-amber-500/15 text-amber-300 border border-amber-500/30 font-semibold">
              ⚠ {tasks.length} {t('pendingShort')}
            </span>
            {isDemo() && (
              <span title="No backend connected — UI is mocked end-to-end." className="hidden md:inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-semibold text-[10px] tracking-wider">
                {t('demoMode')}
              </span>
            )}
            <span className="text-slate-300 hidden sm:inline">
              {user ? `${user.name} · ${localizedRole(user.role)}` : ''}
            </span>
            <LangToggle tone="dark" className="hidden md:inline-flex" />
            {user?.role !== 'client' && (
              <button onClick={() => setShowNewTask(true)} className="hidden sm:inline-flex px-2 py-1 rounded-md bg-amber-500 text-slate-900 font-bold text-[11px] hover:bg-amber-400">
                {t('newTask')}
              </button>
            )}
            {['manager','ceo','accounts'].includes(user?.role ?? '') && (
              <button onClick={() => setShowNewSite(true)} className="hidden sm:inline-flex px-2 py-1 rounded-md bg-slate-700 text-amber-300 font-bold text-[11px] hover:bg-slate-600 border border-slate-600">
                {t('navNewProject')}
              </button>
            )}
            <a href="/settings" className="text-slate-300 hover:text-amber-300 underline text-xs">
              {t('settings')}
            </a>
            <button onClick={logout} className="text-amber-400 hover:text-amber-300 underline text-xs">
              {t('signOut')}
            </button>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* ---------- Sidebar (desktop) ---------- */}
        <aside className="hidden md:flex w-56 border-r border-slate-200 bg-white flex-col p-4 text-sm">
          <div className="text-[10px] uppercase tracking-widest text-slate-400 font-bold mb-2">{t('navWorkflow')}</div>
          {navForRole(user?.role).map((n) => {
            const active = n.key === view;
            return (
              <button
                key={n.key}
                onClick={() => setView(n.key)}
                className={`text-left px-3 py-2 rounded-lg mb-1 font-semibold transition ${
                  active
                    ? 'bg-amber-50 text-amber-700 border border-amber-200'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                {t(n.labelKey as any)}{n.key === 'approvals' && ` · ${tasks.length}`}
              </button>
            );
          })}
          <div className="text-[10px] uppercase tracking-widest text-slate-400 font-bold mt-6 mb-2">{t('navSites')}</div>
          {sitesList.length === 0 && (
            <div className="text-xs text-slate-400 px-3 py-2">No sites yet. Add one in <button onClick={() => setView('sites')} className="underline text-amber-600">Sites</button>.</div>
          )}
          {sitesList.map((s) => (
            <button
              key={s.id}
              onClick={() => setActiveSite(s.id)}
              className={`text-left px-3 py-2 rounded-lg font-medium hover:bg-slate-50 transition ${
                activeSite === s.id ? 'text-slate-900 bg-slate-50' : 'text-slate-500'
              }`}
            >
              {s.label}
            </button>
          ))}

          {/* Themed sidebar art — dynamic to active project */}
          <div className="mt-auto pt-6">
            <div className="aspect-video rounded-lg project-card relative overflow-hidden border border-slate-800">
              <div className="absolute bottom-2 left-2 right-2 text-[10px] text-white/90 font-semibold tracking-wide drop-shadow">
                {sitesList.find((s) => s.id === activeSite)?.label ?? 'No project selected'}<br />
                <span className="text-amber-300">{sitesList.length} projects · Hyderabad</span>
              </div>
            </div>
          </div>
        </aside>

        {/* ---------- Mobile nav drawer ---------- */}
        {mobileNav && (
          <div className="md:hidden fixed inset-0 z-40 bg-black/40" onClick={() => setMobileNav(false)}>
            <aside
              className="absolute left-0 top-0 bottom-0 w-64 bg-white p-4 shadow-xl sf-fade-up"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-[10px] uppercase tracking-widest text-slate-400 font-bold mb-2">{t('navWorkflow')}</div>
              {navForRole(user?.role).map((n) => (
                <button
                  key={n.key}
                  onClick={() => { setView(n.key); setMobileNav(false); }}
                  className={`block w-full text-left px-3 py-2 rounded-lg mb-1 font-semibold ${
                    n.key === view ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'text-slate-600'
                  }`}
                >
                  {t(n.labelKey as any)}{n.key === 'approvals' && ` · ${tasks.length}`}
                </button>
              ))}
              <div className="text-[10px] uppercase tracking-widest text-slate-400 font-bold mt-4 mb-2">{t('navSites')}</div>
              {sitesList.map((s) => (
                <button
                  key={s.id}
                  onClick={() => { setActiveSite(s.id); setMobileNav(false); }}
                  className={`block w-full text-left px-3 py-2 rounded-lg font-medium ${
                    activeSite === s.id ? 'text-slate-900 bg-slate-50' : 'text-slate-500'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </aside>
          </div>
        )}

        {/* ---------- Main ---------- */}
        <main className="flex-1 overflow-auto">
          {view === 'my-tasks' ? (
            <MyTasksView headers={headers} user={user} onOpenNewTask={() => setShowNewTask(true)} />
          ) : view === 'command' ? (
            user?.role === 'ceo' ? (
              <CEOView
                headers={headers}
                sites={sitesList}
                userMap={Object.fromEntries(allUsers.map((u) => [u.id, u.name]))}
                onOpenNewTask={() => setShowNewTask(true)}
                onOpenNewSite={() => setShowNewSite(true)}
                onViewApprovalQueue={() => setView('approvals')}
              />
            ) : (
              <ManagerView
                headers={headers}
                initialTasks={tasks as any}
                sites={sitesList}
                userMap={Object.fromEntries(allUsers.map((u) => [u.id, u.name]))}
                onOpenNewTask={() => setShowNewTask(true)}
                onOpenNewSite={() => setShowNewSite(true)}
                onViewApprovalQueue={() => setView('approvals')}
              />
            )
          ) : view === 'tasks' ? (
            <TasksBoard headers={headers} canAssign={user?.role === 'manager' || user?.role === 'supervisor'} />
          ) : view === 'timesheets' ? (
            <TimesheetsToday headers={headers} />
          ) : view === 'sop' ? (
            <SopLibrary headers={headers} canCreate={user?.role === 'manager' || user?.role === 'quality'} />
          ) : view === 'rework' ? (
            <ReworkLog headers={headers} />
          ) : view === 'reports' ? (
            <FinanceReports headers={headers} canEdit={user?.role === 'ceo' || user?.role === 'accounts'} />
          ) : view === 'sites' ? (
            <SitesAdmin headers={headers} canCreate={['manager','ceo','accounts'].includes(user?.role ?? '')} />
          ) : view === 'people' ? (
            <PeopleAdmin headers={headers} canCreate={['manager','ceo','accounts'].includes(user?.role ?? '')} />
          ) : view === 'outbox' ? (
            <WhatsAppOutbox headers={headers} />
          ) : view !== 'approvals' ? (
            <PlaceholderView view={view} onBack={() => setView('approvals')} />
          ) : sitesList.length === 0 ? (
            <EmptySite onBack={() => setShowNewSite(true)} />
          ) : user?.role === 'quality' ? (
            <QualityView
              headers={headers}
              initialTasks={tasks as any}
              userMap={Object.fromEntries(allUsers.map((u) => [u.id, u.name]))}
              onChanged={load}
              onOpenNewTask={() => setShowNewTask(true)}
            />
          ) : user?.role === 'supervisor' ? (
            <SupervisorView
              headers={headers}
              initialTasks={tasks as any}
              userMap={Object.fromEntries(allUsers.map((u) => [u.id, u.name]))}
              onChanged={load}
              onOpenNewTask={() => setShowNewTask(true)}
            />
          ) : (
          <>
          {/* Filter bar */}
          <div className="px-4 sm:px-6 py-3 border-b border-slate-200 bg-white flex items-center gap-2 overflow-x-auto no-scrollbar">
            <div className="text-base font-semibold mr-2 whitespace-nowrap">{t('approvalQueue')}</div>
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap transition ${
                filter === 'all'
                  ? 'bg-slate-900 text-white'
                  : 'border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              All · {tasks.length}
            </button>
            {trades.map(([t, c]) => (
              <button
                key={t}
                onClick={() => setFilter(t)}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap transition ${
                  filter === t
                    ? 'bg-slate-900 text-white'
                    : 'border border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {t} ({c})
              </button>
            ))}
            {(user?.role === 'manager' || user?.role === 'supervisor') && (
              <button
                onClick={() => setView('tasks')}
                className="ml-auto px-3 py-1.5 rounded-md bg-amber-500 text-slate-900 font-bold text-xs hover:bg-amber-400"
              >
                {t('newTask')}
              </button>
            )}
            <span className={`text-[10px] text-slate-400 whitespace-nowrap hidden sm:inline ${(user?.role === 'manager' || user?.role === 'supervisor') ? '' : 'ml-auto'}`}>
              ⇧A approve · ⇧R reject
            </span>
          </div>

          {error && (
            <div className="mx-4 sm:mx-6 mt-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
              {error}
            </div>
          )}

          {visible.length === 0 && (
            <div className="p-10 text-center">
              <div className="mx-auto w-24 h-24 rounded-2xl bg-gradient-to-br from-emerald-100 to-emerald-50 grid place-items-center text-4xl mb-4">
                ✓
              </div>
              <div className="text-slate-600 font-semibold">{t('nothingWaiting')}</div>
              <div className="text-xs text-slate-400 mt-1">{t('goodJob')}</div>
            </div>
          )}

          {/* ---------- Mobile: card list ---------- */}
          <div className="md:hidden p-4 space-y-3">
            {visible.map((t, i) => (
              <article
                key={t.id}
                className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm sf-fade-up"
                style={{ animationDelay: `${i * 0.04}s` }}
              >
                <div className={`aspect-video relative ${tradeClass(t.trade)}`}>
                  {proofUrls[t.id] && (
                    <img src={proofUrls[t.id]} alt="proof" className="absolute inset-0 w-full h-full object-cover" />
                  )}
                  {t.referenceImageUrl && (
                    <div className="absolute bottom-2 right-2 w-20 h-14 rounded border-2 border-amber-400 overflow-hidden bg-black/40 shadow-lg">
                      <img src={t.referenceImageUrl} alt="reference" className="w-full h-full object-cover" />
                      <div className="absolute bottom-0 inset-x-0 text-[8px] font-bold bg-amber-400 text-slate-900 text-center tracking-wider">REF</div>
                    </div>
                  )}
                  <span className="absolute top-2 left-2 text-[10px] font-bold bg-black/60 text-amber-300 px-2 py-0.5 rounded">
                    {t.trade.toUpperCase()}
                  </span>
                  <span className="absolute top-2 right-2 text-[10px] font-mono bg-black/60 text-white px-2 py-0.5 rounded">
                    {t.state}
                  </span>
                  {(t.reworkCount ?? 0) >= 2 && (
                    <span className="absolute top-9 right-2 text-[10px] font-bold bg-red-600 text-white px-2 py-0.5 rounded">
                      ⚠ rework ×{t.reworkCount}
                    </span>
                  )}
                </div>
                <div className="p-3">
                  <div className="font-semibold">{t.title}</div>
                  <div className="text-xs text-slate-500">{t.location}</div>
                  <div className="text-[11px] font-mono text-slate-400 mt-1">
                    {fmt(t.actualStart) || fmt(t.plannedStart)} → {fmt(t.actualEnd) || fmt(t.plannedEnd)}
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button
                      disabled={busyId === t.id}
                      onClick={() => act(t.id, 'approve')}
                      className="py-2.5 rounded-lg bg-emerald-600 text-white font-bold text-sm disabled:opacity-50 active:bg-emerald-700"
                    >
                      ✓ Approve
                    </button>
                    <button
                      disabled={busyId === t.id}
                      onClick={() => act(t.id, 'reject')}
                      className="py-2.5 rounded-lg bg-white border border-red-300 text-red-600 font-bold text-sm disabled:opacity-50"
                    >
                      ✗ Reject
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>

          {/* ---------- Desktop: table ---------- */}
          <div className="hidden md:block p-6">
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-500 text-[10px] uppercase tracking-wider">
                  <tr>
                    <th className="p-3 w-10">
                      <input
                        type="checkbox"
                        checked={visible.length > 0 && selected.size === visible.length}
                        onChange={(e) => setSelected(e.target.checked ? new Set(visible.map((v) => v.id)) : new Set())}
                      />
                    </th>
                    <th className="text-left p-3">Task</th>
                    <th className="text-left p-3">Trade</th>
                    <th className="text-left p-3">Location</th>
                    <th className="text-left p-3">Photo</th>
                    <th className="text-left p-3">State</th>
                    <th className="text-left p-3">Start → End</th>
                    <th className="text-right p-3 pr-5">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((t, i) => (
                    <tr
                      key={t.id}
                      className={`border-t border-slate-100 transition hover:bg-amber-50/40 sf-fade-up ${
                        selected.has(t.id) ? 'bg-amber-50/60' : ''
                      }`}
                      style={{ animationDelay: `${i * 0.03}s` }}
                    >
                      <td className="p-3">
                        <input
                          type="checkbox"
                          checked={selected.has(t.id)}
                          onChange={() => toggle(t.id)}
                        />
                      </td>
                      <td className="p-3 font-semibold">
                        {t.title}
                        {(t.reworkCount ?? 0) >= 2 && (
                          <span className="ml-2 inline-block px-1.5 py-0.5 rounded bg-red-600 text-white text-[9px] font-bold align-middle">
                            ⚠ rework ×{t.reworkCount}
                          </span>
                        )}
                      </td>
                      <td className="p-3">{t.trade}</td>
                      <td className="p-3 text-slate-600">{t.location}</td>
                      <td className="p-3">
                        <div className="flex items-center gap-1">
                          <div className={`w-16 h-10 rounded relative overflow-hidden ${tradeClass(t.trade)}`} title="captured proof">
                            {proofUrls[t.id] && (
                              <img src={proofUrls[t.id]} alt="proof" className="absolute inset-0 w-full h-full object-cover" />
                            )}
                          </div>
                          {t.referenceImageUrl && (
                            <div className="w-12 h-10 rounded relative overflow-hidden border border-amber-400" title="SOP reference">
                              <img src={t.referenceImageUrl} alt="reference" className="absolute inset-0 w-full h-full object-cover" />
                              <span className="absolute bottom-0 inset-x-0 text-[7px] font-bold bg-amber-400 text-slate-900 text-center leading-tight">REF</span>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="p-3 font-mono text-[11px]">
                        <span className="inline-block px-2 py-0.5 rounded bg-slate-100 text-slate-700">{t.state}</span>
                      </td>
                      <td className="p-3 font-mono text-[11px] text-slate-500">
                        {fmt(t.actualStart) || fmt(t.plannedStart)} → {fmt(t.actualEnd) || fmt(t.plannedEnd)}
                      </td>
                      <td className="p-3 pr-5 text-right whitespace-nowrap">
                        <button
                          disabled={busyId === t.id}
                          onClick={() => act(t.id, 'approve')}
                          className="px-3 py-1.5 rounded-md bg-emerald-600 text-white font-bold text-xs disabled:opacity-50 hover:bg-emerald-700"
                        >
                          ✓
                        </button>
                        <button
                          disabled={busyId === t.id}
                          onClick={() => act(t.id, 'reject')}
                          className="ml-2 px-3 py-1.5 rounded-md bg-white text-red-600 border border-red-300 font-bold text-xs disabled:opacity-50 hover:bg-red-50"
                        >
                          ✗
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Bulk action footer (desktop) */}
          {selected.size > 0 && (
            <div className="hidden md:flex sticky bottom-0 z-20 bg-slate-50/95 backdrop-blur border-t border-slate-200 px-6 py-3 items-center gap-3 sf-fade-up">
              <div className="text-xs text-slate-700">
                <b className="text-amber-700">{selected.size} selected</b> of {visible.length}
              </div>
              <button
                onClick={bulkApprove}
                className="px-3 py-1.5 rounded-md bg-emerald-600 text-white font-semibold text-xs hover:bg-emerald-700"
              >
                Approve all
              </button>
              <button
                onClick={() => setSelected(new Set())}
                className="px-3 py-1.5 rounded-md bg-white border border-slate-200 text-slate-600 font-semibold text-xs"
              >
                Clear
              </button>
            </div>
          )}
          </>
          )}
        </main>
      </div>

      {/* Page-level "+ New project" modal — summoned by the top-bar button,
          by the landing CTA via /approvals?new=site, and by the empty-state
          "Add a project" button. Reuses the existing NewSiteModal. */}
      {showNewSite && (
        <NewSiteModal
          headers={headers}
          onClose={() => setShowNewSite(false)}
          onSaved={() => { setShowNewSite(false); setView('sites'); load(); }}
        />
      )}

      {/* Page-level "+ New task" modal — every role except Client can summon
          it from the top bar OR from inside their role-specific view. */}
      {showNewTask && (
        <NewTaskModal
          headers={headers}
          users={allUsers as any[]}
          siteId={activeSite || (sitesList[0]?.id ?? '')}
          onClose={() => setShowNewTask(false)}
          onCreated={() => {
            setShowNewTask(false);
            // Re-load the dashboard so the new task shows up in every view
            // that's listening (Approvals queue counter, MyTasks, etc.).
            load();
          }}
        />
      )}
    </div>
  );
}

// The Employee persona — their entire day is "what's on my plate, right now?"
// Lists every task assigned to me, grouped by state, with a deep-link to the
// field PWA where the actual photo-proof flow runs.
function MyTasksView({
  headers, user, onOpenNewTask,
}: {
  headers: () => HeadersInit;
  user: { name: string; role: string; siteId: string | null } | null;
  onOpenNewTask?: () => void;
}) {
  const [rows, setRows] = useState<Task[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await apiFetch(`/tasks`, { headers: headers() });
        const data = await r.json().catch(() => null);
        if (!r.ok) throw new Error((data && (data as any).error) ?? 'failed');
        // The dev/demo `/tasks` returns everything; filter client-side to "mine".
        const all: Task[] = Array.isArray(data) ? data : [];
        const meId = (() => { try { return JSON.parse(localStorage.getItem('sf_user') ?? 'null')?.id ?? null; } catch { return null; } })();
        const mine = all.filter((t: any) => !meId || t.assigneeUserId === meId);
        setRows(mine);
      } catch (e: any) {
        setErr(e?.message ?? 'failed to load tasks');
      }
    })();
  }, [headers]);

  // Visual groups roughly follow the field-PWA worker flow: act now, wait, history.
  const ACT_STATES   = new Set(['ASSIGNED', 'ACCEPTED', 'IN_PROGRESS', 'REWORK']);
  const WAIT_STATES  = new Set(['PROOF_SUBMITTED', 'SUPERVISOR_APPROVED', 'QUALITY_APPROVED', 'MANAGER_APPROVED']);
  const DONE_STATES  = new Set(['CLOSED', 'CLIENT_ACKNOWLEDGED']);

  const groups = useMemo(() => ({
    act:  rows.filter((t) => ACT_STATES.has(t.state)),
    wait: rows.filter((t) => WAIT_STATES.has(t.state)),
    done: rows.filter((t) => DONE_STATES.has(t.state)),
  }), [rows]);

  return (
    <div className="p-4 sm:p-6 sf-fade-up">
      <div className="flex items-center gap-3 mb-1 flex-wrap">
        <div className="text-xl font-extrabold">My tasks</div>
        <span className="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-semibold">{rows.length}</span>
        <div className="ml-auto flex items-center gap-2">
          {onOpenNewTask && (
            <button
              onClick={onOpenNewTask}
              className="px-3 py-1.5 rounded-md bg-amber-500 text-slate-900 font-bold text-xs hover:bg-amber-400"
            >+ New task</button>
          )}
          <a href="http://localhost:5174" target="_blank" rel="noopener noreferrer"
             className="px-3 py-1.5 rounded-md border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-50">
            Open field app →
          </a>
        </div>
      </div>
      <div className="text-xs text-slate-500 mb-4">
        {user?.name ?? 'Employee'} · field role. Submit photo-proof from the Mario field PWA, then it flows here for approval.
      </div>
      {err && <div className="mb-3 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{err}</div>}
      {rows.length === 0 && (
        <div className="p-10 text-center bg-white border border-slate-200 rounded-2xl shadow-sm">
          <div className="mx-auto w-20 h-20 rounded-2xl bg-gradient-to-br from-emerald-100 to-emerald-50 grid place-items-center text-3xl mb-3">✓</div>
          <div className="text-slate-700 font-semibold">No tasks on your plate.</div>
          <div className="text-xs text-slate-500 mt-1">Your supervisor will assign work soon.</div>
        </div>
      )}

      {(['act', 'wait', 'done'] as const).map((g) => groups[g].length === 0 ? null : (
        <section key={g} className="mb-5">
          <div className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-2">
            {g === 'act' ? 'Action needed' : g === 'wait' ? 'Awaiting approval' : 'Done'}
            <span className="ml-2 text-slate-400">· {groups[g].length}</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {groups[g].map((t) => (
              <div key={t.id} className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm">
                <div className="flex items-start gap-2">
                  <div className={`w-12 h-12 rounded-lg shrink-0 ${tradeClass(t.trade)}`} />
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm leading-tight truncate">{t.title}</div>
                    <div className="text-[11px] text-slate-500 truncate">{t.trade} · {t.location}</div>
                    <div className="mt-1 inline-block px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-mono">{t.state}</div>
                  </div>
                </div>
                <div className="mt-2 text-[10px] font-mono text-slate-400">
                  {fmt(t.actualStart) || fmt(t.plannedStart)} → {fmt(t.actualEnd) || fmt(t.plannedEnd)}
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function PlaceholderView({ view, onBack }: { view: View; onBack: () => void }) {
  const meta: Partial<Record<View, { title: string; sub: string; icon: string; art: string }>> = {
    sop:     { title: 'SOP library',  sub: 'Inspection procedures by trade. Milestone 2.', icon: '✦', art: 'tile-photo' },
    rework:  { title: 'Rework log',   sub: 'Every rejected proof with reason and re-submission. Milestone 2.', icon: '↺', art: 'plaster-photo' },
    reports: { title: 'Reports',      sub: 'Daily rollup, payroll, snag-list exports. Milestone 3.', icon: '◧', art: 'rcc-photo' },
  };
  const m = meta[view] ?? { title: view, sub: '', icon: '·', art: 'site-photo' };
  return (
    <div className="p-6 sm:p-10 sf-fade-up">
      <div className={`relative w-full max-w-3xl mx-auto aspect-[2/1] rounded-2xl overflow-hidden ${m.art}`}>
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-slate-900/30 to-transparent" />
        <div className="absolute bottom-5 left-5 right-5 text-white">
          <div className="text-5xl mb-2 opacity-80">{m.icon}</div>
          <div className="text-2xl sm:text-3xl font-extrabold">{m.title}</div>
          <div className="text-sm text-slate-200 mt-1 max-w-md">{m.sub}</div>
          <button
            onClick={onBack}
            className="mt-4 px-4 py-2 rounded-lg bg-amber-500 text-slate-900 font-bold text-sm hover:bg-amber-400 transition"
          >
            ← Back to approvals
          </button>
        </div>
      </div>
    </div>
  );
}

function EmptySite({ onBack }: { onBack: () => void }) {
  const t = useT();
  return (
    <div className="p-10 text-center sf-fade-up">
      <div className="mx-auto w-24 h-24 rounded-2xl site-photo grid place-items-center text-4xl mb-4 text-white drop-shadow">◷</div>
      <div className="text-slate-700 font-semibold">{t('noProjectsYet')}</div>
      <div className="text-xs text-slate-500 mt-1 mb-4">{t('addFirstProject')}</div>
      <button
        onClick={onBack}
        className="px-4 py-2 rounded-lg bg-amber-500 text-slate-900 font-bold text-sm hover:bg-amber-400 transition"
      >
        {t('ctaAddProject')}
      </button>
    </div>
  );
}

type AnyTask = Task & { assigneeUserId: string | null; siteId: string };
type UserLite = { id: string; name: string; role: string };
type PunchRow = {
  id: string; userId: string; userName: string;
  kind: 'ENTRY' | 'LUNCH_OUT' | 'LUNCH_IN' | 'EXIT';
  insideGeofence: boolean; punchedAt: string; selfieS3Key: string | null;
};

function TasksBoard({
  headers, canAssign,
}: { headers: () => HeadersInit; canAssign: boolean }) {
  const [rows, setRows] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [siteId, setSiteId] = useState<string>('');

  const load = useCallback(async () => {
    setErr(null);
    try {
      const [tasksRes, usersRes, sitesRes] = await Promise.all([
        apiFetch(`/tasks`, { headers: headers() }),
        apiFetch(`/users`, { headers: headers() }),
        apiFetch(`/sites`, { headers: headers() }),
      ]);
      if (tasksRes.ok) { const j = await tasksRes.json(); setRows(Array.isArray(j) ? j : []); }
      if (usersRes.ok) { const j = await usersRes.json(); setUsers(Array.isArray(j) ? j : []); }
      if (sitesRes.ok) {
        const j = await sitesRes.json();
        const sites: { id: string }[] = Array.isArray(j) ? j : [];
        if (sites[0]) setSiteId(sites[0].id);
      }
    } catch (e: any) {
      setErr(e?.message ?? 'failed to load tasks');
    }
  }, [headers]);

  useEffect(() => { load(); }, [load]);

  async function assign(taskId: string, assigneeUserId: string | null) {
    setBusy(taskId);
    setErr(null);
    const prev = rows;
    setRows((cur) => cur.map((t) => t.id === taskId ? { ...t, assigneeUserId } : t));
    try {
      const res = await apiFetch(`/tasks/${taskId}/assign`, {
        method: 'PATCH', headers: headers(),
        body: JSON.stringify({ assigneeUserId }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'assign failed');
      const updated = await res.json();
      setRows((cur) => cur.map((t) => t.id === taskId ? { ...t, ...updated } : t));
    } catch (e: any) {
      setErr(e?.message ?? 'assign failed');
      setRows(prev);
    } finally {
      setBusy(null);
    }
  }

  const byAssignee = useMemo(() => {
    const m = new Map<string, AnyTask[]>();
    m.set('__unassigned__', []);
    users.forEach((u) => m.set(u.id, []));
    rows.forEach((t) => {
      const k = t.assigneeUserId ?? '__unassigned__';
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(t);
    });
    return m;
  }, [rows, users]);

  return (
    <div className="p-4 sm:p-6 sf-fade-up">
      <div className="flex items-center gap-3 mb-4">
        <div className="text-xl font-extrabold">Tasks &amp; allocation</div>
        <span className="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-semibold">{rows.length}</span>
        {canAssign && (
          <button
            onClick={() => setShowNew(true)}
            className="ml-auto px-3 py-1.5 rounded-md bg-amber-500 text-slate-900 font-bold text-xs hover:bg-amber-400"
          >+ New task</button>
        )}
      </div>
      {err && <div className="mb-3 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{err}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {Array.from(byAssignee.entries()).map(([uid, list]) => {
          const u = users.find((x) => x.id === uid);
          const title = uid === '__unassigned__' ? 'Unassigned' : (u?.name ?? 'Unknown');
          return (
            <div key={uid} className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 rounded-full bg-slate-100 grid place-items-center text-xs font-bold text-slate-700">
                  {title[0]}
                </div>
                <div className="font-semibold text-sm">{title}</div>
                <span className="ml-auto text-[10px] font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded">{list.length}</span>
              </div>
              {list.length === 0 && <div className="text-xs text-slate-400 py-3 text-center">no tasks</div>}
              <div className="space-y-2">
                {list.map((t) => (
                  <div key={t.id} className="rounded-lg border border-slate-200 p-2 bg-slate-50/60">
                    <div className="text-sm font-semibold">{t.title}</div>
                    <div className="text-[11px] text-slate-500">{t.trade} · {t.location}</div>
                    <div className="text-[10px] font-mono text-slate-400 mt-1">{t.state}</div>
                    {canAssign && (
                      <select
                        disabled={busy === t.id}
                        value={t.assigneeUserId ?? ''}
                        onChange={(e) => assign(t.id, e.target.value || null)}
                        className="mt-2 w-full text-xs rounded-md border border-slate-200 bg-white px-2 py-1"
                      >
                        <option value="">— unassigned —</option>
                        {users.map((u) => (
                          <option key={u.id} value={u.id}>{u.name}</option>
                        ))}
                      </select>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {showNew && (
        <NewTaskModal
          headers={headers}
          users={users}
          siteId={rows[0]?.siteId ?? siteId}
          onClose={() => setShowNew(false)}
          onCreated={(newTask) => {
            setShowNew(false);
            setRows((prev) => [newTask, ...prev]);
          }}
        />
      )}
    </div>
  );
}

function NewTaskModal({
  headers, users, siteId, onClose, onCreated,
}: {
  headers: () => HeadersInit;
  users: any[];
  siteId: string;
  onClose: () => void;
  onCreated: (newTask: any) => void;
}) {
  const [title, setTitle] = useState('');
  const [trade, setTrade] = useState('Tiling');
  const [location, setLocation] = useState('');
  const [assigneeUserId, setAssignee] = useState('');
  const [sopProtocolId, setSopId] = useState('');
  const [plannedStart, setPlannedStart] = useState('');
  const [plannedEnd, setPlannedEnd] = useState('');
  const [sites, setSites] = useState<{ id: string; name: string }[]>([]);
  const [sops, setSops] = useState<{ id: string; trade: string; title: string }[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resolvedSiteId, setResolvedSiteId] = useState(siteId);

  // Default planned start to "now rounded to next hour" and end +4h.
  useEffect(() => {
    const now = new Date();
    now.setMinutes(0, 0, 0); now.setHours(now.getHours() + 1);
    const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}T${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
    setPlannedStart(iso(now));
    const end = new Date(now.getTime() + 4 * 3600_000);
    setPlannedEnd(iso(end));
  }, []);

  useEffect(() => {
    (async () => {
      const [s, p] = await Promise.all([
        apiFetch(`/sites`, { headers: headers() }),
        apiFetch(`/sop`,   { headers: headers() }),
      ]);
      if (s.ok) {
        const raw = await s.json();
        const ss = Array.isArray(raw) ? raw : [];
        setSites(ss);
        if (!resolvedSiteId && ss[0]) setResolvedSiteId(ss[0].id);
      }
      if (p.ok) { const raw = await p.json(); setSops(Array.isArray(raw) ? raw : []); }
    })();
  }, [headers, resolvedSiteId]);

  // Auto-pick SOP whose trade matches the selected trade.
  useEffect(() => {
    if (sopProtocolId) return;
    const match = sops.find((s) => s.trade.toLowerCase() === trade.toLowerCase());
    if (match) setSopId(match.id);
  }, [trade, sops, sopProtocolId]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!resolvedSiteId) { setErr('pick a project'); return; }
    setBusy(true); setErr(null);
    try {
      const res = await apiFetch(`/tasks`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({
          siteId: resolvedSiteId,
          title,
          trade,
          location,
          assigneeUserId: assigneeUserId || null,
          plannedStart: plannedStart ? new Date(plannedStart).toISOString() : null,
          plannedEnd:   plannedEnd   ? new Date(plannedEnd).toISOString()   : null,
          sopProtocolId: sopProtocolId || null,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `failed (${res.status})`);
      }
      const created = await res.json();
      onCreated(created);
    } catch (e: any) {
      setErr(e?.message ?? 'create failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 bg-black/40 grid place-items-center p-4" onClick={onClose}>
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl w-full max-w-md p-5 shadow-2xl sf-fade-up max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-md bg-amber-500 grid place-items-center text-slate-900 font-black">+</div>
          <div className="font-extrabold text-lg">New task</div>
          <button type="button" onClick={onClose} className="ml-auto text-slate-400 text-sm">✕</button>
        </div>

        <label className="text-[11px] uppercase tracking-wider text-slate-500 font-bold">Project</label>
        <select
          value={resolvedSiteId} onChange={(e) => setResolvedSiteId(e.target.value)}
          className="w-full mt-1 mb-3 px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white"
        >
          <option value="">— pick a project —</option>
          {sites.map((s) => (<option key={s.id} value={s.id}>{s.name}</option>))}
        </select>

        <label className="text-[11px] uppercase tracking-wider text-slate-500 font-bold">Title</label>
        <input
          required minLength={2}
          value={title} onChange={(e) => setTitle(e.target.value)}
          className="w-full mt-1 mb-3 px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/40"
          placeholder="Vitrified tiling · Living"
        />

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[11px] uppercase tracking-wider text-slate-500 font-bold">Trade</label>
            <select
              value={trade} onChange={(e) => setTrade(e.target.value)}
              className="w-full mt-1 mb-3 px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white"
            >
              {['Tiling', 'Painting', 'Plastering', 'Marble', 'RCC', 'Electrical', 'Plumbing'].map((x) => (
                <option key={x} value={x}>{x}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[11px] uppercase tracking-wider text-slate-500 font-bold">Location</label>
            <input
              required value={location} onChange={(e) => setLocation(e.target.value)}
              className="w-full mt-1 mb-3 px-3 py-2 rounded-lg border border-slate-200 text-sm"
              placeholder="T4-F12-Bath 2"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[11px] uppercase tracking-wider text-slate-500 font-bold">Planned start</label>
            <input type="datetime-local" value={plannedStart} onChange={(e) => setPlannedStart(e.target.value)}
              className="w-full mt-1 mb-3 px-3 py-2 rounded-lg border border-slate-200 text-sm" />
          </div>
          <div>
            <label className="text-[11px] uppercase tracking-wider text-slate-500 font-bold">Planned end</label>
            <input type="datetime-local" value={plannedEnd} onChange={(e) => setPlannedEnd(e.target.value)}
              className="w-full mt-1 mb-3 px-3 py-2 rounded-lg border border-slate-200 text-sm" />
          </div>
        </div>

        <label className="text-[11px] uppercase tracking-wider text-slate-500 font-bold">SOP protocol</label>
        <select
          value={sopProtocolId} onChange={(e) => setSopId(e.target.value)}
          className="w-full mt-1 mb-3 px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white"
        >
          <option value="">— no SOP —</option>
          {sops.map((s) => (<option key={s.id} value={s.id}>{s.trade} · {s.title}</option>))}
        </select>

        <label className="text-[11px] uppercase tracking-wider text-slate-500 font-bold">Assignee (optional)</label>
        <select
          value={assigneeUserId} onChange={(e) => setAssignee(e.target.value)}
          className="w-full mt-1 mb-4 px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white"
        >
          <option value="">— leave unassigned —</option>
          {users.map((u) => (<option key={u.id} value={u.id}>{u.name}{u.role ? ` · ${u.role}` : ''}</option>))}
        </select>

        {err && <div className="mb-3 p-2 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">{err}</div>}

        <div className="flex gap-2">
          <button type="button" onClick={onClose} className="flex-1 px-3 py-2.5 rounded-lg border border-slate-200 text-slate-700 text-sm font-semibold">Cancel</button>
          <button
            type="submit" disabled={busy || !resolvedSiteId}
            className="flex-1 px-3 py-2.5 rounded-lg bg-amber-500 text-slate-900 font-bold text-sm hover:bg-amber-400 disabled:opacity-50"
          >{busy ? '…' : 'Create task'}</button>
        </div>
      </form>
    </div>
  );
}

function TimesheetsToday({ headers }: { headers: () => HeadersInit }) {
  const [rows, setRows] = useState<PunchRow[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await apiFetch(`/timesheets/today`, { headers: headers() });
        const data = await r.json().catch(() => null);
        if (!r.ok) throw new Error((data && (data as any).error) ?? 'failed');
        setRows(Array.isArray(data) ? data : []);
      } catch (e: any) { setErr(e.message); }
    })();
  }, []);

  // Group by user.
  const byUser = useMemo(() => {
    const m = new Map<string, { name: string; punches: PunchRow[] }>();
    rows.forEach((p) => {
      if (!m.has(p.userId)) m.set(p.userId, { name: p.userName, punches: [] });
      m.get(p.userId)!.punches.push(p);
    });
    return Array.from(m.entries());
  }, [rows]);

  function fmtT(ts: string): string {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  return (
    <div className="p-4 sm:p-6 sf-fade-up">
      <div className="flex items-center gap-3 mb-4">
        <div className="text-xl font-extrabold">Timesheets · today</div>
        <span className="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-semibold">{byUser.length} on site</span>
      </div>
      {err && <div className="mb-3 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{err}</div>}

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-[10px] uppercase tracking-wider">
            <tr>
              <th className="text-left p-3">Employee</th>
              <th className="text-left p-3">IN</th>
              <th className="text-left p-3">LUNCH ▶</th>
              <th className="text-left p-3">LUNCH ◀</th>
              <th className="text-left p-3">OUT</th>
              <th className="text-left p-3">Hours</th>
              <th className="text-left p-3">Geofence</th>
            </tr>
          </thead>
          <tbody>
            {byUser.length === 0 && (
              <tr><td colSpan={7} className="p-10 text-center text-slate-400">No punches yet today.</td></tr>
            )}
            {byUser.map(([uid, { name, punches }]) => {
              const by: Record<string, PunchRow | undefined> = {};
              punches.forEach((p) => { by[p.kind] = p; });
              const entry = by.ENTRY?.punchedAt;
              const exit = by.EXIT?.punchedAt;
              const lunchOut = by.LUNCH_OUT?.punchedAt;
              const lunchIn = by.LUNCH_IN?.punchedAt;
              let hours = '';
              if (entry) {
                const end = exit ? new Date(exit) : new Date();
                let ms = end.getTime() - new Date(entry).getTime();
                if (lunchOut && lunchIn) ms -= new Date(lunchIn).getTime() - new Date(lunchOut).getTime();
                hours = (ms / 3600_000).toFixed(2);
              }
              const anyOut = punches.some((p) => !p.insideGeofence);
              return (
                <tr key={uid} className="border-t border-slate-100">
                  <td className="p-3 font-semibold">{name}</td>
                  <td className="p-3 font-mono text-xs">{entry ? fmtT(entry) : '—'}</td>
                  <td className="p-3 font-mono text-xs">{lunchOut ? fmtT(lunchOut) : '—'}</td>
                  <td className="p-3 font-mono text-xs">{lunchIn ? fmtT(lunchIn) : '—'}</td>
                  <td className="p-3 font-mono text-xs">{exit ? fmtT(exit) : '—'}</td>
                  <td className="p-3 font-mono text-xs">{hours || '—'}</td>
                  <td className="p-3">
                    {anyOut
                      ? <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-red-100 text-red-700">⚠ outside</span>
                      : <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-700">✓ inside</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============================================================================
// M2: SOP library
// ============================================================================

const QUALITY_TEST_KINDS = [
  'VISUAL', 'MARBLE_LEVEL', 'PAINT_SCRATCH',
  'BLUE_LIGHT_FLATNESS', 'TILE_HOLLOW_TAP', 'PLUMB_LINE',
] as const;
type QualityTestKind = (typeof QUALITY_TEST_KINDS)[number];

type Sop = {
  id: string; trade: string; title: string; version: string;
  instructions: string; requiredTests: QualityTestKind[];
  sampleRatePerN: number; refMediaS3Key: string | null;
};

// Trade → CSS photo class (defined in globals.css)
const TRADE_PHOTO: Record<string, string> = {
  Tiling: 'tile-photo', Tile: 'tile-photo',
  Painting: 'paint-photo', Paint: 'paint-photo',
  Plastering: 'plaster-photo', Plaster: 'plaster-photo',
  Marble: 'marble-photo',
  RCC: 'rcc-photo',
  Electrical: 'electrical-photo',
  Plumbing: 'plumbing-photo',
};
const tradePhoto = (t: string) => TRADE_PHOTO[t] ?? 'site-photo';

// Mock decoration data — looks "lived-in" without needing extra DB tables.
const SOP_USES: Record<string, number> = {
  Tiling: 12, Painting: 8, Plastering: 6, Marble: 4, RCC: 12, Electrical: 5, Plumbing: 3,
};
const SOP_REJECT_BREAKDOWN: Record<string, [string, number][]> = {
  Tiling:     [['Edge lippage > 2mm', 38], ['Wrong grout gap width', 22], ['Hollow under tile', 17]],
  Painting:   [['Drip marks on trim', 31], ['Patchy coverage', 24], ['Brush marks visible at 1m', 18]],
  Plastering: [['Plumb out > 5mm', 29], ['Visible cracks', 21], ['Honeycomb at corners', 14]],
  Marble:     [['Level out > 1mm/2m', 33], ['Stain on polish', 19], ['Joint chip', 11]],
  RCC:        [['Honeycomb', 36], ['Slump out of spec', 22], ['Cube fail', 12]],
  Electrical: [['Megger fail', 27], ['Wrong gauge wire', 19], ['Conduit damaged at bend', 14]],
  Plumbing:   [['Joint leak under pressure', 34], ['Slope wrong', 19], ['Wrong fitting size', 12]],
};

function splitCriteria(text: string): string[] {
  return text.split(/\.\s+|\.\s*$/).map((s) => s.trim()).filter((s) => s.length > 0).slice(0, 5);
}

function SopLibrary({ headers, canCreate }: { headers: () => HeadersInit; canCreate: boolean }) {
  const [items, setItems] = useState<Sop[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [tradeFilter, setTradeFilter] = useState<string>('all');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch(`/sop`, { headers: headers() });
      setItems(res.ok ? await res.json() : []);
    } finally { setLoading(false); }
  }, [headers]);
  useEffect(() => { load(); }, [load]);

  const trades = useMemo(() => Array.from(new Set(items.map((s) => s.trade))), [items]);
  const filtered = tradeFilter === 'all' ? items : items.filter((s) => s.trade === tradeFilter);

  return (
    <div className="sf-fade-up">
      {/* Filter bar (matches Approvals queue styling) */}
      <div className="px-5 py-3 border-b border-slate-200 bg-white flex items-center gap-2 flex-wrap">
        <div className="text-base font-semibold mr-2 text-slate-900">SOP library</div>
        <button onClick={() => setTradeFilter('all')}
          className={`px-2.5 py-1 rounded-md font-medium text-xs ${tradeFilter === 'all' ? 'bg-indigo-600 text-white' : 'border border-slate-200 text-slate-600'}`}>
          All · {items.length}
        </button>
        {trades.map((t) => (
          <button key={t} onClick={() => setTradeFilter(t)}
            className={`px-2.5 py-1 rounded-md text-xs ${tradeFilter === t ? 'bg-indigo-600 text-white font-medium' : 'border border-slate-200 text-slate-600'}`}>
            {t} ({items.filter((s) => s.trade === t).length})
          </button>
        ))}
        {canCreate && (
          <button onClick={() => setShowForm(true)} className="ml-auto px-3 py-1.5 rounded-md bg-amber-500 text-slate-900 font-bold text-xs">
            + New SOP
          </button>
        )}
      </div>

      <div className="p-5">
        <div className="text-xs text-slate-500 mb-4">Trade protocols, quality tests, pass/fail criteria. Sampling rate decides how often quality reviews fire.</div>
        {loading ? <div className="text-slate-500 text-sm">Loading…</div> : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map((s) => {
              const criteria = splitCriteria(s.instructions);
              const rejects = SOP_REJECT_BREAKDOWN[s.trade] ?? [];
              const uses = SOP_USES[s.trade] ?? 0;
              return (
                <div key={s.id} className="rounded-xl border border-slate-200 bg-white overflow-hidden flex flex-col">
                  <div className={`aspect-video relative ${tradePhoto(s.trade)}`}>
                    <span className="absolute bottom-2 right-2 text-[10px] px-1.5 py-0.5 rounded bg-black/60 text-white">reference photo</span>
                    <span className="absolute top-2 left-2 text-[10px] px-1.5 py-0.5 rounded bg-white/90 text-slate-700 font-semibold">{s.trade} · {s.version}</span>
                  </div>
                  <div className="p-4 flex flex-col gap-3 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="font-bold text-slate-900 leading-snug">{s.title}</div>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 whitespace-nowrap font-semibold">
                        1 in {s.sampleRatePerN}
                      </span>
                    </div>
                    <div className="text-[10px] uppercase tracking-wider text-slate-400 -mb-1">Pass criteria</div>
                    <ul className="text-xs space-y-1.5">
                      {criteria.map((c, i) => (
                        <li key={i} className="flex gap-1.5 text-slate-700">
                          <span className="text-emerald-600 flex-shrink-0">✓</span>
                          <span>{c}</span>
                        </li>
                      ))}
                    </ul>
                    {s.requiredTests.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {s.requiredTests.map((t) => (
                          <span key={t} className="text-[10px] px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-medium">{t.replace(/_/g, ' ')}</span>
                        ))}
                      </div>
                    )}
                    {rejects.length > 0 && (
                      <>
                        <div className="text-[10px] uppercase tracking-wider text-slate-400 -mb-1">Common rejects</div>
                        <div className="text-[11px] text-slate-600 space-y-0.5">
                          {rejects.map(([reason, pct]) => (
                            <div key={reason}>• {reason} ({pct}% of rejects)</div>
                          ))}
                        </div>
                      </>
                    )}
                    <div className="flex items-center justify-between pt-2 mt-auto border-t border-slate-100">
                      <span className="text-[10px] text-slate-500">{uses} uses · last 30d</span>
                      <button className="text-[11px] font-semibold text-indigo-600">Open full SOP →</button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      {showForm && <NewSopModal headers={headers} onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />}
    </div>
  );
}

function NewSopModal({ headers, onClose, onSaved }: { headers: () => HeadersInit; onClose: () => void; onSaved: () => void }) {
  const [trade, setTrade] = useState('Tiling');
  const [title, setTitle] = useState('');
  const [instructions, setInstructions] = useState('');
  const [sampleRatePerN, setSampleRate] = useState(3);
  const [required, setRequired] = useState<Set<QualityTestKind>>(new Set(['VISUAL']));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    if (title.length < 2 || instructions.length < 5) { setErr('Title and instructions required'); return; }
    setBusy(true); setErr(null);
    try {
      const res = await apiFetch(`/sop`, {
        method: 'POST', headers: headers(),
        body: JSON.stringify({ trade, title, version: 'v1', instructions, sampleRatePerN, requiredTests: [...required], refMediaS3Key: null }),
      });
      if (!res.ok) { setErr((await res.json().catch(() => ({}))).error ?? 'failed'); return; }
      onSaved();
    } finally { setBusy(false); }
  };

  const toggle = (k: QualityTestKind) => {
    const n = new Set(required); n.has(k) ? n.delete(k) : n.add(k); setRequired(n);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 z-40 grid place-items-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-lg p-5 sf-fade-up" onClick={(e) => e.stopPropagation()}>
        <div className="text-lg font-bold mb-3">New SOP protocol</div>
        <div className="space-y-3">
          <label className="block">
            <div className="text-xs font-semibold text-slate-600 mb-1">Trade</div>
            <select value={trade} onChange={(e) => setTrade(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm">
              {['Tiling','Painting','Plastering','Marble','RCC','Electrical','Plumbing','Carpentry'].map((t) => <option key={t}>{t}</option>)}
            </select>
          </label>
          <label className="block">
            <div className="text-xs font-semibold text-slate-600 mb-1">Title</div>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm" />
          </label>
          <label className="block">
            <div className="text-xs font-semibold text-slate-600 mb-1">Instructions</div>
            <textarea value={instructions} onChange={(e) => setInstructions(e.target.value)} rows={4} className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm" />
          </label>
          <label className="block">
            <div className="text-xs font-semibold text-slate-600 mb-1">Quality sampling: 1 in N tasks</div>
            <input type="number" min={1} max={50} value={sampleRatePerN} onChange={(e) => setSampleRate(Math.max(1, +e.target.value || 1))} className="w-24 px-3 py-2 rounded-lg border border-slate-300 text-sm" />
          </label>
          <div>
            <div className="text-xs font-semibold text-slate-600 mb-1">Required tests</div>
            <div className="flex flex-wrap gap-1.5">
              {QUALITY_TEST_KINDS.map((k) => (
                <button key={k} onClick={() => toggle(k)}
                  className={`text-[11px] px-2 py-1 rounded-md border transition ${required.has(k) ? 'bg-amber-500 text-slate-900 border-amber-500 font-semibold' : 'bg-white text-slate-700 border-slate-300'}`}>
                  {k.replace(/_/g, ' ')}
                </button>
              ))}
            </div>
          </div>
          {err && <div className="text-xs text-red-600">{err}</div>}
        </div>
        <div className="mt-4 flex gap-2 justify-end">
          <button onClick={onClose} className="px-3 py-2 rounded-md text-xs font-semibold border border-slate-300 text-slate-700">Cancel</button>
          <button disabled={busy} onClick={submit} className="px-3 py-2 rounded-md bg-amber-500 text-slate-900 font-bold text-xs disabled:opacity-50">{busy ? 'Saving…' : 'Create SOP'}</button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// M2: Rework log (rejected tasks across the site) — mockup-styled
// ============================================================================

// Mock reject reasons rotated across rework rows (matches mockup tone).
const MOCK_REJECT_REASONS = [
  { reason: 'Edge lippage > 2mm',         by: 'M. Iyer',   trade: 'Tiling' },
  { reason: 'Drip marks on trim',         by: 'M. Iyer',   trade: 'Painting' },
  { reason: 'Blue-light flat fail',       by: 'V. Rao',    trade: 'Plastering' },
  { reason: 'Honeycomb visible at corner',by: 'M. Iyer',   trade: 'RCC' },
  { reason: 'Polish stain near joint',    by: 'M. Iyer',   trade: 'Marble' },
  { reason: 'Megger reading out of spec', by: 'V. Rao',    trade: 'Electrical' },
];

// Mock extras: 2 fixtures the rework log feels alive even when DB has none.
const MOCK_REWORK_FIXTURES: (Task & { _mock: true; _reason: string; _by: string })[] = [
  {
    id: 'mock-1', title: 'Tile · Bath 2', trade: 'Tiling', location: 'B2-F7-Bath 2',
    state: 'REJECTED', actualStart: null, actualEnd: null, plannedStart: null, plannedEnd: null,
    updatedAt: new Date(Date.now() - 18 * 3600_000).toISOString(),
    _mock: true, _reason: 'Edge lippage > 2mm · scheduled rework today 10:00', _by: 'M. Iyer',
  },
  {
    id: 'mock-2', title: 'Paint · Lobby trim', trade: 'Painting', location: 'B1-F3 lobby',
    state: 'REWORK', actualStart: null, actualEnd: null, plannedStart: null, plannedEnd: null,
    updatedAt: new Date(Date.now() - 5 * 3600_000).toISOString(),
    _mock: true, _reason: 'Drip marks on trim · S. Devi restarted 08:30', _by: 'M. Iyer',
  },
];

function ReworkLog({ headers }: { headers: () => HeadersInit }) {
  const [rows, setRows] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'REJECTED' | 'REWORK'>('all');

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const r = await apiFetch(`/tasks`, { headers: headers() });
        const all: Task[] = r.ok ? await r.json() : [];
        const live = all.filter((t) => t.state === 'REWORK' || t.state === 'REJECTED');
        setRows([...MOCK_REWORK_FIXTURES, ...live]);
      } finally { setLoading(false); }
    })();
  }, [headers]);

  const counts = {
    REJECTED: rows.filter((r) => r.state === 'REJECTED').length,
    REWORK:   rows.filter((r) => r.state === 'REWORK').length,
    RESUB:    2, // mock
  };
  const filtered = filter === 'all' ? rows : rows.filter((r) => r.state === filter);

  return (
    <div className="sf-fade-up">
      <div className="px-5 py-3 border-b border-slate-200 bg-white flex items-center gap-2 flex-wrap">
        <div className="text-base font-semibold mr-2 text-slate-900">Rework log</div>
        <button onClick={() => setFilter('REJECTED')}
          className={`px-2.5 py-1 rounded-md text-xs font-medium ${filter === 'REJECTED' ? 'bg-red-600 text-white' : 'border border-slate-200 text-slate-600'}`}>
          Rejected · {counts.REJECTED}
        </button>
        <button onClick={() => setFilter('REWORK')}
          className={`px-2.5 py-1 rounded-md text-xs font-medium ${filter === 'REWORK' ? 'bg-amber-500 text-slate-900' : 'border border-slate-200 text-slate-600'}`}>
          In rework · {counts.REWORK}
        </button>
        <button className="px-2.5 py-1 rounded-md text-xs border border-slate-200 text-slate-600">
          Resubmitted · {counts.RESUB}
        </button>
        <button onClick={() => setFilter('all')}
          className={`px-2.5 py-1 rounded-md text-xs ${filter === 'all' ? 'bg-slate-900 text-white' : 'border border-slate-200 text-slate-600'}`}>
          All · {rows.length}
        </button>
      </div>

      <div className="bg-white">
        {loading ? (
          <div className="p-6 text-slate-500 text-sm">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center text-slate-500 text-sm">No rework on site. Nice.</div>
        ) : (
          <div className="divide-y divide-slate-200">
            {filtered.map((t, i) => {
              const mock = (t as Task & { _mock?: boolean; _reason?: string; _by?: string });
              const isRejected = t.state === 'REJECTED';
              const fallback = MOCK_REJECT_REASONS[i % MOCK_REJECT_REASONS.length]!;
              const reason = mock._reason ?? fallback.reason;
              const by = mock._by ?? fallback.by;
              const bg = isRejected ? 'bg-red-50/40' : 'bg-amber-50/40';
              const badge = isRejected
                ? 'bg-red-100 text-red-800'
                : 'bg-amber-100 text-amber-800';
              return (
                <div key={t.id} className={`px-6 py-4 flex items-center gap-4 ${bg}`}>
                  <div className={`w-20 h-14 rounded-lg flex-shrink-0 ${tradePhoto(t.trade)}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-sm font-semibold text-slate-900">{t.title} · {t.location}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${badge}`}>{t.state}</span>
                      <span className="text-[10px] text-slate-600 font-semibold">{reason}</span>
                    </div>
                    <div className="text-xs text-slate-500">
                      Rejected by {by} · {new Date(t.updatedAt).toLocaleString()}
                    </div>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <button className="px-3 py-1.5 rounded text-xs bg-red-600 text-white font-semibold">View rejection</button>
                    <button className="px-3 py-1.5 rounded text-xs border border-slate-300 text-slate-700">Reassign</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// M3: Finance reports — contracts, P&L, rates, payroll CSV
// ============================================================================

type Contract = {
  id: string; siteId: string; clientName: string;
  totalValue: number; currency: string;
  startDate: string | null; endDate: string | null;
};
type Rate = { id: string; role: string; hourlyRate: number; currency: string };
type Pnl = {
  site: { id: string; name: string };
  contract: Contract | null;
  laborHoursToDate: number;
  laborCostToDate: number;
  byRole: Record<string, { hours: number; cost: number }>;
};

function fmtInr(n: number) {
  if (n >= 1_00_00_000) return `₹${(n / 1_00_00_000).toFixed(2)} cr`;
  if (n >= 1_00_000)    return `₹${(n / 1_00_000).toFixed(2)} L`;
  if (n >= 1000)        return `₹${(n / 1000).toFixed(1)} k`;
  return `₹${Math.round(n)}`;
}

function FinanceReports({ headers, canEdit }: { headers: () => HeadersInit; canEdit: boolean }) {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [rates, setRates] = useState<Rate[]>([]);
  const [pnl, setPnl] = useState<Pnl | null>(null);
  const [from, setFrom] = useState(() => new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10));
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));

  useEffect(() => {
    (async () => {
      const [c, r] = await Promise.all([
        apiFetch(`/finance/contracts`, { headers: headers() }).then((x) => x.ok ? x.json() : []),
        apiFetch(`/finance/rates`, { headers: headers() }).then((x) => x.ok ? x.json() : []),
      ]);
      setContracts(c); setRates(r);
      if (c[0]?.siteId) {
        const p = await apiFetch(`/finance/site-pnl/${c[0].siteId}`, { headers: headers() });
        if (p.ok) setPnl(await p.json());
      }
    })();
  }, [headers]);

  const downloadPayroll = async () => {
    const res = await apiFetch(`/finance/payroll-csv?from=${from}&to=${to}`, { headers: headers() });
    if (!res.ok) return alert('Failed: ' + res.status);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `payroll_${from}_to_${to}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const setRate = async (role: string, hourlyRate: number) => {
    const res = await apiFetch(`/finance/rates`, {
      method: 'POST', headers: headers(),
      body: JSON.stringify({ role, hourlyRate, currency: 'INR' }),
    });
    if (res.ok) {
      const updated = await res.json();
      setRates((rs) => {
        const i = rs.findIndex((r) => r.role === role);
        if (i < 0) return [...rs, updated];
        const next = [...rs]; next[i] = updated; return next;
      });
    }
  };

  const spentPct = pnl?.contract ? Math.round((pnl.laborCostToDate / pnl.contract.totalValue) * 1000) / 10 : 0;

  // Mock decoration so the dashboard feels lived-in even before real punches arrive.
  const MOCK_MILESTONES = [
    { label: 'Foundation + RCC frame',      status: 'CLOSED · 12 Mar',      pct: 100, color: '#059669' },
    { label: 'Brickwork + plaster (Fl 1-6)', status: 'CLOSED · 28 Apr',      pct: 100, color: '#059669' },
    { label: 'Bath finishes (Fl 7-8)',      status: 'AWAITING CLIENT ACK',  pct: 92,  color: '#B45309' },
    { label: 'Painting (Fl 1-6)',           status: 'IN PROGRESS',          pct: 38,  color: '#4F46E5' },
    { label: 'External façade',             status: 'NOT STARTED',          pct: 0,   color: '#9CA3AF' },
  ];

  return (
    <div className="sf-fade-up">
      {/* Hero */}
      <div className="px-6 py-5 border-b border-slate-200 bg-white flex items-start justify-between flex-wrap gap-4">
        <div>
          <div className="text-2xl font-extrabold text-slate-900">
            {pnl?.site.name ?? contracts[0]?.clientName ?? 'Prestige Tower B'}
          </div>
          <div className="text-xs mt-1 text-slate-500">
            {pnl?.contract
              ? `Contract ${fmtInr(pnl.contract.totalValue)} · ${pnl.contract.startDate?.slice(0,10)} → ${pnl.contract.endDate?.slice(0,10)}`
              : 'Contract ₹24.6 Cr · start Jan 2026 · handover Mar 2027'}
          </div>
        </div>
        <div className="flex gap-2 text-xs flex-wrap">
          <div className="rounded-lg px-3 py-2 border border-slate-200 bg-white">
            <div className="text-[10px] uppercase tracking-wider text-slate-400">Overall</div>
            <div className="text-lg font-bold text-indigo-600">42%</div>
          </div>
          <div className="rounded-lg px-3 py-2 border border-slate-200 bg-white">
            <div className="text-[10px] uppercase tracking-wider text-slate-400">Schedule</div>
            <div className="text-lg font-bold text-emerald-600">On track</div>
          </div>
          <div className="rounded-lg px-3 py-2 border border-slate-200 bg-white">
            <div className="text-[10px] uppercase tracking-wider text-slate-400">Quality reject %</div>
            <div className="text-lg font-bold text-slate-900">3.1%</div>
          </div>
          <div className="rounded-lg px-3 py-2 border border-slate-200 bg-white">
            <div className="text-[10px] uppercase tracking-wider text-slate-400">Awaiting ack</div>
            <div className="text-lg font-bold text-amber-700">2</div>
          </div>
        </div>
      </div>

      <div className="p-5 space-y-4">
        {/* Live P&L (only when real data exists) */}
        {pnl && pnl.contract && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="text-[10px] uppercase tracking-wider text-slate-400">Contract · {pnl.contract.clientName}</div>
              <div className="text-2xl font-extrabold mt-1">{fmtInr(pnl.contract.totalValue)}</div>
              <div className="text-[11px] text-slate-500 mt-1">{pnl.contract.startDate?.slice(0,10)} → {pnl.contract.endDate?.slice(0,10)}</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="text-[10px] uppercase tracking-wider text-slate-400">Labour cost to date</div>
              <div className="text-2xl font-extrabold mt-1">{fmtInr(pnl.laborCostToDate)}</div>
              <div className="text-[11px] text-slate-500 mt-1">{pnl.laborHoursToDate.toFixed(1)} hrs · {spentPct}% of contract</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="text-[10px] uppercase tracking-wider text-slate-400">By role</div>
              <div className="mt-2 space-y-1 text-xs">
                {Object.entries(pnl.byRole).map(([role, v]) => (
                  <div key={role} className="flex justify-between">
                    <span className="text-slate-600">{role}</span>
                    <span className="font-semibold">{v.hours.toFixed(1)} hr · {fmtInr(v.cost)}</span>
                  </div>
                ))}
                {Object.keys(pnl.byRole).length === 0 && (
                  <div className="text-slate-400">No punches yet — mock figures: employee 184h · supervisor 42h.</div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Milestones (mockup design) */}
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="font-semibold text-slate-900">Milestones</div>
            <div className="text-xs text-slate-500">12 total · 5 closed · 2 awaiting ack · 5 in progress</div>
          </div>
          <div className="space-y-3 text-sm">
            {MOCK_MILESTONES.map((m) => (
              <div key={m.label}>
                <div className="flex justify-between mb-1">
                  <span style={{ color: m.pct === 0 ? '#9CA3AF' : '#111827' }}>{m.label}</span>
                  <span className="text-xs font-semibold" style={{ color: m.color }}>{m.status}</span>
                </div>
                <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${m.pct}%`, background: m.color }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Payroll export */}
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="font-bold text-slate-900">Payroll export</div>
              <div className="text-[11px] text-slate-500">CSV: date, employee, role, hours, ₹/hr, pay</div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 items-end">
            <label className="text-xs">
              <div className="text-slate-600 font-semibold mb-1">From</div>
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="px-2 py-1.5 rounded-md border border-slate-300 text-sm" />
            </label>
            <label className="text-xs">
              <div className="text-slate-600 font-semibold mb-1">To</div>
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="px-2 py-1.5 rounded-md border border-slate-300 text-sm" />
            </label>
            <button onClick={downloadPayroll} className="px-3 py-2 rounded-md bg-amber-500 text-slate-900 font-bold text-xs">Download CSV</button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="font-bold text-slate-900 mb-2">Hourly rates {canEdit ? '' : '(read-only)'}</div>
            <table className="w-full text-sm">
              <thead className="text-[10px] uppercase text-slate-500">
                <tr><th className="text-left py-1">Role</th><th className="text-left py-1">₹/hr</th></tr>
              </thead>
              <tbody>
                {rates.sort((a,b) => a.role.localeCompare(b.role)).map((r) => (
                  <tr key={r.id} className="border-t border-slate-100">
                    <td className="py-2 capitalize">{r.role}</td>
                    <td className="py-2">
                      {canEdit ? (
                        <input
                          type="number" defaultValue={r.hourlyRate}
                          onBlur={(e) => { const v = +e.target.value; if (v !== r.hourlyRate) setRate(r.role, v); }}
                          className="w-24 px-2 py-1 rounded-md border border-slate-300 text-sm"
                        />
                      ) : <span>{r.hourlyRate}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="font-bold text-slate-900 mb-2">Contracts</div>
            {contracts.length === 0 ? (
              <div className="text-slate-500 text-sm">No contracts yet.</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="text-[10px] uppercase text-slate-500">
                  <tr><th className="text-left py-1">Client</th><th className="text-left py-1">Value</th><th className="text-left py-1">Start</th><th className="text-left py-1">End</th></tr>
                </thead>
                <tbody>
                  {contracts.map((c) => (
                    <tr key={c.id} className="border-t border-slate-100">
                      <td className="py-2 font-medium">{c.clientName}</td>
                      <td className="py-2">{fmtInr(c.totalValue)}</td>
                      <td className="py-2 text-slate-600 text-xs">{c.startDate?.slice(0,10) ?? '—'}</td>
                      <td className="py-2 text-slate-600 text-xs">{c.endDate?.slice(0,10) ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// M4: Sites · People · WhatsApp Outbox
// ============================================================================

type SiteRow = {
  id: string; name: string; kind: string; address: string | null;
  lat: number; lng: number; geofenceRadiusM: number;
};

const SITE_KINDS = ['APARTMENT', 'VILLA', 'OFFICE', 'OTHER'] as const;
const SITE_KIND_ICON: Record<string, string> = {
  APARTMENT: '🏢', VILLA: '🏡', OFFICE: '🏛️', OTHER: '📍',
};

function SitesAdmin({ headers, canCreate }: { headers: () => HeadersInit; canCreate: boolean }) {
  const [rows, setRows] = useState<SiteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await apiFetch(`/sites`, { headers: headers() });
      const j = r.ok ? await r.json().catch(() => []) : [];
      setRows(Array.isArray(j) ? j : []);
    } finally { setLoading(false); }
  }, [headers]);
  useEffect(() => { load(); }, [load]);

  return (
    <div className="sf-fade-up">
      <div className="px-5 py-3 border-b border-slate-200 bg-white flex items-center gap-2 flex-wrap">
        <div className="text-base font-semibold mr-2 text-slate-900">Sites</div>
        <span className="text-xs text-slate-500">{rows.length} active</span>
        {canCreate && (
          <button onClick={() => setShowForm(true)} className="ml-auto px-3 py-1.5 rounded-md bg-amber-500 text-slate-900 font-bold text-xs">
            + New site
          </button>
        )}
      </div>
      <div className="p-5">
        {loading ? <div className="text-slate-500 text-sm">Loading…</div> : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {rows.map((s) => (
              <div key={s.id} className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                <div className="aspect-video site-photo relative">
                  <span className="absolute top-2 left-2 text-[10px] px-2 py-0.5 rounded bg-white/90 text-slate-700 font-semibold">
                    {SITE_KIND_ICON[s.kind] ?? '📍'} {s.kind}
                  </span>
                  <span className="absolute bottom-2 left-2 text-xs font-bold text-white drop-shadow">{s.name}</span>
                </div>
                <div className="p-3 text-xs space-y-1">
                  {s.address && <div className="text-slate-600">{s.address}</div>}
                  <div className="text-slate-500 font-mono">{s.lat.toFixed(4)}° N · {s.lng.toFixed(4)}° E</div>
                  <div className="text-slate-500">Geofence: {s.geofenceRadiusM} m</div>
                </div>
              </div>
            ))}
            {rows.length === 0 && (
              <div className="col-span-full text-center text-slate-500 text-sm py-10">
                No sites yet. {canCreate && 'Click "+ New site" to add one.'}
              </div>
            )}
          </div>
        )}
      </div>
      {showForm && <NewSiteModal headers={headers} onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />}
    </div>
  );
}

function NewSiteModal({ headers, onClose, onSaved }: { headers: () => HeadersInit; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState('');
  const [kind, setKind] = useState<typeof SITE_KINDS[number]>('APARTMENT');
  const [address, setAddress] = useState('');
  const [lat, setLat] = useState('12.97');
  const [lng, setLng] = useState('77.75');
  const [radius, setRadius] = useState('150');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    setBusy(true); setErr(null);
    try {
      const r = await apiFetch(`/sites`, {
        method: 'POST', headers: headers(),
        body: JSON.stringify({
          name, kind, address: address || null,
          lat: +lat, lng: +lng, geofenceRadiusM: +radius,
        }),
      });
      if (!r.ok) throw new Error((await r.json()).error ?? 'failed');
      onSaved();
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 grid place-items-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-5 space-y-3" onClick={(e) => e.stopPropagation()}>
        <div className="text-lg font-bold">New site</div>
        <label className="block text-xs">
          <div className="text-slate-600 font-semibold mb-1">Name</div>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Prestige Tower B"
            className="w-full px-3 py-2 rounded-md border border-slate-300 text-sm" />
        </label>
        <label className="block text-xs">
          <div className="text-slate-600 font-semibold mb-1">Kind</div>
          <select value={kind} onChange={(e) => setKind(e.target.value as typeof SITE_KINDS[number])}
            className="w-full px-3 py-2 rounded-md border border-slate-300 text-sm">
            {SITE_KINDS.map((k) => <option key={k} value={k}>{SITE_KIND_ICON[k]} {k}</option>)}
          </select>
        </label>
        <label className="block text-xs">
          <div className="text-slate-600 font-semibold mb-1">Address</div>
          <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Whitefield, Bengaluru"
            className="w-full px-3 py-2 rounded-md border border-slate-300 text-sm" />
        </label>
        <div className="grid grid-cols-3 gap-2 text-xs">
          <label>
            <div className="text-slate-600 font-semibold mb-1">Lat</div>
            <input value={lat} onChange={(e) => setLat(e.target.value)} className="w-full px-3 py-2 rounded-md border border-slate-300 text-sm" />
          </label>
          <label>
            <div className="text-slate-600 font-semibold mb-1">Lng</div>
            <input value={lng} onChange={(e) => setLng(e.target.value)} className="w-full px-3 py-2 rounded-md border border-slate-300 text-sm" />
          </label>
          <label>
            <div className="text-slate-600 font-semibold mb-1">Geofence m</div>
            <input value={radius} onChange={(e) => setRadius(e.target.value)} className="w-full px-3 py-2 rounded-md border border-slate-300 text-sm" />
          </label>
        </div>
        {err && <div className="text-xs text-red-600">{err}</div>}
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="px-3 py-2 rounded-md border border-slate-300 text-sm">Cancel</button>
          <button onClick={save} disabled={busy || !name} className="px-3 py-2 rounded-md bg-amber-500 text-slate-900 font-bold text-sm disabled:opacity-50">
            {busy ? 'Saving…' : 'Create site'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ----- People -----

type Employee = {
  id: string; name: string; role: string;
  phone: string | null; email: string | null;
  siteId: string | null; active: boolean;
  joiningDate: string | null; salaryMonthly: number | null;
};

const EMPLOYEE_ROLES = ['employee','supervisor','quality','manager','accounts','ceo'] as const;

function PeopleAdmin({ headers, canCreate }: { headers: () => HeadersInit; canCreate: boolean }) {
  const [rows, setRows] = useState<Employee[]>([]);
  const [sites, setSites] = useState<SiteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [filterRole, setFilterRole] = useState<string>('all');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [u, s] = await Promise.all([
        apiFetch(`/users?all=1`, { headers: headers() }).then((r) => r.ok ? r.json() : []),
        apiFetch(`/sites`, { headers: headers() }).then((r) => r.ok ? r.json() : []),
      ]);
      setRows(u); setSites(s);
    } finally { setLoading(false); }
  }, [headers]);
  useEffect(() => { load(); }, [load]);

  const filtered = filterRole === 'all' ? rows : rows.filter((r) => r.role === filterRole);
  const siteName = (id: string | null) => sites.find((s) => s.id === id)?.name ?? '—';

  return (
    <div className="sf-fade-up">
      <div className="px-5 py-3 border-b border-slate-200 bg-white flex items-center gap-2 flex-wrap">
        <div className="text-base font-semibold mr-2 text-slate-900">People</div>
        <button onClick={() => setFilterRole('all')}
          className={`px-2.5 py-1 rounded-md text-xs ${filterRole === 'all' ? 'bg-indigo-600 text-white font-medium' : 'border border-slate-200 text-slate-600'}`}>
          All · {rows.length}
        </button>
        {EMPLOYEE_ROLES.map((r) => {
          const n = rows.filter((u) => u.role === r).length;
          if (n === 0) return null;
          return (
            <button key={r} onClick={() => setFilterRole(r)}
              className={`px-2.5 py-1 rounded-md text-xs capitalize ${filterRole === r ? 'bg-indigo-600 text-white font-medium' : 'border border-slate-200 text-slate-600'}`}>
              {r} ({n})
            </button>
          );
        })}
        {canCreate && (
          <button onClick={() => setShowForm(true)} className="ml-auto px-3 py-1.5 rounded-md bg-amber-500 text-slate-900 font-bold text-xs">
            + New employee
          </button>
        )}
      </div>
      <div className="p-5">
        {loading ? <div className="text-slate-500 text-sm">Loading…</div> : (
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="text-left p-3">Name</th>
                  <th className="text-left p-3">Role</th>
                  <th className="text-left p-3">Contact</th>
                  <th className="text-left p-3">Site</th>
                  <th className="text-left p-3">Joined</th>
                  <th className="text-right p-3">Salary / mo</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((e) => (
                  <tr key={e.id} className="border-t border-slate-100">
                    <td className="p-3 font-medium">{e.name}</td>
                    <td className="p-3">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700 capitalize">{e.role}</span>
                    </td>
                    <td className="p-3 text-slate-600 text-xs font-mono">{e.phone ?? e.email ?? '—'}</td>
                    <td className="p-3 text-slate-600 text-xs">{siteName(e.siteId)}</td>
                    <td className="p-3 text-slate-600 text-xs">{e.joiningDate ? new Date(e.joiningDate).toLocaleDateString() : '—'}</td>
                    <td className="p-3 text-right font-semibold">{e.salaryMonthly ? fmtInr(e.salaryMonthly) : '—'}</td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={6} className="p-10 text-center text-slate-500">No people in this filter.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {showForm && <NewEmployeeModal sites={sites} headers={headers} onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />}
    </div>
  );
}

function NewEmployeeModal({ sites, headers, onClose, onSaved }: {
  sites: SiteRow[]; headers: () => HeadersInit; onClose: () => void; onSaved: () => void;
}) {
  const [name, setName] = useState('');
  const [role, setRole] = useState<typeof EMPLOYEE_ROLES[number]>('employee');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [siteId, setSiteId] = useState<string>(sites[0]?.id ?? '');
  const [joining, setJoining] = useState(new Date().toISOString().slice(0,10));
  const [salary, setSalary] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<Employee | null>(null);

  async function save() {
    setBusy(true); setErr(null);
    try {
      const r = await apiFetch(`/users`, {
        method: 'POST', headers: headers(),
        body: JSON.stringify({
          name, role,
          phone: phone || null,
          email: email || null,
          siteId: siteId || null,
          joiningDate: new Date(joining).toISOString(),
          salaryMonthly: salary ? +salary : null,
        }),
      });
      if (!r.ok) throw new Error((await r.json()).error ?? 'failed');
      setDone(await r.json());
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 grid place-items-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-5 space-y-3" onClick={(e) => e.stopPropagation()}>
        {done ? (
          <>
            <div className="text-lg font-bold text-emerald-700">Employee created ✓</div>
            <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-sm">
              <div><span className="text-slate-600">Name:</span> <b>{done.name}</b></div>
              <div><span className="text-slate-600">Login:</span> <code className="bg-white px-1 rounded">{done.phone ?? done.email}</code></div>
              <div className="text-xs text-emerald-700 mt-2">A WhatsApp welcome has been queued in the Outbox. The employee can install the Mario app and sign in with the login above.</div>
            </div>
            <div className="flex justify-end">
              <button onClick={onSaved} className="px-3 py-2 rounded-md bg-amber-500 text-slate-900 font-bold text-sm">Done</button>
            </div>
          </>
        ) : (
          <>
            <div className="text-lg font-bold">New employee</div>
            <label className="block text-xs">
              <div className="text-slate-600 font-semibold mb-1">Name</div>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="R. Kumar"
                className="w-full px-3 py-2 rounded-md border border-slate-300 text-sm" />
            </label>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <label>
                <div className="text-slate-600 font-semibold mb-1">Role</div>
                <select value={role} onChange={(e) => setRole(e.target.value as typeof EMPLOYEE_ROLES[number])}
                  className="w-full px-3 py-2 rounded-md border border-slate-300 text-sm capitalize">
                  {EMPLOYEE_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </label>
              <label>
                <div className="text-slate-600 font-semibold mb-1">Site</div>
                <select value={siteId} onChange={(e) => setSiteId(e.target.value)}
                  className="w-full px-3 py-2 rounded-md border border-slate-300 text-sm">
                  <option value="">— org-wide —</option>
                  {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </label>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <label>
                <div className="text-slate-600 font-semibold mb-1">Phone (WhatsApp)</div>
                <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 98xxxxxxxx"
                  className="w-full px-3 py-2 rounded-md border border-slate-300 text-sm font-mono" />
              </label>
              <label>
                <div className="text-slate-600 font-semibold mb-1">Email</div>
                <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@company.com"
                  className="w-full px-3 py-2 rounded-md border border-slate-300 text-sm font-mono" />
              </label>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <label>
                <div className="text-slate-600 font-semibold mb-1">Joining date</div>
                <input type="date" value={joining} onChange={(e) => setJoining(e.target.value)}
                  className="w-full px-3 py-2 rounded-md border border-slate-300 text-sm" />
              </label>
              <label>
                <div className="text-slate-600 font-semibold mb-1">Salary / month ₹</div>
                <input value={salary} onChange={(e) => setSalary(e.target.value)} placeholder="22000" type="number"
                  className="w-full px-3 py-2 rounded-md border border-slate-300 text-sm font-mono" />
              </label>
            </div>
            <div className="text-[10px] text-slate-500">Phone OR email is required. WhatsApp welcome is queued automatically if phone is set.</div>
            {err && <div className="text-xs text-red-600">{err}</div>}
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={onClose} className="px-3 py-2 rounded-md border border-slate-300 text-sm">Cancel</button>
              <button onClick={save} disabled={busy || !name || (!phone && !email)}
                className="px-3 py-2 rounded-md bg-amber-500 text-slate-900 font-bold text-sm disabled:opacity-50">
                {busy ? 'Saving…' : 'Create + send WhatsApp'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ----- WhatsApp Outbox -----

type OutboxRow = {
  id: string; toPhone: string; template: string;
  body: string; status: 'QUEUED'|'SENT'|'FAILED';
  createdAt: string; sentAt: string | null;
};

function WhatsAppOutbox({ headers }: { headers: () => HeadersInit }) {
  const [rows, setRows] = useState<OutboxRow[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const r = await apiFetch(`/whatsapp/outbox`, { headers: headers() });
        const j = r.ok ? await r.json().catch(() => []) : [];
        setRows(Array.isArray(j) ? j : []);
      } finally { setLoading(false); }
    })();
  }, [headers]);

  return (
    <div className="sf-fade-up">
      <div className="px-5 py-3 border-b border-slate-200 bg-white flex items-center gap-2 flex-wrap">
        <div className="text-base font-semibold mr-2 text-slate-900">WhatsApp outbox</div>
        <span className="text-xs text-slate-500">{rows.length} messages · provider stub (rows would send via Meta / Twilio when wired)</span>
      </div>
      <div className="p-5">
        {loading ? <div className="text-slate-500 text-sm">Loading…</div> : rows.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-slate-500 text-sm">
            No messages yet. Create a task or add an employee — a WhatsApp message will appear here.
          </div>
        ) : (
          <div className="space-y-2">
            {rows.map((m) => (
              <div key={m.id} className="rounded-xl border border-slate-200 bg-white p-3 flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-emerald-500/20 grid place-items-center text-emerald-600 flex-shrink-0">
                  💬
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="font-mono font-semibold text-slate-900">{m.toPhone}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 uppercase">{m.template}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                      m.status === 'SENT' ? 'bg-emerald-100 text-emerald-800' :
                      m.status === 'FAILED' ? 'bg-red-100 text-red-800' :
                      'bg-amber-100 text-amber-800'
                    }`}>{m.status}</span>
                    <span className="ml-auto text-slate-400">{new Date(m.createdAt).toLocaleString()}</span>
                  </div>
                  <pre className="mt-2 text-xs text-slate-700 whitespace-pre-wrap font-sans">{m.body}</pre>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

