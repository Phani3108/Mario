'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../../lib/api';
import { useT, localizedRole } from '../../lib/i18n';
import { testForTrade } from './quality-tests';

/**
 * Accounts dashboard — the persona who owns money-in / money-out and
 * payroll. Hyderabad-realistic numbers derived deterministically from the
 * seeded contracts + cost-rates + employee headcount.
 *
 * Sections:
 *  1. Four KPI tiles: Payroll this month · Headcount on payroll · On site
 *     today · Average daily cost.
 *  2. Employee roll-up table: name · role · site · hours · rate/hr · total
 *     · status (paid/due/hold).
 *  3. Cost-rates editor: per-role hourly rate, with Save.
 *  4. Per-site burn: each site's contract value, spent, days remaining,
 *     burn-per-day.
 *  5. Quick actions: ⬇ Export payroll CSV (calls /finance/payroll-csv) +
 *     + New person.
 *
 * Read sources: /users, /finance/rates, /finance/contracts, /sites,
 * /tasks (for the per-site spent estimate). Hours per employee are derived
 * synthetically from role + 22 working days/month (workers 180h, supervisors
 * 200h, etc.) so the demo numbers are believable.
 */

interface UserRow { id: string; name: string; role: string; siteId: string | null; active?: boolean }
interface Rate { id?: string; role: string; hourlyRate: number; currency: string }
interface Contract { id: string; siteId: string; clientName: string; totalValue: number; currency: string; startDate?: string; endDate?: string }
interface SiteLite { id: string; label: string; active: boolean }

const ROLE_MONTHLY_HOURS: Record<string, number> = {
  employee: 200, supervisor: 220, quality: 180, manager: 200, ceo: 180, accounts: 180, client: 0,
};

export interface AccountsViewProps {
  headers: () => HeadersInit;
  sites: SiteLite[];
  onOpenNewTask?: () => void;
  onOpenNewSite?: () => void;
}

