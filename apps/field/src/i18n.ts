type Lang = 'en' | 'hi';

const DICT = {
  // Auth + nav
  signIn:        { en: 'Sign in',        hi: 'साइन इन' },
  signInArrow:   { en: 'SIGN IN →',      hi: 'साइन इन →' },
  employeeOrSup: { en: 'Employee or supervisor', hi: 'मज़दूर या सुपरवाइज़र' },
  phone:         { en: 'Phone',          hi: 'फ़ोन' },
  signOut:       { en: 'Sign out',       hi: 'साइन आउट' },

  // Worker Home — top card
  onSite:        { en: 'ON SITE',        hi: 'साइट पर' },
  shift:         { en: 'SHIFT',          hi: 'पाली' },
  todayBanner:   { en: 'Today',          hi: 'आज' },

  // Tasks
  yourTasks:     { en: 'Your tasks',     hi: 'आपके काम' },
  pending:       { en: 'PENDING',        hi: 'बाक़ी' },
  start:         { en: '▶ START',        hi: '▶ शुरू' },
  acceptTask:    { en: '✓ Accept task',  hi: '✓ काम स्वीकारें' },
  submitProof:   { en: '📷 SUBMIT PROOF · END TASK', hi: '📷 सबूत भेजें · काम ख़त्म' },
  waitingOn:     { en: 'waiting on',     hi: 'पर इंतज़ार' },
  noTasks:       { en: 'No tasks assigned. Ask supervisor.', hi: 'कोई काम नहीं। सुपरवाइज़र से पूछो।' },
  startLabel:    { en: 'START',          hi: 'शुरू' },
  nowLabel:      { en: 'NOW',            hi: 'अभी' },
  targetLabel:   { en: 'TARGET',         hi: 'लक्ष्य' },
  done:          { en: 'DONE',           hi: 'पूरा' },
  inProgress:    { en: 'IN PROGRESS',    hi: 'चल रहा' },
  assigned:      { en: 'ASSIGNED',       hi: 'सौंपा' },
  rework:        { en: 'REWORK',         hi: 'फिर से' },

  // Punch / Timesheet
  punch:           { en: 'Attendance',     hi: 'हाज़िरी' },
  punchLunch:      { en: 'PUNCH LUNCH',    hi: 'लंच हाज़िरी' },
  punchLunchIn:    { en: '📷 PUNCH LUNCH IN', hi: '📷 लंच के बाद हाज़िरी' },
  punchEntry:      { en: '📷 PUNCH IN',    hi: '📷 सुबह हाज़िरी' },
  punchExit:       { en: '📷 PUNCH OUT',   hi: '📷 निकास हाज़िरी' },
  punch_ENTRY:     { en: 'IN',             hi: 'प्रवेश' },
  punch_LUNCH_OUT: { en: 'LUNCH ▶',        hi: 'लंच शुरू' },
  punch_LUNCH_IN:  { en: 'LUNCH ◀',        hi: 'लंच ख़त्म' },
  punch_EXIT:      { en: 'OUT',            hi: 'निकास' },
  punched:         { en: 'Punched',        hi: 'दर्ज' },
  exitEarly:       { en: '🚪 EXIT EARLY (needs reason)', hi: '🚪 जल्दी निकलें (कारण चाहिए)' },

  // Timesheet detail
  timesheet:     { en: 'TIMESHEET',     hi: 'हाज़िरी' },
  worked:        { en: 'Worked',        hi: 'काम' },
  todaysStamps:  { en: "TODAY'S STAMPS", hi: 'आज के निशान' },
  entryPunch:    { en: 'Entry punch',   hi: 'सुबह की हाज़िरी' },
  lunchOutLabel: { en: 'Lunch out',     hi: 'दोपहर का खाना शुरू' },
  lunchInLabel:  { en: 'Lunch in',      hi: 'खाना ख़त्म' },
  exitPunch:     { en: 'Exit punch',    hi: 'शाम की छुट्टी' },
  next:          { en: 'NEXT',          hi: 'अगला' },
  selfieGps:     { en: 'selfie + GPS',  hi: 'सेल्फ़ी + GPS' },
  selfieRequired:{ en: 'selfie required', hi: 'सेल्फ़ी चाहिए' },
  estPrefix:     { en: 'est',           hi: 'अनुमान' },
  duePrefix:     { en: 'due',           hi: 'देय' },
  site:          { en: 'Site',          hi: 'साइट' },
  network:       { en: 'Network',       hi: 'नेटवर्क' },
  inQueue:       { en: 'in queue',      hi: 'क़तार में' },

  // Geofence / capture HUD
  inside:        { en: 'INSIDE',         hi: 'अंदर' },
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
  siteLocked:    { en: 'SITE LOCKED',    hi: 'साइट लॉक' },
  geoOk:         { en: 'GEO ✓',          hi: 'GPS ✓' },
  proofWord:     { en: 'Proof',          hi: 'सबूत' },
  flash:         { en: 'FLASH',          hi: 'फ़्लैश' },
  video:         { en: 'VIDEO',          hi: 'वीडियो' },

  // Bottom nav
  navTasks:      { en: 'TASKS',          hi: 'काम' },
  navTime:       { en: 'TIME',           hi: 'समय' },
  navMe:         { en: 'ME',             hi: 'मैं' },

  // Me tab
  profileTitle:  { en: 'Profile',        hi: 'प्रोफ़ाइल' },
  language:      { en: 'Language',       hi: 'भाषा' },
  account:       { en: 'Account',        hi: 'खाता' },
  myRole:        { en: 'Role',           hi: 'भूमिका' },
  mySite:        { en: 'Site',           hi: 'साइट' },
  device:        { en: 'Device',         hi: 'डिवाइस' },
} as const;

type Key = keyof typeof DICT;

let lang: Lang = (typeof localStorage !== 'undefined' && (localStorage.getItem('sf_lang') as Lang)) || 'en';
const listeners = new Set<() => void>();

export function getLang(): Lang { return lang; }
export function setLang(l: Lang) {
  lang = l;
  try { localStorage.setItem('sf_lang', l); } catch { /* noop */ }
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
  if (!entry) return String(key);
  const val: any = (entry as any)[lang] ?? (entry as any).en;
  return typeof val === 'function' ? val(arg) : val;
}
