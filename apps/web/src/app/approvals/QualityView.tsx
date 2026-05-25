'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { apiFetch } from '../../lib/api';
import { useT } from '../../lib/i18n';
import { testForTrade, riskFor, type QualityTestDetail } from './quality-tests';

/**
 * Quality-role dashboard. Mockup #5 / #7 (light + dark + Hindi variants).
 *
 *   left sidebar (parent)  |  center: approval-queue table  |  right: SOP REFERENCE
 *
 * Quality-specific affordances:
 *  - Per-row SOP TEST + RISK + DUR + VS EST columns
 *  - Click any row to load its SOP reference into the right side panel
 *  - Keyboard: ⇧A approve / ⇧R reject / J/K move row focus
 *  - Bulk action footer when ≥1 selected
 *  - "Risk: any" + "Submitted: today" filter pills (top-right)
 */

export interface QTask {
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
  assigneeUserId?: string | null;
  referenceImageUrl?: string | null;
  reworkCount?: number;
}

export interface QualityViewProps {
  /** Headers builder from parent (carries Authorization). */
  headers: () => HeadersInit;
  /** Initial pending list — same source as the generic approvals queue. */
  initialTasks: QTask[];
  /** Map of userId → display name for the WORKER column. Optional. */
  userMap?: Record<string, string>;
  /** Refresh after action so the parent's counters update too. */
  onChanged: () => void;
  /** Summon the page-level NewTaskModal — every role except client can. */
  onOpenNewTask?: () => void;
}

const RISK_RANK: Record<'LOW' | 'MED' | 'HIGH', number> = { LOW: 0, MED: 1, HIGH: 2 };

