// Заставка входа в стиле «стартап-пиксель»: закатный пиксельный город, над ним растёт график «на луну»,
// логотип собирается из пикселей. Камера потом летит к светящемуся окну основателя и влетает в экран его компьютера.
// Всё рисуется в коде попиксельно, картинок нет. Случайность — только через hash: каждый раз одна и та же сцена.
import { hash } from '../apartment/engine/art';
import { HERO_PALETTE, heroFrames } from '../apartment/engine/heroPixels';

const HERO_SIT = heroFrames().sit;

/** Сцена в пикселях. */
export const SCENE_W = 320;
export const SCENE_H = 180;
/** Сколько секунд камера летит от города до экрана компьютера. */
export const FLIGHT_SECONDS = 4.6;

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

// ── Дом основателя: сетка окон 6 × 8, его окно — четвёртое слева в четвёртом ряду.
const HOUSE = { x: 214, y: 62, w: 68, cols: 6, rows: 8 };
const WIN = { w: 7, h: 9, gapX: 4, gapY: 4, top: 9, left: 3 };
const winRect = (col: number, row: number): Rect => ({
  x: HOUSE.x + WIN.left + col * (WIN.w + WIN.gapX),
  y: HOUSE.y + WIN.top + row * (WIN.h + WIN.gapY),
  w: WIN.w,
  h: WIN.h,
});
const HOME = { col: 3, row: 3 };
export const HOME_WINDOW: Rect = winRect(HOME.col, HOME.row);

/** Комната за окном нарисована в 8 раз подробнее сцены: детали проступают, пока камера приближается. */
export const INTERIOR_K = 8;
const IW = HOME_WINDOW.w * INTERIOR_K;
const IH = HOME_WINDOW.h * INTERIOR_K;
/** Экран iMac внутри комнаты (в пикселях комнаты). */
const SCREEN_IN = { x: 17, y: 21, w: 22, h: 14 };
/** Тот же экран в пикселях сцены — сюда в конце влетает камера. */
export const HOME_SCREEN: Rect = {
  x: HOME_WINDOW.x + SCREEN_IN.x / INTERIOR_K,
  y: HOME_WINDOW.y + SCREEN_IN.y / INTERIOR_K,
  w: SCREEN_IN.w / INTERIOR_K,
  h: SCREEN_IN.h / INTERIOR_K,
};

// ── Камера

/** Плавно разгоняется и долго, мягко тормозит — камера «подплывает» к окну. */
const easeInOutQuint = (t: number) => (t < 0.5 ? 16 * t ** 5 : 1 - (-2 * t + 2) ** 5 / 2);
const ease = (t: number) => 0.35 * easeInOutQuint(t) + 0.65 * (1 - (1 - t) ** 3);

export interface Camera {
  /** Пикселей экрана на пиксель сцены. */
  scale: number;
  /** Где на экране левый верхний угол сцены. */
  x: number;
  y: number;
}

/**
 * Камера в момент t полёта (0 — весь город, 1 — окно основателя крупно по центру).
 * Приближение растёт плавно по логарифму, а точка фокуса движется к окну так,
 * будто камера наезжает «в точку», — полёт выглядит как один непрерывный наезд.
 */
export function flightCamera(t: number, view: { w: number; h: number }): Camera {
  const s0 = Math.ceil(Math.max(view.w / SCENE_W, view.h / SCENE_H));
  // В конце окно с рамой занимает ~85 % высоты экрана.
  const s1 = Math.min(view.w / (HOME_WINDOW.w + 1.2), view.h / (HOME_WINDOW.h + 1.6));
  const e = ease(Math.min(1, Math.max(0, t)));
  const scale = s0 * Math.exp(Math.log(s1 / s0) * e);
  const f = (1 - s0 / scale) / (1 - s0 / s1);
  const fx = SCENE_W / 2 + (HOME_WINDOW.x + HOME_WINDOW.w / 2 - SCENE_W / 2) * f;
  const fy = SCENE_H / 2 + (HOME_WINDOW.y + HOME_WINDOW.h / 2 - SCENE_H / 2) * f;
  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
  return {
    scale,
    x: clamp(view.w / 2 - fx * scale, view.w - SCENE_W * scale, 0),
    y: clamp(view.h / 2 - fy * scale, view.h - SCENE_H * scale, 0),
  };
}

