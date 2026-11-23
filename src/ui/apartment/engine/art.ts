// Пиксель-арт квартиры. Всё нарисовано для проекта попиксельно, в одной палитре
// и с одним тёмным контуром #3a3a50 — чужих картинок нет.

import { HERO_PALETTE, closeEyes, heroFrames } from './heroPixels';

export type Spr = HTMLCanvasElement;

/** Цвета. Один контур и одни тени на все предметы — так комната смотрится одним набором. */
export const C = {
  out: '#3a3a50',
  out2: '#46465e',
  // орех
  wood: '#7b5a43',
  woodHi: '#957159',
  woodLo: '#664836',
  woodDk: '#523a2c',
  grain: '#6f513d',
  // белая мебель
  white: '#f4f1ec',
  white2: '#e6e1d9',
  white3: '#cfc8be',
  white4: '#ada59b',
  // чёрный металл/пластик
  blk: '#2c2b36',
  blk2: '#3b3a48',
  blkHi: '#565567',
  metal: '#c7cad2',
  metal2: '#9da2ae',
  // текстиль
  terra: '#b8643f',
  terraDk: '#9a4f31',
  terraHi: '#cd7d55',
  oat: '#cdbfab',
  oat2: '#b9aa94',
  oatHi: '#ddd2c1',
  leather: '#a35f3a',
  leatherDk: '#844a2c',
  leatherHi: '#bf7a50',
  // картон
  card: '#d4a46a',
  cardTop: '#e3b97f',
  cardDk: '#b98a52',
  tape: '#e8d6ae',
};

export class G {
  constructor(readonly c: CanvasRenderingContext2D) {}
  r(x: number, y: number, w: number, h: number, col: string): void {
    this.c.fillStyle = col;
    this.c.fillRect(x, y, w, h);
  }
  p(x: number, y: number, col: string): void {
    this.r(x, y, 1, 1, col);
  }
  clear(x: number, y: number, w = 1, h = 1): void {
    this.c.clearRect(x, y, w, h);
  }
  /** Прямоугольник с контуром; углы срезаны на пиксель. */
  box(x: number, y: number, w: number, h: number, fill: string, out: string = C.out, round = true): void {
    this.r(x, y, w, h, out);
    this.r(x + 1, y + 1, w - 2, h - 2, fill);
    if (round) {
      this.clear(x, y);
      this.clear(x + w - 1, y);
      this.clear(x, y + h - 1);
      this.clear(x + w - 1, y + h - 1);
    }
  }
  /** Рисунок по строкам: каждая буква — цвет из палитры, точка — пусто. */
  grid(x: number, y: number, rows: string[], pal: Record<string, string>): void {
    rows.forEach((row, j) => {
      for (let i = 0; i < row.length; i++) {
        const col = pal[row[i]!];
        if (col) this.p(x + i, y + j, col);
      }
    });
  }
}

export function make(w: number, h: number, draw: (g: G) => void): Spr {
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const ctx = cv.getContext('2d');
  if (!ctx) throw new Error('Нет 2D-контекста');
  draw(new G(ctx));
  return cv;
}

/** Детерминированный «шум» для узоров (интерфейсу Math.random не нужен — картинка всегда одинаковая). */
export function hash(a: number, b = 0, c = 0): number {
  let h = (a * 374761393 + b * 668265263 + c * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967295;
}

// ───────────────────────── Герой ─────────────────────────

export interface HeroArt {
  /** [направление][кадр]: 0 — вправо, 1 — вверх, 2 — влево, 3 — вниз. */
  idle: Spr[][];
  /** Моргнул: по кадру на направление. */
  blink: Spr[];
  walk: Spr[][];
  sit: Spr[];
  sleepHead: Spr;
  /** Лицом к нам: оглядывается вправо и влево, когда стоит без дела. */
  look: Spr[];
}

function paintRows(rows: readonly string[]): Spr {
  return make(rows[0]!.length, rows.length, (g) => g.grid(0, 0, rows as string[], HERO_PALETTE));
}

function buildHero(): HeroArt {
  const f = heroFrames();
  return {
    idle: f.idle.map((d) => d.map(paintRows)),
    blink: f.idle.map((d) => paintRows(closeEyes(d[0]!))),
    walk: f.walk.map((d) => d.map(paintRows)),
    sit: f.sit.map(paintRows),
    sleepHead: paintRows(f.sleepHead),
    look: f.look.map(paintRows),
  };
}

/** Обводит рисунок снаружи тёмным контуром в 1 пиксель — как у всех предметов комнаты. */
function outlined(w: number, h: number, draw: (g: G) => void, color: string = C.out): Spr {
  const src = make(w, h, draw);
  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  const ctx = out.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(src, 0, 0);
  const d = ctx.getImageData(0, 0, w, h);
  const solid = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && d.data[(y * w + x) * 4 + 3]! > 0;
  const marks: [number, number][] = [];
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) if (!solid(x, y) && (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1))) marks.push([x, y]);
  ctx.fillStyle = color;
  for (const [x, y] of marks) ctx.fillRect(x, y, 1, 1);
  return out;
}

