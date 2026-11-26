// Запросы рынка: работа над продуктом, которая не кончается.
// Когда все функции готовы, раз в полтора месяца приходят три запроса; сработает ли сделанное — заранее неизвестно.
import { describe, expect, it } from 'vitest';
import { content } from '../src/content';
import { applyCommand, expectation, featuresOf, requestOfWindow, roadmapView, roomView, tick, type GameState, type RequestSource, type Task } from '../src/core';
import { launchedGame, run } from './helpers';

const cfg = content.config.roadmap;
const quiet = { ...content, events: [], milestones: [] };
const def = (id: RequestSource) => cfg.sources.find((s) => s.id === id)!;
type RequestTask = Extract<Task, { kind: 'request' }>;

/** Партия, в которой продукт собран: все функции готовы, он на рынке и приносит perMonth в месяц. */
function built(perMonth = 40_000, seed = 42): GameState {
  const base = launchedGame({ seed });
  return {
    ...base,
    cash: 1e8,
    energy: 100,
    tasks: [],
    doneFeatures: featuresOf(base, content).map((f) => f.id),
    recentDays: Array.from({ length: 90 }, (_, i) => ({ day: base.day - 90 + i, cash: 1e8, users: 5000, paying: 500, revenue: perMonth / 30, expenses: 0 })),
  };
}

/** Первый период партии, в котором запрос источника сработает (или нет). */
function waveWhere(seed: number, source: RequestSource, works: boolean): number {
  for (let w = 1; w < 5000; w++) if (requestOfWindow(seed, w, def(source), content.config).works === works) return w;
  throw new Error('период не нашёлся');
}

const atWave = (s: GameState, wave: number): GameState => ({ ...s, day: wave * cfg.periodDays });
const request = (s: GameState): RequestTask => s.tasks.find((t): t is RequestTask => t.kind === 'request')!;
/** Доводит первую задачу почти до конца: шагу дня остаётся её закрыть. */
const almostDone = (s: GameState): GameState => ({ ...s, tasks: s.tasks.map((t, i) => (i === 0 && t.kind === 'request' ? { ...t, progress: t.cost - 0.01 } : t)) });

describe('когда приходят запросы', () => {
  it('пока продукт не собран, запросов нет — экран говорит, сколько функций осталось', () => {
    const s = launchedGame();
    const view = roadmapView(s, content);
    expect(view.unlocked).toBe(false);
    expect(view.requests).toEqual([]);
    expect(view.featuresDone).toBe(1);
    expect(view.featuresTotal).toBe(featuresOf(s, content).length);
    expect(applyCommand(s, { type: 'takeRequest', source: 'users' }, content)).toEqual({ ok: false, error: 'requestUnavailable' });
  });

  it('продукт собран — приходят три запроса: от пользователей, от клиента и идея команды', () => {
    const view = roadmapView(built(), content);
    expect(view.unlocked).toBe(true);
    expect(view.requests.map((r) => r.source)).toEqual(['users', 'client', 'bet']);
    for (const r of view.requests) {
      expect(r.name).toBeGreaterThanOrEqual(0);
      expect(r.name).toBeLessThan(cfg.names);
      expect(r.cost).toBeGreaterThan(0);
      expect(r.taken).toBe(false);
    }
  });

  it('шансы — как в жизни: идея команды срабатывает в трети случаев, просьба пользователей — в половине', () => {
    const hits: Record<string, number> = { users: 0, bet: 0, client: 0 };
    const WAVES = 6000;
    for (let w = 0; w < WAVES; w++) for (const d of cfg.sources) if (requestOfWindow(7, w, d, content.config).works) hits[d.id]!++;
    expect(hits.bet! / WAVES).toBeCloseTo(0.33, 1);
    expect(hits.users! / WAVES).toBeCloseTo(0.5, 1);
    expect(hits.client).toBe(WAVES);
    expect(roadmapView(built(), content).requests.map((r) => r.chancePct)).toEqual([50, 100, 33]);
  });

  it('раз в полтора месяца запросы меняются, и отметки прошлого периода не действуют', () => {
    const s = atWave(built(), 10);
    const taken = run(s, { type: 'takeRequest', source: 'users' });
    expect(roadmapView(taken, content).requests[0]!.taken).toBe(true);
    expect(roadmapView(taken, content).nextInDays).toBe(cfg.periodDays);
    const later = { ...taken, day: taken.day + cfg.periodDays };
    expect(roadmapView(later, content).requests[0]!.taken).toBe(false);
    // Взятый запрос остаётся в работе.
    expect(roadmapView(later, content).inWork).toHaveLength(1);
  });
});

