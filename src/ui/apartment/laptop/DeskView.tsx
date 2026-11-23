// Вид из-за стола, когда герой сидит за компьютером. Это то же место, что видно издалека в квартире:
// тёмная стена, окно с тем же городом прямо за столом, ореховый стол, книги слева, чёрная лампа справа.
// Рисуется пикселями в низком разрешении и растягивается — как сама квартира. Время суток — по часам квартиры
// (а они — по настоящему времени игрока): днём из окна светло, вечером горят лампа и экран.
import { useEffect, useRef, type RefObject } from 'react';
import { C, G, hash, make, type Spr } from '../engine/art';
import { City, CITY_H } from '../engine/city';
import { css, daylightAt, type Daylight, type RGB } from '../engine/daylight';
import { KEYBOARD_H, keyAt, keyboardKeys, type KeyRect } from './keyboardLayout';

/** Высота сцены в пикселях-«клетках»; ширина подбирается под экран. */
const H = 144;
/** Вблизи город крупнее: каждая его клетка — 2×2 клетки сцены. */
const CITY_ZOOM = 2;
/** Передний край стола; ниже — его торец. */
const FRONT = H - 3;
/** Сколько длится нажатие клавиши на рисунке, мс. */
const PRESS_MS = 160;

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Layout {
  W: number;
  /** Где стоит монитор (в клетках сцены) — вещи на столе расставляются вокруг него. y1 — низ подставки. */
  mon: { x0: number; x1: number; y0: number; y1: number };
  deskTop: number;
  /** Стекло окна: здесь видно небо и город. */
  glass: Rect;
  keyboard: Rect;
  /** Клавиши нарисованной клавиатуры — чтобы показать нажатую. */
  keys: KeyRect[];
  pad: Rect;
  mug: { x: number; y: number };
  lamp: { baseX: number; baseY: number; elbowX: number; elbowY: number; headX: number; headY: number };
  books: { x: number; y: number };
}

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

/**
 * Пропорции как у настоящего стола: монитор 27″ ≈ 60 см, значит клетка ≈ 4 мм.
 * Клавиатура ≈ 2/3 монитора и стоит перед ним, мышь ≈ 6 см, лампа — до середины монитора.
 */
function layoutFor(W: number, mon: Layout['mon']): Layout {
  const front = FRONT;
  // Нога монитора стоит у дальнего края стола.
  const deskTop = clamp(Math.round(mon.y1 - 6), 80, H - 30);
  const monW = mon.x1 - mon.x0;
  const cx = Math.round((mon.x0 + mon.x1) / 2);
  const right = Math.round(mon.x1);
  const left = Math.round(mon.x0);
  const margin = Math.round(W * 0.05);
  const glass = { x: margin, y: 8, w: W - margin * 2, h: deskTop - 22 };
  const kw = clamp(Math.round(monW * 0.66), 100, 150);
  const kh = KEYBOARD_H;
  // Клавиатура стоит на столе перед подставкой монитора и не свисает с переднего края.
  const ky = Math.min(Math.ceil(mon.y1) + 1, front - kh - 1);
  const keyboard = { x: cx - Math.round(kw / 2) - 6, y: ky, w: kw, h: kh };
  const pad = { x: keyboard.x + kw + 8, y: ky - 1, w: 34, h: 13 };
  // Кружка — правее коврика с мышью; лампа — ещё правее кружки, а не за ней.
  const mugX = Math.max(right + 6, pad.x + pad.w + 6);
  const baseX = Math.min(W - 16, Math.max(right + 44, mugX + 34));
  const baseY = deskTop + 8;
  return {
    W,
    mon,
    deskTop,
    glass,
    keyboard,
    keys: keyboardKeys(keyboard),
    pad,
    mug: { x: mugX, y: deskTop - 4 },
    lamp: { baseX, baseY, elbowX: baseX + 8, elbowY: deskTop - 48, headX: baseX - 24, headY: deskTop - 54 },
    books: { x: Math.max(4, left - 58), y: deskTop + 10 },
  };
}

// ───────────────────────── Неподвижная часть: стена, окно, стол и вещи ─────────────────────────

/** Стена как в квартире: тёмная, к низу чуть светлее, со швами панелей. */
function wall(g: G, L: Layout): void {
  for (let y = 0; y < L.deskTop; y++) {
    const t = y / L.deskTop;
    g.r(0, y, L.W, 1, css([40 + t * 10, 39 + t * 10, 48 + t * 10]));
  }
  for (let x = 30; x < L.W; x += 92) g.r(x, 2, 2, L.deskTop - 4, 'rgba(0,0,0,0.12)');
}

