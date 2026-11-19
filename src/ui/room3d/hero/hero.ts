// Основатель — пиксельный герой 32×48. Стройный, опрятный, минималистичный.
// Рисуется кодом по кадрам: спереди, со спины, сбоку; восемь кадров шага, дыхание, моргание, сидит за столом.
import { capsule, dots, ellipse, paint, PixelBuffer, roundRect, type Tones } from './paint';

export type Facing = 'down' | 'up' | 'right' | 'left';

export interface HeroPose {
  facing: Facing;
  /** Фаза шага 0…1; null — стоит на месте. */
  walk: number | null;
  /** Вдох: 0 или 1 (плечи и голова на пиксель ниже). */
  breath: number;
  blink: boolean;
  /** Сидит за столом спиной к нам; typing — какая рука сейчас бьёт по клавишам (0 или 1), null — не печатает. */
  sit?: { typing: number | null };
}

export type OutfitId = 'knit' | 'shirt' | 'overshirt';

interface Outfit {
  top: Tones;
  pants: Tones;
  shoes: Tones;
  sole: string;
  /** Футболка под расстёгнутой рубашкой. */
  under?: Tones;
}

export const OUTFITS: Record<OutfitId, Outfit> = {
  // Молочный джемпер, графитовые брюки, белые кеды.
  knit: {
    top: ['#8d8373', '#cdc3b1', '#e9e2d3', '#f8f4ec'],
    pants: ['#121317', '#22242a', '#31343c', '#474b55'],
    shoes: ['#7a756e', '#d2cdc4', '#f0ede7', '#ffffff'],
    sole: '#b3ada3',
  },
  // Белая рубашка, тёмно-синие брюки со стрелками, чёрные туфли.
  shirt: {
    top: ['#7d8592', '#c8cfd9', '#edf0f4', '#ffffff'],
    pants: ['#0f121b', '#1d2231', '#2b3145', '#454e6a'],
    shoes: ['#08080a', '#18181c', '#26262c', '#5d5d68'],
    sole: '#3b3b42',
  },
  // Хвойный оверширт навыпуск, белая футболка, бежевые брюки, белые кеды.
  overshirt: {
    top: ['#18261f', '#2a4034', '#3a5646', '#55765f'],
    pants: ['#6b604f', '#a69780', '#c6b9a2', '#ddd2bd'],
    shoes: ['#7a756e', '#d2cdc4', '#f0ede7', '#ffffff'],
    sole: '#b3ada3',
    under: ['#9a968e', '#d9d5cc', '#f3f0ea', '#ffffff'],
  },
};

/** Во сколько раз герой рисуется подробнее условной сетки 32×48. */
export const HERO_SCALE = 3;
export const HERO_W = 32;
export const HERO_H = 48;
/** Нижний ряд подошв. */
export const HERO_FEET = 46;
/** Рост в пикселях от макушки до подошв. */
export const HERO_TALL = 43;

const OUT = '#16101a';
const SKIN: Tones = ['#a8644d', '#dc9c80', '#f1c6a6', '#fde0c9'];
/** Кисти: кант мягче, чтобы на светлой одежде рука не читалась как колечко. */
const HAND: Tones = ['#c98468', '#dc9c80', '#f1c6a6', '#fde0c9'];
const HAIR: Tones = ['#0f0a0c', '#231817', '#372622', '#5a4036'];
const LIPS = '#c47f6e';
const EYE = '#1c141c';
const BUCKLE = '#c7b289';

/** Дальние рука и нога — на тон темнее. */
const FAR = -0.3;
const ANKLE = 42.5;

function below(map: Record<number, number>, up: number, fallback: number) {
  return (x: number, y: number) => y < up + (map[x] ?? fallback);
}

/** Блик в глазу — один настоящий пиксель в верхнем углу. */
function glint(buf: PixelBuffer, x: number, y: number): void {
  const k = buf.scale;
  if (k > 1) buf.raw(x * k + k - 1, y * k, '#f4f1ec');
}

function row(buf: PixelBuffer, y: number, x0: number, x1: number, color: string): void {
  for (let x = x0; x <= x1; x++) buf.set(x, y, color);
}

function col(buf: PixelBuffer, x: number, y0: number, y1: number, color: string): void {
  for (let y = y0; y <= y1; y++) buf.set(x, y, color);
}

// ——— Спереди и со спины ———