export interface Art {
  hero: HeroArt;
  plantTree: Spr;
  plantPot: Spr;
  plantSmall: Spr;
  sofa: Spr;
  tableLamp: Spr;
  desk: Spr;
  monitor: Spr;
  keyboard: Spr;
  chair: Spr;
  deskLamp: Spr;
  mug: Spr;
  books: Spr;
  bed: Spr;
  blanketTop: Spr;
  nightstand: Spr;
  counter: Spr;
  coffee: Spr;
  fridge: Spr;
  stool: Spr;
  island: Spr;
  rug: Spr;
  armchair: Spr;
  coffeeTable: Spr;
  floorLamp: Spr;
  boxBig: Spr;
  boxMid: Spr;
  boxSmall: Spr;
  boxOpen: Spr;
  wallArt: Spr;
  shelf: Spr;
  rugBed: Spr;
  poster: Spr;
  palm: Spr;
  whiteboard: Spr;
  doormat: Spr;
  sneakers: Spr;
  backpack: Spr;
}

export async function loadArt(): Promise<Art> {
  const plantSmall = drawSnakePlant();
  return {
    hero: buildHero(),
    plantTree: drawFicus(),
    plantPot: drawBushPlant(),
    plantSmall,
    sofa: drawSofa(),
    tableLamp: drawTableLamp(),
    desk: drawDesk(),
    monitor: drawMonitor(),
    keyboard: drawKeyboard(),
    chair: drawChair(),
    deskLamp: drawDeskLamp(),
    mug: drawMug(),
    books: drawBooks(),
    bed: drawBed(),
    blanketTop: drawBlanketTop(),
    nightstand: drawNightstand(),
    counter: drawCounter(),
    coffee: drawCoffeeMachine(),
    fridge: drawFridge(),
    stool: drawStool(),
    island: drawIsland(),
    rug: drawRug(112, 66),
    armchair: drawArmchair(),
    coffeeTable: drawCoffeeTable(),
    floorLamp: drawFloorLamp(),
    boxBig: drawBox(20, 18, 7, 0),
    boxMid: drawBox(16, 14, 6, 1),
    boxSmall: drawBox(12, 11, 5, 2),
    boxOpen: drawOpenBox(),
    wallArt: drawWallArt(),
    shelf: drawShelf(plantSmall),
    rugBed: drawBedRug(),
    poster: drawPoster(),
    palm: drawPalm(),
    whiteboard: drawWhiteboard(),
    doormat: drawDoormat(),
    sneakers: drawSneakers(),
    backpack: drawBackpack(),
  };
}

// ───────────────────────── Растения, диван, лампа ─────────────────────────

const LEAF = { hi: '#9cc46e', mid: '#6c9c50', lo: '#4d7a3f', dk: '#36593a' };

/** Белый керамический горшок: блик слева, тень справа, земля под ободком. */
function pot(g: G, x: number, y: number, w: number, h: number): void {
  g.r(x, y, w, h, '#f1eee8');
  g.r(x, y, w, 2, '#e4dfd7');
  g.r(x + 1, y, w - 2, 1, '#5b4636');
  g.r(x + 1, y + 2, 1, h - 3, '#ffffff');
  g.r(x + w - 3, y + 2, 2, h - 3, '#d9d3ca');
  g.r(x + w - 1, y + 2, 1, h - 3, '#c4bdb3');
  g.r(x + 1, y + h - 1, w - 2, 1, '#cfc8be');
  // ножка-подставка
  g.r(x + 2, y + h, w - 4, 1, '#b9b1a6');
}

/** Лист-овал: светлый край сверху слева, тень снизу справа. */
function leaf(g: G, cx: number, cy: number, rx: number, ry: number, shade: number): void {
  const tones = [LEAF.dk, LEAF.lo, LEAF.mid, LEAF.hi];
  const base = Math.max(0, Math.min(2, 1 + shade));
  for (let y = -ry; y <= ry; y++) {
    for (let x = -rx; x <= rx; x++) {
      if ((x * x) / (rx * rx + 0.6) + (y * y) / (ry * ry + 0.6) > 1) continue;
      const lit = -x / (rx + 0.5) - y / (ry + 0.5);
      const t = lit > 0.75 ? base + 1 : lit < -0.6 ? base - 1 : base;
      g.p(cx + x, cy + y, tones[Math.max(0, Math.min(3, t))]!);
    }
  }
  // прожилка
  if (rx >= 2) g.p(cx, cy, tones[Math.max(0, base - 1)]!);
}

/** Фикус в белом горшке: пышная крона из крупных листьев. 18×31. */
function drawFicus(): Spr {
  return outlined(18, 31, (g) => {
    g.r(8, 13, 2, 10, '#6e5440');
    g.r(8, 13, 1, 10, '#88694f');
    const leaves: [number, number, number, number, number][] = [
      // дальние (темнее)
      [5, 5, 2, 2, -1], [12, 4, 2, 2, -1], [9, 2, 2, 2, -1], [3, 10, 2, 2, -1], [14, 10, 2, 2, -1], [8, 8, 2, 2, -1],
      // средние
      [6, 3, 2, 2, 0], [11, 7, 3, 2, 0], [4, 7, 2, 2, 0], [13, 13, 2, 2, 0], [3, 14, 2, 2, 0], [9, 11, 2, 2, 0],
      // ближние (светлее)
      [8, 5, 2, 2, 1], [6, 10, 3, 2, 1], [12, 10, 2, 2, 1], [7, 15, 2, 2, 1], [11, 15, 2, 1, 0],
    ];
    for (const [x, y, rx, ry, s] of leaves) leaf(g, x, y, rx, ry, s);
    pot(g, 3, 21, 12, 9);
  });
}