/** Окно как в квартире: тёмная рама, переплёт посередине, белый подоконник. */
function windowFrame(g: G, L: Layout): void {
  const { x, y, w, h } = L.glass;
  g.r(x - 4, y - 4, w + 8, h + 8, '#17161d');
  g.r(x - 2, y - 2, w + 4, h + 4, '#55546a');
  g.clear(x, y, w, h);
  const mx = x + Math.floor(w / 2) - 2;
  g.r(mx, y, 4, h, '#55546a');
  g.r(mx + 1, y, 2, h, '#6c6b82');
  // подоконник
  g.r(x - 6, y + h + 4, w + 12, 4, C.white2);
  g.r(x - 6, y + h + 4, w + 12, 1, C.white);
  g.r(x - 6, y + h + 8, w + 12, 2, '#9d978f');
}

function desk(g: G, L: Layout): void {
  const top = L.deskTop;
  const front = FRONT;
  g.r(0, top - 1, L.W, 1, C.out);
  g.r(0, top, L.W, front - top, C.woodHi);
  // волокна ореха — длинными полосами вдоль стола
  for (let y = top + 2; y < front; y += 3) {
    for (let x = 0; x < L.W; x++) {
      const wave = Math.sin(x * 0.045 + y * 1.7) + Math.sin(x * 0.013 + y);
      if (wave > 1.35) g.p(x, y, C.grain);
    }
  }
  g.r(0, top, L.W, 1, C.wood);
  g.r(0, front, L.W, 1, C.out);
  g.r(0, front + 1, L.W, 1, C.wood);
  g.r(0, front + 2, L.W, H - front - 2, C.woodDk);
}

/** Клавиатура чуть сверху: светлый алюминиевый корпус, утопленные клавиши с передней гранью, у ближнего края — толщина. */
function keyboard(g: G, k: Rect, keys: KeyRect[]): void {
  // тень на столе и корпус; между клавишами — тёмная подложка, чтобы каждая клавиша читалась отдельно
  g.r(k.x + 2, k.y + k.h, k.w - 2, 2, 'rgba(40,24,16,0.4)');
  g.box(k.x, k.y, k.w, k.h, '#8f887f');
  g.r(k.x + 1, k.y + 1, k.w - 2, 1, C.white2);
  // передний край корпуса — толщина алюминия
  g.r(k.x + 1, k.y + k.h - 2, k.w - 2, 1, C.white3);
  for (const key of keys) {
    // верх клавиши светлый, с бликом по верхнему краю; передняя грань темнее
    g.r(key.x, key.y, key.w, key.h - 1, C.white2);
    g.r(key.x, key.y, key.w, 1, '#fbf9f6');
    g.r(key.x, key.y + key.h - 1, key.w, 1, C.white4);
  }
}

/** Нажатая клавиша: верх уходит вниз и темнеет, передней грани почти не видно. */
function pressedKey(c: CanvasRenderingContext2D, key: KeyRect, strength: number): void {
  c.fillStyle = `rgba(28,24,40,${0.34 * strength})`;
  c.fillRect(key.x, key.y, key.w, key.h);
  c.fillStyle = `rgba(28,24,40,${0.3 * strength})`;
  c.fillRect(key.x, key.y, key.w, 1);
}

/** Мышь на тёмном коврике: овальная, с разрезом между кнопками и тенью снизу. */
function mouse(g: G, p: Rect): void {
  g.r(p.x + 1, p.y + p.h, p.w - 1, 1, 'rgba(40,24,16,0.3)');
  g.box(p.x, p.y, p.w, p.h, '#2f3446');
  g.r(p.x + 1, p.y + 1, p.w - 2, 1, '#454c63');
  const mx = p.x + Math.round(p.w / 2) - 8;
  const my = p.y + 2;
  g.grid(mx, my, ['....oooooooo....', '..oowwwwlwwwwoo.', '.owwwwwwlwwwwwwo', 'owwwwwwwwwwwwwwo', 'owwwwwwwwwwwwwso', 'oswwwwwwwwwwwsso', '.ossssssssssssso', '..oooooooooooo..'], {
    o: C.out,
    w: C.white,
    l: C.white4,
    s: C.white3,
  });
  g.r(mx + 3, my + 8, 11, 1, 'rgba(10,10,20,0.4)');
}

