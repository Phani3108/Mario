/**
 * Tiny theme manager — light / dark. Persists to localStorage under
 * `sf_theme`. Mirrors the i18n.ts shape so components feel familiar.
 *
 * Tailwind dark mode is set to `darkMode: 'class'`, so we toggle the
 * `.dark` class on <html> as the single source of truth.
 *
 * Default on first load follows the OS preference; explicit toggle
 * wins and is remembered.
 */
import { useEffect, useState } from 'react';

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'sf_theme';
let theme: Theme = 'light';
const listeners = new Set<() => void>();

function osPrefersDark(): boolean {
  return typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function readStored(): Theme | null {
  if (typeof window === 'undefined') return null;
  const v = window.localStorage?.getItem(STORAGE_KEY);
  return v === 'light' || v === 'dark' ? v : null;
}

function applyToDom(t: Theme) {
  if (typeof document === 'undefined') return;
  const html = document.documentElement;
  if (t === 'dark') html.classList.add('dark');
  else html.classList.remove('dark');
  // CSS color-scheme so form-control defaults adopt the right palette.
  html.style.colorScheme = t;
}

// Hydrate once on first import in the browser.
if (typeof window !== 'undefined') {
  const stored = readStored();
  theme = stored ?? (osPrefersDark() ? 'dark' : 'light');
  applyToDom(theme);
}

export function getTheme(): Theme { return theme; }

export function setTheme(t: Theme) {
  theme = t;
  try { window.localStorage.setItem(STORAGE_KEY, t); } catch { /* noop */ }
  applyToDom(t);
  listeners.forEach((f) => { try { f(); } catch { /* noop */ } });
}

export function onThemeChange(f: () => void): () => void {
  listeners.add(f);
  return () => { listeners.delete(f); };
}

/** React hook: re-renders on toggle. */
export function useTheme(): [Theme, (t: Theme) => void] {
  const [cur, setCur] = useState<Theme>('light');
  useEffect(() => {
    setCur(getTheme());
    return onThemeChange(() => setCur(getTheme()));
  }, []);
  return [cur, setTheme];
}
