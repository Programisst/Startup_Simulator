// Квартира основателя: планировка, мебель, что можно трогать, откуда идёт свет.
// Всё рисуется кодом в маленьком холсте 272×192 пикселя.
import type { Box } from './physics';
import { box, disc, floorShadow, line, OUTLINE, px, rect, seeded, shade, type Ctx } from './pixels';
import type { Sky } from './sky';

export const ROOM_W = 272;
export const ROOM_H = 192;

/** Где можно ходить: пол между стенами. */
export const FLOOR: Box = { x: 8, y: 40, w: 256, h: 144 };

export type InteractionId = 'computer' | 'coffee' | 'bed' | 'window';

export interface Interactable {
  id: InteractionId;
  /** Где должны стоять ноги, чтобы появилась подсказка. */
  zone: Box;
  /** Над какой точкой показывать подсказку. */
  anchor: { x: number; y: number };
}

export const INTERACTABLES: Interactable[] = [
  { id: 'computer', zone: { x: 220, y: 56, w: 34, h: 26 }, anchor: { x: 239, y: 14 } },
  { id: 'coffee', zone: { x: 222, y: 104, w: 20, h: 28 }, anchor: { x: 249, y: 106 } },
  { id: 'bed', zone: { x: 52, y: 56, w: 16, h: 60 }, anchor: { x: 32, y: 26 } },
  { id: 'bed', zone: { x: 10, y: 100, w: 58, h: 16 }, anchor: { x: 32, y: 26 } },
  { id: 'window', zone: { x: 104, y: 40, w: 52, h: 18 }, anchor: { x: 130, y: 30 } },
];

/** Где сидит основатель за столом (левый верхний угол картинки 16×22). */
export const SEAT = { x: 228, y: 42 };
/** Куда он встаёт, когда выходит из-за стола (ноги). */
export const STAND_UP_SPOT = { x: 231, y: 74 };
/** Где он оказывается утром, проснувшись (ноги). */
export const WAKE_SPOT = { x: 56, y: 104 };

/** Мебель, сквозь которую нельзя пройти (места на полу). */
export const SOLIDS: Box[] = [
  { x: 11, y: 40, w: 42, h: 62 }, // кровать
  { x: 55, y: 42, w: 16, h: 14 }, // тумбочка
  { x: 87, y: 50, w: 12, h: 8 }, // цветок
  { x: 212, y: 42, w: 48, h: 14 }, // стол
  { x: 231, y: 64, w: 10, h: 6 }, // стул
  { x: 241, y: 106, w: 23, h: 14 }, // холодильник
  { x: 241, y: 120, w: 23, h: 46 }, // кухня
  { x: 8, y: 126, w: 27, h: 50 }, // диван
  { x: 44, y: 146, w: 24, h: 12 }, // журнальный столик
  { x: 158, y: 164, w: 22, h: 14 }, // коробки
];

export interface LightSource {
  x: number;
  y: number;
  radius: number;
  color: string;
  /** 0…1 — сила света. */
  power: number;
}

export interface RoomState {
  t: number;
  sky: Sky;
  lampsOn: boolean;
  /** Чем занят монитор: выключен, заставка, работа. */
  screen: 'off' | 'idle' | 'work';
  brewing: boolean;
  /** Минуты суток — для часов на стене. */
  minutes: number;
}

// ——— Статичная часть (пол, ковёр) рисуется один раз и запоминается ———

let floorCache: HTMLCanvasElement | null = null;

function drawFloorTo(g: Ctx): void {
  const rand = seeded(17);
  for (let y = 40, row = 0; y < 184; y += 6, row++) {
    const base = row % 2 === 0 ? '#a7744c' : '#a06e48';
    rect(g, 8, y, 256, 6, base);
    rect(g, 8, y, 256, 1, shade(base, 0.08));
    rect(g, 8, y + 5, 256, 1, '#7c5034');
    const offset = (row * 29) % 44;
    for (let x = 8 + offset; x < 264; x += 44) rect(g, x, y, 1, 5, '#7c5034');
    // Волокна дерева: редкие тёмные и светлые точки.
    for (let k = 0; k < 26; k++) {
      const gx = 8 + Math.floor(rand() * 256);
      const gy = y + 1 + Math.floor(rand() * 4);
      rect(g, gx, gy, 2 + Math.floor(rand() * 4), 1, rand() < 0.5 ? shade(base, -0.07) : shade(base, 0.06));
    }
  }
  // Тень вдоль задней стены.
  g.fillStyle = 'rgba(40, 20, 20, 0.16)';
  g.fillRect(8, 40, 256, 2);
  g.fillStyle = 'rgba(40, 20, 20, 0.08)';
  g.fillRect(8, 42, 256, 2);

  drawRug(g);

  // Коврик у двери.
  rect(g, 127, 173, 22, 10, OUTLINE);
  rect(g, 128, 174, 20, 8, '#6b5847');
  for (let x = 129; x < 147; x += 2) rect(g, x, 175, 1, 6, '#5a4939');
}