export function QualityView({ headers, initialTasks, userMap = {}, onChanged, onOpenNewTask }: QualityViewProps) {
  const t = useT();
  const [rows, setRows] = useState<QTask[]>(initialTasks);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [focusIdx, setFocusIdx] = useState(0);
  const [riskFilter, setRiskFilter] = useState<'any' | 'LOW' | 'MED' | 'HIGH'>('any');
  const [todayOnly, setTodayOnly] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const tableRef = useRef<HTMLTableElement>(null);

  useEffect(() => { setRows(initialTasks); }, [initialTasks]);

  // Trade chip counts from the unfiltered set.
  const tradeCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rows) m.set(r.trade, (m.get(r.trade) ?? 0) + 1);
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
  }, [rows]);
  const [tradeFilter, setTradeFilter] = useState<string>('all');

  const visible = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    return rows.filter((r) => {
      if (tradeFilter !== 'all' && r.trade !== tradeFilter) return false;
      if (riskFilter !== 'any' && riskFor(r) !== riskFilter) return false;
      if (todayOnly && (!r.updatedAt || new Date(r.updatedAt) < today)) return false;
      return true;
    });
  }, [rows, tradeFilter, riskFilter, todayOnly]);

  // Clamp focus to visible range.
  useEffect(() => {
    if (focusIdx >= visible.length) setFocusIdx(Math.max(0, visible.length - 1));
  }, [visible.length, focusIdx]);

  const focused = visible[focusIdx] ?? null;
  const focusedTest = useMemo<QualityTestDetail | null>(
    () => focused ? testForTrade(focused.trade) : null,
    [focused],
  );

  const act = useCallback(async (taskIds: string[], kind: 'approve' | 'reject', reason?: string) => {
    setBusy(taskIds.join(',')); setErr(null);
    try {
      for (const id of taskIds) {
        const body = kind === 'approve' ? { taskId: id } : { taskId: id, reason: reason ?? 'no reason given' };
        const res = await apiFetch(`/approvals/${kind}`, {
          method: 'POST', headers: headers(), body: JSON.stringify(body),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error((data as any).error ?? `failed (${res.status})`);
        }
      }
      setRows((cur) => cur.filter((r) => !taskIds.includes(r.id)));
      setSelected((s) => { const n = new Set(s); taskIds.forEach((id) => n.delete(id)); return n; });
      onChanged();
    } catch (e: any) {
      setErr(e?.message ?? 'failed');
    } finally {
      setBusy(null);
    }
  }, [headers, onChanged]);

  // Keyboard shortcuts ⇧A / ⇧R / J / K (ignored while typing in inputs).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === 'j' || e.key === 'ArrowDown') { setFocusIdx((i) => Math.min(i + 1, visible.length - 1)); e.preventDefault(); }
      else if (e.key === 'k' || e.key === 'ArrowUp') { setFocusIdx((i) => Math.max(i - 1, 0)); e.preventDefault(); }
      else if (e.shiftKey && (e.key === 'A' || e.key === 'a')) {
        const ids = selected.size > 0 ? Array.from(selected) : focused ? [focused.id] : [];
        if (ids.length > 0) { act(ids, 'approve'); e.preventDefault(); }
      } else if (e.shiftKey && (e.key === 'R' || e.key === 'r')) {
        const ids = selected.size > 0 ? Array.from(selected) : focused ? [focused.id] : [];
        if (ids.length > 0) {
          const reason = window.prompt('Reject reason?') ?? '';
          if (reason) { act(ids, 'reject', reason); }
          e.preventDefault();
        }
      } else if (e.key === ' ' || e.key === 'Enter') {
        if (focused) {
          setSelected((s) => { const n = new Set(s); n.has(focused.id) ? n.delete(focused.id) : n.add(focused.id); return n; });
          e.preventDefault();
        }
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [visible, selected, focused, act]);

  function toggle(id: string) {
    setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  return (
    <div className="flex min-h-full">
      {/* Center: table */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Header bar */}
        <div className="px-5 py-3 border-b border-slate-200 bg-white flex items-center gap-2 flex-wrap">
          <div className="text-base font-semibold text-slate-900">{t('approvalQueue')}</div>
          <span className="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-semibold">{rows.length}</span>

          {/* trade chips */}
          <button
            onClick={() => setTradeFilter('all')}
            className={`text-xs px-2.5 py-1 rounded-full border font-semibold transition ${
              tradeFilter === 'all' ? 'bg-indigo-600 text-white border-indigo-600' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >{t('filterAll')} · {rows.length}</button>
          {tradeCounts.map(([trade, n]) => (
            <button
              key={trade}
              onClick={() => setTradeFilter((cur) => cur === trade ? 'all' : trade)}
              className={`text-xs px-2.5 py-1 rounded-full border font-semibold whitespace-nowrap transition ${
                tradeFilter === trade ? 'bg-slate-900 text-white border-slate-900' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >{trade} · {n}</button>
          ))}

          {/* Filter pills (top-right) */}
          <div className="ml-auto flex items-center gap-2">
            <select
              value={riskFilter}
              onChange={(e) => setRiskFilter(e.target.value as any)}
              className="text-xs px-2.5 py-1 rounded-full border border-slate-200 bg-white text-slate-600 font-semibold"
            >
              <option value="any">{t('qRiskAny')}</option>
              <option value="LOW">{t('qRiskLow')}</option>
              <option value="MED">{t('qRiskMed')}</option>
              <option value="HIGH">{t('qRiskHigh')}</option>
            </select>
            <button
              onClick={() => setTodayOnly((b) => !b)}
              className={`text-xs px-2.5 py-1 rounded-full border font-semibold transition ${
                todayOnly ? 'bg-amber-500 text-slate-900 border-amber-500' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >{t('qSubmittedToday')}</button>
            {onOpenNewTask && (
              <button
                onClick={onOpenNewTask}
                className="text-xs px-3 py-1.5 rounded-md bg-amber-500 text-slate-900 font-bold hover:bg-amber-400 ml-1"
              >{t('newTask')}</button>
            )}
          </div>
        </div>

        {err && (
          <div className="mx-5 mt-3 p-2.5 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{err}</div>
        )}

        <div className="flex-1 overflow-auto">
          <table ref={tableRef} className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-[10px] uppercase tracking-wider sticky top-0">
              <tr>
                <th className="p-2 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={visible.length > 0 && visible.every((v) => selected.has(v.id))}
                    onChange={(e) => setSelected(e.target.checked ? new Set(visible.map((v) => v.id)) : new Set())}
                  />
                </th>
                <Th>{t('qColTask')}</Th>
                <Th>{t('qColWorker')}</Th>
                <Th>{t('qColPhoto')}</Th>
                <Th>{t('qColSopTest')}</Th>
                <Th className="w-16">{t('qColRisk')}</Th>
                <Th className="w-16">{t('qColStart')}</Th>
                <Th className="w-16">{t('qColEnd')}</Th>
                <Th className="w-16">{t('qColDur')}</Th>
                <Th className="w-16">{t('qColVsEst')}</Th>
                <th className="text-right p-2 pr-4 text-[10px] uppercase tracking-wider">{t('qColAction')}</th>
              </tr>
            </thead>
            <tbody>
              {visible.length === 0 && (
                <tr>
                  <td colSpan={11} className="p-10 text-center text-slate-400">
                    {t('nothingWaiting')}
                  </td>
                </tr>
              )}
              {visible.map((row, i) => {
                const test = testForTrade(row.trade);
                const risk = riskFor(row);
                const dur = duration(row.actualStart, row.actualEnd);
                const vsEst = vsEstimate(row);
                const isFocused = i === focusIdx;
                const isSelected = selected.has(row.id);
                return (
                  <tr
                    key={row.id}
                    onClick={() => { setFocusIdx(i); }}
                    className={`border-t border-slate-100 cursor-pointer transition ${
                      isFocused ? 'bg-indigo-50/60' : isSelected ? 'bg-amber-50/40' : 'hover:bg-slate-50'
                    }`}
                  >
                    <td className="p-2 text-center" onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" checked={isSelected} onChange={() => toggle(row.id)} />
                    </td>
                    <td className="p-2 font-semibold text-slate-900 whitespace-nowrap">
                      <div>{row.trade} · {row.location.split('-').slice(-2).join('-')}</div>
                      <div className="text-[10px] text-slate-400 font-normal">{row.title}</div>
                    </td>
                    <td className="p-2 text-slate-700 whitespace-nowrap">{userMap[row.assigneeUserId ?? ''] ?? '—'}</td>
                    <td className="p-2">
                      <div className="w-14 h-9 rounded" style={{ background: test.refTint }} />
                    </td>
                    <td className="p-2 text-slate-700 whitespace-nowrap">{test.label}</td>
                    <td className="p-2"><RiskPill risk={risk} t={t} /></td>
                    <td className="p-2 font-mono text-xs text-slate-600">{fmt(row.actualStart) || fmt(row.plannedStart)}</td>
                    <td className="p-2 font-mono text-xs text-slate-600">{fmt(row.actualEnd) || fmt(row.plannedEnd)}</td>
                    <td className="p-2 font-mono text-xs text-slate-600">{dur || '—'}</td>
                    <td className={`p-2 font-mono text-xs ${vsEst && vsEst.startsWith('+') ? 'text-red-600' : vsEst ? 'text-emerald-600' : 'text-slate-400'}`}>
                      {vsEst ?? '—'}
                    </td>
                    <td className="p-2 pr-4 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      <button
                        disabled={busy?.includes(row.id)}
                        onClick={() => act([row.id], 'approve')}
                        className="px-2 py-1 rounded bg-emerald-600 text-white font-bold text-xs disabled:opacity-50 hover:bg-emerald-700"
                      >✓</button>
                      <button
                        disabled={busy?.includes(row.id)}
                        onClick={() => {
                          const reason = window.prompt('Reject reason?') ?? '';
                          if (reason) act([row.id], 'reject', reason);
                        }}
                        className="ml-1 px-2 py-1 rounded bg-white border border-red-300 text-red-600 font-bold text-xs disabled:opacity-50 hover:bg-red-50"
                      >✗</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Bulk action footer */}
        <div className="sticky bottom-0 border-t border-slate-200 bg-white px-5 py-3 flex items-center gap-3 text-xs">
          <div className="text-slate-700">
            <b className="text-amber-700">{selected.size}</b> {t('qSelectedOf')} {visible.length}
          </div>
          <button
            disabled={selected.size === 0 || !!busy}
            onClick={() => act(Array.from(selected), 'approve')}
            className="px-3 py-1.5 rounded-md bg-emerald-600 text-white font-semibold disabled:opacity-50 hover:bg-emerald-700"
          >{t('qApproveBoth')} {selected.size > 0 ? `· ${selected.size}` : ''}</button>
          <button
            disabled={selected.size === 0 || !!busy}
            onClick={() => {
              const reason = window.prompt('Reject reason?') ?? '';
              if (reason) act(Array.from(selected), 'reject', reason);
            }}
            className="px-3 py-1.5 rounded-md bg-white border border-red-300 text-red-600 font-semibold disabled:opacity-50 hover:bg-red-50"
          >{t('qRejectReason')}</button>
          <div className="ml-auto text-[10px] text-slate-400 font-mono">{t('qShortcutHint')}</div>
        </div>
      </div>

      {/* Right: SOP REFERENCE side panel */}
      <aside className="hidden xl:flex w-[340px] shrink-0 flex-col border-l border-slate-200 bg-white">
        <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
          <div className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">{t('qSopReference')}</div>
          <button className="text-[10px] text-indigo-600 font-semibold hover:text-indigo-800">{t('qExpand')}</button>
        </div>
        {!focused || !focusedTest ? (
          <div className="p-6 text-center text-xs text-slate-400 flex-1 grid place-items-center">
            {t('qNoTaskSelected')}
          </div>
        ) : (
          <div className="p-4 overflow-y-auto">
            <div className="text-lg font-extrabold text-slate-900 leading-tight">{focusedTest.label} · {focusedTest.version}</div>
            <div className="text-xs text-slate-600 mt-2 leading-relaxed">{focusedTest.description}</div>

            {/* Reference photo placeholder */}
            <div
              className="mt-4 rounded-lg h-44 relative border border-slate-200 overflow-hidden"
              style={{ background: focusedTest.refTint }}
            >
              <div className="absolute bottom-2 right-2 text-[10px] font-bold bg-slate-900/70 text-white px-2 py-0.5 rounded">
                {t('qReferencePhoto')}
              </div>
            </div>

            <div className="mt-4">
              <div className="text-[10px] uppercase tracking-widest text-slate-400 font-bold mb-2">{t('qPassCriteria')}</div>
              <ul className="space-y-1.5 text-xs text-slate-700">
                {focusedTest.passCriteria.map((c) => (
                  <li key={c} className="flex gap-2"><span className="text-emerald-600 font-bold">✓</span><span>{c}</span></li>
                ))}
              </ul>
            </div>

            <div className="mt-4">
              <div className="text-[10px] uppercase tracking-widest text-slate-400 font-bold mb-2">{t('qCommonRejects')}</div>
              <ul className="space-y-1.5 text-xs text-slate-700">
                {focusedTest.commonRejects.map((c) => (
                  <li key={c} className="flex gap-2"><span className="text-red-600 font-bold">✗</span><span>{c}</span></li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}

function Th({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <th className={`text-left p-2 text-[10px] uppercase tracking-wider ${className}`}>{children}</th>;
}

function RiskPill({ risk, t }: { risk: 'LOW' | 'MED' | 'HIGH'; t: (k: any) => string }) {
  const cls = risk === 'HIGH'
    ? 'bg-red-100 text-red-700 border-red-200'
    : risk === 'MED'
      ? 'bg-amber-100 text-amber-800 border-amber-200'
      : 'bg-emerald-50 text-emerald-700 border-emerald-200';
  const label = risk === 'HIGH' ? t('qRiskHigh') : risk === 'MED' ? t('qRiskMed') : t('qRiskLow');
  return <span className={`inline-block px-2 py-0.5 rounded border text-[10px] font-bold tracking-wider ${cls}`}>{label}</span>;
}

function fmt(ts: string | null): string {
  if (!ts) return '';
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function duration(start: string | null, end: string | null): string {
  if (!start) return '';
  const s = new Date(start).getTime();
  const e = end ? new Date(end).getTime() : Date.now();
  const m = Math.max(0, Math.floor((e - s) / 60000));
  const h = Math.floor(m / 60);
  return h > 0 ? `${h}h ${String(m % 60).padStart(2, '0')}m` : `${m}m`;
}

/** Returns "+25m" / "-6m" / null. Positive = over estimate. */
function vsEstimate(t: { plannedStart: string | null; plannedEnd: string | null; actualStart: string | null; actualEnd: string | null }): string | null {
  if (!t.actualStart) return null;
  const plannedMs = t.plannedStart && t.plannedEnd
    ? new Date(t.plannedEnd).getTime() - new Date(t.plannedStart).getTime()
    : null;
  if (plannedMs == null || plannedMs <= 0) return null;
  const actualEndMs = t.actualEnd ? new Date(t.actualEnd).getTime() : Date.now();
  const actualMs = actualEndMs - new Date(t.actualStart).getTime();
  const diffM = Math.round((actualMs - plannedMs) / 60000);
  if (Math.abs(diffM) < 1) return '±0m';
  return diffM >= 0 ? `+${diffM}m` : `${diffM}m`;
}
