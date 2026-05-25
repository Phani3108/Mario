import { useEffect, useState } from 'react';
import { api, deviceId, getGeo, getToken, getUser, setToken, setUser } from './lib';
import { CameraCapture } from './CameraCapture';
import { t, getLang, setLang, onLangChange } from './i18n';
import { count as qCount, enqueue, list as qList, remove as qRemove } from './offlineQueue';
import { MickeyMark } from './MickeyLogo';

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

export function App() {
  const [token] = useState<string | null>(getToken());
  const [, force] = useState(0);
  useEffect(() => onLangChange(() => force((n) => n + 1)), []);
  if (!token) return <Login onLogin={(tok, u) => { setToken(tok); setUser(u); location.reload(); }} />;
  if (!localStorage.getItem('mickey_perm_done')) return <Permissions onDone={() => { localStorage.setItem('mickey_perm_done','1'); force((n)=>n+1); }} />;
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
  const [devId, setDevId] = useState('quality@siteflow.local');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function devLogin(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      // Simulate login with a mock token/user
      const data = { token: 'dev-token', user: { id: devId, name: devId, role: 'manager' } };
      onLogin(data.token, data.user);
    } catch (e: any) { setErr(e.message); }
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
            <MickeyMark size={36} />
            <div className="leading-tight">
              <div className="text-amber-400 text-[10px] font-bold tracking-[0.25em]">MICKEY</div>
              <div className="text-[10px] text-slate-400">FIELD · हाज़िरी</div>
            </div>
            <div className="ml-auto"><LangToggle /></div>
          </div>
          <div className="text-2xl font-extrabold mb-1 text-slate-100">Sign in (dev bypass)</div>
          <div className="text-xs text-slate-400 mb-5">Dev login only. Phone/OTP is disabled.</div>

          <label className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">Dev user</label>
          <select
            value={devId}
            onChange={e => setDevId(e.target.value)}
            className="w-full mt-1 px-3 py-3 rounded-lg bg-slate-950 border border-slate-700 text-base text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500/60 focus:border-amber-500/60"
          >
            {[
              { id: 'quality@siteflow.local', label: 'Quality', icon: '✦' },
              { id: 'manager@siteflow.local', label: 'Manager', icon: '◈' },
              { id: 'client@siteflow.local', label: 'Client', icon: '◉' },
              { id: '+919000000010', label: 'Supervisor', icon: '▲' },
            ].map(u => (
              <option key={u.id} value={u.id}>{u.icon} {u.label}</option>
            ))}
          </select>

          <button disabled={busy}
            className="mt-5 w-full btn-amber py-3 rounded-xl shadow-lg shadow-amber-500/20 disabled:opacity-60">
            {busy ? '…' : 'Sign in'}
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
  const [tasks, setTasks] = useState<Task[]>([]);
  const [punches, setPunches] = useState<Punch[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [cameraReq, setCameraReq] = useState<CamRequest | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [queueN, setQueueN] = useState(0);
  const [org, setOrg] = useState<{ name: string; logoUrl: string | null }>({ name: 'Mickey', logoUrl: null });

  async function load() {
    try {
      const [ts, ps] = await Promise.all([
        api<Task[]>('/tasks'),
        api<Punch[]>('/timesheets/me/today'),
      ]);
      setTasks(ts); setPunches(ps);
    } catch (e: any) { setErr(e.message); }
    setQueueN(await qCount());
  }
  useEffect(() => {
    load();
    api<{ org: { name: string }; logoUrl: string | null }>('/orgs/me')
      .then((o) => setOrg({ name: o.org?.name ?? 'Mickey', logoUrl: o.logoUrl ?? null }))
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
    const up = await fetch(presign.uploadUrl, {
      method: 'PUT',
      headers: { 'content-type': 'image/jpeg' },
      body: blob,
    });
    if (!up.ok) throw new Error(`upload failed (${up.status})`);
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
          const up = await fetch(sp.uploadUrl, {
            method: 'PUT', headers: { 'content-type': 'image/jpeg' }, body: blob,
          });
          if (up.ok) selfieKey = sp.s3Key;
        } catch { /* selfie best-effort */ }
        const punchRes = await api<{ geofence: { inside: boolean; distanceM: number; radiusM: number } }>(
          '/timesheets/punch', {
          method: 'POST',
          body: JSON.stringify({
            kind: req.punchKind, lat: meta.lat, lng: meta.lng,
            selfieS3Key: selfieKey, capturedAt: meta.capturedAt,
          }),
        });
        setFlash(`${t('punched')} ${req.punchKind} · ${punchRes.geofence.inside ? t('inside') : t('outside')} ${t('geofence')} (${punchRes.geofence.distanceM}m)`);
      }
      await load();
    } catch (e: any) { setErr(e.message); } finally { setBusy(null); }
  }

  function logout() {
    setToken(null); setUser(null); location.reload();
  }

  return (
    <div className="min-h-full pb-24">
      <header className="px-4 pt-4 pb-3 flex items-center gap-3 border-b border-slate-800">
        <button
          onClick={() => { setCameraReq(null); setFlash(null); setErr(null); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
          className="flex items-center gap-3 group"
          aria-label="Mickey home"
        >
          {org.logoUrl ? (
            <img src={org.logoUrl} alt={org.name} className="w-10 h-10 rounded-full object-contain bg-white p-0.5 group-active:scale-95 transition" />
          ) : (
            <MickeyMark size={40} className="group-active:scale-95 transition" />
          )}
          <div className="text-left">
            <div className="text-amber-400 text-[10px] font-bold tracking-[0.25em]">{org.name.toUpperCase()}</div>
            <div className="text-lg font-extrabold leading-tight">{user.name}</div>
            <div className="text-[10px] text-slate-400 uppercase tracking-wider">{user.role}</div>
          </div>
        </button>
        <div className="ml-auto flex items-center gap-2">
          <LangToggle />
          <button onClick={logout} className="text-slate-400 text-xs underline">{t('signOut')}</button>
        </div>
      </header>

      <div className="relative mx-4 mt-3 rounded-xl overflow-hidden h-24 site-photo">
        <div className="absolute inset-0 p-3 flex flex-col justify-end">
          <div className="text-[10px] uppercase tracking-wider text-amber-300 font-bold">{t('todayBanner')} · Prestige Tower B</div>
          <div className="text-white font-bold text-sm drop-shadow">12.97° N · 77.75° E · geofence 150 m</div>
        </div>
        <div className="absolute top-2 right-2 flex items-center gap-1.5 text-[10px] font-bold text-emerald-300">
          <span className="relative flex w-2 h-2">
            <span className="absolute inset-0 rounded-full bg-emerald-400 sf-pulse-ring" />
            <span className="relative inline-flex rounded-full w-2 h-2 bg-emerald-400" />
          </span>
          LIVE
        </div>
      </div>

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

      <PunchPanel
        punches={punches}
        busy={busy}
        onPunch={(k) => setCameraReq({ kind: 'punch', punchKind: k })}
      />

      <div className="px-4 pt-4 pb-2 flex items-center gap-2">
        <div className="text-[11px] uppercase tracking-wider text-slate-500 font-bold">{t('yourTasks')}</div>
        <span className="text-[10px] font-bold bg-amber-500 text-slate-900 px-2 py-0.5 rounded">{tasks.length}</span>
      </div>
      <div className="px-4 space-y-3">
        {tasks.length === 0 && (
          <div className="text-center text-slate-500 text-sm py-12">
            <div className="mx-auto w-20 h-20 rounded-2xl bg-slate-800 grid place-items-center text-3xl mb-3">∅</div>
            {t('noTasks')}
          </div>
        )}
        {tasks.map((task, i) => (
          <div
            key={task.id}
            className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden sf-fade-up shadow-lg shadow-black/20"
            style={{ animationDelay: `${i * 0.06}s` }}
          >
            <div className={`h-16 relative ${tradePhoto(task.trade)}`}>
              <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 to-transparent" />
              <span className="absolute top-2 left-2 text-[10px] font-bold bg-black/60 text-amber-300 px-2 py-0.5 rounded">
                {task.trade.toUpperCase()}
              </span>
              <span className="absolute top-2 right-2 text-[10px] font-mono bg-black/60 text-amber-300 px-2 py-0.5 rounded">
                {task.state}
              </span>
            </div>
            <div className="p-3">
              <div className="font-bold text-slate-100">{task.title}</div>
              <div className="text-xs text-slate-400">{task.location}</div>
              <div className="mt-1.5 text-[11px] font-mono text-slate-500">
                planned {fmt(task.plannedStart)} → {fmt(task.plannedEnd)}
                {task.actualStart && <> · actual {fmt(task.actualStart)} → {fmt(task.actualEnd)}</>}
              </div>
              <div className="mt-3 flex gap-2">
                {task.state === 'ASSIGNED' && (
                  <button
                    disabled={busy === task.id}
                    onClick={() => accept(task)}
                    className="btn-amber px-4 py-2.5 rounded-lg text-sm disabled:opacity-50 flex-1"
                  >✓ Accept task</button>
                )}
                {(task.state === 'ACCEPTED' || task.state === 'REWORK') && (
                  <button
                    disabled={busy === task.id}
                    onClick={() => start(task)}
                    className="btn-amber px-4 py-2.5 rounded-lg text-sm disabled:opacity-50 flex-1"
                  >▶ {t('start')}{task.acceptedAt && <> · <ElapsedSince at={task.acceptedAt} /></>}</button>
                )}
                {task.state === 'IN_PROGRESS' && (
                  <button
                    disabled={busy === task.id}
                    onClick={() => setCameraReq({ kind: 'proof', task })}
                    className="btn-amber px-4 py-2.5 rounded-lg text-sm disabled:opacity-50 flex-1"
                  >{t('submitProof')}</button>
                )}
                {(task.state !== 'ASSIGNED' && task.state !== 'ACCEPTED' && task.state !== 'IN_PROGRESS' && task.state !== 'REWORK') && (
                  <div className="text-xs text-slate-400 py-2">{t('waitingOn')} <span className="text-amber-400 font-semibold">{nextActor(task.state)}</span></div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

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
    </div>
  );
}

function PunchPanel({
  punches, busy, onPunch,
}: { punches: Punch[]; busy: string | null; onPunch: (k: PunchKind) => void }) {
  const done = new Set(punches.map((p) => p.kind));
  const order: PunchKind[] = ['ENTRY', 'LUNCH_OUT', 'LUNCH_IN', 'EXIT'];
  const next = order.find((k) => !done.has(k));

  return (
    <div className="px-4 pt-4">
      <div className="text-[11px] uppercase tracking-wider text-slate-500 font-bold mb-2">{t('punch')}</div>
      <div className="grid grid-cols-4 gap-2">
        {order.map((k) => {
          const did = done.has(k);
          const isNext = next === k;
          const punch = punches.find((p) => p.kind === k);
          return (
            <button
              key={k}
              disabled={!isNext || busy === `punch:${k}`}
              onClick={() => onPunch(k)}
              className={`relative rounded-xl p-2 text-center text-[10px] font-bold border transition
                ${did
                  ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-300'
                  : isNext
                    ? 'bg-amber-500 border-amber-400 text-slate-900 shadow-md shadow-amber-500/30'
                    : 'bg-slate-800/60 border-slate-700 text-slate-500'}`}
            >
              <div className="text-[9px] tracking-widest opacity-80">{k.replace('_', ' ')}</div>
              <div className="text-sm mt-0.5">{t(`punch_${k}` as any)}</div>
              {punch && (
                <div className="text-[9px] mt-0.5 font-mono opacity-80">
                  {fmt(punch.punchedAt)}{!punch.insideGeofence && <span className="text-red-300"> ⚠</span>}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function tradePhoto(trade: string): string {
  const x = trade.toLowerCase();
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
        <MickeyMark size={44} />
        <div>
          <div className="text-2xl font-bold text-amber-400">Mickey</div>
          <div className="text-xs text-slate-400">Field worker app</div>
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
