// Экран монитора в квартире: тот же проект, что открыт в компьютере, печатается вживую — с паузами и опечатками.
// Издалека код нарисован пикселями, при приближении колёсиком плавно становится настоящим текстом.
import { highlightLine, type Token } from '../laptop/highlight';
import { WRITTEN_FILES } from '../laptop/project';
import { buildTypingScript, type TypingStep } from '../laptop/typing';
import { zoomLimits } from './zoom';

/** Строка на экране монитора: кусок строки кода после переноса. */
export interface ScreenRow {
  /** Номер строки в файле; у продолжения перенесённой строки — null. */
  number: number | null;
  /** Сдвиг вправо в символах: продолжение перенесённой строки стоит под её началом. */
  indent: number;
  tokens: Token[];
  /** Где стоит курсор в этой строке экрана; null — не здесь. */
  caret: number | null;
}

/** Перенос длинной строки по словам, как в редакторе с включённым переносом. Куски вместе дают исходную строку. */
export function wrapLine(line: string, cols: number): string[] {
  if (line.length <= cols) return [line];
  const parts: string[] = [];
  let rest = line;
  while (rest.length > cols) {
    // Ищем последний пробел, после которого можно перенести; если его нет — режем по ширине.
    const space = rest.lastIndexOf(' ', cols - 1);
    const cut = space > 0 && rest.slice(0, space).trim() !== '' ? space + 1 : cols;
    parts.push(rest.slice(0, cut));
    rest = rest.slice(cut);
  }
  parts.push(rest);
  return parts;
}

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/**
 * Сколько настоящего текста видно на мониторе: 0 — только пиксели, 1 — только текст.
 * Приближение останавливается на целых шагах; на каждом шаге — что-то одно. Смена идёт плавно,
 * пока камера едет от шага перед серединой к середине.
 */
export function textAmount(scale: number, base: number, always: boolean): number {
  if (always) return 1;
  const { min, max } = zoomLimits(base);
  if (max <= min) return 0;
  const middle = Math.max(min + 1, Math.round(min + (max - min) / 2));
  return smoothstep(middle - 1, middle, scale);
}

/** Кусок подсвеченной строки между символами from и to. */
function sliceTokens(tokens: Token[], from: number, to: number): Token[] {
  const out: Token[] = [];
  let pos = 0;
  for (const t of tokens) {
    const start = pos;
    const end = pos + t.text.length;
    pos = end;
    if (end <= from || start >= to) continue;
    out.push({ kind: t.kind, text: t.text.slice(Math.max(0, from - start), Math.min(t.text.length, to - start)) });
  }
  return out;
}

/** Пауза после того, как файл дописан: основатель смотрит на результат. */
const FILE_REST_MS = 2500;

/** Печать проекта на мониторе. Идёт только пока её двигают (герой сидит за компьютером). */
export class MonitorTyping {
  text = '';
  private file = 0;
  private steps: TypingStep[] = [];
  private step = 0;
  private wait = 0;
  private rest = 0;
  private round = 0;

  constructor() {
    this.open(0);
  }

  get fileName(): string {
    return WRITTEN_FILES[this.file]!.f.name;
  }

  private open(index: number): void {
    if (index >= WRITTEN_FILES.length) this.round += 1;
    this.file = index % WRITTEN_FILES.length;
    const f = WRITTEN_FILES[this.file]!.f;
    const written = f.code.split('\n').slice(0, f.writtenLines).join('\n') + '\n';
    this.text = written;
    this.steps = buildTypingScript(f.code.slice(written.length), 1000 * (this.file + 1) + this.round * 7 + f.code.length);
    this.step = 0;
    this.wait = 0;
    this.rest = 0;
  }

  /** Печатать dt секунд. */
  advance(dt: number): void {
    let ms = dt * 1000;
    while (ms > 0) {
      if (this.rest > 0) {
        const use = Math.min(this.rest, ms);
        this.rest -= use;
        ms -= use;
        if (this.rest <= 0) this.open(this.file + 1);
        continue;
      }
      const s = this.steps[this.step];
      if (!s) {
        this.rest = FILE_REST_MS;
        continue;
      }
      if (this.wait <= 0) this.wait = s.delay;
      const use = Math.min(this.wait, ms);
      this.wait -= use;
      ms -= use;
      if (this.wait <= 0) {
        this.text = s.type === 'insert' ? this.text + s.text : this.text.slice(0, -1);
        this.step += 1;
      }
    }
  }

  /**
   * Что видно на экране шириной cols символов и высотой maxRows строк: последние строки до курсора.
   * spare — сколько пустых строк оставить под курсором (в редакторе — одну, на крошечном пиксельном экране — ни одной).
   */
  rows(cols: number, maxRows: number, spare = 1): ScreenRow[] {
    const lines = this.text.split('\n');
    const all: ScreenRow[] = [];
    lines.forEach((line, i) => {
      const tokens = highlightLine(line);
      const lead = /^\s*/.exec(line)![0].length;
      // Продолжение — под началом строки и чуть правее, но не дальше середины экрана.
      const indent = Math.min(lead + 2, Math.floor(cols / 2));
      const first = wrapLine(line, cols)[0]!;
      const parts = [first, ...(line.length > first.length ? wrapLine(line.slice(first.length), cols - indent) : [])];
      let from = 0;
      parts.forEach((part, k) => {
        const isCaretLine = i === lines.length - 1 && k === parts.length - 1;
        all.push({
          number: k === 0 ? i + 1 : null,
          indent: k === 0 ? 0 : indent,
          tokens: sliceTokens(tokens, from, from + part.length),
          caret: isCaretLine ? part.length : null,
        });
        from += part.length;
      });
    });
    // Курсор всегда виден: экран прокручен до него.
    const caretRow = all.length - 1;
    const start = Math.max(0, caretRow - maxRows + 1 + spare);
    return all.slice(start, start + maxRows);
  }
}
