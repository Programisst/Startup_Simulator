// Вид из окна: живой пиксельный город 320×180. Небо, солнце или месяц, облака, три плана домов,
// улица с машинами, птицы днём и самолёт ночью. Всё зависит от времени суток.
import { seeded } from '../room/engine/pixels';
import { mixColor, skyAt } from '../room/engine/sky';

export const CITY_W = 320;
export const CITY_H = 180;
const HORIZON = 128;
const STREET = 158;
/** Порог 4×4 для мягкого перехода между полосами цвета неба. */
const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);

type Ctx = CanvasRenderingContext2D;

function rgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rect(g: Ctx, x: number, y: number, w: number, h: number, color: string): void {
  g.fillStyle = color;
  g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

function disc(g: Ctx, cx: number, cy: number, r: number, color: string): void {
  g.fillStyle = color;
  for (let dy = -r; dy <= r; dy++) {
    const half = Math.floor(Math.sqrt(r * r - dy * dy) + 0.3);
    g.fillRect(Math.round(cx - half), Math.round(cy + dy), half * 2 + 1, 1);
  }
}

interface Building {
  x: number;
  w: number;
  h: number;
  roof: 'flat' | 'tank' | 'antenna' | 'step' | 'spire';
  windows: { x: number; y: number; on: boolean; cool: boolean; flip: number }[];
}

interface Layer {
  base: number;
  day: string;
  night: string;
  buildings: Building[];
  winSize: [number, number];
}

function makeLayer(seed: number, base: number, minH: number, maxH: number, day: string, night: string, win: [number, number] | null): Layer {
  const r = seeded(seed);
  const buildings: Building[] = [];
  let x = -Math.floor(r() * 10);
  while (x < CITY_W) {
    const w = 14 + Math.floor(r() * 22);
    const h = Math.round(minH + r() * (maxH - minH));
    const k = r();
    const roof: Building['roof'] = k < 0.2 ? 'tank' : k < 0.38 ? 'antenna' : k < 0.55 ? 'step' : 'flat';
    const windows: Building['windows'] = [];
    if (win) {
      const [ww, wh] = win;
      for (let wy = base - h + 4; wy < base - 3; wy += wh + 2) {
        for (let wx = x + 3; wx < x + w - 2 - ww; wx += ww + 2) {
          windows.push({ x: wx, y: wy, on: r() < 0.38, cool: r() < 0.22, flip: r() * 60 });
        }
      }
    }
    buildings.push({ x, w, h, roof, windows });
    x += w + (r() < 0.3 ? 0 : 1 + Math.floor(r() * 3));
  }
  return { base, day, night, buildings, winSize: win ?? [0, 0] };
}

interface Car {
  x: number;
  lane: 0 | 1;
  speed: number;
  color: string;
}

interface Cloud {
  x: number;
  y: number;
  puffs: [number, number, number][];
  speed: number;
}

export class CityView {
  private layers: Layer[];
  private tower: { x: number; h: number };
  private cars: Car[];
  private clouds: Cloud[];
  private stars: { x: number; y: number; phase: number; big: boolean }[];
  private skyCache = document.createElement('canvas');
  private skyKey = '';

  constructor() {
    this.layers = [
      makeLayer(51, HORIZON + 6, 26, 56, '#aeb8cc', '#28304e', null),
      makeLayer(52, HORIZON + 18, 34, 78, '#8f9ab2', '#1d2440', [1, 2]),
      makeLayer(53, STREET, 30, 74, '#6e7891', '#141a2e', [2, 2]),
    ];
    this.tower = { x: 196, h: 118 };
    const r = seeded(77);
    const carColors = ['#e9e4da', '#2f3a52', '#b8473f', '#d9a441', '#4f6f8f', '#1f1f24', '#8c8f96'];
    this.cars = Array.from({ length: 7 }, (_, i) => ({
      x: r() * CITY_W,
      lane: (i % 2) as 0 | 1,
      speed: (18 + r() * 16) * (i % 2 ? -1 : 1),
      color: carColors[i % carColors.length]!,
    }));
    this.clouds = Array.from({ length: 6 }, () => {
      const puffs: [number, number, number][] = [];
      const n = 3 + Math.floor(r() * 3);
      for (let k = 0; k < n; k++) puffs.push([k * 7 + r() * 4, r() * 3, 5 + Math.floor(r() * 5)]);
      return { x: r() * CITY_W, y: 14 + r() * 56, puffs, speed: 1.5 + r() * 2.5 };
    });
    this.stars = Array.from({ length: 110 }, () => ({ x: Math.floor(r() * CITY_W), y: Math.floor(r() * (HORIZON - 30)), phase: r() * 6.28, big: r() < 0.08 }));
    this.skyCache.width = CITY_W;
    this.skyCache.height = CITY_H;
  }

  draw(g: Ctx, minutes: number, t: number): void {
    const sky = skyAt(minutes);
    const night = sky.darkness;
    const hour = (((minutes % 1440) + 1440) % 1440) / 60;
    this.drawSky(g, sky.top, sky.bottom);

    // Солнце днём, месяц и звёзды ночью.
    if (night < 0.7 && hour > 5.5 && hour < 20.5) {
      const k = (hour - 5.5) / 15;
      const sx = 30 + k * 260;
      const sy = HORIZON - 6 - Math.sin(k * Math.PI) * 92;
      const warm = mixColor('#fff6d8', '#ffb070', Math.abs(k - 0.5) * 2);
      disc(g, sx, sy, 11, mixColor(sky.bottom, warm, 0.25));
      disc(g, sx, sy, 8, mixColor(sky.bottom, warm, 0.5));
      disc(g, sx, sy, 6, warm);
    }
    if (night > 0.35) {
      for (const s of this.stars) {
        const tw = 0.5 + 0.5 * Math.sin(t * 2.2 + s.phase);
        g.globalAlpha = (night - 0.35) * 1.5 * (0.45 + 0.55 * tw);
        rect(g, s.x, s.y, 1, 1, s.big ? '#fffbe8' : '#c9cfe8');
        if (s.big && tw > 0.7) {
          rect(g, s.x - 1, s.y, 3, 1, '#8c93b8');
          rect(g, s.x, s.y - 1, 1, 3, '#8c93b8');
          rect(g, s.x, s.y, 1, 1, '#fffbe8');
        }
      }
      g.globalAlpha = Math.min(1, (night - 0.35) * 2);
      const mx = 250;
      const my = 30;
      disc(g, mx, my, 9, mixColor(sky.top, '#f3ecd0', 0.18));
      disc(g, mx, my, 6, '#f3ecd0');
      disc(g, mx + 3, my - 2, 5, mixColor(sky.top, '#f3ecd0', 0.04));
      g.globalAlpha = 1;
    }

    // Облака плывут; на закате розовые, ночью тёмные.
    const cloudLight = mixColor(mixColor('#ffffff', sky.bottom, 0.35), '#3a4166', night);
    const cloudShade = mixColor(cloudLight, sky.top, 0.35);
    for (const c of this.clouds) {
      const x = ((c.x + t * c.speed) % (CITY_W + 80)) - 40;
      g.globalAlpha = 0.85 - night * 0.35;
      for (const [px, py, r] of c.puffs) disc(g, x + px, c.y + py + 1, r, cloudShade);
      for (const [px, py, r] of c.puffs) disc(g, x + px, c.y + py - 1, r - 1, cloudLight);
      g.globalAlpha = 1;
    }

    // Птицы днём, самолёт с мигалками ночью.
    if (night < 0.4) {
      const bx = ((t * 14) % (CITY_W + 60)) - 30;
      for (let i = 0; i < 4; i++) {
        const x = bx - i * 7;
        const y = 50 + Math.sin(t * 0.8 + i) * 3 + (i % 2) * 4;
        const up = Math.floor(t * 6 + i) % 2 === 0;
        const c = mixColor('#2a2a35', sky.bottom, 0.3);
        rect(g, x, y, 1, 1, c);
        rect(g, x - 1, y + (up ? -1 : 0), 1, 1, c);
        rect(g, x + 1, y + (up ? -1 : 0), 1, 1, c);
      }
    } else {
      const px = CITY_W - ((t * 9) % (CITY_W + 40));
      const py = 22 + px * 0.04;
      rect(g, px, py, 3, 1, '#3d4466');
      if (Math.floor(t * 1.5) % 2 === 0) rect(g, px, py, 1, 1, '#ff5a52');
      if (Math.floor(t * 1.5 + 0.5) % 2 === 0) rect(g, px + 2, py, 1, 1, '#f4f6ff');
    }

    // Дома: дальний план светлее и туманнее, ближний — темнее и подробнее.
    this.layers.forEach((L, li) => {
      // Между ближними домами не должно просвечивать небо — за ними сплошной ряд.
      if (li === 2) {
        const back = mixColor(mixColor(this.layers[1]!.day, sky.bottom, 0.12), this.layers[1]!.night, night);
        rect(g, 0, HORIZON + 10, CITY_W, STREET - HORIZON - 10, mixColor(back, '#000000', 0.1));
      }
      const facade = mixColor(mixColor(L.day, sky.bottom, li === 0 ? 0.35 : 0.12), L.night, night);
      const lit = mixColor(facade, '#ffffff', 0.16 * (1 - night));
      for (const b of L.buildings) {
        const y = L.base - b.h;
        rect(g, b.x, y, b.w, b.h, facade);
        rect(g, b.x, y, 1, b.h, lit);
        if (b.roof === 'step') rect(g, b.x + 3, y - 3, b.w - 6, 3, facade);
        if (b.roof === 'tank' && li > 0) {
          rect(g, b.x + 4, y - 6, 6, 5, mixColor(facade, '#6b4a34', 0.4 * (1 - night)));
          rect(g, b.x + 5, y - 1, 1, 1, facade);
          rect(g, b.x + 8, y - 1, 1, 1, facade);
        }
        if (b.roof === 'antenna') {
          rect(g, b.x + Math.floor(b.w / 2), y - 8, 1, 8, facade);
          if (night > 0.3 && Math.floor(t * 1.2 + b.x) % 2 === 0) rect(g, b.x + Math.floor(b.w / 2), y - 9, 1, 1, '#ff5a52');
        }
        for (const w of b.windows) {
          const flicker = Math.floor((t + w.flip) / 9) % 7 === 0; // иногда кто-то включает или выключает свет
          const on = w.on !== flicker;
          let color: string;
          if (night > 0.35) color = on ? (w.cool ? '#a9d4ff' : '#ffd38a') : mixColor(facade, '#000000', 0.25);
          else color = on ? mixColor(facade, sky.top, 0.45) : mixColor(facade, '#000000', 0.12);
          rect(g, w.x, w.y, L.winSize[0], L.winSize[1], color);
        }
      }
      // Башня со шпилем — главный ориентир, стоит между средним и ближним планом.
      if (li === 1) {
        const tx = this.tower.x;
        const top = HORIZON + 18 - this.tower.h;
        const tf = mixColor(mixColor('#8a95ae', sky.bottom, 0.1), '#1a2038', night);
        rect(g, tx, top + 14, 16, this.tower.h - 14, tf);
        rect(g, tx + 3, top + 6, 10, 8, tf);
        rect(g, tx + 7, top - 10, 2, 16, tf);
        rect(g, tx, top + 14, 1, this.tower.h - 14, mixColor(tf, '#ffffff', 0.2 * (1 - night)));
        for (let wy = top + 18; wy < HORIZON + 14; wy += 4) {
          for (let wx = tx + 3; wx < tx + 14; wx += 3) {
            const on = Math.sin(wx * 12.9 + wy * 78.2) > 0.1;
            rect(g, wx, wy, 1, 2, night > 0.35 ? (on ? '#ffe2a6' : mixColor(tf, '#000', 0.3)) : mixColor(tf, sky.top, 0.4));
          }
        }
        if (night > 0.2 && Math.floor(t * 1.4) % 2 === 0) rect(g, tx + 7, top - 11, 2, 1, '#ff5a52');
      }
    });

    // Улица: тротуар, дорога, фонари, машины.
    const road = mixColor('#5a5d66', '#15171f', night);
    rect(g, 0, STREET, CITY_W, 3, mixColor('#9a978f', '#2a2a33', night));
    rect(g, 0, STREET + 3, CITY_W, CITY_H - STREET - 3, road);
    for (let x = 0; x < CITY_W; x += 16) rect(g, x, STREET + 9, 7, 1, mixColor('#d8d2c0', '#6e6a5e', night));
    for (let x = 12; x < CITY_W; x += 48) {
      rect(g, x, STREET - 14, 1, 14, mixColor('#3b3d45', '#0c0d12', night));
      rect(g, x - 1, STREET - 15, 3, 1, mixColor('#3b3d45', '#0c0d12', night));
      if (night > 0.35) {
        g.globalAlpha = (night - 0.35) * 0.5;
        disc(g, x, STREET - 9, 7, '#ffcf87');
        g.globalAlpha = 1;
        rect(g, x - 1, STREET - 14, 3, 1, '#ffe7b8');
      }
    }
    for (const c of this.cars) {
      const x = ((((c.x + t * c.speed) % (CITY_W + 30)) + CITY_W + 30) % (CITY_W + 30)) - 15;
      const y = c.lane === 0 ? STREET + 10 : STREET + 6;
      const dir = c.speed > 0 ? 1 : -1;
      const body = mixColor(c.color, '#0d0f16', night * 0.55);
      rect(g, x, y, 12, 3, body);
      rect(g, x + (dir > 0 ? 3 : 2), y - 2, 6, 2, body);
      rect(g, x + (dir > 0 ? 4 : 3), y - 2, 2, 1, mixColor('#9fc2dd', '#1e2638', night));
      rect(g, x + 2, y + 3, 2, 1, '#111');
      rect(g, x + 8, y + 3, 2, 1, '#111');
      if (night > 0.35) {
        const front = dir > 0 ? x + 12 : x - 1;
        const back = dir > 0 ? x - 1 : x + 12;
        rect(g, front, y + 1, 1, 1, '#fff2c4');
        g.globalAlpha = 0.25;
        rect(g, dir > 0 ? front + 1 : front - 6, y + 1, 6, 1, '#ffe9b0');
        g.globalAlpha = 1;
        rect(g, back, y + 1, 1, 1, '#ff4b44');
      }
    }

    this.drawFrame(g);
  }

  /** Небо: полосы цвета с шахматным переходом. Пересчитываем, только когда цвет заметно сменился. */
  private drawSky(g: Ctx, top: string, bottom: string): void {
    const key = top + bottom;
    if (key !== this.skyKey) {
      this.skyKey = key;
      const c = this.skyCache.getContext('2d')!;
      const img = c.createImageData(CITY_W, CITY_H);
      const bands = 9;
      const shades = Array.from({ length: bands }, (_, i) => rgb(mixColor(top, bottom, i / (bands - 1))));
      for (let y = 0; y < CITY_H; y++) {
        const v = Math.min(0.999, y / HORIZON) * (bands - 1);
        const b = Math.floor(v);
        for (let x = 0; x < CITY_W; x++) {
          const step = v - b > BAYER4[(x % 4) + (y % 4) * 4]! ? 1 : 0;
          const [r, gg, bb] = shades[Math.min(bands - 1, b + step)]!;
          const i = (y * CITY_W + x) * 4;
          img.data[i] = r;
          img.data[i + 1] = gg;
          img.data[i + 2] = bb;
          img.data[i + 3] = 255;
        }
      }
      c.putImageData(img, 0, 0);
    }
    g.drawImage(this.skyCache, 0, 0);
  }

  /** Тонкая чёрная рама, как у окна в комнате, и дубовый подоконник. */
  private drawFrame(g: Ctx): void {
    const frame = '#17151a';
    const edge = '#2c2930';
    rect(g, 0, 0, CITY_W, 5, frame);
    rect(g, 0, CITY_H - 7, CITY_W, 7, frame);
    rect(g, 0, 0, 5, CITY_H, frame);
    rect(g, CITY_W - 5, 0, 5, CITY_H, frame);
    rect(g, CITY_W / 2 - 2, 0, 4, CITY_H, frame);
    rect(g, 5, 5, CITY_W - 10, 1, edge);
    rect(g, CITY_W / 2 - 2, 5, 1, CITY_H - 12, edge);
    // Подоконник из дуба.
    rect(g, 0, CITY_H - 7, CITY_W, 2, '#b98f62');
    rect(g, 0, CITY_H - 5, CITY_W, 5, '#8a6440');
  }
}
