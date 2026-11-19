// Город за окнами: небо, дальние и ближние дома, окна в домах. Панорама одна на всю стену,
// каждое окно показывает свой кусок — так вид за соседними окнами совпадает.
import { hash, make, type Spr } from './art';
import { css, type Daylight } from './daylight';

export const CITY_H = 30;

interface Building {
  x: number;
  w: number;
  h: number;
  near: boolean;
}

interface Light {
  x: number;
  y: number;
  warm: number;
  seed: number;
  far: boolean;
}

export class City {
  private readonly buildings: Building[] = [];
  private readonly lights: Light[] = [];
  private cache: { key: string; img: Spr } | null = null;
  private antenna = { x: 0, y: 0 };

  constructor(readonly width: number) {
    // Дальний ряд — высокие светлые силуэты, ближний — ниже и темнее.
    let x = -4;
    let n = 0;
    while (x < width) {
      const w = 7 + Math.floor(hash(n, 1) * 12);
      this.buildings.push({ x, w, h: 12 + Math.floor(hash(n, 2) * 16), near: false });
      x += w + Math.floor(hash(n, 3) * 3);
      n++;
    }
    x = -6;
    while (x < width) {
      const w = 9 + Math.floor(hash(n, 4) * 14);
      this.buildings.push({ x, w, h: 7 + Math.floor(hash(n, 5) * 13), near: true });
      x += w + 1 + Math.floor(hash(n, 6) * 4);
      n++;
    }
    const tallest = this.buildings.filter((b) => !b.near).reduce((a, b) => (b.h > a.h ? b : a));
    this.antenna = { x: tallest.x + Math.floor(tallest.w / 2), y: CITY_H - tallest.h - 3 };
    // Окна в домах: этажи и ряды. Свет горит «этажами» — так выглядят настоящие дома.
    let s = 0;
    this.buildings.forEach((b, bi) => {
      const sx = 3;
      const sy = b.near ? 3 : 2;
      const pad = b.near ? 2 : 1;
      for (let yy = CITY_H - b.h + 2; yy < CITY_H - 1; yy += sy) {
        const floorBias = hash(bi, yy, 21);
        for (let xx = b.x + pad; xx < b.x + b.w - 1; xx += sx) {
          if (xx < 0 || xx >= width) continue;
          s++;
          this.lights.push({ x: xx, y: yy, warm: hash(s, 7), seed: hash(s, 8) * 0.5 + floorBias * 0.5, far: !b.near });
        }
      }
    });
  }

  /** Неподвижная часть вида: небо, звёзды, силуэты. Пересчитывается раз в несколько игровых минут. */
  private base(day: Daylight): Spr {
    const key = [day.sky.top, day.sky.bottom, day.sky.near].map((c) => c.map(Math.round).join(',')).join('|');
    if (this.cache?.key === key) return this.cache.img;
    const { sky } = day;
    const img = make(this.width, CITY_H, (g) => {
      for (let y = 0; y < CITY_H; y++) {
        const t = y / (CITY_H - 1);
        g.r(0, y, this.width, 1, css([sky.top[0] + (sky.bottom[0] - sky.top[0]) * t, sky.top[1] + (sky.bottom[1] - sky.top[1]) * t, sky.top[2] + (sky.bottom[2] - sky.top[2]) * t]));
      }
      if (sky.stars > 0.05) {
        for (let i = 0; i < 70; i++) {
          const x = Math.floor(hash(i, 11) * this.width);
          const y = Math.floor(hash(i, 12) * 14);
          g.p(x, y, `rgba(220,226,255,${(0.25 + hash(i, 13) * 0.6) * sky.stars})`);
        }
        // луна
        g.c.globalAlpha = sky.stars;
        g.grid(258, 3, ['.mmm.', 'mmmms', 'mmmss', 'mmmms', '.mmm.'], { m: '#eef0f8', s: '#b9bfd6' });
        g.c.globalAlpha = 1;
      }
      for (const b of this.buildings) {
        const c = b.near ? sky.near : sky.far;
        g.r(b.x, CITY_H - b.h, b.w, b.h, css(c));
        // светлая грань — объём
        g.r(b.x, CITY_H - b.h, 1, b.h, css([c[0] * 1.12 + 6, c[1] * 1.12 + 6, c[2] * 1.12 + 8]));
        if (!b.near && b.h > 20) g.r(b.x + Math.floor(b.w / 2), CITY_H - b.h - 2, 1, 2, css(c));
      }
    });
    this.cache = { key, img };
    return img;
  }

  /** Рисует кусок панорамы [sx, sx+w) в прямоугольник окна. */
  draw(c: CanvasRenderingContext2D, day: Daylight, sx: number, dx: number, dy: number, w: number, h: number, time: number): void {
    c.drawImage(this.base(day), sx, CITY_H - h, w, h, dx, dy, w, h);
    const lit = day.sky.lit;
    if (lit > 0.01) {
      for (const l of this.lights) {
        if (l.x < sx || l.x >= sx + w) continue;
        const ly = l.y - (CITY_H - h);
        if (ly < 0) continue;
        // окна иногда гаснут и зажигаются
        const phase = Math.floor(time / 9 + l.seed * 40);
        const on = l.seed < lit * 1.3 && hash(Math.floor(l.seed * 9999), phase) > 0.12;
        if (!on) continue;
        if (l.far) c.fillStyle = l.warm > 0.3 ? '#b89a6a' : '#6f7fae';
        else c.fillStyle = l.warm > 0.25 ? (l.warm > 0.7 ? '#ffe2a0' : '#f7c36e') : '#a9c4ff';
        c.fillRect(dx + l.x - sx, dy + ly, 1, 1);
      }
      // красный огонёк на антенне
      if (Math.sin(time * 2.2) > 0.2 && this.antenna.x >= sx && this.antenna.x < sx + w) {
        const ay = this.antenna.y - (CITY_H - h);
        if (ay >= 0) {
          c.fillStyle = '#ff5a4e';
          c.fillRect(dx + this.antenna.x - sx, dy + ay, 1, 1);
        }
      }
    } else {
      // днём окна домов отражают небо
      c.fillStyle = 'rgba(255,255,255,0.18)';
      for (const l of this.lights) {
        if (l.x < sx || l.x >= sx + w || l.seed > 0.5) continue;
        const ly = l.y - (CITY_H - h);
        if (ly >= 0) c.fillRect(dx + l.x - sx, dy + ly, 1, 1);
      }
    }
  }
}
