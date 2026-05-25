import { useEffect, useMemo, useState } from 'react';
import { api, deviceId, getGeo, getToken, getUser, isDemo, setToken, setUser } from './lib';
import { CameraCapture } from './CameraCapture';
import { t, getLang, setLang, onLangChange } from './i18n';
import { count as qCount, enqueue, list as qList, remove as qRemove } from './offlineQueue';
import { MarioMark } from './MarioLogo';

type Task = {
  id: string; title: string; trade: string; location: string;
  state: string;
  plannedStart: string | null; plannedEnd: string | null;
  actualStart: string | null; actualEnd: string | null;
  acceptedAt?: string | null;
  referenceImageUrl?: string | null;
  reworkCount?: number;
};

type PunchKind = 'ENTRY' | 'LUNCH_OUT' | 'LUNCH_IN' | 'EXIT';
type Punch = {
  id: string;
  kind: PunchKind;
  punchedAt: string;
  insideGeofence: boolean;
};

type Tab = 'tasks' | 'time' | 'me';

export function App() {
  const [token] = useState<string | null>(getToken());
  const [, force] = useState(0);
  useEffect(() => onLangChange(() => force((n) => n + 1)), []);
  if (!token) return <Login onLogin={(tok, u) => { setToken(tok); setUser(u); location.reload(); }} />;
  if (!localStorage.getItem('mario_perm_done')) return <Permissions onDone={() => { localStorage.setItem('mario_perm_done','1'); force((n)=>n+1); }} />;
  return <Home />;
}

function LangToggle() {
  const cur = getLang();
  return (
    <div className="text-[10px] font-bold rounded-md overflow-hidden border border-slate-700 flex">
      {(['en', 'hi'] as const).map((l) => (
        <button
          key={l}
          onClick={() => setLang(l)}
          className={`px-2 py-1 ${cur === l ? 'bg-amber-500 text-slate-900' : 'bg-slate-900 text-slate-400'}`}
        >
          {l === 'en' ? 'EN' : 'हिं'}
        </button>
      ))}
    </div>
  );
}

function Login({ onLogin }: { onLogin: (token: string, user: any) => void }) {
  const [devId, setDevId] = useState('+919000000111');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function devLogin(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      const data = await api<{ token: string; user: any }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ phoneOrEmail: devId, devCode: '000000' }),
      });
      onLogin(data.token, data.user);
    } catch (e: any) { setErr(e.message ?? 'sign-in failed'); }
    finally { setBusy(false); }
  }

  return (
    <div className="min-h-full blueprint-grid relative overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -top-24 -left-16 w-72 h-72 rounded-full bg-amber-500/20 blur-3xl sf-float" />
        <div className="absolute bottom-10 -right-10 w-64 h-64 rounded-full bg-orange-600/10 blur-3xl sf-float" style={{ animationDelay: '1.5s' }} />
        <svg className="absolute right-4 top-8 w-28 h-28 text-amber-400/30 sf-float" viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M50 90 V20 H10 M50 20 H90 M50 30 V20 M50 90 H30 M50 90 H70" />
          <circle cx="50" cy="20" r="3" fill="currentColor" />
        </svg>
      </div>

      <div className="relative min-h-full grid place-items-center p-6">
        <form onSubmit={devLogin}
              className="w-full max-w-sm bg-slate-900/85 backdrop-blur rounded-2xl p-6 border border-slate-700/80 shadow-2xl sf-fade-up relative">
          <span className="absolute -top-px -left-px w-8 h-8 border-t-2 border-l-2 border-amber-400 rounded-tl-2xl" />
          <span className="absolute -top-px -right-px w-8 h-8 border-t-2 border-r-2 border-amber-400 rounded-tr-2xl" />

          <div className="flex items-center gap-2 mb-3">
            <MarioMark size={36} />
            <div className="leading-tight">
              <div className="text-amber-400 text-[10px] font-bold tracking-[0.25em]">MARIO</div>
              <div className="text-[10px] text-slate-400">FIELD · हाज़िरी</div>
            </div>
            <div className="ml-auto"><LangToggle /></div>
          </div>
          <div className="text-2xl font-extrabold mb-1 text-slate-100">Sign in (dev bypass)</div>
          <div className="text-xs text-slate-400 mb-5">{isDemo() ? 'Demo: pick a role and tap Sign in.' : 'Dev login only. Phone/OTP is disabled.'}</div>

          <label className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">Dev user</label>
          <select
            value={devId}
            onChange={e => setDevId(e.target.value)}
            className="w-full mt-1 px-3 py-3 rounded-lg bg-slate-950 border border-slate-700 text-base text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500/60 focus:border-amber-500/60"
          >
            {[
              { id: '+919000000111', label: 'Employee', icon: '●' },
              { id: '+919000000110', label: 'Supervisor', icon: '▲' },
              { id: 'quality@siteflow.local', label: 'Quality', icon: '✦' },
              { id: 'manager@siteflow.local', label: 'Manager', icon: '◈' },
              { id: 'client@siteflow.local', label: 'Client', icon: '◉' },
            ].map(u => (
              <option key={u.id} value={u.id}>{u.icon} {u.label}</option>
            ))}
          </select>

          {err && <div className="mt-3 text-xs text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">{err}</div>}

          <button disabled={busy}
            className="mt-5 w-full btn-amber py-3 rounded-xl shadow-lg shadow-amber-500/20 disabled:opacity-60">
            {busy ? '…' : t('signIn')}
          </button>

          <div className="mt-5 h-1.5 rounded-full overflow-hidden hi-vis-stripes opacity-60" />
        </form>
      </div>
    </div>
  );
}

