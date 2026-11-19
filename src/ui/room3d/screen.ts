// Экран моноблока в комнате, в пикселях комнаты: настоящий код с подсветкой (каждое слово —
// отрезок своего цвета), когда основатель работает, и экран блокировки с часами, когда он отошёл.
import * as THREE from 'three';
import { mixColor } from '../room/engine/sky';
import { HERO_PIXEL_M } from './hero/HeroSprite';
import { highlightLine, type TokenKind } from '../room/laptop/highlight';
import { PROJECT_FILES } from '../room/laptop/project';

const COLORS: Record<TokenKind, string> = {
  keyword: '#569cd6',
  tag: '#569cd6',
  control: '#c586c0',
  type: '#4ec9b0',
  function: '#dcdcaa',
  string: '#ce9178',
  number: '#b5cea8',
  comment: '#6a9955',
  property: '#9cdcfe',
  variable: '#9cdcfe',
  constant: '#4fc1ff',
  punct: '#cccccc',
  space: '#cccccc',
};

export type ScreenMode = 'off' | 'lock' | 'work';

/** Цифры 3×5 для часов. */
const DIGITS: Record<string, string[]> = {
  '0': ['111', '101', '101', '101', '111'],
  '1': ['010', '110', '010', '010', '111'],
  '2': ['111', '001', '111', '100', '111'],
  '3': ['111', '001', '011', '001', '111'],
  '4': ['101', '101', '111', '001', '001'],
  '5': ['111', '100', '111', '001', '111'],
  '6': ['111', '100', '111', '101', '111'],
  '7': ['111', '001', '010', '010', '010'],
  '8': ['111', '101', '111', '101', '111'],
  '9': ['111', '101', '111', '001', '111'],
  ':': ['0', '1', '0', '1', '0'],
};

const BAYER = [0, 0.5, 0.75, 0.25];

export class MonitorScreen {
  readonly texture: THREE.CanvasTexture;
  private canvas: HTMLCanvasElement;
  private g: CanvasRenderingContext2D;
  private lastDraw = -1;
  private typed = 220;
  private W: number;
  private H: number;

  /** width, height — размер экрана в метрах. */
  constructor(width = 0.61, height = 0.381) {
    this.canvas = document.createElement('canvas');
    this.W = this.canvas.width = Math.round(width / HERO_PIXEL_M);
    this.H = this.canvas.height = Math.round(height / HERO_PIXEL_M);
    const g = this.canvas.getContext('2d');
    if (!g) throw new Error('Нет 2D-контекста для экрана');
    this.g = g;
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.magFilter = THREE.NearestFilter;
    this.texture.minFilter = THREE.NearestFilter;
    this.texture.generateMipmaps = false;
  }

  /** Перерисовка не чаще 12 раз в секунду. */
  update(mode: ScreenMode, t: number, dt: number, clock: string): void {
    if (mode === 'work') this.typed += dt * 16;
    if (t - this.lastDraw < 1 / 12) return;
    this.lastDraw = t;
    if (mode === 'off') this.rect(0, 0, this.W, this.H, '#0b0b0d');
    else if (mode === 'lock') this.drawLock(t, clock);
    else this.drawEditor(t);
    this.texture.needsUpdate = true;
  }

  private rect(x: number, y: number, w: number, h: number, color: string): void {
    this.g.fillStyle = color;
    this.g.fillRect(x, y, w, h);
  }

  private drawLock(t: number, clock: string): void {
    const { W, H } = this;
    // Закатные обои: полосы с шахматным переходом и два слоя холмов.
    const stops = ['#1d2547', '#3f3563', '#7a4f78', '#c46f74', '#f0a27a'];
    for (let y = 0; y < H; y++) {
      const v = (y / H) * (stops.length - 1);
      const b = Math.floor(v);
      for (let x = 0; x < W; x++) {
        const step = v - b > BAYER[(x % 2) + (y % 2) * 2]! ? 1 : 0;
        this.rect(x, y, 1, 1, stops[Math.min(stops.length - 1, b + step)]!);
      }
    }
    for (const [color, base, amp, ph] of [
      ['#5a4f80', 0.68, 0.1, 0.4],
      ['#2a2d4c', 0.82, 0.07, 2.1],
    ] as const) {
      for (let x = 0; x < W; x++) {
        const top = Math.round(H * (base - Math.sin(x * 0.28 + ph) * amp));
        this.rect(x, top, 1, H - top, color);
      }
    }
    // Часы: крупные цифры, каждая точка цифры — квадрат 2×2, с мягкой тенью.
    const k = W >= 40 ? 2 : 1;
    const chars = clock.split('');
    const width = chars.reduce((s, ch) => s + ((DIGITS[ch]?.[0]?.length ?? 3) + 1) * k, -k);
    const y = Math.round(H * 0.16);
    for (const [color, off] of [
      ['#2a2140', 1],
      ['#fbf6ee', 0],
    ] as const) {
      let x = Math.round((W - width) / 2);
      for (const ch of chars) {
        const glyph = DIGITS[ch];
        if (!glyph) continue;
        glyph.forEach((row, gy) => [...row].forEach((bit, gx) => bit === '1' && this.rect(x + gx * k + off, y + gy * k + off, k, k, color)));
        x += (glyph[0]!.length + 1) * k;
      }
    }
    // Индикатор «всё сохранено» мягко мигает.
    this.rect(Math.floor(W / 2), H - 3, 1, 1, Math.sin(t * 2) > 0 ? '#9be27a' : '#5f8f4a');
  }

  private drawEditor(t: number): void {
    const { W, H } = this;
    const file = PROJECT_FILES[0]!;
    const shown = file.code.slice(0, Math.floor(this.typed % file.code.length));
    const lines = shown.split('\n');

    this.rect(0, 0, W, H, '#1f1f1f');
    this.rect(0, 0, W, 1, '#181818'); // заголовок окна
    this.rect(1, 0, 1, 1, '#ff5f57');
    this.rect(3, 0, 1, 1, '#febc2e');
    this.rect(0, 1, 1, H - 2, '#181818'); // панель значков
    this.rect(1, 1, 7, H - 2, '#1a1a1a'); // дерево файлов
    for (let i = 0; i < 7; i++) {
      const y = 3 + i * 2;
      if (i === 2) this.rect(1, y, 7, 1, '#04395e');
      this.rect(2 + (i % 3 === 0 ? 0 : 1), y, 2 + ((i * 3) % 4), 1, i === 2 ? '#e2c08d' : '#6f6f6f');
    }
    // Код: последние строки, по одной строке пикселей через одну.
    const rows = Math.floor((H - 4) / 2);
    const start = Math.max(0, lines.length - rows);
    const left = 10;
    for (let i = start; i < lines.length; i++) {
      const y = 2 + (i - start) * 2;
      this.rect(left - 1, y, 1, 1, i === lines.length - 1 ? '#8b8b8b' : '#3c3c3c'); // номер строки
      let x = left + 1;
      for (const tok of highlightLine(lines[i] ?? '')) {
        const len = Math.max(1, Math.round(tok.text.length * 0.45));
        if (tok.kind !== 'space' && x < W - 1) this.rect(x, y, Math.min(len, W - 1 - x), 1, mixColor(COLORS[tok.kind], '#1f1f1f', 0.08));
        x += len;
      }
      if (i === lines.length - 1 && Math.floor(t * 2.2) % 2 === 0 && x < W) this.rect(x, y, 1, 1, '#e6e6e6');
    }
    this.rect(0, H - 1, W, 1, '#181818'); // строка состояния
    this.rect(0, H - 1, 2, 1, '#0078d4');
  }
}
