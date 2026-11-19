// Сцена квартиры: где основатель, чем занят, который час, что светится. Обновляется каждый кадр.
import {
  buildProps,
  drawBlanket,
  drawChairBack,
  drawFloor,
  drawSunbeam,
  drawWalls,
  FLOOR,
  INTERACTABLES,
  lightsFor,
  ROOM_H,
  ROOM_W,
  SEAT,
  SOLIDS,
  STAND_UP_SPOT,
  WAKE_SPOT,
  type Interactable,
  type RoomState,
} from './apartment';
import { drawFounder, drawFounderSitting, drawFounderSleeping, type Facing } from './founder';
import { moveWithCollision, overlaps } from './physics';
import { rect, type Ctx } from './pixels';
import { skyAt } from './sky';

export type FounderMode = 'walk' | 'sitting' | 'sleeping' | 'brewing';

const FOOT = { w: 10, h: 4 };
const SPEED = 54; // пикселей комнаты в секунду
/** Сколько игровых минут проходит за одну настоящую секунду. */
const MINUTES_PER_SECOND = 1;

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  color: string;
  kind: 'dot' | 'z';
}

export class Scene {
  pos = { x: 140, y: 120 };
  facing: Facing = 'down';
  mode: FounderMode = 'walk';
  minutes = 7 * 60 + 40;
  day = 1;
  t = 0;

  private moving = false;
  private stepTime = 0;
  private blinkTimer = 2.5;
  private blinking = 0;
  private particles: Particle[] = [];
  private spawn = { mug: 0, dust: 0, brew: 0, z: 0 };
  private brewLeft = 0;
  private velocity = { x: 0, y: 0 };

  /** Вызывается, когда кофе готов. */
  onCoffeeReady: (() => void) | null = null;

  get feet() {
    return { x: this.pos.x, y: this.pos.y, ...FOOT };
  }

  nearby(): Interactable | null {
    if (this.mode !== 'walk') return null;
    return INTERACTABLES.find((it) => overlaps(this.feet, it.zone)) ?? null;
  }

  update(dt: number, input: { x: number; y: number }): void {
    this.t += dt;
    this.minutes += dt * MINUTES_PER_SECOND;
    if (this.minutes >= 1440) {
      this.minutes -= 1440;
      this.day += 1;
    }

    // Моргание раз в несколько секунд.
    this.blinkTimer -= dt;
    if (this.blinkTimer <= 0) {
      this.blinking = 0.13;
      this.blinkTimer = 2.2 + Math.random() * 3.5;
    }
    this.blinking = Math.max(0, this.blinking - dt);

    if (this.mode === 'walk') this.walk(dt, input);
    if (this.mode === 'brewing') {
      this.brewLeft -= dt;
      if (this.brewLeft <= 0) {
        this.mode = 'walk';
        this.onCoffeeReady?.();
      }
    }
    this.updateParticles(dt);
  }

  private walk(dt: number, input: { x: number; y: number }): void {
    const len = Math.hypot(input.x, input.y);
    const want = len > 0 ? { x: (input.x / len) * SPEED, y: (input.y / len) * SPEED } : { x: 0, y: 0 };
    // Плавный разгон и остановка — без рывков.
    const k = 1 - Math.exp(-dt * 18);
    this.velocity.x += (want.x - this.velocity.x) * k;
    this.velocity.y += (want.y - this.velocity.y) * k;
    if (len === 0 && Math.hypot(this.velocity.x, this.velocity.y) < 4) this.velocity = { x: 0, y: 0 };

    this.moving = Math.hypot(this.velocity.x, this.velocity.y) > 6;
    if (len > 0) {
      if (Math.abs(input.x) > Math.abs(input.y)) this.facing = input.x > 0 ? 'right' : 'left';
      else this.facing = input.y > 0 ? 'down' : 'up';
    }
    this.pos = moveWithCollision(this.pos, this.velocity.x * dt, this.velocity.y * dt, FOOT, SOLIDS, FLOOR);
    this.stepTime = this.moving ? this.stepTime + dt : 0;
  }

  sit(): void {
    this.mode = 'sitting';
    this.facing = 'up';
    this.velocity = { x: 0, y: 0 };
  }

  stand(): void {
    this.mode = 'walk';
    this.pos = { ...STAND_UP_SPOT };
    this.facing = 'down';
  }

  sleep(): void {
    this.mode = 'sleeping';
    this.velocity = { x: 0, y: 0 };
  }

  /** Проснуться утром: если уже за полночь — сегодня, иначе — завтра. */
  wakeUp(): void {
    const morning = 7 * 60 + 30;
    if (this.minutes > morning) this.day += 1;
    this.minutes = morning;
    this.mode = 'walk';
    this.pos = { ...WAKE_SPOT };
    this.facing = 'down';
  }

  brew(): void {
    this.mode = 'brewing';
    this.facing = 'right';
    this.brewLeft = 2.8;
    this.velocity = { x: 0, y: 0 };
  }

  // ——— Частицы: пар, пылинки, «Z-z-z» ———

