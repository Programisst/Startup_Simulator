// Планировка 3D-квартиры в метрах. Ось x — вправо вдоль задней стены, z — от задней стены к камере.
// Задняя стена при z = 0, левая при x = 0; правая и передняя стены «срезаны», чтобы видеть комнату.
import type { Box } from '../room/engine/physics';

export const ROOM = { w: 6, d: 5, h: 2.8 };

/** Камера смотрит на квартиру спереди-справа (yaw) и сверху (pitch), углы в радианах. */
export const CAMERA = { yaw: 0.3, pitch: 0.62 };
/** Насколько стены «сжаты» на экране из-за наклона камеры: картинки на стенах рисуем сразу с этой поправкой. */
export const WALL_SQUASH = { x: Math.cos(CAMERA.yaw), y: Math.cos(CAMERA.pitch) };

/** Где можно ходить (центр ступней героя). */
export const WALK: Box = { x: 0.06, y: 0.06, w: ROOM.w - 0.12, h: ROOM.d - 0.12 };

/** Мебель на полу: x, y (= z), ширина, глубина. */
export const PLACES = {
  desk: { x: 3.7, y: 0, w: 1.85, h: 0.8 },
  chair: { x: 4.33, y: 0.92, w: 0.54, h: 0.5 },
  bed: { x: 0, y: 0, w: 1.62, h: 2.18 },
  nightstand: { x: 1.66, y: 0.02, w: 0.46, h: 0.42 },
  plant: { x: 3.18, y: 0.1, w: 0.42, h: 0.42 },
  armchair: { x: 2.05, y: 2.2, w: 0.82, h: 0.82 },
  sideTable: { x: 2.98, y: 2.36, w: 0.42, h: 0.42 },
  floorLamp: { x: 1.58, y: 2.72, w: 0.3, h: 0.3 },
  counter: { x: 0, y: 2.7, w: 0.64, h: 1.4 },
  fridge: { x: 0, y: 4.1, w: 0.7, h: 0.72 },
  boxes: { x: 5.0, y: 3.95, w: 0.66, h: 0.7 },
} satisfies Record<string, Box>;

export const COLLIDERS: Box[] = Object.values(PLACES);

export type LampId = 'lampDesk' | 'lampBed' | 'lampFloor';
export type InteractionId = 'computer' | 'coffee' | 'bed' | 'window' | LampId;
export const LAMP_IDS: LampId[] = ['lampDesk', 'lampBed', 'lampFloor'];

export interface Interaction3D {
  id: InteractionId;
  zones: Box[];
  /** Над какой точкой показать подсказку. */
  anchor: { x: number; y: number; z: number };
  /** Куда подойти герою, если кликнули по предмету мышкой. */
  approach: { x: number; z: number };
}

// Порядок важен: лампы проверяются раньше кровати и окна, их зоны рядом.
export const INTERACTIONS: Interaction3D[] = [
  { id: 'lampDesk', zones: [{ x: 3.45, y: 0.85, w: 0.45, h: 0.45 }], anchor: { x: 3.95, y: 1.35, z: 0.27 }, approach: { x: 3.68, z: 1.05 } },
  { id: 'lampBed', zones: [{ x: 1.75, y: 0.5, w: 0.5, h: 0.3 }], anchor: { x: 1.84, y: 1.05, z: 0.2 }, approach: { x: 2.0, z: 0.65 } },
  { id: 'lampFloor', zones: [{ x: 1.4, y: 2.3, w: 0.6, h: 0.42 }], anchor: { x: 1.73, y: 1.95, z: 2.87 }, approach: { x: 1.73, z: 2.45 } },
  { id: 'computer', zones: [{ x: 3.9, y: 1.2, w: 1.4, h: 0.8 }], anchor: { x: 4.6, y: 1.42, z: 0.28 }, approach: { x: 4.6, z: 1.7 } },
  { id: 'coffee', zones: [{ x: 0.64, y: 2.75, w: 0.6, h: 0.65 }], anchor: { x: 0.32, y: 2.05, z: 3.0 }, approach: { x: 0.95, z: 3.05 } },
  {
    id: 'bed',
    zones: [
      { x: 1.62, y: 0.5, w: 0.6, h: 1.9 },
      { x: 0.2, y: 2.18, w: 1.6, h: 0.5 },
    ],
    anchor: { x: 0.8, y: 0.95, z: 0.9 },
    approach: { x: 1.95, z: 1.3 },
  },
  { id: 'window', zones: [{ x: 2.1, y: 0.06, w: 1.05, h: 0.85 }], anchor: { x: 2.45, y: 2.45, z: 0.05 }, approach: { x: 2.6, z: 0.6 } },
];

export function findInteraction(feet: { x: number; z: number }): Interaction3D | null {
  for (const it of INTERACTIONS) {
    for (const z of it.zones) {
      if (feet.x >= z.x && feet.x <= z.x + z.w && feet.z >= z.y && feet.z <= z.y + z.h) return it;
    }
  }
  return null;
}

/** Какие предметы открывают какое действие, если по ним кликнули. */
const CLICKABLE: [keyof typeof PLACES, InteractionId][] = [
  ['desk', 'computer'],
  ['chair', 'computer'],
  ['counter', 'coffee'],
  ['fridge', 'coffee'],
  ['bed', 'bed'],
  ['nightstand', 'bed'],
];

/** Точка, куда попал клик (в метрах), → предмет, с которым можно что-то сделать. */
export function interactionAt(p: { x: number; y: number; z: number }): Interaction3D | null {
  const byId = (id: InteractionId) => INTERACTIONS.find((i) => i.id === id) ?? null;
  // Лампы — маленькие, их проверяем первыми.
  if (p.y > 0.78 && p.x >= 3.76 && p.x <= 4.3 && p.z >= 0.1 && p.z <= 0.45) return byId('lampDesk');
  if (p.y > 0.42 && Math.hypot(p.x - 1.84, p.z - 0.2) < 0.2) return byId('lampBed');
  if (p.y > 0.05 && Math.hypot(p.x - 1.73, p.z - 2.87) < 0.26) return byId('lampFloor');
  if (p.z < 0.15 && p.x >= WINDOW_SPAN.x0 && p.x <= WINDOW_SPAN.x1 && p.y >= WINDOW_SPAN.y0 && p.y <= WINDOW_SPAN.y1) return byId('window');
  const m = 0.04;
  for (const [place, id] of CLICKABLE) {
    const b = PLACES[place];
    if (p.x >= b.x - m && p.x <= b.x + b.w + m && p.z >= b.y - m && p.z <= b.y + b.h + m && p.y > 0.02) return byId(id);
  }
  return null;
}

/** Проём окна на задней стене. */
const WINDOW_SPAN = { x0: 1.95, x1: 3.25, y0: 0.85, y1: 2.35 };

/** Где сидит основатель (центр таза) и куда смотрит. */
export const SEAT = { x: 4.6, z: 1.12 };
export const STAND_SPOT = { x: 4.6, z: 1.7 };
export const WAKE_SPOT = { x: 1.95, z: 1.3 };
export const START_SPOT = { x: 3.2, z: 3.6 };
