// Время суток: цвет неба в окне, темнота в комнате, звёзды. Всё меняется плавно.

export interface Sky {
  /** Цвет неба сверху и у горизонта. */
  top: string;
  bottom: string;
  /** 0 — светлый день, 1 — глубокая ночь. */
  darkness: number;
  stars: boolean;
  /** Насколько видно солнечный луч из окна на полу. */
  sun: number;
}

type Key = [hour: number, darkness: number, top: string, bottom: string, sun: number];

// Опорные точки суток; между ними цвета и темнота смешиваются.
const KEYS: Key[] = [
  [0, 0.8, '#0b1026', '#1b2340', 0],
  [4.5, 0.8, '#0b1026', '#1d2444', 0],
  [6, 0.55, '#2b2f5e', '#e48a6a', 0.1],
  [7, 0.2, '#6d8fc9', '#f6c48f', 0.55],
  [8, 0, '#7fb1e6', '#d6e8f5', 0.8],
  [13, 0, '#6fa8e8', '#cfe5f7', 1],
  [17, 0, '#79a7dc', '#f0dcc0', 0.8],
  [18.5, 0.2, '#5a6fb0', '#f29a6b', 0.45],
  [19.5, 0.5, '#2f2f66', '#b4637a', 0.1],
  [21, 0.72, '#141a3a', '#2b2c58', 0],
  [24, 0.8, '#0b1026', '#1b2340', 0],
];

function hex(c: string): [number, number, number] {
  const n = parseInt(c.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function mixColor(a: string, b: string, t: number): string {
  const [ar, ag, ab] = hex(a);
  const [br, bg, bb] = hex(b);
  const m = (x: number, y: number) => Math.round(x + (y - x) * t);
  return `#${((1 << 24) | (m(ar, br) << 16) | (m(ag, bg) << 8) | m(ab, bb)).toString(16).slice(1)}`;
}

/** Небо и свет в минуту суток (0…1439; больше — переносится на следующие сутки). */
export function skyAt(minutes: number): Sky {
  const hour = (((minutes % 1440) + 1440) % 1440) / 60;
  let a = KEYS[0]!;
  let b = KEYS[1]!;
  for (let i = 0; i < KEYS.length - 1; i++) {
    if (hour >= KEYS[i]![0] && hour <= KEYS[i + 1]![0]) {
      a = KEYS[i]!;
      b = KEYS[i + 1]!;
      break;
    }
  }
  const t = b[0] === a[0] ? 0 : (hour - a[0]) / (b[0] - a[0]);
  const darkness = a[1] + (b[1] - a[1]) * t;
  return {
    top: mixColor(a[2], b[2], t),
    bottom: mixColor(a[3], b[3], t),
    darkness,
    stars: darkness > 0.45,
    sun: a[4] + (b[4] - a[4]) * t,
  };
}