// ── Логотип: пиксельный шрифт 5 × 7

const FONT: Record<string, string[]> = {
  S: ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
  T: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
  A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  R: ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
  U: ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  P: ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....'],
  I: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '#####'],
  M: ['#...#', '##.##', '#.#.#', '#.#.#', '#...#', '#...#', '#...#'],
  L: ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
  O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
};

export interface LogoPixel {
  x: number;
  y: number;
  /** 0 — «STARTUP» (крупно), 1 — «SIMULATOR» (мельче). */
  line: 0 | 1;
}

function word(text: string, size: number, line: 0 | 1, ox: number, oy: number): LogoPixel[] {
  const out: LogoPixel[] = [];
  [...text].forEach((ch, i) => {
    FONT[ch]!.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) {
        if (row[x] !== '#') continue;
        for (let a = 0; a < size; a++) for (let b = 0; b < size; b++) out.push({ x: ox + (i * 6 + x) * size + a, y: oy + y * size + b, line });
      }
    });
  });
  return out;
}

const TOP_W = 7 * 6 * 2 - 2;
const BOTTOM_W = 9 * 6 - 1;
/** Размер логотипа в его пикселях. */
export const LOGO = { w: TOP_W, h: 7 * 2 + 4 + 7 };

/** Пиксели логотипа «STARTUP / SIMULATOR». */
export function logoPixels(): LogoPixel[] {
  return [...word('STARTUP', 2, 0, 0, 0), ...word('SIMULATOR', 1, 1, Math.round((TOP_W - BOTTOM_W) / 2), 18)];
}

// ── Рисование сцены

type Ctx = CanvasRenderingContext2D;

const SKY = ['#78b0dc', '#84b8e0', '#90c0e4', '#9dc8e8', '#aacfeb', '#b8d7ee', '#c6deef', '#d3e4ef', '#dfe8ec', '#e9ebe6', '#f1ebdc', '#f6e8d2'];
const HORIZON = 146;

function rect(c: Ctx, x: number, y: number, w: number, h: number, col: string): void {
  c.fillStyle = col;
  c.fillRect(x, y, w, h);
}

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

/** Небо: плавный переход цветов заката с пиксельным растром (как в старых играх, но мягко). */
function paintSky(c: Ctx): void {
  for (let y = 0; y < SCENE_H; y++) {
    const f = (Math.min(y, HORIZON) / HORIZON) * (SKY.length - 1);
    const i = Math.floor(f);
    const frac = f - i;
    const a = SKY[Math.min(i, SKY.length - 1)]!;
    const b = SKY[Math.min(i + 1, SKY.length - 1)]!;
    rect(c, 0, y, SCENE_W, 1, a);
    if (frac <= 0) continue;
    c.fillStyle = b;
    for (let x = 0; x < SCENE_W; x++) if (BAYER[(y % 4) * 4 + (x % 4)]! / 16 < frac) c.fillRect(x, y, 1, 1);
  }
}

const SUN = { x: 176, y: 30, r: 11 };

/** Солнце: мягкий светлый диск с растровым ореолом. */
function paintSun(c: Ctx): void {
  for (let y = -SUN.r - 8; y <= SUN.r + 8; y++) {
    for (let x = -SUN.r - 8; x <= SUN.r + 8; x++) {
      const d = Math.hypot(x, y);
      if (d <= SUN.r || d >= SUN.r + 8) continue;
      const k = 1 - (d - SUN.r) / 8;
      if (BAYER[((y + 64) % 4) * 4 + ((x + 64) % 4)]! / 16 < k * 0.7) rect(c, SUN.x + x, SUN.y + y, 1, 1, '#fbf3dc');
    }
  }
  for (let y = -SUN.r; y <= SUN.r; y++) {
    const half = Math.round(Math.sqrt(SUN.r * SUN.r - y * y));
    rect(c, SUN.x - half, SUN.y + y, half * 2, 1, Math.abs(y) < SUN.r * 0.6 ? '#fffdf4' : '#fff4d4');
  }
}

