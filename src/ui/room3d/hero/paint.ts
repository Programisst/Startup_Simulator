// Маленький «пиксельный художник»: рисует фигуры по одному пикселю с объёмной светотенью.
// Каждая фигура задаётся расстоянием до края (отрицательное — внутри), по нему же считается,
// куда «смотрит» поверхность, и выбирается один из трёх тонов: тень, основной, свет.

/** Тона детали: [кант, тень, основной, свет]. */
export type Tones = readonly [string, string, string, string];

export interface Shape {
  /** Расстояние от точки до края фигуры в пикселях; меньше нуля — внутри. */
  sdf: (x: number, y: number) => number;
  /** Половина толщины фигуры — насколько она «выпуклая». */
  thick: number;
}

/**
 * Холст из пикселей. Рисуем в «условных» пикселях (сетка 32×48), а хранится всё
 * в `scale` раз подробнее: края фигур и мелкие детали получаются тоньше и аккуратнее.
 */
export class PixelBuffer {
  readonly px: (string | null)[];
  /** Настоящий размер в пикселях. */
  readonly w: number;
  readonly h: number;
  constructor(
    width: number,
    height: number,
    readonly scale = 1,
  ) {
    this.w = width * scale;
    this.h = height * scale;
    this.px = new Array<string | null>(this.w * this.h).fill(null);
  }

  /** Настоящий пиксель. */
  get(x: number, y: number): string | null {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return null;
    return this.px[y * this.w + x] ?? null;
  }

  /** Настоящий пиксель — для самых мелких деталей (блик в глазу). */
  raw(x: number, y: number, color: string | null): void {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    this.px[Math.floor(y) * this.w + Math.floor(x)] = color;
  }

  /** Условный пиксель: закрашивает квадрат scale×scale. */
  set(x: number, y: number, color: string | null): void {
    const k = this.scale;
    const x0 = Math.floor(x) * k;
    const y0 = Math.floor(y) * k;
    for (let dy = 0; dy < k; dy++) for (let dx = 0; dx < k; dx++) this.raw(x0 + dx, y0 + dy, color);
  }

  /** Обводит весь рисунок снаружи одним цветом. */
  outline(color: string): void {
    const marks: number[] = [];
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        if (this.get(x, y)) continue;
        if (this.get(x - 1, y) || this.get(x + 1, y) || this.get(x, y - 1) || this.get(x, y + 1)) marks.push(y * this.w + x);
      }
    }
    for (const i of marks) this.px[i] = color;
  }

  toCanvas(flip = false): HTMLCanvasElement {
    const c = document.createElement('canvas');
    c.width = this.w;
    c.height = this.h;
    const g = c.getContext('2d')!;
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        const color = this.get(flip ? this.w - 1 - x : x, y);
        if (!color) continue;
        g.fillStyle = color;
        g.fillRect(x, y, 1, 1);
      }
    }
    return c;
  }
}

// ——— Фигуры ———

export function ellipse(cx: number, cy: number, rx: number, ry: number): Shape {
  const m = Math.min(rx, ry);
  return { sdf: (x, y) => (Math.hypot((x - cx) / rx, (y - cy) / ry) - 1) * m, thick: m };
}

export function capsule(x0: number, y0: number, x1: number, y1: number, r: number): Shape {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len2 = dx * dx + dy * dy || 1;
  return {
    sdf: (x, y) => {
      const t = Math.max(0, Math.min(1, ((x - x0) * dx + (y - y0) * dy) / len2));
      return Math.hypot(x - (x0 + dx * t), y - (y0 + dy * t)) - r;
    },
    thick: r,
  };
}

export function roundRect(x0: number, y0: number, x1: number, y1: number, r: number): Shape {
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  const hx = (x1 - x0) / 2 - r;
  const hy = (y1 - y0) / 2 - r;
  return {
    sdf: (x, y) => {
      const qx = Math.abs(x - cx) - hx;
      const qy = Math.abs(y - cy) - hy;
      return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
    },
    thick: Math.min(x1 - x0, y1 - y0) / 2,
  };
}

// Свет падает сверху слева и немного спереди.
const L = (() => {
  const v = [-0.45, -0.4, 0.8];
  const n = Math.hypot(v[0]!, v[1]!, v[2]!);
  return v.map((k) => k / n) as [number, number, number];
})();

export interface PaintOptions {
  /** Рисовать ли тёмный кант вокруг детали — так детали не сливаются друг с другом. */
  rim?: boolean;
  /** Рисовать только там, где функция вернула true. */
  clip?: (x: number, y: number) => boolean;
  /** Сдвиг освещения: больше нуля — светлее, меньше — темнее (для дальней руки и ноги). */
  bias?: number;
}

export function paint(buf: PixelBuffer, shape: Shape, tones: Tones, opts: PaintOptions = {}): void {
  const { sdf, thick } = shape;
  const bias = opts.bias ?? 0;
  const k = buf.scale;
  // Кант — около одного настоящего пикселя.
  const rimWidth = k > 1 ? 1.15 / k : 0.85;
  for (let y = 0; y < buf.h; y++) {
    for (let x = 0; x < buf.w; x++) {
      const sx = (x + 0.5) / k;
      const sy = (y + 0.5) / k;
      if (opts.clip && !opts.clip(Math.floor(sx), Math.floor(sy))) continue;
      const d = sdf(sx, sy);
      if (d >= 0) {
        if (opts.rim && d < rimWidth) buf.raw(x, y, tones[0]);
        continue;
      }
      const gx = sdf(sx + 0.5, sy) - sdf(sx - 0.5, sy);
      const gy = sdf(sx, sy + 0.5) - sdf(sx, sy - 0.5);
      const gl = Math.hypot(gx, gy) || 1;
      const a = Math.min(1, -d / Math.max(0.8, thick));
      const nz = Math.sqrt(1 - (1 - a) * (1 - a));
      const side = 1 - a;
      const light = (gx / gl) * side * L[0] + (gy / gl) * side * L[1] + nz * L[2] + bias;
      buf.raw(x, y, light > 0.95 ? tones[3] : light > 0.42 ? tones[2] : tones[1]);
    }
  }
}

/** Ставит отдельные пиксели: [x, y] → цвет. */
export function dots(buf: PixelBuffer, color: string, points: readonly (readonly [number, number])[]): void {
  for (const [x, y] of points) buf.set(Math.round(x), Math.round(y), color);
}