/** Невысокий пышный куст в горшке. 14×23. */
function drawBushPlant(): Spr {
  return outlined(14, 23, (g) => {
    const leaves: [number, number, number, number, number][] = [
      [4, 4, 2, 2, -1], [9, 3, 2, 2, -1], [6, 2, 2, 1, -1], [2, 8, 2, 2, -1], [11, 8, 2, 2, -1],
      [5, 6, 2, 2, 0], [9, 7, 2, 2, 0], [3, 11, 2, 1, 0], [10, 11, 2, 1, 0],
      [7, 5, 2, 2, 1], [6, 10, 2, 2, 1], [9, 11, 1, 1, 1],
    ];
    for (const [x, y, rx, ry, s] of leaves) leaf(g, x, y, rx, ry, s);
    pot(g, 1, 13, 12, 9);
  });
}

/** Сансевиерия на полку: узкие прямые листья с жёлтой каймой. 12×14. */
function drawSnakePlant(): Spr {
  return outlined(12, 14, (g) => {
    const blades: [number, number, number][] = [
      [3, 3, 0], [5, 0, 1], [7, 1, 0], [9, 4, 1], [4, 5, 1], [8, 3, 0],
    ];
    for (const [x, top, s] of blades) {
      for (let y = top; y < 9; y++) {
        g.p(x, y, s ? LEAF.mid : LEAF.lo);
        g.p(x + 1, y, s ? LEAF.lo : LEAF.dk);
      }
      g.p(x, top, '#c9c46a');
    }
    pot(g, 2, 8, 8, 5);
  });
}

/** Пальма (ховея): веер длинных изогнутых листьев. 23×31. */
function drawPalm(): Spr {
  return outlined(23, 31, (g) => {
    g.r(10, 14, 2, 8, '#7a5c42');
    g.r(10, 14, 1, 8, '#94735a');
    // лист: стебель-дуга и пёрышки по обе стороны
    const frond = (ang: number, len: number, shade: number) => {
      const tones = [LEAF.dk, LEAF.lo, LEAF.mid, LEAF.hi];
      for (let i = 2; i <= len; i++) {
        const t = i / len;
        const a = ang + t * t * 0.9 * Math.sign(Math.cos(ang) || 1);
        const x = Math.round(11 + Math.cos(a) * i);
        const y = Math.round(16 - Math.sin(a) * i + t * t * 4);
        const tone = tones[Math.max(0, Math.min(3, 1 + shade + (t < 0.5 ? 1 : 0)))]!;
        g.p(x, y, tone);
        if (i > 3 && i < len) {
          g.p(x, y + 1, tones[Math.max(0, 1 + shade - 1)]!);
          if (i % 2 === 0) g.p(x + (Math.cos(a) > 0 ? -1 : 1), y - 1, tone);
        }
      }
    };
    const fronds: [number, number, number][] = [
      [2.9, 10, -1], [0.25, 10, -1], [1.9, 11, -1], [1.25, 11, -1],
      [2.55, 11, 0], [0.6, 11, 0], [1.6, 13, 0],
      [2.2, 10, 1], [0.95, 10, 1],
    ];
    for (const [a, l, s] of fronds) frond(a, l, s);
    pot(g, 5, 21, 13, 9);
  });
}

/** Диван лицом к нам: мягкая спинка, две подушки сиденья, широкие подлокотники. 48×27. */
function drawSofa(): Spr {
  const F = { hi: '#b4bac6', mid: '#9aa1b0', lo: '#838a9a', dk: '#6c7283' };
  return outlined(48, 27, (g) => {
    // ножки
    for (const x of [4, 42]) g.r(x, 24, 2, 3, '#5a4434');
    // спинка
    g.r(3, 0, 42, 13, F.lo);
    g.r(4, 1, 19, 11, F.mid);
    g.r(25, 1, 19, 11, F.mid);
    g.r(4, 1, 19, 1, F.hi);
    g.r(25, 1, 19, 1, F.hi);
    g.r(23, 1, 2, 11, F.dk);
    g.r(4, 11, 40, 2, F.lo);
    // подлокотники
    for (const x of [0, 40]) {
      g.r(x, 5, 8, 19, F.lo);
      g.r(x + 1, 5, 6, 3, F.hi);
      g.r(x + 1, 8, 6, 1, F.mid);
      g.r(x + 1, 9, 6, 14, F.mid);
      g.r(x + (x ? 6 : 1), 9, 1, 14, x ? F.lo : F.hi);
    }
    // подушки сиденья
    for (const x of [8, 24]) {
      g.r(x, 13, 16, 9, F.mid);
      g.r(x, 13, 16, 2, F.hi);
      g.r(x, 20, 16, 2, F.lo);
    }
    g.r(23, 13, 1, 9, F.dk);
    g.r(24, 13, 1, 9, F.lo);
    // перед
    g.r(1, 22, 46, 2, F.dk);
    // декоративная подушка
    g.r(9, 6, 8, 7, C.terra);
    g.r(9, 6, 8, 1, C.terraHi);
    g.r(16, 7, 1, 6, C.terraDk);
    g.r(9, 12, 8, 1, C.terraDk);
  });
}

