// Силы основателя, лента новостей и развилки во время разработки.
import { describe, expect, it } from 'vitest';
import { applyCommand, energyFactor, founderWorkPerDay, roomView, teamView, tick, type GameContent, type GameState } from '../src/core';
import { content } from '../src/content';
import en from '../src/content/en/events.json';
import ru from '../src/content/ru/events.json';
import ui from '../src/content/ru/ui.json';
import { advance, deepFreeze, launchedGame, newGame, run } from './helpers';

const f = content.config.founder;
const quiet: GameContent = { ...content, events: [], milestones: [] };
const days = (s: GameState, n: number, c: GameContent = quiet) => {
  let x = s;
  for (let i = 0; i < n; i++) x = tick(x, c);
  return x;
};
const working = () => run(newGame(), { type: 'queueFeature', featureId: 'core' });

describe('силы основателя', () => {
  it('новая партия — основатель полон сил и работает в полную силу', () => {
    const v = roomView(newGame(), content).founder;
    expect(v).toMatchObject({ energy: 100, pace: 1, tired: false, exhausted: false, coffeeActive: false, coffeeReady: true });
  });

  it('рабочий день отнимает силы, спешка — почти вдвое больше', () => {
    expect(days(working(), 1).energy).toBeCloseTo(100 - f.drainPerDay, 6);
    expect(days(run(working(), { type: 'setRush', rush: true }), 1).energy).toBeCloseTo(100 - f.drainPerDay * f.rushDrain, 6);
  });

  it('подработка утомляет так же, как продукт; день без дел возвращает силы', () => {
    expect(days(run(newGame(), { type: 'setSideJob', share: 0.5 }), 1).energy).toBeCloseTo(100 - f.drainPerDay, 6);
    expect(days({ ...newGame(), energy: 40 }, 1).energy).toBeCloseTo(40 + f.idleRecovery, 6);
  });

  it('пока сил больше половины, скорость не падает; дальше — падает до половины', () => {
    expect(energyFactor(100, f)).toBe(1);
    expect(energyFactor(f.tiredBelow, f)).toBe(1);
    expect(energyFactor(f.tiredBelow / 2, f)).toBeCloseTo((1 + f.minFactor) / 2, 6);
    expect(energyFactor(0, f)).toBe(f.minFactor);
    expect(founderWorkPerDay({ ...newGame(), energy: 0 }, content.config)).toBeCloseTo(f.minFactor, 6);
  });

  it('уставший основатель делает ту же функцию заметно дольше', () => {
    const fresh = roomView(working(), content).task!.daysLeft!;
    const tired = roomView({ ...working(), energy: 0 }, content).task!.daysLeft!;
    expect(tired).toBe(fresh * 2);
    expect(teamView({ ...working(), energy: 0 }, content).founderWorkPerDay).toBeCloseTo(0.5, 6);
  });

  it('силы не выходят за 0…100', () => {
    expect(days({ ...working(), energy: 0.5 }, 3).energy).toBe(0);
    expect(days({ ...newGame(), energy: 99 }, 3).energy).toBe(100);
  });

  it('день отдыха: работа стоит, силы возвращаются, на следующий день основатель снова работает', () => {
    const tired = { ...working(), energy: 30 };
    const rested = tick(run(tired, { type: 'rest' }), quiet);
    expect(rested.energy).toBeCloseTo(30 + f.restGain, 6);
    expect(rested.tasks[0]).toMatchObject({ progress: 0 });
    expect(rested.resting).toBe(false);
    expect(tick(rested, quiet).tasks[0]!.progress).toBeGreaterThan(0);
  });

  it('команда в день отдыха основателя работает', () => {
    const s = run(working(), { type: 'rest' });
    const withDev: GameState = { ...s, team: { ...s.team!, employees: [{ id: 9, role: 'developer', skill: 1, trait: 'calm', salaryAsk: 1, salary: 1, nameSeed: 1, hiredDay: 0, motivation: 70 }] } };
    expect(tick(withDev, quiet).tasks[0]!.progress).toBeCloseTo(1, 6);
  });

  it('кофе: рывок на несколько дней, потом перерыв', () => {
    const s = run(working(), { type: 'coffee' });
    expect(s.energy).toBe(100 - f.coffeeCost);
    expect(founderWorkPerDay(s, content.config)).toBeCloseTo(f.coffeeBoost, 6);
    expect(roomView(s, content).founder).toMatchObject({ coffeeActive: true, coffeeDaysLeft: f.coffeeDays, coffeeReady: false, coffeeReadyInDays: f.coffeeCooldownDays });
    expect(applyCommand(s, { type: 'coffee' }, content)).toEqual({ ok: false, error: 'coffeeTooSoon' });
    const after = days(s, f.coffeeDays);
    expect(founderWorkPerDay(after, content.config)).toBe(1);
    expect(applyCommand(days(s, f.coffeeCooldownDays), { type: 'coffee' }, content).ok).toBe(true);
  });

  it('вымотанный основатель добавляет ошибку к готовой функции', () => {
    const almost = (energy: number): GameState => ({ ...working(), energy, tasks: [{ kind: 'feature', featureId: 'core', progress: 24.9, asked: true }] });
    expect(tick(almost(10), quiet).bugs).toBe(tick(almost(100), quiet).bugs + 1);
  });

  it('старое сохранение без сил открывается: основатель считается отдохнувшим', () => {
    const old = { ...launchedGame() };
    delete old.energy;
    delete old.news;
    expect(roomView(old, content).founder.energy).toBe(100);
    expect(tick(old, quiet).energy).toBeGreaterThan(90);
  });

  it('команды отдыха и кофе не меняют исходное состояние', () => {
    const s = deepFreeze(working());
    run(s, { type: 'rest' });
    run(s, { type: 'coffee' });
  });
});

