'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MarioMark } from '../components/MarioLogo';
import { apiFetch } from '../lib/api';
import { useT } from '../lib/i18n';
import { LangToggle } from '../components/LangToggle';
// Show dev preset login on localhost or when explicitly enabled. Production builds
// served from a real host with NEXT_PUBLIC_DEV_AUTH unset will hide it.
const DEV_AUTH = true; // Force dev login for all environments

// `labelKey` is i18n; rendered via t(labelKey) so the preset chips speak the
// user's chosen language.
const DEV_PRESETS = [
  { id: 'ceo@siteflow.local',        labelKey: 'roleCEO',        icon: '◆' },
  { id: 'accounts@siteflow.local',   labelKey: 'roleAccounts',   icon: '₹' },
  { id: 'manager@siteflow.local',    labelKey: 'roleManager',    icon: '◈' },
  { id: 'quality@siteflow.local',    labelKey: 'roleQuality',    icon: '✦' },
  { id: '+919000000110',             labelKey: 'roleSupervisor', icon: '▲' },
  { id: '+919000000111',             labelKey: 'roleEmployee',   icon: '●' },
  { id: 'client@siteflow.local',     labelKey: 'roleClient',     icon: '◉' },
] as const;

type Step = 'phone' | 'code' | 'devLogin';