function drawRug(g: Ctx): void {
  const x0 = 92;
  const y0 = 96;
  const w = 104;
  const h = 54;
  // Бахрома слева и справа.
  for (let y = y0 + 2; y < y0 + h - 2; y += 2) {
    px(g, x0 - 2, y, '#efe4cc');
    px(g, x0 + w + 1, y, '#efe4cc');
  }
  rect(g, x0 - 1, y0 - 1, w + 2, h + 2, '#1f3d40');
  rect(g, x0, y0, w, h, '#d8a548');
  rect(g, x0 + 3, y0 + 3, w - 6, h - 6, '#2c5a5f');
  rect(g, x0 + 5, y0 + 5, w - 10, h - 10, '#356b70');
  // Ромбы узора.
  for (let cy = y0 + 13; cy < y0 + h - 8; cy += 14) {
    for (let cx = x0 + 14; cx < x0 + w - 10; cx += 19) {
      for (let i = 0; i < 4; i++) {
        rect(g, cx - i, cy - 3 + i, i * 2 + 1, 1, i === 3 ? '#d8a548' : '#2c5a5f');
        rect(g, cx - i, cy + 3 - i, i * 2 + 1, 1, i === 3 ? '#d8a548' : '#2c5a5f');
      }
      px(g, cx, cy, '#efe4cc');
    }
  }
  // Ворс: чуть светлее по краю.
  rect(g, x0 + 3, y0 + 3, w - 6, 1, '#3d7a80');
}

export function drawFloor(g: Ctx): void {
  if (!floorCache) {
    floorCache = document.createElement('canvas');
    floorCache.width = ROOM_W;
    floorCache.height = ROOM_H;
    const fg = floorCache.getContext('2d');
    if (fg) drawFloorTo(fg);
  }
  g.drawImage(floorCache, 0, 0);
}

// ——— Стены и всё, что на них висит ———

export function drawWalls(g: Ctx, s: RoomState): void {
  rect(g, 0, 0, ROOM_W, 4, '#2f2531');
  rect(g, 8, 4, 256, 36, '#d9ccb3');
  for (let x = 10; x < 264; x += 6) rect(g, x, 4, 1, 26, '#d2c4a9');
  rect(g, 8, 30, 256, 8, '#c3b194');
  rect(g, 8, 30, 256, 1, '#e4d9c4');
  for (let x = 30; x < 264; x += 36) rect(g, x, 31, 1, 7, '#b3a083');
  rect(g, 8, 37, 256, 1, '#a99677');
  rect(g, 8, 38, 256, 2, '#6c4e3b');

  // Боковые и передняя стены — тёмные срезы, как в кукольном домике.
  rect(g, 0, 0, 8, ROOM_H, '#2f2531');
  rect(g, 264, 0, 8, ROOM_H, '#2f2531');
  rect(g, 7, 4, 1, 180, '#463845');
  rect(g, 264, 4, 1, 180, '#463845');
  rect(g, 0, 184, ROOM_W, 8, '#2f2531');
  rect(g, 8, 184, 256, 1, '#463845');
  // Дверной проём внизу.
  rect(g, 127, 184, 22, 8, '#1a141d');
  rect(g, 125, 181, 2, 11, '#6c4e3b');
  rect(g, 149, 181, 2, 11, '#6c4e3b');

  drawWindow(g, s);
  drawClock(g, s.minutes);
  drawBoard(g);
  drawShelf(g);
}

