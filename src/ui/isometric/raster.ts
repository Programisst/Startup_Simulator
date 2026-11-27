import type { ScenePerson } from '../../core';
import { drawEditorScreen } from '../apartment/engine/editorScreen';
import { heroFrames, HERO_PALETTE } from '../apartment/engine/heroPixels';
import { MonitorTyping } from '../apartment/engine/monitor';
import type { Dir } from '../apartment/engine/scene';
export interface Point { x: number; y: number }
export interface Pose {
  kind: 'sit' | 'stand' | 'walk'; at: Point; dir: Dir; chair: number; sink: number; stride: number;
}
export interface RoomArt {
  width: number; height: number; origin: number[]; room: number[]; desks: number[][];
  seatOffset: number[]; monitor: number[]; deskSize: number[]; fixedObstacles: number[][];
  chair: { width: number; height: number; origin: number[] };
}
export type VisiblePerson = Pick<ScenePerson, 'id' | 'nameSeed' | 'seat' | 'busy' | 'mood' | 'leaving' | 'star'>;
export const projectPoint = (layout: RoomArt, { x, y }: Point, z = 0): Point =>
  ({ x: layout.origin[0]! + x - y, y: layout.origin[1]! + (x + y) / 2 - z });

const frames = heroFrames();
const rgb = (hex: string) => Number.parseInt(hex.slice(1), 16);

const colors = [
  { H: '#997864', h: '#62483b', d: '#3c2e33', s: '#f0c7a7', S: '#ba8875', w: '#e8dec9', W: '#bcb099' },
  { H: '#826879', h: '#4f3e57', d: '#362e44', s: '#cc9e85', S: '#a56e5d', w: '#b2b493', W: '#82876c' },
  { H: '#b28067', h: '#755143', d: '#55383a', s: '#edb797', S: '#bb826e', w: '#c88d7c', W: '#97695f' },
  { H: '#6b7889', h: '#454f60', d: '#323849', s: '#bd907b', S: '#926258', w: '#93a9ae', W: '#637f88' },
];
const seated = [
  '......ooooooo......',
  '....ooHHHHhhhoo....',
  '...oHHHhhhhhhhho...',
  '..oHHhhhhhhhhhhho..',
  '..oHhhhhhhhhhdhho..',
  '..ohhhhhhhhhdsSso..',
  '...ohhhhhhhhdSSso..',
  '...odhhhhhhddSso...',
  '....oddddddSSo.....',
  '.....oooSSSoo......',
  '.......oSSo........',
  '.....ooWWwwWoo.....',
  '....oWWwwwwwwWoo...',
  '...oWWwwwwwwwwWSo..',
  '...oWWwwwwwwwwWSSo.',
  '...oWWWWwwwwWWoSSo.',
  '....oWWWWWWWWo.oo..',
  '.....oWWWWWWo......',
  '......oooooo.......',
];
const seatedTyping = seated.map((row, i) => i === 15 ? row.replace('oSSo', 'SSo.') : row);
const MOOD = {
  high: ['#3e6f60', [' x x ', '     ', 'x   x', ' xxx ']],
  mid: ['#756957', [' x x ', '     ', ' xxx ', '     ']],
  low: ['#984d42', [' x x ', '     ', ' xxx ', 'x   x']],
} as const;
const BUSY = ['#276273', ['     ', 'xxxxx', 'x x x', 'xxxxx']] as const;
const LEAVING = ['#a64438', ['  x  ', '  x  ', '     ', '  x  ']] as const;
const STAR = ['#906025', ['  x  ', 'xxxxx', ' xxx ', ' x x ']] as const;

export interface Worker {
  person: VisiblePerson;
  palette: Record<string, number>;
  monitor: MonitorTyping;
}

export function makeWorker(person: VisiblePerson, offset: number): Worker {
  const palette = Object.fromEntries(Object.entries({ ...HERO_PALETTE, ...colors[person.nameSeed % colors.length] }).map(([key, value]) => [key, rgb(value)]));
  const monitor = new MonitorTyping();
  monitor.advance(offset * 3.2);
  return { person, palette, monitor };
}

function readDepth(pixels: ImageData): Float32Array {
  return Float32Array.from({ length: pixels.width * pixels.height }, (_, i) => {
    const p = i * 4;
    const packed = pixels.data[p]! + pixels.data[p + 1]! * 256;
    return packed ? packed / 64 - 64 : -Infinity;
  });
}