function frontHead(buf: PixelBuffer, up: number, blink: boolean): void {
  paint(buf, roundRect(14.4, up - 15, 17.6, up - 11.6, 0.8), SKIN, { bias: FAR });
  paint(buf, ellipse(16, up - 19.5, 4.9, 5.6), SKIN, { rim: true });
  // Аккуратная стрижка с пробором: волосы зачёсаны набок, виски короткие.
  const line: Record<number, number> = { 10: -17, 11: -18, 12: -21, 13: -22, 14: -22, 15: -22, 16: -23, 17: -23, 18: -22, 19: -21, 20: -19, 21: -17 };
  paint(buf, ellipse(16, up - 21.2, 5.5, 5.0), HAIR, { rim: true, clip: below(line, up, -24) });
  dots(buf, HAIR[3], [
    [14, up - 25],
    [15, up - 25],
    [16, up - 25],
    [17, up - 24],
    [13, up - 24],
  ]);
  buf.set(12, up - 24, HAIR[0]); // пробор
  // Уши.
  dots(buf, SKIN[1], [
    [10, up - 19],
    [10, up - 18],
    [21, up - 19],
    [21, up - 18],
  ]);
  // Брови, глаза, рот — по одному-два пикселя, без лишнего.
  dots(buf, HAIR[1], [
    [12, up - 21],
    [13, up - 21],
    [18, up - 21],
    [19, up - 21],
  ]);
  if (blink) {
    dots(buf, SKIN[0], [
      [13, up - 18],
      [18, up - 18],
    ]);
  } else {
    dots(buf, EYE, [
      [13, up - 19],
      [13, up - 18],
      [18, up - 19],
      [18, up - 18],
    ]);
    glint(buf, 13, up - 19);
    glint(buf, 18, up - 19);
  }
  dots(buf, SKIN[1], [[16, up - 17]]);
  dots(buf, LIPS, [
    [15, up - 15],
    [16, up - 15],
  ]);
}

function backHead(buf: PixelBuffer, up: number): void {
  paint(buf, roundRect(14.4, up - 15, 17.6, up - 11.6, 0.8), SKIN, { bias: FAR });
  paint(buf, ellipse(16, up - 20.2, 5.2, 5.7), HAIR, { rim: true, clip: (_x, y) => y < up - 15 });
  dots(buf, HAIR[3], [
    [14, up - 25],
    [15, up - 25],
    [13, up - 24],
  ]);
  dots(buf, SKIN[1], [
    [10, up - 19],
    [10, up - 18],
    [21, up - 19],
    [21, up - 18],
  ]);
}

function frontDetails(buf: PixelBuffer, o: Outfit, id: OutfitId, up: number, hip: number, back: boolean): void {
  const t = o.top;
  if (id === 'knit') {
    if (!back)
      dots(buf, t[1], [
        [14, up - 12],
        [15, up - 11],
        [16, up - 11],
        [17, up - 12],
      ]);
    row(buf, hip - 1, 11, 20, t[1]); // резинка
  } else if (id === 'shirt') {
    if (back) row(buf, up - 9, 12, 19, t[1]); // кокетка
    else {
      dots(buf, SKIN[2], [
        [15, up - 12],
        [16, up - 12],
      ]);
      dots(buf, t[0], [
        [13, up - 12],
        [14, up - 11],
        [18, up - 12],
        [17, up - 11],
      ]);
      col(buf, 15, up - 10, hip - 1, t[1]); // планка
      dots(buf, t[0], [
        [15, up - 8],
        [15, up - 5],
        [15, up - 2],
      ]);
    }
    row(buf, hip, 11, 20, o.pants[0]); // ремень
    if (!back)
      dots(buf, BUCKLE, [
        [15, hip],
        [16, hip],
      ]);
  } else {
    const u = o.under!;
    if (back) row(buf, up - 9, 12, 19, t[1]);
    else {
      for (const x of [15, 16]) col(buf, x, up - 12, hip, x === 15 ? u[3] : u[2]);
      col(buf, 14, up - 11, hip, t[0]);
      col(buf, 17, up - 11, hip, t[0]);
      // Нагрудные карманы.
      row(buf, up - 9, 11, 13, t[1]);
      row(buf, up - 9, 18, 20, t[1]);
      dots(buf, t[1], [
        [11, up - 8],
        [11, up - 7],
        [20, up - 8],
        [20, up - 7],
      ]);
    }
  }
}

