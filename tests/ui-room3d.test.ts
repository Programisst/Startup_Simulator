// «Мозги» 3D-комнаты: свет в разное время суток и предметы, у которых стоит герой.
import { describe, expect, it } from 'vitest';
import { lightingAt } from '../src/ui/room3d/lighting';
import { COLLIDERS, findInteraction, ROOM } from '../src/ui/room3d/layout';

describe('свет в комнате', () => {
  it('днём светит солнце, лампы выключены', () => {
    const day = lightingAt(13 * 60);
    expect(day.sun).toBeGreaterThan(0.8);
    expect(day.lamps).toBe(0);
  });

  it('ночью солнца нет, горят лампы и подсветка', () => {
    const night = lightingAt(23 * 60);
    expect(night.sun).toBe(0);
    expect(night.lamps).toBeGreaterThan(0.8);
    expect(night.ambient).toBeLessThan(lightingAt(13 * 60).ambient);
  });

  it('свет меняется плавно, без скачков', () => {
    for (let m = 0; m < 1440; m += 5) {
      const a = lightingAt(m);
      const b = lightingAt(m + 5);
      expect(Math.abs(a.sun - b.sun)).toBeLessThan(0.1);
      expect(Math.abs(a.lamps - b.lamps)).toBeLessThan(0.1);
    }
  });
});

describe('предметы рядом с героем', () => {
  it('у стола — компьютер', () => {
    expect(findInteraction({ x: 4.6, z: 1.45 })?.id).toBe('computer');
  });

  it('посреди комнаты — ничего', () => {
    expect(findInteraction({ x: 2.6, z: 3.2 })).toBeNull();
  });

  it('вся мебель стоит внутри комнаты', () => {
    for (const c of COLLIDERS) {
      expect(c.x).toBeGreaterThanOrEqual(0);
      expect(c.y).toBeGreaterThanOrEqual(0);
      expect(c.x + c.w).toBeLessThanOrEqual(ROOM.w);
      expect(c.y + c.h).toBeLessThanOrEqual(ROOM.d);
    }
  });
});
