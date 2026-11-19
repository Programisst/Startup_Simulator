// Мир квартиры: герой, предметы, свет, камера. Рисуем сцену в маленьком холсте 384×240,
// затем увеличиваем в целое число раз (пиксели чёткие), а свет кладём поверх плавными пятнами.
import { advanceClock } from '../link';
import { explorerRows, MonitorTyping, textAmount } from './monitor';
import { findPath } from './nav';
import { COFFEE_LED, FLOOR_LAMP_SHADE, MONITOR_SCREEN, hash, make, type Art, type Spr } from './art';
import { City } from './city';
import { zoomLimits, zoomStep } from './zoom';
import { css, daylightAt, type Daylight, type RGB } from './daylight';
import {
  CLOCK,
  COFFEE_CUP,
  DOOR,
  DESK_MUG,
  HERO_START,
  KITCHEN_LIGHT,
  LAMPS,
  MAP_H,
  MAP_W,
  MONITOR_LIGHT,
  PILLOW,
  PROPS,
  ROOM,
  SEAT,
  SPOTS,
  WALK,
  WALL_ITEMS,
  WINDOWS,
  type Dir,
  type LampId,
  type Prop,
  type Rect,
  type Spot,
} from './scene';

type Mode = 'free' | 'sit' | 'sleep' | 'still';

interface Particle {
  x: number;
  y: number;
  age: number;
  life: number;
  seed: number;
}

/** Один пиксель света = LIGHT_STEP пикселей экрана: свет мягкий, считать его дёшево. */
const LIGHT_STEP = 4;
/** Шаг сетки поиска пути: 1 единица = 40 пикселей сцены, клетка = 4 пикселя. */
const NAV_UNIT = 40;
const SPEED = 56;

const LAMP_COLOR: RGB = [255, 194, 116];
/** Цвет значка файла в панели файлов на мониторе. */
const FILE_ICON: Record<string, string> = { ts: '#3178c6', tsx: '#4fc1ff', json: '#cbcb41', md: '#519aba', example: '#e5c07b', gitignore: '#f05133' };
/** Цвета кода — как в редакторе компьютера (laptop.css, .tk-*). */
const TOKEN_COLORS: Record<string, string> = {
  keyword: '#569cd6',
  tag: '#569cd6',
  control: '#c586c0',
  type: '#4ec9b0',
  function: '#dcdcaa',
  string: '#ce9178',
  number: '#b5cea8',
  comment: '#6a9955',
  property: '#9cdcfe',
  variable: '#9cdcfe',
  constant: '#4fc1ff',
  punct: '#b4b4b4',
};
const MONITOR_COLOR: RGB = [120, 160, 255];

const overlaps = (a: Rect, b: Rect) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

export class World {
  minutes = 21 * 60 + 30;
  day = 1;
  /** Сколько игровых минут проходит за реальную секунду. */
  clockRate = 1;
  /** Часы стоят: игра на паузе или поверх открыто окно игры. */
  clockPaused = false;
  /** День ведёт игра: после сна квартира сама не прибавляет день. */
  externalDay = false;
  /** Код на мониторе: печатается, пока герой сидит за компьютером. */
  readonly monitor = new MonitorTyping();
  /** Настоящий текст на мониторе и издалека. false (?monitor=pixel) — издалека пиксели, текст только вблизи. */
  monitorText = true;
  readonly hero = { x: HERO_START.x, y: HERO_START.y, dir: 3 as Dir, moving: false, anim: 0, mode: 'free' as Mode };
  onArrive: ((spot: Spot) => void) | null = null;
  onCoffeeReady: (() => void) | null = null;