function drawFrontBack(buf: PixelBuffer, pose: HeroPose, o: Outfit, id: OutfitId, back: boolean): void {
  const s = pose.walk === null ? 0 : Math.sin(pose.walk * Math.PI * 2);
  const bob = pose.walk === null ? 0 : -Math.round(1 - Math.abs(s));
  const hip = 28 + bob;
  const up = hip + pose.breath;
  const tucked = id === 'shirt';

  // Ноги: шагающая вперёд — на пиксель ниже (ближе к нам), задняя чуть приподнята.
  for (const leg of [
    { x: 14, s },
    { x: 18, s: -s },
  ]) {
    const fwd = back ? 0 : Math.round(Math.max(0, leg.s));
    const lift = Math.round(Math.max(0, -leg.s) * 1.2);
    const ankle = ANKLE + fwd - lift;
    paint(buf, capsule(leg.x, hip, leg.x, ankle - 0.3, 1.9), o.pants, { rim: true });
    if (id === 'shirt') col(buf, leg.x - 1, hip + 4, Math.floor(ankle) - 2, o.pants[3]); // стрелки
    paint(buf, roundRect(leg.x - 2.2, ankle - 0.4, leg.x + 2.2, ankle + 3.5, 1.3), o.shoes, { rim: true });
    row(buf, Math.floor(ankle + 3), Math.ceil(leg.x - 1.7), Math.floor(leg.x + 1.2), o.sole);
  }

  // Туловище, поверх — руки вдоль тела.
  paint(buf, roundRect(10.4, up - 12.6, 21.6, hip + (tucked ? 0.2 : 0.9), 2.4), o.top, { rim: true });
  frontDetails(buf, o, id, up, hip, back);
  for (const arm of [
    { sx: 11.1, hx: 10.3, a: -s },
    { sx: 20.9, hx: 21.7, a: s },
  ]) {
    const off = Math.round(arm.a * 0.9) * (back ? -1 : 1);
    paint(buf, capsule(arm.sx, up - 11.3, arm.hx, up - 1.6 + off, 1.65), o.top, { rim: true, bias: off < 0 ? FAR : 0 });
    if (!back || off >= 0) paint(buf, ellipse(arm.hx, up - 0.4 + off, 1.1, 1.3), HAND, { rim: true });
  }

  if (back) backHead(buf, up);
  else frontHead(buf, up, pose.blink);
}

// ——— Сбоку (лицом вправо; влево — зеркально) ———

interface Leg {
  knee: [number, number];
  ankle: [number, number];
}

function sideLeg(phase: number, walking: boolean): Leg {
  // Спокойный шаг: небольшой размах, колено сгибается только когда нога переносится вперёд.
  const swing = walking ? 0.34 * Math.sin(phase) : 0;
  const bend = walking ? 0.55 * Math.max(0, Math.cos(phase)) : 0;
  const knee: [number, number] = [Math.sin(swing) * 7.2, Math.cos(swing) * 7.2];
  const shin = swing - bend;
  return { knee, ankle: [knee[0] + Math.sin(shin) * 7.3, knee[1] + Math.cos(shin) * 7.3] };
}

