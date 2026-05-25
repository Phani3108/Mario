'use client';
import { useEffect, useState } from 'react';
import { getLang, setLang, onLangChange, type Lang } from '../lib/i18n';

/**
 * Two-pill EN | हिं toggle, identical visual language to the field PWA's
 * version so users moving between apps see the same control. Persists to
 * localStorage under `sf_lang`.
 *
 * `tone` controls colour on dark vs. light surfaces:
 *  - "dark"  → for slate-950 headers (default)
 *  - "light" → for white headers
 */
export function LangToggle({ tone = 'dark', className = '' }: { tone?: 'dark' | 'light'; className?: string }) {
  const [cur, setCur] = useState<Lang>('en');
  useEffect(() => {
    setCur(getLang());
    return onLangChange(() => setCur(getLang()));
  }, []);

  const baseBtn = tone === 'dark'
    ? 'bg-slate-900 text-slate-400'
    : 'bg-slate-50 text-slate-500';
  const activeBtn = 'bg-amber-500 text-slate-900';
  const borderCls = tone === 'dark' ? 'border-slate-700' : 'border-slate-200';

  return (
    <div className={`text-[10px] font-bold rounded-md overflow-hidden border flex ${borderCls} ${className}`}>
      {(['en', 'hi'] as const).map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => setLang(l)}
          className={`px-2 py-1 transition ${cur === l ? activeBtn : baseBtn}`}
          aria-pressed={cur === l}
        >
          {l === 'en' ? 'EN' : 'हिं'}
        </button>
      ))}
    </div>
  );
}
