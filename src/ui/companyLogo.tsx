// Пиксельный логотип компании на продажу: симметричный узор 8×8 и цвет — из номера компании.
// Один и тот же номер всегда даёт один и тот же логотип.

const COLORS = ['#b8643f', '#3d6fd8', '#4f8a4b', '#8a5fb8', '#c9952a', '#2f8f8a', '#c0566b', '#5c6270'];

function bits(seed: number): number {
  // перемешиваем номер, чтобы соседние компании выглядели непохоже
  let h = (seed + 1) * 2654435761;
  h ^= h >>> 15;
  h = Math.imul(h, 2246822519);
  h ^= h >>> 13;
  return h >>> 0;
}

/** Узор 8×8: левая половина случайная, правая — её отражение; '#' — закрашено. */
export function logoRows(seed: number): string[] {
  const b = bits(seed);
  const rows: string[] = [];
  for (let y = 0; y < 8; y++) {
    let half = '';
    for (let x = 0; x < 4; x++) {
      const edge = (y === 0 || y === 7) && x === 0;
      half += !edge && (b >>> ((y * 4 + x) % 32)) & 1 ? '#' : '.';
    }
    rows.push(half + [...half].reverse().join(''));
  }
  return rows;
}

export function CompanyLogo({ seed, size = 72 }: { seed: number; size?: number }) {
  const color = COLORS[bits(seed * 7 + 3) % COLORS.length];
  const d = logoRows(seed)
    .flatMap((row, y) => [...row].map((c, x) => (c === '#' ? `M${x} ${y}h1v1h-1z` : '')))
    .join('');
  return (
    <svg className="company-logo" width={size} height={size} viewBox="-1 -1 10 10" aria-hidden="true" shapeRendering="crispEdges">
      <path d={d} fill={color} />
    </svg>
  );
}