describe('цена запроса', () => {
  it('чем больше компания, тем дороже каждая переделка — но не бесконечно', () => {
    const cost = (perMonth: number) => roadmapView(atWave(built(perMonth), 10), content).requests[0]!.cost;
    const days = requestOfWindow(42, 10, def('users'), content.config).days;
    expect(cost(10_000)).toBeCloseTo(days, 6);
    expect(cost(400_000)).toBeCloseTo(days * 10, 6);
    expect(cost(50_000_000)).toBeCloseTo(days * cfg.maxScale, 6);
  });

  it('экран говорит, за сколько дней команда это сделает', () => {
    const s = atWave(built(), 10);
    const r = roadmapView(s, content).requests[0]!;
    expect(r.days).toBe(Math.ceil(r.cost / roadmapView(s, content).workPerDay));
    expect(roadmapView({ ...s, resting: true }, content).requests[0]!.days).toBeNull();
  });

  it('взятый запрос встаёт в очередь с ценой, записанной в этот день', () => {
    const s = atWave(built(), 10);
    const view = roadmapView(s, content).requests[0]!;
    const taken = run(s, { type: 'takeRequest', source: 'users' });
    expect(request(taken)).toMatchObject({ kind: 'request', wave: 10, source: 'users', name: view.name, progress: 0, cost: view.cost });
    // Второй раз тот же запрос взять нельзя; доход потом вырос — цена взятого не меняется.
    expect(applyCommand(taken, { type: 'takeRequest', source: 'users' }, content).ok).toBe(false);
    expect(roomView(taken, content).task).toMatchObject({ kind: 'request', progress: 0 });
  });

  it('запрос и функция встают перед «улучшением продукта»: оно не кончается и иначе держало бы очередь', () => {
    const polishing = run(atWave(built(), 10), { type: 'startPolish' });
    const taken = run(polishing, { type: 'takeRequest', source: 'users' });
    expect(taken.tasks.map((t) => t.kind)).toEqual(['request', 'polish']);
    const more = run(taken, { type: 'takeRequest', source: 'bet' });
    expect(more.tasks.map((t) => t.kind)).toEqual(['request', 'request', 'polish']);

    const early = run({ ...launchedGame(), tasks: [] }, { type: 'startPolish' });
    const feature = featuresOf(early, content).find((f) => !early.doneFeatures.includes(f.id))!;
    expect(run(early, { type: 'queueFeature', featureId: feature.id }).tasks.map((t) => t.kind)).toEqual(['feature', 'polish']);
  });
});