export function AccountsView({ headers, sites, onOpenNewTask, onOpenNewSite }: AccountsViewProps) {
  const t = useT();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [rates, setRates] = useState<Rate[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [tasksAll, setTasksAll] = useState<any[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [uRes, rRes, cRes, tRes] = await Promise.all([
          apiFetch(`/users`,             { headers: headers() }),
          apiFetch(`/finance/rates`,     { headers: headers() }),
          apiFetch(`/finance/contracts`, { headers: headers() }),
          apiFetch(`/tasks`,             { headers: headers() }),
        ]);
        const uj = await uRes.json().catch(() => []);
        const rj = await rRes.json().catch(() => []);
        const cj = await cRes.json().catch(() => []);
        const tj = await tRes.json().catch(() => []);
        setUsers(Array.isArray(uj) ? uj : []);
        setRates(Array.isArray(rj) ? rj : []);
        setContracts(Array.isArray(cj) ? cj : []);
        setTasksAll(Array.isArray(tj) ? tj : []);
      } catch (e: any) {
        setErr(e?.message ?? 'failed to load accounts data');
      }
    })();
  }, [headers]);

  const rateByRole = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rates) m.set(r.role, r.hourlyRate);
    return m;
  }, [rates]);

  const sitesById = useMemo(() => new Map(sites.map((s) => [s.id, s.label])), [sites]);

  // ── Per-employee monthly roll-up ───────────────────────────────────────
  const payrollRows = useMemo(() => {
    return users
      .filter((u) => u.active !== false && u.role !== 'client')
      .map((u, idx) => {
        const hours = ROLE_MONTHLY_HOURS[u.role] ?? 180;
        const rate = rateByRole.get(u.role) ?? 0;
        const total = hours * rate;
        // Deterministic status spread — every 4th row "due", every 7th "on hold".
        const status: 'paid' | 'due' | 'hold' = idx % 7 === 6 ? 'hold' : idx % 4 === 3 ? 'due' : 'paid';
        return { ...u, hours, rate, total, status };
      })
      .sort((a, b) => b.total - a.total);
  }, [users, rateByRole]);

  const kpi = useMemo(() => {
    const payroll = payrollRows.reduce((acc, r) => acc + r.total, 0);
    const headcount = payrollRows.length;
    const onSiteToday = users.filter((u) => u.siteId && (u.role === 'employee' || u.role === 'supervisor')).length;
    const avgDaily = headcount === 0 ? 0 : Math.round(payroll / 22);
    return { payroll, headcount, onSiteToday, avgDaily };
  }, [payrollRows, users]);

  // ── Per-site burn ──────────────────────────────────────────────────────
  const siteBurnRows = useMemo(() => {
    return sites.map((s) => {
      const c = contracts.find((x) => x.siteId === s.id);
      const contractValue = c?.totalValue ?? 0;
      const tasksHere = tasksAll.filter((t: any) => t.siteId === s.id);
      const done = tasksHere.filter((t: any) => t.state === 'CLOSED' || t.state === 'CLIENT_ACKNOWLEDGED').length;
      const inProg = tasksHere.filter((t: any) => t.state === 'IN_PROGRESS').length;
      const progress = tasksHere.length === 0 ? 0 : (done + 0.5 * inProg) / tasksHere.length;
      const spent = Math.round(contractValue * 0.88 * progress);
      // burn-per-day: roughly spent / days-since-start; default 90 if missing.
      const days = c?.startDate ? Math.max(1, Math.round((Date.now() - new Date(c.startDate).getTime()) / 86_400_000)) : 90;
      const burnPerDay = Math.round(spent / days);
      return { site: s, contractValue, spent, days, burnPerDay };
    });
  }, [sites, contracts, tasksAll]);

  // ── Cost-rates editor ──────────────────────────────────────────────────
  const [draftRates, setDraftRates] = useState<Record<string, number>>({});
  useEffect(() => {
    setDraftRates(Object.fromEntries(rates.map((r) => [r.role, r.hourlyRate])));
  }, [rates]);

  const saveRates = useCallback(async () => {
    setSavedMsg(null); setErr(null);
    try {
      for (const r of rates) {
        const next = draftRates[r.role];
        if (next != null && next !== r.hourlyRate) {
          await apiFetch(`/finance/rates`, {
            method: 'POST', headers: headers(),
            body: JSON.stringify({ role: r.role, hourlyRate: next, currency: r.currency ?? 'INR' }),
          });
        }
      }
      setSavedMsg(t('acctRateSaved'));
      // Reload local rates so the table re-computes totals.
      setRates((cur) => cur.map((r) => ({ ...r, hourlyRate: draftRates[r.role] ?? r.hourlyRate })));
    } catch (e: any) {
      setErr(e?.message ?? 'rate save failed');
    }
  }, [draftRates, rates, headers, t]);

  // ── CSV export ─────────────────────────────────────────────────────────
  const exportCsv = useCallback(async () => {
    setExporting(true); setErr(null);
    try {
      const now = new Date();
      const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
      const to = now.toISOString().slice(0, 10);
      const res = await apiFetch(`/finance/payroll-csv?from=${from}&to=${to}`, { headers: headers() });
      let csv: string;
      if (res.ok) {
        // Real or demo response — try as text, fall back to client-side CSV.
        try {
          csv = await res.text();
          if (!csv || csv.length < 10) throw new Error('empty');
        } catch {
          csv = buildLocalCsv(payrollRows, t);
        }
      } else {
        csv = buildLocalCsv(payrollRows, t);
      }
      // Trigger a download.
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `payroll-${from}_${to}.csv`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      setErr(e?.message ?? 'CSV export failed');
    } finally {
      setExporting(false);
    }
  }, [payrollRows, headers, t]);

  return (
    <div className="p-4 sm:p-6 space-y-6 sf-fade-up pb-20">
      {/* Title */}
      <div className="flex items-baseline gap-3 flex-wrap">
        <div>
          <div className="text-[10px] uppercase tracking-[0.25em] text-amber-600 font-bold">{t('roleAccounts')}</div>
          <h1 className="text-2xl font-extrabold text-slate-900">{t('acctTitle')}</h1>
          <div className="text-xs text-slate-500">{t('acctSubtitle')}</div>
        </div>
        <div className="ml-auto flex items-center gap-2 flex-wrap">
          <button
            onClick={exportCsv}
            disabled={exporting}
            className="px-3 py-1.5 rounded-md bg-slate-900 text-white font-bold text-xs hover:bg-slate-800 disabled:opacity-50"
          >{exporting ? t('loading') : t('acctExportCsv')}</button>
          {onOpenNewTask && (
            <button onClick={onOpenNewTask} className="px-3 py-1.5 rounded-md bg-amber-500 text-slate-900 font-bold text-xs hover:bg-amber-400">
              {t('newTask')}
            </button>
          )}
        </div>
      </div>

      {err && <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{err}</div>}
      {savedMsg && <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-sm text-emerald-700">{savedMsg}</div>}

      {/* KPI tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label={t('acctKpiPayroll')}     value={inr(kpi.payroll, t)}  accent="indigo" />
        <Kpi label={t('acctKpiHeadcount')}   value={String(kpi.headcount)} accent="amber" />
        <Kpi label={t('acctKpiOnSiteToday')} value={String(kpi.onSiteToday)} accent="emerald" />
        <Kpi label={t('acctKpiAvgDay')}      value={inr(kpi.avgDaily, t)}  accent="rose" />
      </div>

      {/* Employee roll-up + Rates editor */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <section className="lg:col-span-2">
          <div className="text-[10px] uppercase tracking-widest text-slate-400 font-bold mb-3">{t('acctEmployeeTable')}</div>
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-500 text-[10px] uppercase tracking-wider">
                  <tr>
                    <Th>{t('acctColEmployee')}</Th>
                    <Th>{t('acctColRole')}</Th>
                    <Th>{t('acctColSite')}</Th>
                    <Th className="text-right">{t('acctColHours')}</Th>
                    <Th className="text-right">{t('acctColRate')}</Th>
                    <Th className="text-right">{t('acctColTotal')}</Th>
                    <Th className="text-center">{t('acctColStatus')}</Th>
                  </tr>
                </thead>
                <tbody>
                  {payrollRows.length === 0 && (
                    <tr><td colSpan={7} className="p-8 text-center text-slate-400 text-sm">{t('acctNoEmployees')}</td></tr>
                  )}
                  {payrollRows.map((r) => (
                    <tr key={r.id} className="border-t border-slate-100 hover:bg-slate-50/60">
                      <td className="p-3 font-semibold text-slate-900">{r.name}</td>
                      <td className="p-3 text-slate-700">{localizedRole(r.role)}</td>
                      <td className="p-3 text-slate-600 truncate max-w-[180px]">{r.siteId ? (sitesById.get(r.siteId) ?? '—') : <span className="text-slate-400">org-wide</span>}</td>
                      <td className="p-3 text-right font-mono">{r.hours}h</td>
                      <td className="p-3 text-right font-mono">₹{r.rate.toLocaleString('en-IN')}</td>
                      <td className="p-3 text-right font-mono font-bold text-slate-900">{inr(r.total, t)}</td>
                      <td className="p-3 text-center"><StatusPill status={r.status} t={t} /></td>
                    </tr>
                  ))}
                </tbody>
                {payrollRows.length > 0 && (
                  <tfoot>
                    <tr className="bg-slate-50 border-t-2 border-slate-200">
                      <td className="p-3 font-bold text-slate-900" colSpan={3}>Total</td>
                      <td className="p-3 text-right font-mono font-extrabold text-slate-900">
                        {payrollRows.reduce((a, r) => a + r.hours, 0)}h
                      </td>
                      <td className="p-3" />
                      <td className="p-3 text-right font-mono font-extrabold text-slate-900">{inr(kpi.payroll, t)}</td>
                      <td className="p-3" />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        </section>

        <section>
          <div className="text-[10px] uppercase tracking-widest text-slate-400 font-bold mb-3">{t('acctRatesTitle')}</div>
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-3">
            <div className="text-xs text-slate-500">{t('acctRatesSub')}</div>
            {rates.length === 0 && <div className="text-xs text-slate-400">No rates loaded.</div>}
            {rates.map((r) => (
              <label key={r.role} className="flex items-center gap-3">
                <span className="text-sm font-semibold text-slate-700 w-28 capitalize">{localizedRole(r.role)}</span>
                <span className="text-slate-400">₹</span>
                <input
                  type="number"
                  min={0}
                  step={5}
                  value={draftRates[r.role] ?? r.hourlyRate}
                  onChange={(e) => setDraftRates((cur) => ({ ...cur, [r.role]: Number(e.target.value) }))}
                  className="flex-1 px-3 py-1.5 rounded-md border border-slate-200 text-sm font-mono text-right"
                />
                <span className="text-xs text-slate-400">/ hr</span>
              </label>
            ))}
            <button
              onClick={saveRates}
              disabled={rates.length === 0}
              className="w-full mt-2 py-2 rounded-md bg-slate-900 text-white font-bold text-sm hover:bg-slate-800 disabled:opacity-50"
            >{t('acctSaveRates')}</button>
          </div>
        </section>
      </div>

      {/* Per-site burn */}
      <section>
        <div className="text-[10px] uppercase tracking-widest text-slate-400 font-bold mb-3">{t('acctSiteBurn')}</div>
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-[10px] uppercase tracking-wider">
                <tr>
                  <Th>{t('ceoColProject')}</Th>
                  <Th className="text-right">{t('ceoColContract')}</Th>
                  <Th className="text-right">{t('ceoColSpent')}</Th>
                  <Th className="text-right">{t('acctColBurnRate')}</Th>
                  <Th className="text-right">{t('ceoColRemaining')}</Th>
                </tr>
              </thead>
              <tbody>
                {siteBurnRows.length === 0 && (
                  <tr><td colSpan={5} className="p-8 text-center text-slate-400 text-sm">No projects yet.</td></tr>
                )}
                {siteBurnRows.map((r) => {
                  const sample = tasksAll.find((x: any) => x.siteId === r.site.id);
                  const tint = sample ? testForTrade(sample.trade).refTint : 'linear-gradient(135deg, #64748b, #1e293b)';
                  return (
                    <tr key={r.site.id} className="border-t border-slate-100 hover:bg-slate-50/60">
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded shrink-0" style={{ background: tint }} />
                          <div className="font-semibold text-slate-900 truncate">{r.site.label}</div>
                        </div>
                      </td>
                      <td className="p-3 text-right font-mono font-bold">{inr(r.contractValue, t)}</td>
                      <td className="p-3 text-right font-mono">{inr(r.spent, t)}</td>
                      <td className="p-3 text-right font-mono text-amber-700">{inr(r.burnPerDay, t)}</td>
                      <td className="p-3 text-right font-mono text-emerald-700">{inr(Math.max(0, r.contractValue - r.spent), t)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}

// ─── atoms ────────────────────────────────────────────────────────────────

function Kpi({ label, value, accent }: { label: string; value: string; accent: 'indigo' | 'amber' | 'rose' | 'emerald' }) {
  const cls = {
    indigo:  'bg-indigo-50 text-indigo-700 border-indigo-100',
    amber:   'bg-amber-50 text-amber-700 border-amber-100',
    rose:    'bg-rose-50 text-rose-700 border-rose-100',
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  }[accent];
  return (
    <div className={`rounded-2xl border p-4 shadow-sm ${cls}`}>
      <div className="text-[10px] uppercase tracking-widest font-bold opacity-70">{label}</div>
      <div className="text-2xl font-extrabold mt-1 leading-tight">{value}</div>
    </div>
  );
}

function Th({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <th className={`text-left p-3 text-[10px] uppercase tracking-wider ${className}`}>{children}</th>;
}

function StatusPill({ status, t }: { status: 'paid' | 'due' | 'hold'; t: (k: any) => string }) {
  const cls = status === 'paid'
    ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
    : status === 'due'
      ? 'bg-amber-100 text-amber-800 border-amber-200'
      : 'bg-red-100 text-red-700 border-red-200';
  const label = status === 'paid' ? t('acctStatusPaid') : status === 'due' ? t('acctStatusDue') : t('acctStatusHold');
  return <span className={`inline-block px-2 py-0.5 rounded border text-[10px] font-bold tracking-wider ${cls}`}>{label}</span>;
}

function inr(amount: number, t: (k: any) => string): string {
  if (amount >= 1_00_00_000) return `₹${(amount / 1_00_00_000).toFixed(amount >= 10_00_00_000 ? 0 : 1)} ${t('ceoCr')}`;
  if (amount >= 1_00_000)    return `₹${(amount / 1_00_000).toFixed(amount >= 10_00_000 ? 0 : 1)} ${t('ceoLakh')}`;
  return `₹${amount.toLocaleString('en-IN')}`;
}

function buildLocalCsv(rows: { name: string; role: string; hours: number; rate: number; total: number; status: string; siteId: string | null }[], _t: (k: any) => string): string {
  const header = 'employee,role,site_id,hours,rate_per_hour_inr,total_inr,status';
  const body = rows.map((r) => [
    safeCsv(r.name),
    safeCsv(r.role),
    safeCsv(r.siteId ?? ''),
    r.hours,
    r.rate,
    r.total,
    safeCsv(r.status),
  ].join(',')).join('\n');
  return `${header}\n${body}\n`;
}
function safeCsv(s: string): string {
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}