/** Настольная лампа: керамическая ножка, льняной абажур. 12×18. */
function drawTableLamp(): Spr {
  return outlined(12, 18, (g) => {
    g.grid(
      0,
      0,
      [
        '...ssssss...',
        '..llllllss..',
        '..lllllllss.',
        '.llllllllls.',
        '.lllllllllss',
        'llllllllllss',
        'ddddddddddds',
        '.....mm.....',
        '....cccc....',
        '...cCcccc...',
        '..cCccccck..',
        '..cCccccck..',
        '..cCccccck..',
        '...cccccc...',
        '....kkkk....',
      ],
      { l: '#f6eedc', s: '#e3d4b6', d: '#d2c09d', m: '#8d8170', c: '#c9876a', C: '#dfa486', k: '#a8664d' },
    );
  });
}

// ───────────────────────── Мебель, нарисованная вручную ─────────────────────────

/** Рабочий стол: столешница из ореха, тонкие чёрные ножки. 52×24. */
function drawDesk(): Spr {
  return make(52, 25, (g) => {
    // ножки
    for (const x of [2, 47]) {
      g.r(x, 12, 3, 12, C.out);
      g.r(x + 1, 12, 1, 11, C.blk2);
    }
    g.r(3, 23, 46, 1, 'rgba(0,0,0,0)');
    // столешница
    g.box(0, 0, 52, 13, C.wood);
    g.r(1, 1, 50, 1, C.woodHi);
    for (const [x, y, w] of [
      [5, 4, 14],
      [24, 6, 19],
      [9, 9, 10],
      [36, 3, 9],
      [30, 10, 13],
    ] as const)
      g.r(x, y, w, 1, C.grain);
    // торец
    g.box(0, 11, 52, 4, C.woodDk);
    g.r(1, 11, 50, 1, C.woodLo);
  });
}

/** Моноблок «Pulse»: белый корпус, экран рисуется отдельно (он живой), на подбородке — кольцо-логотип. 24×22. */
export const MONITOR_SCREEN = { x: 2, y: 2, w: 20, h: 11 };
function drawMonitor(): Spr {
  return make(24, 22, (g) => {
    // ножка и подставка
    g.r(10, 16, 4, 3, C.out);
    g.r(11, 16, 2, 3, C.metal2);
    g.box(6, 18, 12, 4, C.metal);
    g.r(7, 19, 10, 1, '#dfe2e7');
    // корпус
    g.box(0, 0, 24, 17, '#eef0f3');
    g.r(1, 1, 22, 1, '#ffffff');
    g.r(MONITOR_SCREEN.x, MONITOR_SCREEN.y, MONITOR_SCREEN.w, MONITOR_SCREEN.h, '#1b2130');
    // подбородок и кольцо Pulse
    g.r(1, 13, 22, 3, '#e2e5ea');
    g.p(12, 13, '#8c93a3');
    g.p(11, 14, '#8c93a3');
    g.p(13, 14, '#8c93a3');
    g.p(12, 15, '#8c93a3');
  });
}

function drawKeyboard(): Spr {
  return make(16, 4, (g) => {
    g.box(0, 0, 16, 4, '#e9ebef');
    for (let x = 2; x < 14; x += 2) g.p(x, 1, '#c3c7d0');
    for (let x = 3; x < 13; x += 2) g.p(x, 2, '#c3c7d0');
  });
}

/** Офисное кресло со спины (сидящий за столом смотрит вверх). 16×20. */
function drawChair(): Spr {
  return make(16, 20, (g) => {
    // крестовина и колёсики
    g.r(2, 16, 12, 2, C.out);
    g.r(3, 16, 10, 1, C.blk2);
    g.r(7, 13, 2, 4, C.out);
    for (const [x, y] of [
      [1, 18],
      [13, 18],
      [5, 19],
      [10, 19],
    ] as const)
      g.r(x, y, 2, 1, C.out);
    // сиденье чуть шире спинки
    g.box(1, 9, 14, 5, C.blk2, '#24232d');
    // спинка
    g.box(2, 0, 12, 12, C.blk, '#24232d');
    g.r(3, 1, 10, 1, C.blkHi);
    g.r(3, 2, 1, 8, '#45445a');
    g.r(5, 4, 6, 1, '#34333f');
    g.r(5, 7, 6, 1, '#34333f');
  });
}

function drawDeskLamp(): Spr {
  return make(10, 16, (g) => {
    g.grid(
      0,
      0,
      [
        '...oooo...',
        '..okkkko..',
        '.okkkkkko.',
        '..owwwo...',
        '...o......',
        '....o.....',
        '....o.....',
        '.....o....',
        '.....o....',
        '.....o....',
        '....o.....',
        '....o.....',
        '...o......',
        '..okkko...',
        '.okhhhko..',
        '..ooooo...',
      ],
      { o: C.out, k: C.blk, h: C.blkHi, w: '#fff1cf' },
    );
  });
}

