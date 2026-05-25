/**
 * Web i18n — mirror of apps/field/src/i18n.ts so the dashboard can speak EN
 * and हिंदी side-by-side with the field PWA. Stored in localStorage as
 * `sf_lang` (same key) so a Hindi-preferring user sees Hindi in both apps.
 *
 * Usage:
 *   import { useT } from '@/lib/i18n';
 *   const t = useT();   // re-renders on language change
 *   return <button>{t('signIn')}</button>;
 *
 * On SSR / static-export prerender, `lang` defaults to 'en' (no localStorage
 * on the server). The first client render swaps to whatever's stored.
 */
import { useEffect, useState } from 'react';

export type Lang = 'en' | 'hi';

const DICT = {
  // ─── App-wide chrome ─────────────────────────────────────────────────────
  appName:        { en: 'Mario',                hi: 'मारियो' },
  fieldApp:       { en: 'Field app',            hi: 'फ़ील्ड ऐप' },
  settings:       { en: 'Settings',             hi: 'सेटिंग्स' },
  signIn:         { en: 'Sign in',              hi: 'साइन इन' },
  signInArrow:    { en: 'Sign in →',            hi: 'साइन इन →' },
  signOut:        { en: 'Sign out',             hi: 'साइन आउट' },
  cancel:         { en: 'Cancel',               hi: 'रद्द करें' },
  save:           { en: 'Save changes',         hi: 'बदलाव सहेजें' },
  saving:         { en: 'Saving…',              hi: 'सहेज रहे…' },
  loading:        { en: 'Loading…',             hi: 'लोड हो रहा…' },
  required:       { en: 'required',             hi: 'अनिवार्य' },
  optional:       { en: 'optional',             hi: 'वैकल्पिक' },
  back:           { en: '← Back',               hi: '← वापस' },
  english:        { en: 'English',              hi: 'अंग्रेज़ी' },
  hindi:          { en: 'Hindi',                hi: 'हिंदी' },
  language:       { en: 'Language',             hi: 'भाषा' },

  // ─── Landing ─────────────────────────────────────────────────────────────
  eyebrow:        { en: 'PROOF, NOT PROMISES.',
                    hi: 'सबूत, वादे नहीं।' },
  heroL1:         { en: 'A flat takes a year to build.',
                    hi: 'एक फ़्लैट बनने में एक साल लगता है।' },
  heroL2:         { en: 'About four minutes to inspect.',
                    hi: 'जाँचने में लगभग चार मिनट।' },
  heroL3:         { en: 'We changed the math.',
                    hi: 'हमने यह गणित बदल दिया।' },
  heroSub:        {
    en: 'Mario is the proof layer for residential real estate. Every tile, every coat, every fitting — photographed on site, geofenced to the square metre, approved by four people who put their name on it.',
    hi: 'मारियो आवासीय रियल एस्टेट के लिए सबूत-परत है। हर टाइल, हर कोट, हर फ़िटिंग — साइट पर तस्वीर, हर वर्ग मीटर तक जियोफ़ेंस, चार ज़िम्मेदार लोगों की मंज़ूरी।',
  },
  heroAdd:        { en: 'Add a project in a minute. Add a tower in five.',
                    hi: 'एक मिनट में प्रोजेक्ट जोड़ें। पाँच में टावर।' },
  ctaAddProject:  { en: '+ Add a project →',    hi: '+ प्रोजेक्ट जोड़ें →' },
  ctaHowItWorks:  { en: 'How it works',         hi: 'कैसे काम करता है' },
  whySwitch:      { en: 'Why developers switch to Mario',
                    hi: 'डेवलपर मारियो पर क्यों आते हैं' },

  reason1Title:   { en: "The photograph that doesn't lie.",
                    hi: 'वह तस्वीर जो झूठ नहीं बोलती।' },
  reason1Body:    {
    en: "Every proof is watermarked client-side with task ID, GPS, and timestamp before it leaves the employee's phone. By the time it reaches your dashboard, it's already too honest to argue with.",
    hi: 'हर सबूत कर्मचारी के फ़ोन पर ही टास्क आईडी, GPS और टाइमस्टैम्प से वॉटरमार्क हो जाता है। डैशबोर्ड तक पहुँचते-पहुँचते वह विवाद से परे होती है।',
  },
  reason2Title:   { en: 'Four signatures. Four levels of conscience.',
                    hi: 'चार हस्ताक्षर। चार ज़मीर।' },
  reason2Body:    {
    en: 'Supervisor, Quality, Manager, Client. Each one signs with their name. After three rejections, the task escalates automatically. Defects don’t walk past four people.',
    hi: 'सुपरवाइज़र, क्वालिटी, मैनेजर, क्लाइंट। हर कोई अपने नाम से मंज़ूरी देता है। तीन रिजेक्ट के बाद टास्क अपने-आप एस्केलेट हो जाता है। दोष चार लोगों से बच कर नहीं निकलते।',
  },
  reason3Title:   { en: 'Payroll that matches reality.',
                    hi: 'वेतन जो हक़ीक़त से मेल खाता है।' },
  reason3Body:    {
    en: "Hours billed are hours photographed on site. Inside the geofence, or you don’t get the minute. The math at month-end matches the foreman’s view at day-end.",
    hi: 'जिन घंटों का बिल बनता है, वे साइट पर तस्वीरों से प्रमाणित होते हैं। जियोफ़ेंस के अंदर हो तभी मिनट गिने जाते हैं।',
  },
  chainLabel:     { en: 'The chain',            hi: 'मंज़ूरी की क़तार' },
  chainWorker:    { en: 'Employee',             hi: 'कर्मचारी' },
  chainSup:       { en: 'Supervisor',           hi: 'सुपरवाइज़र' },
  chainQuality:   { en: 'Quality',              hi: 'क्वालिटी' },
  chainManager:   { en: 'Manager',              hi: 'मैनेजर' },
  chainClient:    { en: 'Client',               hi: 'क्लाइंट' },
  pricing:        { en: 'First 50 tasks and 14 days free. ₹49 per employee per month after that. No demo seats, no annual contracts.',
                    hi: 'पहले 50 टास्क और 14 दिन मुफ़्त। उसके बाद ₹49 प्रति कर्मचारी प्रति माह। कोई डेमो सीट नहीं, कोई वार्षिक अनुबंध नहीं।' },

  // ─── Login form ──────────────────────────────────────────────────────────
  loginDeskTitle: { en: 'DESK DASHBOARD',       hi: 'डेस्क डैशबोर्ड' },
  loginSubtitle:  { en: 'Dev login · any code accepted',
                    hi: 'डेव लॉगिन · कोई भी कोड स्वीकार्य' },
  devSeedAccount: { en: 'Dev seed account',     hi: 'डेमो खाता' },
  newContractor:  { en: 'New contractor? Create account →',
                    hi: 'नया ठेकेदार? खाता बनाएँ →' },

  // ─── Role labels ─────────────────────────────────────────────────────────
  roleEmployee:   { en: 'Employee',             hi: 'कर्मचारी' },
  roleSupervisor: { en: 'Supervisor',           hi: 'सुपरवाइज़र' },
  roleQuality:    { en: 'Quality',              hi: 'क्वालिटी' },
  roleManager:    { en: 'Manager',              hi: 'मैनेजर' },
  roleAccounts:   { en: 'Accounts',             hi: 'अकाउंट्स' },
  roleCEO:        { en: 'CEO',                  hi: 'सीईओ' },
  roleClient:     { en: 'Client',               hi: 'क्लाइंट' },

  // ─── Dashboard chrome ────────────────────────────────────────────────────
  navWorkflow:    { en: 'Workflow',             hi: 'कार्यप्रवाह' },
  navSites:       { en: 'Sites',                hi: 'साइट' },
  navMyTasks:     { en: 'My tasks',             hi: 'मेरे काम' },
  navApprovals:   { en: 'Approvals',            hi: 'मंज़ूरी' },
  navTasks:       { en: 'Tasks',                hi: 'काम' },
  navTimesheets:  { en: 'Timesheets',           hi: 'हाज़िरी' },
  navSop:         { en: 'SOP library',          hi: 'SOP पुस्तकालय' },
  navRework:      { en: 'Rework log',           hi: 'पुनः कार्य' },
  navReports:     { en: 'Reports',              hi: 'रिपोर्ट' },
  navSitesAdmin:  { en: 'Sites',                hi: 'साइट' },
  navPeople:      { en: 'People',               hi: 'लोग' },
  navOutbox:      { en: 'WhatsApp outbox',      hi: 'WhatsApp आउटबॉक्स' },
  navNewProject:  { en: '+ New project',        hi: '+ नया प्रोजेक्ट' },
  pendingShort:   { en: 'pending',              hi: 'बाक़ी' },
  demoMode:       { en: 'DEMO MODE',            hi: 'डेमो मोड' },

  // ─── Approvals view ──────────────────────────────────────────────────────
  approvalQueue:  { en: 'Approval queue',       hi: 'मंज़ूरी क़तार' },
  allCount:       { en: 'All',                  hi: 'सब' },
  filterAll:      { en: 'All',                  hi: 'सब' },
  approve:        { en: '✓ Approve',            hi: '✓ मंज़ूर' },
  reject:         { en: '✗ Reject',             hi: '✗ नामंज़ूर' },
  approveAll:     { en: 'Approve all',          hi: 'सब मंज़ूर' },
  clearSelection: { en: 'Clear',                hi: 'साफ़ करें' },
  selectedOf:     { en: 'selected of',          hi: 'चुने गए, कुल' },
  nothingWaiting: { en: 'Nothing waiting on you.',
                    hi: 'आपके लिए कुछ बाक़ी नहीं।' },
  goodJob:        { en: 'Good job. Site is on schedule.',
                    hi: 'बढ़िया। साइट समय पर है।' },
  noProjectsYet:  { en: 'No projects yet.',     hi: 'कोई प्रोजेक्ट नहीं।' },
  addFirstProject:{ en: 'Add your first project to start logging photo-proof.',
                    hi: 'पहला प्रोजेक्ट जोड़ें और सबूत-तस्वीर लेना शुरू करें।' },

  // ─── New project / site modal ────────────────────────────────────────────
  newSiteTitle:   { en: 'New site',             hi: 'नई साइट' },
  fieldName:      { en: 'Name',                 hi: 'नाम' },
  fieldKind:      { en: 'Kind',                 hi: 'प्रकार' },
  fieldAddress:   { en: 'Address',              hi: 'पता' },
  fieldLat:       { en: 'Lat',                  hi: 'अक्षांश' },
  fieldLng:       { en: 'Lng',                  hi: 'देशांतर' },
  fieldGeofenceM: { en: 'Geofence m',           hi: 'सीमा (मी)' },

  // ─── My tasks (Employee view) ────────────────────────────────────────────
  myTasksTitle:   { en: 'My tasks',             hi: 'मेरे काम' },
  openFieldApp:   { en: 'Open field app →',     hi: 'फ़ील्ड ऐप खोलें →' },
  groupActNeeded: { en: 'Action needed',        hi: 'काम बाक़ी' },
  groupAwaiting:  { en: 'Awaiting approval',    hi: 'मंज़ूरी का इंतज़ार' },
  groupDone:      { en: 'Done',                 hi: 'पूरा' },
  noTasksPlate:   { en: 'No tasks on your plate.',
                    hi: 'अभी कोई काम नहीं।' },
  noTasksSub:     { en: 'Your supervisor will assign work soon.',
                    hi: 'सुपरवाइज़र जल्दी ही काम सौंपेंगे।' },

  // ─── Settings ────────────────────────────────────────────────────────────
  orgTitle:       { en: 'Organization',         hi: 'संस्था' },
  brandLogo:      { en: 'Brand logo',           hi: 'ब्रांड लोगो' },
  uploadNewLogo:  { en: 'Upload new logo',      hi: 'नया लोगो अपलोड करें' },
  uploading:      { en: 'Uploading…',           hi: 'अपलोड हो रहा…' },
  logoHelp:       { en: 'PNG, JPG, WebP, or SVG. Square works best.',
                    hi: 'PNG, JPG, WebP या SVG। वर्गाकार सबसे अच्छा।' },
  brandDefaults:  { en: 'Brand & defaults',     hi: 'ब्रांड और डिफ़ॉल्ट' },
  accentColour:   { en: 'Accent colour',        hi: 'मुख्य रंग' },
  primaryCity:    { en: 'Primary city',         hi: 'मुख्य शहर' },
  currency:       { en: 'Currency',             hi: 'मुद्रा' },
  defaultGeofence:{ en: 'Default geofence (m)', hi: 'डिफ़ॉल्ट सीमा (मी)' },

  // ─── Onboard ─────────────────────────────────────────────────────────────
  onboardStep1:   { en: "Who's signing up?",    hi: 'कौन साइन-अप कर रहा है?' },
  onboardStep2:   { en: 'Your company',         hi: 'आपकी कंपनी' },
  onboardStep3:   { en: 'Your first site',      hi: 'आपकी पहली साइट' },
  onboardStep4:   { en: 'Invite your team',     hi: 'अपनी टीम बुलाएँ' },
  onboardStep5:   { en: "You're all set",       hi: 'सब तैयार है' },
  onboardOtpHint: { en: "We'll text you a code on WhatsApp/SMS to confirm.",
                    hi: 'पुष्टि के लिए हम WhatsApp/SMS पर कोड भेजेंगे।' },
  demoSkipBanner: { en: 'Demo mode: phone verification is skipped. Your "org" lives in this browser only.',
                    hi: 'डेमो मोड: फ़ोन सत्यापन छोड़ दिया गया। आपकी "संस्था" केवल इस ब्राउज़र में रहेगी।' },
  continueArrow:  { en: 'Continue →',           hi: 'जारी रखें →' },

  // ─── Common buttons / footer ─────────────────────────────────────────────
  newTask:        { en: '+ New task',           hi: '+ नया काम' },
  newSiteCta:     { en: '+ New site',           hi: '+ नई साइट' },
  newUserCta:     { en: '+ New person',         hi: '+ नया व्यक्ति' },
  createTask:     { en: 'Create task',          hi: 'काम बनाएँ' },
  createSite:     { en: 'Create site',          hi: 'साइट बनाएँ' },
  invite:         { en: 'Invite',               hi: 'बुलाएँ' },

  // ─── Quality dashboard ────────────────────────────────────────────────────
  qColTask:        { en: 'TASK',          hi: 'काम' },
  qColWorker:      { en: 'WORKER',        hi: 'कर्मचारी' },
  qColPhoto:       { en: 'PHOTO',         hi: 'तस्वीर' },
  qColSopTest:     { en: 'SOP TEST',      hi: 'SOP जाँच' },
  qColRisk:        { en: 'RISK',          hi: 'जोखिम' },
  qColStart:       { en: 'START',         hi: 'शुरू' },
  qColEnd:         { en: 'END',           hi: 'अंत' },
  qColDur:         { en: 'DUR',           hi: 'अवधि' },
  qColVsEst:       { en: 'VS EST',        hi: 'अनुमान बनाम' },
  qColAction:      { en: 'ACTION',        hi: 'क्रिया' },
  qRiskAny:        { en: 'Risk: any',     hi: 'जोखिम: कोई भी' },
  qRiskLow:        { en: 'LOW',           hi: 'कम' },
  qRiskMed:        { en: 'MED',           hi: 'मध्यम' },
  qRiskHigh:       { en: 'HIGH',          hi: 'उच्च' },
  qSubmittedToday: { en: 'Submitted: today',  hi: 'भेजा: आज' },
  qSopReference:   { en: 'SOP REFERENCE',     hi: 'SOP संदर्भ' },
  qPassCriteria:   { en: 'PASS CRITERIA',     hi: 'पास मानदंड' },
  qCommonRejects:  { en: 'COMMON REJECTS',    hi: 'सामान्य अस्वीकार' },
  qReferencePhoto: { en: 'reference photo',   hi: 'संदर्भ तस्वीर' },
  qExpand:         { en: 'expand ↗',          hi: 'विस्तृत ↗' },
  qShortcutHint:   { en: '⇧A approve · ⇧R reject · J/K nav',
                     hi: '⇧A मंज़ूर · ⇧R नामंज़ूर · J/K नेविगेट' },
  qApproveBoth:    { en: 'Approve',                hi: 'मंज़ूर करें' },
  qRejectReason:   { en: 'Reject with reason…',    hi: 'कारण के साथ नामंज़ूर…' },
  qSelectedOf:     { en: 'selected of',       hi: 'चुने गए, कुल' },
  qNoTaskSelected: { en: 'Click a row to load its SOP reference, or use J/K to navigate.',
                     hi: 'एक पंक्ति पर क्लिक करें ताकि SOP संदर्भ लोड हो, या J/K से नेविगेट करें।' },

  // ─── Supervisor approval cards (mockup #4) ────────────────────────────────
  supPendingChip:   { en: 'PENDING',         hi: 'बाक़ी' },
  supRiskSuffix:    { en: 'RISK',            hi: 'जोखिम' },
  supGeoOk:         { en: 'GEO ✓',           hi: 'GPS ✓' },
  supGeoOut:        { en: 'GEO ⚠ outside',   hi: 'GPS ⚠ बाहर' },
  supSelectAll:     { en: 'Select all',      hi: 'सब चुनें' },
  supClearAll:      { en: 'Clear',           hi: 'साफ़ करें' },
  supBulkApprove:   { en: 'Bulk approve',    hi: 'सब मंज़ूर' },
  supApproveBtn:    { en: '✓ APPROVE',       hi: '✓ मंज़ूर' },
  supRejectBtn:     { en: '✗ REJECT',        hi: '✗ नामंज़ूर' },
  supEmptyTitle:    { en: 'Inbox zero.',     hi: 'कुछ बाक़ी नहीं।' },
  supEmptySub:      { en: 'Nothing waiting on your approval right now. Your site is on schedule.',
                      hi: 'अभी कुछ भी आपकी मंज़ूरी पर नहीं है। आपकी साइट समय पर है।' },
  supReworkTag:     { en: 'rework',          hi: 'पुनः कार्य' },

  // ─── Manager command center ──────────────────────────────────────────────
  mgrTitle:         { en: 'Command center',      hi: 'कमांड सेंटर' },
  mgrSubtitle:      { en: 'Today across every project',
                      hi: 'आज सभी प्रोजेक्ट पर' },
  mgrKpiActive:     { en: 'Active sites',        hi: 'सक्रिय साइट' },
  mgrKpiInProg:     { en: 'In progress',         hi: 'चल रहा' },
  mgrKpiPending:    { en: 'Pending approvals',   hi: 'मंज़ूरी बाक़ी' },
  mgrKpiRework:     { en: 'Rework escalations',  hi: 'पुनः कार्य एस्केलेशन' },
  mgrPortfolio:     { en: 'Site portfolio',      hi: 'साइट पोर्टफ़ोलियो' },
  mgrActivity:      { en: 'Recent activity',     hi: 'हाल की गतिविधि' },
  mgrQuickActions:  { en: 'Quick actions',       hi: 'त्वरित क्रियाएँ' },
  mgrEscalations:   { en: 'Escalations',         hi: 'एस्केलेशन' },
  mgrViewQueue:     { en: 'View approval queue', hi: 'मंज़ूरी क़तार देखें' },
  mgrAtRisk:        { en: 'at risk',             hi: 'जोखिम में' },
  mgrOnTrack:       { en: 'on track',            hi: 'समय पर' },
  mgrBlocked:       { en: 'blocked',             hi: 'अवरुद्ध' },
  mgrTasks:         { en: 'tasks',               hi: 'काम' },
  mgrCrew:          { en: 'crew',                hi: 'टीम' },
  mgrTodayTasks:    { en: 'Today',               hi: 'आज' },
  mgrPctDone:       { en: '% done',              hi: '% पूरा' },
  mgrNoActivity:    { en: 'No activity yet today.', hi: 'आज अभी तक कोई गतिविधि नहीं।' },
  mgrSinceMin:      { en: 'min ago',             hi: 'मिनट पहले' },
  mgrSinceHr:       { en: 'h ago',               hi: 'घं पहले' },
  mgrJustNow:       { en: 'just now',            hi: 'अभी' },
} as const;

