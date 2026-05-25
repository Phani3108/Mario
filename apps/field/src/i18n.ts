type Lang = 'en' | 'hi';

const DICT = {
  signIn:        { en: 'Sign in',        hi: 'साइन इन' },
  signInArrow:   { en: 'SIGN IN →',      hi: 'साइन इन →' },
  workerOrSup:   { en: 'Worker or supervisor', hi: 'मज़दूर या सुपरवाइज़र' },
  phone:         { en: 'Phone',          hi: 'फ़ोन' },
  signOut:       { en: 'Sign out',       hi: 'साइन आउट' },
  todayBanner:   { en: 'Today',          hi: 'आज' },
  yourTasks:     { en: 'Your tasks',     hi: 'आपके काम' },
  start:         { en: '▶ START',        hi: '▶ शुरू' },
  submitProof:   { en: '📷 SUBMIT PROOF', hi: '📷 सबूत भेजें' },
  waitingOn:     { en: 'waiting on',     hi: 'पर इंतज़ार' },
  noTasks:       { en: 'No tasks assigned. Ask supervisor.', hi: 'कोई काम नहीं। सुपरवाइज़र से पूछो।' },
  punch:         { en: 'Attendance',     hi: 'हाज़िरी' },
  punch_ENTRY:    { en: 'IN',     hi: 'प्रवेश' },
  punch_LUNCH_OUT:{ en: 'LUNCH ▶', hi: 'लंच शुरू' },
  punch_LUNCH_IN: { en: 'LUNCH ◀', hi: 'लंच ख़त्म' },
  punch_EXIT:     { en: 'OUT',    hi: 'निकास' },
  punched:       { en: 'Punched',        hi: 'दर्ज' },
  inside:        { en: 'inside',         hi: 'अंदर' },
  outside:       { en: 'OUTSIDE',        hi: 'बाहर' },
  geofence:      { en: 'geofence',       hi: 'सीमा' },
  takeSelfie:    { en: 'Take selfie',    hi: 'सेल्फ़ी लो' },
  queuedOffline: { en: 'Offline — queued. Will sync when online.',
                   hi: 'ऑफ़लाइन — सहेजा। ऑनलाइन होने पर भेजा जाएगा।' },
  syncingN:      { en: (n: number) => `Syncing ${n} queued…`,
                   hi: (n: number) => `${n} सहेजे जा रहे हैं…` },
  cancel:        { en: '✕ Cancel',       hi: '✕ रद्द' },
  capture:       { en: 'CAPTURE PROOF',  hi: 'सबूत लो' },
  captureSelfie: { en: 'PUNCH SELFIE',   hi: 'सेल्फ़ी हाज़िरी' },
} as const;

type Key = keyof typeof DICT;

let lang: Lang = (localStorage.getItem('sf_lang') as Lang) || 'en';
const listeners = new Set<() => void>();

export function getLang(): Lang { return lang; }
export function setLang(l: Lang) {
  lang = l;
  localStorage.setItem('sf_lang', l);
  listeners.forEach((f) => f());
}
export function onLangChange(f: () => void): () => void {
  listeners.add(f);
  return () => { listeners.delete(f); };
}

export function t(key: Key): string;
export function t(key: Key, arg: number): string;
export function t(key: Key, arg?: number): string {
  const entry = DICT[key];
  const val: any = (entry as any)[lang] ?? (entry as any).en;
  return typeof val === 'function' ? val(arg) : val;
}
