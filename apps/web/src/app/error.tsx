'use client';
// Next.js App-Router error boundary. Renders for any uncaught client-side
// exception in this segment — replaces the blank-page "Application error: a
// client-side exception has occurred" white screen with something actionable.
// Read more: https://nextjs.org/docs/app/building-your-application/routing/error-handling
import { useEffect } from 'react';

export default function GlobalError({
  error, reset,
}: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Surface the real message to the console for easier triage on Vercel.
    // eslint-disable-next-line no-console
    console.error('[mario] uncaught render error', error);
  }, [error]);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 grid place-items-center p-6">
      <div className="max-w-lg w-full bg-slate-900 border border-slate-700 rounded-2xl p-6 shadow-2xl">
        <div className="text-amber-400 text-[10px] font-bold tracking-[0.25em] mb-2">SOMETHING BROKE</div>
        <div className="text-2xl font-extrabold mb-3">The dashboard hit a render error.</div>
        <pre className="text-xs text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg p-3 overflow-x-auto mb-4 whitespace-pre-wrap">
          {error.message || String(error)}
          {error.digest ? `\n\ndigest: ${error.digest}` : ''}
        </pre>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => reset()}
            className="px-4 py-2 rounded-lg bg-amber-500 text-slate-900 font-bold text-sm hover:bg-amber-400"
          >
            Try again
          </button>
          <a
            href="/"
            className="px-4 py-2 rounded-lg border border-slate-700 text-slate-200 font-semibold text-sm hover:border-amber-400/60 hover:text-amber-300"
          >
            ← Back to home
          </a>
          <button
            onClick={() => { localStorage.clear(); location.href = '/'; }}
            className="px-4 py-2 rounded-lg border border-slate-700 text-slate-400 font-semibold text-sm hover:text-amber-300"
          >
            Clear session + reload
          </button>
        </div>
      </div>
    </main>
  );
}