interface MonitorFace {
  origin: Point;
  visible: { x: number; y: number; z: number }[];
  monitor: MonitorTyping;
}

export async function createRoom(canvas: HTMLCanvasElement, screenDetails: HTMLCanvasElement, layout: RoomArt, atlasUrl: string) {
  const { width, height } = layout;
  const CHAIR_EDGE = layout.chair;
  const oy = layout.origin[1]!;
  const project = (point: Point, z = 0) => projectPoint(layout, point, z);
  const atlas = new Image();
  atlas.src = atlasUrl;
  await atlas.decode();
  const texture = document.createElement('canvas');
  texture.width = atlas.naturalWidth;
  texture.height = atlas.naturalHeight;
  const source = texture.getContext('2d', { willReadFrequently: true })!;
  source.drawImage(atlas, 0, 0);
  const base = source.getImageData(0, 0, width, height);
  const baseDepth = readDepth(source.getImageData(0, height, width, height));
  const chair = source.getImageData(width, 0, CHAIR_EDGE.width, CHAIR_EDGE.height);
  const chairDepth = readDepth(source.getImageData(width, height, CHAIR_EDGE.width, CHAIR_EDGE.height));
  const ctx = canvas.getContext('2d', { alpha: false })!;
  const detailScale = 4;
  screenDetails.width = width * detailScale;
  screenDetails.height = height * detailScale;
  const detail = screenDetails.getContext('2d')!;
  detail.scale(detailScale, detailScale);
  const frame = ctx.createImageData(width, height);
  const depth = new Float32Array(baseDepth.length);

  function pixel(x: number, y: number, z: number, color: number) {
    if (x < 0 || x >= width || y < 0 || y >= height) return;
    const i = y * width + x;
    if (z <= depth[i]!) return;
    depth[i] = z;
    const o = i * 4;
    frame.data[o] = color >> 16;
    frame.data[o + 1] = (color >> 8) & 255;
    frame.data[o + 2] = color & 255;
  }

  function drawChair(at: Point) {
    const p = project(at);
    const x0 = Math.floor(p.x) - CHAIR_EDGE.origin[0]!;
    const y0 = Math.floor(p.y) - CHAIR_EDGE.origin[1]!;
    const sum = at.x + at.y;
    for (let y = 0; y < chair.height; y++) {
      for (let x = 0; x < chair.width; x++) {
        const i = y * chair.width + x;
        const z = chairDepth[i]!;
        if (!Number.isFinite(z)) continue;
        const p = i * 4;
        const color = (chair.data[p]! << 16) + (chair.data[p + 1]! << 8) + chair.data[p + 2]!;
        pixel(x0 + x, y0 + y, sum + z, color);
      }
    }
  }

  function drawShadow(at: Point) {
    const p = project(at);
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -6; dx <= 6; dx++) {
        const d = (dx / 6) ** 2 + (dy / 2.5) ** 2;
        if (d > 1) continue;
        const x = Math.floor(p.x) + dx;
        const y = Math.floor(p.y) + dy;
        const i = y * width + x;
        const groundDepth = (y - oy) * 2;
        if (depth[i]! > groundDepth + 2) continue;
        const k = (d < .5 ? .83 : .92);
        for (let c = 0; c < 3; c++) frame.data[i * 4 + c] = frame.data[i * 4 + c]! * k;
      }
    }
  }

  function paintPerson(worker: Worker, pose: Pose, time: number) {
    const { kind, at, dir, sink, stride } = pose;
    const p = project(at);
    const z = at.x + at.y;
    const stepping = kind === 'walk';
    const working = kind === 'sit' && worker.person.busy;
    const typing = working && Math.floor(time * 7 + worker.person.id) % 3 === 1;
    const rows = kind === 'sit' ? (typing ? seatedTyping : seated)
      : stepping ? frames.walk[dir]![Math.floor(stride / 3.3) % 4]!
      : frames.idle[dir]![0]!;
    if (kind !== 'sit') drawShadow(at);
    const head = kind === 'sit' ? 30 : 30 - sink;
    const x0 = Math.floor(p.x) - Math.floor(rows[0]!.length / 2);
    rows.forEach((row, r) => {
      const top = kind === 'sit' ? r - head : Math.round((r - 31) * 1.25) + sink;
      const next = kind === 'sit' ? top + 1 : Math.round((r - 30) * 1.25) + sink;
      for (let i = 0; i < row.length; i++) {
        const color = worker.palette[row[i]!];
        if (color === undefined) continue;
        for (let dy = top; dy < next; dy++) pixel(x0 + i, Math.floor(p.y) + dy, z - dy, color);
      }
    });
    return { x: p.x, y: p.y - head - 5 };
  }

  function paintStatus(worker: Worker, at: Point) {
    const person = worker.person;
    const icons = [MOOD[person.mood], ...(person.busy ? [BUSY] : []), ...(person.leaving ? [LEAVING] : []), ...(person.star ? [STAR] : [])];
    const full = 7 * icons.length;
    const x = Math.round(at.x - full / 2);
    const y = Math.round(at.y - 5);
    detail.fillStyle = '#363d3e';
    detail.fillRect(x - 1, y, full + 2, 7);
    detail.fillStyle = '#f2e7cc';
    detail.fillRect(x, y + 1, full, 5);
    icons.forEach(([tone, glyph], j) => {
      detail.fillStyle = tone;
      glyph.forEach((row, v) => {
        for (let u = 0; u < row.length; u++) if (row[u] === 'x') detail.fillRect(x + j * 7 + u + 1, y + v + 1, 1, 1);
      });
    });
  }

  const editorTexture = document.createElement('canvas');
  editorTexture.width = 1050;
  editorTexture.height = 650;
  const editorContext = editorTexture.getContext('2d')!;


  return {
    draw(seats: ReadonlyMap<number, { worker: Worker; pose: Pose }>, time: number, founder?: { worker: Worker; pose: Pose }) {
      frame.data.set(base.data);
      depth.set(baseDepth);
      const monitors: MonitorFace[] = [];
      const statuses: { worker: Worker; at: Point }[] = [];
      layout.desks.forEach(([x, y], seat) => {
        const actor = seat === layout.desks.length - 1 && founder ? founder : seats.get(seat);
        drawChair({ x: x! + layout.seatOffset[0]!, y: y! + layout.seatOffset[1]! + (actor?.pose.chair ?? 4) });
        if (actor) {
          if (actor.worker.person.busy) monitors.push(placeMonitor(x!, y!, actor.worker.monitor));
          const at = paintPerson(actor.worker, actor.pose, time);
          if (actor !== founder) statuses.push({ worker: actor.worker, at });
        }
      });
      ctx.putImageData(frame, 0, 0);
      detail.clearRect(0, 0, width, height);
      monitors.forEach(face => drawMonitorText(face, time));
      statuses.forEach(({ worker, at }) => paintStatus(worker, at));
    },
  };

  function placeMonitor(x: number, y: number, monitor: MonitorTyping): MonitorFace {
    const [left, cols, front, bottom, top] = layout.monitor as [number, number, number, number, number];
    const at = { x: x + left, y: y + front };
    const visible: MonitorFace['visible'] = [];
    for (let u = 0; u < cols; u++) {
      for (let v = 1; v <= top - bottom; v++) {
        const worldZ = top - v;
        const p = project({ x: at.x + u, y: at.y }, worldZ);
        const px = Math.floor(p.x);
        const py = Math.floor(p.y);
        const z = Math.fround(at.x + u + at.y + worldZ + .5);
        pixel(px, py, z, 0x24282d);
        visible.push({ x: px, y: py, z });
      }
    }
    return { origin: project(at, top), visible, monitor };
  }


  function drawMonitorText({ origin, visible, monitor }: MonitorFace, time: number) {
    const [, screenWidth, , bottom, top] = layout.monitor as [number, number, number, number, number];
    const screenHeight = top - bottom;
    drawEditorScreen(editorContext, {
      x: 0, y: 0, w: editorTexture.width, h: editorTexture.height,
    }, monitor, time, 1);
    detail.save();
    detail.beginPath();
    for (const { x, y, z } of visible) if (depth[y * width + x] === z) detail.rect(x, y, 1, 1);
    detail.clip();
    // The complete editor texture covers the complete isometric screen face.
    detail.transform(1, .5, 0, 1, origin.x - .35, origin.y + .45);
    detail.drawImage(editorTexture, 0, 0, screenWidth, screenHeight);
    detail.restore();
  }
}

export function monitorPoint(layout: RoomArt, seat: number): Point {
  const [x, y] = layout.desks[seat] as [number, number];
  const [left, cols, front, bottom, top] = layout.monitor as [number, number, number, number, number];
  return projectPoint(layout, { x: x + left + cols / 2, y: y + front }, (bottom + top) / 2);
}
