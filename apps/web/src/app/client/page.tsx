'use client';
/**
 * Client read-only portal — mockup #6.
 *
 * Layout:
 *   left sidebar (VIEW + TOWERS)  |  main:
 *     [tower title · contract value · 4 KPI stat cards]
 *     [Awaiting your acknowledgment — cards with Acknowledge / Raise issue]
 *     [Milestones progress + Recent evidence gallery side-by-side]
 *
 * This is the only client-facing read-only surface. Auto-loaded for users
 * whose JWT role is 'client'; everyone else can also visit it manually.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MarioMark } from '../../components/MarioLogo';
import { LangToggle } from '../../components/LangToggle';
import { apiFetch, isDemo } from '../../lib/api';
import { useT } from '../../lib/i18n';
import { testForTrade } from '../approvals/quality-tests';

interface Site { id: string; name: string; address?: string | null; lat?: number; lng?: number }
interface Contract { id: string; siteId: string; clientName: string; totalValue: number; currency: string; startDate?: string; endDate?: string }
interface CTask {
  id: string; title: string; trade: string; location: string;
  state: string; siteId: string;
  plannedStart: string | null; plannedEnd: string | null;
  actualStart: string | null; actualEnd: string | null;
  updatedAt: string; reworkCount?: number;
  assigneeUserId?: string | null;
}

export default function ClientPortal() {
  const router = useRouter();
  const t = useT();
  const [user, setUser] = useState<{ id: string; name: string; role: string; orgId: string } | null>(null);
  const [sites, setSites] = useState<Site[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [tasks, setTasks] = useState<CTask[]>([]);
  const [users, setUsers] = useState<{ id: string; name: string; role: string }[]>([]);
  const [activeSiteId, setActiveSiteId] = useState<string>('');
  const [view, setView] = useState<'overview' | 'milestones' | 'evidence' | 'snag' | 'reports'>('overview');
  const [busy, setBusy] = useState<string | null>(null);
  const [flash, setFlash] = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null);
  const [orgInfo, setOrgInfo] = useState<{ name: string; logoUrl: string | null }>({ name: 'Mario', logoUrl: null });

  const token = typeof window !== 'undefined' ? localStorage.getItem('sf_token') : null;

  const headers = useCallback(
    () => ({ 'content-type': 'application/json', authorization: `Bearer ${token}` }),
    [token],
  );

  const load = useCallback(async () => {
    if (!token) { router.replace('/'); return; }
    try {
      const cached = JSON.parse(localStorage.getItem('sf_user') ?? 'null');
      if (cached) setUser(cached);
      const [sRes, cRes, tRes, uRes, orgRes] = await Promise.all([
        apiFetch(`/sites`,             { headers: headers() }),
        apiFetch(`/finance/contracts`, { headers: headers() }),
        apiFetch(`/tasks`,             { headers: headers() }),
        apiFetch(`/users`,             { headers: headers() }),
        apiFetch(`/orgs/me`,           { headers: headers() }),
      ]);
      const sJ = await sRes.json().catch(() => []);
      const cJ = await cRes.json().catch(() => []);
      const tJ = await tRes.json().catch(() => []);
      const uJ = await uRes.json().catch(() => []);
      const oJ = await orgRes.json().catch(() => ({}));
      setSites(Array.isArray(sJ) ? sJ : []);
      setContracts(Array.isArray(cJ) ? cJ : []);
      setTasks(Array.isArray(tJ) ? tJ : []);
      setUsers(Array.isArray(uJ) ? uJ : []);
      const sites: Site[] = Array.isArray(sJ) ? sJ : [];
      if (!activeSiteId && sites[0]) setActiveSiteId(sites[0].id);
      if (oJ?.org?.name) setOrgInfo({ name: oJ.org.name, logoUrl: oJ.logoUrl ?? null });
    } catch (e: any) {
      setFlash({ kind: 'err', msg: e?.message ?? 'failed to load' });
    }
  }, [headers, router, token, activeSiteId]);

  useEffect(() => { load(); }, [load]);

  // ── Derived rollups ─────────────────────────────────────────────────────
  const userById = useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);
  const contractByEite = useMemo(() => new Map(contracts.map((c) => [c.siteId, c])), [contracts]);
  const activeSite = sites.find((s) => s.id === activeSiteId) ?? sites[0];
  const activeContract = activeSite ? contractByEite.get(activeSite.id) : undefined;

  const tasksHere = useMemo(
    () => activeSite ? tasks.filter((t) => t.siteId === activeSite.id) : [],
    [tasks, activeSite],
  );

  const overallPct = useMemo(() => {
    if (tasksHere.length === 0) return 0;
    const done = tasksHere.filter((t) => t.state === 'CLOSED' || t.state === 'CLIENT_ACKNOWLEDGED').length;
    return Math.round((done / tasksHere.length) * 100);
  }, [tasksHere]);

  const schedule: 'on-track' | 'at-risk' | 'blocked' = useMemo(() => {
    const rework = tasksHere.filter((t) => (t.reworkCount ?? 0) >= 1).length;
    if (rework >= 3) return 'blocked';
    if (rework >= 1) return 'at-risk';
    return 'on-track';
  }, [tasksHere]);

  const rejectPct = useMemo(() => {
    if (tasksHere.length === 0) return 0;
    const r = tasksHere.filter((t) => (t.reworkCount ?? 0) >= 1).length;
    return Math.round((r / tasksHere.length) * 1000) / 10;
  }, [tasksHere]);

  // Awaiting-ack = tasks where manager has approved and is waiting on client.
  const awaitingAck = useMemo(
    () => tasksHere.filter((t) => t.state === 'MANAGER_APPROVED'),
    [tasksHere],
  );

  // Synthetic milestone bands: bucket tasks by their location's floor/block prefix.
  const milestones = useMemo(() => {
    const groups = new Map<string, CTask[]>();
    for (const t of tasksHere) {
      // "T4-F12-Living" → "T4-F12"
      const key = t.location.split('-').slice(0, 2).join('-') || 'site';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(t);
    }
    return Array.from(groups.entries()).map(([loc, ts]) => {
      const done = ts.filter((t) => t.state === 'CLOSED' || t.state === 'CLIENT_ACKNOWLEDGED').length;
      const total = ts.length;
      const pct = total === 0 ? 0 : Math.round((done / total) * 100);
      const status: 'CLOSED' | 'IN_PROGRESS' | 'UPCOMING' =
        pct === 100 ? 'CLOSED' :
        pct > 0     ? 'IN_PROGRESS' :
        'UPCOMING';
      // pick the latest updatedAt for "as of" date.
      const lastTs = ts.reduce<string>((acc, t) => (t.updatedAt > acc ? t.updatedAt : acc), '');
      return { loc, done, total, pct, status, lastTs };
    }).sort((a, b) => b.pct - a.pct);
  }, [tasksHere]);

  const recentEvidence = useMemo(() => {
    return tasksHere
      .filter((t) => ['PROOF_SUBMITTED', 'SUPERVISOR_APPROVED', 'QUALITY_APPROVED', 'MANAGER_APPROVED', 'CLIENT_ACKNOWLEDGED', 'CLOSED'].includes(t.state))
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, 8);
  }, [tasksHere]);

  // ── Actions ────────────────────────────────────────────────────────────
  const acknowledge = useCallback(async (taskId: string) => {
    setBusy(taskId); setFlash(null);
    try {
      const res = await apiFetch(`/approvals/approve`, {
        method: 'POST', headers: headers(),
        body: JSON.stringify({ taskId, note: 'client acknowledged' }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error((j as any).error ?? `failed (${res.status})`);
      }
      setFlash({ kind: 'ok', msg: t('cliAckRecorded') });
      await load();
    } catch (e: any) {
      setFlash({ kind: 'err', msg: e?.message ?? 'failed' });
    } finally {
      setBusy(null);
    }
  }, [headers, load, t]);

  const raiseIssue = useCallback((taskId: string) => {
    const reason = window.prompt('Describe the issue you want to raise?');
    if (!reason) return;
    setBusy(taskId); setFlash(null);
    (async () => {
      try {
        const res = await apiFetch(`/approvals/reject`, {
          method: 'POST', headers: headers(),
          body: JSON.stringify({ taskId, reason }),
        });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error((j as any).error ?? `failed (${res.status})`);
        }
        setFlash({ kind: 'ok', msg: t('cliIssueRecorded') });
        await load();
      } catch (e: any) {
        setFlash({ kind: 'err', msg: e?.message ?? 'failed' });
      } finally {
        setBusy(null);
      }
    })();
  }, [headers, load, t]);

  function logout() {
    localStorage.removeItem('sf_token');
    localStorage.removeItem('sf_user');
    router.replace('/');
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-slate-900 flex flex-col">
      {/* Top bar */}
      <header className="bg-slate-950 text-slate-100 border-b border-slate-800 sticky top-0 z-20">
        <div className="px-5 py-3 flex items-center gap-3">
          <a href="/client" className="flex items-center gap-2 group">
            {orgInfo.logoUrl
              ? <img src={orgInfo.logoUrl} alt={orgInfo.name} className="w-9 h-9 rounded-md object-contain bg-white p-0.5" />
              : <MarioMark size={36} />
            }
            <div className="leading-tight">
              <div className="font-extrabold tracking-tight">{orgInfo.name} · {t('cliBrand')}</div>
              <div className="text-[10px] text-slate-400 hidden sm:block">
                {activeSite?.name ?? '—'} · {t('cliOwner')}: {orgInfo.name}
              </div>
            </div>
          </a>
          <div className="ml-auto flex items-center gap-3 text-xs">
            {isDemo() && (
              <span title="No backend — UI is mocked end-to-end." className="hidden md:inline-flex px-2 py-1 rounded-md bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-semibold text-[10px] tracking-wider">
                {t('demoMode')}
              </span>
            )}
            <LangToggle tone="dark" />
            <span className="text-slate-300 hidden sm:inline">{user?.name ?? '—'}</span>
            <button onClick={logout} className="text-amber-400 hover:text-amber-300 underline text-xs">
              {t('signOut')}
            </button>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="hidden md:flex w-56 border-r border-slate-200 bg-white flex-col p-4 text-sm">
          <div className="text-[10px] uppercase tracking-widest text-slate-400 font-bold mb-2">{t('cliViewNav')}</div>
          {(['overview', 'milestones', 'evidence', 'snag', 'reports'] as const).map((v) => {
            const labelKey = ({ overview: 'cliNavOverview', milestones: 'cliNavMilestones', evidence: 'cliNavEvidence', snag: 'cliNavSnag', reports: 'cliNavReports' } as const)[v];
            const count = v === 'milestones' ? milestones.length : v === 'snag' ? tasksHere.filter((t) => (t.reworkCount ?? 0) >= 1).length : 0;
            return (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`text-left px-3 py-2 rounded-lg mb-1 font-semibold transition flex justify-between ${
                  view === v ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <span>{t(labelKey)}</span>
                {count > 0 && <span className="text-[10px] font-bold opacity-60">· {count}</span>}
              </button>
            );
          })}

          <div className="text-[10px] uppercase tracking-widest text-slate-400 font-bold mt-6 mb-2">{t('cliTowers')}</div>
          {sites.length === 0 && <div className="text-xs text-slate-400 px-3 py-2">No towers.</div>}
          {sites.map((s) => (
            <button
              key={s.id}
              onClick={() => setActiveSiteId(s.id)}
              className={`text-left px-3 py-2 rounded-lg font-medium hover:bg-slate-50 transition ${
                activeSiteId === s.id ? 'text-slate-900 bg-slate-50' : 'text-slate-500'
              }`}
            >
              {s.name}
            </button>
          ))}
        </aside>

        {/* Main */}
        <main className="flex-1 overflow-auto p-5 sm:p-8 space-y-6">
          {flash && (
            <div className={`p-3 rounded-lg text-sm border ${flash.kind === 'ok' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-700'}`}>
              {flash.msg}
            </div>
          )}

          {/* Title + contract + stats */}
          <section className="flex items-start gap-6 flex-wrap">
            <div className="min-w-0 flex-1">
              <h1 className="text-3xl font-extrabold">
                {activeSite?.name ?? '—'}{' '}
                <span className="text-slate-400 font-bold">· {activeSite?.address?.split(',')[0] ?? ''}</span>
              </h1>
              <div className="text-sm text-slate-500 mt-1">
                {t('cliContract')} {inr(activeContract?.totalValue ?? 0)} · {t('cliStart')} {fmtDate(activeContract?.startDate)} · {t('cliHandover')} {fmtDate(activeContract?.endDate)}
              </div>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 w-full">
              <StatCard label={t('cliKpiOverall')}     value={`${overallPct}%`}           accent="indigo" />
              <StatCard label={t('cliKpiSchedule')}    value={scheduleLabel(schedule, t)} accent={schedule === 'on-track' ? 'emerald' : schedule === 'at-risk' ? 'amber' : 'red'} />
              <StatCard label={t('cliKpiRejectPct')}   value={`${rejectPct}%`}            accent={rejectPct <= 5 ? 'emerald' : rejectPct <= 10 ? 'amber' : 'red'} />
              <StatCard label={t('cliKpiAwaiting')}    value={String(awaitingAck.length)} accent={awaitingAck.length > 0 ? 'rose' : 'slate'} />
            </div>
          </section>

          {/* Awaiting your acknowledgment */}
          <section className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
              <div>
                <div className="text-base font-extrabold text-slate-900">{t('cliAwaitingTitle')}</div>
                <div className="text-[11px] text-slate-500">{t('cliAwaitingTitleHi')}</div>
              </div>
              {awaitingAck.length > 0 && (
                <span className="text-[11px] text-slate-500">{t('cliViewAll')} ({awaitingAck.length})</span>
              )}
            </div>
            {awaitingAck.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-400">{t('cliNoAwaiting')}</div>
            ) : (
              <div className="divide-y divide-slate-100">
                {awaitingAck.map((tk) => {
                  const test = testForTrade(tk.trade);
                  const assigneeName = userById.get(tk.assigneeUserId ?? '')?.name ?? '—';
                  return (
                    <div key={tk.id} className="p-4 flex items-center gap-4 flex-wrap">
                      <div className="w-16 h-12 rounded shrink-0" style={{ background: test.refTint }} />
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-slate-900">
                          {tk.location} · {tk.title}
                        </div>
                        <div className="text-[12px] text-slate-500 mt-0.5">
                          {tk.trade} · finished {fmtShortDate(tk.actualEnd ?? tk.updatedAt)} · approved by {assigneeName} ·{' '}
                          <span className="text-indigo-600 cursor-pointer hover:underline">{t('cliViewEvidence')}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          disabled={busy === tk.id}
                          onClick={() => acknowledge(tk.id)}
                          className="px-4 py-2 rounded-lg bg-indigo-600 text-white font-bold text-sm hover:bg-indigo-700 disabled:opacity-50"
                        >{t('cliAcknowledge')}</button>
                        <button
                          disabled={busy === tk.id}
                          onClick={() => raiseIssue(tk.id)}
                          className="px-4 py-2 rounded-lg bg-white border border-red-300 text-red-600 font-bold text-sm hover:bg-red-50 disabled:opacity-50"
                        >{t('cliRaiseIssue')}</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Milestones + Recent evidence */}
          <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <div className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">{t('cliMilestones')}</div>
                <div className="text-[10px] text-slate-400">
                  {milestones.length} {t('cliMilestonesCount')} · {milestones.filter((m) => m.status === 'CLOSED').length} {t('cliClosed').toLowerCase()} · {milestones.filter((m) => m.status === 'IN_PROGRESS').length} {t('cliInProg').toLowerCase()}
                </div>
              </div>
              {milestones.length === 0 ? (
                <div className="text-sm text-slate-400 py-6 text-center">No milestones yet.</div>
              ) : (
                <div className="space-y-3">
                  {milestones.map((m) => (
                    <div key={m.loc}>
                      <div className="flex items-baseline justify-between text-sm">
                        <div className="font-semibold text-slate-800">{m.loc}</div>
                        <div className="text-[11px] font-mono">
                          {m.status === 'CLOSED' ? <span className="text-emerald-700 font-bold">{t('cliClosed')} · {fmtShortDate(m.lastTs)}</span> :
                           m.status === 'IN_PROGRESS' ? <span className="text-amber-700 font-bold">{t('cliInProg')} · {m.pct}%</span> :
                           <span className="text-slate-500">{t('cliUpcoming')}</span>}
                        </div>
                      </div>
                      <div className="mt-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className={`h-full ${m.status === 'CLOSED' ? 'bg-emerald-500' : m.status === 'IN_PROGRESS' ? 'bg-gradient-to-r from-amber-400 to-emerald-500' : 'bg-slate-300'}`}
                          style={{ width: `${m.pct}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <div className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">{t('cliRecentEvidence')}</div>
                <span className="text-[10px] text-indigo-600 cursor-pointer hover:underline">{t('cliGallery')}</span>
              </div>
              {recentEvidence.length === 0 ? (
                <div className="text-sm text-slate-400 py-6 text-center">No evidence yet.</div>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {recentEvidence.map((tk) => {
                    const test = testForTrade(tk.trade);
                    return (
                      <div
                        key={tk.id}
                        title={`${tk.trade} · ${tk.location} · ${fmtShortDate(tk.updatedAt)}`}
                        className="aspect-square rounded-lg border border-slate-200"
                        style={{ background: test.refTint }}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}

// ── atoms ─────────────────────────────────────────────────────────────────

function StatCard({ label, value, accent }: { label: string; value: string; accent: 'indigo' | 'amber' | 'rose' | 'red' | 'emerald' | 'slate' }) {
  const cls = {
    indigo:  'bg-white border-indigo-100 text-indigo-700',
    amber:   'bg-white border-amber-100 text-amber-700',
    rose:    'bg-white border-rose-100 text-rose-700',
    red:     'bg-white border-red-100 text-red-700',
    emerald: 'bg-white border-emerald-100 text-emerald-700',
    slate:   'bg-white border-slate-200 text-slate-700',
  }[accent];
  return (
    <div className={`rounded-2xl border p-4 shadow-sm ${cls}`}>
      <div className="text-[10px] uppercase tracking-widest font-bold opacity-70">{label}</div>
      <div className="text-2xl font-extrabold mt-1 leading-tight">{value}</div>
    </div>
  );
}

function scheduleLabel(s: 'on-track' | 'at-risk' | 'blocked', t: (k: any) => string): string {
  return s === 'on-track' ? t('cliSchedOnTrack') : s === 'at-risk' ? t('cliSchedAtRisk') : t('cliSchedBlocked');
}

function inr(amount: number): string {
  if (amount >= 1_00_00_000) return `₹ ${(amount / 1_00_00_000).toFixed(amount >= 10_00_00_000 ? 0 : 1)} Cr`;
  if (amount >= 1_00_000)    return `₹ ${(amount / 1_00_000).toFixed(amount >= 10_00_000 ? 0 : 1)} L`;
  return `₹ ${amount.toLocaleString('en-IN')}`;
}

function fmtDate(ts: string | null | undefined): string {
  if (!ts) return '—';
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
}
function fmtShortDate(ts: string | null | undefined): string {
  if (!ts) return '—';
  return new Date(ts).toLocaleDateString(undefined, { day: '2-digit', month: 'short' });
}
