'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { MickeyMark } from '../../components/MickeyLogo';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

type Step = 1 | 2 | 3 | 4 | 5;

export default function OnboardPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Step 1 — identity
  const [founderName, setFounderName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [signupToken, setSignupToken] = useState<string | null>(null);

  // Step 2 — company
  const [companyName, setCompanyName] = useState('');
  const [primaryCity, setPrimaryCity] = useState('Bengaluru');
  const [currency, setCurrency] = useState('INR');
  const [accentColor, setAccentColor] = useState('#F59E0B');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  // Step 3 — first site
  const [siteName, setSiteName] = useState('');
  const [siteAddress, setSiteAddress] = useState('');
  const [siteLat, setSiteLat] = useState<number | ''>('');
  const [siteLng, setSiteLng] = useState<number | ''>('');
  const [siteKind, setSiteKind] = useState<'APARTMENT' | 'VILLA' | 'OFFICE' | 'OTHER'>('APARTMENT');
  const [geofence, setGeofence] = useState(50);

  // Step 4 — team
  type Invite = { phone: string; role: string };
  const [invites, setInvites] = useState<Invite[]>([{ phone: '', role: 'supervisor' }]);

  // Auth token after signup
  const [token, setToken] = useState<string | null>(null);

  async function sendSignupOtp() {
    setBusy(true); setErr(null);
    try {
      const res = await fetch(`${API}/auth/otp/request`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ phone, purpose: 'SIGNUP' }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? 'could not send code');
      const data = await res.json();
      setOtpSent(true);
      if (data.devCode) setCode(String(data.devCode));
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  }

  async function verifySignupOtp() {
    setBusy(true); setErr(null);
    try {
      const res = await fetch(`${API}/auth/otp/verify`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ phone, code, purpose: 'SIGNUP' }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? 'invalid code');
      const data = await res.json();
      setSignupToken(data.signupToken);
      setStep(2);
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  }

  async function submitCompany() {
    if (!signupToken) { setErr('lost signup token, restart'); return; }
    setBusy(true); setErr(null);
    try {
      // 1) create org + founder
      const res = await fetch(`${API}/orgs/signup`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          phone, signupToken, founderName, email: email || undefined,
          companyName, primaryCity, currency, accentColor,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? 'signup failed');
      const data = await res.json();
      setToken(data.token);
      localStorage.setItem('sf_token', data.token);
      localStorage.setItem('sf_user', JSON.stringify(data.user));

      // 2) upload logo if provided
      if (logoFile) {
        const presign = await fetch(`${API}/orgs/me/logo-presign`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', authorization: `Bearer ${data.token}` },
          body: JSON.stringify({ contentType: logoFile.type }),
        });
        if (presign.ok) {
          const { uploadUrl } = await presign.json();
          await fetch(uploadUrl, { method: 'PUT', headers: { 'content-type': logoFile.type }, body: logoFile });
        }
      }
      setStep(3);
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  }

  async function submitSite() {
    if (!token) return;
    setBusy(true); setErr(null);
    try {
      const res = await fetch(`${API}/sites`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({
          name: siteName,
          address: siteAddress,
          lat: typeof siteLat === 'number' ? siteLat : 0,
          lng: typeof siteLng === 'number' ? siteLng : 0,
          kind: siteKind,
          geofenceRadiusM: geofence,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? 'failed to create site');
      setStep(4);
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  }

  async function submitInvites() {
    if (!token) return;
    setBusy(true); setErr(null);
    try {
      for (const inv of invites) {
        if (!inv.phone || inv.phone.length < 8) continue;
        await fetch(`${API}/users`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
          body: JSON.stringify({
            name: inv.phone, role: inv.role, phone: inv.phone, email: null,
            siteId: null, joiningDate: null, salaryMonthly: null,
          }),
        });
      }
      setStep(5);
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  }

  function pickLogo(f: File | null) {
    setLogoFile(f);
    if (f) {
      const r = new FileReader();
      r.onload = () => setLogoPreview(String(r.result));
      r.readAsDataURL(f);
    } else setLogoPreview(null);
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <MickeyMark size={36} />
          <div>
            <div className="font-bold">Mickey · Setup</div>
            <div className="text-[11px] text-slate-400">Step {step} of 5</div>
          </div>
        </div>
        <a href="/" className="text-xs text-slate-500 hover:text-amber-300">← back to login</a>
      </header>

      <div className="max-w-2xl mx-auto px-5 py-10">
        {/* Step indicator */}
        <div className="flex gap-2 mb-8">
          {[1, 2, 3, 4, 5].map((s) => (
            <div key={s} className={`flex-1 h-1.5 rounded-full ${s <= step ? 'bg-amber-400' : 'bg-slate-800'}`} />
          ))}
        </div>

        {err && (
          <div className="mb-4 text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">{err}</div>
        )}

        {step === 1 && (
          <section className="space-y-4">
            <h1 className="text-2xl font-extrabold">Who's signing up?</h1>
            <p className="text-sm text-slate-400">We'll text you a code on WhatsApp/SMS to confirm.</p>
            <Field label="Your name" value={founderName} onChange={setFounderName} placeholder="e.g. Anita Reddy" />
            <Field label="Phone (with country code)" value={phone} onChange={(v) => setPhone(v.replace(/[^\d+]/g, ''))} placeholder="+91XXXXXXXXXX" />
            <Field label="Email (optional)" value={email} onChange={setEmail} placeholder="founder@yourcompany.in" />
            {!otpSent ? (
              <button disabled={busy || !founderName || phone.length < 8} onClick={sendSignupOtp}
                className="w-full py-3 rounded-xl bg-amber-500 text-slate-900 font-extrabold disabled:opacity-50">
                {busy ? 'Sending…' : 'Send code →'}
              </button>
            ) : (
              <>
                <Field label="6-digit code" value={code} onChange={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))} placeholder="------" />
                <button disabled={busy || code.length !== 6} onClick={verifySignupOtp}
                  className="w-full py-3 rounded-xl bg-amber-500 text-slate-900 font-extrabold disabled:opacity-50">
                  {busy ? 'Verifying…' : 'Verify & continue →'}
                </button>
                <button onClick={() => { setOtpSent(false); setCode(''); }} className="text-xs text-slate-400 hover:text-amber-300">change phone</button>
              </>
            )}
          </section>
        )}

        {step === 2 && (
          <section className="space-y-4">
            <h1 className="text-2xl font-extrabold">Your company</h1>
            <p className="text-sm text-slate-400">This becomes your dashboard branding.</p>
            <Field label="Company name" value={companyName} onChange={setCompanyName} placeholder="e.g. Reddy Constructions Pvt Ltd" />
            <Field label="Primary city" value={primaryCity} onChange={setPrimaryCity} />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Currency" value={currency} onChange={(v) => setCurrency(v.toUpperCase().slice(0, 3))} />
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Brand accent</label>
                <input type="color" value={accentColor} onChange={(e) => setAccentColor(e.target.value)}
                  className="w-full h-11 rounded-lg bg-slate-900 border border-slate-700 cursor-pointer" />
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Company logo (optional)</label>
              <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml"
                onChange={(e) => pickLogo(e.target.files?.[0] ?? null)}
                className="w-full text-xs text-slate-300" />
              {logoPreview && <img src={logoPreview} alt="logo preview" className="mt-3 h-16 w-16 object-contain rounded-lg bg-white p-1" />}
            </div>
            <button disabled={busy || !companyName} onClick={submitCompany}
              className="w-full py-3 rounded-xl bg-amber-500 text-slate-900 font-extrabold disabled:opacity-50">
              {busy ? 'Creating company…' : 'Create company →'}
            </button>
          </section>
        )}

        {step === 3 && (
          <section className="space-y-4">
            <h1 className="text-2xl font-extrabold">Your first site</h1>
            <p className="text-sm text-slate-400">You can add more sites later from the dashboard.</p>
            <Field label="Site name" value={siteName} onChange={setSiteName} placeholder="e.g. Prestige Tower A" />
            <Field label="Address" value={siteAddress} onChange={setSiteAddress} placeholder="Street, area, city" />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Latitude" value={String(siteLat)} onChange={(v) => setSiteLat(v ? Number(v) : '')} placeholder="12.9716" />
              <Field label="Longitude" value={String(siteLng)} onChange={(v) => setSiteLng(v ? Number(v) : '')} placeholder="77.5946" />
            </div>
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Site kind</label>
              <select value={siteKind} onChange={(e) => setSiteKind(e.target.value as any)}
                className="w-full px-3 py-2.5 rounded-lg bg-slate-900 border border-slate-700">
                <option value="APARTMENT">Apartment / Tower</option>
                <option value="VILLA">Villa</option>
                <option value="OFFICE">Office / Commercial</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
            <Field label={`Geofence radius (${geofence} m)`} value={String(geofence)} onChange={(v) => setGeofence(Number(v) || 50)} placeholder="50" />
            <div className="flex gap-2">
              <button onClick={() => setStep(4)} className="flex-1 py-3 rounded-xl bg-slate-800 text-slate-300 font-semibold">Skip for now</button>
              <button disabled={busy || !siteName || siteLat === '' || siteLng === ''} onClick={submitSite}
                className="flex-[2] py-3 rounded-xl bg-amber-500 text-slate-900 font-extrabold disabled:opacity-50">
                {busy ? 'Creating site…' : 'Add site →'}
              </button>
            </div>
          </section>
        )}

        {step === 4 && (
          <section className="space-y-4">
            <h1 className="text-2xl font-extrabold">Invite your team</h1>
            <p className="text-sm text-slate-400">They'll get a WhatsApp message with a link to the field app.</p>
            {invites.map((inv, i) => (
              <div key={i} className="flex gap-2">
                <input value={inv.phone} onChange={(e) => {
                  const next = [...invites]; next[i] = { ...inv, phone: e.target.value.replace(/[^\d+]/g, '') }; setInvites(next);
                }} placeholder="+91XXXXXXXXXX"
                  className="flex-[2] px-3 py-2.5 rounded-lg bg-slate-900 border border-slate-700" />
                <select value={inv.role} onChange={(e) => {
                  const next = [...invites]; next[i] = { ...inv, role: e.target.value }; setInvites(next);
                }} className="flex-1 px-3 py-2.5 rounded-lg bg-slate-900 border border-slate-700">
                  <option value="supervisor">Supervisor</option>
                  <option value="quality">Quality</option>
                  <option value="manager">Manager</option>
                  <option value="accounts">Accounts</option>
                  <option value="worker">Worker</option>
                  <option value="client">Client</option>
                </select>
              </div>
            ))}
            {invites.length < 10 && (
              <button onClick={() => setInvites([...invites, { phone: '', role: 'supervisor' }])}
                className="text-xs text-amber-400 hover:text-amber-300">+ add another</button>
            )}
            <div className="flex gap-2">
              <button onClick={() => setStep(5)} className="flex-1 py-3 rounded-xl bg-slate-800 text-slate-300 font-semibold">Skip for now</button>
              <button disabled={busy} onClick={submitInvites}
                className="flex-[2] py-3 rounded-xl bg-amber-500 text-slate-900 font-extrabold disabled:opacity-50">
                {busy ? 'Sending invites…' : 'Send invites →'}
              </button>
            </div>
          </section>
        )}

        {step === 5 && (
          <section className="space-y-5 text-center">
            <div className="text-5xl">🎉</div>
            <h1 className="text-2xl font-extrabold">You're all set, {founderName.split(' ')[0]}!</h1>
            <p className="text-sm text-slate-400">
              Your free trial runs for 14 days · 50 active tasks.<br />
              Head to the dashboard to create your first task.
            </p>
            <button onClick={() => router.replace('/approvals')}
              className="w-full py-3 rounded-xl bg-amber-500 text-slate-900 font-extrabold">
              Open dashboard →
            </button>
          </section>
        )}
      </div>
    </main>
  );
}

function Field({ label, value, onChange, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">{label}</label>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="w-full px-3.5 py-3 rounded-lg bg-slate-900 border border-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500/60 focus:border-amber-500/60" />
    </div>
  );
}
