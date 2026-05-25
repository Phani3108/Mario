'use client';
import { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../../lib/api';
import { useT } from '../../lib/i18n';
import { testForTrade } from './quality-tests';

/**
 * Manager command center — the "wide angle" view across every project.
 *
 * Sections:
 *  1. Four headline KPIs  (Active sites · In progress · Pending approvals · Rework escalations)
 *  2. Site portfolio grid — every site as a tile with crew + today's tasks + % done + status pill
 *  3. Escalations strip — tasks rejected ≥2× that need manager attention
 *  4. Recent activity feed — chronological tail of state transitions
 *  5. Quick actions panel — "+ New task", "+ New project", "View approval queue"
 *
 * No new API surface — pulls /tasks + /sites + /users and derives everything
 * locally so it works under demo mode too.
 */

export interface MTask {
  id: string;
  title: string;
  trade: string;
  location: string;
  state: string;
  siteId: string;
  assigneeUserId?: string | null;
  plannedStart: string | null;
  plannedEnd: string | null;
  actualStart: string | null;
  actualEnd: string | null;
  updatedAt: string;
  reworkCount?: number;
}

interface Site {
  id: string;
  name: string;
  address?: string | null;
  lat?: number;
  lng?: number;
}

export interface ManagerViewProps {
  headers: () => HeadersInit;
  initialTasks: MTask[];     // pending approval queue from parent (subset)
  sites: { id: string; label: string; active: boolean }[];
  userMap?: Record<string, string>;
  onOpenNewTask?: () => void;
  onOpenNewSite?: () => void;
  onViewApprovalQueue?: () => void;
}

export function ManagerView({
  headers, initialTasks, sites, userMap = {},
  onOpenNewTask, onOpenNewSite, onViewApprovalQueue,
}: ManagerViewProps) {
  const t = useT();
  const [allTasks, setAllTasks] = useState<MTask[]>([]);
  const [err, setErr] = useState<string | null>(null);

  // Pull the FULL task list (not just pending) so the KPIs + activity feed
  // can see in-progress / closed / rework rows too. Parent's `tasks` state
  // only holds the pending-approval subset.
  useEffect(() => {
    (async () => {
      try {
        const r = await apiFetch(`/tasks`, { headers: headers() });
        const data = await r.json().catch(() => []);
        setAllTasks(Array.isArray(data) ? data : []);
      } catch (e: any) {
        setErr(e?.message ?? 'failed to load tasks');
      }
    })();
  }, [headers]);

  // ── Derived metrics ─────────────────────────────────────────────────────
  const sitesById = useMemo(() => new Map(sites.map((s) => [s.id, s])), [sites]);

  const kpi = useMemo(() => {
    const PENDING = new Set(['PROOF_SUBMITTED', 'SUPERVISOR_APPROVED', 'QUALITY_APPROVED', 'MANAGER_APPROVED']);
    return {
      activeSites: sites.length,
      inProgress: allTasks.filter((t) => t.state === 'IN_PROGRESS').length,
      pendingApprovals: allTasks.filter((t) => PENDING.has(t.state)).length || initialTasks.length,
      reworkEscalations: allTasks.filter((t) => (t.reworkCount ?? 0) >= 2).length,
    };
  }, [allTasks, sites, initialTasks]);

  // Per-site rollup for the portfolio grid.
  const sitePortfolio = useMemo(() => {
    return sites.map((s) => {
      const tasksHere = allTasks.filter((t) => t.siteId === s.id);
      const total = tasksHere.length;
      const done = tasksHere.filter((t) => t.state === 'CLOSED' || t.state === 'CLIENT_ACKNOWLEDGED').length;
      const inProg = tasksHere.filter((t) => t.state === 'IN_PROGRESS').length;
      const rework = tasksHere.filter((t) => t.state === 'REWORK' || (t.reworkCount ?? 0) >= 1).length;
      const pct = total === 0 ? 0 : Math.round((done / total) * 100);
      const status: 'on-track' | 'at-risk' | 'blocked' =
        rework >= 3 ? 'blocked' :
        rework >= 1 ? 'at-risk' :
        'on-track';
      const crewIds = new Set(tasksHere.map((t) => t.assigneeUserId).filter(Boolean));
      return { site: s, total, done, inProg, rework, pct, status, crewCount: crewIds.size };
    });
  }, [sites, allTasks]);

  // Escalation strip: tasks with ≥2 rework cycles.
  const escalations = useMemo(() => {
    return allTasks
      .filter((t) => (t.reworkCount ?? 0) >= 2)
      .sort((a, b) => (b.reworkCount ?? 0) - (a.reworkCount ?? 0))
      .slice(0, 6);
  }, [allTasks]);

  // Activity feed: most recently updated tasks, with a humanized "x min ago".
  const activity = useMemo(() => {
    const tCutoff = Date.now() - 6 * 3600_000;
    return allTasks
      .filter((t) => t.updatedAt && new Date(t.updatedAt).getTime() >= tCutoff)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, 8);
  }, [allTasks]);

  return (
    <div className="p-4 sm:p-6 space-y-6 sf-fade-up pb-20">
      {/* Title */}
      <div className="flex items-baseline gap-3 flex-wrap">
        <div>
          <div className="text-[10px] uppercase tracking-[0.25em] text-amber-600 font-bold">{t('navWorkflow')}</div>
          <h1 className="text-2xl font-extrabold text-slate-900">{t('mgrTitle')}</h1>
          <div className="text-xs text-slate-500">{t('mgrSubtitle')}</div>
        </div>
        <div className="ml-auto flex items-center gap-2 flex-wrap">
          {onOpenNewTask && (
            <button onClick={onOpenNewTask} className="px-3 py-1.5 rounded-md bg-amber-500 text-slate-900 font-bold text-xs hover:bg-amber-400">
              {t('newTask')}
            </button>
          )}
          {onOpenNewSite && (
            <button onClick={onOpenNewSite} className="px-3 py-1.5 rounded-md border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-50">
              {t('navNewProject')}
            </button>
          )}
          {onViewApprovalQueue && (
            <button onClick={onViewApprovalQueue} className="px-3 py-1.5 rounded-md bg-slate-900 text-white font-bold text-xs hover:bg-slate-800">
              {t('mgrViewQueue')} →
            </button>
          )}
        </div>
      </div>

      {err && <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{err}</div>}

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label={t('mgrKpiActive')}  value={kpi.activeSites}      accent="indigo" />
        <KpiCard label={t('mgrKpiInProg')}  value={kpi.inProgress}       accent="amber" />
        <KpiCard label={t('mgrKpiPending')} value={kpi.pendingApprovals} accent="rose" onClick={onViewApprovalQueue} />
        <KpiCard label={t('mgrKpiRework')}  value={kpi.reworkEscalations} accent="red" />
      </div>

      {/* Site portfolio grid */}
      <section>
        <div className="text-[10px] uppercase tracking-widest text-slate-400 font-bold mb-3">{t('mgrPortfolio')}</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {sitePortfolio.map(({ site, total, done, inProg, rework, pct, status, crewCount }) => {
            const tint = trade2Tint(allTasks.find((x) => x.siteId === site.id)?.trade ?? 'tile');
            return (
              <article key={site.id} className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm hover:border-slate-300 transition">
                <div className="h-20 relative" style={{ background: tint }}>
                  <span className="absolute top-2 right-2">
                    <StatusPill status={status} t={t} />
                  </span>
                  <span className="absolute bottom-2 left-2 text-xs font-extrabold text-white drop-shadow">{site.label}</span>
                </div>
                <div className="p-3 text-xs space-y-1">
                  <div className="flex justify-between"><span className="text-slate-500">{t('mgrTodayTasks')}</span><span className="font-bold text-slate-900">{total} {t('mgrTasks')}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">{t('mgrCrew')}</span><span className="font-bold text-slate-900">{crewCount}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">{t('mgrPctDone')}</span><span className="font-bold text-emerald-600">{pct}%</span></div>
                  <div className="flex flex-wrap gap-1 pt-1">
                    {inProg > 0 && <span className="text-[10px] font-bold bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded">{inProg} in prog</span>}
                    {rework > 0 && <span className="text-[10px] font-bold bg-red-100 text-red-700 px-1.5 py-0.5 rounded">{rework} rework</span>}
                    {done > 0 && <span className="text-[10px] font-bold bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded">{done} ✓</span>}
                  </div>
                  <div className="pt-2">
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-amber-400 to-emerald-500" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
          {sitePortfolio.length === 0 && (
            <div className="col-span-full text-center text-slate-500 text-sm py-10 bg-white border border-slate-200 rounded-2xl">
              No projects yet.
            </div>
          )}
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Escalations */}
        <section>
          <div className="text-[10px] uppercase tracking-widest text-slate-400 font-bold mb-3 flex items-center gap-2">
            <span>{t('mgrEscalations')}</span>
            {escalations.length > 0 && <span className="text-[10px] font-bold bg-red-100 text-red-700 px-1.5 py-0.5 rounded">{escalations.length}</span>}
          </div>
          <div className="bg-white border border-slate-200 rounded-2xl divide-y divide-slate-100">
            {escalations.length === 0 && (
              <div className="p-6 text-center text-xs text-slate-400">
                ✓ Nothing escalated.
              </div>
            )}
            {escalations.map((tk) => {
              const test = testForTrade(tk.trade);
              return (
                <div key={tk.id} className="p-3 flex items-center gap-3">
                  <div className="w-10 h-10 rounded shrink-0" style={{ background: test.refTint }} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-slate-900 truncate">{tk.trade} · {tk.location}</div>
                    <div className="text-[11px] text-slate-500">
                      {userMap[tk.assigneeUserId ?? ''] ?? '—'} · {sitesById.get(tk.siteId)?.label ?? '?'}
                    </div>
                  </div>
                  <span className="text-[10px] font-bold bg-red-600 text-white px-2 py-0.5 rounded">⚠ ×{tk.reworkCount}</span>
                </div>
              );
            })}
          </div>
        </section>

        {/* Activity feed */}
        <section>
          <div className="text-[10px] uppercase tracking-widest text-slate-400 font-bold mb-3">{t('mgrActivity')}</div>
          <div className="bg-white border border-slate-200 rounded-2xl divide-y divide-slate-100">
            {activity.length === 0 && (
              <div className="p-6 text-center text-xs text-slate-400">{t('mgrNoActivity')}</div>
            )}
            {activity.map((tk) => (
              <div key={tk.id} className="p-3 flex items-center gap-3">
                <StateDot state={tk.state} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-slate-900 truncate">{tk.trade} · {tk.location}</div>
                  <div className="text-[11px] text-slate-500">
                    {sitesById.get(tk.siteId)?.label ?? '?'} · <StateLabel state={tk.state} />
                  </div>
                </div>
                <div className="text-[11px] font-mono text-slate-400">{relTime(tk.updatedAt, t)}</div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

// ─── Atoms ────────────────────────────────────────────────────────────────

function KpiCard({
  label, value, accent, onClick,
}: { label: string; value: number; accent: 'indigo' | 'amber' | 'rose' | 'red'; onClick?: () => void }) {
  const accentCls = {
    indigo: 'bg-indigo-50 text-indigo-700 border-indigo-100',
    amber:  'bg-amber-50 text-amber-700 border-amber-100',
    rose:   'bg-rose-50 text-rose-700 border-rose-100',
    red:    'bg-red-50 text-red-700 border-red-100',
  }[accent];
  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className={`text-left rounded-2xl border p-4 shadow-sm ${accentCls} ${onClick ? 'cursor-pointer hover:shadow-md transition' : 'cursor-default'}`}
    >
      <div className="text-[10px] uppercase tracking-widest font-bold opacity-70">{label}</div>
      <div className="text-3xl font-extrabold mt-1">{value}</div>
    </button>
  );
}

function StatusPill({ status, t }: { status: 'on-track' | 'at-risk' | 'blocked'; t: (k: any) => string }) {
  const cls = status === 'blocked'
    ? 'bg-red-100 text-red-700 border-red-300'
    : status === 'at-risk'
      ? 'bg-amber-100 text-amber-800 border-amber-300'
      : 'bg-emerald-100 text-emerald-700 border-emerald-300';
  const label = status === 'blocked' ? t('mgrBlocked') : status === 'at-risk' ? t('mgrAtRisk') : t('mgrOnTrack');
  return <span className={`inline-block px-2 py-0.5 rounded border text-[10px] font-bold tracking-wider ${cls}`}>{label}</span>;
}

function StateDot({ state }: { state: string }) {
  const colour =
    state === 'CLOSED' || state === 'CLIENT_ACKNOWLEDGED' ? 'bg-emerald-500' :
    state === 'IN_PROGRESS' ? 'bg-amber-500' :
    state === 'REWORK' ? 'bg-red-500' :
    state === 'PROOF_SUBMITTED' || state.endsWith('_APPROVED') ? 'bg-indigo-500' :
    'bg-slate-300';
  return <span className={`inline-block w-2.5 h-2.5 rounded-full shrink-0 ${colour}`} />;
}

function StateLabel({ state }: { state: string }) {
  const label =
    state === 'CLOSED' || state === 'CLIENT_ACKNOWLEDGED' ? 'closed' :
    state === 'IN_PROGRESS' ? 'in progress' :
    state === 'REWORK' ? 'sent back' :
    state === 'PROOF_SUBMITTED' ? 'proof submitted' :
    state === 'SUPERVISOR_APPROVED' ? 'supervisor approved' :
    state === 'QUALITY_APPROVED' ? 'quality approved' :
    state === 'MANAGER_APPROVED' ? 'manager approved' :
    state === 'ASSIGNED' ? 'assigned' :
    state === 'ACCEPTED' ? 'accepted' :
    state.toLowerCase().replace(/_/g, ' ');
  return <span>{label}</span>;
}

function trade2Tint(trade: string): string {
  return testForTrade(trade).refTint;
}

function relTime(ts: string | null | undefined, t: (k: any) => string): string {
  if (!ts) return '';
  const ms = Date.now() - new Date(ts).getTime();
  if (ms < 60_000) return t('mgrJustNow');
  const m = Math.floor(ms / 60_000);
  if (m < 60) return `${m} ${t('mgrSinceMin')}`;
  const h = Math.floor(m / 60);
  return `${h}${t('mgrSinceHr')}`;
}
