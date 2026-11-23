// Раскладка клавиатуры на столе (вид из-за компьютера): ряды как у обычной клавиатуры ноутбука,
// ширина клавиш — в долях обычной клавиши. Здесь только геометрия, рисует DeskView.

export interface KeyRect {
  /** Код клавиши, как в событии нажатия (KeyboardEvent.code) */
  code: string;
  row: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Высота клавиатуры в клетках сцены: рамка, пять рядов клавиш и передний край корпуса. */
export const KEYBOARD_H = 23;
/** Клавиша: две клетки верха и одна — передней грани. */
const CAP_H = 3;
const ROW_PITCH = CAP_H + 1;
const INSET = 2;

const letters = (s: string) => [...s].map((c) => [`Key${c}`, 1] as const);

/** Пять рядов по 15 обычных клавиш шириной. */
const ROWS: (readonly (readonly [string, number])[])[] = [
  [['Backquote', 1], ...'1234567890'.split('').map((d) => [`Digit${d}`, 1] as const), ['Minus', 1], ['Equal', 1], ['Backspace', 2]],
  [['Tab', 1.5], ...letters('QWERTYUIOP'), ['BracketLeft', 1], ['BracketRight', 1], ['Backslash', 1.5]],
  [['CapsLock', 1.75], ...letters('ASDFGHJKL'), ['Semicolon', 1], ['Quote', 1], ['Enter', 2.25]],
  [['ShiftLeft', 2.25], ...letters('ZXCVBNM'), ['Comma', 1], ['Period', 1], ['Slash', 1], ['ShiftRight', 2.75]],
  [['Fn', 1], ['ControlLeft', 1], ['AltLeft', 1], ['MetaLeft', 1.25], ['Space', 5.5], ['MetaRight', 1.25], ['AltRight', 1], ['ArrowLeft', 1], ['ArrowDown', 1], ['ArrowRight', 1]],
];

/** Клавиши, которых на рисунке нет отдельно: нажатие показывается на соседней. */
const ALIAS: Record<string, string> = { ArrowUp: 'ArrowDown', ControlRight: 'ControlLeft', NumpadEnter: 'Enter' };

export function keyboardKeys(k: { x: number; y: number; w: number; h: number }): KeyRect[] {
  const left = k.x + INSET;
  const unit = (k.w - INSET * 2 + 1) / 15;
  const keys: KeyRect[] = [];
  ROWS.forEach((row, r) => {
    let at = 0;
    const y = k.y + INSET + r * ROW_PITCH;
    for (const [code, size] of row) {
      const x0 = left + Math.round(at * unit);
      at += size;
      const x1 = left + Math.round(at * unit) - 1;
      keys.push({ code, row: r, x: x0, y, w: x1 - x0, h: CAP_H });
    }
  });
  return keys;
}

export function keyAt(keys: KeyRect[], code: string): KeyRect | null {
  const target = ALIAS[code] ?? code;
  return keys.find((key) => key.code === target) ?? null;
}