function drawMug(): Spr {
  return make(5, 5, (g) => {
    g.grid(0, 0, ['ooo..', 'wwwo.', 'wwwoo', 'sss..', '.....'], { o: C.out, w: '#f4f1ec', s: '#cfc8be' });
    g.grid(0, 0, ['.....', 'o...o', 'o....', 'o..o.', '.oo..'], { o: C.out });
    g.p(1, 1, '#6b4a33');
    g.p(2, 1, '#6b4a33');
  });
}

function drawBooks(): Spr {
  return make(12, 8, (g) => {
    g.box(0, 5, 12, 3, '#3f5f8a');
    g.r(1, 5, 9, 1, '#f1ece2');
    g.box(1, 3, 10, 3, '#cf8a4a');
    g.r(2, 3, 7, 1, '#f1ece2');
    g.box(0, 0, 11, 4, '#55786a');
    g.r(1, 1, 9, 1, '#6e9584');
  });
}

/** Двуспальная кровать с изголовьем из ореха, овсяным одеялом и терракотовым пледом. 42×58. */
function drawBed(): Spr {
  return make(42, 58, (g) => {
    // рама и ножки
    g.box(0, 6, 42, 50, C.woodLo);
    g.r(2, 54, 2, 4, C.out);
    g.r(38, 54, 2, 4, C.out);
    // изголовье
    g.box(0, 0, 42, 12, C.wood);
    g.r(1, 1, 40, 1, C.woodHi);
    g.r(3, 4, 36, 1, C.grain);
    g.r(3, 8, 36, 1, C.grain);
    // простыня
    g.r(2, 11, 38, 40, '#f3efe8');
    g.r(2, 11, 38, 1, '#d9d2c7');
    // подушки
    for (const x of [4, 22]) {
      g.box(x, 12, 16, 9, '#fbfaf7', '#a39b91');
      g.r(x + 1, 19, 14, 1, '#e4ded5');
      g.r(x + 2, 13, 12, 1, '#ffffff');
    }
    // одеяло
    g.box(1, 22, 40, 31, C.oat, C.out);
    g.r(2, 22, 38, 4, '#f1ece4');
    g.r(2, 26, 38, 1, C.oat2);
    for (const [x, y, w] of [
      [6, 31, 10],
      [24, 33, 12],
      [9, 38, 18],
    ] as const)
      g.r(x, y, w, 1, C.oat2);
    g.r(2, 27, 38, 1, C.oatHi);
    // плед в ногах
    g.r(1, 42, 40, 9, C.terra);
    g.r(1, 42, 40, 1, C.terraHi);
    g.r(1, 45, 40, 1, C.terraDk);
    g.r(1, 48, 40, 1, C.terraDk);
    g.r(0, 42, 1, 9, C.out);
    g.r(41, 42, 1, 9, C.out);
    // торец кровати
    g.box(0, 51, 42, 5, C.woodDk);
    g.r(1, 51, 40, 1, C.woodLo);
  });
}

/** Одеяло поверх спящего героя (рисуется над ним). */
function drawBlanketTop(): Spr {
  return make(42, 32, (g) => {
    g.box(1, 0, 40, 31, C.oat, C.out);
    g.r(2, 0, 38, 4, '#f1ece4');
    g.r(2, 4, 38, 1, C.oat2);
    g.r(2, 5, 38, 1, C.oatHi);
    // бугорок — под одеялом кто-то есть
    g.r(13, 7, 16, 1, C.oatHi);
    g.r(13, 18, 16, 1, C.oat2);
    g.r(1, 20, 40, 9, C.terra);
    g.r(1, 20, 40, 1, C.terraHi);
    g.r(1, 23, 40, 1, C.terraDk);
    g.r(1, 26, 40, 1, C.terraDk);
    g.r(0, 20, 1, 9, C.out);
    g.r(41, 20, 1, 9, C.out);
  });
}

function drawNightstand(): Spr {
  return make(15, 14, (g) => {
    g.box(0, 4, 15, 10, C.woodLo);
    g.r(2, 8, 11, 1, C.woodDk);
    g.p(7, 10, '#e2c08f');
    g.box(0, 0, 15, 6, C.wood);
    g.r(1, 1, 13, 1, C.woodHi);
    g.r(1, 13, 1, 1, C.out);
  });
}

/** Кухня: белая столешница, фасады из ореха, мойка и варочная панель. 62×26. */
function drawCounter(): Spr {
  return make(62, 26, (g) => {
    // фасады
    g.box(0, 8, 62, 16, C.wood);
    for (let x = 1; x < 61; x += 15) {
      g.r(x, 10, 1, 13, C.woodDk);
      g.r(x + 1, 10, 1, 13, C.woodHi);
    }
    for (let x = 5; x < 61; x += 15) g.r(x, 11, 6, 1, C.metal);
    g.r(1, 22, 60, 1, C.woodDk);
    // цоколь
    g.r(1, 23, 60, 3, C.blk);
    g.r(0, 23, 1, 3, C.out);
    g.r(61, 23, 1, 3, C.out);
    // столешница
    g.box(0, 0, 62, 10, C.white);
    g.r(1, 1, 60, 1, '#ffffff');
    g.r(1, 8, 60, 1, C.white3);
    // мойка
    g.box(26, 1, 14, 7, C.metal2, C.out2);
    g.r(27, 3, 12, 4, '#b7bcc6');
    g.r(27, 6, 12, 1, C.metal);
    g.r(32, 0, 2, 3, C.out2);
    g.p(32, 0, C.metal);
    // варочная панель
    g.box(44, 1, 15, 7, '#25242e', C.out);
    for (const [x, y] of [
      [46, 2],
      [53, 2],
      [46, 5],
      [53, 5],
    ] as const) {
      g.r(x, y, 3, 1, '#4a4958');
      g.r(x, y + 1, 3, 1, '#3a3946');
    }
    // разделочная доска
    g.box(12, 2, 10, 5, '#d9b07a', '#9a7448');
  });
}