type Key = keyof typeof DICT;

let lang: Lang =
  typeof window !== 'undefined'
    ? (((window.localStorage?.getItem('sf_lang') as Lang) || 'en'))
    : 'en';

const listeners = new Set<() => void>();

export function getLang(): Lang { return lang; }

export function setLang(l: Lang) {
  lang = l;
  try { if (typeof window !== 'undefined') window.localStorage.setItem('sf_lang', l); } catch { /* noop */ }
  listeners.forEach((f) => { try { f(); } catch { /* noop */ } });
}

export function onLangChange(f: () => void): () => void {
  listeners.add(f);
  return () => { listeners.delete(f); };
}

export function t(key: Key): string {
  const entry = DICT[key];
  if (!entry) return String(key);
  return (entry as any)[lang] ?? (entry as any).en;
}

/** React hook — components re-render when the user toggles language. */
export function useT(): typeof t {
  const [, force] = useState(0);
  useEffect(() => onLangChange(() => force((n) => n + 1)), []);
  return t;
}

/** Convert a role string (employee/supervisor/...) to its localized label. */
export function localizedRole(role: string | undefined | null): string {
  if (!role) return '—';
  const map: Record<string, Key> = {
    employee: 'roleEmployee', supervisor: 'roleSupervisor', quality: 'roleQuality',
    manager: 'roleManager', accounts: 'roleAccounts', ceo: 'roleCEO', client: 'roleClient',
  };
  const k = map[role.toLowerCase()];
  return k ? t(k) : role;
}
