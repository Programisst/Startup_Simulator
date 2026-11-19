// Текстуры, нарисованные кодом: дубовый паркет, штукатурка, ковёр, лён. Без чужих картинок.
import * as THREE from 'three';
import { seeded } from '../room/engine/pixels';

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  if (!g) throw new Error('Нет 2D-контекста для текстуры');
  return [c, g];
}

function toTexture(c: HTMLCanvasElement, repeat: [number, number] = [1, 1], color = true): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat[0], repeat[1]);
  t.anisotropy = 8;
  if (color) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Светлый дуб «ёлочкой» не делаем — длинные доски, как в современной квартире. */
export function woodFloor(): THREE.CanvasTexture {
  // Чистые дубовые доски: у каждой свой оттенок, чёткие швы, длинные спокойные волокна.
  // Без пятен и сучков — в пикселях они превращаются в грязь.
  const [c, g] = canvas(1024, 1024);
  const rand = seeded(42);
  const tones = ['#d2ab7c', '#c9a072', '#d8b586', '#c49a6c', '#cfa777'];
  const rows = 8;
  const rowH = 1024 / rows;
  for (let r = 0; r < rows; r++) {
    let x = -Math.floor(rand() * 500);
    while (x < 1024) {
      const len = 520 + rand() * 380;
      g.fillStyle = tones[Math.floor(rand() * tones.length)]!;
      g.fillRect(x, r * rowH, len, rowH);
      // Две-три длинные волокнистые полосы, едва заметные.
      for (let k = 0; k < 3; k++) {
        const y0 = r * rowH + 14 + rand() * (rowH - 28);
        g.fillStyle = rand() < 0.5 ? 'rgba(150,104,62,0.10)' : 'rgba(240,214,170,0.12)';
        g.fillRect(x + 20, y0, len - 40, 6 + rand() * 6);
      }
      // Шов между досками и светлая фаска рядом.
      g.fillStyle = 'rgba(92,62,36,0.75)';
      g.fillRect(x + len - 3, r * rowH, 3, rowH);
      g.fillStyle = 'rgba(244,222,186,0.35)';
      g.fillRect(x + len, r * rowH, 2, rowH);
      x += len;
    }
    g.fillStyle = 'rgba(92,62,36,0.7)';
    g.fillRect(0, r * rowH, 1024, 3);
    g.fillStyle = 'rgba(244,222,186,0.3)';
    g.fillRect(0, r * rowH + 3, 1024, 2);
  }
  return toTexture(c, [1.6, 1.6]);
}

/** Тёплая белая штукатурка с еле заметной фактурой. */
export function plaster(base: string, strength = 10): THREE.CanvasTexture {
  const [c, g] = canvas(512, 512);
  g.fillStyle = base;
  g.fillRect(0, 0, 512, 512);
  const rand = seeded(7);
  for (let i = 0; i < 9000; i++) {
    const v = rand() < 0.5 ? 0 : 255;
    g.fillStyle = `rgba(${v},${v},${v},${(rand() * strength) / 255})`;
    g.fillRect(rand() * 512, rand() * 512, 1 + rand() * 2, 1 + rand() * 2);
  }
  return toTexture(c, [3, 2]);
}

/** Ковёр: графитовый ворс с тонкой каймой. */
export function rug(): THREE.CanvasTexture {
  const [c, g] = canvas(1024, 768);
  g.fillStyle = '#3a3b3f';
  g.fillRect(0, 0, 1024, 768);
  const rand = seeded(11);
  for (let i = 0; i < 60000; i++) {
    const v = 50 + rand() * 40;
    g.fillStyle = `rgba(${v},${v},${v + 4},0.35)`;
    g.fillRect(rand() * 1024, rand() * 768, 1.5, 1.5);
  }
  g.strokeStyle = 'rgba(210,200,184,0.55)';
  g.lineWidth = 6;
  g.strokeRect(40, 40, 944, 688);
  g.lineWidth = 2;
  g.strokeRect(58, 58, 908, 652);
  return toTexture(c);
}

/** Льняная ткань: мелкое плетение. */
export function linen(base: string): THREE.CanvasTexture {
  const [c, g] = canvas(256, 256);
  g.fillStyle = base;
  g.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 2) {
    g.fillStyle = `rgba(255,255,255,${y % 4 === 0 ? 0.06 : 0})`;
    g.fillRect(0, y, 256, 1);
  }
  for (let x = 0; x < 256; x += 3) {
    g.fillStyle = 'rgba(0,0,0,0.035)';
    g.fillRect(x, 0, 1, 256);
  }
  return toTexture(c, [4, 4]);
}

/** Постер над кроватью: абстрактные горы в духе обоев на компьютере. */
export function poster(): THREE.CanvasTexture {
  const [c, g] = canvas(600, 800);
  g.fillStyle = '#efe9df';
  g.fillRect(0, 0, 600, 800);
  g.fillStyle = '#e07a5f';
  g.beginPath();
  g.arc(390, 300, 90, 0, Math.PI * 2);
  g.fill();
  const hills: [string, number][] = [
    ['#9fb8a3', 470],
    ['#5f7f6c', 540],
    ['#2f3e46', 610],
  ];
  hills.forEach(([color, base], i) => {
    g.fillStyle = color;
    g.beginPath();
    g.moveTo(0, 800);
    for (let x = 0; x <= 600; x += 10) g.lineTo(x, base - Math.sin(x * 0.012 + i * 2) * 60 - Math.sin(x * 0.031 + i) * 22);
    g.lineTo(600, 800);
    g.fill();
  });
  g.fillStyle = '#2f3e46';
  g.font = '600 26px system-ui, sans-serif';
  g.fillText('SHIP IT', 48, 740);
  return toTexture(c);
}