describe('лента новостей', () => {
  const kinds = (s: GameState) => (s.news ?? []).map((n) => n.kind);

  it('готовая функция попадает в ленту', () => {
    const s = advance(working(), 30);
    expect(s.news).toContainEqual(expect.objectContaining({ kind: 'featureDone', id: 'core' }));
  });

  it('пересечение отметок по пользователям: в ленте самая высокая за день', () => {
    const s = tick({ ...launchedGame(), users: 9.9 }, quiet);
    expect(s.news?.at(-1)).toMatchObject({ kind: 'users', value: 10 });
    const jump = tick({ ...launchedGame(), users: 60, capacity: 10_000 }, quiet);
    expect((jump.news ?? []).filter((n) => n.kind === 'users')).toEqual([]);
  });

  it('после запуска раз в несколько дней приходит отзыв, и тон зависит от качества', () => {
    const base = { ...launchedGame(), users: 500, capacity: 10_000 };
    const s = days(base, 40);
    const reviews = (s.news ?? []).filter((n) => n.kind === 'review');
    expect(reviews.length).toBeGreaterThanOrEqual(3);
    for (const r of reviews) {
      expect(['good', 'mixed', 'bad']).toContain(r.tone);
      expect(r.variant).toBeGreaterThanOrEqual(0);
      expect(r.variant).toBeLessThan(8);
    }
  });

  it('до запуска отзывов нет', () => {
    expect(kinds(days(working(), 20))).not.toContain('review');
  });

  it('конец месяца после запуска: в ленте прибыль или убыток', () => {
    const s = days({ ...launchedGame(), users: 100 }, 31);
    expect(kinds(s).some((k) => k === 'monthLoss' || k === 'monthProfit')).toBe(true);
  });

  it('перегрузка серверов и усталость тоже попадают в ленту', () => {
    expect(kinds(tick({ ...launchedGame(), users: 99.9, capacity: 100, adSpendPerDay: 500, cash: 100_000 }, quiet))).toContain('overload');
    expect(kinds(tick({ ...working(), energy: 50.5 }, quiet))).toContain('tired');
  });

  it('лента хранит только последние записи и не сдвигает случайность', () => {
    const s = days({ ...launchedGame(), users: 500, capacity: 10_000 }, 500);
    expect(s.news!.length).toBeLessThanOrEqual(40);
    const a = days(launchedGame(), 30);
    expect(a.rng).toBe(days({ ...launchedGame(), news: [] }, 30).rng);
  });

  it('для каждого вида новости и каждого отзыва есть текст', () => {
    const feed = ui.feed as { items: Record<string, string>; reviews: Record<string, string[]> };
    for (const kind of ['users', 'paying', 'featureDone', 'overload', 'monthProfit', 'monthLoss', 'tired']) expect(feed.items[kind]?.length ?? 0, kind).toBeGreaterThan(5);
    for (const tone of ['good', 'mixed', 'bad']) expect(feed.reviews[tone]).toHaveLength(8);
  });
});