export default function LoginPage() {
  const t = useT();
  const [step] = useState<Step>('devLogin');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [devId, setDevId] = useState('quality@siteflow.local');
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (typeof window !== 'undefined' && localStorage.getItem('sf_token')) {
      router.replace('/approvals');
    }
  }, [router]);

  // OTP login is disabled; requestOtp is unused.

  async function verifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      const res = await apiFetch(`/auth/otp/verify`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ phone, code, purpose: 'LOGIN' }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? 'invalid code');
      const data = await res.json();
      localStorage.setItem('sf_token', data.token);
      localStorage.setItem('sf_user', JSON.stringify(data.user));
      router.replace('/approvals');
    } catch (e: any) { setErr(e.message); }
    finally { setBusy(false); }
  }

  async function devLogin(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      const res = await apiFetch(`/auth/login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ phoneOrEmail: devId, devCode: '000000' }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? 'login failed');
      const data = await res.json();
      localStorage.setItem('sf_token', data.token);
      localStorage.setItem('sf_user', JSON.stringify(data.user));
      router.replace('/approvals');
    } catch (e: any) { setErr(e.message); }
    finally { setBusy(false); }
  }

  return (
    <main className="min-h-screen blueprint-grid text-slate-100 relative overflow-hidden">
      {/* Animated ambient layers */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 -left-24 w-[420px] h-[420px] rounded-full bg-amber-500/20 blur-3xl sf-float" />
        <div className="absolute top-40 -right-24 w-[360px] h-[360px] rounded-full bg-indigo-500/10 blur-3xl sf-float-slow" />
        <div className="absolute top-1/3 left-0 right-0 h-px bg-gradient-to-r from-transparent via-amber-400/40 to-transparent sf-drift" />
        <div className="absolute top-2/3 left-0 right-0 h-px bg-gradient-to-r from-transparent via-emerald-400/30 to-transparent sf-drift" style={{ animationDelay: '4s' }} />
        {/* Floating crane silhouette */}
        <svg className="absolute right-6 top-10 w-40 h-40 text-amber-400/30 sf-float-slow hidden md:block" viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M50 90 V20 H10 M50 20 H90 M50 30 V20 M30 30 V20 M70 30 V20 M50 90 H30 M50 90 H70" />
          <circle cx="50" cy="20" r="3" fill="currentColor" />
          <path d="M50 30 L40 50 M50 30 L60 50" />
        </svg>
        {/* Floating hardhat */}
        <svg className="absolute left-10 bottom-20 w-28 h-28 text-amber-400/40 sf-float hidden md:block" viewBox="0 0 100 100" fill="currentColor">
          <path d="M15 70 Q15 35 50 35 Q85 35 85 70 Z" />
          <rect x="10" y="68" width="80" height="8" rx="2" />
          <rect x="46" y="20" width="8" height="20" rx="2" />
        </svg>
      </div>

      {/* Top nav */}
      <header className="relative z-10 border-b border-white/5 backdrop-blur bg-slate-950/40">
        <div className="max-w-6xl mx-auto px-5 py-4 flex items-center gap-3">
          <a href="/" className="flex items-center gap-3 group" aria-label="Mario home">
            <MarioMark size={40} className="group-hover:scale-105 transition" />
            <div className="leading-tight">
              <div className="font-bold tracking-tight">{t('appName')}</div>
              <div className="text-[11px] text-slate-400">{t('eyebrow')}</div>
            </div>
          </a>
          <div className="ml-auto flex items-center gap-2 text-xs">
            <LangToggle tone="dark" />
            <span className="hidden sm:inline-flex px-2 py-1 rounded-md bg-amber-500/10 text-amber-300 border border-amber-500/30 font-semibold">DEV BUILD</span>
          </div>
        </div>
      </header>

      {/* Hero + login */}
      <section className="relative z-10 max-w-6xl mx-auto px-5 py-10 md:py-16 grid md:grid-cols-2 gap-10 items-center">
        {/* Left — crisp hero copy in the Ogilvy voice */}
        <div className="sf-fade-up">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[10px] font-bold tracking-[0.22em] mb-5">
            <span className="relative flex w-2 h-2">
              <span className="absolute inset-0 rounded-full bg-amber-400 sf-pulse-ring" />
              <span className="relative inline-flex rounded-full w-2 h-2 bg-amber-400" />
            </span>
            {t('eyebrow')}
          </div>
          <h1 className="font-serif text-4xl sm:text-5xl font-extrabold tracking-tight leading-[1.05] text-slate-100">
            {t('heroL1')}<br />
            <span className="text-amber-400">{t('heroL2')}</span><br />
            {t('heroL3')}
          </h1>
          <p className="mt-5 text-slate-300 text-base md:text-lg max-w-md leading-relaxed">
            {t('heroSub')} <span className="text-slate-100 font-semibold">{t('heroAdd')}</span>
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            {/* Logged-in users get the 1-step modal at /approvals?new=site.
                First-time visitors get the full org-signup wizard at /onboard. */}
            <a
              href={typeof window !== 'undefined' && localStorage.getItem('sf_token') ? '/approvals?new=site' : '/onboard'}
              className="px-5 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-900 font-extrabold tracking-wide shadow-lg shadow-amber-500/20 transition"
            >
              {t('ctaAddProject')}
            </a>
            <a
              href="#how"
              className="px-5 py-3 rounded-xl border border-slate-700 text-slate-200 font-semibold hover:border-amber-400/60 hover:text-amber-300 transition"
            >
              {t('ctaHowItWorks')}
            </a>
          </div>
          <div className="mt-8 h-2 rounded-full overflow-hidden hi-vis-stripes opacity-60 max-w-md" />
        </div>

        {/* Right — login card */}
        <div className="sf-fade-up" style={{ animationDelay: '0.15s' }}>
          <form
            onSubmit={devLogin}
            className="relative w-full max-w-md mx-auto bg-slate-900/80 backdrop-blur border border-slate-700/80 rounded-2xl p-6 sm:p-7 shadow-2xl"
          >
            <span className="absolute -top-px -left-px w-8 h-8 border-t-2 border-l-2 border-amber-400 rounded-tl-2xl" />
            <span className="absolute -top-px -right-px w-8 h-8 border-t-2 border-r-2 border-amber-400 rounded-tr-2xl" />

            <div className="text-amber-400 text-[11px] font-bold tracking-[0.2em]">{t('loginDeskTitle')}</div>
            <div className="text-2xl font-extrabold mt-1">
              {t('signIn')}
            </div>
            <div className="text-xs text-slate-400 mb-6">
              {t('loginSubtitle')}
            </div>

            {step === 'phone' && (
              <>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                  Phone (with country code)
                </label>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/[^\d+]/g, ''))}
                  inputMode="tel"
                  autoComplete="tel"
                  className="w-full px-3.5 py-3 rounded-lg bg-slate-950 border border-slate-700 text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-amber-500/60 focus:border-amber-500/60 transition"
                  placeholder="+91XXXXXXXXXX"
                />
              </>
            )}

            {step === 'code' && (
              <>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                  6-digit code
                </label>
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  inputMode="numeric"
                  autoFocus
                  className="w-full px-3.5 py-3 rounded-lg bg-slate-950 border border-slate-700 text-slate-100 placeholder:text-slate-600 tracking-[0.5em] text-center text-lg focus:outline-none focus:ring-2 focus:ring-amber-500/60 focus:border-amber-500/60 transition"
                  placeholder="------"
                />
                {/* OTP flow is disabled; change phone button removed. */}
              </>
            )}

            {step === 'devLogin' && (
              <>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                  {t('devSeedAccount')}
                </label>
                <input
                  value={devId}
                  onChange={(e) => setDevId(e.target.value)}
                  className="w-full px-3.5 py-3 rounded-lg bg-slate-950 border border-slate-700 text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500/60 transition"
                />
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {DEV_PRESETS.map((r) => (
                    <button
                      type="button"
                      key={r.id}
                      onClick={() => setDevId(r.id)}
                      className={`text-left text-xs px-3 py-2 rounded-lg border transition ${
                        devId === r.id
                          ? 'bg-amber-500/15 border-amber-500/60 text-amber-200'
                          : 'bg-slate-800/60 border-slate-700 text-slate-300 hover:border-slate-500'
                      }`}
                    >
                      <span className="mr-1.5 opacity-70">{r.icon}</span>
                      <span className="font-semibold">{t(r.labelKey)}</span>
                    </button>
                  ))}
                </div>
              </>
            )}

            {info && (
              <div className="mt-4 text-sm text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-3 py-2">
                {info}
              </div>
            )}
            {err && (
              <div className="mt-4 text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
                {err}
              </div>
            )}

            <button
              disabled={busy}
              className="mt-6 w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-slate-900 font-extrabold tracking-wide disabled:opacity-60 transition shadow-lg shadow-amber-500/20"
            >
              {busy ? t('loading') : t('signInArrow')}
            </button>

            <div className="mt-5 pt-4 border-t border-slate-800 flex items-center justify-between gap-4 text-[12px]">
              <a className="text-amber-400 font-semibold hover:text-amber-300" href="/onboard">
                {t('newContractor')}
              </a>
              <a className="text-slate-500 underline" href="http://localhost:5174">
                {t('fieldApp')}
              </a>
            </div>
            {/* OTP login is disabled, only dev login available */}
          </form>
        </div>
      </section>

      {/* Three Ogilvy "reasons to believe" — long-copy cards under the fold */}
      <section id="how" className="relative z-10 max-w-6xl mx-auto px-5 py-14 border-t border-white/5">
        <div className="text-[10px] uppercase tracking-[0.3em] text-amber-300/80 mb-3 font-bold">{t('whySwitch')}</div>
        <div className="grid md:grid-cols-3 gap-5">
          {[
            { titleKey: 'reason1Title', bodyKey: 'reason1Body', icon: '▣' },
            { titleKey: 'reason2Title', bodyKey: 'reason2Body', icon: '✔' },
            { titleKey: 'reason3Title', bodyKey: 'reason3Body', icon: '₹' },
          ].map((card, i) => (
            <article
              key={card.titleKey}
              className="sf-fade-up rounded-2xl bg-slate-900/70 border border-slate-700/60 p-5 hover:border-amber-400/40 transition"
              style={{ animationDelay: `${0.1 + i * 0.08}s` }}
            >
              <div className="text-2xl text-amber-400/90 mb-2">{card.icon}</div>
              <div className="font-serif text-lg font-extrabold text-slate-100 leading-tight mb-2">{t(card.titleKey as any)}</div>
              <p className="text-sm text-slate-300 leading-relaxed">{t(card.bodyKey as any)}</p>
            </article>
          ))}
        </div>

        <div className="mt-10 flex flex-wrap items-end justify-between gap-6 pt-8 border-t border-white/5">
          <div>
            <div className="text-[10px] uppercase tracking-[0.3em] text-slate-500 mb-2">{t('chainLabel')}</div>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {(['chainWorker', 'chainSup', 'chainQuality', 'chainManager', 'chainClient'] as const).map((k, i, a) => (
                <div key={k} className="flex items-center gap-2 sf-fade-up" style={{ animationDelay: `${0.3 + i * 0.08}s` }}>
                  <span className="px-3 py-1.5 rounded-lg bg-slate-900/60 border border-slate-700 text-slate-200 font-semibold">{t(k)}</span>
                  {i < a.length - 1 && <span className="text-amber-500/60">›</span>}
                </div>
              ))}
            </div>
          </div>
          <div className="text-[13px] text-slate-400 max-w-xs">
            {t('pricing')}
          </div>
        </div>
      </section>
    </main>
  );
}
