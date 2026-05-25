'use client';
import { useTheme } from '../lib/theme';

/**
 * Two-pill ☀ | ☾ toggle, sits next to LangToggle in the header.
 *
 * `tone` controls colour on dark vs. light surfaces:
 *   - "dark"  → for slate-950 headers (default)
 *   - "light" → for white headers
 */
export function ThemeToggle({ tone = 'dark', className = '' }: { tone?: 'dark' | 'light'; className?: string }) {
  const [cur, setTheme] = useTheme();

  const baseBtn = tone === 'dark'
    ? 'bg-slate-900 text-slate-400'
    : 'bg-slate-50 text-slate-500';
  const activeBtn = 'bg-amber-500 text-slate-900';
  const borderCls = tone === 'dark' ? 'border-slate-700' : 'border-slate-200';

  return (
    <div className={`text-[10px] font-bold rounded-md overflow-hidden border flex ${borderCls} ${className}`}>
      {([
        { id: 'light', icon: '☀' },
        { id: 'dark',  icon: '☾' },
      ] as const).map((opt) => (
        <button
          key={opt.id}
          type="button"
          onClick={() => setTheme(opt.id)}
          aria-pressed={cur === opt.id}
          aria-label={`Switch to ${opt.id} theme`}
          className={`px-2 py-1 transition ${cur === opt.id ? activeBtn : baseBtn}`}
        >
          <span aria-hidden>{opt.icon}</span>
        </button>
      ))}
    </div>
  );
}
