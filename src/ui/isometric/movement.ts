import { findPath, type Box } from '../apartment/engine/nav';
import type { Dir } from '../apartment/engine/scene';
import type { HomeAction } from './layout';
import type { Point, Pose, RoomArt } from './raster';

const SCALE = 20;
const CHAIR_OUT = 7;
const SPEED = 40;
const SEAT_DURATION = .95;
const makeBox = ([x0, x1, y0, y1]: number[]): Box =>
  ({ x: x0! / SCALE, y: y0! / SCALE, w: (x1! - x0!) / SCALE, h: (y1! - y0!) / SCALE });
const floor = (p: Point) => ({ x: p.x / SCALE, z: p.y / SCALE });

export class OfficeNavigation {
  private readonly bounds: Box;
  private readonly obstacles: Box[];

  constructor(private readonly art: RoomArt) {
    this.bounds = makeBox([6, art.room[0]! - 3, 6, art.room[1]! - 3]);
    this.obstacles = [
      ...art.fixedObstacles,
      ...art.desks.flatMap(([x, y]) => [
        [x!, x! + art.deskSize[0]!, y!, y! + art.deskSize[1]!],
        [x! + art.seatOffset[0]! - 8, x! + art.seatOffset[0]! + 9, y! + 24, y! + 45],
      ]),
    ].map(makeBox);
  }

  route(from: Point, to: Point): Point[] {
    return (findPath(floor(from), floor(to), this.obstacles, this.bounds, .25) ?? [])
      .map(p => ({ x: p.x * SCALE, y: p.z * SCALE }));
  }

  canWalk({ x, y }: Point): boolean {
    const foot = .135;
    const at = { x: x / SCALE, y: y / SCALE };
    const { bounds } = this;
    return at.x >= bounds.x + foot && at.x <= bounds.x + bounds.w - foot
      && at.y >= bounds.y + foot && at.y <= bounds.y + bounds.h - foot
      && !this.obstacles.some(box => at.x + foot > box.x && at.x - foot < box.x + box.w
        && at.y + foot > box.y && at.y - foot < box.y + box.h);
  }

  seatPoint(seat: number): Point {
    const [x, y] = this.art.desks[seat]!;
    return { x: x! + this.art.seatOffset[0]!, y: y! + this.art.seatOffset[1]! };
  }

  entryPoint(seat: number): Point {
    const [x, y] = this.art.desks[seat]!;
    return { x: x! - 7, y: y! + this.art.seatOffset[1]! - 2 };
  }
}

const still = (at: Point): Pose => ({ kind: 'stand', at, dir: 1, chair: CHAIR_OUT, sink: 0, stride: 0 });

