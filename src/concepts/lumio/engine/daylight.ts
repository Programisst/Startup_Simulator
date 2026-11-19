// Время суток → освещение комнаты. Опорные точки по часам, между ними плавный переход.

export type RGB = [number, number, number];

export interface Daylight {
  /** Общий свет комнаты (умножается на картинку). */
  ambient: RGB;
  /** Насколько темно: 0 — день, 1 — глубокая ночь. От этого зависят свечение ламп и окон. */
  dark: number;
  /** Солнечные пятна из окон: сила, цвет, сдвиг по X и длина на полу (в пикселях сцены). */
  sun: { power: number; color: RGB; dx: number; len: number };
  /** Небо за окном: верх, низ, цвет домов. */
  sky: { top: RGB; bottom: RGB; far: RGB; near: RGB; lit: number; stars: number };
}

interface Key {
  h: number;
  ambient: RGB;
  dark: number;
  sun: number;
  sunColor: RGB;
  top: RGB;
  bottom: RGB;
  far: RGB;
  near: RGB;
  lit: number;
  stars: number;
}

const KEYS: Key[] = [
  { h: 0, ambient: [60, 66, 114], dark: 1, sun: 0, sunColor: [150, 170, 255], top: [10, 13, 30], bottom: [34, 30, 62], far: [36, 38, 66], near: [22, 23, 40], lit: 0.32, stars: 1 },
  { h: 5, ambient: [64, 68, 114], dark: 1, sun: 0, sunColor: [150, 170, 255], top: [12, 15, 34], bottom: [44, 36, 70], far: [38, 40, 68], near: [24, 25, 42], lit: 0.18, stars: 0.8 },
  { h: 6.5, ambient: [176, 156, 168], dark: 0.45, sun: 0.35, sunColor: [255, 196, 150], top: [86, 104, 160], bottom: [244, 170, 140], far: [120, 110, 140], near: [80, 72, 98], lit: 0.12, stars: 0 },
  { h: 8.5, ambient: [226, 222, 216], dark: 0, sun: 0.75, sunColor: [255, 248, 232], top: [120, 172, 222], bottom: [214, 232, 244], far: [176, 190, 208], near: [140, 154, 176], lit: 0, stars: 0 },
  { h: 13, ambient: [234, 231, 226], dark: 0, sun: 0.85, sunColor: [255, 252, 240], top: [104, 166, 226], bottom: [206, 230, 248], far: [184, 196, 214], near: [146, 160, 182], lit: 0, stars: 0 },
  { h: 17, ambient: [230, 216, 200], dark: 0.05, sun: 0.85, sunColor: [255, 226, 184], top: [118, 160, 214], bottom: [240, 214, 186], far: [170, 166, 184], near: [124, 120, 146], lit: 0.04, stars: 0 },
  { h: 18.75, ambient: [214, 160, 140], dark: 0.3, sun: 0.7, sunColor: [255, 178, 120], top: [70, 76, 136], bottom: [250, 150, 102], far: [104, 82, 120], near: [64, 50, 84], lit: 0.16, stars: 0 },
  { h: 20, ambient: [128, 114, 156], dark: 0.75, sun: 0.12, sunColor: [190, 130, 170], top: [26, 30, 70], bottom: [96, 64, 110], far: [52, 46, 86], near: [30, 28, 52], lit: 0.3, stars: 0.3 },
  { h: 21.25, ambient: [64, 70, 118], dark: 1, sun: 0, sunColor: [150, 170, 255], top: [12, 16, 38], bottom: [44, 36, 76], far: [38, 40, 70], near: [22, 23, 42], lit: 0.38, stars: 1 },
  { h: 24, ambient: [60, 66, 114], dark: 1, sun: 0, sunColor: [150, 170, 255], top: [10, 13, 30], bottom: [34, 30, 62], far: [36, 38, 66], near: [22, 23, 40], lit: 0.32, stars: 1 },
];

const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const mixRGB = (a: RGB, b: RGB, t: number): RGB => [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)];

export function daylightAt(minutes: number): Daylight {
  const h = (((minutes % 1440) + 1440) % 1440) / 60;
  let i = 0;
  while (i < KEYS.length - 2 && KEYS[i + 1]!.h <= h) i++;
  const a = KEYS[i]!;
  const b = KEYS[i + 1]!;
  const raw = (h - a.h) / (b.h - a.h);
  const t = raw * raw * (3 - 2 * raw);
  // Солнце идёт слева (утро) направо (вечер): пятна от окон смещаются в обратную сторону.
  const dayT = Math.min(1, Math.max(0, (h - 6) / 13));
  const altitude = Math.sin(dayT * Math.PI);
  return {
    ambient: mixRGB(a.ambient, b.ambient, t),
    dark: mix(a.dark, b.dark, t),
    sun: {
      power: mix(a.sun, b.sun, t),
      color: mixRGB(a.sunColor, b.sunColor, t),
      dx: (0.5 - dayT) * 120,
      len: 46 + (1 - altitude) * 70,
    },
    sky: {
      top: mixRGB(a.top, b.top, t),
      bottom: mixRGB(a.bottom, b.bottom, t),
      far: mixRGB(a.far, b.far, t),
      near: mixRGB(a.near, b.near, t),
      lit: mix(a.lit, b.lit, t),
      stars: mix(a.stars, b.stars, t),
    },
  };
}

export const css = (c: RGB, a = 1) => `rgba(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])},${a})`;