/** Облака: несколько круглых «шапок» вместе, сверху подсвечены, снизу в тени. Плывут медленно. */
const CLOUDS = [
  { y: 22, w: 64, h: 9, speed: 1.0, x0: 150 },
  { y: 44, w: 42, h: 7, speed: 1.5, x0: 20 },
  { y: 64, w: 80, h: 10, speed: 0.7, x0: 230 },
  { y: 90, w: 36, h: 6, speed: 1.9, x0: 120 },
  { y: 106, w: 58, h: 7, speed: 1.2, x0: 290 },
];

function paintClouds(c: Ctx, time: number): void {
  CLOUDS.forEach((cl, n) => {
    const span = SCENE_W + cl.w;
    const x = Math.round(((((cl.x0 + time * cl.speed) % span) + span) % span) - cl.w);
    // Профиль верхнего края: сумма нескольких «бугров».
    const bumps = [0.18, 0.42, 0.66, 0.86].map((p, k) => ({ at: p * cl.w, r: cl.w * (0.16 + hash(n, k, 21) * 0.12) }));
    for (let i = 0; i < cl.w; i++) {
      let top = cl.h; // высота над нижним краем
      let best = 0;
      for (const bm of bumps) {
        const d = Math.abs(i - bm.at);
        if (d < bm.r) best = Math.max(best, Math.sqrt(bm.r * bm.r - d * d) * (cl.h / (cl.w * 0.28)));
      }
      top = Math.min(cl.h, Math.round(best));
      if (top <= 0) continue;
      const y0 = cl.y + cl.h - top;
      rect(c, x + i, y0, 1, top, '#e4ebf2');
      rect(c, x + i, y0, 1, Math.max(1, Math.round(top * 0.55)), '#f7f9fb');
      rect(c, x + i, y0, 1, 1, '#ffffff');
      rect(c, x + i, cl.y + cl.h - 1, 1, 1, '#c3d1df');
    }
  });
}

interface Tower {
  x: number;
  w: number;
  top: number;
}

function skyline(seed: number, base: number, minH: number, maxH: number, minW: number, maxW: number): Tower[] {
  const out: Tower[] = [];
  let x = -6;
  let n = 0;
  while (x < SCENE_W + 6) {
    const w = minW + Math.floor(hash(seed, n, 1) * (maxW - minW));
    const h = minH + Math.floor(hash(seed, n, 2) * (maxH - minH));
    out.push({ x, w, top: base - h });
    x += w + Math.floor(hash(seed, n, 3) * 3);
    n++;
  }
  return out;
}

const FAR = skyline(11, 152, 12, 40, 8, 18);
const MID = skyline(23, 168, 16, 54, 10, 22).filter((t) => t.x + t.w < HOUSE.x - 2 || t.x > HOUSE.x + HOUSE.w + 2);

/** Доля окон, где дома кто-то есть (днём — немного, понемногу прибавляется). */
const litShare = (time: number) => 0.14 + 0.06 * Math.min(1, time / 9);

function paintFar(c: Ctx): void {
  for (const t of FAR) {
    rect(c, t.x, t.top, t.w, SCENE_H - t.top, '#a9bccf');
    // Край, повёрнутый к солнцу (оно слева), подсвечен.
    rect(c, t.x, t.top, 1, 152 - t.top, '#bccbdb');
    for (let y = t.top + 3; y < 150; y += 4) {
      for (let x = t.x + 2; x < t.x + t.w - 2; x += 3) {
        if (hash(x, y, 5) < 0.4) rect(c, x, y, 1, 1, '#c5d4e3');
      }
    }
  }
}

