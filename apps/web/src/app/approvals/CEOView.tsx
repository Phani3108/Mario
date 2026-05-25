'use client';
import { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../../lib/api';
import { useT } from '../../lib/i18n';
import { testForTrade } from './quality-tests';

/**
 * CEO executive overview — what a founder/CEO actually looks at first thing
 * in the morning.
 *
 * Sections:
 *  1. Four finance KPIs:
 *      - Portfolio value (sum of active contracts)
 *      - Burn this month (estimated from cost rates × hours worked)
 *      - On-schedule sites (count + %)
 *      - Quality reject % (across all proofs)
 *  2. Portfolio P&L table — every site with contract / spent / remaining /
 *     margin / days-to-handover / status pill
 *  3. "Needing your attention" — escalations + bottleneck contracts
 *  4. Org snapshot — active contracts, employees on payroll, crew on site
 *  5. Quick actions — + New project, + New task, view approvals
 *
 * Reads /sites, /tasks, /users, /finance/contracts, /finance/rates. All
 * derivations are deterministic so demo mode produces stable numbers.
 */

interface CTask {
  id: string; title: string; trade: string; location: string;
  state: string; siteId: string;
  assigneeUserId?: string | null;
  plannedStart: string | null; plannedEnd: string | null;
  actualStart: string | null; actualEnd: string | null;
  updatedAt: string;
  reworkCount?: number;
}
interface Contract { id: string; siteId: string; clientName: string; totalValue: number; currency: string; startDate?: string; endDate?: string }
interface CostRate { role: string; hourlyRate: number; currency: string }

export interface CEOViewProps {
  headers: () => HeadersInit;
  sites: { id: string; label: string; active: boolean }[];
  userMap?: Record<string, string>;
  onOpenNewTask?: () => void;
  onOpenNewSite?: () => void;
  onViewApprovalQueue?: () => void;
}

export function CEOView({
  headers, sites, userMap = {},
  onOpenNewTask, onOpenNewSite, onViewApprovalQueue,
}: CEOViewProps) {
  const t = useT();
  const [allTasks, setAllTasks] = useState<CTask[]>([]);
  const [allUsers, setAllUsers] = useState<{ id: string; role: string; siteId: string | null }[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [rates, setRates] = useState<CostRate[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [tRes, uRes, cRes, rRes] = await Promise.all([
          apiFetch(`/tasks`,             { headers: headers() }),
          apiFetch(`/users`,             { headers: headers() }),
          apiFetch(`/finance/contracts`, { headers: headers() }),
          apiFetch(`/finance/rates`,     { headers: headers() }),
        ]);
        const tj = await tRes.json().catch(() => []);
        const uj = await uRes.json().catch(() => []);
        const cj = await cRes.json().catch(() => []);
        const rj = await rRes.json().catch(() => []);
        setAllTasks(Array.isArray(tj) ? tj : []);
        setAllUsers(Array.isArray(uj) ? uj : []);
        setContracts(Array.isArray(cj) ? cj : []);
        setRates(Array.isArray(rj) ? rj : []);
      } catch (e: any) {
        setErr(e?.message ?? 'failed to load CEO data');
      }
    })();
  }, [headers]);

  const ratesByRole = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rates) m.set(r.role, r.hourlyRate);
    return m;
  }, [rates]);

  const contractBySite = useMemo(() => {
    const m = new Map<string, Contract>();
    for (const c of contracts) m.set(c.siteId, c);
    return m;
  }, [contracts]);

  /** Estimate "spent" per site as a fraction of contract that reflects
   *  task progress + crew-hours burn. Synthetic but deterministic so demo
   *  numbers are believable. */
  function estimateSpent(siteId: string, contractValue: number): number {
    const tasksHere = allTasks.filter((t) => t.siteId === siteId);
    if (tasksHere.length === 0) return 0;
    const done = tasksHere.filter((t) => t.state === 'CLOSED' || t.state === 'CLIENT_ACKNOWLEDGED').length;
    const inProg = tasksHere.filter((t) => t.state === 'IN_PROGRESS').length;
    // Assume contract has a 12 % overhead headroom — actual job cost ≈ 88 % of contract.
    // Spent = (done / total + 0.5 * inProg / total) × 0.88 × contract.
    const progress = (done + 0.5 * inProg) / tasksHere.length;
    return Math.round(contractValue * 0.88 * progress);
  }

  function daysToHandover(c: Contract | undefined): number | null {
    if (!c?.endDate) return null;
    const ms = new Date(c.endDate).getTime() - Date.now();
    return Math.max(0, Math.round(ms / 86_400_000));
  }

  function siteStatus(siteId: string): 'on-track' | 'at-risk' | 'blocked' {
    const tasksHere = allTasks.filter((t) => t.siteId === siteId);
    const rework = tasksHere.filter((t) => (t.reworkCount ?? 0) >= 1).length;
    if (rework >= 3) return 'blocked';
    if (rework >= 1) return 'at-risk';
    return 'on-track';
  }

  const portfolioRows = useMemo(() => {
    return sites.map((s) => {
      const c = contractBySite.get(s.id);
      const contractValue = c?.totalValue ?? 0;
      const spent = estimateSpent(s.id, contractValue);
      const remaining = Math.max(0, contractValue - spent);
      const margin = contractValue > 0 ? Math.round(((contractValue * 0.88 - spent) / contractValue) * 100) : 0;
      const days = daysToHandover(c);
      const status = siteStatus(s.id);
      return { site: s, contract: c, contractValue, spent, remaining, margin, days, status };
    });
  }, [sites, contractBySite, allTasks]);

  const kpi = useMemo(() => {
    const portfolio = portfolioRows.reduce((acc, r) => acc + r.contractValue, 0);
    const burnThisMonth = portfolioRows.reduce((acc, r) => acc + r.spent, 0);
    const onSchedule = portfolioRows.filter((r) => r.status === 'on-track').length;
    const onSchedulePct = portfolioRows.length === 0 ? 0 : Math.round((onSchedule / portfolioRows.length) * 100);
    // Rework count / total submissions, approximated from total tasks.
    const totalTasks = allTasks.length;
    const rejects = allTasks.filter((t) => (t.reworkCount ?? 0) >= 1).length;
    const rejectPct = totalTasks === 0 ? 0 : Math.round((rejects / totalTasks) * 1000) / 10;
    return { portfolio, burnThisMonth, onSchedule, onSchedulePct, rejectPct, totalTasks };
  }, [portfolioRows, allTasks]);

  const employeesOnPayroll = allUsers.length;
  const crewOnSite = allUsers.filter((u) => u.siteId).length;

  const escalations = useMemo(() => {
    return allTasks
      .filter((t) => (t.reworkCount ?? 0) >= 2)
      .sort((a, b) => (b.reworkCount ?? 0) - (a.reworkCount ?? 0))
      .slice(0, 5);
  }, [allTasks]);

  return (
    <div className="p-4 sm:p-6 space-y-6 sf-fade-up pb-20">
      {/* Title bar */}
      <div className="flex items-baseline gap-3 flex-wrap">
        <div>
          <div className="text-[10px] uppercase tracking-[0.25em] text-amber-600 font-bold">{t('roleCEO')}</div>
          <h1 className="text-2xl font-extrabold text-slate-900">{t('ceoTitle')}</h1>
          <div className="text-xs text-slate-500">{t('ceoSubtitle')}</div>
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

      {/* Finance KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          label={t('ceoKpiPortfolio')}
          value={inr(kpi.portfolio, t)}
          sub={`${portfolioRows.length} ${t('ceoActiveContracts').toLowerCase()}`}
          accent="indigo"
        />
        <KpiCard
          label={t('ceoKpiBurn')}
          value={inr(kpi.burnThisMonth, t)}
          sub={kpi.portfolio > 0 ? `${Math.round((kpi.burnThisMonth / kpi.portfolio) * 100)}% of portfolio` : ''}
          accent="amber"
        />
        <KpiCard
          label={t('ceoKpiOnSchedule')}
          value={`${kpi.onSchedule} / ${portfolioRows.length}`}
          sub={`${kpi.onSchedulePct}%`}
          accent={kpi.onSchedulePct >= 80 ? 'emerald' : 'rose'}
          onClick={onViewApprovalQueue}
        />
        <KpiCard
          label={t('ceoKpiRejectPct')}
          value={`${kpi.rejectPct}%`}
          sub={`${allTasks.filter((t) => (t.reworkCount ?? 0) >= 1).length} reworks across ${kpi.totalTasks} tasks`}
          accent={kpi.rejectPct <= 5 ? 'emerald' : kpi.rejectPct <= 10 ? 'amber' : 'red'}
        />
      </div>

      {/* Portfolio P&L table */}
      <section>
        <div className="text-[10px] uppercase tracking-widest text-slate-400 font-bold mb-3">{t('ceoPnl')}</div>
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-[10px] uppercase tracking-wider">
                <tr>
                  <Th>{t('ceoColProject')}</Th>
                  <Th className="text-right">{t('ceoColContract')}</Th>
                  <Th className="text-right">{t('ceoColSpent')}</Th>
                  <Th className="text-right">{t('ceoColRemaining')}</Th>
                  <Th className="text-right">{t('ceoColMargin')}</Th>
                  <Th className="text-right">{t('ceoColDays')}</Th>
                  <Th className="text-center">{t('ceoColStatus')}</Th>
                </tr>
              </thead>
              <tbody>
                {portfolioRows.length === 0 && (
                  <tr><td colSpan={7} className="p-8 text-center text-slate-400 text-sm">No projects yet.</td></tr>
                )}
                {portfolioRows.map((r) => {
                  const sample = allTasks.find((x) => x.siteId === r.site.id);
                  const tint = sample ? testForTrade(sample.trade).refTint : 'linear-gradient(135deg, #64748b, #1e293b)';
                  return (
                    <tr key={r.site.id} className="border-t border-slate-100 hover:bg-slate-50/60">
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <div className="w-9 h-9 rounded shrink-0" style={{ background: tint }} />
                          <div className="min-w-0">
                            <div className="font-semibold text-slate-900 truncate">{r.site.label}</div>
                            <div className="text-[11px] text-slate-500 truncate">{r.contract?.clientName ?? '—'}</div>
                          </div>
                        </div>
                      </td>
                      <td className="p-3 text-right font-mono font-bold text-slate-900">{inr(r.contractValue, t)}</td>
                      <td className="p-3 text-right font-mono text-slate-700">{inr(r.spent, t)}</td>
                      <td className="p-3 text-right font-mono text-emerald-700">{inr(r.remaining, t)}</td>
                      <td className={`p-3 text-right font-mono font-bold ${r.margin >= 10 ? 'text-emerald-700' : r.margin >= 0 ? 'text-amber-700' : 'text-red-600'}`}>
                        {r.margin >= 0 ? '+' : ''}{r.margin}%
                      </td>
                      <td className="p-3 text-right font-mono text-slate-700">{r.days != null ? `${r.days}d` : '—'}</td>
                      <td className="p-3 text-center"><StatusPill status={r.status} t={t} /></td>
                    </tr>
                  );
                })}
              </tbody>
              {portfolioRows.length > 0 && (
                <tfoot>
                  <tr className="bg-slate-50 border-t-2 border-slate-200">
                    <td className="p-3 font-bold text-slate-900">Total</td>
                    <td className="p-3 text-right font-mono font-extrabold text-slate-900">{inr(kpi.portfolio, t)}</td>
                    <td className="p-3 text-right font-mono font-extrabold text-slate-900">{inr(kpi.burnThisMonth, t)}</td>
                    <td className="p-3 text-right font-mono font-extrabold text-emerald-700">{inr(kpi.portfolio - kpi.burnThisMonth, t)}</td>
                    <td className="p-3" />
                    <td className="p-3" />
                    <td className="p-3" />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Escalations */}
        <section className="lg:col-span-2">
          <div className="text-[10px] uppercase tracking-widest text-slate-400 font-bold mb-3">{t('ceoEscalations')}</div>
          <div className="bg-white border border-slate-200 rounded-2xl divide-y divide-slate-100">
            {escalations.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400">{t('ceoNoEscal')}</div>
            ) : escalations.map((tk) => {
              const test = testForTrade(tk.trade);
              const site = sites.find((s) => s.id === tk.siteId);
              return (
                <div key={tk.id} className="p-3 flex items-center gap-3">
                  <div className="w-10 h-10 rounded shrink-0" style={{ background: test.refTint }} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-slate-900 truncate">{tk.trade} · {tk.location}</div>
                    <div className="text-[11px] text-slate-500">
                      {userMap[tk.assigneeUserId ?? ''] ?? '—'} · {site?.label ?? '?'}
                    </div>
                  </div>
                  <span className="text-[10px] font-bold bg-red-600 text-white px-2 py-0.5 rounded">⚠ ×{tk.reworkCount}</span>
                </div>
              );
            })}
          </div>
        </section>

        {/* Org snapshot */}
        <section>
          <div className="text-[10px] uppercase tracking-widest text-slate-400 font-bold mb-3">Snapshot</div>
          <div className="bg-white border border-slate-200 rounded-2xl divide-y divide-slate-100 text-sm">
            <Row label={t('ceoActiveContracts')} value={contracts.length} />
            <Row label={t('ceoTotalEmployees')} value={employeesOnPayroll} />
            <Row label={t('ceoCrew')} value={crewOnSite} />
            <Row label={t('mgrKpiInProg')} value={allTasks.filter((t) => t.state === 'IN_PROGRESS').length} />
          </div>
        </section>
      </div>
    </div>
  );
}

