import React from 'react';

/**
 * Mickey wordmark + lockup — field-app copy.
 * Kept identical to apps/web/src/components/MickeyLogo.tsx to avoid pulling
 * the web bundle into Vite. If we ever extract a shared UI package, fold both.
 */

type Tone = 'dark' | 'light';

export function MickeyMark({
  size = 36,
  tone = 'dark',
  className = '',
  title = 'Mickey',
}: { size?: number; tone?: Tone; className?: string; title?: string }) {
  const bg = tone === 'dark' ? '#0F172A' : '#FFFFFF';
  const accent = '#F59E0B';
  const accent2 = '#EA580C';
  const stroke = tone === 'dark' ? '#FCD34D' : '#0F172A';
  const id = React.useId();
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" role="img" aria-label={title} className={className}>
      <defs>
        <linearGradient id={`mickey-bg-${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={bg} />
          <stop offset="100%" stopColor={tone === 'dark' ? '#1E293B' : '#F1F5F9'} />
        </linearGradient>
        <linearGradient id={`mickey-tower-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={accent} />
          <stop offset="100%" stopColor={accent2} />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="60" height="60" rx="14" fill={`url(#mickey-bg-${id})`} />
      <g stroke={tone === 'dark' ? 'rgba(148,163,184,0.18)' : 'rgba(15,23,42,0.08)'} strokeWidth="0.5">
        <path d="M2 18 H62 M2 32 H62 M2 46 H62 M18 2 V62 M32 2 V62 M46 2 V62" />
      </g>
      <path
        d="M12 50 V22 L20 16 L28 22 L32 26 L36 22 L44 16 L52 22 V50 H44 V32 H36 V50 H28 V32 H20 V50 Z"
        fill={`url(#mickey-tower-${id})`}
        stroke={stroke}
        strokeWidth="1"
        strokeLinejoin="round"
      />
      <g transform="translate(32 14)">
        <path d="M0 -6 a4 4 0 1 1 0 -0.01 Z M0 -2 V2" fill={stroke} stroke={stroke} strokeWidth="1" />
        <circle cx="0" cy="-6" r="1.8" fill={bg} />
      </g>
      <rect x="10" y="50" width="44" height="3" rx="1" fill={accent} />
    </svg>
  );
}