function paintMid(c: Ctx, time: number): void {
  MID.forEach((t, i) => {
    rect(c, t.x, t.top, t.w, SCENE_H - t.top, '#7d93ab');
    rect(c, t.x, t.top, t.w, 1, '#93a8be');
    rect(c, t.x, t.top + 1, 2, 168 - t.top, '#8ea3ba');
    // Крыши: бак для воды, антенна.
    if (i % 4 === 1) {
      rect(c, t.x + 3, t.top - 4, 5, 3, '#6a7f96');
      rect(c, t.x + 4, t.top - 1, 1, 1, '#6a7f96');
      rect(c, t.x + 6, t.top - 1, 1, 1, '#6a7f96');
    }
    if (i % 5 === 3) {
      const ax = t.x + Math.floor(t.w / 2);
      rect(c, ax, t.top - 9, 1, 9, '#6a7f96');
      if (Math.floor(time * 1.2 + i) % 2 === 0) rect(c, ax, t.top - 10, 1, 1, '#e0614f');
    }
    for (let y = t.top + 4; y < 172; y += 5) {
      for (let x = t.x + 2; x < t.x + t.w - 3; x += 4) {
        const k = hash(x, y, 7);
        // Днём окна отражают небо; редкие — тёплые, там включён свет.
        rect(c, x, y, 2, 2, k < 0.06 ? '#f3d9a4' : k < 0.5 ? '#c7d9e9' : '#a9bfd4');
        if (k >= 0.06 && k < 0.5) rect(c, x, y, 2, 1, '#dfeaf3');
      }
    }
  });
}

/** Дом основателя: тёплый кирпич, карнизы по этажам, сетка окон. Окно основателя — самое тёплое. */
function paintHouse(c: Ctx, time: number): void {
  const { x, y, w } = HOUSE;
  rect(c, x, y, w, SCENE_H - y, '#b5654f');
  // Кирпичная кладка: тонкие швы через ряд.
  for (let yy = y + 2; yy < SCENE_H; yy += 3) for (let xx = x + ((yy / 3) % 2 ? 0 : 2); xx < x + w; xx += 4) rect(c, xx, yy, 1, 1, '#a65a47');
  rect(c, x, y, 4, SCENE_H - y, '#c97a61');
  rect(c, x - 2, y - 2, w + 4, 3, '#7a3f33');
  rect(c, x - 2, y - 3, w + 4, 1, '#d99377');
  // Вывеска на крыше: маленький логотип-кольцо.
  rect(c, x + 26, y - 10, 16, 8, '#5b4b46');
  rect(c, x + 27, y - 9, 14, 6, '#f4efe6');
  const blink = 0.6 + 0.4 * Math.sin(time * 2.4);
  c.globalAlpha = blink;
  rect(c, x + 31, y - 8, 6, 1, '#3b8f78');
  rect(c, x + 30, y - 7, 1, 2, '#3b8f78');
  rect(c, x + 37, y - 7, 1, 2, '#3b8f78');
  rect(c, x + 31, y - 5, 6, 1, '#3b8f78');
  c.globalAlpha = 1;
  for (let row = 0; row < HOUSE.rows; row++) {
    rect(c, x, winRect(0, row).y - 3, w, 1, '#93503f');
    rect(c, x, winRect(0, row).y - 2, w, 1, '#c98068');
    for (let col = 0; col < HOUSE.cols; col++) {
      const r = winRect(col, row);
      if (r.y > SCENE_H) continue;
      rect(c, r.x - 1, r.y - 1, r.w + 2, r.h + 2, '#f1e6d2');
      rect(c, r.x - 1, r.y + r.h, r.w + 2, 1, '#cbbba3');
      const home = col === HOME.col && row === HOME.row;
      const k = hash(col, row, 13);
      if (home) {
        continue; // само окно — подробная комната, рисуется отдельно
      }
      if (k < litShare(time) + 0.08) {
        // Кто-то дома: тёплая комната, занавеска.
        rect(c, r.x, r.y, r.w, r.h, '#f0d3a0');
        rect(c, r.x, r.y, 2, r.h, '#e2a77a');
        if (k < 0.1) rect(c, r.x + 3, r.y + 3, 2, 5, '#8a5a48');
      } else {
        // Стекло отражает небо: светлый верх, косой блик.
        rect(c, r.x, r.y, r.w, r.h, '#9fc0dc');
        rect(c, r.x, r.y, r.w, 3, '#cfe1ef');
        rect(c, r.x + 1 + (row % 3), r.y + 4, 1, 3, '#e6f0f7');
      }
      rect(c, r.x + Math.floor(r.w / 2), r.y, 1, r.h, '#f1e6d2');
    }
  }
}

