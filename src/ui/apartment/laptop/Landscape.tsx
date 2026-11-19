// Обои: горы, туман и озеро с отражением. Нарисованы кодом — своя картинка, без чужих фото.
import { memo, useMemo } from 'react';

type Variant = 'dawn' | 'dusk';

const PALETTES: Record<Variant, { sky: string[]; sun: string; far: string; mid: string; near: string; forest: string; lake: string[] }> = {
  dawn: {
    sky: ['#24304f', '#4e5a86', '#b98a8f', '#f0b98c', '#f8d6a6'],
    sun: '#ffe2b0',
    far: '#8a8fb3',
    mid: '#5d6890',
    near: '#33475a',
    forest: '#1c2b30',
    lake: ['#e9b98f', '#8b8aa6', '#2e3c55'],
  },
  dusk: {
    sky: ['#121a35', '#2f2f5e', '#7a4f78', '#d4747a', '#f3a271'],
    sun: '#ffc48a',
    far: '#6a5f8e',
    mid: '#47467a',
    near: '#272c4a',
    forest: '#161a2e',
    lake: ['#e98e74', '#6d4f78', '#1d2240'],
  },
};

function noise(seed: number) {
  return (x: number) =>
    Math.sin(x * 0.0061 + seed) * 0.5 +
    Math.sin(x * 0.0137 + seed * 2.1) * 0.28 +
    Math.sin(x * 0.0311 + seed * 3.7) * 0.14 +
    Math.sin(x * 0.083 + seed * 5.3) * 0.06;
}

function ridgePoints(seed: number, base: number, amp: number): [number, number][] {
  const n = noise(seed);
  const pts: [number, number][] = [];
  for (let x = -20; x <= 1460; x += 10) pts.push([x, base - n(x) * amp]);
  return pts;
}

function ridgePath(pts: [number, number][], bottom: number): string {
  return `M-20,${bottom} ` + pts.map(([x, y]) => `L${x.toFixed(1)},${y.toFixed(1)}`).join(' ') + ` L1460,${bottom} Z`;
}

function rand(seed: number) {
  let a = seed;
  return () => {
    a = (a * 9301 + 49297) % 233280;
    return a / 233280;
  };
}

/** Ёлки вдоль гребня холма: много маленьких треугольников. */
function forestPath(pts: [number, number][], seed: number, minH: number, maxH: number): string {
  const r = rand(seed);
  let d = '';
  for (let x = -10; x < 1450; x += 5 + r() * 6) {
    const i = Math.max(0, Math.min(pts.length - 1, Math.round((x + 20) / 10)));
    const y = pts[i]![1] + 4;
    const h = minH + r() * (maxH - minH);
    const w = h * (0.28 + r() * 0.12);
    d += `M${(x - w).toFixed(1)},${(y + 2).toFixed(1)} L${x.toFixed(1)},${(y - h).toFixed(1)} L${(x + w).toFixed(1)},${(y + 2).toFixed(1)} Z `;
  }
  return d;
}

/** Большие ели по краям кадра. */
function bigPine(x: number, baseY: number, h: number): string {
  let d = '';
  const tiers = 7;
  for (let i = 0; i < tiers; i++) {
    const top = baseY - h + (i * h) / (tiers + 1.5);
    const bottom = top + h / 3.2;
    const w = ((i + 1) / tiers) * h * 0.24 + 8;
    d += `M${x - w},${bottom} L${x},${top} L${x + w},${bottom} Z `;
  }
  d += `M${x - 3},${baseY} L${x - 3},${baseY - 40} L${x + 3},${baseY - 40} L${x + 3},${baseY} Z`;
  return d;
}