/** Кофемашина: чёрный корпус, хромированный поддон, белая чашка. 11×15. */
export const COFFEE_LED = { x: 8, y: 3 };
function drawCoffeeMachine(): Spr {
  return make(11, 15, (g) => {
    g.box(0, 0, 11, 15, C.blk);
    g.r(1, 1, 9, 1, C.blkHi);
    g.r(1, 2, 9, 2, '#34333f');
    g.r(2, 6, 7, 6, '#1a1920');
    g.r(4, 6, 3, 1, C.metal2);
    // чашка
    g.r(4, 9, 3, 3, '#f4f1ec');
    g.p(7, 10, '#f4f1ec');
    g.r(1, 12, 9, 2, C.metal2);
    g.r(1, 12, 9, 1, C.metal);
  });
}

function drawFridge(): Spr {
  return make(18, 42, (g) => {
    g.box(0, 0, 18, 42, '#e9ebee');
    g.r(1, 1, 16, 2, '#fbfbfc');
    g.r(16, 3, 1, 37, '#d3d6dc');
    g.r(1, 14, 16, 1, '#b9bdc6');
    g.r(13, 5, 1, 7, C.metal2);
    g.r(13, 17, 1, 12, C.metal2);
    g.r(1, 39, 16, 2, '#c7cad2');
  });
}

function drawStool(): Spr {
  return make(9, 14, (g) => {
    g.r(2, 4, 1, 9, C.out);
    g.r(6, 4, 1, 9, C.out);
    g.r(2, 9, 5, 1, C.out);
    g.r(1, 13, 2, 1, C.out);
    g.r(6, 13, 2, 1, C.out);
    g.box(0, 0, 9, 5, C.wood);
    g.r(1, 1, 7, 1, C.woodHi);
    g.r(1, 3, 7, 1, C.woodDk);
  });
}

/** Барная стойка-остров. 40×18. */
function drawIsland(): Spr {
  return make(40, 18, (g) => {
    g.box(0, 6, 40, 12, C.white2);
    g.r(1, 7, 38, 1, C.white3);
    for (let x = 9; x < 40; x += 10) g.r(x, 8, 1, 9, C.white3);
    g.r(1, 16, 38, 1, C.white4);
    g.box(0, 0, 40, 8, C.wood);
    g.r(1, 1, 38, 1, C.woodHi);
    g.r(5, 3, 12, 1, C.grain);
    g.r(22, 5, 14, 1, C.grain);
    // фруктовая тарелка
    g.box(26, 1, 9, 4, '#f4f1ec', C.out2);
    g.p(28, 2, '#e0763c');
    g.p(30, 2, '#9cc25a');
    g.p(31, 3, '#e0763c');
    g.p(29, 3, '#f0c94c');
  });
}

/** Ковёр: овсяное поле, терракотовая кайма, мелкий узор точками. */
function drawRug(w: number, h: number): Spr {
  return make(w, h, (g) => {
    g.box(0, 0, w, h, C.terra, C.terraDk);
    g.r(1, 1, w - 2, 1, C.terraHi);
    g.r(4, 4, w - 8, h - 8, '#efe4d0');
    g.r(5, 5, w - 10, h - 10, C.terraHi);
    g.r(6, 6, w - 12, h - 12, '#efe4d0');
    for (let y = 10; y < h - 9; y += 5) {
      for (let x = 10 + ((y / 5) % 2) * 3; x < w - 9; x += 6) g.p(x, y, '#d8c4a3');
    }
  });
}

function drawBedRug(): Spr {
  return make(30, 16, (g) => {
    g.box(0, 0, 30, 16, '#e7ddcc', '#b9aa94');
    for (let x = 1; x < 29; x += 2) {
      g.p(x, 0, '#e7ddcc');
      g.p(x, 15, '#e7ddcc');
    }
    g.r(3, 3, 24, 1, '#d8cbb5');
    g.r(3, 12, 24, 1, '#d8cbb5');
  });
}

/** Кожаное кресло со спины (смотрит на диван). 18×17. */
function drawArmchair(): Spr {
  return make(18, 17, (g) => {
    g.r(2, 15, 2, 2, C.out);
    g.r(14, 15, 2, 2, C.out);
    g.box(0, 3, 6, 12, C.leatherDk);
    g.box(12, 3, 6, 12, C.leatherDk);
    g.r(1, 4, 4, 1, C.leather);
    g.r(13, 4, 4, 1, C.leather);
    g.box(3, 0, 12, 15, C.leather);
    g.r(4, 1, 10, 2, C.leatherHi);
    g.r(4, 3, 1, 10, '#b06b44');
    g.p(7, 7, C.leatherDk);
    g.p(10, 7, C.leatherDk);
    g.p(7, 10, C.leatherDk);
    g.p(10, 10, C.leatherDk);
  });
}