function drawWindow(g: Ctx, s: RoomState): void {
  const gx = 109;
  const gy = 11;
  const gw = 42;
  const gh = 20;
  // Небо: градиент сверху вниз полосками.
  for (let i = 0; i < gh; i++) {
    const t = i / (gh - 1);
    g.fillStyle = mix(s.sky.top, s.sky.bottom, t);
    g.fillRect(gx, gy + i, gw, 1);
  }
  // Звёзды мерцают.
  if (s.sky.stars) {
    const rand = seeded(5);
    for (let k = 0; k < 14; k++) {
      const sx = gx + Math.floor(rand() * gw);
      const sy = gy + Math.floor(rand() * 9);
      const phase = rand() * 6;
      if (Math.sin(s.t * 1.7 + phase) > -0.3) px(g, sx, sy, rand() < 0.3 ? '#fff6d8' : '#c8d2ff');
    }
    disc(g, gx + 33, gy + 4, 2, '#f4efd9');
    px(g, gx + 34, gy + 3, '#d9d3bb');
  }
  // Город вдали: силуэты домов, ночью в окнах горит свет.
  const city = shade(mix(s.sky.top, '#1c1830', 0.7), -0.1);
  const heights = [9, 6, 11, 7, 13, 8, 5, 10, 7, 12, 6, 9];
  let x = gx;
  heights.forEach((h, i) => {
    const w = 3 + (i % 3);
    rect(g, x, gy + gh - h, w, h, i % 2 ? city : shade(city, 0.06));
    if (s.sky.darkness > 0.35) {
      const rand = seeded(100 + i);
      for (let k = 0; k < h; k += 2) {
        for (let m = 0; m < w - 1; m += 2) if (rand() < 0.35) px(g, x + m + 1, gy + gh - h + k + 1, rand() < 0.8 ? '#f6d67a' : '#9fd0ff');
      }
    }
    x += w;
  });
  // Рама, перекладины, подоконник.
  rect(g, gx - 3, gy - 3, gw + 6, 2, '#efe8db');
  rect(g, gx - 3, gy + gh + 1, gw + 6, 2, '#efe8db');
  rect(g, gx - 3, gy - 1, 3, gh + 2, '#efe8db');
  rect(g, gx + gw, gy - 1, 3, gh + 2, '#efe8db');
  rect(g, gx + 20, gy, 2, gh, '#efe8db');
  rect(g, gx, gy + 9, gw, 1, '#efe8db');
  rect(g, gx - 4, gy - 4, gw + 8, 1, OUTLINE);
  rect(g, gx - 5, gy + gh + 3, gw + 10, 3, '#f6f1e7');
  rect(g, gx - 5, gy + gh + 6, gw + 10, 1, '#b9ab93');
  // Блик на стекле.
  g.fillStyle = 'rgba(255,255,255,0.18)';
  g.fillRect(gx + 2, gy + 1, 1, 6);
  g.fillRect(gx + 4, gy + 1, 1, 3);
  // Шторы.
  drawCurtain(g, 98, s.t);
  drawCurtain(g, 154, s.t + 1.3);
  rect(g, 95, 5, 70, 2, '#4a3a33');
  px(g, 94, 5, '#2f2531');
  px(g, 165, 5, '#2f2531');
}

function drawCurtain(g: Ctx, x: number, t: number): void {
  const sway = Math.round(Math.sin(t * 0.6) * 0.6);
  rect(g, x, 6, 8, 31, '#c9973f');
  for (let i = 0; i < 8; i += 3) rect(g, x + i + (i > 3 ? sway : 0), 7, 1, 30, '#a97a2c');
  rect(g, x + 1, 6, 1, 31, '#dfb35d');
  rect(g, x, 36, 8, 1, '#a97a2c');
}

function drawClock(g: Ctx, minutes: number): void {
  const cx = 81;
  const cy = 15;
  disc(g, cx, cy, 6, OUTLINE);
  disc(g, cx, cy, 5, '#f4efe4');
  px(g, cx, cy - 4, '#7a6a5a');
  px(g, cx + 4, cy, '#7a6a5a');
  px(g, cx, cy + 4, '#7a6a5a');
  px(g, cx - 4, cy, '#7a6a5a');
  const hourAngle = ((minutes / 60) % 12) / 12 * Math.PI * 2 - Math.PI / 2;
  const minAngle = (minutes % 60) / 60 * Math.PI * 2 - Math.PI / 2;
  line(g, cx, cy, cx + Math.cos(hourAngle) * 2.4, cy + Math.sin(hourAngle) * 2.4, OUTLINE);
  line(g, cx, cy, cx + Math.cos(minAngle) * 3.8, cy + Math.sin(minAngle) * 3.8, '#b8443a');
  px(g, cx, cy, OUTLINE);
}

