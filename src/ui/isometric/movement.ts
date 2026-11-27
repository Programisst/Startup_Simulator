import { findPath, type Box } from '../apartment/engine/nav';
import type { Dir } from '../apartment/engine/scene';
import type { Point, Pose } from './raster';
import art from './coworking-art.json';
import { founderSeat } from './state';

const SCALE = 20;
const CHAIR_OUT = 7;
const SPEED = 40;
const makeBox = ([x0, x1, y0, y1]: number[]): Box => ({ x: x0!, y: y0!, w: x1! - x0!, h: y1! - y0! });
const bounds = makeBox([6, art.room[0]! - 3, 6, art.room[1]! - 3]);
const obstacles = [
  ...art.fixedObstacles.map(makeBox),
  ...art.desks.flatMap(([x, y]) => [
    makeBox([x!, x! + art.deskSize[0]!, y!, y! + art.deskSize[1]!]),
    makeBox([x! + art.seatOffset[0]! - 8, x! + art.seatOffset[0]! + 9, y! + 24, y! + 45]),
  ]),
];
const scaled = (b: Box): Box => ({ x: b.x / SCALE, y: b.y / SCALE, w: b.w / SCALE, h: b.h / SCALE });
const floor = (p: Point) => ({ x: p.x / SCALE, z: p.y / SCALE });
export function route(from: Point, to: Point): Point[] {
  return (findPath(floor(from), floor(to), obstacles.map(scaled), scaled(bounds), .25) ?? []).map(p => ({ x: p.x * SCALE, y: p.z * SCALE }));
}
export function seatPoint(seat: number): Point {
  const [x, y] = art.desks[seat]!;
  return { x: x! + art.seatOffset[0]!, y: y! + art.seatOffset[1]! };
}
export function entryPoint(seat: number): Point {
  const [x, y] = art.desks[seat]!;
  return { x: x! - 7, y: y! + 27 };
}
export const coffeePoint = { x: 34, y: 93 };
export const restPoint = { x: 32, y: 142 };
const still = (at: Point): Pose => ({ kind: 'stand', at, dir: 1, chair: CHAIR_OUT, sink: 0, stride: 0 });
function interpolate(a: Point, b: Point, t: number): Point {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}
export function seatTransition(seat: number, elapsed: number, entering: boolean): Pose {
  const t = Math.max(0, Math.min(1, entering ? elapsed / .95 : 1 - elapsed / .95));
  const home = seatPoint(seat), entry = entryPoint(seat);
  const gap = { x: home.x, y: home.y - 2 };
  if (t < .4) return { ...still(interpolate(entry, gap, t / .4)), kind: 'walk', dir: entering ? 0 : 2, stride: elapsed * SPEED };
  if (t < .7) return { ...still(gap), sink: Math.round((t - .4) / .3 * 6) };
  return { ...still(interpolate(gap, home, (t - .7) / .3)), kind: 'sit', chair: Math.round((1 - (t - .7) / .3) * CHAIR_OUT) };
}
export type Destination = 'computer' | 'coffee' | 'rest' | 'floor';
export class FounderMotion {
  pose: Pose;
  constructor(private readonly seat = founderSeat, seated = false) {
    this.pose = seated ? { ...still(seatPoint(seat)), kind: 'sit', chair: 0 } : still({ x: 114, y: 174 });
  }
  destination: Destination = 'floor';
  private points: Point[] = [];
  private transition: 'sit' | 'stand' | null = null;
  private elapsed = 0;
  private next: Point | null = null;
  get moving(): boolean { return this.transition !== null || this.points.length > 0; }

  go(target: Point, destination: Destination): void {
    this.destination = destination;
    if (this.pose.kind === 'sit' || this.transition === 'sit') {
      this.transition = 'stand';
      this.elapsed = 0;
      this.next = target;
      return;
    }
    if (this.transition === 'stand') { this.next = target; return; }
    this.points = route(this.pose.at, target);
  }

  step(dt: number): Destination | null {
    if (this.transition) {
      this.elapsed += dt;
      this.pose = seatTransition(this.seat, this.elapsed, this.transition === 'sit');
      if (this.elapsed < .95) return null;
      const entering = this.transition === 'sit';
      this.transition = null;
      if (entering) {
        this.pose = { ...still(seatPoint(this.seat)), kind: 'sit', chair: 0 };
        return 'computer';
      }
      this.pose = still(entryPoint(this.seat));
      if (this.next) { this.points = route(this.pose.at, this.next); this.next = null; }
    }
    let distance = dt * SPEED;
    while (this.points.length && distance > 0) {
      const target = this.points[0]!;
      const dx = target.x - this.pose.at.x, dy = target.y - this.pose.at.y;
      const length = Math.hypot(dx, dy);
      const step = Math.min(distance, length);
      const at = interpolate(this.pose.at, target, length ? step / length : 1);
      const screenX = dx - dy, screenY = (dx + dy) / 2;
      const dir: Dir = Math.abs(screenX) > Math.abs(screenY) * .7 ? (screenX > 0 ? 0 : 2) : (screenY < 0 ? 1 : 3);
      this.pose = { ...this.pose, at, dir, kind: 'walk', stride: this.pose.stride + step };
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
