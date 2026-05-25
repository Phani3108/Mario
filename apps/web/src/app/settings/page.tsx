'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MarioMark } from '../../components/MarioLogo';
import { apiFetch } from '../../lib/api';
import { useT } from '../../lib/i18n';
import { LangToggle } from '../../components/LangToggle';

type Settings = {
  accentColor: string;
  currency: string;
  primaryCity: string | null;
  defaultGeofenceRadiusM: number;
};

export default function SettingsPage() {
  const router = useRouter();
  const t = useT();
  const [org, setOrg] = useState<{ id: string; name: string } | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const token = typeof window !== 'undefined' ? localStorage.getItem('sf_token') : null;
  const headers = useCallback(
    () => ({ 'content-type': 'application/json', authorization: `Bearer ${token}` }),
    [token],
  );

  const load = useCallback(async () => {
    if (!token) { router.replace('/'); return; }
    setErr(null);
    try {
      const r = await apiFetch(`/orgs/me`, { headers: headers() });
      if (r.status === 401) { router.replace('/'); return; }
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? 'failed to load');
      const data = await r.json();
      setOrg(data.org ?? null);
      setSettings(data.settings ?? null);
      setLogoUrl(data.logoUrl ?? null);
    } catch (e: any) {
      setErr(e?.message ?? 'failed to load org settings');
    }
  }, [token, headers, router]);

  useEffect(() => { load(); }, [load]);

  async function uploadLogo(file: File) {
    setBusy(true); setErr(null); setInfo(null);
    try {
      const presign = await apiFetch(`/orgs/me/logo-presign`, {
        method: 'POST', headers: headers(),
        body: JSON.stringify({ contentType: file.type }),
      });
      if (!presign.ok) throw new Error((await presign.json().catch(() => ({}))).error ?? 'presign failed');
      const { uploadUrl } = await presign.json();
      const put = await fetch(uploadUrl, { method: 'PUT', headers: { 'content-type': file.type }, body: file });
      if (!put.ok) throw new Error('S3 upload failed');
      setInfo('Logo uploaded. Refreshing…');
      await load();
    } catch (e: any) {
      setErr(e?.message ?? 'upload failed');
    } finally {
      setBusy(false);
    }
  }

  async function saveSettings(patch: Partial<Settings>) {
    setBusy(true); setErr(null); setInfo(null);
    try {
      const r = await apiFetch(`/orgs/me`, {
        method: 'PATCH', headers: headers(), body: JSON.stringify(patch),
      });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? 'save failed');
      setInfo('Saved.');
      await load();
    } catch (e: any) {
      setErr(e?.message ?? 'save failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-slate-900">
      <header className="bg-slate-950 text-slate-100 border-b border-slate-800">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center gap-3">
          <a href="/approvals" className="flex items-center gap-3">
            <MarioMark size={32} />
            <div className="font-extrabold tracking-tight">{t('appName')} · {t('settings')}</div>
          </a>
          <div className="ml-auto flex items-center gap-3">
            <LangToggle tone="dark" />
            <a href="/approvals" className="text-xs text-amber-400 hover:text-amber-300 underline">{t('back')}</a>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8 space-y-6">
        {err && <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{err}</div>}
        {info && <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-sm text-emerald-700">{info}</div>}

        <section className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <div className="text-[10px] uppercase tracking-widest text-slate-400 font-bold mb-1">{t('orgTitle')}</div>
          <div className="text-xl font-extrabold">{org?.name ?? '—'}</div>
          <div className="text-xs text-slate-500 mt-1">Org ID: <code className="text-[11px]">{org?.id ?? '—'}</code></div>
        </section>

        <section className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <div className="font-semibold mb-3">{t('brandLogo')}</div>
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-xl bg-slate-100 border border-slate-200 grid place-items-center overflow-hidden">
              {logoUrl
                ? <img src={logoUrl} alt="logo" className="w-full h-full object-contain" />
                : <MarioMark size={56} />}
            </div>
            <div className="flex-1">
              <button
                onClick={() => fileRef.current?.click()}
                disabled={busy}
                className="px-4 py-2 rounded-lg bg-amber-500 text-slate-900 font-bold text-sm hover:bg-amber-400 disabled:opacity-50"
              >
                {busy ? t('uploading') : t('uploadNewLogo')}
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) uploadLogo(f);
                  e.target.value = '';
                }}
              />
              <div className="text-xs text-slate-500 mt-2">{t('logoHelp')}</div>
            </div>
          </div>
        </section>

        <section className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="font-semibold">{t('brandDefaults')}</div>
          <div className="grid grid-cols-2 gap-4">
            <label className="block">
              <div className="text-[11px] uppercase tracking-wider text-slate-500 font-bold mb-1">{t('accentColour')}</div>
              <input
                type="color"
                value={settings?.accentColor ?? '#F59E0B'}
                onChange={(e) => setSettings((s) => s ? { ...s, accentColor: e.target.value } : s)}
                className="w-full h-10 rounded-md border border-slate-200 bg-white"
              />
            </label>
            <label className="block">
              <div className="text-[11px] uppercase tracking-wider text-slate-500 font-bold mb-1">{t('primaryCity')}</div>
              <input
                type="text"
                value={settings?.primaryCity ?? ''}
                onChange={(e) => setSettings((s) => s ? { ...s, primaryCity: e.target.value } : s)}
                placeholder="Hyderabad"
                className="w-full px-3 py-2 rounded-md border border-slate-200 text-sm"
              />
            </label>
            <label className="block">
              <div className="text-[11px] uppercase tracking-wider text-slate-500 font-bold mb-1">{t('currency')}</div>
              <input
                type="text"
                value={settings?.currency ?? 'INR'}
                onChange={(e) => setSettings((s) => s ? { ...s, currency: e.target.value } : s)}
                className="w-full px-3 py-2 rounded-md border border-slate-200 text-sm"
              />
            </label>
            <label className="block">
              <div className="text-[11px] uppercase tracking-wider text-slate-500 font-bold mb-1">{t('defaultGeofence')}</div>
              <input
                type="number"
                min={20}
                max={2000}
                value={settings?.defaultGeofenceRadiusM ?? 150}
                onChange={(e) => setSettings((s) => s ? { ...s, defaultGeofenceRadiusM: Number(e.target.value) } : s)}
                className="w-full px-3 py-2 rounded-md border border-slate-200 text-sm"
              />
            </label>
          </div>
          <button
            disabled={busy || !settings}
            onClick={() => settings && saveSettings(settings)}
            className="px-4 py-2 rounded-lg bg-slate-900 text-white font-bold text-sm hover:bg-slate-800 disabled:opacity-50"
          >
            {busy ? t('saving') : t('save')}
          </button>
        </section>
      </main>
    </div>
  );
}
