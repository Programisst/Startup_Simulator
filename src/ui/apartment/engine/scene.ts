// Расстановка квартиры. Все координаты — в пикселях сцены (1 тайл = 16 пикселей),
// на экран сцена выводится с целым увеличением, поэтому пиксели остаются чёткими.
import type { Art } from './art';

export const MAP_W = 416;
export const MAP_H = 224;

/** Комната: внутренняя часть пола и стены. */
export const ROOM = { left: 10, right: 406, wallTop: 10, floorTop: 52, bottom: 212 };

/** Где можно стоять ногами. */
export const WALK = { x: 12, y: 56, w: 392, h: 154 };

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type SpriteKey = Exclude<keyof Art, 'hero'>;

export interface Prop {
  key: SpriteKey;
  x: number;
  y: number;
  /** Глубина для сортировки «кто перед кем». По умолчанию — нижний край картинки. */
  sort?: number;
  /** Плоские вещи (ковры) рисуются до всех остальных. */
  flat?: boolean;
  /** Мягкая тень на полу под предметом. */
  shadow?: Rect;
  /** Твёрдая часть — сквозь неё не пройти. */
  solid?: Rect;
}

export const PROPS: Prop[] = [
  // ── спальня
  { key: 'rugBed', x: 28, y: 96, flat: true },
  { key: 'bed', x: 22, y: 44, sort: 101, shadow: { x: 21, y: 98, w: 45, h: 5 }, solid: { x: 22, y: 52, w: 42, h: 48 } },
  { key: 'nightstand', x: 66, y: 48, sort: 62, shadow: { x: 65, y: 60, w: 18, h: 4 }, solid: { x: 66, y: 52, w: 15, h: 9 } },
  { key: 'tableLamp', x: 67, y: 37, sort: 62.5 },
  { key: 'plantTree', x: 96, y: 44, sort: 75, shadow: { x: 95, y: 71, w: 21, h: 5 }, solid: { x: 98, y: 64, w: 14, h: 10 } },
  { key: 'plantPot', x: 15, y: 182, sort: 205, shadow: { x: 14, y: 201, w: 17, h: 5 }, solid: { x: 16, y: 196, w: 12, h: 9 } },
  // коробки после переезда
  { key: 'boxBig', x: 84, y: 164, sort: 182, shadow: { x: 83, y: 179, w: 24, h: 5 }, solid: { x: 84, y: 168, w: 20, h: 13 } },
  { key: 'boxMid', x: 86, y: 154, sort: 182.5 },
  { key: 'boxSmall', x: 106, y: 173, sort: 184, shadow: { x: 105, y: 181, w: 15, h: 4 }, solid: { x: 106, y: 176, w: 12, h: 7 } },
  { key: 'boxOpen', x: 50, y: 178, sort: 195, shadow: { x: 51, y: 192, w: 22, h: 4 }, solid: { x: 52, y: 182, w: 18, h: 12 } },
  // ── рабочее место
  { key: 'desk', x: 118, y: 49, sort: 66, shadow: { x: 117, y: 70, w: 55, h: 5 }, solid: { x: 118, y: 52, w: 52, h: 15 } },
  { key: 'books', x: 121, y: 45, sort: 66.1 },
  { key: 'monitor', x: 132, y: 33, sort: 66.2 },
  { key: 'deskLamp', x: 159, y: 40, sort: 66.2 },
  { key: 'keyboard', x: 136, y: 56, sort: 66.3 },
  { key: 'mug', x: 124, y: 55, sort: 66.3 },
  { key: 'chair', x: 136, y: 64, sort: 80, shadow: { x: 136, y: 80, w: 17, h: 5 }, solid: { x: 139, y: 77, w: 10, h: 5 } },
  // ── гостиная
  { key: 'rug', x: 202, y: 100, flat: true },
  { key: 'floorLamp', x: 194, y: 70, sort: 106, shadow: { x: 193, y: 103, w: 14, h: 4 }, solid: { x: 195, y: 101, w: 9, h: 5 } },
  { key: 'sofa', x: 234, y: 94, sort: 120, shadow: { x: 233, y: 117, w: 52, h: 5 }, solid: { x: 234, y: 102, w: 48, h: 18 } },
  { key: 'plantPot', x: 288, y: 96, sort: 119, shadow: { x: 287, y: 115, w: 17, h: 5 }, solid: { x: 289, y: 110, w: 12, h: 9 } },
  { key: 'coffeeTable', x: 244, y: 130, sort: 142, shadow: { x: 243, y: 140, w: 31, h: 5 }, solid: { x: 244, y: 132, w: 28, h: 10 } },
  { key: 'armchair', x: 224, y: 147, sort: 163, shadow: { x: 223, y: 160, w: 21, h: 5 }, solid: { x: 224, y: 150, w: 18, h: 13 } },
  { key: 'armchair', x: 274, y: 147, sort: 163, shadow: { x: 273, y: 160, w: 21, h: 5 }, solid: { x: 274, y: 150, w: 18, h: 13 } },
  { key: 'palm', x: 297, y: 44, sort: 75, shadow: { x: 297, y: 71, w: 23, h: 5 }, solid: { x: 300, y: 66, w: 16, h: 9 } },
  // план стартапа на доске
  { key: 'whiteboard', x: 100, y: 98, sort: 131, shadow: { x: 99, y: 128, w: 41, h: 5 }, solid: { x: 101, y: 125, w: 36, h: 7 } },
  // прихожая: коврик, кроссовки, рюкзак
  { key: 'doormat', x: 197, y: 199, flat: true },
  { key: 'sneakers', x: 229, y: 204, sort: 209 },
  { key: 'backpack', x: 181, y: 195, sort: 207, shadow: { x: 180, y: 205, w: 15, h: 3 }, solid: { x: 182, y: 201, w: 10, h: 6 } },
  // ── кухня
  { key: 'counter', x: 326, y: 50, sort: 74, shadow: { x: 325, y: 72, w: 66, h: 5 }, solid: { x: 326, y: 52, w: 62, h: 22 } },
  { key: 'coffee', x: 331, y: 38, sort: 74.1 },
  { key: 'fridge', x: 388, y: 34, sort: 75, shadow: { x: 386, y: 72, w: 20, h: 5 }, solid: { x: 388, y: 52, w: 18, h: 23 } },
  { key: 'island', x: 340, y: 110, sort: 126, shadow: { x: 339, y: 124, w: 44, h: 5 }, solid: { x: 340, y: 114, w: 40, h: 12 } },
  { key: 'stool', x: 345, y: 126, sort: 139, shadow: { x: 344, y: 137, w: 12, h: 3 }, solid: { x: 346, y: 134, w: 7, h: 5 } },
  { key: 'stool', x: 365, y: 126, sort: 139, shadow: { x: 364, y: 137, w: 12, h: 3 }, solid: { x: 366, y: 134, w: 7, h: 5 } },
  { key: 'plantTree', x: 384, y: 176, sort: 207, shadow: { x: 383, y: 203, w: 21, h: 5 }, solid: { x: 386, y: 196, w: 14, h: 10 } },
  { key: 'boxBig', x: 322, y: 180, sort: 198, shadow: { x: 321, y: 195, w: 24, h: 5 }, solid: { x: 322, y: 184, w: 20, h: 13 } },
  { key: 'boxSmall', x: 345, y: 188, sort: 199, shadow: { x: 344, y: 196, w: 15, h: 4 }, solid: { x: 345, y: 191, w: 12, h: 7 } },
];