/** Передний план: кроны деревьев и фонари внизу. */
function paintFront(c: Ctx, time: number): void {
  for (let x = -4; x < SCENE_W + 4; x += 9) {
    const h = 6 + Math.floor(hash(x, 3, 17) * 8);
    const r = 5 + Math.floor(hash(x, 4, 17) * 3);
    for (let j = 0; j < h; j++) {
      const half = Math.round(r * Math.sqrt(1 - ((j - h / 2) / (h / 2 + 1)) ** 2));
      rect(c, x - half, SCENE_H - h + j, half * 2 + 1, 1, j < 2 ? '#7fae6c' : j < h / 2 ? '#5f9157' : '#4a7748');
    }
  }
  for (const lx of [40, 102, 206, 270]) {
    rect(c, lx, SCENE_H - 22, 1, 22, '#4b5866');
    rect(c, lx - 1, SCENE_H - 23, 3, 1, '#4b5866');
    rect(c, lx, SCENE_H - 22, 1, 1, '#e8eef3');
    void time;
  }
}

/** Птицы летят справа налево и машут крыльями. */
function paintBirds(c: Ctx, time: number): void {
  for (let i = 0; i < 5; i++) {
    const x = Math.round(SCENE_W + 20 - ((time * (9 + i * 2) + i * 70) % (SCENE_W + 40)));
    const y = Math.round(34 + i * 9 + Math.sin(time * 1.3 + i) * 2);
    const up = Math.floor(time * 5 + i) % 2 === 0;
    c.fillStyle = '#56657a';
    c.fillRect(x, y, 1, 1);
    c.fillRect(x - 1, y + (up ? -1 : 0), 1, 1);
    c.fillRect(x + 1, y + (up ? -1 : 0), 1, 1);
    c.fillRect(x - 2, y + (up ? -1 : 1), 1, 1);
    c.fillRect(x + 2, y + (up ? -1 : 1), 1, 1);
  }
}

// ── График «на луну»

const CHART: [number, number][] = [
  [150, 150], [164, 142], [176, 146], [190, 128], [202, 133], [214, 112], [226, 118], [240, 92], [252, 98],
  [266, 66], [276, 72], [288, 42], [296, 46], [304, 24],
];

function line(c: Ctx, x0: number, y0: number, x1: number, y1: number, col: string, limit = Infinity): number {
  // Брезенхэм: ровная пиксельная линия.
  let n = 0;
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  let x = x0;
  let y = y0;
  c.fillStyle = col;
  for (;;) {
    if (n >= limit) return n;
    c.fillRect(x, y, 1, 1);
    n++;
    if (x === x1 && y === y1) return n;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y += sy;
    }
  }
}

const CHART_LEN = CHART.slice(1).reduce((n, [x, y], i) => n + Math.max(Math.abs(x - CHART[i]![0]), Math.abs(y - CHART[i]![1])) + 1, 0);

/** График растёт слева направо (p от 0 до 1); голова графика мерцает, в конце — ракета. */
export function paintChart(c: Ctx, p: number, time: number): void {
  if (p <= 0) return;
  let budget = Math.floor(CHART_LEN * Math.min(1, p));
  let head: [number, number] = CHART[0]!;
  for (let i = 1; i < CHART.length && budget > 0; i++) {
    const [x0, y0] = CHART[i - 1]!;
    const [x1, y1] = CHART[i]!;
    const segLen = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) + 1;
    const take = Math.min(segLen, budget);
    // Тень, мягкая заливка под линией и сама линия.
    line(c, x0, y0 + 1, x1, y1 + 1, '#2b6a45', take);
    c.fillStyle = '#3fae62';
    c.globalAlpha = 0.14;
    for (let k = 0; k < take; k++) {
      const t = k / Math.max(1, segLen - 1);
      const x = Math.round(x0 + (x1 - x0) * t);
      const y = Math.round(y0 + (y1 - y0) * t);
      for (let yy = y + 2; yy < y + 14; yy += 2) c.fillRect(x, yy + (x % 2), 1, 1);
    }
    c.globalAlpha = 1;
    line(c, x0, y0, x1, y1, '#3fae62', take);
    if (take === segLen) {
      rect(c, x1 - 1, y1 - 1, 2, 2, '#ffffff');
      head = [x1, y1];
    } else {
      const t = take / segLen;
      head = [Math.round(x0 + (x1 - x0) * t), Math.round(y0 + (y1 - y0) * t)];
    }
    budget -= take;
  }
  const pulse = 0.55 + 0.45 * Math.sin(time * 7);
  c.globalAlpha = pulse;
  rect(c, head[0] - 2, head[1] - 2, 5, 5, '#b8f0c4');
  c.globalAlpha = 1;
  rect(c, head[0] - 1, head[1] - 1, 3, 3, '#ffffff');
  if (p >= 1) paintRocket(c, CHART[CHART.length - 1]![0] - 3, CHART[CHART.length - 1]![1] - 12, time);
}

