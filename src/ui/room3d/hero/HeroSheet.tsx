// Лист кадров героя крупно — для проверки рисунка: room.html?sheet
import { useEffect, useRef } from 'react';
import { drawHero, HERO_H, HERO_W, type HeroPose, type OutfitId } from './hero';

// Каждая строка — один образ: стоит спереди, со спины, сбоку, моргает, сидит; потом 8 кадров шага сбоку.
const POSES: HeroPose[] = [
  { facing: 'down', walk: null, breath: 0, blink: false },
  { facing: 'up', walk: null, breath: 0, blink: false },
  { facing: 'right', walk: null, breath: 0, blink: false },
  { facing: 'down', walk: null, breath: 1, blink: true },
  { facing: 'up', walk: null, breath: 0, blink: false, sit: { typing: 0 } },
  ...Array.from({ length: 8 }, (_, i) => ({ facing: 'right' as const, walk: i / 8, breath: 0, blink: false })),
];
const ROWS: OutfitId[] = ['knit', 'shirt', 'overshirt'];

export function HeroSheet() {
  const ref = useRef<HTMLCanvasElement>(null);
  const zoom = 4;
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const g = c.getContext('2d')!;
    g.imageSmoothingEnabled = false;
    g.fillStyle = '#c9b8a0';
    g.fillRect(0, 0, c.width, c.height);
    ROWS.forEach((outfit, r) =>
      POSES.forEach((pose, i) => {
        g.drawImage(drawHero(pose, outfit).toCanvas(), i * (HERO_W - 6) * zoom, r * (HERO_H + 4) * zoom, HERO_W * zoom, HERO_H * zoom);
      }),
    );
  }, []);
  return <canvas ref={ref} width={(POSES.length * (HERO_W - 6) + 6) * zoom} height={ROWS.length * (HERO_H + 4) * zoom} style={{ imageRendering: 'pixelated' }} />;
}