export const Landscape = memo(function Landscape({ variant, id }: { variant: Variant; id: string }) {
  const p = PALETTES[variant];
  const shapes = useMemo(() => {
    const far = ridgePoints(variant === 'dawn' ? 1.3 : 4.1, 470, 120);
    const mid = ridgePoints(variant === 'dawn' ? 2.7 : 6.2, 535, 70);
    const near = ridgePoints(variant === 'dawn' ? 5.9 : 8.8, 590, 34);
    const r = rand(variant === 'dawn' ? 11 : 23);
    const ripples = Array.from({ length: 70 }, () => ({
      x: r() * 1440,
      y: 615 + r() ** 1.6 * 285,
      w: 20 + r() * 140,
      o: 0.08 + r() * 0.22,
    }));
    return {
      far: ridgePath(far, 640),
      mid: ridgePath(mid, 640),
      near: ridgePath(near, 640),
      forestMid: forestPath(mid, 3, 8, 22),
      forestNear: forestPath(near, 7, 14, 36),
      pinesLeft: bigPine(70, 900, 420) + bigPine(170, 900, 300) + bigPine(10, 900, 520),
      pinesRight: bigPine(1350, 900, 460) + bigPine(1250, 900, 280) + bigPine(1430, 900, 380),
      ripples,
    };
  }, [variant]);

  const g = (name: string) => `${id}-${name}`;

  return (
    <svg className="landscape" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <linearGradient id={g('sky')} x1="0" y1="0" x2="0" y2="1">
          {p.sky.map((c, i) => (
            <stop key={c} offset={`${(i / (p.sky.length - 1)) * 64}%`} stopColor={c} />
          ))}
        </linearGradient>
        <radialGradient id={g('sun')} cx="0.66" cy="0.6" r="0.42">
          <stop offset="0%" stopColor={p.sun} stopOpacity="0.95" />
          <stop offset="18%" stopColor={p.sun} stopOpacity="0.5" />
          <stop offset="100%" stopColor={p.sun} stopOpacity="0" />
        </radialGradient>
        <linearGradient id={g('lake')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={p.lake[0]} />
          <stop offset="45%" stopColor={p.lake[1]} />
          <stop offset="100%" stopColor={p.lake[2]} />
        </linearGradient>
        <linearGradient id={g('haze')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="60%" stopColor="#fff4e6" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#fff4e6" stopOpacity="0" />
        </linearGradient>
        <radialGradient id={g('vignette')} cx="0.5" cy="0.45" r="0.75">
          <stop offset="60%" stopColor="#000" stopOpacity="0" />
          <stop offset="100%" stopColor="#000" stopOpacity="0.45" />
        </radialGradient>
        <filter id={g('blur-lg')} x="-20%" y="-50%" width="140%" height="200%">
          <feGaussianBlur stdDeviation="22" />
        </filter>
        <filter id={g('blur-sm')}>
          <feGaussianBlur stdDeviation="2.2" />
        </filter>
        <clipPath id={g('water')}>
          <rect x="0" y="606" width="1440" height="300" />
        </clipPath>
      </defs>

      <rect width="1440" height="900" fill={`url(#${g('sky')})`} />
      <rect width="1440" height="900" fill={`url(#${g('sun')})`} />
      <circle cx="950" cy="520" r="34" fill={p.sun} opacity="0.95" />
      <g filter={`url(#${g('blur-lg')})`} opacity="0.55">
        <ellipse cx="330" cy="210" rx="260" ry="40" fill="#f6c9b5" />
        <ellipse cx="1080" cy="160" rx="300" ry="34" fill="#f2b8a8" />
        <ellipse cx="760" cy="300" rx="210" ry="26" fill="#ffd9bd" />
      </g>

      <path d={shapes.far} fill={p.far} opacity="0.75" />
      <rect y="420" width="1440" height="140" fill={`url(#${g('haze')})`} opacity="0.55" />
      <path d={shapes.mid} fill={p.mid} />
      <path d={shapes.forestMid} fill={p.mid} opacity="0.9" />
      <rect y="500" width="1440" height="110" fill={`url(#${g('haze')})`} opacity="0.45" />
      <path d={shapes.near} fill={p.near} />
      <path d={shapes.forestNear} fill={p.forest} />

      <rect y="606" width="1440" height="294" fill={`url(#${g('lake')})`} />
      <g clipPath={`url(#${g('water')})`} opacity="0.42" filter={`url(#${g('blur-sm')})`}>
        <g transform="translate(0 1212) scale(1 -1)">
          <path d={shapes.far} fill={p.far} opacity="0.6" />
          <path d={shapes.mid} fill={p.mid} />
          <path d={shapes.near} fill={p.near} />
          <path d={shapes.forestNear} fill={p.forest} />
        </g>
      </g>
      <ellipse cx="950" cy="700" rx="22" ry="110" fill={p.sun} opacity="0.28" filter={`url(#${g('blur-sm')})`} />
      {shapes.ripples.map((r, i) => (
        <rect key={i} x={r.x} y={r.y} width={r.w} height="1.6" rx="0.8" fill="#fff6ea" opacity={r.o} />
      ))}
      <rect y="598" width="1440" height="16" fill="#fff4e6" opacity="0.18" filter={`url(#${g('blur-sm')})`} />

      <path d={shapes.pinesLeft} fill="#0f1617" />
      <path d={shapes.pinesRight} fill="#0f1617" />
      <rect width="1440" height="900" fill={`url(#${g('vignette')})`} />
    </svg>
  );
});
