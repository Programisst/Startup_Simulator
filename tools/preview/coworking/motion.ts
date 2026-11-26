import { findPath, type Box } from '../../../src/ui/apartment/engine/nav';
import type { Dir } from '../../../src/ui/apartment/engine/scene';
import art from './coworking-art.json';

export interface Point { x: number; y: number }
export interface WalkPlan {
  home: Point;
  rise: Point;
  entry: Point;
  path: Point[];
  distances: number[];
  start: number;
  travel: number;
  end: number;
}
interface Pose {
  kind: 'sit' | 'stand' | 'walk';
  at: Point;
  dir: Dir;
  chair: number;
  sink: number;
  stride: number;
}

export const layout = art;
const SPEED = 45;
const STEP_ASIDE = .46;
const CHAIR_TIME = .32;
const RISE_TIME = .39;
const STOP_TIME = 1.6;
const CHAIR_OUT = 7;
const FOOT = 5;
const PATH_SCALE = 20;

const box = ([x1, x2, y1, y2]: number[]): Box => ({ x: x1!, y: y1!, w: x2! - x1!, h: y2! - y1! });
const bounds = box([6, art.room[0]! - 2, 6, art.room[1]! - 2]);
const obstacles = [
  ...art.fixedObstacles.map(box),
  ...art.desks.flatMap(([x, y]) => [
    box([x!, x! + art.deskSize[0]!, y!, y! + art.deskSize[1]!]),
    box([x! + art.seatOffset[0]! - 8, x! + art.seatOffset[0]! + 9, y! + 24, y! + 45]),
  ]),
];

function outsideFurniture(p: Point): boolean {
  const half = FOOT / 2;
  return obstacles.every(b => p.x + half <= b.x || p.x - half >= b.x + b.w || p.y + half <= b.y || p.y - half >= b.y + b.h);
}

function between(a: Point, b: Point, amount: number): Point {
  return { x: a.x + (b.x - a.x) * amount, y: a.y + (b.y - a.y) * amount };
}

export function pathIsClear(path: Point[]): boolean {
  return path.every((point, i) => {
    const previous = path[i - 1];
    if (!previous) return outsideFurniture(point);
    const samples = Math.max(1, Math.ceil(Math.hypot(point.x - previous.x, point.y - previous.y) * 2));
    for (let j = 1; j <= samples; j++) if (!outsideFurniture(between(previous, point, j / samples))) return false;
    return true;
  });
}

const scaled = (b: Box): Box => ({ x: b.x / PATH_SCALE, y: b.y / PATH_SCALE, w: b.w / PATH_SCALE, h: b.h / PATH_SCALE });
const floorPoint = (p: Point) => ({ x: p.x / PATH_SCALE, z: p.y / PATH_SCALE });

export function motionFor(seat: number): WalkPlan {
  const desk = art.desks[seat];
  if (!desk) throw new Error('Unknown coworking seat: ' + seat);
  const [x, y] = desk as [number, number];
  const home = { x: x + art.seatOffset[0]!, y: y + art.seatOffset[1]! };
  const rise = { x: home.x, y: y + 27 };
  const entry = { x: x - 7, y: rise.y };
  const target = seat < 3 ? { x: 35, y: 93 } : { x: 32, y: 141 };
  const route = findPath(floorPoint(entry), floorPoint(target), obstacles.map(scaled), scaled(bounds), FOOT / PATH_SCALE);
  const path = [entry, ...(route ?? []).map(p => ({ x: p.x * PATH_SCALE, y: p.z * PATH_SCALE }))];
  if (!route || !pathIsClear(path)) throw new Error('No clear route from coworking seat ' + seat);
  const distances = [0];
  for (let i = 1; i < path.length; i++) {
    distances.push(distances[i - 1]! + Math.hypot(path[i]!.x - path[i - 1]!.x, path[i]!.y - path[i - 1]!.y));
  }
  const start = 2.3 + seat * 15;
  const travel = distances.at(-1)! / SPEED;
  const end = start + 2 * (CHAIR_TIME + RISE_TIME + STEP_ASIDE + travel) + STOP_TIME;
  return { home, rise, entry, path, distances, start, travel, end };
}

function direction(a: Point, b: Point): Dir {
  const sx = b.x - a.x - (b.y - a.y);
  const sy = (b.x - a.x + b.y - a.y) / 2;
  if (Math.abs(sx) > Math.abs(sy) * .7) return sx > 0 ? 0 : 2;
  return sy < 0 ? 1 : 3;
}

function walk(a: Point, b: Point, progress: number, stride: number, returning: boolean): Pose {
  return {
    kind: 'walk', at: between(a, b, progress), dir: returning ? direction(b, a) : direction(a, b),
    chair: CHAIR_OUT, sink: 0, stride,
  };
}

function outward(plan: WalkPlan, elapsed: number, returning: boolean): Pose {
  const behind = { x: plan.home.x, y: plan.home.y + CHAIR_OUT / 2 };
  if (elapsed <= CHAIR_TIME) {
    const progress = elapsed / CHAIR_TIME;
    return { kind: 'sit', at: between(plan.home, behind, progress), dir: 0, chair: Math.round(progress * CHAIR_OUT), sink: 0, stride: 0 };
  }
  elapsed -= CHAIR_TIME;
  if (elapsed < RISE_TIME) {
    const progress = elapsed / RISE_TIME;
    return { kind: 'stand', at: between(behind, plan.rise, progress), dir: 0, chair: CHAIR_OUT, sink: Math.round((1 - progress) * 6), stride: 0 };
  }
  elapsed -= RISE_TIME;
  if (elapsed < STEP_ASIDE) return walk(plan.rise, plan.entry, elapsed / STEP_ASIDE, elapsed * SPEED, returning);
  const distance = Math.min((elapsed - STEP_ASIDE) * SPEED, plan.distances.at(-1)!);
  let segment = 1;
  while (segment < plan.path.length - 1 && plan.distances[segment]! < distance) segment++;
  const start = plan.distances[segment - 1]!;
  const length = Math.max(.01, plan.distances[segment]! - start);
  return walk(plan.path[segment - 1]!, plan.path[segment]!, (distance - start) / length, distance, returning);
}

export function poseAt(plan: WalkPlan, time: number): Pose {
  const elapsed = time - plan.start;
  if (elapsed <= 0 || time >= plan.end) {
    return { kind: 'sit', at: plan.home, dir: 0, chair: 0, sink: 0, stride: 0 };
  }
  const outwardTime = CHAIR_TIME + RISE_TIME + STEP_ASIDE + plan.travel;
  if (elapsed < outwardTime) return outward(plan, elapsed, false);
  if (elapsed < outwardTime + STOP_TIME) {
    return { kind: 'stand', at: plan.path.at(-1)!, dir: 2, chair: CHAIR_OUT, sink: 0, stride: 0 };
  }
  return outward(plan, Math.max(0, plan.end - time), true);
}
