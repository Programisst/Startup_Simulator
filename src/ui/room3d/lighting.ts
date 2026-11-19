// Свет в 3D-комнате по времени суток. Опирается на то же небо, что и пиксельная версия.
import { skyAt } from '../room/engine/sky';

export interface Lighting {
  /** 0…1 — сила солнца через окно. */
  sun: number;
  /** 0…1 — насколько горят лампы и подсветка. */
  lamps: number;
  /** 0…1 — общий рассеянный свет. */
  ambient: number;
  skyTop: string;
  skyBottom: string;
  stars: boolean;
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

export function lightingAt(minutes: number): Lighting {
  const sky = skyAt(minutes);
  return {
    sun: clamp01(sky.sun),
    lamps: clamp01((sky.darkness - 0.15) / 0.35),
    ambient: 1 - sky.darkness * 0.85,
    skyTop: sky.top,
    skyBottom: sky.bottom,
    stars: sky.stars,
  };
}