describe('развилки во время разработки', () => {
  const dev = content.events.filter((e) => e.dev);

  it('развилок несколько, у каждой первый вариант — «продолжать как шло», без последствий', () => {
    expect(dev.length).toBeGreaterThanOrEqual(5);
    for (const d of dev) expect(d.choices[0]!.effects, d.id).toEqual([]);
  });

  it('в текстах развилок есть название функции, на русском и английском', () => {
    for (const d of dev) {
      expect(JSON.stringify((ru as Record<string, unknown>)[d.id]), d.id).toContain('{{feature}}');
      expect(JSON.stringify((en as Record<string, unknown>)[d.id]), d.id).toContain('{{feature}}');
    }
  });

  it('развилка возникает на середине работы над крупной функцией, один раз', () => {
    let s = working();
    s = days(s, 12, content);
    expect(s.pendingEvent).toBeNull();
    s = days(s, 1, content);
    expect(dev.map((d) => d.id)).toContain(s.pendingEvent);
    expect(s.tasks[0]).toMatchObject({ asked: true });
    // Время стоит, пока игрок не ответит.
    expect(tick(s, content)).toBe(s);
    const answered = run(s, { type: 'chooseEvent', choiceId: dev.find((d) => d.id === s.pendingEvent)!.choices[0]!.id });
    const later = advance(answered, 11);
    expect(later.eventLog.filter((e) => dev.some((d) => d.id === e.eventId))).toHaveLength(1);
  });

  it('развилки не выпадают как случайные события', () => {
    // Очередь пуста, функций в работе нет — значит, любая развилка могла бы появиться только как случайное событие.
    const start = { ...launchedGame(), cash: 1e6 };
    const count = (x: GameState) => x.eventLog.filter((e) => dev.some((d) => d.id === e.eventId)).length;
    expect(count(advance(start, 400))).toBe(count(start));
  });

  it('у короткой функции развилки нет', () => {
    const short = { ...content, config: { ...content.config, founder: { ...f, dilemmaMinCost: 999 } } };
    expect(days(working(), 20, short).pendingEvent).toBeNull();
  });

  it('выбор меняет ход работы: срезать путь — быстрее, довести до блеска — дольше, но качественнее', () => {
    const at = (id: string): GameState => ({ ...working(), tasks: [{ kind: 'feature', featureId: 'core', progress: 13, asked: true }], pendingEvent: id, eventLog: [{ day: 0, eventId: id, choiceId: null, chanceResults: [] }] });
    const cut = run(at('devScope'), { type: 'chooseEvent', choiceId: 'cutScope' });
    expect(cut.tasks[0]).toMatchObject({ progress: 18 });
    const gold = run(at('devScope'), { type: 'chooseEvent', choiceId: 'goldPlate' });
    expect(gold.tasks[0]).toMatchObject({ progress: 10 });
    expect(gold.polish).toBe(3);
    const lib = run(at('devShortcut'), { type: 'chooseEvent', choiceId: 'useLibrary' });
    expect(lib.debt).toBe(6);
    expect(roomView(lib, content).task!.daysLeft).toBeLessThan(roomView(at('devShortcut'), content).task!.daysLeft!);
  });

  it('прогресс не уходит в минус, очки качества тоже', () => {
    const s: GameState = { ...working(), tasks: [{ kind: 'feature', featureId: 'core', progress: 1, asked: true }], pendingEvent: 'devScope', eventLog: [{ day: 0, eventId: 'devScope', choiceId: null, chanceResults: [] }] };
    expect(run(s, { type: 'chooseEvent', choiceId: 'goldPlate' }).tasks[0]).toMatchObject({ progress: 0 });
    expect(run(s, { type: 'chooseEvent', choiceId: 'cutScope' }).polish).toBe(0);
  });
});