function drawSide(buf: PixelBuffer, pose: HeroPose, o: Outfit, id: OutfitId): void {
  const walking = pose.walk !== null;
  const ph = (pose.walk ?? 0) * Math.PI * 2;
  const near = sideLeg(ph, walking);
  const far = sideLeg(ph + Math.PI, walking);
  // Нижняя из ступней всегда стоит на полу — отсюда естественное покачивание.
  const lowest = Math.max(near.ankle[1], far.ankle[1]) + 3.5;
  const hip = Math.round(HERO_FEET - lowest);
  const up = hip + pose.breath;
  const hx = 16;
  const swing = walking ? Math.sin(ph) : 0;

  const drawLeg = (leg: Leg, bias: number) => {
    const kx = hx + leg.knee[0];
    const ky = hip + leg.knee[1];
    const ax = hx + leg.ankle[0];
    const ay = hip + leg.ankle[1];
    paint(buf, capsule(hx, hip, kx, ky, 1.75), o.pants, { rim: true, bias });
    paint(buf, capsule(kx, ky, ax, ay - 0.3, 1.6), o.pants, { rim: true, bias });
    paint(buf, roundRect(ax - 1.7, ay - 0.1, ax + 3.1, ay + 3.5, 1.1), o.shoes, { rim: true, bias });
    row(buf, Math.floor(ay + 3), Math.round(ax - 1.2), Math.round(ax + 2.6), o.sole);
  };
  const drawArm = (dir: number, bias: number) => {
    const a = -0.3 * swing * dir;
    const sx = 16.1;
    const sy = up - 11.4;
    const ex = sx + Math.sin(a) * 10;
    const ey = sy + Math.cos(a) * 10;
    paint(buf, capsule(sx, sy, ex, ey, 1.65), o.top, { rim: true, bias });
    paint(buf, ellipse(ex + Math.sin(a) * 0.7, ey + 1.0, 1.05, 1.3), HAND, { rim: true, bias });
  };

  drawArm(-1, FAR);
  drawLeg(far, FAR);
  drawLeg(near, 0);
  paint(buf, roundRect(12.7, up - 12.6, 19.5, hip + (id === 'shirt' ? 0.2 : 0.9), 2.3), o.top, { rim: true });
  if (id === 'knit') row(buf, hip - 1, 13, 18, o.top[1]);
  if (id === 'shirt') {
    row(buf, hip, 13, 19, o.pants[0]);
    buf.set(19, hip, BUCKLE);
  }
  if (id === 'overshirt') {
    dots(buf, o.under![2], [
      [18, up - 12],
      [19, up - 12],
    ]);
    col(buf, 18, up - 10, hip, o.top[1]);
  }
  // Шея, голова, стрижка.
  paint(buf, roundRect(14.6, up - 15, 17.6, up - 11.6, 0.8), SKIN, { bias: FAR });
  paint(buf, ellipse(16.8, up - 19.5, 4.8, 5.6), SKIN, { rim: true });
  const line: Record<number, number> = { 11: -15, 12: -15, 13: -16, 14: -16, 15: -21, 16: -22, 17: -23, 18: -23, 19: -23, 20: -22, 21: -21 };
  paint(buf, ellipse(16.1, up - 21.1, 5.4, 5.0), HAIR, { rim: true, clip: below(line, up, -24) });
  dots(buf, HAIR[3], [
    [15, up - 25],
    [16, up - 25],
    [17, up - 25],
    [18, up - 24],
  ]);
  dots(buf, SKIN[1], [
    [15, up - 19],
    [15, up - 18],
  ]);
  buf.set(19, up - 21, HAIR[1]);
  if (pose.blink) buf.set(19, up - 18, SKIN[0]);
  else {
    dots(buf, EYE, [
      [19, up - 19],
      [19, up - 18],
    ]);
    glint(buf, 19, up - 19);
  }
  buf.set(21, up - 17, SKIN[1]); // нос; рта в профиль нет — две точки читались бы как маска
  drawArm(1, 0);
}

// ——— Сидит за столом, спиной к нам ———

function drawSitting(buf: PixelBuffer, pose: HeroPose, o: Outfit, id: OutfitId): void {
  // Сидя таз ниже, чем стоя: голова оказывается чуть ниже верхнего края монитора.
  const hip = 34;
  const up = hip + pose.breath;
  const typing = pose.sit?.typing ?? null;
  // Руки уходят вперёд к клавиатуре — видны только локти.
  for (const [sx, ex, i] of [
    [11.1, 10.2, 0],
    [20.9, 21.8, 1],
  ] as const) {
    const lift = typing === i ? -1 : 0;
    paint(buf, capsule(sx, up - 11.3, ex, up - 5 + lift, 1.7), o.top, { rim: true, bias: FAR });
  }
  paint(buf, roundRect(10.4, up - 12.6, 21.6, hip + 0.9, 2.4), o.top, { rim: true });
  frontDetails(buf, o, id, up, hip, true);
  backHead(buf, up + 0.4);
}

/** Рисует один кадр героя. */
export function drawHero(pose: HeroPose, outfit: OutfitId = 'knit'): PixelBuffer {
  const buf = new PixelBuffer(HERO_W, HERO_H, HERO_SCALE);
  const o = OUTFITS[outfit];
  if (pose.sit) drawSitting(buf, pose, o, outfit);
  else if (pose.facing === 'down' || pose.facing === 'up') drawFrontBack(buf, pose, o, outfit, pose.facing === 'up');
  else drawSide(buf, pose, o, outfit);
  buf.outline(OUT);
  return buf;
}

/** Ключ кадра для кэша. */
export function heroFrameKey(pose: HeroPose, outfit: OutfitId): string {
  return [outfit, pose.facing, pose.walk ?? 'idle', pose.breath, pose.blink ? 'b' : '', pose.sit ? `s${pose.sit.typing ?? '-'}` : ''].join('|');
}
