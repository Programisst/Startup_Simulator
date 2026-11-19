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

describe('главы пути компании', () => {
  const texts = ru.goalsLadder as unknown as { chapters: Record<string, string>; chapterLine: string };

  it('шесть глав по три-четыре цели, у каждой есть название', () => {
    expect(content.chapters.map((c) => c.id)).toEqual(['garage', 'firstClients', 'team', 'investor', 'office', 'unicorn']);
    for (const c of content.chapters) {
      expect(c.milestones.length, c.id).toBeGreaterThanOrEqual(3);
      expect(c.milestones.length, c.id).toBeLessThanOrEqual(4);
      expect(texts.chapters[c.id]?.length ?? 0, c.id).toBeGreaterThan(3);
    }
  });

  it('главы идут подряд и вместе покрывают все цели ровно один раз', () => {
    expect(content.chapters.flatMap((c) => c.milestones)).toEqual(content.milestones.map((m) => m.id));
  });

  it('цели выполнимы по порядку: команда нужного размера помещается в офис, который уже снят', () => {
    const order = content.milestones.map((m) => m.id);
    const officeSeats = (i: number) => content.config.offices[i]!.seats;
    let office = 0;
    for (const id of order) {
      const c = content.milestones.find((m) => m.id === id)!.condition;
      if (c.minOffice !== undefined) office = Math.max(office, c.minOffice);
      if (c.minTeam !== undefined) expect(officeSeats(office), id).toBeGreaterThanOrEqual(c.minTeam);
    }
  });

  it('в начале идёт первая глава; сводка называет главу, её номер и сколько целей в ней пройдено', () => {
    const v = milestoneView(newGame(), content);
    expect(v.chapter).toMatchObject({ id: 'garage', index: 0, total: 6, goalsDone: 0, goalsTotal: 4, done: false, current: true });
    expect(v.chapters.filter((c) => c.current)).toHaveLength(1);
  });

  it('пройдены все цели главы — текущей становится следующая, а в ленте появляется запись', () => {
    const garage = content.chapters[0]!.milestones;
    const almost: GameState = { ...launchedGame(), users: 150, milestones: garage.slice(0, -1).map((id) => ({ id, day: 0 })), news: [] };
    expect(milestoneView(almost, content).chapter).toMatchObject({ id: 'garage', goalsDone: 3 });
    const after = tick(almost, quiet);
    expect(milestoneView(after, content).chapter).toMatchObject({ id: 'firstClients', index: 1, goalsDone: 0 });
    expect(milestoneView(after, content).chapters[0]).toMatchObject({ done: true, current: false });
    expect(after.news).toContainEqual(expect.objectContaining({ kind: 'chapter', id: 'garage' }));
  });

  it('когда всё пройдено, текущей считается последняя глава', () => {
    const all = { ...launchedGame(), milestones: content.milestones.map((m) => ({ id: m.id, day: 0 })) };
    const v = milestoneView(all, content);
    expect(v.current).toBeNull();
    expect(v.chapter).toMatchObject({ id: 'unicorn', done: true });
  });

  it('цель «предложение инвестора» засчитывается, когда предложение пришло, — даже если игрок отказался', () => {
    const before = content.milestones.slice(0, content.milestones.findIndex((m) => m.id === 'investorOffer')).map((m) => ({ id: m.id, day: 0 }));
    const base: GameState = { ...launchedGame(), milestones: before };
    expect(ids(tick(base, quiet))).not.toContain('investorOffer');
    const declined: GameState = { ...base, eventLog: [...base.eventLog, { day: 5, eventId: 'angelOffer', choiceId: 'decline', chanceResults: [] }] };
    expect(ids(tick(declined, quiet))).toContain('investorOffer');
  });

  it('старое сохранение с целями, которых больше нет, открывается и продолжает путь', () => {
    const old: GameState = { ...launchedGame(), milestones: [{ id: 'coreBuilt', day: 1 }, { id: 'users50000', day: 2 }, { id: 'team30', day: 3 }] };
    expect(milestoneView(old, content).current!.id).toBe('launched');
    expect(tick(old, quiet).status).toBe('running');
  });
});