describe('набор кода самим игроком', () => {
  it('набранные знаки дают сосредоточенность, полная — ускоряет основателя в полтора раза', () => {
    const half = run(working(), { type: 'typeCode', chars: f.focusChars / 2 });
    expect(half.focus).toBeCloseTo(0.5, 6);
    expect(founderWorkPerDay(half, content.config)).toBeCloseTo(1 + f.focusBonus / 2, 6);
    const full = run(half, { type: 'typeCode', chars: f.focusChars * 5 });
    expect(full.focus).toBe(1);
    expect(founderWorkPerDay(full, content.config)).toBeCloseTo(1 + f.focusBonus, 6);
    expect(roomView(full, content).founder).toMatchObject({ focus: 1, focusBoost: f.focusBonus });
  });

  it('функция действительно делается быстрее', () => {
    const plain = roomView(working(), content).task!.daysLeft!;
    const focused = roomView(run(working(), { type: 'typeCode', chars: f.focusChars }), content).task!.daysLeft!;
    expect(focused).toBeLessThan(plain);
    // Набор ещё и сразу двигает задачу (tests/typing.test.ts), поэтому дней может остаться даже меньше.
    expect(focused).toBeLessThanOrEqual(Math.ceil(plain / (1 + f.focusBonus)));
  });

  it('сосредоточенность выветривается за несколько дней', () => {
    let s = run(working(), { type: 'typeCode', chars: f.focusChars });
    s = days(s, 1);
    expect(s.focus).toBeCloseTo(1 - f.focusDecayPerDay, 6);
    expect(days(s, 5).focus).toBe(0);
  });

  it('команде она не помогает: это личный вклад основателя', () => {
    const s = run(working(), { type: 'typeCode', chars: f.focusChars });
    expect(teamView(s, content).workPerDay).toBeCloseTo(1 + f.focusBonus, 6);
    const resting = run(s, { type: 'rest' });
    expect(founderWorkPerDay(resting, content.config)).toBe(0);
  });

  it('недопустимые значения отклоняются', () => {
    for (const chars of [0, -5, Number.NaN, 1e9]) expect(applyCommand(working(), { type: 'typeCode', chars }, content)).toEqual({ ok: false, error: 'invalidValue' });
  });
});

describe('усталость для сцены', () => {
  const fatigue = (energy: number) => roomView({ ...newGame(), energy }, content).founder;

  it('одно слово по уровню сил: бодр, устал, вымотан', () => {
    expect(fatigue(100).fatigue).toBe('fresh');
    expect(fatigue(f.tiredBelow).fatigue).toBe('fresh');
    expect(fatigue(f.tiredBelow - 1).fatigue).toBe('tired');
    expect(fatigue(f.exhaustedBelow).fatigue).toBe('tired');
    expect(fatigue(f.exhaustedBelow - 1).fatigue).toBe('exhausted');
    expect(fatigue(0).fatigue).toBe('exhausted');
  });

  it('согласовано с остальными признаками и с темпом работы', () => {
    for (const energy of [100, 60, 49, 30, 24, 0]) {
      const v = fatigue(energy);
      expect(v.tired).toBe(v.fatigue !== 'fresh');
      expect(v.exhausted).toBe(v.fatigue === 'exhausted');
      expect(v.pace).toBeGreaterThanOrEqual(f.minFactor);
      expect(v.pace).toBeLessThanOrEqual(1);
    }
    expect(fatigue(100).pace).toBe(1);
    expect(fatigue(0).pace).toBe(f.minFactor);
  });

  it('старое сохранение без сил — герой бодр', () => {
    const old = { ...newGame() };
    delete old.energy;
    expect(roomView(old, content).founder.fatigue).toBe('fresh');
  });
});

describe('строка о наборе кода на экране редактора', () => {
  it('короткая: плашка с ней и кнопкой «Вернуться к компании» не должна доставать до значков нижней панели', () => {
    // Плашка стоит слева от панели значков. При шрифте 12,5 в неё вместе с кнопкой помещается около 28 знаков текста.
    const longest = (ui.founderCare as Record<string, string>).focus!.replace('{{pct}}', '100').replace('{{boost}}', '50');
    expect(longest.length).toBeLessThanOrEqual(28);
  });
});
