'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../../lib/api';
import { useT } from '../../lib/i18n';
import { testForTrade, riskFor } from './quality-tests';

/**
 * Supervisor approval surface. Mockup #4 (mobile-first, large photo cards).
 *
 * Single column on phones, 2-up at md, 3-up at lg+. Every card is mostly
 * photo — the supervisor is approving by sight, not by reading a table.
 *
 * Affordances:
 *  - "12 PENDING" amber chip up top
 *  - Trade filter tabs (ALL N · TILES N · PAINT N · ...) with horizontal
 *    scroll on mobile.
 *  - MED / LOW / HIGH RISK pill in the photo corner.
 *  - Big full-width APPROVE / REJECT buttons (touch-friendly).
 *  - Sticky bottom footer: "Select all · BULK APPROVE" once anything is
 *    selected.
 *  - Keyboard shortcuts (desktop): ⇧A approve focused / all selected,
 *    ⇧R reject, J/K navigate, Space select.
 */

export interface STask {
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
  reworkCount?: number;
}

export interface SupervisorViewProps {
  headers: () => HeadersInit;
  initialTasks: STask[];
  userMap?: Record<string, string>;
  onChanged: () => void;
  onOpenNewTask?: () => void;
}

export function SupervisorView({ headers, initialTasks, userMap = {}, onChanged, onOpenNewTask }: SupervisorViewProps) {
  const t = useT();
  const [rows, setRows] = useState<STask[]>(initialTasks);
  const [tradeFilter, setTradeFilter] = useState<string>('all');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [focusIdx, setFocusIdx] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => { setRows(initialTasks); }, [initialTasks]);

  const tradeCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rows) m.set(r.trade, (m.get(r.trade) ?? 0) + 1);
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
  }, [rows]);

  const visible = useMemo(() => {
    return tradeFilter === 'all' ? rows : rows.filter((r) => r.trade === tradeFilter);
  }, [rows, tradeFilter]);

  useEffect(() => {
    if (focusIdx >= visible.length) setFocusIdx(Math.max(0, visible.length - 1));
  }, [visible.length, focusIdx]);

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

  // Desktop keyboard shortcuts.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === 'j' || e.key === 'ArrowDown') { setFocusIdx((i) => Math.min(i + 1, visible.length - 1)); e.preventDefault(); }
      else if (e.key === 'k' || e.key === 'ArrowUp') { setFocusIdx((i) => Math.max(i - 1, 0)); e.preventDefault(); }
      else if (e.shiftKey && (e.key === 'A' || e.key === 'a')) {
        const ids = selected.size > 0 ? Array.from(selected) : visible[focusIdx] ? [visible[focusIdx]!.id] : [];
        if (ids.length > 0) { act(ids, 'approve'); e.preventDefault(); }
      } else if (e.shiftKey && (e.key === 'R' || e.key === 'r')) {
        const ids = selected.size > 0 ? Array.from(selected) : visible[focusIdx] ? [visible[focusIdx]!.id] : [];
        if (ids.length > 0) {
          const reason = window.prompt('Reject reason?') ?? '';
          if (reason) act(ids, 'reject', reason);
          e.preventDefault();
        }
      } else if (e.key === ' ') {
        const cur = visible[focusIdx];
        if (cur) {
          setSelected((s) => { const n = new Set(s); n.has(cur.id) ? n.delete(cur.id) : n.add(cur.id); return n; });
          e.preventDefault();
        }
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [visible, selected, focusIdx, act]);

  function toggle(id: string) {
    setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  const allChecked = visible.length > 0 && visible.every((v) => selected.has(v.id));

  return (
    <div className="flex flex-col min-h-full">
      {/* Top bar — "PENDING" chip + trade filter tabs */}
      <div className="px-4 sm:px-6 py-3 border-b border-slate-200 bg-white">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="text-base font-semibold mr-2 whitespace-nowrap">{t('approvalQueue')}</div>
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 border border-amber-200 text-xs font-bold tracking-wide">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500" />
            {rows.length} {t('supPendingChip')}
          </span>
          {onOpenNewTask && (
            <button
              onClick={onOpenNewTask}
              className="ml-auto px-3 py-1.5 rounded-md bg-amber-500 text-slate-900 font-bold text-xs hover:bg-amber-400"
            >{t('newTask')}</button>
          )}
          <span className={`text-[10px] text-slate-400 font-mono hidden md:inline ${onOpenNewTask ? '' : 'ml-auto'}`}>{t('qShortcutHint')}</span>
        </div>
        <div className="mt-3 flex items-center gap-2 overflow-x-auto no-scrollbar">
          <FilterChip active={tradeFilter === 'all'} onClick={() => setTradeFilter('all')}>
            {t('filterAll')} · {rows.length}
          </FilterChip>
          {tradeCounts.map(([trade, n]) => (
            <FilterChip
              key={trade}
              active={tradeFilter === trade}
              onClick={() => setTradeFilter((cur) => cur === trade ? 'all' : trade)}
            >
              {trade.toUpperCase()} · {n}
            </FilterChip>
          ))}
        </div>
      </div>

      {err && (
        <div className="mx-4 sm:mx-6 mt-3 p-2.5 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{err}</div>
      )}

      {/* Card grid */}
      <div className="flex-1 p-4 sm:p-6 pb-24">
        {visible.length === 0 ? (
          <div className="max-w-md mx-auto py-12 text-center">
            <div className="mx-auto w-20 h-20 rounded-2xl bg-gradient-to-br from-emerald-100 to-emerald-50 grid place-items-center text-4xl mb-4">
              ✓
            </div>
            <div className="text-slate-700 font-semibold">{t('supEmptyTitle')}</div>
            <div className="text-xs text-slate-500 mt-1">{t('supEmptySub')}</div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {visible.map((row, i) => {
              const test = testForTrade(row.trade);
              const risk = riskFor(row);
              const focused = i === focusIdx;
              const isSelected = selected.has(row.id);
              return (
                <article
                  key={row.id}
                  onClick={() => setFocusIdx(i)}
                  className={`bg-white border rounded-2xl overflow-hidden shadow-sm transition relative cursor-pointer sf-fade-up ${
                    focused ? 'border-indigo-400 ring-2 ring-indigo-100' :
                    isSelected ? 'border-amber-400 ring-2 ring-amber-100' :
                    'border-slate-200 hover:border-slate-300'
                  }`}
                  style={{ animationDelay: `${Math.min(i, 8) * 0.03}s` }}
                >
                  {/* Photo placeholder */}
                  <div className="relative h-44" style={{ background: test.refTint }}>
                    {/* Select checkbox top-left */}
                    <label
                      onClick={(e) => e.stopPropagation()}
                      className="absolute top-2 left-2 inline-flex items-center justify-center w-6 h-6 rounded bg-white/90 border border-slate-300 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggle(row.id)}
                        className="w-3.5 h-3.5"
                      />
                    </label>
                    {/* Risk badge top-right */}
                    <span className="absolute top-2 right-2">
                      <RiskBadge risk={risk} t={t} />
                    </span>
                    {/* Trade chip bottom-left */}
                    <span className="absolute bottom-2 left-2 text-[10px] font-bold bg-slate-900/70 text-amber-300 px-2 py-0.5 rounded">
                      {row.trade.toUpperCase()}
                    </span>
                    {/* Rework warning */}
                    {(row.reworkCount ?? 0) >= 1 && (
                      <span className="absolute bottom-2 right-2 text-[10px] font-bold bg-red-600 text-white px-2 py-0.5 rounded">
                        ⚠ {t('supReworkTag')} ×{row.reworkCount}
                      </span>
                    )}
                  </div>

                  {/* Meta */}
                  <div className="p-3">
                    <div className="font-bold text-slate-900 leading-tight">{row.trade} · {row.location.split('-').slice(-2).join('-')}</div>
                    <div className="text-xs text-slate-500 truncate">{row.title}</div>
                    <div className="mt-1 text-[11px] text-slate-600">
                      <span className="font-semibold text-slate-700">{userMap[row.assigneeUserId ?? ''] ?? '—'}</span>
                      <span className="text-slate-400"> · </span>
                      <span className="font-mono">{fmt(row.actualStart) || fmt(row.plannedStart)}</span>
                      <span className="text-slate-400"> · </span>
                      <span className="text-emerald-600 font-semibold">{t('supGeoOk')}</span>
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="px-3 pb-3 grid grid-cols-2 gap-2" onClick={(e) => e.stopPropagation()}>
                    <button
                      disabled={busy?.includes(row.id)}
                      onClick={() => act([row.id], 'approve')}
                      className="py-2.5 rounded-lg bg-emerald-600 text-white font-extrabold text-sm hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-50"
                    >{t('supApproveBtn')}</button>
                    <button
                      disabled={busy?.includes(row.id)}
                      onClick={() => {
                        const reason = window.prompt('Reject reason?') ?? '';
                        if (reason) act([row.id], 'reject', reason);
                      }}
                      className="py-2.5 rounded-lg bg-white border border-red-300 text-red-600 font-extrabold text-sm hover:bg-red-50 active:bg-red-100 disabled:opacity-50"
                    >{t('supRejectBtn')}</button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      {/* Sticky bottom: SELECT ALL · BULK APPROVE */}
      <div className="sticky bottom-0 z-20 bg-white/95 backdrop-blur border-t border-slate-200 px-4 sm:px-6 py-3 flex items-center gap-3 text-xs">
        <button
          onClick={() => setSelected(allChecked ? new Set() : new Set(visible.map((v) => v.id)))}
          className="px-3 py-1.5 rounded-md border border-slate-300 text-slate-700 font-semibold hover:bg-slate-50"
        >{allChecked ? t('supClearAll') : t('supSelectAll')}</button>
        <span className="text-slate-700">
          <b className="text-amber-700">{selected.size}</b> {t('qSelectedOf')} {visible.length}
        </span>
        <button
          disabled={selected.size === 0 || !!busy}
          onClick={() => act(Array.from(selected), 'approve')}
          className="ml-auto px-4 py-2 rounded-lg bg-emerald-600 text-white font-extrabold text-sm hover:bg-emerald-700 disabled:opacity-40"
        >
          ✓ {t('supBulkApprove')} {selected.size > 0 ? `· ${selected.size}` : ''}
        </button>
        <button
          disabled={selected.size === 0 || !!busy}
          onClick={() => {
            const reason = window.prompt('Reject reason?') ?? '';
            if (reason) act(Array.from(selected), 'reject', reason);
          }}
          className="px-4 py-2 rounded-lg bg-white border border-red-300 text-red-600 font-extrabold text-sm hover:bg-red-50 disabled:opacity-40"
        >
          ✗ {t('qRejectReason')}
        </button>
      </div>
    </div>
  );
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`text-xs px-3 py-1.5 rounded-full border font-bold whitespace-nowrap transition ${
        active
          ? 'bg-slate-900 text-white border-slate-900'
          : 'border-slate-200 text-slate-600 hover:bg-slate-50'
      }`}
    >{children}</button>
  );
}

function RiskBadge({ risk, t }: { risk: 'LOW' | 'MED' | 'HIGH'; t: (k: any) => string }) {
  const cls = risk === 'HIGH'
    ? 'bg-red-100 text-red-700 border-red-300'
    : risk === 'MED'
      ? 'bg-amber-100 text-amber-800 border-amber-300'
      : 'bg-emerald-100 text-emerald-700 border-emerald-300';
  const label = risk === 'HIGH' ? t('qRiskHigh') : risk === 'MED' ? t('qRiskMed') : t('qRiskLow');
  return (
    <span className={`inline-block px-2 py-0.5 rounded-md border text-[10px] font-extrabold tracking-wider ${cls}`}>
      {label} {t('supRiskSuffix')}
    </span>
  );
}

function fmt(ts: string | null): string {
  if (!ts) return '—';
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