function drawBoard(g: Ctx): void {
  // Пробковая доска с планом стартапа.
  rect(g, 171, 8, 40, 23, OUTLINE);
  rect(g, 172, 9, 38, 21, '#8b5f3c');
  rect(g, 173, 10, 36, 19, '#c99a63');
  const rand = seeded(9);
  for (let k = 0; k < 40; k++) px(g, 173 + Math.floor(rand() * 36), 10 + Math.floor(rand() * 19), '#b8884f');
  const note = (x: number, y: number, c: string) => {
    rect(g, x, y, 6, 6, c);
    rect(g, x, y + 5, 6, 1, shade(c, -0.15));
    rect(g, x + 1, y + 2, 4, 1, shade(c, -0.3));
    rect(g, x + 1, y + 4, 3, 1, shade(c, -0.3));
    px(g, x + 3, y, '#d64545');
  };
  note(175, 12, '#f3d54e');
  note(183, 11, '#f29bb3');
  note(175, 21, '#9fe0a6');
  note(198, 21, '#8cc8f2');
  // Листок с графиком роста — мечта.
  rect(g, 190, 11, 14, 9, '#fbf8f1');
  line(g, 192, 18, 195, 16, '#d64545');
  line(g, 195, 16, 198, 17, '#d64545');
  line(g, 198, 17, 202, 12, '#d64545');
  px(g, 197, 11, '#3f6aa6');
  // Нитка между стикерами.
  line(g, 178, 18, 186, 17, '#b03030');
}

function drawShelf(g: Ctx): void {
  rect(g, 216, 13, 42, 3, '#6c4e3b');
  rect(g, 216, 13, 42, 1, '#8a6a52');
  const books = [
    ['#b8443a', 8], ['#3f6aa6', 7], ['#e2b04a', 9], ['#4f8a62', 6], ['#efe6d6', 8], ['#6b4c8a', 7],
  ] as const;
  let x = 217;
  books.forEach(([c, h]) => {
    rect(g, x, 13 - h, 3, h, c);
    rect(g, x, 13 - h, 1, h, shade(c, 0.15));
    x += 3;
  });
  // Наклонённая книга и кактус.
  line(g, 236, 12, 239, 6, '#c96f4a');
  line(g, 237, 12, 240, 6, '#c96f4a');
  rect(g, 248, 9, 5, 4, '#e7e2d8');
  rect(g, 249, 5, 3, 4, '#4f9150');
  px(g, 248, 6, '#4f9150');
  px(g, 252, 7, '#4f9150');
  // Кубок за хакатон.
  rect(g, 243, 8, 3, 3, '#e2b04a');
  rect(g, 244, 11, 1, 1, '#e2b04a');
  rect(g, 243, 12, 3, 1, '#a07a2a');
}

// ——— Мебель на полу: рисуется по очереди сверху вниз, чтобы герой мог заходить «за» неё ———

export interface Prop {
  /** Нижний край предмета на полу: чем больше, тем позже рисуется. */
  sortY: number;
  draw: (g: Ctx, s: RoomState) => void;
}

function drawBed(g: Ctx): void {
  floorShadow(g, 11, 100, 44, 4);
  // Изголовье.
  rect(g, 10, 27, 44, 15, OUTLINE);
  rect(g, 11, 28, 42, 13, '#7a4a32');
  rect(g, 11, 28, 42, 2, '#946040');
  rect(g, 15, 32, 15, 7, '#6a3e29');
  rect(g, 34, 32, 15, 7, '#6a3e29');
  // Рама и простыня.
  rect(g, 10, 40, 44, 62, OUTLINE);
  rect(g, 11, 41, 42, 60, '#7a4a32');
  rect(g, 13, 41, 38, 56, '#eee8dd');
  // Подушка.
  rect(g, 16, 43, 32, 10, '#c8c0b2');
  rect(g, 17, 44, 30, 8, '#fbf8f2');
  rect(g, 17, 50, 30, 1, '#e3ddd0');
  rect(g, 18, 45, 4, 1, '#ffffff');
}