describe('чем кончается запрос', () => {
  it('просьба пользователей сработала: уходят реже — навсегда, продукт и репутация растут', () => {
    const s = atWave(built(), waveWhere(42, 'users', true));
    const before = almostDone(run({ ...s, reputation: 50 }, { type: 'takeRequest', source: 'users' }));
    const after = tick(before, quiet);
    expect(after.tasks).toHaveLength(0);
    expect(after.market.churnBase / before.market.churnBase).toBeCloseTo(def('users').hit.churn, 6);
    expect(after.polish - before.polish).toBeCloseTo(def('users').hit.value * expectation(before.market, content.config, before.day), 6);
    expect(after.roadmap).toMatchObject({ built: 1, hits: 1, flops: 0, churnHits: 1 });
    expect(after.roadmap?.last).toMatchObject({ source: 'users', outcome: 'hit' });
    expect(after.news).toContainEqual(expect.objectContaining({ kind: 'request', id: 'users:hit', tone: 'good' }));
    // Новый код — новые ошибки.
    expect(after.bugs).toBeGreaterThan(before.bugs);
  });

  it('не сработала: работа впустую, остался только технический долг', () => {
    const s = atWave(built(), waveWhere(42, 'users', false));
    const before = almostDone(run({ ...s, debt: 10 }, { type: 'takeRequest', source: 'users' }));
    const after = tick(before, quiet);
    expect(after.market.churnBase).toBe(before.market.churnBase);
    expect(after.debt).toBe(10 + def('users').flop.debt);
    expect(after.roadmap).toMatchObject({ built: 1, hits: 0, flops: 1, churnHits: 0 });
    expect(after.news).toContainEqual(expect.objectContaining({ kind: 'request', id: 'users:flop', tone: 'bad' }));
  });

  it('идея команды выстрелила: рынок вырос навсегда и на месяц пришло больше людей', () => {
    const s = atWave(built(), waveWhere(42, 'bet', true));
    const before = almostDone(run(s, { type: 'takeRequest', source: 'bet' }));
    const after = tick(before, quiet);
    expect(after.market.marketSize / before.market.marketSize).toBeCloseTo(def('bet').hit.market, 6);
    expect(after.modifiers).toContainEqual({ target: 'acquisition', factor: 1.3, untilDay: before.day + 30 });
    expect(after.roadmap?.last).toMatchObject({ source: 'bet', outcome: 'hit' });
  });

  it('уход пользователей нельзя снижать бесконечно: продукт уже «вылизан»', () => {
    const s = atWave(built(), waveWhere(42, 'users', true));
    const base = run(s, { type: 'takeRequest', source: 'users' });
    const full = almostDone({ ...base, roadmap: { ...base.roadmap!, churnHits: cfg.maxChurnHits } });
    const after = tick(full, quiet);
    expect(after.market.churnBase).toBe(full.market.churnBase);
    expect(after.roadmap?.last?.outcome).toBe('hit');
  });

  it('набором кода запрос не закрыть: его завершает шаг дня, там и выясняется исход', () => {
    const s = almostDone(run(atWave(built(), 10), { type: 'takeRequest', source: 'users' }));
    const typed = run(s, { type: 'typeCode', chars: 30 });
    expect(typed.tasks).toHaveLength(1);
    expect(request(typed).progress).toBeLessThan(request(typed).cost);
    expect(typed.roadmap?.built).toBe(0);
  });
});

describe('заказ крупного клиента', () => {
  it('условия видны заранее и записываются при взятии: срок и оплата — пятая часть месячного дохода', () => {
    const s = atWave(built(40_000), 10);
    const view = roadmapView(s, content).requests[1]!;
    expect(view).toMatchObject({ source: 'client', chancePct: 100, reward: 8000, deadlineDays: 40, debt: 6, lateReputation: -3 });
    const taken = run(s, { type: 'takeRequest', source: 'client' });
    expect(request(taken)).toMatchObject({ dueDay: s.day + 40, reward: 8000 });
    expect(roadmapView(taken, content).inWork[0]).toMatchObject({ source: 'client', daysToDeadline: 40, reward: 8000 });
  });

  it('сдали в срок — клиент заплатил; долг вырос, потому что делали под одного', () => {
    const before = almostDone(run({ ...atWave(built(40_000), 10), debt: 0 }, { type: 'takeRequest', source: 'client' }));
    const after = tick(before, quiet);
    const paid = after.news!.find((n) => n.kind === 'request')!;
    expect(paid).toMatchObject({ id: 'client:paid', value: 8000, tone: 'good' });
    expect(after.debt).toBe(6);
    expect(after.roadmap?.last).toMatchObject({ outcome: 'paid', cash: 8000 });
    // Деньги пришли: день с оплатой богаче такого же дня без неё ровно на сумму заказа.
    const without = tick({ ...before, tasks: [] }, quiet);
    expect(after.cash - without.cash).toBeCloseTo(8000, 2);
  });

  it('сорвали срок — денег нет, репутация падает', () => {
    const taken = run({ ...atWave(built(40_000), 10), reputation: 50 }, { type: 'takeRequest', source: 'client' });
    const late = almostDone({ ...taken, day: taken.day + 41 });
    const after = tick(late, quiet);
    expect(after.roadmap?.last).toMatchObject({ outcome: 'late', cash: 0 });
    expect(after.roadmap).toMatchObject({ hits: 0, flops: 1 });
    expect(after.news).toContainEqual(expect.objectContaining({ kind: 'request', id: 'client:late', tone: 'bad' }));
    expect(after.reputation).toBeLessThan(late.reputation);
  });

  it('маленькой команде экран заранее говорит, что к сроку не успеть', () => {
    // Большая компания, а работает один основатель.
    const view = roadmapView(atWave(built(2_000_000), 10), content).requests[1]!;
    expect(view.days).toBeGreaterThan(view.deadlineDays);
    expect(view.tooSlow).toBe(true);
    expect(roadmapView(atWave(built(10_000), 10), content).requests[1]!.tooSlow).toBe(false);
  });

  it('сняли заказ клиента с очереди — это сорванное обещание; просьбу пользователей можно снять без последствий', () => {
    const client = run({ ...atWave(built(), 10), reputation: 50 }, { type: 'takeRequest', source: 'client' });
    const dropped = run(client, { type: 'removeTask', index: 0 });
    expect(dropped.reputation).toBe(47);
    expect(dropped.news).toContainEqual(expect.objectContaining({ kind: 'request', id: 'client:late' }));
    const users = run({ ...atWave(built(), 10), reputation: 50 }, { type: 'takeRequest', source: 'users' });
    expect(run(users, { type: 'removeTask', index: 0 }).reputation).toBe(50);
  });
});

