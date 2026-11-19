// Основатель: пиксельный человечек в худи. Четыре стороны, шаги, моргание, сидит, спит.
import { drawSprite, makeSprite, type Ctx } from './pixels';

export type Facing = 'down' | 'up' | 'left' | 'right';

const PALETTE: Record<string, string> = {
  o: '#2b1f2c', // контур
  h: '#3d2a24', // волосы
  H: '#61443a', // блик на волосах
  s: '#f1c5a1', // кожа
  S: '#d59a77', // тень на коже
  e: '#2b1f2c', // глаза
  k: '#3f6aa6', // худи
  K: '#2e4f84', // тень худи
  L: '#5b89c7', // свет на худи
  d: '#ece6dc', // шнурки капюшона
  j: '#2c3550', // джинсы
  J: '#1f273c',
  w: '#efede8', // кеды
  W: '#bdbab3',
};

const BLINK: Record<string, string> = { ...PALETTE, e: PALETTE.s! };

// Голова и туловище — 16 строк, ноги — 6 строк. Всего 16×22 пикселя.
const DOWN = makeSprite([
  '....oooooooo....',
  '...ohhhhhhhho...',
  '..ohhHHhhhhhho..',
  '..ohhhhhhhhhho..',
  '..ohssssssssho..',
  '..o' + 's'.repeat(10) + 'o..',
  '..ossessssesso..',
  '..ossessssesso..',
  '..oSssssssssSo..',
  '...oSSssssSSo...',
  '...okkkkkkkko...',
  '..oLkkdkkdkkKo..',
  '.okLkkdkkdkkKKo.',
  '.okLkkkkkkkkKKo.',
  '.oskkkkkkkkkKso.',
  '..oKKKKKKKKKKo..',
]);

const UP = makeSprite([
  '....oooooooo....',
  '...ohhhhhhhho...',
  '..ohhhhHHhhhho..',
  '..ohhhhhhhhhho..',
  '..ohhhhhhhhhho..',
  '..ohhhHhhhhhho..',
  '..ohhhhhhhhhho..',
  '..oShhhhhhhhSo..',
  '..oShhhhhhhhSo..',
  '...ohhhhhhhho...',
  '...okKKKKKKko...',
  '..okkKKKKKKkko..',
  '.okkkKKKKKKkkko.',
  '.okkkkkkkkkkkko.',
  '.oskkkkkkkkkkso.',
  '..oKKKKKKKKKKo..',
]);

const SIDE = makeSprite([
  '....oooooooo....',
  '...ohhhhhhhho...',
  '..ohhhhHHhhhho..',
  '..ohhhhhhhhhho..',
  '..ohhhhhhsssso..',
  '..ohhhhhssssso..',
  '..ohhhhsssseso..',
  '..ohhhSsssseso..',
  '..ohhSssssssso..',
  '...ohSssssSSo...',
  '....okkkkkkko...',
  '...okkkkkkkkKo..',
  '...okkKKkkkkKo..',
  '...okkKKkkkkKo..',
  '...okkssKkkkKo..',
  '....oKKKKKKKKo..',
]);

const LEGS_FRONT = [
  makeSprite(['...ojjjjjjjjo...', '...ojjjJJjjjo...', '...ojjo..ojjo...', '...ojjo..ojjo...', '...owwo..owwo...', '...oooo..oooo...']),
  makeSprite(['...ojjjjjjjjo...', '...ojjo..ojjo...', '...ojjo..ojjo...', '...owwo..ojjo...', '...oooo..owwo...', '.........oooo...']),
  makeSprite(['...ojjjjjjjjo...', '...ojjo..ojjo...', '...ojjo..ojjo...', '...ojjo..owwo...', '...owwo..oooo...', '...oooo.........']),
];

const LEGS_SIDE = [
  makeSprite(['.....ojjjjo.....', '.....ojjjjo.....', '.....ojjjjo.....', '.....ojjjjo.....', '.....owwwwwo....', '.....ooooooo....']),
  makeSprite(['....ojjjjjjo....', '....ojjo.ojjo...', '...ojjo...ojjo..', '..ojjo.....ojjo.', '..owwo.....owwwo', '..oooo.....ooooo']),
];

export const FOUNDER_W = 16;
export const FOUNDER_H = 22;

export interface FounderPose {
  facing: Facing;
  /** Номер кадра ходьбы; null — стоит на месте. */
  step: number | null;
  blink: boolean;
  /** Сдвиг вверх-вниз: дыхание и шаги. */
  bob: number;
}

/** Рисует основателя так, что (x, y) — левый верхний угол картинки 16×22. */
export function drawFounder(g: Ctx, x: number, y: number, pose: FounderPose): void {
  const palette = pose.blink ? BLINK : PALETTE;
  const side = pose.facing === 'left' || pose.facing === 'right';
  const flip = pose.facing === 'left';
  const body = pose.facing === 'down' ? DOWN : pose.facing === 'up' ? UP : SIDE;

  let legs;
  if (side) legs = LEGS_SIDE[pose.step === null ? 0 : pose.step % 2 === 1 ? 1 : 0]!;
  else legs = LEGS_FRONT[pose.step === null ? 0 : pose.step % 4 === 1 ? 1 : pose.step % 4 === 3 ? 2 : 0]!;

  // Тень под ногами.
  g.fillStyle = 'rgba(30, 16, 24, 0.22)';
  g.fillRect(x + 3, y + 20, 10, 2);
  g.fillRect(x + 4, y + 22, 8, 1);

  drawSprite(g, legs, x, y + 16, palette, flip);
  drawSprite(g, body, x, y + pose.bob, palette, flip);
}

/** Основатель за столом, спиной к нам. Руки чуть двигаются, когда он печатает. */
export function drawFounderSitting(g: Ctx, x: number, y: number, typing: boolean, t: number): void {
  const bob = typing && Math.floor(t * 9) % 2 === 0 ? 1 : 0;
  drawSprite(g, UP, x, y + bob * 0, PALETTE);
  if (typing) {
    // Локти ходят по очереди — видно, что он печатает.
    const left = Math.floor(t * 11) % 2 === 0;
    g.fillStyle = PALETTE.K!;
    g.fillRect(x + 1, y + 12 + (left ? 0 : 1), 2, 2);
    g.fillRect(x + 13, y + 12 + (left ? 1 : 0), 2, 2);
  }
}

/** Голова на подушке — для сцены сна. */
export function drawFounderSleeping(g: Ctx, x: number, y: number): void {
  drawSprite(g, DOWN, x, y, BLINK, false, 10);
}
