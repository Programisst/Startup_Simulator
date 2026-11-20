// Обещанное обновление: размер и срок объявляет игрок, успел — всплеск интереса, сорвал — удар по репутации.
import { describe, expect, it } from 'vitest';
import { applyCommand, basePace, releaseView, tick, type GameContent, type GameState, type ReleaseDeadlineDef, type ReleaseSizeDef } from '../src/core';
import { content } from '../src/content';
import { deepFreeze, launchedGame, newGame, run } from './helpers';

const cfg = content.config.releases;
const quiet: GameContent = { ...content, events: [], milestones: [] };
type Size = ReleaseSizeDef['id'];
type Deadline = ReleaseDeadlineDef['id'];
const size = (id: Size) => cfg.sizes.find((x) => x.id === id)!;
const deadline = (id: Deadline) => cfg.deadlines.find((x) => x.id === id)!;

/** Запущенный продукт с бесконечной работой в очереди (улучшение) и без случайных помех. */
const live = (over: Partial<GameState> = {}): GameState => ({
  ...run(launchedGame(), { type: 'startPolish' }),
  cash: 1e6,
  capacity: 1e6,
  users: 1000,
  bugs: 0,
  modifiers: [],
  ...over,
});
const announce = (s: GameState, sz: Size, dl: Deadline): GameState => run(s, { type: 'announceRelease', size: sz, deadline: dl });
/** День работы в полную силу: усталость в этих тестах не мешает. */
const day = (s: GameState): GameState => ({ ...tick(s, quiet), energy: 100, bugs: s.bugs });
const days = (s: GameState, n: number, each?: (s: GameState) => GameState): GameState => {
  let x = s;
  for (let i = 0; i < n; i++) x = day(each ? each(x) : x);
  return x;
};
const option = (s: GameState, sz: Size, dl: Deadline) => releaseView(s, content).options.find((o) => o.size === sz && o.deadline === dl)!;

describe('объявление', () => {
  it('девять вариантов: три размера на три срока; смелее срок — больше награда и больнее срыв', () => {
    const view = releaseView(live(), content);
    expect(view.options).toHaveLength(9);
    for (const sz of ['small', 'medium', 'large'] as Size[]) {
      const [safe, exact, bold] = (['safe', 'exact', 'bold'] as Deadline[]).map((dl) => option(live(), sz, dl));
      expect(safe!.days).toBeGreaterThan(exact!.days);
      expect(exact!.days).toBeGreaterThan(bold!.days);
      expect(bold!.boostPct).toBeGreaterThan(exact!.boostPct);
      expect(exact!.boostPct).toBeGreaterThan(safe!.boostPct);
      expect(bold!.failReputation).toBeLessThan(exact!.failReputation);
      expect(safe!.failReputation).toBeLessThan(0);
      expect(safe!.need).toBe(exact!.need);
    }
    expect(option(live(), 'large', 'exact').boostPct).toBeGreaterThan(option(live(), 'small', 'exact').boostPct);
  });

  it('объём работы считается от обычного темпа: с командой его больше', () => {
    const solo = live();
    const hired = run(solo, { type: 'hire', candidateId: solo.team!.candidates.find((c) => c.role === 'developer')!.id });
    expect(option(solo, 'medium', 'exact').need).toBeCloseTo(size('medium').teamDays * basePace(solo, content), 6);
    expect(option(hired, 'medium', 'exact').need).toBeGreaterThan(option(solo, 'medium', 'exact').need);
  });

  it('усталость и подработка не уменьшают обещанный объём — зато видно, что не успеть', () => {
    const tired = live({ energy: 5, sideJobShare: 0.75 });
    expect(option(tired, 'medium', 'exact').need).toBe(option(live(), 'medium', 'exact').need);
    expect(option(tired, 'medium', 'exact').daysAtCurrentPace!).toBeGreaterThan(option(tired, 'medium', 'exact').days * 2);
  });

  it('до запуска, при уже обещанном обновлении и с выдуманным размером — нельзя', () => {
    const notLaunched = { ...newGame(), cash: 1e6 };
    expect(releaseView(notLaunched, content).blocked).toBe('notLaunched');
    expect(applyCommand(notLaunched, { type: 'announceRelease', size: 'small', deadline: 'safe' }, content)).toEqual({ ok: false, error: 'releaseUnavailable' });
    const busy = announce(live(), 'small', 'safe');
    expect(releaseView(busy, content).blocked).toBe('busy');
    expect(applyCommand(busy, { type: 'announceRelease', size: 'small', deadline: 'safe' }, content).ok).toBe(false);
    expect(applyCommand(live(), { type: 'announceRelease', size: 'огромное' as Size, deadline: 'safe' }, content).ok).toBe(false);
  });
});

describe('ход работы', () => {
  it('в зачёт идёт работа из очереди; сводка показывает готовность и успеваем ли', () => {
    const s = announce(live(), 'medium', 'safe');
    expect(releaseView(s, content).active).toMatchObject({ progress: 0, daysLeft: option(live(), 'medium', 'safe').days, onTrack: true, hasWork: true });
    const half = days(s, size('medium').teamDays / 2);
    expect(releaseView(half, content).active!.progress).toBeCloseTo(0.5, 2);
  });

  it('с пустой очередью работа не засчитывается, и это видно', () => {
    const idle = announce({ ...live(), tasks: [] }, 'small', 'safe');
    const later = days(idle, 3);
    expect(later.release!.active!.done).toBe(0);
    expect(releaseView(later, content).active).toMatchObject({ hasWork: false, onTrack: false });
  });

  it('набор кода самим игроком тоже идёт в зачёт', () => {
    const s = announce(live(), 'medium', 'bold');
    const typed = run(s, { type: 'typeCode', chars: content.config.founder.typeCharsPerDay });
    expect(typed.release!.active!.done).toBeCloseTo(basePace(s, content), 6);
  });
});

