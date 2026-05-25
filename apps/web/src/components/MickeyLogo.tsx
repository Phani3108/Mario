import React from 'react';

/**
 * Mickey wordmark + lockup.
 *
 * The mark is a builder's "M" — two plumb-lines for the verticals, a spirit
 * level across the top with a centered bubble, and small bob-weights at the
 * base of each plumb-string. Slate + saffron, the colours of a confident
 * Indian real-estate brand.
 *
 *  - <MickeyMark />  : square icon only (favicon, header avatar, app icon)
 *  - <MickeyLockup/> : icon + wordmark "Mickey" + optional tagline
 *
 * Both are pure SVG with no external deps. `tone="dark" | "light"` flips
 * background + ink for inverse contexts.
 */

type Tone = 'dark' | 'light';

const SAFFRON = '#E97300';        // India-flag saffron, mature
const SAFFRON_LIGHT = '#F59E0B';  // amber accent
const SLATE_DARK = '#0F172A';
const SLATE_MID = '#1E293B';
const BONE = '#F8F5EE';
const INK_DARK = '#0F172A';
const INK_ON_DARK = '#F8F5EE';

export function MickeyMark({
  size = 36,
  tone = 'dark',
  className = '',
  title = 'Mickey',
}: { size?: number; tone?: Tone; className?: string; title?: string }) {
  const bg = tone === 'dark' ? SLATE_DARK : BONE;
  const bgInner = tone === 'dark' ? SLATE_MID : '#EFE9DC';
  const ink = tone === 'dark' ? INK_ON_DARK : INK_DARK;
  const stringStroke = tone === 'dark' ? 'rgba(248,245,238,0.92)' : 'rgba(15,23,42,0.85)';
  const id = React.useId();

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role="img"
      aria-label={title}
      className={className}
    >
      <defs>
        <linearGradient id={`mickey-bg-${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={bg} />
          <stop offset="100%" stopColor={bgInner} />
        </linearGradient>
        <linearGradient id={`mickey-saffron-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={SAFFRON_LIGHT} />
          <stop offset="100%" stopColor={SAFFRON} />
        </linearGradient>
      </defs>

      {/* Tile background */}
      <rect x="2" y="2" width="60" height="60" rx="14" fill={`url(#mickey-bg-${id})`} />

      {/* Spirit-level cap — horizontal bar across the top of the M.
          The bar is filled saffron and contains a circular vial with a yellow bubble. */}
      <rect
        x="11" y="10" width="42" height="8" rx="2"
        fill={`url(#mickey-saffron-${id})`}
        stroke={tone === 'dark' ? 'rgba(0,0,0,0.25)' : 'rgba(0,0,0,0.15)'}
        strokeWidth="0.6"
      />
      {/* Bubble vial in the centre of the level bar */}
      <rect x="26" y="11.6" width="12" height="4.8" rx="2.4" fill={tone === 'dark' ? SLATE_DARK : '#FFFDF7'} opacity="0.85" />
      <circle cx="34" cy="14" r="1.6" fill={SAFFRON_LIGHT} />
      <circle cx="34" cy="14" r="0.6" fill="rgba(255,255,255,0.85)" />
      {/* Two end-cap notches on the level */}
      <rect x="11" y="11.5" width="1.6" height="5" rx="0.3" fill="rgba(0,0,0,0.25)" />
      <rect x="51.4" y="11.5" width="1.6" height="5" rx="0.3" fill="rgba(0,0,0,0.25)" />

      {/* Two plumb-strings — the verticals of the M. Drawn as thin ink strokes
          dropping straight down from beneath the level. */}
      <line x1="16" y1="18" x2="16" y2="46" stroke={stringStroke} strokeWidth="1.4" strokeLinecap="round" />
      <line x1="48" y1="18" x2="48" y2="46" stroke={stringStroke} strokeWidth="1.4" strokeLinecap="round" />

      {/* The V of the M — two diagonal plumb-strings descending from the
          inner edges of the level to a shared point at the centre baseline. */}
      <line x1="22" y1="18" x2="32" y2="38" stroke={stringStroke} strokeWidth="1.4" strokeLinecap="round" />
      <line x1="42" y1="18" x2="32" y2="38" stroke={stringStroke} strokeWidth="1.4" strokeLinecap="round" />

      {/* Plumb-bob (weight) at the bottom of each outer string — a small
          tear-drop in saffron, the unmistakable mason's-tool silhouette. */}
      <g fill={`url(#mickey-saffron-${id})`} stroke={tone === 'dark' ? 'rgba(0,0,0,0.35)' : 'rgba(0,0,0,0.2)'} strokeWidth="0.5">
        <path d="M16 46 L13.4 50 L16 54 L18.6 50 Z" />
        <path d="M48 46 L45.4 50 L48 54 L50.6 50 Z" />
        <path d="M32 38 L29.4 42 L32 46 L34.6 42 Z" />
      </g>

      {/* Hi-vis baseline — the "site truth" anchor, a saffron stripe at the
          bottom of the tile. */}
      <rect x="10" y="56" width="44" height="2.4" rx="1.2" fill={SAFFRON_LIGHT} opacity="0.85" />
    </svg>
  );
}

export function MickeyLockup({
  size = 36,
  tagline,
  tone = 'dark',
  className = '',
}: { size?: number; tagline?: string; tone?: Tone; className?: string }) {
  const wordColor = tone === 'dark' ? '#F8FAFC' : '#0F172A';
  const subColor = tone === 'dark' ? '#94A3B8' : '#475569';
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <MickeyMark size={size} tone={tone} />
      <div className="leading-tight">
        <div className="font-extrabold tracking-tight" style={{ color: wordColor, fontSize: size * 0.55 }}>
          Mickey
        </div>
        {tagline && (
          <div className="text-[10px] uppercase tracking-[0.18em] font-semibold" style={{ color: subColor }}>
            {tagline}
          </div>
        )}
      </div>
    </div>
  );
}