/** Одеяло отдельно: его рисуем поверх спящего героя. */
export function drawBlanket(g: Ctx, sleeping: boolean): void {
  rect(g, 13, 55, 38, 42, '#4c6b95');
  rect(g, 13, 55, 38, 5, '#e9e3d7');
  rect(g, 13, 60, 38, 1, '#3a5479');
  for (let y = 64; y < 95; y += 6) {
    for (let x = 17 + ((y / 6) % 2) * 3; x < 49; x += 6) {
      px(g, x, y, '#6787b3');
      px(g, x - 1, y + 1, '#6787b3');
      px(g, x + 1, y + 1, '#6787b3');
      px(g, x, y + 2, '#6787b3');
    }
  }
  rect(g, 12, 60, 1, 38, '#3a5479');
  rect(g, 51, 60, 1, 38, '#3a5479');
  if (sleeping) {
    // Очертания тела под одеялом.
    rect(g, 22, 61, 20, 26, '#56769f');
    rect(g, 22, 61, 20, 1, '#6c8cb6');
    rect(g, 24, 87, 7, 4, '#56769f');
    rect(g, 33, 87, 7, 4, '#56769f');
  }
  rect(g, 11, 97, 42, 4, '#6a3e29');
  rect(g, 11, 101, 3, 2, '#4a2a1c');
  rect(g, 50, 101, 3, 2, '#4a2a1c');
}

function drawNightstand(g: Ctx, s: RoomState): void {
  floorShadow(g, 55, 55, 16, 3);
  box(g, 55, 44, 16, 10, 10, '#8a5a3c', '#6e4630');
  rect(g, 57, 47, 12, 1, '#5a3826');
  rect(g, 62, 50, 2, 1, '#d8b48a');
  // Лампа.
  rect(g, 60, 31, 6, 4, OUTLINE);
  rect(g, 61, 32, 4, 3, '#5d4334');
  rect(g, 62, 26, 2, 6, '#5d4334');
  const shadeColor = s.lampsOn ? '#ffe2a0' : '#e3bf72';
  rect(g, 58, 19, 10, 8, OUTLINE);
  rect(g, 59, 20, 8, 2, shade(shadeColor, 0.08));
  rect(g, 59, 22, 8, 4, shadeColor);
  rect(g, 59, 25, 8, 1, shade(shadeColor, -0.15));
  // Телефон с мигающим огоньком.
  rect(g, 67, 33, 3, 5, '#1d1d24');
  if (Math.sin(s.t * 3) > 0.6) px(g, 68, 33, '#5be37d');
}

function drawPlant(g: Ctx, s: RoomState): void {
  floorShadow(g, 87, 57, 12, 3);
  box(g, 87, 50, 12, 6, 8, '#4a3426', '#e7e2d8');
  rect(g, 87, 48, 12, 1, '#c9b79a');
  const sway = Math.round(Math.sin(s.t * 0.9) * 0.55);
  rect(g, 92, 30, 1, 14, '#3c6b3d');
  disc(g, 93 + sway, 33, 7, '#2f6a35');
  disc(g, 86 + sway, 37, 5, '#3f8044');
  disc(g, 100, 37, 5, '#3f8044');
  disc(g, 92 + sway, 25, 5, '#4f9a52');
  disc(g, 98 + sway, 28, 3, '#5aa85c');
  px(g, 90 + sway, 23, '#8fd08a');
  px(g, 85 + sway, 35, '#7cc078');
  px(g, 99, 35, '#7cc078');
  // Прорези в листьях монстеры.
  rect(g, 93 + sway, 30, 1, 3, '#24502a');
  rect(g, 87 + sway, 37, 2, 1, '#24502a');
}

function drawDesk(g: Ctx, s: RoomState): void {
  floorShadow(g, 211, 55, 50, 4);
  // Столешница и ножки.
  rect(g, 211, 31, 50, 16, OUTLINE);
  rect(g, 212, 32, 48, 14, '#946344');
  rect(g, 212, 32, 48, 1, '#ab7853');
  rect(g, 212, 45, 48, 1, '#7a4f35');
  rect(g, 212, 46, 48, 3, '#6e4630');
  rect(g, 212, 49, 3, 7, '#5a3826');
  rect(g, 257, 49, 3, 7, '#5a3826');
  rect(g, 211, 49, 1, 7, OUTLINE);
  rect(g, 260, 49, 1, 7, OUTLINE);
  // Настольная лампа слева.
  rect(g, 213, 41, 6, 2, '#2b2b33');
  line(g, 215, 41, 214, 31, '#3a3a44');
  line(g, 214, 31, 219, 25, '#3a3a44');
  rect(g, 217, 23, 6, 3, '#2b2b33');
  rect(g, 218, 26, 4, 1, s.lampsOn ? '#fff1c4' : '#8a8a90');
  // Монитор.
  rect(g, 233, 40, 12, 2, '#2b2b33');
  rect(g, 237, 34, 4, 6, '#3d3d46');
  rect(g, 222, 15, 34, 21, OUTLINE);
  rect(g, 223, 16, 32, 19, '#1c1c23');
  drawMonitorScreen(g, s, 224, 17, 30, 15);
  rect(g, 223, 33, 32, 2, '#2b2b33');
  px(g, 239, 34, s.screen === 'off' ? '#55555e' : '#7fd1ff');
  // Клавиатура, мышь, кружка.
  rect(g, 229, 42, 19, 4, OUTLINE);
  rect(g, 230, 42, 17, 3, '#d9d9de');
  for (let x = 231; x < 246; x += 2) px(g, x, 43, '#a8a8b1');
  rect(g, 251, 42, 3, 3, '#ececef');
  rect(g, 254, 37, 4, 5, OUTLINE);
  rect(g, 254, 37, 4, 4, '#ece4d2');
  rect(g, 255, 37, 2, 1, '#4a2e1f');
  px(g, 258, 38, '#ece4d2');
  // Стикер на мониторе — «MVP до пятницы».
  rect(g, 252, 15, 3, 3, '#f3d54e');
}