function drawCoffeeTable(): Spr {
  return make(28, 14, (g) => {
    g.r(3, 9, 2, 5, C.out);
    g.r(23, 9, 2, 5, C.out);
    g.box(0, 0, 28, 9, C.wood);
    g.r(1, 1, 26, 1, C.woodHi);
    g.box(0, 7, 28, 3, C.woodDk);
    // книга и чашка
    g.box(4, 2, 9, 5, '#3f5f8a');
    g.r(5, 3, 7, 1, '#5a7aa6');
    g.r(5, 5, 7, 1, '#f1ece2');
    g.r(18, 2, 4, 3, C.out);
    g.r(19, 2, 2, 2, '#f4f1ec');
  });
}

/** Торшер: чёрная стойка, кремовый абажур. 11×36. */
export const FLOOR_LAMP_SHADE = { x: 5, y: 5 };
function drawFloorLamp(): Spr {
  return make(11, 36, (g) => {
    g.r(5, 10, 1, 23, C.blk);
    g.r(5, 10, 1, 23, C.blk);
    g.r(2, 33, 7, 2, C.out);
    g.r(3, 33, 5, 1, C.blk2);
    g.grid(
      0,
      0,
      [
        '...ooooo...',
        '..olllllo..',
        '..ollllso..',
        '.ollllllso.',
        '.ollllllso.',
        '.olllllllso',
        'olllllllsso',
        'olllllllsso',
        'oddddddddd.',
        '.ooooooooo.',
      ],
      { o: C.out, l: '#f6eedc', s: '#e2d4b8', d: '#d8c8a8' },
    );
  });
}

/** Картонная коробка с переезда: верх, лицевая сторона, скотч и наклейка. */
function drawBox(w: number, h: number, top: number, variant: number): Spr {
  return make(w, h, (g) => {
    g.box(0, 0, w, h, C.card);
    g.r(1, 1, w - 2, top - 1, C.cardTop);
    g.r(1, top, w - 2, 1, C.cardDk);
    g.r(w - 3, top + 1, 2, h - top - 2, C.cardDk);
    // скотч
    const tx = Math.floor(w / 2) - 1;
    g.r(tx, 1, 2, top - 1, C.tape);
    g.r(tx, top + 1, 2, 3, C.tape);
    // наклейка
    if (variant !== 2) {
      g.r(3, top + 4, 6, 4, '#f4efe6');
      g.r(4, top + 5, 4, 1, '#9a9184');
      g.r(4, top + 7, 3, 1, '#9a9184');
    } else {
      g.r(3, top + 3, 1, 2, '#c1563b');
      g.r(4, top + 3, 1, 1, '#c1563b');
    }
  });
}

function drawOpenBox(): Spr {
  return make(22, 17, (g) => {
    g.box(2, 3, 18, 14, C.card);
    g.r(3, 4, 16, 5, '#6e4c2d');
    g.r(3, 4, 16, 1, '#5a3d24');
    // вещи внутри
    g.r(5, 5, 5, 3, '#55786a');
    g.r(11, 6, 6, 2, '#f1ece2');
    g.r(3, 9, 16, 1, C.cardDk);
    g.r(17, 10, 2, 6, C.cardDk);
    // клапаны
    g.grid(0, 0, ['..oooo........oooo....', '.occco.......occco....', 'occo..........ocoo....', 'oo.............oo.....'], {
      o: C.out,
      c: C.cardTop,
    });
    g.r(4, 12, 6, 3, '#f4efe6');
    g.r(5, 13, 4, 1, '#9a9184');
  });
}

/** Картина над кроватью: тёплая абстракция в тонкой чёрной раме. */
function drawWallArt(): Spr {
  return make(26, 18, (g) => {
    g.box(0, 0, 26, 18, '#f3efe7', '#24232d', false);
    g.r(3, 3, 20, 12, '#ece4d6');
    // солнце, холмы
    g.r(13, 5, 5, 5, C.terraHi);
    g.r(14, 4, 3, 1, C.terraHi);
    g.r(14, 10, 3, 1, C.terraHi);
    g.r(3, 11, 20, 4, '#8aa496');
    g.r(3, 10, 9, 1, '#8aa496');
    g.r(6, 9, 4, 1, '#8aa496');
    g.r(15, 12, 8, 3, C.terra);
    g.r(18, 11, 5, 1, C.terra);
  });
}

/** Открытая полка над кухней: банки, чашки, растение. */
function drawShelf(plant: Spr): Spr {
  return make(40, 18, (g) => {
    g.c.drawImage(plant, 28, 1);
    // банки
    for (const [x, h, lid] of [
      [3, 7, '#9a7448'],
      [8, 9, '#9a7448'],
      [13, 6, C.blk2],
    ] as const) {
      g.box(x, 15 - h, 5, h, '#f4f1ec', C.out);
      g.r(x, 15 - h, 5, 2, lid);
      g.r(x + 1, 17 - h, 3, 1, '#e6e1d9');
    }
    // чашки
    g.r(19, 12, 4, 3, '#f4f1ec');
    g.r(19, 11, 4, 1, C.out);
    g.r(23, 12, 4, 3, C.terra);
    g.r(23, 11, 4, 1, C.out);
    // доска полки
    g.box(0, 15, 40, 3, C.wood);
    g.r(1, 15, 38, 1, C.woodHi);
  });
}