  private updateParticles(dt: number): void {
    const sky = skyAt(this.minutes);
    this.spawn.mug -= dt;
    if (this.spawn.mug <= 0) {
      this.spawn.mug = 0.45;
      this.particles.push({ x: 255.5 + Math.random(), y: 35, vx: (Math.random() - 0.5) * 2, vy: -5, life: 1.6, max: 1.6, color: '#ffffff', kind: 'dot' });
    }
    if (sky.sun > 0.3) {
      this.spawn.dust -= dt;
      if (this.spawn.dust <= 0) {
        this.spawn.dust = 0.25;
        const v = Math.random();
        this.particles.push({ x: 114 + v * 40 + Math.random() * 18, y: 44 + v * 44, vx: (Math.random() - 0.3) * 2, vy: (Math.random() - 0.6) * 1.5, life: 4, max: 4, color: '#fff3cf', kind: 'dot' });
      }
    }
    if (this.mode === 'brewing') {
      this.spawn.brew -= dt;
      if (this.spawn.brew <= 0) {
        this.spawn.brew = 0.08;
        this.particles.push({ x: 248 + Math.random() * 3, y: 111, vx: (Math.random() - 0.5) * 4, vy: -9 - Math.random() * 4, life: 1.1, max: 1.1, color: '#ffffff', kind: 'dot' });
      }
    }
    if (this.mode === 'sleeping') {
      this.spawn.z -= dt;
      if (this.spawn.z <= 0) {
        this.spawn.z = 1.1;
        this.particles.push({ x: 40, y: 40, vx: 3, vy: -6, life: 2.4, max: 2.4, color: '#e9eefc', kind: 'z' });
      }
    }
    for (const p of this.particles) {
      p.life -= dt;
      p.x += p.vx * dt + Math.sin((this.t + p.max) * 2.4) * 0.04;
      p.y += p.vy * dt;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
  }

  private drawParticles(g: Ctx): void {
    for (const p of this.particles) {
      const a = Math.min(1, p.life / p.max) * (p.kind === 'dot' ? 0.55 : 0.9);
      g.globalAlpha = a;
      if (p.kind === 'z') {
        const x = Math.round(p.x);
        const y = Math.round(p.y);
        rect(g, x, y, 4, 1, p.color);
        rect(g, x + 2, y + 1, 1, 1, p.color);
        rect(g, x + 1, y + 2, 1, 1, p.color);
        rect(g, x, y + 3, 4, 1, p.color);
      } else rect(g, p.x, p.y, 1, 1, p.color);
    }
    g.globalAlpha = 1;
  }

  // ——— Рисование кадра ———

  roomState(): RoomState {
    const sky = skyAt(this.minutes);
    return {
      t: this.t,
      sky,
      lampsOn: sky.darkness > 0.22,
      screen: this.mode === 'sitting' ? 'work' : this.mode === 'sleeping' ? 'off' : 'idle',
      brewing: this.mode === 'brewing',
      minutes: this.minutes,
    };
  }

  render(g: Ctx, light: CanvasRenderingContext2D): void {
    const s = this.roomState();
    g.clearRect(0, 0, ROOM_W, ROOM_H);
    drawFloor(g);
    drawWalls(g, s);
    drawSunbeam(g, s.sky.sun);

    const sitting = this.mode === 'sitting';
    const items = buildProps(sitting).map((p) => ({ sortY: p.sortY, draw: p.draw }));
    const bed = items.find((p) => p.sortY === 102);
    if (bed) {
      const base = bed.draw;
      bed.draw = (ctx, st) => {
        base(ctx, st);
        if (this.mode === 'sleeping') drawFounderSleeping(ctx, 24, 41);
        drawBlanket(ctx, this.mode === 'sleeping');
      };
    }
    const chair = items.find((p) => p.sortY === 72);
    if (chair && sitting) {
      const base = chair.draw;
      chair.draw = (ctx, st) => {
        base(ctx, st);
        drawFounderSitting(ctx, SEAT.x, SEAT.y, true, this.t);
        drawChairBack(ctx);
      };
    }
    if (this.mode === 'walk' || this.mode === 'brewing') {
      const step = this.moving ? Math.floor(this.stepTime * 8) : null;
      const bob = step !== null && step % 2 === 1 ? -1 : 0;
      const x = this.pos.x - 3;
      const y = this.pos.y - 18;
      items.push({
        sortY: this.pos.y + FOOT.h,
        draw: (ctx) => drawFounder(ctx, x, y, { facing: this.facing, step, blink: this.blinking > 0, bob }),
      });
    }
    items.sort((a, b) => a.sortY - b.sortY);
    for (const it of items) it.draw(g, s);

    this.drawParticles(g);
    this.drawLighting(g, light, s);
  }

  private drawLighting(g: Ctx, light: CanvasRenderingContext2D, s: RoomState): void {
    const lights = lightsFor(s);
    const dark = s.sky.darkness * 0.86;
    if (dark > 0.01) {
      light.globalCompositeOperation = 'source-over';
      light.clearRect(0, 0, ROOM_W, ROOM_H);
      light.fillStyle = `rgba(16, 12, 40, ${dark})`;
      light.fillRect(0, 0, ROOM_W, ROOM_H);
      light.globalCompositeOperation = 'destination-out';
      for (const l of lights) {
        const grad = light.createRadialGradient(l.x, l.y, 0, l.x, l.y, l.radius);
        grad.addColorStop(0, `rgba(0,0,0,${l.power})`);
        grad.addColorStop(0.55, `rgba(0,0,0,${l.power * 0.55})`);
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        light.fillStyle = grad;
        light.fillRect(l.x - l.radius, l.y - l.radius, l.radius * 2, l.radius * 2);
      }
      g.drawImage(light.canvas, 0, 0);
    }
    // Тёплое свечение ламп поверх — как в настоящей комнате вечером.
    g.save();
    g.globalCompositeOperation = 'lighter';
    for (const l of lights) {
      const a = 0.05 + 0.13 * s.sky.darkness;
      const grad = g.createRadialGradient(l.x, l.y, 0, l.x, l.y, l.radius * 0.8);
      grad.addColorStop(0, hexA(l.color, a * l.power));
      grad.addColorStop(1, hexA(l.color, 0));
      g.fillStyle = grad;
      g.fillRect(l.x - l.radius, l.y - l.radius, l.radius * 2, l.radius * 2);
    }
    g.restore();
  }
}

function hexA(color: string, alpha: number): string {
  const n = parseInt(color.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}