function interpolate(a: Point, b: Point, t: number): Point {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

function walkingDirection(dx: number, dy: number): Dir {
  const screenX = dx - dy, screenY = (dx + dy) / 2;
  return Math.abs(screenX) > Math.abs(screenY) * .7 ? (screenX > 0 ? 0 : 2) : (screenY < 0 ? 1 : 3);
}

export type Destination = 'computer' | 'coffee' | 'rest' | 'floor' | HomeAction;

export class OfficeMotion {
  pose: Pose;
  private steering = false;
  private destination: Destination = 'floor';
  private points: Point[] = [];
  private transition: 'sit' | 'stand' | null = null;
  private elapsed = 0;
  private next: Point | null = null;

  constructor(private readonly nav: OfficeNavigation, private readonly seat: number, start?: Point) {
    this.pose = start ? still(start) : { ...still(nav.seatPoint(seat)), kind: 'sit', chair: 0 };
  }

  get moving(): boolean { return this.transition !== null || this.points.length > 0; }

  go(target: Point, destination: Destination): void {
    this.destination = destination;
    this.steering = false;
    if (this.transition === 'sit' && destination === 'computer') return;
    if (this.transition === 'stand' && destination === 'computer') {
      this.transition = 'sit';
      this.elapsed = SEAT_DURATION - this.elapsed;
      this.next = null;
      return;
    }
    if (this.transition === 'sit' || (!this.transition && this.pose.kind === 'sit')) {
      this.elapsed = this.transition ? SEAT_DURATION - this.elapsed : 0;
      this.transition = 'stand';
    }
    if (this.transition === 'stand') {
      this.next = target;
      return;
    }
    this.points = this.nav.route(this.pose.at, target);
  }

  steer(horizontal: number, vertical: number, dt: number): void {
    if (this.pose.kind === 'sit' || this.transition) {
      this.go(this.nav.entryPoint(this.seat), 'floor');
      this.step(dt);
      return;
    }
    this.steering = true;
    this.points = [];
    const x = vertical + horizontal / 2;
    const y = vertical - horizontal / 2;
    const scale = dt * SPEED / Math.hypot(x, y);
    const at = this.pose.at;
    const target = { x: at.x + x * scale, y: at.y + y * scale };
    const next = [target, { x: target.x, y: at.y }, { x: at.x, y: target.y }].find(p => this.nav.canWalk(p));
    if (next) {
      const distance = Math.hypot(next.x - at.x, next.y - at.y);
      this.pose = { ...this.pose, at: next, dir: walkingDirection(x, y), kind: distance > 0 ? 'walk' : 'stand', stride: this.pose.stride + distance };
    } else {
      this.pose = { ...this.pose, kind: 'stand', dir: walkingDirection(x, y) };
    }
  }

  stopSteering(): void {
    if (!this.steering) return;
    this.steering = false;
    this.pose = { ...this.pose, kind: 'stand' };
  }

  private seatTransition(entering: boolean): Pose {
    const progress = this.elapsed / SEAT_DURATION;
    const t = Math.max(0, Math.min(1, entering ? progress : 1 - progress));
    const home = this.nav.seatPoint(this.seat);
    const entry = this.nav.entryPoint(this.seat);
    // Walk into the gap in front of the pulled-out chair before moving onto the seat.
    const gap = { x: home.x, y: entry.y };
    if (t < .4) return { ...still(interpolate(entry, gap, t / .4)), kind: 'walk', dir: entering ? 0 : 2, stride: t * SEAT_DURATION * SPEED };
    if (t < .7) return { ...still(gap), sink: Math.round((t - .4) / .3 * 6) };
    return { ...still(interpolate(gap, home, (t - .7) / .3)), kind: 'sit', chair: Math.round((1 - (t - .7) / .3) * CHAIR_OUT) };
  }

  step(dt: number): Destination | null {
    if (dt <= 0) return null;
    if (this.transition) {
      this.elapsed += dt;
      const entering = this.transition === 'sit';
      this.pose = this.seatTransition(entering);
      if (this.elapsed < SEAT_DURATION) return null;
      this.transition = null;
      if (entering) {
        this.pose = { ...still(this.nav.seatPoint(this.seat)), kind: 'sit', chair: 0 };
        return 'computer';
      }
      this.pose = still(this.nav.entryPoint(this.seat));
      if (this.next) {
        this.points = this.nav.route(this.pose.at, this.next);
        this.next = null;
      }
    }
    let distance = dt * SPEED;
    while (this.points.length && distance > 0) {
      const target = this.points[0]!;
      const dx = target.x - this.pose.at.x, dy = target.y - this.pose.at.y;
      const length = Math.hypot(dx, dy);
      const step = Math.min(distance, length);
      const at = interpolate(this.pose.at, target, length ? step / length : 1);
      this.pose = { ...this.pose, at, dir: walkingDirection(dx, dy), kind: 'walk', stride: this.pose.stride + step };
      distance -= step;
      if (step < length) break;
      this.points.shift();
      if (!this.points.length) {
        this.pose.kind = 'stand';
        if (this.destination === 'computer') { this.transition = 'sit'; this.elapsed = 0; return null; }
        return this.destination;
      }
    }
    return null;
  }
}
