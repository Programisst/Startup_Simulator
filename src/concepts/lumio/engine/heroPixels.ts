// Наш основатель, нарисованный по пикселям: аккуратная тёмная стрижка, светлый джемпер
// с воротником рубашки, тёмно-синие брюки, белые кеды. Кадр 16×32, как у предметов комнаты.
// Каждая буква — цвет из палитры, точка — пусто. Кадры собираются из частей: голова, туловище, ноги.
// Здесь только данные (без браузера), поэтому их проверяют тесты.

export const HERO_FRAME_W = 16;
export const HERO_FRAME_H = 32;

export const HERO_PALETTE: Record<string, string> = {
  o: '#33303f', // контур
  H: '#6a5248', // волосы — блик
  h: '#46352f', // волосы
  d: '#2f2420', // волосы — тень
  s: '#f5cdb0', // кожа
  S: '#e0a88b', // кожа — тень
  e: '#2b2733', // глаз
  w: '#f0e9dd', // джемпер
  W: '#d4c7b3', // джемпер — тень
  c: '#ffffff', // воротник рубашки
  p: '#3f4863', // брюки
  P: '#30374d', // брюки — тень
  k: '#f6f3ee', // кеды
  K: '#c9c2b8', // подошва
};

export type Frame = string[];

export interface HeroFrames {
  /** [направление][кадр]: 0 — вправо, 1 — вверх (спиной), 2 — влево, 3 — вниз (лицом). */
  idle: Frame[][];
  walk: Frame[][];
  /** Сидит за столом спиной к нам: два кадра — руки печатают. */
  sit: Frame[];
  /** Голова на подушке с закрытыми глазами, 12×11. */
  sleepHead: Frame;
}

// ───────── головы 12×11 (ставятся в столбец 2) ─────────

const HEAD_FRONT = [
  '..oooooooo..',
  '.oHHHhhhhhho',
  'oHHhhhhhhhho',
  'oHhhhhhhhhdo',
  'ohhhhhssssdo',
  'ohhsssssssho',
  'ohsessssesho',
  'ossessssesso',
  'oSssssssssSo',
  '.oSSssssSSo.',
  '..oooooooo..',
];

const HEAD_BACK = [
  '..oooooooo..',
  '.oHHHhhhhhho',
  'oHHhhhhhhhho',
  'oHhhhhhhhhdo',
  'ohhhhhhhhhdo',
  'ohhhhhhhhhdo',
  'ohhhhhhhhhdo',
  'odhhhhhhhhdo',
  'odhhhhhhhddo',
  '.oddhhhhddo.',
  '..oSssssSo..',
];

/** В профиль: одно ухо, один глаз, рта нет. */
const HEAD_RIGHT = [
  '..oooooooo..',
  '.oHHHhhhhhho',
  'oHHhhhhhhhho',
  'oHhhhhhhhhho',
  'ohhhhhhhhsso',
  'ohhhhhhsssso',
  'ohhhhSssseso',
  'ohhhhSssseso',
  'odhhhsssssso',
  '.oddssssssSo',
  '..oooooooo..',
];

// ───────── туловище 16×6 (строки 20–25) ─────────

const BODY_FRONT = [
  '..ooWwwccwwWoo..',
  '.oWWwwwwwwwwWWo.',
  '.oWWwwwwwwwwWWo.',
  '.oWoWwwwwwwWoWo.',
  '.osoWWWWWWWWoso.',
  '..o.oppppppo.o..',
];

/** Шаг: правая рука вынесена вперёд — кисть выше. */
const BODY_FRONT_SWING = [
  '..ooWwwccwwWoo..',
  '.oWWwwwwwwwwWWo.',
  '.oWWwwwwwwwwWWo.',
  '.oWoWwwwwwwWoso.',
  '.osoWWWWWWWWooo.',
  '..o.oppppppo....',
];

const BODY_BACK = [
  '..ooWwwwwwwWoo..',
  '.oWWwwwwwwwwWWo.',
  '.oWWwwwwwwwwWWo.',
  '.oWoWwwwwwwWoWo.',
  '.osoWWWWWWWWoso.',
  '..o.oPPPPPPo.o..',
];

const BODY_BACK_SWING = [
  '..ooWwwwwwwWoo..',
  '.oWWwwwwwwwwWWo.',
  '.oWWwwwwwwwwWWo.',
  '.oWoWwwwwwwWoso.',
  '.osoWWWWWWWWooo.',
  '..o.oPPPPPPo....',
];

const BODY_RIGHT = [
  '.....oowwco.....',
  '....owwwwwwo....',
  '....owwWWwwo....',
  '....owwWWwwo....',
  '....oWWssWWo....',
  '.....opppppo....',
];

const BODY_RIGHT_ARM_FWD = [
  '.....oowwco.....',
  '....owwwwwwo....',
  '....owwwWWwo....',
  '....owwwWWWo....',
  '....oWWWWssW....',
  '.....opppppo....',
];

const BODY_RIGHT_ARM_BACK = [
  '.....oowwco.....',
  '....owwwwwwo....',
  '....owwWWwwo....',
  '....owWWwwwo....',
  '....sssWWWWo....',
  '.....opppppo....',
];

/** Сидит спиной: руки ушли вперёд к клавиатуре. Низ закрывает спинка кресла. */
const BODY_SIT = [
  '..ooWwwwwwwWoo..',
  '.oWWwwwwwwwwWWo.',
  '.oWWwwwwwwwwWWo.',
  '..oWWwwwwwwWWo..',
  '...oWWWWWWWWo...',
  '....oPPPPPPo....',
];