/** Белая кружка кофе: крупная, с ручкой, тенью и тёмным кофе сверху. */
function mug(g: G, m: { x: number; y: number }): void {
  g.r(m.x + 1, m.y + 15, 14, 1, 'rgba(40,24,16,0.35)');
  g.grid(m.x, m.y, [
    '.oooooooooooo....',
    'occcccccccccco...',
    'owwwwwwwwwwwwoo..',
    'owwwwwwwwwwwwooo.',
    'oxwwwwwwwwwwwo.oo',
    'oxwwwwwwwwwwwo..o',
    'oxwwwwwwwwwwwo..o',
    'oxwwwwwwwwwwwo..o',
    'oxwwwwwwwwwwwo.oo',
    'oxwwwwwwwwwwwooo.',
    'oxwwwwwwwwwwwoo..',
    'oxxwwwwwwwwwwo...',
    'oxxwwwwwwwwwxo...',
    'oxxxwwwwwwwxxo...',
    '.oooooooooooo....',
  ], { o: C.out, c: '#4a2c1e', w: C.white, x: C.white3 });
}

/** Стопка книг, как на столе в квартире. */
function books(g: G, b: { x: number; y: number }): void {
  const list: [number, string, string][] = [
    [52, '#3f6f3c', '#4f8a4b'],
    [46, '#4c6a9a', '#5f80b2'],
    [49, C.oat, C.oatHi],
  ];
  list.forEach(([w, col, hi], i) => {
    const by = b.y - (i + 1) * 7;
    const bx = b.x + (i % 2) * 3;
    g.box(bx, by, w, 8, col);
    g.r(bx + 1, by + 1, w - 2, 1, hi);
    // страницы с торца
    g.r(bx + w - 6, by + 2, 4, 4, C.white2);
    g.r(bx + w - 6, by + 3, 4, 1, C.white3);
  });
}

/** Толстая линия (рычаг лампы): тёмная, с бликом сверху. */
function rod(g: G, x0: number, y0: number, x1: number, y1: number): void {
  const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
  for (let i = 0; i <= steps; i++) {
    const x = Math.round(x0 + ((x1 - x0) * i) / steps);
    const y = Math.round(y0 + ((y1 - y0) * i) / steps);
    g.r(x - 1, y - 1, 3, 3, C.out);
  }
  for (let i = 0; i <= steps; i++) {
    const x = Math.round(x0 + ((x1 - x0) * i) / steps);
    const y = Math.round(y0 + ((y1 - y0) * i) / steps);
    g.p(x, y, C.blkHi);
  }
}

/** Шарнирная настольная лампа, как в квартире, но вблизи: тяжёлое основание, два рычага, плафон к столу. */
function lamp(g: G, L: Layout): void {
  const { baseX, baseY, elbowX, elbowY, headX, headY } = L.lamp;
  // основание
  g.r(baseX - 13, baseY + 6, 27, 1, 'rgba(40,24,16,0.35)');
  g.grid(baseX - 13, baseY, [
    '.....oooooooooooooooo.....',
    '...ooBBBBBBBBBBBBBBBBoo...',
    '.ooBBHHHHHHHHHHHHHHHHBBoo.',
    'oBBBBBBBBBBBBBBBBBBBBBBBBo',
    'oDDDDDDDDDDDDDDDDDDDDDDDDo',
    '.oooooooooooooooooooooooo.',
  ], { o: C.out, B: C.blk2, H: C.blkHi, D: C.blk });
  // рычаги и шарниры
  rod(g, baseX, baseY - 1, elbowX, elbowY);
  rod(g, elbowX, elbowY, headX, headY);
  // пружина вдоль нижнего рычага
  for (let i = 4; i < 40; i += 3) {
    const t = i / 46;
    g.p(Math.round(baseX + 3 + (elbowX - baseX) * t), Math.round(baseY - 1 + (elbowY - baseY) * t), C.metal2);
  }
  for (const [x, y] of [
    [baseX, baseY - 2],
    [elbowX, elbowY],
    [headX, headY],
  ] as const)
    g.grid(x - 2, y - 2, ['.oo.', 'oMMo', 'oMmo', '.oo.'], { o: C.out, M: C.metal, m: C.metal2 });
  // плафон смотрит вниз, на стол
  g.grid(headX - 10, headY + 1, [
    '.......oooooo.......',
    '......oBBBBBBo......',
    '.....oBBHHBBBBo.....',
    '....oBBHBBBBBBBo....',
    '...oBBBBBBBBBBBBo...',
    '..oBBBBBBBBBBBBBBo..',
    '.oBBBBBBBBBBBBBBBBo.',
    'oDDDDDDDDDDDDDDDDDDo',
    '.oLLLLLLLLLLLLLLLLo.',
  ], { o: C.out, B: C.blk2, H: C.blkHi, D: C.blk, L: C.white4 });
}