function paintRocket(c: Ctx, x: number, y: number, time: number): void {
  const bob = Math.round(Math.sin(time * 3) * 1);
  const rows = ['...w...', '..www..', '..wbw..', '..www..', '.rwwwr.', '.r.f.r.', '...f...'];
  const pal: Record<string, string> = { w: '#f4efe6', b: '#5ec8ff', r: '#ff6b5e', f: Math.floor(time * 10) % 2 ? '#ffd166' : '#ff9f43' };
  rows.forEach((row, j) => {
    for (let i = 0; i < row.length; i++) {
      const col = pal[row[i]!];
      if (col) rect(c, x + i, y + j + bob, 1, 1, col);
    }
  });
}

/** Весь город (без комнаты за окном основателя). График «на луну» (доля chart) растёт за домом основателя. */
export function paintCity(c: Ctx, time: number, chart = 0): void {
  c.imageSmoothingEnabled = false;
  paintSky(c);
  paintSun(c);
  paintClouds(c, time);
  paintBirds(c, time);
  paintFar(c);
  paintMid(c, time);
  paintChart(c, chart, time);
  paintHouse(c, time);
  paintFront(c, time);
}

// ── Комната за окном основателя (в 8 раз подробнее): стена в тёплом свете лампы, полка, постер,
// стол у стены, iMac с кодом, герой спиной к нам.

const CODE_COLORS = ['#569cd6', '#c586c0', '#dcdcaa', '#9cdcfe', '#ce9178', '#4ec9b0', '#6a9955'];