  private readonly ctx: CanvasRenderingContext2D;
  private readonly base: Spr;
  private readonly bctx: CanvasRenderingContext2D;
  private readonly light: HTMLCanvasElement;
  private readonly lctx: CanvasRenderingContext2D;
  private readonly bg: Spr;
  private readonly city = new City(MAP_W);
  private readonly solids: Rect[] = PROPS.flatMap((p) => (p.solid ? [p.solid] : []));
  private readonly lamps: Record<LampId, { on: boolean; level: number }> = {
    lampBed: { on: true, level: 1 },
    lampDesk: { on: true, level: 1 },
    lampFloor: { on: true, level: 1 },
  };
  private path: { x: number; y: number }[] = [];
  private pending: Spot | null = null;
  private steam: Particle[] = [];
  private brewing = 0;
  private steamAcc = 0;
  private time = 0;
  private scale = 4;
  /** Увеличение «вся комната на экране». */
  private baseScale = 4;
  /** К какому увеличению плавно идём (колёсико мыши). */
  private zoomTarget = 4;
  private wheelAcc = 0;
  private dpr = 1;
  private cam = { x: 0, y: 0 };
  private camReady = false;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly art: Art,
  ) {
    this.ctx = canvas.getContext('2d')!;
    this.base = make(MAP_W, MAP_H, () => {});
    this.bctx = this.base.getContext('2d')!;
    this.light = document.createElement('canvas');
    this.lctx = this.light.getContext('2d')!;
    this.bg = this.paintBackground();
    this.resize();
  }

  // ───────────── размеры и камера ─────────────

  resize(): void {
    this.dpr = window.devicePixelRatio || 1;
    const w = Math.round(window.innerWidth * this.dpr);
    const h = Math.round(window.innerHeight * this.dpr);
    this.canvas.width = w;
    this.canvas.height = h;
    // Целое увеличение (пиксели чёткие): самое мелкое, при котором сцена закрывает окно,
    // допуская тонкую тёмную кромку по краям (до 7%).
    let s = 1;
    while (s < 32 && (Math.max(0, w / s - MAP_W) / (w / s) > 0.07 || Math.max(0, h / s - MAP_H) / (h / s) > 0.07)) s++;
    // Приближение сохраняем: та же доля пути от «всей комнаты» до самого близкого.
    const { max } = zoomLimits(s);
    const old = zoomLimits(this.baseScale);
    const share = old.max > old.min ? (this.zoomTarget - old.min) / (old.max - old.min) : 0;
    this.baseScale = s;
    this.zoomTarget = Math.round(s + share * (max - s));
    this.scale = this.zoomTarget;
    this.light.width = Math.ceil(w / LIGHT_STEP) + 2;
    this.light.height = Math.ceil(h / LIGHT_STEP) + 2;
    this.camReady = false;
  }

  /** Колёсико: deltaY < 0 — ближе. Тачпад шлёт много мелких шагов, поэтому копим. */
  wheel(deltaY: number): void {
    this.wheelAcc += deltaY;
    const steps = Math.trunc(this.wheelAcc / 60);
    if (!steps) return;
    this.wheelAcc -= steps * 60;
    this.zoomTarget = zoomStep(this.baseScale, this.zoomTarget, -steps);
  }

  private updateCamera(dt: number): void {
    // Плавно к нужному увеличению; у цели — ровно целое число, пиксели снова чёткие.
    const dz = this.zoomTarget - this.scale;
    this.scale = Math.abs(dz) < 0.02 ? this.zoomTarget : this.scale + dz * (1 - Math.exp(-dt * 10));
    const vw = this.canvas.width / this.scale;
    const vh = this.canvas.height / this.scale;
    const fx = this.hero.mode === 'sleep' ? 60 : this.hero.x;
    const fy = this.hero.mode === 'sleep' ? 90 : this.hero.y - 12;
    const tx = vw >= MAP_W ? (MAP_W - vw) / 2 : Math.min(Math.max(fx - vw / 2, 0), MAP_W - vw);
    const ty = vh >= MAP_H ? (MAP_H - vh) / 2 : Math.min(Math.max(fy - vh / 2, 0), MAP_H - vh);
    if (!this.camReady) {
      this.cam = { x: tx, y: ty };
      this.camReady = true;
    } else {
      const k = 1 - Math.exp(-dt * 3.5);
      this.cam.x += (tx - this.cam.x) * k;
      this.cam.y += (ty - this.cam.y) * k;
    }
  }

  /** Сдвиг сцены на экране в целых пикселях экрана. */
  private offset(): { x: number; y: number } {
    return { x: -Math.round(this.cam.x * this.scale), y: -Math.round(this.cam.y * this.scale) };
  }

  /** Точка сцены → точка окна браузера (CSS-пиксели). */
  project(p: { x: number; y: number }): { x: number; y: number } {
    const o = this.offset();
    return { x: (p.x * this.scale + o.x) / this.dpr, y: (p.y * this.scale + o.y) / this.dpr };
  }

  private toScene(clientX: number, clientY: number): { x: number; y: number } {
    const o = this.offset();
    return { x: (clientX * this.dpr - o.x) / this.scale, y: (clientY * this.dpr - o.y) / this.scale };
  }

  headPoint(): { x: number; y: number } {
    if (this.hero.mode === 'sleep') return { x: PILLOW.x, y: PILLOW.y - 12 };
    if (this.hero.mode === 'sit') return { x: SEAT.x, y: SEAT.y - 26 };
    return { x: this.hero.x, y: this.hero.y - 25 };
  }

  monitorOnScreen(): { x: number; y: number } {
    return this.project({ x: 144, y: 40 });
  }

  // ───────────── действия ─────────────

  nearby(): Spot | null {
    if (this.hero.mode !== 'free' || this.path.length) return null;
    let best: Spot | null = null;
    let bestD = 15;
    for (const s of SPOTS) {
      const d = Math.hypot(s.at.x - this.hero.x, s.at.y - this.hero.y);
      if (d < bestD) {
        bestD = d;
        best = s;
      }
    }
    return best;
  }

  /** Что под курсором: предмет (подойти и использовать) или просто место на полу. */
  pick(clientX: number, clientY: number): { target: { x: number; y: number }; spot: Spot | null } {
    const p = this.toScene(clientX, clientY);
    let spot: Spot | null = null;
    for (const s of SPOTS) {
      const r = s.pick;
      if (p.x >= r.x && p.x < r.x + r.w && p.y >= r.y && p.y < r.y + r.h && (!spot || r.w * r.h < spot.pick.w * spot.pick.h)) spot = s;
    }
    return { target: spot ? spot.at : p, spot };
  }

  /** Идти к точке или к предмету. false — идти некуда (герой занят или пути нет). */
  walkTo(target: { x: number; y: number }, spot: Spot | null): boolean {
    if (this.hero.mode !== 'free') return false;
    const U = NAV_UNIT;
    const to = spot ? spot.at : target;
    const route = findPath(
      { x: this.hero.x / U, z: this.hero.y / U },
      { x: to.x / U, z: to.y / U },
      this.solids.map((r) => ({ x: r.x / U, y: r.y / U, w: r.w / U, h: r.h / U })),
      { x: WALK.x / U, y: WALK.y / U, w: WALK.w / U, h: WALK.h / U },
      8 / U,
    );
    if (!route) return false;
    this.path = route.map((p) => ({ x: p.x * U, y: p.z * U }));
    if (spot) this.path.push({ ...spot.at });
    this.pending = spot;
    return true;
  }

  /** Герой свободен: стоит или идёт, не сидит и не спит. */
  get idle(): boolean {
    return this.hero.mode === 'free';
  }

  isLampOn(id: LampId): boolean {
    return this.lamps[id].on;
  }

  toggleLamp(id: LampId): void {
    this.lamps[id].on = !this.lamps[id].on;
  }

  sit(): void {
    this.hero.mode = 'sit';
    this.hero.dir = 1;
    this.path = [];
  }

  stand(): void {
    this.hero.mode = 'free';
    this.hero.x = SPOTS[0]!.at.x;
    this.hero.y = SPOTS[0]!.at.y;
    this.hero.dir = 3;
  }

  /** Герой стоит и смотрит (у окна, у кофемашины) — управление на паузе. */
  hold(on: boolean): void {
    this.hero.mode = on ? 'still' : 'free';
  }

  brew(): void {
    this.hold(true);
    this.brewing = 2.6;
  }

  sleep(): void {
    this.hero.mode = 'sleep';
    this.path = [];
  }

  wakeUp(): void {
    if (this.minutes % 1440 > 7 * 60 + 30 && !this.externalDay) this.day += 1;
    this.minutes = 7 * 60 + 30;
    this.hero.mode = 'free';
    this.hero.x = SPOTS[2]!.at.x;
    this.hero.y = SPOTS[2]!.at.y;
    this.hero.dir = 3;
  }

  // ───────────── обновление ─────────────

  update(dt: number, input: { x: number; y: number }): void {
    this.time += dt;
    if (this.hero.mode === 'sit') this.monitor.advance(dt);
    this.minutes = advanceClock(this.minutes, dt, { rate: this.clockRate, paused: this.clockPaused, sleeping: this.hero.mode === 'sleep' });
    const h = this.hero;
    let moving = false;

    if (h.mode === 'free') {
      const len = Math.hypot(input.x, input.y);
      if (len > 0) {
        // Клавиши отменяют маршрут мышью.
        this.path = [];
        this.pending = null;
        const vx = (input.x / len) * SPEED * dt;
        const vy = (input.y / len) * SPEED * dt;
        if (this.free(h.x + vx, h.y)) h.x += vx;
        if (this.free(h.x, h.y + vy)) h.y += vy;
        h.dir = Math.abs(input.x) > Math.abs(input.y) ? (input.x > 0 ? 0 : 2) : input.y > 0 ? 3 : 1;
        moving = true;
      } else if (this.path.length) {
        const next = this.path[0]!;
        const dx = next.x - h.x;
        const dy = next.y - h.y;
        const d = Math.hypot(dx, dy);
        const step = SPEED * dt;
        if (d <= step) {
          h.x = next.x;
          h.y = next.y;
          this.path.shift();
        } else {
          h.x += (dx / d) * step;
          h.y += (dy / d) * step;
        }
        if (d > 0.01) h.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 0 : 2) : dy > 0 ? 3 : 1;
        moving = true;
        if (!this.path.length && this.pending) {
          const spot = this.pending;
          this.pending = null;
          h.dir = spot.face;
          moving = false;
          this.onArrive?.(spot);
        }
      }
    }
    if (moving !== h.moving) h.anim = 0;
    h.moving = moving;
    h.anim += dt;

    // Лампы гаснут и загораются плавно.
    for (const l of Object.values(this.lamps)) {
      const target = l.on ? 1 : 0;
      l.level += (target - l.level) * (1 - Math.exp(-dt * 9));
    }

    // Пар: из кофемашины, пока варится, и чуть-чуть из кружки на столе.
    if (this.brewing > 0) {
      this.brewing -= dt;
      this.emit(COFFEE_CUP.x, COFFEE_CUP.y, dt, 14);
      if (this.brewing <= 0) {
        this.hold(false);
        this.onCoffeeReady?.();
      }
    }
    this.emit(DESK_MUG.x, DESK_MUG.y, dt, 1.6);
    for (const p of this.steam) p.age += dt;
    this.steam = this.steam.filter((p) => p.age < p.life);

    this.updateCamera(dt);
  }

  private emit(x: number, y: number, dt: number, rate: number): void {
    this.steamAcc += dt * rate;
    while (this.steamAcc >= 1) {
      this.steamAcc -= 1;
      this.steam.push({ x: x + (Math.random() - 0.5) * 2, y, age: 0, life: 1.4 + Math.random() * 0.8, seed: Math.random() * 6 });
    }
  }

  private free(x: number, y: number): boolean {
    const foot = { x: x - 4, y: y - 2, w: 8, h: 3 };
    if (foot.x < WALK.x || foot.x + foot.w > WALK.x + WALK.w || foot.y < WALK.y || foot.y + foot.h > WALK.y + WALK.h) return false;
    return !this.solids.some((s) => overlaps(foot, s));
  }

  // ───────────── рисование ─────────────

  /** Пол, стены, ковры и тени — всё, что не двигается. */
  private paintBackground(): Spr {
    return make(MAP_W, MAP_H, (g) => {
      g.r(0, 0, MAP_W, MAP_H, '#121117');
      // каменная плитка 32×32: ровный тон, лёгкое зерно, светлый и тёмный край шва
      const T = 32;
      for (let ty = ROOM.floorTop; ty < ROOM.bottom; ty += T) {
        for (let tx = ROOM.left; tx < ROOM.right; tx += T) {
          const v = Math.round((hash(tx, ty) - 0.5) * 5);
          const w = Math.min(T, ROOM.right - tx);
          const h = Math.min(T, ROOM.bottom - ty);
          g.r(tx, ty, w, h, css([217 + v, 211 + v, 201 + v]));
          // едва заметная прожилка
          const vx = tx + 4 + Math.floor(hash(tx, ty, 5) * (w - 12));
          for (let i = 0; i < 9; i++) g.p(vx + i, ty + 6 + Math.floor(hash(tx, ty, 6) * (h - 14)) + Math.floor(i / 3), css([210 + v, 204 + v, 194 + v]));
          for (let i = 0; i < 16; i++) {
            const px = tx + 1 + Math.floor(hash(tx + i, ty, 3) * (w - 2));
            const py = ty + 1 + Math.floor(hash(ty + i, tx, 4) * (h - 2));
            const light = hash(i, tx, ty) > 0.5;
            g.p(px, py, light ? css([223 + v, 218 + v, 209 + v]) : css([208 + v, 201 + v, 191 + v]));
          }
          g.r(tx, ty, w, 1, '#e2ddd4');
          g.r(tx, ty, 1, h, '#e2ddd4');
          g.r(tx, ty + h - 1, w, 1, '#c3bbb0');
          g.r(tx + w - 1, ty, 1, h, '#c3bbb0');
        }
      }
      // тень от стены на полу
      [0.2, 0.13, 0.08, 0.04, 0.02].forEach((a, i) => g.r(ROOM.left, ROOM.floorTop + i, ROOM.right - ROOM.left, 1, `rgba(40,30,40,${a})`));
      [0.14, 0.07, 0.03].forEach((a, i) => {
        g.r(ROOM.left + i, ROOM.floorTop, 1, ROOM.bottom - ROOM.floorTop, `rgba(40,30,40,${a})`);
        g.r(ROOM.right - 1 - i, ROOM.floorTop, 1, ROOM.bottom - ROOM.floorTop, `rgba(40,30,40,${a})`);
      });
      // верхняя стена
      for (let y = ROOM.wallTop; y < ROOM.floorTop; y++) {
        const t = (y - ROOM.wallTop) / (ROOM.floorTop - ROOM.wallTop);
        g.r(ROOM.left, y, ROOM.right - ROOM.left, 1, css([40 + t * 10, 39 + t * 10, 48 + t * 10]));
      }
      for (let x = ROOM.left + 30; x < ROOM.right; x += 46) g.r(x, ROOM.wallTop + 2, 1, ROOM.floorTop - ROOM.wallTop - 6, 'rgba(0,0,0,0.12)');
      g.r(ROOM.left, ROOM.floorTop - 4, ROOM.right - ROOM.left, 4, '#25242c');
      g.r(ROOM.left, ROOM.floorTop - 4, ROOM.right - ROOM.left, 1, '#4b4a56');
      // потолочная кромка
      g.r(0, 0, MAP_W, ROOM.wallTop, '#121117');
      g.r(ROOM.left - 6, ROOM.wallTop - 2, ROOM.right - ROOM.left + 12, 2, '#2e2d37');
      g.r(ROOM.left - 6, ROOM.wallTop - 2, ROOM.right - ROOM.left + 12, 1, '#4d4c59');
      // боковые и нижняя стены — тонкие тёмные кромки
      g.r(ROOM.left - 6, ROOM.wallTop, 6, ROOM.bottom - ROOM.wallTop + 6, '#1d1c24');
      g.r(ROOM.left - 1, ROOM.wallTop, 1, ROOM.bottom - ROOM.wallTop, '#4d4c59');
      g.r(ROOM.right, ROOM.wallTop, 6, ROOM.bottom - ROOM.wallTop + 6, '#1d1c24');
      g.r(ROOM.right, ROOM.wallTop, 1, ROOM.bottom - ROOM.wallTop, '#4d4c59');
      g.r(ROOM.left - 6, ROOM.bottom, ROOM.right - ROOM.left + 12, 6, '#1d1c24');
      g.r(ROOM.left - 1, ROOM.bottom, ROOM.right - ROOM.left + 2, 1, '#4d4c59');
      // проём входной двери: порог и тёмный коридор за ним
      g.r(DOOR.x, ROOM.bottom, DOOR.w, MAP_H - ROOM.bottom, '#2a2830');
      g.r(DOOR.x, ROOM.bottom, DOOR.w, 2, '#8d8578');
      g.r(DOOR.x, ROOM.bottom + 2, DOOR.w, 1, '#5f594f');
      g.r(DOOR.x - 2, ROOM.bottom - 1, 2, MAP_H - ROOM.bottom + 1, '#4d4c59');
      g.r(DOOR.x + DOOR.w, ROOM.bottom - 1, 2, MAP_H - ROOM.bottom + 1, '#4d4c59');
      // вещи на стене
      for (const w of WALL_ITEMS) g.c.drawImage(this.art[w.key], w.x, w.y);
      // ковры
      for (const p of PROPS) if (p.flat) g.c.drawImage(this.art[p.key], p.x, p.y);
      // тени предметов
      for (const p of PROPS) {
        if (!p.shadow) continue;
        const s = p.shadow;
        g.r(s.x + 1, s.y, s.w - 2, s.h, 'rgba(50,36,40,0.10)');
        g.r(s.x, s.y + 1, s.w, s.h - 2, 'rgba(50,36,40,0.10)');
        g.r(s.x + 2, s.y + 1, s.w - 4, s.h - 2, 'rgba(50,36,40,0.08)');
      }
    });
  }

  render(): void {
    const day = daylightAt(this.minutes);
    const b = this.bctx;
    b.imageSmoothingEnabled = false;
    b.drawImage(this.bg, 0, 0);
    this.drawWindows(day);
    this.drawClock();

    // Предметы и герой по глубине.
    const items: { sort: number; draw: () => void }[] = [];
    for (const p of PROPS) if (!p.flat) items.push({ sort: p.sort ?? p.y + this.art[p.key].height, draw: () => this.drawProp(p) });
    if (this.hero.mode !== 'sleep') items.push({ sort: this.hero.mode === 'sit' ? SEAT.y : this.hero.y, draw: () => this.drawHero() });
    items.sort((a, c) => a.sort - c.sort);
    for (const it of items) it.draw();
    this.drawSteam();

    // Увеличиваем сцену на экран.
    const c = this.ctx;
    const o = this.offset();
    c.globalCompositeOperation = 'source-over';
    c.imageSmoothingEnabled = false;
    c.fillStyle = '#121117';
    c.fillRect(0, 0, this.canvas.width, this.canvas.height);
    c.drawImage(this.base, o.x, o.y, MAP_W * this.scale, MAP_H * this.scale);
    this.drawLight(day, o);
    if (this.hero.mode === 'sit') this.drawScreenText(o);
  }

  private drawProp(p: Prop): void {
    const b = this.bctx;
    b.drawImage(this.art[p.key], p.x, p.y);
    if (p.key === 'monitor') this.drawScreen(p.x + MONITOR_SCREEN.x, p.y + MONITOR_SCREEN.y);
    if (p.key === 'deskLamp' && this.lamps.lampDesk.level < 0.5) {
      b.fillStyle = '#6d675c';
      b.fillRect(p.x + 3, p.y + 3, 3, 1);
    }
    if (p.key === 'coffee') {
      const ready = this.brewing <= 0;
      b.fillStyle = ready ? '#7be0a0' : Math.sin(this.time * 12) > 0 ? '#ffb347' : '#6b4a2a';
      b.fillRect(p.x + COFFEE_LED.x, p.y + COFFEE_LED.y, 1, 1);
    }
    if (p.key === 'bed' && this.hero.mode === 'sleep') {
      // голова на подушке, сверху одеяло
      b.drawImage(this.art.hero.sleepHead, PILLOW.x - 6, PILLOW.y + 1);
      b.drawImage(this.art.blanketTop, p.x, p.y + 22);
    }
    if (p.key === 'floorLamp' && this.lamps.lampFloor.level > 0.5) {
      b.fillStyle = 'rgba(255,248,226,0.9)';
      b.fillRect(p.x + FLOOR_LAMP_SHADE.x - 3, p.y + 8, 7, 1);
    }
  }

  /** Экран моноблока: заставка или редактор с кодом, когда герой работает. */
  private drawScreen(x: number, y: number): void {
    const b = this.bctx;
    const { w, h } = MONITOR_SCREEN;
    if (this.hero.mode === 'sit') {
      // Тот же код, что печатается в компьютере: одна буква — один пиксель, строка через строку.
      b.fillStyle = '#1f1f1f';
      b.fillRect(x, y, w, h);
      b.fillStyle = '#2b2b2b';
      b.fillRect(x, y, 3, h);
      const cols = w - 4;
      const rows = this.monitor.rows(cols, Math.floor(h / 2), 0);
      rows.forEach((row, r) => {
        let col = row.indent;
        for (const t of row.tokens) {
          if (t.kind !== 'space' && t.text.trim()) {
            // Пробелы внутри куска не закрашиваем: видно отдельные слова.
            for (const word of t.text.matchAll(/\S+/g)) {
              b.fillStyle = TOKEN_COLORS[t.kind] ?? '#cccccc';
              b.fillRect(x + 4 + col + word.index, y + 1 + r * 2, word[0].length, 1);
            }
          }
          col += t.text.length;
        }
        if (row.caret !== null && Math.floor(this.time * 2) % 2 === 0) {
          b.fillStyle = '#aeafad';
          b.fillRect(x + 4 + Math.min(row.indent + row.caret, cols - 1), y + 1 + r * 2, 1, 1);
        }
      });
    } else {
      // заставка: ночное небо Pulse и кольцо-логотип
      for (let j = 0; j < h; j++) {
        const t = j / (h - 1);
        b.fillStyle = css([28 + t * 40, 36 + t * 30, 70 + t * 30]);
        b.fillRect(x, y + j, w, 1);
      }
      b.fillStyle = '#3f6f6a';
      b.fillRect(x, y + h - 3, w, 3);
      b.fillStyle = '#4f8a7c';
      b.fillRect(x + 2, y + h - 4, 7, 1);
      b.fillRect(x + 12, y + h - 4, 5, 1);
      const pulse = 0.6 + 0.4 * Math.sin(this.time * 2);
      b.fillStyle = `rgba(255,255,255,${0.55 + 0.4 * pulse})`;
      const cx = x + 10;
      const cy = y + 3;
      b.fillRect(cx - 1, cy - 1, 2, 1);
      b.fillRect(cx - 1, cy + 2, 2, 1);
      b.fillRect(cx - 2, cy, 1, 2);
      b.fillRect(cx + 1, cy, 1, 2);
    }
  }

  /**
   * Вблизи на мониторе — настоящий текст, как в редакторе: вкладка с файлом, номера строк, перенос длинных строк.
   * Рисуется поверх увеличенной сцены в точных пикселях экрана и плавно проступает при приближении.
   */
  private drawScreenText(o: { x: number; y: number }): void {
    const amount = textAmount(this.scale, this.baseScale, this.monitorText);
    if (amount <= 0) return;
    const monitor = PROPS.find((p) => p.key === 'monitor')!;
    const s = this.scale;
    const X = (monitor.x + MONITOR_SCREEN.x) * s + o.x;
    const Y = (monitor.y + MONITOR_SCREEN.y) * s + o.y;
    const W = MONITOR_SCREEN.w * s;
    const H = MONITOR_SCREEN.h * s;
    const c = this.ctx;
    c.save();
    c.globalAlpha = amount;
    c.beginPath();
    c.rect(X, Y, W, H);
    c.clip();
    c.fillStyle = '#1f1f1f';
    c.fillRect(X, Y, W, H);

    // Размер букв — от высоты экрана: восемь строк кода.
    const tab = H * 0.13;
    const font = (H - tab) / (8.6 * 1.3);
    const line = font * 1.3;
    const mono = `${font}px Menlo, ui-monospace, Consolas, monospace`;
    const sans = (k: number) => `${font * k}px -apple-system, BlinkMacSystemFont, system-ui, sans-serif`;

    // Слева — панель файлов проекта, как в редакторе.
    const ew = Math.round(W * 0.3);
    c.fillStyle = '#181818';
    c.fillRect(X, Y, ew, H);
    c.fillStyle = '#2b2b2b';
    c.fillRect(X + ew - Math.max(1, s * 0.08), Y, Math.max(1, s * 0.08), H);
    const eLine = font * 1.22;
    c.font = sans(0.86);
    c.textBaseline = 'middle';
    const tree = explorerRows(this.monitor.fileName, Math.floor((H - font * 0.4) / eLine));
    // Длинные имена обрезаются краем панели, как в редакторе, и не залезают на код.
    c.save();
    c.beginPath();
    c.rect(X, Y, ew - Math.max(1, s * 0.08), H);
    c.clip();
    tree.forEach((r, i) => {
      const ry = Y + font * 0.2 + eLine * (i + 0.5);
      if (r.active) {
        c.fillStyle = '#37373d';
        c.fillRect(X, ry - eLine / 2, ew - Math.max(1, s * 0.08), eLine);
      }
      const ix = X + font * (0.5 + r.node.depth * 0.75);
      if (r.node.folder) {
        c.fillStyle = '#c5c5c5';
        c.fillText(r.node.open ? '⌄' : '›', ix, r.node.open ? ry - font * 0.2 : ry);
      } else {
        // Цветной значок по типу файла.
        const ext = r.node.name.split('.').pop() ?? '';
        c.fillStyle = FILE_ICON[ext] ?? '#8a8a8a';
        c.fillRect(ix, ry - font * 0.22, font * 0.44, font * 0.44);
      }
      c.fillStyle = r.node.dim ? '#6e7681' : r.node.git === 'M' ? '#e2c08d' : r.node.git === 'U' ? '#73c991' : '#cccccc';
      c.fillText(r.node.name, ix + font * 0.8, ry);
    });
    c.restore();

    // Справа — редактор: вкладка с именем файла и код.
    const CX = X + ew;
    const CW = W - ew;
    c.fillStyle = '#181818';
    c.fillRect(CX, Y, CW, tab);
    const name = this.monitor.fileName;
    c.font = sans(0.9);
    const nameW = c.measureText(name).width;
    c.fillStyle = '#1f1f1f';
    c.fillRect(CX, Y, nameW + font * 1.6, tab);
    c.fillStyle = '#3c8ce6';
    c.fillRect(CX, Y, nameW + font * 1.6, Math.max(1, s * 0.12));
    c.fillStyle = '#e8e8e8';
    c.fillText(name, CX + font * 0.8, Y + tab / 2);

    c.font = mono;
    const charW = c.measureText('M').width;
    const gutter = charW * 3.4;
    const top = Y + tab + line * 0.6;
    const cols = Math.max(8, Math.floor((CW - gutter - charW) / charW));
    const rows = this.monitor.rows(cols, Math.floor((H - tab - line * 0.2) / line));
    rows.forEach((row, r) => {
      const ry = top + r * line;
      if (row.number !== null) {
        c.fillStyle = row.caret !== null ? '#cccccc' : '#6e7681';
        const num = String(row.number);
        c.fillText(num, CX + gutter - charW * (num.length + 0.9), ry);
      }
      let cx = CX + gutter + row.indent * charW;
      for (const t of row.tokens) {
        c.fillStyle = TOKEN_COLORS[t.kind] ?? '#cccccc';
        c.fillText(t.text, cx, ry);
        cx += t.text.length * charW;
      }
      if (row.caret !== null && Math.floor(this.time * 2) % 2 === 0) {
        c.fillStyle = '#aeafad';
        c.fillRect(CX + gutter + (row.indent + row.caret) * charW, ry - font * 0.55, Math.max(1, s * 0.12), font * 1.1);
      }
    });
    c.restore();
  }

  private drawHero(): void {
    const b = this.bctx;
    const h = this.hero;
    const sitting = h.mode === 'sit';
    const x = Math.round(sitting ? SEAT.x : h.x);
    const y = Math.round(sitting ? SEAT.y : h.y);
    // тень под ногами
    if (!sitting) {
      b.fillStyle = 'rgba(40,28,36,0.22)';
      b.fillRect(x - 5, y - 1, 10, 2);
      b.fillRect(x - 4, y - 2, 8, 4);
    }
    const art = this.art.hero;
    let frame: Spr;
    if (sitting) {
      // Печатает: руки то и дело двигаются, иногда пауза — думает.
      const beat = Math.floor(this.time * 6);
      frame = art.sit[hash(beat, 7) > 0.35 ? beat % 2 : 0]!;
    } else if (h.moving) {
      frame = art.walk[h.dir]![Math.floor(h.anim * 7.5) % 4]!;
    } else {
      // Дышит, раз в несколько секунд моргает.
      const blink = this.time % 3.7 < 0.14;
      frame = blink ? art.blink[h.dir]! : art.idle[h.dir]![Math.floor(this.time / 0.9) % 2]!;
    }
    b.drawImage(frame, x - 8, y - 31 - (sitting ? 4 : 0));
  }

  private drawSteam(): void {
    const b = this.bctx;
    for (const p of this.steam) {
      const t = p.age / p.life;
      const a = (t < 0.2 ? t / 0.2 : 1 - (t - 0.2) / 0.8) * 0.7;
      const px = Math.round(p.x + Math.sin(p.age * 3 + p.seed) * 1.5);
      const py = Math.round(p.y - p.age * 7);
      b.fillStyle = `rgba(255,255,255,${a})`;
      b.fillRect(px, py, 1, 1);
    }
  }

  private drawWindows(day: Daylight): void {
    const b = this.bctx;
    for (const w of WINDOWS) {
      // рама
      b.fillStyle = '#17161d';
      b.fillRect(w.x, w.y, w.w, w.h);
      b.fillStyle = '#55546a';
      b.fillRect(w.x + 1, w.y + 1, w.w - 2, w.h - 2);
      const gx = w.x + 2;
      const gy = w.y + 2;
      const gw = w.w - 4;
      const gh = w.h - 4;
      this.city.draw(b, day, gx, gx, gy, gw, gh, this.time);
      // переплёт
      b.fillStyle = '#55546a';
      for (let x = gx + Math.floor(gw / 2) - 1; x < gx + gw; x += gw) b.fillRect(x, gy, 2, gh);
      b.fillStyle = '#6c6b82';
      b.fillRect(gx + Math.floor(gw / 2) - 1, gy, 1, gh);
      // блик на стекле
      b.fillStyle = 'rgba(255,255,255,0.07)';
      for (let i = 0; i < gh; i++) b.fillRect(gx + 4 + i, gy + gh - 1 - i, 3, 1);
      b.fillStyle = 'rgba(255,255,255,0.05)';
      for (let i = 0; i < gh; i++) b.fillRect(gx + gw / 2 + 8 + i, gy + gh - 1 - i, 2, 1);
      // подоконник
      b.fillStyle = '#e6e1d9';
      b.fillRect(w.x - 2, w.y + w.h, w.w + 4, 2);
      b.fillStyle = '#9d978f';
      b.fillRect(w.x - 2, w.y + w.h + 2, w.w + 4, 1);
    }
  }

  private drawClock(): void {
    const b = this.bctx;
    const { x, y } = CLOCK;
    const rows = ['...ooooo...', '..owwwwwo..', '.owwwwwwwo.', 'owwwwwwwwwo', 'owwwwwwwwwo', 'owwwwwwwwwo', 'owwwwwwwwwo', 'owwwwwwwwwo', '.owwwwwwwo.', '..owwwwwo..', '...ooooo...'];
    rows.forEach((row, j) => {
      for (let i = 0; i < row.length; i++) {
        if (row[i] === '.') continue;
        b.fillStyle = row[i] === 'o' ? '#24232d' : '#f1ede6';
        b.fillRect(x + i, y + j, 1, 1);
      }
    });
    const m = this.minutes % 1440;
    const cx = x + 5;
    const cy = y + 5;
    const hand = (ang: number, len: number, col: string) => {
      b.fillStyle = col;
      for (let i = 1; i <= len; i++) b.fillRect(Math.round(cx + Math.sin(ang) * i), Math.round(cy - Math.cos(ang) * i), 1, 1);
    };
    hand(((m / 60) % 12) * (Math.PI / 6), 2, '#24232d');
    hand((m % 60) * (Math.PI / 30), 4, '#b8643f');
    b.fillStyle = '#24232d';
    b.fillRect(cx, cy, 1, 1);
  }

  /** Свет: общий тон суток, пятна ламп, солнце из окон. Считаем в маленьком холсте и растягиваем мягко. */
  private drawLight(day: Daylight, o: { x: number; y: number }): void {
    const L = this.lctx;
    const lw = this.light.width;
    const lh = this.light.height;
    const k = this.scale / LIGHT_STEP;
    const lx = (x: number) => x * k + o.x / LIGHT_STEP;
    const ly = (y: number) => y * k + o.y / LIGHT_STEP;
    const dark = day.dark;
    const monitor = (this.hero.mode === 'sit' ? 1 : 0.65) * (0.97 + 0.03 * Math.sin(this.time * 31) * Math.sin(this.time * 7));

    L.globalCompositeOperation = 'source-over';
    L.fillStyle = css(day.ambient);
    L.fillRect(0, 0, lw, lh);

    // Днём по полу медленно плывут мягкие тени облаков.
    if (dark < 0.6) {
      L.globalCompositeOperation = 'multiply';
      for (let i = 0; i < 3; i++) {
        const cx = ((this.time * (3 + i) + i * 150) % (MAP_W + 200)) - 100;
        const cy = 90 + i * 50;
        const r = 70 + i * 16;
        const g = L.createRadialGradient(lx(cx), ly(cy), 0, lx(cx), ly(cy), r * k);
        const a = 0.14 * (1 - dark / 0.6);
        g.addColorStop(0, `rgba(150,140,150,${a})`);
        g.addColorStop(1, 'rgba(150,140,150,0)');
        L.fillStyle = g;
        L.fillRect(0, 0, lw, lh);
      }
    }

    L.globalCompositeOperation = 'lighter';
    const glow = (x: number, y: number, r: number, col: RGB, power: number) => {
      if (power <= 0.01) return;
      const g = L.createRadialGradient(lx(x), ly(y), 0, lx(x), ly(y), r * k);
      g.addColorStop(0, css(col, power));
      g.addColorStop(0.22, css(col, power * 0.68));
      g.addColorStop(0.5, css(col, power * 0.26));
      g.addColorStop(0.78, css(col, power * 0.07));
      g.addColorStop(1, css(col, 0));
      L.fillStyle = g;
      L.fillRect(lx(x - r), ly(y - r), 2 * r * k, 2 * r * k);
    };

    // Солнце: пятна света от окон на полу. Смешиваем к цвету солнца, а не прибавляем —
    // так закатный свет остаётся оранжевым и не «выгорает» в жёлто-зелёный.
    L.globalCompositeOperation = 'source-over';
    if (day.sun.power > 0.02) {
      for (const w of WINDOWS) {
        const x0 = w.x + 3;
        const x1 = w.x + w.w - 3;
        const top = ROOM.floorTop;
        const g = L.createLinearGradient(0, ly(top), 0, ly(top + day.sun.len));
        g.addColorStop(0, css(day.sun.color, 0.7 * day.sun.power));
        g.addColorStop(1, css(day.sun.color, 0));
        L.fillStyle = g;
        L.beginPath();
        L.moveTo(lx(x0), ly(top));
        L.lineTo(lx(x1), ly(top));
        L.lineTo(lx(x1 + day.sun.dx), ly(top + day.sun.len));
        L.lineTo(lx(x0 + day.sun.dx), ly(top + day.sun.len));
        L.closePath();
        L.fill();
      }
    }
    L.globalCompositeOperation = 'lighter';
    // Ночью окна дают холодный отсвет города.
    for (const w of WINDOWS) glow(w.x + w.w / 2, ROOM.floorTop + 6, w.w * 0.75, [90, 110, 190], 0.22 * dark);

    for (const lamp of LAMPS) {
      const lv = this.lamps[lamp.id].level;
      glow(lamp.light.x, lamp.light.y, lamp.light.r, LAMP_COLOR, lv * (0.1 + 0.88 * dark));
    }
    glow(MONITOR_LIGHT.x, MONITOR_LIGHT.y, MONITOR_LIGHT.r, MONITOR_COLOR, monitor * (0.08 + 0.42 * dark));
    glow(KITCHEN_LIGHT.x, KITCHEN_LIGHT.y, KITCHEN_LIGHT.r, [255, 206, 150], 0.5 * dark);

    // Накладываем свет на картинку.
    const c = this.ctx;
    c.imageSmoothingEnabled = true;
    c.globalCompositeOperation = 'multiply';
    c.drawImage(this.light, 0, 0, lw * LIGHT_STEP, lh * LIGHT_STEP);

    // Свечение ламп, экрана и солнечных лучей поверх — «ореол».
    c.globalCompositeOperation = 'lighter';
    const s = this.scale;
    const halo = (x: number, y: number, r: number, col: RGB, a: number) => {
      if (a <= 0.01) return;
      const X = x * s + o.x;
      const Y = y * s + o.y;
      const g = c.createRadialGradient(X, Y, 0, X, Y, r * s);
      g.addColorStop(0, css(col, a));
      g.addColorStop(0.4, css(col, a * 0.35));
      g.addColorStop(1, css(col, 0));
      c.fillStyle = g;
      c.fillRect(X - r * s, Y - r * s, 2 * r * s, 2 * r * s);
    };
    for (const lamp of LAMPS) halo(lamp.bulb.x, lamp.bulb.y, lamp.bulb.r, [255, 190, 120], this.lamps[lamp.id].level * (0.08 + 0.32 * dark));
    halo(144, 39, 16, [130, 170, 255], monitor * (0.04 + 0.2 * dark));
    halo(COFFEE_CUP.x + 4, COFFEE_CUP.y - 6, 3, this.brewing > 0 ? [255, 170, 80] : [120, 230, 160], 0.35 * dark);
    if (day.sun.power > 0.02) {
      c.globalCompositeOperation = 'soft-light';
      for (const w of WINDOWS) {
        const top = ROOM.floorTop * s + o.y;
        const g = c.createLinearGradient(0, top, 0, top + day.sun.len * s);
        g.addColorStop(0, css(day.sun.color, 0.45 * day.sun.power));
        g.addColorStop(1, css(day.sun.color, 0));
        c.fillStyle = g;
        c.beginPath();
        c.moveTo((w.x + 3) * s + o.x, top);
        c.lineTo((w.x + w.w - 3) * s + o.x, top);
        c.lineTo((w.x + w.w - 3 + day.sun.dx) * s + o.x, top + day.sun.len * s);
        c.lineTo((w.x + 3 + day.sun.dx) * s + o.x, top + day.sun.len * s);
        c.closePath();
        c.fill();
      }
    }
    c.globalCompositeOperation = 'source-over';
  }
}
