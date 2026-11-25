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
  v: '#b3a48e', // джемпер — складка (руки вдоль тела лёжа)
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
  /** Лицом к нам: оглядывается — голова повёрнута вправо (0) и влево (1). */
  look: Frame[];
  /** Сидит на краю кровати в профиль (лицом вправо), ступни на полу. */
  edge: Frame;
  /** Туловище лежащего героя сверху — видно, пока одеяло не натянуто до подбородка, 16×10. */
  sleepBody: Frame;
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

/** Туловище лицом к нам без рук: плечи и верх рукавов, руки дорисовывает armsDown. */
const TORSO_FRONT = [
  '..ooWwwccwwWoo..',
  '.oWwwwwwwwwwwWo.',
  '...owwwwwwwwo...',
  '...oWwwwwwwWo...',
  '...oWWWWWWWWo...',
  '....oppppppo....',
];

const TORSO_BACK = [
  '..ooWwwwwwwWoo..',
  '.oWwwwwwwwwwwWo.',
  '...owwwwwwwwo...',
  '...oWwwwwwwWo...',
  '...oWWWWWWWWo...',
  '....oPPPPPPo....',
];

/**
 * Руки прямо вниз от плеч, вплотную к телу, кисти у середины бедра — как у человека.
 * left/right — строка кисти (26 — рука опущена; 25 — вынесена вперёд при шаге и кажется короче).
 */
function armsDown(left: number, right: number): { rows: string[]; y: number } {
  const top = 22;
  const rows = Array.from({ length: Math.max(left, right) + 2 - top }, () => new Array<string>(16).fill('.'));
  const arm = (hand: number, outer: number, sleeve: number, inner: number) => {
    for (let y = top; y < hand; y++) {
      rows[y - top]![outer] = 'o';
      rows[y - top]![sleeve] = y < top + 2 ? 'w' : 'W';
      rows[y - top]![inner] = 'o';
    }
    rows[hand - top]![outer] = 'o';
    rows[hand - top]![sleeve] = 's';
    rows[hand - top]![inner] = 'o';
    rows[hand + 1 - top]![sleeve] = 'o';
  };
  arm(left, 1, 2, 3);
  arm(right, 14, 13, 12);
  return { rows: rows.map((r) => r.join('')), y: top };
}

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

/** Сидит в профиль: бедро вперёд, голень свисает (строки 27–31). */
const LEGS_RIGHT_SEATED = [
  '....oWWssppppo..',
  '.....oPpppppPPo.',
  '...........oPPo.',
  '...........oPPo.',
  '..........okkkko',
];

/**
 * Лёжа на спине, вид сверху: воротник под подбородком, плечи шире головы, руки вдоль тела.
 * Руки отделены от туловища тенью джемпера, тёмный контур — только снаружи. Ниже пояса — под одеялом.
 */
const SLEEP_BODY = [
  '....oWccccWo....',
  '...oWwwccwwWo...',
  '.ooWwwwwwwwwWoo.',
  'oWWvWwwwwwwWvWWo',
  'oWwvWwwwwwwWvwWo',
  'oWwvWWwwwwWWvwWo',
  'oWwvWWwwwwWWvwWo',
  'oWWvWWWwwWWWvWWo',
  'oWWvWWWWWWWWvWWo',
  'oWWvWWWWWWWWvWWo',
];

// ───────── сборка ─────────

const mirror = (rows: readonly string[]): string[] => rows.map((r) => r.split('').reverse().join(''));

/** Переставляет p и P — на шаге «передняя» нога меняется. */
const swapLegs = (rows: readonly string[]): string[] => rows.map((r) => r.replace(/[pP]/g, (ch) => (ch === 'p' ? 'P' : 'p')));

function compose(
  head: readonly string[],
  headY: number,
  body: readonly string[],
  legs: readonly string[] | null,
  extra?: { rows: readonly string[]; y: number },
): Frame {
  const px = Array.from({ length: HERO_FRAME_H }, () => new Array<string>(HERO_FRAME_W).fill('.'));
  const put = (rows: readonly string[], x: number, y: number) =>
    rows.forEach((row, j) => {
      for (let i = 0; i < row.length; i++) if (row[i] !== '.') px[y + j]![x + i] = row[i]!;
    });
  if (legs) put(legs, 0, 26);
  put(body, 0, 20);
  if (extra) put(extra.rows, 0, extra.y);
  put(head, 2, headY);
  return px.map((r) => r.join(''));
}