export function paintInterior(c: Ctx, time: number, glass: number): void {
  c.imageSmoothingEnabled = false;
  // Стена: тёплая, у лампы светлее.
  for (let y = 0; y < IH; y++) rect(c, 0, y, IW, 1, y < 20 ? '#f1e4d0' : y < 40 ? '#f4e9d8' : '#ead9c2');
  for (let r = 18; r > 0; r -= 3) {
    c.globalAlpha = 0.08;
    rect(c, 6 - r / 2, 30 - r, r * 2, r * 2, '#fff0c8');
  }
  c.globalAlpha = 1;
  // Полка с книгами и растением.
  rect(c, 30, 9, 22, 2, '#7a4f35');
  ['#5470a8', '#c35d4b', '#e0b356', '#4f8f6a', '#8a5aa6'].forEach((col, i) => rect(c, 31 + i * 3, 3, 2, 6, col));
  rect(c, 47, 5, 4, 4, '#6a9c50');
  rect(c, 46, 4, 2, 2, '#8cc26c');
  // Постер.
  rect(c, 6, 6, 12, 15, '#2a3a5e');
  rect(c, 7, 7, 10, 13, '#ff9d6e');
  rect(c, 7, 13, 10, 7, '#3f6f8a');
  rect(c, 11, 9, 3, 3, '#fff1c8');
  // Стол.
  rect(c, 2, 46, 52, 3, '#8a5c3c');
  rect(c, 2, 49, 52, 2, '#6b4530');
  rect(c, 5, 51, 2, 21, '#4e3326');
  rect(c, 49, 51, 2, 21, '#4e3326');
  // Настольная лампа.
  rect(c, 6, 36, 1, 10, '#3a3a50');
  rect(c, 3, 33, 7, 4, '#3a3a50');
  rect(c, 4, 37, 5, 1, '#fff1c8');
  rect(c, 4, 45, 6, 1, '#3a3a50');
  // Кружка.
  rect(c, 44, 42, 4, 4, '#f4efe6');
  rect(c, 48, 43, 1, 2, '#f4efe6');
  // iMac: серебристый корпус, экран с кодом, подставка.
  const S = SCREEN_IN;
  rect(c, S.x - 2, S.y - 2, S.w + 4, S.h + 6, '#d3d6db');
  rect(c, S.x - 2, S.y + S.h, S.w + 4, 4, '#bfc3c9');
  rect(c, S.x + S.w / 2 - 3, S.y + S.h + 4, 6, 4, '#a9adb4');
  rect(c, S.x + S.w / 2 - 6, S.y + S.h + 8, 12, 1, '#8e939a');
  rect(c, S.x, S.y, S.w, S.h, '#1f1f1f');
  rect(c, S.x, S.y, 5, S.h, '#181818');
  for (let j = 0; j < 6; j++) rect(c, S.x + 1, S.y + 2 + j * 2, 2 + (j % 3), 1, j === 2 ? '#e2c08d' : '#8a8a8a');
  // Код печатается: строки появляются, последняя растёт, мигает курсор.
  const typed = Math.floor(time * 5);
  for (let row = 0; row < 6; row++) {
    const n = row + Math.floor(typed / 14);
    const indent = Math.floor(hash(n, 1) * 3) * 2;
    const len = 4 + Math.floor(hash(n, 2) * 9);
    const shown = row === 5 ? Math.min(len, typed % 14) : len;
    let x = S.x + 7 + indent;
    let left = shown;
    let k = 0;
    while (left > 0) {
      const part = Math.min(left, 2 + Math.floor(hash(n, 3 + k) * 4));
      rect(c, x, S.y + 2 + row * 2, part, 1, CODE_COLORS[Math.floor(hash(n, 9 + k) * CODE_COLORS.length)]!);
      x += part + 1;
      left -= part;
      k++;
    }
    if (row === 5 && Math.floor(time * 2) % 2 === 0) rect(c, x, S.y + 2 + row * 2, 1, 1, '#d0d0d0');
  }
  // Свечение экрана на стене.
  c.globalAlpha = 0.12;
  rect(c, S.x - 6, S.y - 5, S.w + 12, S.h + 10, '#9ec4ff');
  c.globalAlpha = 1;
  // Герой — тот же, что в квартире: сидит спиной к нам и печатает (два кадра).
  const frame = HERO_SIT[Math.floor(time * 6) % 2 === 0 || hash(Math.floor(time * 6), 7) < 0.3 ? 0 : 1]!;
  frame.forEach((row, j) => {
    for (let i = 0; i < row.length; i++) {
      const col = HERO_PALETTE[row[i]! as keyof typeof HERO_PALETTE];
      if (col) rect(c, 20 + i, 29 + j, 1, 1, col);
    }
  });
  // Спинка кресла закрывает поясницу: плечи и голова над ней, ниже — кресло, ножка и колёсики.
  rect(c, 20, 53, 16, 11, '#22222b');
  rect(c, 21, 54, 14, 9, '#2c2c36');
  rect(c, 21, 54, 14, 1, '#4a4a56');
  rect(c, 22, 55, 1, 7, '#3a3a46');
  rect(c, 27, 64, 2, 5, '#3a3a46');
  rect(c, 22, 69, 12, 1, '#3a3a46');
  rect(c, 21, 70, 2, 1, '#22222b');
  rect(c, 27, 70, 2, 1, '#22222b');
  rect(c, 33, 70, 2, 1, '#22222b');
  // Рама окна и отражение в стекле (гаснет, когда влетаем внутрь).
  rect(c, 0, 0, IW, 1, '#22172a');
  rect(c, 0, IH - 1, IW, 1, '#22172a');
  rect(c, 0, 0, 1, IH, '#22172a');
  rect(c, IW - 1, 0, 1, IH, '#22172a');
  if (glass > 0) {
    // Средник рамы и два косых блика на стекле.
    c.globalAlpha = 0.9 * glass;
    rect(c, Math.floor(IW / 2) - 1, 0, 2, IH, '#22172a');
    c.globalAlpha = 0.16 * glass;
    for (let k = 0; k < IH; k++) {
      rect(c, 10 + Math.floor(k * 0.6), IH - 1 - k, 4, 1, '#fff6e0');
      rect(c, 24 + Math.floor(k * 0.6), IH - 1 - k, 1, 1, '#fff6e0');
    }
    c.globalAlpha = 1;
  }
}

/** Размер подробной комнаты за окном. */
export const INTERIOR = { w: IW, h: IH };