/** Окна в верхней стене: рама, стекло показывает город. */
export const WINDOWS: Rect[] = [
  { x: 118, y: 14, w: 52, h: 32 },
  { x: 214, y: 14, w: 68, h: 32 },
];

/** Вещи на стене, которые не меняются. */
export const WALL_ITEMS: { key: SpriteKey; x: number; y: number }[] = [
  { key: 'wallArt', x: 30, y: 20 },
  { key: 'shelf', x: 336, y: 25 },
  { key: 'poster', x: 182, y: 20 },
];

export const CLOCK = { x: 384, y: 18 };
/** Дверь в нижней стене. */
export const DOOR = { x: 196, w: 28 };

export type LampId = 'lampBed' | 'lampDesk' | 'lampFloor';
export type ActionId = 'computer' | 'coffee' | 'bed' | 'window' | 'boxes' | LampId;
export type Dir = 0 | 1 | 2 | 3; // вправо, вверх, влево, вниз

export interface Spot {
  id: ActionId;
  /** Куда встать герою. */
  at: { x: number; y: number };
  face: Dir;
  /** Где ловить клик мышью. */
  pick: Rect;
  /** Где показывать подсказку «E …». */
  anchor: { x: number; y: number };
}

export const SPOTS: Spot[] = [
  { id: 'computer', at: { x: 144, y: 92 }, face: 1, pick: { x: 130, y: 32, w: 30, h: 54 }, anchor: { x: 144, y: 30 } },
  { id: 'coffee', at: { x: 337, y: 84 }, face: 1, pick: { x: 328, y: 36, w: 18, h: 40 }, anchor: { x: 337, y: 34 } },
  { id: 'bed', at: { x: 72, y: 86 }, face: 2, pick: { x: 22, y: 44, w: 42, h: 58 }, anchor: { x: 43, y: 42 } },
  { id: 'window', at: { x: 248, y: 80 }, face: 1, pick: { x: 214, y: 14, w: 68, h: 34 }, anchor: { x: 248, y: 12 } },
  { id: 'lampBed', at: { x: 74, y: 72 }, face: 1, pick: { x: 64, y: 36, w: 18, h: 27 }, anchor: { x: 73, y: 34 } },
  { id: 'lampDesk', at: { x: 164, y: 79 }, face: 1, pick: { x: 157, y: 38, w: 13, h: 18 }, anchor: { x: 164, y: 36 } },
  { id: 'lampFloor', at: { x: 212, y: 100 }, face: 2, pick: { x: 192, y: 68, w: 15, h: 40 }, anchor: { x: 199, y: 66 } },
  { id: 'boxes', at: { x: 96, y: 194 }, face: 1, pick: { x: 82, y: 152, w: 38, h: 32 }, anchor: { x: 95, y: 150 } },
];

/** Место, где герой сидит за компьютером (ступни скрыты креслом). */
export const SEAT = { x: 144, y: 79 };
/** Подушка: где лежит голова спящего. */
export const PILLOW = { x: 34, y: 54 };

export interface LampDef {
  id: LampId;
  /** Центр светового пятна на полу. */
  light: { x: number; y: number; r: number };
  /** Сама лампочка — там рисуется мягкое свечение. */
  bulb: { x: number; y: number; r: number };
}

export const LAMPS: LampDef[] = [
  { id: 'lampBed', light: { x: 74, y: 64, r: 92 }, bulb: { x: 73, y: 43, r: 14 } },
  { id: 'lampDesk', light: { x: 157, y: 62, r: 58 }, bulb: { x: 161, y: 44, r: 9 } },
  { id: 'lampFloor', light: { x: 203, y: 100, r: 112 }, bulb: { x: 199, y: 75, r: 18 } },
];

export const MONITOR_LIGHT = { x: 144, y: 60, r: 58 };
export const KITCHEN_LIGHT = { x: 356, y: 58, r: 74 };
export const COFFEE_CUP = { x: 336, y: 47 };
export const DESK_MUG = { x: 126, y: 54 };
export const HERO_START = { x: 176, y: 128 };