/** Маленький экран в комнате: видно, что основатель пишет код. */
function drawMonitorScreen(g: Ctx, s: RoomState, x: number, y: number, w: number, h: number): void {
  if (s.screen === 'off') {
    rect(g, x, y, w, h, '#101016');
    g.fillStyle = 'rgba(255,255,255,0.05)';
    g.fillRect(x + 2, y + 1, 1, h - 2);
    return;
  }
  if (s.screen === 'idle') {
    for (let i = 0; i < h; i++) {
      g.fillStyle = mix('#2a4a7a', '#e08a6a', i / h);
      g.fillRect(x, y + i, w, 1);
    }
    rect(g, x + 4, y + h - 5, 9, 4, '#1f3550');
    rect(g, x + 10, y + h - 7, 12, 6, '#1a2d45');
    return;
  }
  // Редактор: тёмный фон, колонка файлов, цветные строки кода ползут вверх.
  rect(g, x, y, w, h, '#1e1f24');
  rect(g, x, y, 6, h, '#181920');
  for (let i = 0; i < 6; i++) rect(g, x + 1, y + 2 + i * 2, 3 + (i % 2), 1, '#4c5160');
  const colors = ['#c586c0', '#569cd6', '#dcdcaa', '#9cdcfe', '#ce9178', '#4ec9b0', '#6a9955'];
  const scroll = Math.floor(s.t * 2.2);
  for (let row = 0; row < h - 1; row++) {
    const n = row + scroll;
    const indent = (n * 7) % 3;
    const len = 4 + ((n * 13) % 15);
    const c1 = colors[n % colors.length]!;
    const c2 = colors[(n * 3 + 1) % colors.length]!;
    if (n % 6 === 5) continue;
    rect(g, x + 8 + indent * 2, y + 1 + row, Math.min(len, 5), 1, c1);
    if (len > 5) rect(g, x + 14 + indent * 2, y + 1 + row, Math.min(len - 5, w - 16 - indent * 2), 1, c2);
  }
  // Курсор мигает в последней строке.
  if (Math.floor(s.t * 2) % 2 === 0) rect(g, x + 20, y + h - 2, 1, 1, '#ffffff');
}

/** Спинка кресла — рисуется поверх сидящего основателя. */
export function drawChairBack(g: Ctx): void {
  rect(g, 229, 49, 14, 14, OUTLINE);
  rect(g, 230, 50, 12, 12, '#2c2c35');
  rect(g, 231, 51, 10, 1, '#474754');
  rect(g, 231, 53, 1, 7, '#3a3a45');
}

function drawChair(g: Ctx, _s: RoomState, occupied: boolean): void {
  floorShadow(g, 229, 70, 14, 3, 0.2);
  rect(g, 228, 72, 16, 1, '#1f1f26');
  px(g, 228, 73, '#1f1f26');
  px(g, 243, 73, '#1f1f26');
  px(g, 236, 74, '#1f1f26');
  rect(g, 235, 66, 2, 6, '#5a5a66');
  rect(g, 228, 61, 16, 6, OUTLINE);
  rect(g, 229, 61, 14, 5, '#34343f');
  rect(g, 229, 61, 14, 1, '#4a4a58');
  if (!occupied) drawChairBack(g);
}