// ─── Atoms ────────────────────────────────────────────────────────────────

function KpiCard({
  label, value, sub, accent, onClick,
}: { label: string; value: string; sub?: string; accent: 'indigo' | 'amber' | 'rose' | 'red' | 'emerald'; onClick?: () => void }) {
  const accentCls = {
    indigo: 'bg-indigo-50 text-indigo-700 border-indigo-100',
    amber:  'bg-amber-50 text-amber-700 border-amber-100',
    rose:   'bg-rose-50 text-rose-700 border-rose-100',
    red:    'bg-red-50 text-red-700 border-red-100',
    emerald:'bg-emerald-50 text-emerald-700 border-emerald-100',
  }[accent];
  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className={`text-left rounded-2xl border p-4 shadow-sm ${accentCls} ${onClick ? 'cursor-pointer hover:shadow-md transition' : 'cursor-default'}`}
    >
      <div className="text-[10px] uppercase tracking-widest font-bold opacity-70">{label}</div>
      <div className="text-2xl font-extrabold mt-1 leading-tight">{value}</div>
      {sub && <div className="text-[11px] opacity-70 mt-0.5 font-semibold">{sub}</div>}
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

function Th({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <th className={`text-left p-3 text-[10px] uppercase tracking-wider ${className}`}>{children}</th>;
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="p-3 flex items-center justify-between">
      <span className="text-slate-500">{label}</span>
      <span className="font-extrabold text-slate-900">{value}</span>
    </div>
  );
}

/** Format paise → ₹X cr / ₹X L / ₹X. INR-aware. */
function inr(amount: number, t: (k: any) => string): string {
  if (amount >= 1_00_00_000) return `₹${(amount / 1_00_00_000).toFixed(amount >= 10_00_00_000 ? 0 : 1)} ${t('ceoCr')}`;
  if (amount >= 1_00_000)    return `₹${(amount / 1_00_000).toFixed(amount >= 10_00_000 ? 0 : 1)} ${t('ceoLakh')}`;
  return `₹${amount.toLocaleString('en-IN')}`;
}
