// Заставка входа: камера за 4–5 секунд подлетает к окну квартиры основателя и останавливается перед ним.
import { describe, expect, it } from 'vitest';
import { FLIGHT_SECONDS, flightCamera, HOME_SCREEN, HOME_WINDOW, LOGO, logoPixels, SCENE_H, SCENE_W } from '../src/ui/intro/scene';

const view = { w: 1440, h: 900 };

describe('полёт камеры к окну', () => {
  it('длится 4–5 секунд', () => {
    expect(FLIGHT_SECONDS).toBeGreaterThanOrEqual(4);
    expect(FLIGHT_SECONDS).toBeLessThanOrEqual(5);
  });

  it('в начале видно весь город, без пустых полей', () => {
    const cam = flightCamera(0, view);
    expect(SCENE_W * cam.scale).toBeGreaterThanOrEqual(view.w);
    expect(SCENE_H * cam.scale).toBeGreaterThanOrEqual(view.h);
  });

  it('экран компьютера — внутри окна квартиры', () => {
    expect(HOME_SCREEN.x).toBeGreaterThanOrEqual(HOME_WINDOW.x);
    expect(HOME_SCREEN.y).toBeGreaterThanOrEqual(HOME_WINDOW.y);
    expect(HOME_SCREEN.x + HOME_SCREEN.w).toBeLessThanOrEqual(HOME_WINDOW.x + HOME_WINDOW.w);
    expect(HOME_SCREEN.y + HOME_SCREEN.h).toBeLessThanOrEqual(HOME_WINDOW.y + HOME_WINDOW.h);
  });

  it('в конце окно основателя целиком в кадре, по центру и крупно', () => {
    const cam = flightCamera(1, view);
    const left = HOME_WINDOW.x * cam.scale + cam.x;
    const top = HOME_WINDOW.y * cam.scale + cam.y;
    const w = HOME_WINDOW.w * cam.scale;
    const h = HOME_WINDOW.h * cam.scale;
    expect(left).toBeGreaterThanOrEqual(0);
    expect(top).toBeGreaterThanOrEqual(0);
    expect(left + w).toBeLessThanOrEqual(view.w);
    expect(top + h).toBeLessThanOrEqual(view.h);
    expect(Math.abs(left + w / 2 - view.w / 2)).toBeLessThan(2);
    expect(Math.abs(top + h / 2 - view.h / 2)).toBeLessThan(2);
    expect(h).toBeGreaterThan(view.h * 0.75);
  });

  it('в начале приближение целое — пиксели ровные', () => {
    const s = flightCamera(0, view).scale;
    expect(Number.isInteger(s)).toBe(true);
  });

  it('приближение только растёт, без рывков', () => {
    let prev = flightCamera(0, view).scale;
    for (let t = 0.01; t <= 1; t += 0.01) {
      const s = flightCamera(t, view).scale;
      expect(s).toBeGreaterThanOrEqual(prev);
      // За сотую долю полёта приближение меняется не больше чем на 15 %.
      expect(s / prev).toBeLessThan(1.15);
      prev = s;
    }
  });

  it('за краем сцены никогда не видно пустоты', () => {
    for (let t = 0; t <= 1; t += 0.05) {
      const c = flightCamera(t, view);
      expect(c.x).toBeLessThanOrEqual(0.5);
      expect(c.y).toBeLessThanOrEqual(0.5);
      expect(c.x + SCENE_W * c.scale).toBeGreaterThanOrEqual(view.w - 0.5);
      expect(c.y + SCENE_H * c.scale).toBeGreaterThanOrEqual(view.h - 0.5);
    }
  });
});

describe('логотип из пикселей', () => {
  it('влезает в отведённое место и состоит из двух строк', () => {
    const px = logoPixels();
    expect(px.length).toBeGreaterThan(100);
    for (const p of px) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThan(LOGO.w);
      expect(p.y).toBeLessThan(LOGO.h);
    }
    expect(new Set(px.map((p) => p.line))).toEqual(new Set([0, 1]));
  });

  it('один и тот же логотип каждый раз', () => {
    expect(logoPixels()).toEqual(logoPixels());
  });
});