function roomLayer(L: Layout): Spr {
  return make(L.W, H, (g) => {
    wall(g, L);
    windowFrame(g, L);
    desk(g, L);
    books(g, L.books);
    keyboard(g, L.keyboard, L.keys);
    mouse(g, L.pad);
    mug(g, L.mug);
    lamp(g, L);
  });
}

/** Свет комнаты ложится на стену и стол; небо в окне не тускнеет. Кешируется по цвету света. */
function tinted(base: Spr, ambient: RGB, cache: { key: string; img: Spr } | null): { key: string; img: Spr } {
  const key = ambient.map((v) => Math.round(v / 4)).join(',');
  if (cache?.key === key) return cache;
  const img = make(base.width, base.height, (g) => {
    g.c.drawImage(base, 0, 0);
    g.c.globalCompositeOperation = 'multiply';
    g.r(0, 0, base.width, base.height, css(ambient));
    g.c.globalCompositeOperation = 'destination-in';
    g.c.drawImage(base, 0, 0);
  });
  return { key, img };
}

// ───────────────────────── Живое: небо, свет лампы и экрана, пар ─────────────────────────

/** Небо и город за стеклом: город тот же, что в окнах квартиры, только ближе. */
function sky(c: CanvasRenderingContext2D, L: Layout, day: Daylight, city: City, cityCv: HTMLCanvasElement, time: number): void {
  const { x, y, w, h } = L.glass;
  const cityH = Math.min(CITY_H * CITY_ZOOM, h);
  const grad = c.createLinearGradient(0, y, 0, y + h - cityH + 1);
  grad.addColorStop(0, css(day.sky.top.map((v) => v * 0.8) as RGB));
  grad.addColorStop(1, css(day.sky.top));
  c.fillStyle = grad;
  c.fillRect(x, y, w, h - cityH + 1);
  // звёзды ночью
  if (day.sky.stars > 0.05) {
    for (let i = 0; i < Math.round(w / 6); i++) {
      const sx = x + Math.floor(hash(i, 51) * w);
      const sy = y + Math.floor(hash(i, 52) * (h - cityH - 4));
      const tw = 0.6 + 0.4 * Math.sin(time * (1 + hash(i, 53) * 2) + i);
      c.fillStyle = `rgba(220,226,255,${(0.25 + hash(i, 54) * 0.6) * day.sky.stars * tw})`;
      c.fillRect(sx, sy, 1, 1);
    }
  }
  const cw = Math.ceil(w / CITY_ZOOM);
  const cctx = cityCv.getContext('2d');
  if (!cctx) return;
  if (cityCv.width !== cw) cityCv.width = cw;
  cityCv.height = CITY_H;
  city.draw(cctx, day, 0, 0, 0, cw, CITY_H, time);
  c.imageSmoothingEnabled = false;
  c.drawImage(cityCv, 0, 0, cw, CITY_H, x, y + h - cityH, cw * CITY_ZOOM, cityH);
  // блики на стекле, как в квартире; ночью стекло тёмное — бликов почти нет
  const shine = 0.05 * (1 - day.dark * 0.8);
  c.fillStyle = `rgba(255,255,255,${shine})`;
  for (let i = 0; i < h; i++) c.fillRect(x + 10 + i, y + h - 1 - i, 5, 1);
  c.fillStyle = `rgba(255,255,255,${shine * 0.7})`;
  for (let i = 0; i < h; i++) c.fillRect(x + w - 90 + i, y + h - 1 - i, 3, 1);
}

function glow(c: CanvasRenderingContext2D, x: number, y: number, r: number, color: string): void {
  const g = c.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = g;
  c.fillRect(x - r, y - r, r * 2, r * 2);
}

