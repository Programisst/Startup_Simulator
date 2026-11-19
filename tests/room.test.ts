import { describe, expect, it } from 'vitest';
import { roomClock, roomView, tick } from '../src/core';
import { content } from '../src/content';
import { advance, launchedGame, newGame, run } from './helpers';

const coreFeature = content.features.saas.find((f) => f.core)!;

describe('roomView: что квартира показывает по расчёту игры', () => {
  it('в начале партии основателю нечем заняться', () => {
    const v = roomView(newGame(), content);
    expect(v.activity).toBe('idle');
    expect(v.task).toBeNull();
    expect(v.queued).toBe(0);
    expect(v.timeRuns).toBe(true);
  });

  it('с задачей в очереди основатель работает над продуктом', () => {
    const s = run(newGame(), { type: 'queueFeature', featureId: coreFeature.id });
    const v = roomView(s, content);
    expect(v.activity).toBe('building');
    expect(v.task).toEqual({ kind: 'feature', featureId: coreFeature.id, progress: 0, daysLeft: coreFeature.cost });
  });

  it('прогресс задачи растёт, а оставшиеся дни совпадают с расчётом игры', () => {
    let s = run(newGame(), { type: 'queueFeature', featureId: coreFeature.id });
    s = advance(s, 2);
    const v = roomView(s, content);
    expect(v.task!.progress).toBeCloseTo(2 / coreFeature.cost, 5);
    const daysLeft = v.task!.daysLeft!;
    const almost = advance(s, daysLeft - 1);
    expect(almost.doneFeatures).not.toContain(coreFeature.id);
    expect(advance(almost, 1).doneFeatures).toContain(coreFeature.id);
  });

  it('спешка и подработка меняют срок задачи', () => {
    const base = run(newGame(), { type: 'queueFeature', featureId: coreFeature.id });
    const normal = roomView(base, content).task!.daysLeft!;
    const rushed = roomView(run(base, { type: 'setRush', rush: true }), content).task!.daysLeft!;
    const half = roomView(run(base, { type: 'setSideJob', share: 0.5 }), content).task!.daysLeft!;
    expect(rushed).toBeLessThan(normal);
    expect(half).toBe(normal * 2);
  });

  it('полная подработка: основатель занят заказом, срок задачи неизвестен', () => {
    let s = run(newGame(), { type: 'queueFeature', featureId: coreFeature.id });
    s = run(s, { type: 'setSideJob', share: 1 });
    const v = roomView(s, content);
    expect(v.activity).toBe('sideJob');
    expect(v.workShare).toBe(0);
    expect(v.task!.daysLeft).toBeNull();
  });

  it('частичная подработка без задач — основатель на подработке', () => {
    const v = roomView(run(newGame(), { type: 'setSideJob', share: 0.25 }), content);
    expect(v.activity).toBe('sideJob');
    expect(v.workShare).toBe(0.75);
  });

  it('минус на счёте важнее остального и показывает дни до банкротства', () => {
    const s = { ...newGame(), cash: -50, negativeCashDays: 4 };
    const v = roomView(s, content);
    expect(v.activity).toBe('broke');
    expect(v.alerts.daysToBankruptcy).toBe(content.config.bankruptcyDays - 4);
    expect(roomView(newGame(), content).alerts.daysToBankruptcy).toBeNull();
  });

  it('повторяемые задачи показывают прогресс текущего шага', () => {
    const s = { ...launchedGame(), bugs: 3, tasks: [{ kind: 'bugfix' as const, progress: content.config.bugfixCost / 2 }] };
    const v = roomView(s, content);
    expect(v.task!.kind).toBe('bugfix');
    expect(v.task!.featureId).toBeNull();
    expect(v.task!.progress).toBeCloseTo(0.5, 5);
  });

  it('готовность к запуску: только когда основа сделана и продукт ещё не вышел', () => {
    expect(roomView(newGame(), content).canLaunch).toBe(false);
    const built = advance(run(newGame(), { type: 'queueFeature', featureId: coreFeature.id }), coreFeature.cost + 1);
    expect(roomView(built, content).canLaunch).toBe(true);
    expect(roomView(run(built, { type: 'launch' }), content).canLaunch).toBe(false);
    expect(roomView(launchedGame(), content).launched).toBe(true);
  });

  it('тревожные сигналы: перегрузка серверов, ошибки, событие', () => {
    const s = { ...launchedGame(), users: 5000, capacity: 1000, bugs: 12, pendingEvent: 'cashCrisis' };
    const v = roomView(s, content);
    expect(v.alerts.overloaded).toBe(true);
    expect(v.alerts.bugs).toBe(12);
    expect(v.alerts.pendingEvent).toBe('cashCrisis');
    expect(v.timeRuns).toBe(false);
  });

  it('после конца партии время в квартире стоит', () => {
    expect(roomView({ ...newGame(), status: 'bankrupt' }, content).timeRuns).toBe(false);
  });

  it('календарь: месяц из 30 дней, неделя из 7, партия начинается в понедельник', () => {
    expect(roomView(newGame(), content).calendar).toEqual({ day: 0, dayOfMonth: 1, month: 1, year: 1, weekday: 0 });
    const later = roomView({ ...newGame(), day: 395 }, content).calendar;
    expect(later).toEqual({ day: 395, dayOfMonth: 6, month: 2, year: 2, weekday: 395 % 7 });
  });

  it('сводка продукта для экрана ноутбука совпадает с состоянием игры', () => {
    const s = advance(launchedGame(), 40);
    const v = roomView(s, content);
    expect(v.product.users).toBe(s.users);
    expect(v.product.paying).toBe(s.paying);
    expect(v.product.quality).toBe(s.quality);
    expect(v.product.reputation).toBe(s.reputation);
    const revenue30 = s.recentDays.slice(-30).reduce((sum, d) => sum + d.revenue, 0);
    expect(v.product.revenue30).toBeCloseTo(revenue30, 6);
  });

  it('не меняет состояние игры и даёт один и тот же ответ', () => {
    const s = advance(launchedGame(), 10);
    const copy = structuredClone(s);
    const a = roomView(s, content);
    const b = roomView(s, content);
    expect(s).toEqual(copy);
    expect(a).toEqual(b);
    expect(tick(s, content)).toEqual(tick(copy, content));
  });
});

describe('roomClock: часы в квартире внутри одного игрового дня', () => {
  it('день начинается утром и идёт ровно сутки', () => {
    expect(roomClock(0)).toBe(8 * 60);
    expect(roomClock(0.5)).toBe(20 * 60);
    expect(roomClock(0.75)).toBe(2 * 60);
  });

  it('всегда остаётся в пределах суток', () => {
    for (const p of [-1, 0, 0.3, 0.999, 1, 5]) {
      const m = roomClock(p);
      expect(m).toBeGreaterThanOrEqual(0);
      expect(m).toBeLessThan(1440);
    }
  });
});