/** Накладывает строку поверх строки: точки сверху прозрачны. */
const overlay = (under: string, over: string): string => under.split('').map((ch, i) => (over[i] === '.' ? ch : over[i]!)).join('');

/** Сдвигает кадр вниз на n строк (низ уходит за край). */
const shiftDown = (rows: readonly string[], n: number): string[] => [...Array<string>(n).fill('.'.repeat(HERO_FRAME_W)), ...rows.slice(0, rows.length - n)];

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
    idle: [compose(HEAD_FRONT, 9, TORSO_FRONT, LEGS_FRONT, armsDown(26, 26)), compose(HEAD_FRONT, 10, TORSO_FRONT, LEGS_FRONT, armsDown(26, 26))],
    walk: [
      compose(HEAD_FRONT, 10, TORSO_FRONT, LEGS_FRONT_STEP, armsDown(26, 25)),
      compose(HEAD_FRONT, 9, TORSO_FRONT, LEGS_FRONT, armsDown(26, 26)),
      compose(HEAD_FRONT, 10, TORSO_FRONT, mirror(LEGS_FRONT_STEP), armsDown(25, 26)),
      compose(HEAD_FRONT, 9, TORSO_FRONT, LEGS_FRONT, armsDown(26, 26)),
    ],
  };
  const back = {
    idle: [compose(HEAD_BACK, 9, TORSO_BACK, LEGS_FRONT, armsDown(26, 26)), compose(HEAD_BACK, 10, TORSO_BACK, LEGS_FRONT, armsDown(26, 26))],
    walk: [
      compose(HEAD_BACK, 10, TORSO_BACK, mirror(LEGS_FRONT_STEP), armsDown(25, 26)),
      compose(HEAD_BACK, 9, TORSO_BACK, LEGS_FRONT, armsDown(26, 26)),
      compose(HEAD_BACK, 10, TORSO_BACK, LEGS_FRONT_STEP, armsDown(26, 25)),
      compose(HEAD_BACK, 9, TORSO_BACK, LEGS_FRONT, armsDown(26, 26)),
    ],
  };
  return {
    idle: [right.idle, back.idle, right.idle.map(mirror), front.idle],
    walk: [right.walk, back.walk, right.walk.map(mirror), front.walk],
    sit: [compose(HEAD_BACK, 9, BODY_SIT, null), compose(HEAD_BACK, 9, BODY_SIT_TYPE, null)],
    sleepHead: closeEyes(HEAD_FRONT),
    // оглядывается: голова в профиль вправо и влево, тело стоит как стояло
    look: [compose(HEAD_RIGHT, 9, TORSO_FRONT, LEGS_FRONT, armsDown(26, 26)), compose(mirror(HEAD_RIGHT), 9, TORSO_FRONT, LEGS_FRONT, armsDown(26, 26))],
    // на краю кровати: голова и туловище ниже на 3 пикселя, бёдра вперёд
    edge: (() => {
      const top = shiftDown(compose(HEAD_RIGHT, 9, BODY_RIGHT, null), 3);
      return top.map((row, y) => (y < 27 ? row : overlay(row, LEGS_RIGHT_SEATED[y - 27]!)));
    })(),
    sleepBody: SLEEP_BODY,
  };
}

/** Через сколько секунд без дела герой впервые оглядывается, как часто и как долго. */
const LOOK_AFTER = 4;
const LOOK_EVERY = 9;
const LOOK_SECONDS = 1.4;

export interface IdlePose {
  kind: 'idle' | 'look';
  /** Номер кадра в своём наборе: idle — из стойки этого направления, look — 0 вправо, 1 влево. */
  frame: number;
}

/**
 * Что делает стоящий без дела герой через `seconds` секунд: дышит, а лицом к нам иногда
 * оглядывается — то вправо, то влево. Чистая функция — проверяется тестами.
 */
export function idlePose(seconds: number, dir: number): IdlePose {
  const breathing: IdlePose = { kind: 'idle', frame: Math.floor(seconds / 0.9) % 2 };
  if (dir !== 3 || seconds < LOOK_AFTER) return breathing;
  const since = seconds - LOOK_AFTER;
  const cycle = Math.floor(since / LOOK_EVERY);
  return since - cycle * LOOK_EVERY < LOOK_SECONDS ? { kind: 'look', frame: cycle % 2 } : breathing;
}