function lights(c: CanvasRenderingContext2D, L: Layout, day: Daylight): void {
  const night = clamp((day.dark - 0.2) / 0.8, 0, 1);
  c.save();
  c.globalCompositeOperation = 'lighter';
  // Днём свет из окна мягко падает на стол.
  if (day.sun.power > 0.05) {
    const s = day.sun.color;
    glow(c, L.W / 2, L.deskTop + 10, L.W * 0.45, `rgba(${s[0]},${s[1]},${s[2]},${0.12 * day.sun.power})`);
  }
  if (night > 0) {
    // настольная лампа: тёплый круг на столе и отсвет на стене
    glow(c, L.lamp.headX - 4, L.deskTop + 6, 64, `rgba(255,186,104,${0.62 * night})`);
    glow(c, L.lamp.headX, L.lamp.headY + 12, 20, `rgba(255,220,160,${0.55 * night})`);
    // экран светит на клавиатуру
    glow(c, (L.mon.x0 + L.mon.x1) / 2, L.deskTop + 4, (L.mon.x1 - L.mon.x0) * 0.55, `rgba(120,150,255,${0.2 * night})`);
  }
  c.restore();
  if (night > 0) {
    c.fillStyle = `rgba(255,236,190,${night})`;
    c.fillRect(L.lamp.headX - 8, L.lamp.headY + 9, 16, 1);
  }
}

function steam(c: CanvasRenderingContext2D, m: { x: number; y: number }, time: number): void {
  for (let i = 0; i < 5; i++) {
    const t = (time * 0.45 + i / 5) % 1;
    const px = Math.round(m.x + 3 + i * 2 + Math.sin(time * 1.8 + i * 1.7) * 2);
    const py = Math.round(m.y - 1 - t * 18);
    c.fillStyle = `rgba(255,255,255,${0.35 * (1 - t)})`;
    c.fillRect(px, py, 1, 3);
  }
}

/** Вид из-за стола. Рисуется под монитором и подстраивается под его место на экране. */
export function DeskView({ minutes, device }: { minutes: number; device: RefObject<HTMLDivElement | null> }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const minutesRef = useRef(minutes);
  minutesRef.current = minutes;

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    let L: Layout | null = null;
    let base: Spr | null = null;
    let city: City | null = null;
    let tint: { key: string; img: Spr } | null = null;
    const cityCv = document.createElement('canvas');
    let raf = 0;
    /** Когда игрок нажал клавишу (код → время, мс): нарисованная клавиша на миг уходит вниз. */
    const pressed = new Map<string, number>();
    const onKey = (e: KeyboardEvent) => pressed.set(e.code, performance.now());
    window.addEventListener('keydown', onKey);

    const measure = () => {
      const box = canvas.parentElement;
      const dev = device.current;
      if (!box || !dev) return;
      const k = H / box.clientHeight;
      const W = Math.max(160, Math.round(box.clientWidth * k));
      // offsetLeft/offsetWidth не зависят от анимации выезда монитора (transform).
      // Низ подставки монитора: она выступает из-под корпуса, клавиатура стоит перед ней.
      const stand = dev.querySelector<HTMLElement>('.lp-stand');
      const bottom = Math.max(dev.offsetTop + dev.offsetHeight, stand ? dev.offsetTop + stand.offsetTop + stand.offsetHeight : 0);
      const mon = { x0: dev.offsetLeft * k, x1: (dev.offsetLeft + dev.offsetWidth) * k, y0: dev.offsetTop * k, y1: bottom * k };
      canvas.width = W;
      canvas.height = H;
      L = layoutFor(W, mon);
      base = roomLayer(L);
      city = new City(Math.ceil(W / CITY_ZOOM));
      tint = null;
    };

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      if (!L || !base || !city) return;
      const time = now / 1000;
      const day = daylightAt(minutesRef.current);
      ctx.clearRect(0, 0, L.W, H);
      sky(ctx, L, day, city, cityCv, time);
      // Вблизи ночью видно чуть больше, чем издалека: стол освещён экраном и лампой.
      const lift = day.dark * 0.32;
      const ambient = day.ambient.map((v, i) => v + ([150, 128, 138][i]! - v) * lift) as RGB;
      tint = tinted(base, ambient, tint);
      ctx.drawImage(tint.img, 0, 0);
      lights(ctx, L, day);
      for (const [code, at] of pressed) {
        const age = now - at;
        const key = keyAt(L.keys, code);
        if (age > PRESS_MS || !key) {
          pressed.delete(code);
          continue;
        }
        pressedKey(ctx, key, 1 - age / PRESS_MS);
      }
      steam(ctx, L.mug, time);
    };

    measure();
    const ro = new ResizeObserver(measure);
    if (canvas.parentElement) ro.observe(canvas.parentElement);
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener('keydown', onKey);
    };
  }, [device]);

  return <canvas ref={ref} className="lp-deskview" aria-hidden="true" />;
}