describe('исход', () => {
  it('«с запасом» при обычной работе выходит в срок: приток растёт, репутация тоже, в ленте новость', () => {
    const s = announce(live(), 'medium', 'safe');
    const done = days(s, option(live(), 'medium', 'safe').days);
    expect(done.release).toMatchObject({ active: null, shipped: 1, last: { size: 'medium', deadline: 'safe', outcome: 'onTime' } });
    const boost = done.modifiers.find((m) => m.target === 'acquisition')!;
    expect(boost.factor).toBeCloseTo(1 + (size('medium').factor - 1) * deadline('safe').reward, 6);
    expect((done.news ?? []).find((n) => n.kind === 'release')).toMatchObject({ tone: 'good', value: option(live(), 'medium', 'safe').boostPct });
    const same = days(live(), option(live(), 'medium', 'safe').days);
    expect(done.reputation).toBeGreaterThan(same.reputation);
  });

  it('обновление выходит, как только работа сделана, — не дожидаясь срока', () => {
    const s = announce(live(), 'small', 'safe');
    const done = days(s, size('small').teamDays);
    expect(done.release!.last).toMatchObject({ outcome: 'onTime' });
    expect(done.release!.last!.day).toBeLessThan(s.release!.active!.dueDay - 1);
  });

  it('«впритык» при ровной работе успевает в последний день, а один пропущенный день срывает срок', () => {
    const s = announce(live(), 'medium', 'exact');
    expect(days(s, size('medium').teamDays).release!.last).toMatchObject({ outcome: 'onTime' });
    const lazy = days({ ...s, tasks: [] }, 1);
    const late = days({ ...lazy, tasks: s.tasks }, size('medium').teamDays - 1);
    expect(late.release!.last).toMatchObject({ outcome: 'missed' });
  });

  it('«смело» без усилий срывается: репутация падает, награды нет', () => {
    const s = announce(live(), 'large', 'bold');
    const n = option(live(), 'large', 'bold').days;
    const failed = days(s, n);
    expect(failed.release).toMatchObject({ active: null, shipped: 0, last: { outcome: 'missed' } });
    expect(failed.modifiers).toHaveLength(0);
    expect((failed.news ?? []).find((x) => x.kind === 'release')).toMatchObject({ tone: 'bad' });
    expect(failed.reputation).toBeLessThan(days(live(), n).reputation - 5);
  });

  it('«смело» успевает тот, кто каждый день печатает код сам', () => {
    const s = announce(live(), 'large', 'bold');
    const typing = (x: GameState) => (x.release?.active ? run(x, { type: 'typeCode', chars: content.config.founder.typeCharsPerDay }) : x);
    const done = days(s, option(live(), 'large', 'bold').days, typing);
    expect(done.release!.last).toMatchObject({ outcome: 'onTime' });
    expect(done.modifiers.find((m) => m.target === 'acquisition')!.factor).toBeGreaterThan(2.5);
  });

  it('с кучей ошибок обновление выходит сырым: награда вдвое меньше, репутация не растёт', () => {
    const clean = days(announce(live(), 'medium', 'safe'), 30);
    const buggy = days(announce(live({ bugs: cfg.buggyAt }), 'medium', 'safe'), 30);
    expect(buggy.release!.last).toMatchObject({ outcome: 'rough' });
    const factor = (x: GameState) => x.modifiers.find((m) => m.target === 'acquisition')?.factor ?? 1;
    const fullDone = days(announce(live(), 'medium', 'safe'), size('medium').teamDays);
    const roughDone = days(announce(live({ bugs: cfg.buggyAt }), 'medium', 'safe'), size('medium').teamDays);
    expect(factor(roughDone) - 1).toBeCloseTo((factor(fullDone) - 1) * cfg.roughShare, 6);
    expect((roughDone.news ?? []).find((n) => n.kind === 'release')).toMatchObject({ tone: 'mixed' });
    expect(clean.release!.last).toMatchObject({ outcome: 'onTime' });
  });

  it('после исхода следующее обновление можно объявить не сразу', () => {
    const done = days(announce(live(), 'small', 'safe'), size('small').teamDays);
    expect(releaseView(done, content)).toMatchObject({ blocked: 'cooldown' });
    expect(releaseView(done, content).cooldownDaysLeft).toBeGreaterThan(cfg.cooldownDays - 3);
    expect(releaseView(days(done, cfg.cooldownDays), content).blocked).toBeNull();
  });
});

describe('надёжность', () => {
  it('партия без обновлений идёт точно как раньше, поле в сохранении не появляется', () => {
    const s = days(live(), 20);
    expect(s.release).toBeUndefined();
    expect('release' in tick(live(), quiet)).toBe(false);
  });

  it('обновление не сдвигает случайность партии', () => {
    const plain = days(live(), 25);
    const withRelease = days(announce(live(), 'small', 'safe'), 25);
    expect(withRelease.rng).toBe(plain.rng);
  });

  it('старое сохранение открывается; сводка и объявление не меняют исходное состояние', () => {
    const old = live();
    delete old.release;
    expect(releaseView(old, content)).toMatchObject({ active: null, last: null, shipped: 0, blocked: null });
    const frozen = deepFreeze(live());
    releaseView(frozen, content);
    announce(frozen, 'small', 'safe');
  });
});