describe('проверка спроса', () => {
  it('стоит десятую часть месячного дохода и неделю; потом экран знает, сработает ли запрос', () => {
    const wave = waveWhere(42, 'bet', false);
    const s = atWave(built(40_000), wave);
    const view = roadmapView(s, content);
    expect(view.checkCost).toBe(4000);
    expect(view.checkDays).toBe(7);
    const checked = run(s, { type: 'checkRequest', source: 'bet' });
    expect(checked.cash).toBe(s.cash - 4000);
    expect(roadmapView(checked, content).requests[2]).toMatchObject({ known: null, check: { state: 'running', daysLeft: 7 } });
    const ready = { ...checked, day: checked.day + 7 };
    expect(roadmapView(ready, content).requests[2]).toMatchObject({ known: 'flop', check: { state: 'done' } });
    // В период, где идея сработает, проверка это и покажет.
    const good = run(atWave(built(40_000), waveWhere(42, 'bet', true)), { type: 'checkRequest', source: 'bet' });
    expect(roadmapView({ ...good, day: good.day + 7 }, content).requests[2]!.known).toBe('hit');
  });

  it('одна проверка на период; заказ клиента проверять незачем; без денег проверки нет', () => {
    const s = atWave(built(40_000), 10);
    expect(roadmapView(s, content).requests.map((r) => r.check.blocked)).toEqual([null, 'sure', null]);
    expect(applyCommand(s, { type: 'checkRequest', source: 'client' }, content).ok).toBe(false);
    const checked = run(s, { type: 'checkRequest', source: 'users' });
    expect(roadmapView(checked, content).requests[2]!.check.blocked).toBe('used');
    expect(applyCommand(checked, { type: 'checkRequest', source: 'bet' }, content).ok).toBe(false);
    // В следующем периоде проверка снова есть.
    expect(roadmapView({ ...checked, day: checked.day + cfg.periodDays }, content).requests[2]!.check.blocked).toBeNull();
    expect(roadmapView({ ...s, cash: 100 }, content).requests[0]!.check.blocked).toBe('cash');
  });
});

describe('совместимость', () => {
  it('старое сохранение без запросов открывается, а ранняя партия идёт как раньше', () => {
    const s = launchedGame();
    expect(s.roadmap).toBeUndefined();
    let a = s;
    for (let i = 0; i < 60; i++) a = tick(a, quiet);
    expect(a.roadmap).toBeUndefined();
    expect(roadmapView(a, content).built).toBe(0);
  });

  it('исход запроса не зависит от перезагрузки: он задан партией и периодом', () => {
    const s = almostDone(run(atWave(built(), 10), { type: 'takeRequest', source: 'bet' }));
    expect(tick(s, quiet).roadmap?.last?.outcome).toBe(tick(s, quiet).roadmap?.last?.outcome);
    expect(tick(s, quiet).roadmap?.last?.outcome).toBe(requestOfWindow(42, 10, def('bet'), content.config).works ? 'hit' : 'flop');
  });
});