/** Постер с кольцом Pulse — продукт, который герой собирается сделать. */
function drawPoster(): Spr {
  return make(18, 24, (g) => {
    g.box(0, 0, 18, 24, '#1f2a3d', '#17161d', false);
    g.r(1, 1, 16, 22, '#22304a');
    g.r(1, 15, 16, 8, '#1b263a');
    // кольцо
    g.grid(4, 3, ['..oooo..', '.o....o.', 'o......o', 'o......o', 'o......o', 'o......o', '.o....o.', '..oooo..'], { o: '#f2c46d' });
    g.p(8, 6, '#f2c46d');
    g.p(9, 7, '#f2c46d');
    // подпись
    g.r(4, 14, 10, 1, '#e9e4dc');
    g.r(5, 17, 8, 1, '#7f8fb0');
    g.r(6, 19, 6, 1, '#7f8fb0');
  });
}

/** Доска на колёсиках: план стартапа — стикеры, стрелки и растущий график. 38×34. */
function drawWhiteboard(): Spr {
  return make(38, 34, (g) => {
    // стойки и колёса
    g.r(3, 22, 2, 10, C.out);
    g.r(33, 22, 2, 10, C.out);
    g.r(4, 22, 1, 9, C.metal2);
    g.r(34, 22, 1, 9, C.metal2);
    g.r(1, 31, 6, 2, C.out);
    g.r(31, 31, 6, 2, C.out);
    g.r(1, 33, 2, 1, C.out);
    g.r(5, 33, 2, 1, C.out);
    g.r(31, 33, 2, 1, C.out);
    g.r(35, 33, 2, 1, C.out);
    // доска
    g.box(0, 0, 38, 25, '#fbfaf7');
    g.r(1, 1, 36, 1, '#ffffff');
    g.r(1, 22, 36, 2, C.metal);
    g.r(1, 22, 36, 1, '#e3e6eb');
    // маркеры на полочке
    g.r(6, 22, 3, 1, '#d5533f');
    g.r(11, 22, 3, 1, '#3f6fb0');
    // стикеры
    for (const [x, y, c] of [
      [3, 3, '#f6d66b'],
      [9, 3, '#f6d66b'],
      [3, 9, '#9fd3b5'],
      [9, 9, '#f2a7a0'],
    ] as const) {
      g.r(x, y, 5, 5, c);
      g.r(x + 1, y + 1, 3, 1, 'rgba(0,0,0,0.18)');
      g.r(x + 1, y + 3, 2, 1, 'rgba(0,0,0,0.18)');
    }
    // график, который растёт
    g.r(18, 4, 1, 15, '#4a4a5c');
    g.r(18, 18, 16, 1, '#4a4a5c');
    for (const [x, y] of [
      [19, 16],
      [20, 16],
      [21, 15],
      [22, 15],
      [23, 14],
      [24, 15],
      [25, 13],
      [26, 12],
      [27, 11],
      [28, 11],
      [29, 9],
      [30, 8],
      [31, 6],
      [32, 5],
    ] as const)
      g.p(x, y, '#3f6fb0');
    g.p(31, 5, '#3f6fb0');
    g.p(33, 5, '#3f6fb0');
    g.p(32, 4, '#3f6fb0');
    // подпись и кружок вокруг цели
    g.r(3, 16, 11, 1, '#5b5b6e');
    g.r(3, 18, 8, 1, '#5b5b6e');
    g.p(31, 3, '#d5533f');
    g.p(34, 4, '#d5533f');
  });
}

function drawDoormat(): Spr {
  return make(26, 11, (g) => {
    g.box(0, 0, 26, 11, '#5a4a3d', '#3f342b');
    g.r(2, 2, 22, 7, '#6b5848');
    for (let x = 3; x < 23; x += 2) g.r(x, 3, 1, 5, '#5e4d3f');
  });
}

function drawSneakers(): Spr {
  return make(12, 6, (g) => {
    const shoe = ['.ooo.', 'owwwo', 'owwro', 'owwwo', '.sss.'];
    g.grid(0, 0, shoe, { o: C.out, w: '#f1eee8', r: '#d5533f', s: '#bfb8ad' });
    g.grid(6, 1, shoe, { o: C.out, w: '#f1eee8', r: '#d5533f', s: '#bfb8ad' });
  });
}

function drawBackpack(): Spr {
  return make(12, 13, (g) => {
    g.box(1, 1, 10, 12, '#3f5560');
    g.r(2, 2, 8, 1, '#56717d');
    g.box(3, 6, 6, 5, '#354953');
    g.r(4, 7, 4, 1, '#56717d');
    g.r(4, 0, 4, 2, C.out);
    g.p(5, 1, '#3f5560');
    g.p(6, 1, '#3f5560');
    g.p(9, 8, '#e0b870');
  });
}