function drawKitchen(g: Ctx, s: RoomState): void {
  // Кухня в правом нижнем углу — кофе в двух шагах от рабочего стола.
  const x = 241;
  // Холодильник.
  floorShadow(g, x, 119, 23, 3);
  box(g, x, 106, 22, 14, 30, '#f4f6f8', '#e2e6ea');
  rect(g, x, 104, 22, 1, '#c3cad1');
  rect(g, x + 2, 93, 1, 7, '#9aa4ae');
  rect(g, x + 2, 107, 1, 10, '#9aa4ae');
  px(g, x + 8, 95, '#d64545');
  px(g, x + 12, 97, '#3f6aa6');
  rect(g, x + 14, 94, 4, 5, '#fbf8f1');
  rect(g, x + 15, 95, 2, 1, '#9aa4ae');
  px(g, x + 9, 110, '#f3d54e');
  // Столешница со шкафчиками.
  floorShadow(g, x, 165, 23, 3);
  box(g, x, 120, 22, 46, 10, '#ddd6c8', '#7c6957');
  rect(g, x, 160, 22, 1, '#5f4f41');
  rect(g, x + 11, 157, 1, 9, '#5f4f41');
  rect(g, x + 5, 162, 3, 1, '#d8c4a4');
  rect(g, x + 15, 162, 3, 1, '#d8c4a4');
  // Кофеварка.
  rect(g, x + 2, 111, 12, 11, OUTLINE);
  rect(g, x + 3, 112, 10, 9, '#2c2c34');
  rect(g, x + 3, 112, 10, 2, '#43434e');
  rect(g, x + 6, 116, 4, 3, '#14141a');
  px(g, x + 11, 114, s.brewing ? '#ff6b5a' : '#5be37d');
  rect(g, x + 6, 119, 4, 2, '#ece4d2');
  rect(g, x + 16, 113, 4, 5, '#ece4d2');
  rect(g, x + 17, 113, 2, 1, '#4a2e1f');
  // Мойка.
  rect(g, x + 3, 125, 16, 12, '#8e98a3');
  rect(g, x + 4, 126, 14, 10, '#b8c1ca');
  rect(g, x + 5, 127, 12, 8, '#9aa4ae');
  px(g, x + 11, 131, '#6e7883');
  rect(g, x + 18, 128, 2, 2, '#c9d0d7');
  // Плита.
  rect(g, x + 3, 139, 16, 15, '#2a2a30');
  for (const [cx, cy] of [[x + 7, 143], [x + 15, 143], [x + 7, 150], [x + 15, 150]] as const) {
    disc(g, cx, cy, 2, '#16161b');
    px(g, cx, cy, '#3a3a42');
  }
}

function drawSofa(g: Ctx): void {
  // Диван вдоль левой стены, спинкой к стене.
  floorShadow(g, 8, 175, 28, 4);
  rect(g, 8, 117, 10, 59, OUTLINE);
  rect(g, 8, 118, 9, 57, '#4d6a4f');
  rect(g, 8, 118, 9, 2, '#5f7f60');
  box(g, 17, 132, 17, 42, 8, '#5f7f60', '#4a6649');
  rect(g, 8, 118, 27, 6, OUTLINE);
  rect(g, 8, 119, 26, 4, '#56755a');
  rect(g, 8, 166, 27, 6, OUTLINE);
  rect(g, 8, 167, 26, 4, '#56755a');
  rect(g, 18, 145, 15, 1, '#4a6649');
  // Подушки и плед.
  rect(g, 18, 125, 6, 8, '#e2b04a');
  rect(g, 18, 125, 6, 1, '#f0c870');
  rect(g, 18, 150, 5, 7, '#efe6d6');
  rect(g, 24, 148, 10, 14, '#b8574a');
  for (let y = 149; y < 162; y += 2) rect(g, 24, y, 10, 1, '#a24a3e');
}

function drawCoffeeTable(g: Ctx, s: RoomState): void {
  floorShadow(g, 44, 158, 24, 3);
  box(g, 44, 146, 24, 12, 6, '#a67c52', '#7f5a3a');
  // Коробка из-под пиццы, блокнот с ручкой.
  rect(g, 46, 141, 11, 8, OUTLINE);
  rect(g, 47, 142, 9, 6, '#e8c58e');
  rect(g, 48, 143, 7, 1, '#c99a5a');
  px(g, 51, 145, '#c94a3a');
  rect(g, 58, 142, 4, 6, '#fbf8f1');
  rect(g, 58, 144, 3, 1, '#9aa4ae');
  // Маленькая лампа.
  rect(g, 64, 141, 3, 5, '#5d4334');
  const c = s.lampsOn ? '#ffe2a0' : '#e3bf72';
  rect(g, 62, 134, 7, 6, OUTLINE);
  rect(g, 63, 135, 5, 4, c);
}