type CamRequest =
  | { kind: 'proof'; task: Task }
  | { kind: 'punch'; punchKind: PunchKind };

function Home() {
  const user = getUser()!;
  const [tab, setTab] = useState<Tab>('tasks');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [punches, setPunches] = useState<Punch[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [cameraReq, setCameraReq] = useState<CamRequest | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [queueN, setQueueN] = useState(0);
  const [org, setOrg] = useState<{ name: string; logoUrl: string | null }>({ name: 'Mario', logoUrl: null });

  async function load() {
    try {
      const [ts, ps] = await Promise.all([
        api<Task[]>('/tasks'),
        api<Punch[]>('/timesheets/me/today'),
      ]);
      setTasks(Array.isArray(ts) ? ts : []);
      setPunches(Array.isArray(ps) ? ps : []);
    } catch (e: any) { setErr(e.message); }
    setQueueN(await qCount());
  }

  useEffect(() => {
    load();
    api<{ org: { name: string }; logoUrl: string | null }>('/orgs/me')
      .then((o) => setOrg({ name: o.org?.name ?? 'Mario', logoUrl: o.logoUrl ?? null }))
      .catch(() => {});
  }, []);

  // Drain the offline queue on mount and whenever we regain connectivity.
  useEffect(() => {
    let active = true;
    async function drain() {
      const items = await qList();
      if (items.length === 0) { setQueueN(0); return; }
      setFlash(t('syncingN', items.length));
      for (const it of items) {
        if (!active) return;
        try { await uploadProof(it.taskId, it.blob, it.meta); await qRemove(it.id!); }
        catch { break; }
      }
      setQueueN(await qCount());
      await load();
    }
    drain();
    window.addEventListener('online', drain);
    return () => { active = false; window.removeEventListener('online', drain); };
  }, []);

  async function start(task: Task) {
    setBusy(task.id); setErr(null);
    try {
      const g = await getGeo();
      await api(`/tasks/${task.id}/start`, {
        method: 'POST',
        body: JSON.stringify({ lat: g.coords.latitude, lng: g.coords.longitude }),
      });
      await load();
    } catch (e: any) { setErr(e.message); } finally { setBusy(null); }
  }

  async function accept(task: Task) {
    setBusy(task.id); setErr(null);
    try {
      await api(`/tasks/${task.id}/accept`, { method: 'POST', body: JSON.stringify({}) });
      await load();
    } catch (e: any) { setErr(e.message); } finally { setBusy(null); }
  }

  async function uploadProof(taskId: string, blob: Blob, meta: { lat: number; lng: number; capturedAt: string }) {
    const presign = await api<{ uploadUrl: string; s3Key: string }>('/proofs/presign', {
      method: 'POST',
      body: JSON.stringify({
        taskId, mimeType: 'image/jpeg',
        capturedAt: meta.capturedAt, lat: meta.lat, lng: meta.lng,
        deviceId: deviceId(),
      }),
    });
    if (!presign.uploadUrl.startsWith('data:')) {
      // Real S3 PUT (not the demo data: URL).
      const up = await fetch(presign.uploadUrl, {
        method: 'PUT',
        headers: { 'content-type': 'image/jpeg' },
        body: blob,
      });
      if (!up.ok) throw new Error(`upload failed (${up.status})`);
    }
    return api<{ geofence: { inside: boolean; distanceM: number; radiusM: number } }>(
      '/proofs/finalize', {
      method: 'POST',
      body: JSON.stringify({
        taskId, s3Key: presign.s3Key, mimeType: 'image/jpeg',
        capturedAt: meta.capturedAt, lat: meta.lat, lng: meta.lng,
        deviceId: deviceId(),
      }),
    });
  }

  async function handleCapture(blob: Blob, meta: { lat: number; lng: number; capturedAt: string }) {
    if (!cameraReq) return;
    const req = cameraReq;
    setCameraReq(null);
    const busyKey = req.kind === 'proof' ? req.task.id : `punch:${req.punchKind}`;
    setBusy(busyKey); setErr(null);
    try {
      if (req.kind === 'proof') {
        // Stash the watermarked image bytes so the supervisor approval card
        // can show the actual photo (the demo S3 PUT is a no-op, so without
        // this the supervisor would only see the placeholder).
        try {
          const reader = new FileReader();
          await new Promise<void>((res) => { reader.onload = () => res(); reader.readAsDataURL(blob); });
          if (typeof reader.result === 'string') {
            const key = `mario_proof_${req.task.id}`;
            try { localStorage.setItem(key, reader.result); } catch { /* over-quota: skip */ }
          }
        } catch { /* noop */ }
        try {
          const fin = await uploadProof(req.task.id, blob, meta);
          setFlash(`${t('punched')} · ${fin.geofence.inside ? t('inside') : t('outside')} ${t('geofence')} (${fin.geofence.distanceM}m / ${fin.geofence.radiusM}m)`);
        } catch {
          await enqueue({ taskId: req.task.id, blob, meta });
          setQueueN(await qCount());
          setFlash(t('queuedOffline'));
        }
      } else {
        let selfieKey: string | null = null;
        try {
          const sp = await api<{ uploadUrl: string; s3Key: string }>('/timesheets/selfie/presign', {
            method: 'POST',
            body: JSON.stringify({ mimeType: 'image/jpeg' }),
          });
          if (!sp.uploadUrl.startsWith('data:')) {
            const up = await fetch(sp.uploadUrl, {
              method: 'PUT', headers: { 'content-type': 'image/jpeg' }, body: blob,
            });
            if (up.ok) selfieKey = sp.s3Key;
          } else {
            selfieKey = sp.s3Key;
          }
        } catch { /* selfie best-effort */ }
        const punchRes = await api<{ geofence: { inside: boolean; distanceM: number; radiusM: number } }>(
          '/timesheets/punch', {
          method: 'POST',
          body: JSON.stringify({
            kind: req.punchKind, lat: meta.lat, lng: meta.lng,
            selfieS3Key: selfieKey, capturedAt: meta.capturedAt,
          }),
        });
        // Optimistically add to local punches list so the timesheet view
        // reflects the punch immediately even when the API doesn't echo it.
        setPunches((cur) => [
          ...cur.filter((p) => p.kind !== req.punchKind),
          {
            id: `local-${Date.now()}`, kind: req.punchKind,
            punchedAt: meta.capturedAt,
            insideGeofence: punchRes.geofence.inside,
          },
        ]);
        setFlash(`${t('punched')} ${req.punchKind} · ${punchRes.geofence.inside ? t('inside') : t('outside')} ${t('geofence')} (${punchRes.geofence.distanceM}m)`);
      }
      await load();
    } catch (e: any) { setErr(e.message); } finally { setBusy(null); }
  }

  function logout() {
    setToken(null); setUser(null); location.reload();
  }

  // Derive next pending punch + shift duration for the home header / time tab.
  const punchOrder: PunchKind[] = ['ENTRY', 'LUNCH_OUT', 'LUNCH_IN', 'EXIT'];
  const punchByKind = useMemo(() => {
    const m: Partial<Record<PunchKind, Punch>> = {};
    for (const p of punches) m[p.kind] = p;
    return m;
  }, [punches]);
  const nextPunch = punchOrder.find((k) => !punchByKind[k]) ?? null;

  return (
    <div className="min-h-full pb-24">
      <header className="px-4 pt-4 pb-3 flex items-center gap-3 border-b border-slate-800">
        <button
          onClick={() => { setCameraReq(null); setFlash(null); setErr(null); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
          className="flex items-center gap-3 group"
          aria-label="Mario home"
        >
          {org.logoUrl ? (
            <img src={org.logoUrl} alt={org.name} className="w-10 h-10 rounded-full object-contain bg-white p-0.5 group-active:scale-95 transition" />
          ) : (
            <MarioMark size={40} className="group-active:scale-95 transition" />
          )}
          <div className="text-left">
            <div className="text-amber-400 text-[10px] font-bold tracking-[0.25em]">{org.name.toUpperCase()}</div>
            <div className="text-lg font-extrabold leading-tight">{user.name}</div>
            <div className="text-[10px] text-slate-400 uppercase tracking-wider">{user.role}</div>
          </div>
        </button>
        <div className="ml-auto flex items-center gap-2">
          {isDemo() && (
            <span title="No backend — UI runs on in-browser mock data."
              className="hidden sm:inline-flex px-2 py-1 rounded-md bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-semibold text-[10px] tracking-wider">
              DEMO
            </span>
          )}
          <LangToggle />
        </div>
      </header>

      {queueN > 0 && (
        <div className="mx-4 mt-3 p-2 rounded-lg bg-amber-500/10 border border-amber-500/40 text-amber-300 text-xs">
          {t('syncingN', queueN)}
        </div>
      )}
      {flash && (
        <div className="mx-4 mt-3 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/40 text-emerald-300 text-sm sf-fade-up">{flash}</div>
      )}
      {err && (
        <div className="mx-4 mt-3 p-3 rounded-lg bg-red-500/10 border border-red-500/40 text-red-300 text-sm sf-fade-up">{err}</div>
      )}

      {tab === 'tasks' && (
        <TasksTab
          tasks={tasks} busy={busy}
          nextPunch={nextPunch} entryPunch={punchByKind.ENTRY ?? null}
          onPunch={(k) => setCameraReq({ kind: 'punch', punchKind: k })}
          onAccept={accept} onStart={start}
          onSubmitProof={(task) => setCameraReq({ kind: 'proof', task })}
        />
      )}
      {tab === 'time' && (
        <TimeTab
          punches={punches} busy={busy} nextPunch={nextPunch} queueN={queueN}
          onPunch={(k) => setCameraReq({ kind: 'punch', punchKind: k })}
        />
      )}
      {tab === 'me' && (
        <MeTab user={user} org={org} onSignOut={logout} />
      )}

      {cameraReq && (
        <CameraCapture
          task={
            cameraReq.kind === 'proof'
              ? cameraReq.task
              : { id: cameraReq.punchKind, title: t(`punch_${cameraReq.punchKind}` as any), location: t('punch') }
          }
          mode={cameraReq.kind === 'punch' ? 'selfie' : 'proof'}
          referenceImageUrl={cameraReq.kind === 'proof' ? cameraReq.task.referenceImageUrl ?? null : null}
          onCancel={() => setCameraReq(null)}
          onCapture={handleCapture}
        />
      )}

      <BottomNav tab={tab} setTab={setTab} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TASKS TAB
// Mockup: ON SITE banner + SHIFT timer block + tasks with START/NOW/TARGET.

function TasksTab({
  tasks, busy, nextPunch, entryPunch, onPunch, onAccept, onStart, onSubmitProof,
}: {
  tasks: Task[]; busy: string | null; nextPunch: PunchKind | null; entryPunch: Punch | null;
  onPunch: (k: PunchKind) => void;
  onAccept: (t: Task) => void; onStart: (t: Task) => void; onSubmitProof: (t: Task) => void;
}) {
  const pendingCount = tasks.filter((t) => t.state !== 'CLOSED' && t.state !== 'CLIENT_ACKNOWLEDGED').length;
  const siteLabel = 'Prestige Tower B'; // TODO: derive from user.siteId once /sites by id is reachable client-side.

  return (
    <>
      {/* ON SITE banner — big, mockup-style */}
      <section className="mx-4 mt-3 rounded-2xl overflow-hidden bg-slate-900 border border-slate-700 shadow-lg shadow-black/30">
        <div className="px-4 pt-3 pb-2 flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-[0.25em] text-amber-400 font-bold">{t('onSite')}</span>
          <span className="ml-auto inline-flex items-center gap-1.5 text-[10px] font-bold text-emerald-300">
            <span className="relative flex w-2 h-2">
              <span className="absolute inset-0 rounded-full bg-emerald-400 sf-pulse-ring" />
              <span className="relative inline-flex rounded-full w-2 h-2 bg-emerald-400" />
            </span>
            LIVE
          </span>
        </div>
        <div className="px-4 pb-3">
          <div className="text-2xl font-extrabold leading-tight">{siteLabel}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">12.97° N · 77.75° E · geofence 150 m</div>
        </div>
        {/* SHIFT card — clock + PUNCH-next CTA */}
        <div className="grid grid-cols-[1fr_auto] gap-3 px-4 pb-4">
          <div className="rounded-xl bg-slate-950/60 border border-slate-700 p-3">
            <div className="text-[10px] uppercase tracking-[0.25em] text-slate-400 font-bold">{t('shift')}</div>
            <ShiftTimer startedAt={entryPunch?.punchedAt ?? null} />
            <div className="text-[10px] text-slate-500 mt-0.5">{t('todayBanner')}</div>
          </div>
          {nextPunch && (
            <button
              disabled={busy === `punch:${nextPunch}`}
              onClick={() => onPunch(nextPunch)}
              className="rounded-xl btn-amber px-4 py-3 text-sm font-extrabold leading-tight shadow-md shadow-amber-500/30 disabled:opacity-50 grid place-items-center text-center"
            >
              <div className="text-[10px] tracking-widest opacity-80">{nextPunch.replace('_', ' ')}</div>
              <div className="mt-0.5 text-base">
                {nextPunch === 'ENTRY' ? t('punchEntry') :
                 nextPunch === 'LUNCH_OUT' ? t('punchLunch') :
                 nextPunch === 'LUNCH_IN' ? t('punchLunchIn') :
                 t('punchExit')}
              </div>
            </button>
          )}
        </div>
      </section>

      <div className="px-4 pt-4 pb-2 flex items-center gap-2">
        <div className="text-[11px] uppercase tracking-wider text-slate-500 font-bold">{t('yourTasks')} · {tasks.length}</div>
        {pendingCount > 0 && (
          <span className="ml-auto text-[10px] font-bold bg-amber-500 text-slate-900 px-2 py-0.5 rounded">
            {pendingCount} {t('pending')}
          </span>
        )}
      </div>

      <div className="px-4 space-y-3">
        {tasks.length === 0 && (
          <div className="text-center text-slate-500 text-sm py-12">
            <div className="mx-auto w-20 h-20 rounded-2xl bg-slate-800 grid place-items-center text-3xl mb-3">∅</div>
            {t('noTasks')}
          </div>
        )}
        {tasks.map((task, i) => (
          <TaskCard
            key={task.id}
            task={task} busy={busy}
            onAccept={onAccept} onStart={onStart} onSubmitProof={onSubmitProof}
            index={i}
          />
        ))}
      </div>
    </>
  );
}

function TaskCard({
  task, busy, onAccept, onStart, onSubmitProof, index,
}: {
  task: Task; busy: string | null; index: number;
  onAccept: (t: Task) => void; onStart: (t: Task) => void; onSubmitProof: (t: Task) => void;
}) {
  const statePill =
    task.state === 'IN_PROGRESS' ? { cls: 'bg-amber-500 text-slate-900', label: '● ' + t('inProgress') } :
    task.state === 'ASSIGNED'    ? { cls: 'bg-slate-700 text-slate-200', label: t('assigned') } :
    task.state === 'ACCEPTED'    ? { cls: 'bg-blue-500/20 text-blue-200 border border-blue-500/40', label: 'ACCEPTED' } :
    task.state === 'REWORK'      ? { cls: 'bg-red-500/20 text-red-200 border border-red-500/40', label: t('rework') } :
    (task.state === 'CLOSED' || task.state === 'CLIENT_ACKNOWLEDGED')
                                 ? { cls: 'bg-emerald-500/20 text-emerald-200 border border-emerald-500/40', label: '✓ ' + t('done') } :
                                   { cls: 'bg-slate-700/50 text-slate-400', label: task.state };

  const showStartNowTarget = task.state === 'IN_PROGRESS';

  return (
    <div
      className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden sf-fade-up shadow-lg shadow-black/20"
      style={{ animationDelay: `${Math.min(index, 6) * 0.05}s` }}
    >
      <div className="p-3">
        <div className="flex items-start gap-2">
          <div className={`w-12 h-12 rounded-lg shrink-0 ${tradePhoto(task.trade)}`} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold tracking-wider ${statePill.cls}`}>
                {statePill.label}
              </span>
              {(task.reworkCount ?? 0) >= 2 && (
                <span className="text-[9px] font-bold bg-red-600 text-white px-1.5 py-0.5 rounded">×{task.reworkCount}</span>
              )}
              {task.state === 'IN_PROGRESS' && task.actualStart && (
                <span className="ml-auto text-[10px] text-amber-300 font-mono">
                  <ElapsedSince at={task.actualStart} />
                </span>
              )}
            </div>
            <div className="font-bold text-slate-100 mt-1 leading-tight">{task.title}</div>
            <div className="text-xs text-slate-400">{task.trade} · {task.location}</div>
          </div>
        </div>

        {showStartNowTarget && (
          <div className="mt-3 grid grid-cols-3 gap-2 rounded-lg bg-slate-950/60 border border-slate-700 p-2">
            {[
              { l: t('startLabel'),  v: fmt(task.actualStart) },
              { l: t('nowLabel'),    v: nowHHMM() },
              { l: t('targetLabel'), v: fmt(task.plannedEnd) },
            ].map((c) => (
              <div key={c.l} className="text-center">
                <div className="text-[9px] uppercase tracking-widest text-slate-500 font-bold">{c.l}</div>
                <div className="text-base font-mono font-bold text-slate-100">{c.v}</div>
              </div>
            ))}
          </div>
        )}

        {!showStartNowTarget && (
          <div className="mt-2 text-[11px] font-mono text-slate-500">
            planned {fmt(task.plannedStart)} → {fmt(task.plannedEnd)}
            {task.actualStart && <> · actual {fmt(task.actualStart)} → {fmt(task.actualEnd)}</>}
          </div>
        )}

        <div className="mt-3 flex gap-2">
          {task.state === 'ASSIGNED' && (
            <button
              disabled={busy === task.id}
              onClick={() => onAccept(task)}
              className="btn-amber px-4 py-2.5 rounded-lg text-sm disabled:opacity-50 flex-1"
            >{t('acceptTask')}</button>
          )}
          {(task.state === 'ACCEPTED' || task.state === 'REWORK') && (
            <button
              disabled={busy === task.id}
              onClick={() => onStart(task)}
              className="btn-amber px-4 py-2.5 rounded-lg text-sm disabled:opacity-50 flex-1"
            >{t('start')}{task.acceptedAt && task.state === 'ACCEPTED' && <> · <ElapsedSince at={task.acceptedAt} /></>}</button>
          )}
          {task.state === 'IN_PROGRESS' && (
            <button
              disabled={busy === task.id}
              onClick={() => onSubmitProof(task)}
              className="btn-amber px-4 py-3 rounded-lg text-sm disabled:opacity-50 flex-1 font-extrabold"
            >{t('submitProof')}</button>
          )}
          {(task.state !== 'ASSIGNED' && task.state !== 'ACCEPTED' && task.state !== 'IN_PROGRESS' && task.state !== 'REWORK') && (
            <div className="text-xs text-slate-400 py-2">{t('waitingOn')} <span className="text-amber-400 font-semibold">{nextActor(task.state)}</span></div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TIME TAB — full timesheet with stamps, status block, big CTA

function TimeTab({
  punches, busy, nextPunch, queueN, onPunch,
}: {
  punches: Punch[]; busy: string | null; nextPunch: PunchKind | null; queueN: number;
  onPunch: (k: PunchKind) => void;
}) {
  const user = getUser()!;
  const today = new Date();
  const todayLabel = today.toLocaleDateString(undefined, { day: '2-digit', month: 'short' }).toUpperCase();
  const byKind: Partial<Record<PunchKind, Punch>> = Object.fromEntries(punches.map((p) => [p.kind, p]));

  // Worked = (now or EXIT) - ENTRY - (LUNCH_IN - LUNCH_OUT if both present).
  const workedMs = useMemo(() => {
    const entry = byKind.ENTRY ? new Date(byKind.ENTRY.punchedAt).getTime() : null;
    if (!entry) return 0;
    const end = byKind.EXIT ? new Date(byKind.EXIT.punchedAt).getTime() : Date.now();
    let ms = end - entry;
    if (byKind.LUNCH_OUT && byKind.LUNCH_IN) {
      ms -= new Date(byKind.LUNCH_IN.punchedAt).getTime() - new Date(byKind.LUNCH_OUT.punchedAt).getTime();
    }
    return Math.max(0, ms);
  }, [punches]);
  const wHours = Math.floor(workedMs / 3_600_000);
  const wMins  = Math.floor((workedMs % 3_600_000) / 60_000);

  const stamps: { kind: PunchKind; label: string; subHi: string; estTime?: string }[] = [
    { kind: 'ENTRY',     label: t('entryPunch'),    subHi: t('selfieGps'),       estTime: '08:00' },
    { kind: 'LUNCH_OUT', label: t('lunchOutLabel'), subHi: '',                   estTime: '12:30' },
    { kind: 'LUNCH_IN',  label: t('lunchInLabel'),  subHi: t('selfieRequired'),  estTime: '13:30' },
    { kind: 'EXIT',      label: t('exitPunch'),     subHi: '',                   estTime: '18:00' },
  ];

  return (
    <div className="px-4 pt-4 pb-6 space-y-4">
      {/* Header */}
      <div className="flex items-baseline gap-3">
        <div>
          <div className="text-[10px] uppercase tracking-[0.25em] text-amber-400 font-bold">{t('timesheet')} · {todayLabel}</div>
          <div className="text-2xl font-extrabold mt-0.5">{user.name}</div>
          <div className="text-xs text-slate-400">हाज़िरी</div>
        </div>
        <div className="ml-auto text-right">
          <div className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">{t('worked')}</div>
          <div className="text-2xl font-extrabold text-amber-400">{wHours}h {String(wMins).padStart(2, '0')}m</div>
        </div>
      </div>

      {/* Today's stamps */}
      <div>
        <div className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-2">{t('todaysStamps')}</div>
        <div className="space-y-2">
          {stamps.map((s) => {
            const done = byKind[s.kind];
            const isNext = !done && nextPunch === s.kind;
            return (
              <div
                key={s.kind}
                className={`rounded-xl border p-3 flex items-center gap-3 ${
                  done
                    ? 'bg-emerald-500/5 border-emerald-500/30'
                    : isNext
                      ? 'bg-amber-500/10 border-amber-500/50'
                      : 'bg-slate-800/60 border-slate-700'
                }`}
              >
                <div className={`w-9 h-9 rounded-full grid place-items-center text-base font-bold ${
                  done ? 'bg-emerald-500/20 text-emerald-300'
                       : isNext ? 'bg-amber-500 text-slate-900'
                                : 'bg-slate-700 text-slate-500'
                }`}>
                  {done ? '✓' : isNext ? '▶' : '○'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-sm text-slate-100">
                    {s.label}{isNext && <span className="ml-2 text-[10px] font-extrabold tracking-widest text-amber-300">· {t('next')}</span>}
                  </div>
                  {s.subHi && <div className="text-[11px] text-slate-400">{s.subHi}</div>}
                </div>
                <div className="text-right">
                  {done ? (
                    <div className="font-mono font-bold text-emerald-300">{fmt(done.punchedAt)}</div>
                  ) : isNext ? (
                    <div className="font-mono font-bold text-amber-300">{t('duePrefix')} {s.estTime}</div>
                  ) : (
                    <div className="font-mono text-slate-500">{t('estPrefix')} {s.estTime}</div>
                  )}
                  {done && !done.insideGeofence && (
                    <div className="text-[9px] text-red-300 font-bold">⚠ OUTSIDE</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Status block */}
      <div className="rounded-xl bg-slate-900 border border-slate-700 p-3 space-y-1.5 text-xs">
        <Row label={`📍 ${t('site')}`}     right={<span className="font-bold">Prestige Tower B</span>} />
        <Row label={`🎯 ${t('geofence')}`} right={<span className="font-bold text-emerald-300">{t('inside')} ✓</span>} />
        <Row label={`📶 ${t('network')}`}  right={queueN > 0
          ? <span className="font-bold text-amber-300">{queueN} {t('inQueue')} ↻</span>
          : <span className="font-bold text-emerald-300">online</span>} />
      </div>

      {/* Big CTA */}
      {nextPunch && (
        <button
          disabled={busy === `punch:${nextPunch}`}
          onClick={() => onPunch(nextPunch)}
          className="w-full btn-amber py-4 rounded-2xl font-extrabold text-lg disabled:opacity-50 shadow-lg shadow-amber-500/30"
        >
          {nextPunch === 'ENTRY' ? t('punchEntry') :
           nextPunch === 'LUNCH_OUT' ? t('punchLunch') :
           nextPunch === 'LUNCH_IN' ? t('punchLunchIn') :
           t('punchExit')}
        </button>
      )}

      {/* Exit early link */}
      {byKind.ENTRY && !byKind.EXIT && (
        <button
          onClick={() => {
            const reason = prompt('Reason for exiting early?');
            if (reason) alert(`(demo) recorded: ${reason}`);
          }}
          className="w-full py-3 rounded-xl border border-red-500/40 text-red-300 text-sm font-semibold hover:bg-red-500/10 transition"
        >
          {t('exitEarly')}
        </button>
      )}
    </div>
  );
}

function Row({ label, right }: { label: string; right: React.ReactNode }) {
  return <div className="flex items-center"><span className="text-slate-400">{label}</span><span className="ml-auto">{right}</span></div>;
}

// ─────────────────────────────────────────────────────────────────────────────
// ME TAB — profile + language + sign out

function MeTab({
  user, org, onSignOut,
}: { user: any; org: { name: string; logoUrl: string | null }; onSignOut: () => void }) {
  const cur = getLang();
  const did = deviceId();
  return (
    <div className="px-4 pt-4 pb-6 space-y-4">
      <div className="rounded-2xl bg-slate-900 border border-slate-700 p-4 flex items-center gap-3">
        <div className="w-14 h-14 rounded-full bg-slate-700 grid place-items-center text-2xl font-extrabold text-amber-400">
          {user.name?.[0] ?? '?'}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-extrabold text-lg leading-tight">{user.name}</div>
          <div className="text-xs text-slate-400 uppercase tracking-wider">{user.role}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">{org.name}</div>
        </div>
      </div>

      <div className="rounded-2xl bg-slate-900 border border-slate-700 p-4">
        <div className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-2">{t('language')}</div>
        <div className="flex gap-2">
          {(['en', 'hi'] as const).map((l) => (
            <button
              key={l} onClick={() => setLang(l)}
              className={`flex-1 py-3 rounded-xl text-base font-extrabold border ${cur === l ? 'bg-amber-500 text-slate-900 border-amber-400' : 'bg-slate-800 text-slate-300 border-slate-700'}`}
            >
              {l === 'en' ? 'English' : 'हिंदी'}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-2xl bg-slate-900 border border-slate-700 p-4 text-xs space-y-2">
        <div className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-1">{t('account')}</div>
        <Row label={t('myRole')}  right={<span className="font-bold text-slate-200">{user.role}</span>} />
        <Row label={t('mySite')}  right={<span className="font-mono text-slate-300">{user.siteId ? user.siteId.slice(0, 8) : '—'}</span>} />
        <Row label={t('device')}  right={<span className="font-mono text-slate-400">{did.slice(0, 12)}…</span>} />
      </div>

      <button onClick={onSignOut} className="w-full py-3 rounded-xl border border-red-500/40 text-red-300 text-sm font-semibold hover:bg-red-500/10 transition">
        {t('signOut')}
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// BOTTOM NAV

function BottomNav({ tab, setTab }: { tab: Tab; setTab: (t: Tab) => void }) {
  const items: { id: Tab; label: string; icon: string }[] = [
    { id: 'tasks', label: t('navTasks'), icon: '🔨' },
    { id: 'time',  label: t('navTime'),  icon: '⏱' },
    { id: 'me',    label: t('navMe'),    icon: '👤' },
  ];
  return (
    <nav className="fixed bottom-0 inset-x-0 z-30 bg-slate-950/95 backdrop-blur border-t border-slate-800 grid grid-cols-3 pb-[env(safe-area-inset-bottom)]">
      {items.map((it) => {
        const active = tab === it.id;
        return (
          <button
            key={it.id}
            onClick={() => setTab(it.id)}
            className={`py-2 flex flex-col items-center justify-center gap-0.5 transition ${
              active ? 'text-amber-400' : 'text-slate-500'
            }`}
          >
            <div className={`text-lg ${active ? 'scale-110' : ''}`}>{it.icon}</div>
            <div className="text-[10px] font-bold tracking-widest">{it.label}</div>
          </button>
        );
      })}
    </nav>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers

function tradePhoto(trade: string): string {
  const x = (trade ?? '').toLowerCase();
  if (x.includes('tile') || x.includes('grout')) return 'tile-photo';
  if (x.includes('paint')) return 'paint-photo';
  if (x.includes('plaster')) return 'plaster-photo';
  if (x.includes('bath') || x.includes('plumb')) return 'bath-photo';
  if (x.includes('rcc') || x.includes('slab') || x.includes('concrete')) return 'rcc-photo';
  return 'site-photo';
}

function fmt(ts: string | null): string {
  if (!ts) return '—';
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
function nowHHMM(): string {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
function nextActor(state: string): string {
  switch (state) {
    case 'PROOF_SUBMITTED': return 'supervisor';
    case 'SUPERVISOR_APPROVED': return 'quality';
    case 'QUALITY_APPROVED': return 'manager';
    case 'MANAGER_APPROVED': return 'client';
    case 'CLIENT_ACKNOWLEDGED':
    case 'CLOSED': return 'no one — done';
    default: return state;
  }
}

function ShiftTimer({ startedAt }: { startedAt: string | null }) {
  const [, force] = useState(0);
  useEffect(() => {
    const i = setInterval(() => force((n) => n + 1), 30_000);
    return () => clearInterval(i);
  }, []);
  if (!startedAt) return <div className="text-3xl font-extrabold font-mono text-slate-100 mt-1">--:--</div>;
  const ms = Math.max(0, Date.now() - new Date(startedAt).getTime());
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return <div className="text-3xl font-extrabold font-mono text-slate-100 mt-1 tracking-tight">{String(h).padStart(2,'0')}:{String(m).padStart(2,'0')}</div>;
}

function ElapsedSince({ at }: { at: string }) {
  const [, force] = useState(0);
  useEffect(() => {
    const i = setInterval(() => force((n) => n + 1), 30_000);
    return () => clearInterval(i);
  }, []);
  const ms = Date.now() - new Date(at).getTime();
  const mins = Math.max(0, Math.floor(ms / 60000));
  if (mins < 60) return <>{mins}m elapsed</>;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return <>{h}h {m}m elapsed</>;
}

function Permissions({ onDone }: { onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function grant() {
    setBusy(true); setErr(null);
    try {
      try { await navigator.mediaDevices.getUserMedia({ video: true }); } catch {}
      try { await new Promise<void>((res) => navigator.geolocation.getCurrentPosition(() => res(), () => res(), { timeout: 8000 })); } catch {}
      if ('Notification' in window) { try { await Notification.requestPermission(); } catch {} }
      onDone();
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col">
      <div className="px-5 pt-8 pb-4 flex items-center gap-3">
        <MarioMark size={44} />
        <div>
          <div className="text-2xl font-bold text-amber-400">Mario</div>
          <div className="text-xs text-slate-400">Field employee app</div>
        </div>
      </div>
      <div className="px-5 flex-1 space-y-3">
        <div className="text-lg font-semibold">A few quick permissions</div>
        <div className="text-sm text-slate-400">We need these so you can do your job on site:</div>
        {[
          { icon: '📸', title: 'Camera', body: 'To capture proof-of-work photos before and after each task.' },
          { icon: '📍', title: 'Location', body: 'To verify you are at the right site when you punch in or submit proof.' },
          { icon: '🔔', title: 'Notifications', body: 'So you instantly know when a task is assigned, approved, or sent back for rework.' },
        ].map((p) => (
          <div key={p.title} className="rounded-xl border border-slate-700 bg-slate-800 p-3 flex items-start gap-3">
            <div className="text-2xl">{p.icon}</div>
            <div>
              <div className="font-semibold">{p.title}</div>
              <div className="text-xs text-slate-400">{p.body}</div>
            </div>
          </div>
        ))}
        {err && <div className="text-xs text-red-400">{err}</div>}
      </div>
      <div className="p-5">
        <button disabled={busy} onClick={grant} className="btn-amber w-full py-3 rounded-xl font-bold disabled:opacity-50">
          {busy ? 'Requesting…' : 'Allow & continue'}
        </button>
        <button onClick={onDone} className="w-full mt-2 py-2 text-xs text-slate-500">Skip for now</button>
      </div>
    </div>
  );
}