const BODY_SIT_TYPE = [
  '..ooWwwwwwwWoo..',
  '.oWWwwwwwwwwWWo.',
  '..oWwwwwwwwwWWo.',
  '..oWWwwwwwwWWo..',
  '...oWWWWWWWWo...',
  '....oPPPPPPo....',
];

// ───────── ноги 16×6 (строки 26–31) ─────────

const LEGS_FRONT = [
  '....opppPPPo....',
  '....opppPPPo....',
  '....oppooPPo....',
  '....oppooPPo....',
  '...okkkookkko...',
  '....ooo..ooo....',
];

/** Левая нога поднята. */
const LEGS_FRONT_STEP = [
  '....opppPPPo....',
  '....opppPPPo....',
  '....oppooPPo....',
  '...okkkooPPo....',
  '....ooo.okkko...',
  '.........ooo....',
];

const LEGS_RIGHT = [
  '.....opppppo....',
  '.....opppppo....',
  '.....oppppPo....',
  '.....oPpppPo....',
  '.....okkkkkko...',
  '......oooooo....',
];

const LEGS_RIGHT_STRIDE = [
  '.....opppppo....',
  '....oppppPPPo...',
  '....oppo.oPPo...',
  '...oppo...oPPo..',
  '..okkko...okkkko',
  '...ooo.....oooo.',
];

// ───────── сборка ─────────

const mirror = (rows: readonly string[]): string[] => rows.map((r) => r.split('').reverse().join(''));

/** Переставляет p и P — на шаге «передняя» нога меняется. */
const swapLegs = (rows: readonly string[]): string[] => rows.map((r) => r.replace(/[pP]/g, (ch) => (ch === 'p' ? 'P' : 'p')));

function compose(head: readonly string[], headY: number, body: readonly string[], legs: readonly string[] | null): Frame {
  const px = Array.from({ length: HERO_FRAME_H }, () => new Array<string>(HERO_FRAME_W).fill('.'));
  const put = (rows: readonly string[], x: number, y: number) =>
    rows.forEach((row, j) => {
      for (let i = 0; i < row.length; i++) if (row[i] !== '.') px[y + j]![x + i] = row[i]!;
    });
  if (legs) put(legs, 0, 26);
  put(body, 0, 20);
  put(head, 2, headY);
  return px.map((r) => r.join(''));
}

/** Глаза закрыты (моргание и сон). */
export function closeEyes(rows: readonly string[]): string[] {
  let first = true;
  return rows.map((r) => {
    if (!r.includes('e')) return r;
    // Верхняя строка глаз — кожа, нижняя остаётся тонкой чёрточкой.
    if (first) {
      first = false;
      return r.replace(/e/g, 's');
    }
    return r;
  });
}

export function heroFrames(): HeroFrames {
  const right = {
    idle: [compose(HEAD_RIGHT, 9, BODY_RIGHT, LEGS_RIGHT), compose(HEAD_RIGHT, 10, BODY_RIGHT, LEGS_RIGHT)],
    walk: [
      compose(HEAD_RIGHT, 10, BODY_RIGHT_ARM_BACK, LEGS_RIGHT_STRIDE),
      compose(HEAD_RIGHT, 9, BODY_RIGHT, LEGS_RIGHT),
      compose(HEAD_RIGHT, 10, BODY_RIGHT_ARM_FWD, swapLegs(LEGS_RIGHT_STRIDE)),
      compose(HEAD_RIGHT, 9, BODY_RIGHT, LEGS_RIGHT),
    ],
  };
  const front = {
    idle: [compose(HEAD_FRONT, 9, BODY_FRONT, LEGS_FRONT), compose(HEAD_FRONT, 10, BODY_FRONT, LEGS_FRONT)],
    walk: [
      compose(HEAD_FRONT, 10, BODY_FRONT_SWING, LEGS_FRONT_STEP),
      compose(HEAD_FRONT, 9, BODY_FRONT, LEGS_FRONT),
      compose(HEAD_FRONT, 10, mirror(BODY_FRONT_SWING), mirror(LEGS_FRONT_STEP)),
      compose(HEAD_FRONT, 9, BODY_FRONT, LEGS_FRONT),
    ],
  };
  const back = {
    idle: [compose(HEAD_BACK, 9, BODY_BACK, LEGS_FRONT), compose(HEAD_BACK, 10, BODY_BACK, LEGS_FRONT)],
    walk: [
      compose(HEAD_BACK, 10, BODY_BACK_SWING, mirror(LEGS_FRONT_STEP)),
      compose(HEAD_BACK, 9, BODY_BACK, LEGS_FRONT),
      compose(HEAD_BACK, 10, mirror(BODY_BACK_SWING), LEGS_FRONT_STEP),
      compose(HEAD_BACK, 9, BODY_BACK, LEGS_FRONT),
    ],
  };
  return {
    idle: [right.idle, back.idle, right.idle.map(mirror), front.idle],
    walk: [right.walk, back.walk, right.walk.map(mirror), front.walk],
    sit: [compose(HEAD_BACK, 9, BODY_SIT, null), compose(HEAD_BACK, 9, BODY_SIT_TYPE, null)],
    sleepHead: closeEyes(HEAD_FRONT),
  };
}