/** Гирлянда над рабочим местом: днём просто лампочки, вечером светится. */
function drawGarland(g: Ctx, s: RoomState): void {
  const colors = ['#ffd27a', '#ff9b8a', '#9fe0a6', '#9fc8ff'];
  let prevX = 166;
  let prevY = 5;
  for (let i = 0; i <= 12; i++) {
    const x = 166 + i * 8;
    const y = 5 + Math.round(Math.sin((i / 12) * Math.PI * 2) * 1.5 + 1.5);
    line(g, prevX, prevY, x, y, '#3a3a33');
    prevX = x;
    prevY = y;
    const on = s.lampsOn && Math.sin(s.t * 1.4 + i * 1.7) > -0.6;
    const c = colors[i % colors.length]!;
    px(g, x, y + 1, on ? c : shade(c, -0.35));
    px(g, x, y + 2, on ? shade(c, 0.4) : shade(c, -0.45));
  }
}

function drawBoxes(g: Ctx): void {
  // Коробки после переезда — ещё не разобраны.
  floorShadow(g, 157, 177, 24, 3);
  box(g, 158, 166, 22, 12, 9, '#d6a46b', '#bb8752');
  rect(g, 168, 157, 2, 12, '#ecd9ad');
  box(g, 161, 158, 15, 9, 7, '#dcae78', '#c3915c');
  rect(g, 167, 151, 2, 9, '#ecd9ad');
  rect(g, 163, 162, 4, 1, '#3a2a20');
}

export function buildProps(founderSitting: boolean): Prop[] {
  return [
    { sortY: 102, draw: (g) => drawBed(g) },
    { sortY: 56, draw: drawNightstand },
    { sortY: 58, draw: drawPlant },
    { sortY: 56, draw: drawDesk },
    { sortY: 72, draw: (g, s) => drawChair(g, s, founderSitting) },
    { sortY: 120, draw: drawKitchen },
    { sortY: 176, draw: (g) => drawSofa(g) },
    { sortY: 158, draw: drawCoffeeTable },
    { sortY: 178, draw: (g) => drawBoxes(g) },
    { sortY: 0, draw: drawGarland },
  ];
}

/** Солнечный луч из окна на полу днём. */
export function drawSunbeam(g: Ctx, sun: number): void {
  if (sun <= 0.02) return;
  g.save();
  g.globalCompositeOperation = 'lighter';
  g.fillStyle = `rgba(255, 226, 170, ${0.13 * sun})`;
  g.beginPath();
  g.moveTo(108, 40);
  g.lineTo(152, 40);
  g.lineTo(176, 92);
  g.lineTo(132, 92);
  g.closePath();
  g.fill();
  g.fillStyle = `rgba(255, 236, 190, ${0.07 * sun})`;
  g.fillRect(130, 41, 1, 50);
  g.restore();
}

export function lightsFor(s: RoomState): LightSource[] {
  const lights: LightSource[] = [];
  if (s.lampsOn) {
    lights.push({ x: 63, y: 24, radius: 44, color: '#ffc879', power: 0.95 });
    lights.push({ x: 219, y: 30, radius: 40, color: '#ffe0a8', power: 0.9 });
    lights.push({ x: 65, y: 137, radius: 50, color: '#ffcf8a', power: 0.95 });
    lights.push({ x: 214, y: 8, radius: 34, color: '#ffd9a0', power: 0.45 });
  }
  if (s.screen !== 'off') lights.push({ x: 239, y: 28, radius: s.screen === 'work' ? 40 : 28, color: '#8fb8ff', power: 0.75 });
  if (s.brewing) lights.push({ x: 252, y: 115, radius: 14, color: '#ff8a6a', power: 0.55 });
  if (s.sky.darkness > 0.3) lights.push({ x: 130, y: 30, radius: 38, color: '#9fb4ff', power: 0.35 });
  return lights;
}

function mix(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (shift: number) => Math.round(((pa >> shift) & 255) + ((((pb >> shift) & 255) - ((pa >> shift) & 255)) * t));
  return `rgb(${ch(16)}, ${ch(8)}, ${ch(0)})`;
}
