// Цели на пути компании и объяснение причины банкротства.
import { describe, expect, it } from 'vitest';
import { bankruptcyCause, milestoneView, nextMilestone, teamOf, tick, type Effect, type Employee, type GameState } from '../src/core';
import { content } from '../src/content';
import ru from '../src/content/ru/ui.json';
import { advance, deepFreeze, launchedGame, newGame, run } from './helpers';

const quiet = { ...content, events: [] };
const ids = (s: GameState) => (s.milestones ?? []).map((m) => m.id);
const worker: Employee = { id: 900, role: 'developer', skill: 1, trait: 'calm', salaryAsk: 3000, salary: 3000, nameSeed: 1, hiredDay: 0, motivation: 70 };

describe('цели на пути компании', () => {
  it('в начале ближайшая цель — основа продукта, и ничего не пройдено', () => {
    const v = milestoneView(newGame(), content);
    expect(v.current).toMatchObject({ id: 'coreBuilt', value: 0, target: 1, share: 0 });
    expect(v.done).toEqual([]);
    expect(v.total).toBe(content.milestones.length);
  });

  it('у каждой цели есть название и подсказка, награды без случайности, цели не повторяются', () => {
    const texts = ru.goalsLadder.items as Record<string, { title: string; hint: string }>;
    expect(Object.keys(texts).sort()).toEqual(content.milestones.map((m) => m.id).sort());
    expect(new Set(content.milestones.map((m) => m.id)).size).toBe(content.milestones.length);
    const hasChance = (effects: Effect[]) => effects.some((e) => e.type === 'chance');
    for (const m of content.milestones) {
      expect(texts[m.id]!.title.length, m.id).toBeGreaterThan(5);
      expect(texts[m.id]!.hint.length, m.id).toBeGreaterThan(10);
      expect(hasChance(m.effects), m.id).toBe(false);
      expect(m.effects.length, m.id).toBeGreaterThan(0);
    }
  });

  it('готовая основа засчитывается на следующий день и открывает следующую цель', () => {
    let s = run(newGame(), { type: 'queueFeature', featureId: 'core' });
    s = advance(s, 40);
    expect(ids(s)).toEqual(['coreBuilt']);
    expect(nextMilestone(s, content)!.id).toBe('launched');
    s = advance(run(s, { type: 'launch' }), 1);
    expect(ids(s)).toEqual(['coreBuilt', 'launched']);
    expect(s.milestones![1]!.day).toBe(s.day - 1);
  });

  it('за день засчитывается одна цель, даже если выполнено сразу несколько', () => {
    const s = { ...launchedGame(), users: 5000 };
    const before = ids(s).length;
    const a = tick(s, quiet);
    expect(ids(a)).toHaveLength(before + 1);
    expect(ids(tick(a, quiet))).toHaveLength(before + 2);
  });

  it('награда выдаётся один раз', () => {
    const upTo = (id: string) => content.milestones.slice(0, content.milestones.findIndex((m) => m.id === id)).map((m) => ({ id: m.id, day: 0 }));
    const s: GameState = { ...launchedGame(), users: 120, milestones: upTo('users100') };
    const plain = tick({ ...s, milestones: content.milestones.map((m) => ({ id: m.id, day: 0 })) }, quiet);
    const rewarded = tick(s, quiet);
    expect(rewarded.cash - plain.cash).toBeCloseTo(100, 6);
    expect(ids(rewarded).at(-1)).toBe('users100');
    const later = tick(rewarded, quiet);
    expect(ids(later).filter((id) => id === 'users100')).toHaveLength(1);
  });

  it('прогресс показывает, сколько набрано из нужного', () => {
    const done = content.milestones.slice(0, content.milestones.findIndex((m) => m.id === 'users100')).map((m) => ({ id: m.id, day: 0 }));
    const v = milestoneView({ ...launchedGame(), users: 37, milestones: done }, content);
    expect(v.current).toMatchObject({ id: 'users100', value: 37, target: 100, cashReward: 100 });
    expect(v.current!.share).toBeCloseTo(0.37, 6);
  });

  it('когда все цели пройдены, ближайшей нет и игра идёт дальше', () => {
    const s = { ...launchedGame(), milestones: content.milestones.map((m) => ({ id: m.id, day: 0 })) };
    expect(milestoneView(s, content).current).toBeNull();
    expect(tick(s, quiet).day).toBe(s.day + 1);
  });

  it('цели не сдвигают случайность и не меняют исходное состояние', () => {
    const s = deepFreeze({ ...launchedGame(), users: 5000 });
    const withGoals = tick(s, quiet);
    const without = tick(s, { ...quiet, milestones: [] });
    expect(withGoals.rng).toBe(without.rng);
    expect(milestoneView(s, content)).toEqual(milestoneView(s, content));
  });

  it('старое сохранение без целей открывается и догоняет цели по одной в день', () => {
    const old = { ...advance(launchedGame(), 5) };
    delete old.milestones;
    expect(milestoneView(old, content).current!.id).toBe('coreBuilt');
    expect(ids(tick(old, quiet))).toEqual(['coreBuilt']);
  });
});

describe('почему кончились деньги', () => {
  it('продукт не вышел — причина в этом', () => {
    expect(bankruptcyCause(newGame())).toBe('noProduct');
  });

  it('зарплаты больше расходов на жизнь — причина в найме', () => {
    const s = newGame();
    expect(bankruptcyCause({ ...s, team: { ...teamOf(s, content), employees: [worker] } })).toBe('salaries');
  });

  it('реклама, серверы и займы тоже называются, если тяжелее всего остального', () => {
    expect(bankruptcyCause({ ...launchedGame(), adSpendPerDay: 60 })).toBe('ads');
    expect(bankruptcyCause({ ...launchedGame(), capacity: 1_000_000 })).toBe('servers');
    expect(bankruptcyCause({ ...launchedGame(), loans: [{ dailyPayment: 50, untilDay: 9999 }] })).toBe('loans');
  });

  it('продукт вышел, но ничего лишнего не тратилось — он просто мало зарабатывал', () => {
    expect(bankruptcyCause(launchedGame())).toBe('slowGrowth');
  });

  it('у каждой причины есть объяснение для игрока', () => {
    const texts = ru.end.cause as Record<string, string>;
    for (const cause of ['noProduct', 'salaries', 'ads', 'servers', 'loans', 'slowGrowth']) expect(texts[cause]!.length, cause).toBeGreaterThan(40);
  });
});
