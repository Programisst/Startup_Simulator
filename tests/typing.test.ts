// Набор кода самим игроком: каждое нажатие сразу двигает текущую задачу.
import { describe, expect, it } from 'vitest';
import { applyCommand, featuresOf, roomView, tick, type GameContent, type GameState } from '../src/core';
import { content } from '../src/content';
import ui from '../src/content/ru/ui.json';
import { deepFreeze, newGame, run } from './helpers';

const f = content.config.founder;
const quiet: GameContent = { ...content, events: [], milestones: [] };
const working = (): GameState => run(newGame(), { type: 'queueFeature', featureId: 'core' });
const type = (s: GameState, chars: number): GameState => run(s, { type: 'typeCode', chars });
const progress = (s: GameState): number => s.tasks[0]?.progress ?? 0;
/** Сколько работы команда делает за день без набора. */
const dayWork = (s: GameState): number => progress(tick(s, quiet)) - progress(s);

describe('набор кода двигает задачу', () => {
  it('сразу, не дожидаясь конца дня', () => {
    const s = working();
    const typed = type(s, 3);
    expect(progress(typed)).toBeGreaterThan(progress(s));
    expect(typed.day).toBe(s.day);
    expect(roomView(typed, content).task!.progress).toBeGreaterThan(roomView(s, content).task!.progress);
  });

  it('полная норма нажатий даёт работу целого дня', () => {
    const s = working();
    expect(progress(type(s, f.typeCharsPerDay)) - progress(s)).toBeCloseTo(dayWork(s), 6);
    expect(progress(type(s, f.typeCharsPerDay / 2)) - progress(s)).toBeCloseTo(dayWork(s) / 2, 6);
  });

  it('за один игровой день больше предела не напечатать — даже на паузе', () => {
    const s = working();
    let typed = s;
    for (let i = 0; i < 50; i++) typed = type(typed, f.typeCharsPerDay);
    expect(progress(typed) - progress(s)).toBeCloseTo(dayWork(s) * f.typeBonusCap, 6);
    expect(roomView(typed, content).founder).toMatchObject({ typedBoost: f.typeBonusCap, typedCap: f.typeBonusCap });
  });

  it('на следующий день предел обнуляется', () => {
    let s = type(working(), f.typeCharsPerDay * 10);
    s = tick(s, quiet);
    expect(roomView(s, content).founder.typedBoost).toBe(0);
    const before = progress(s);
    expect(progress(type(s, f.typeCharsPerDay)) - before).toBeGreaterThan(0);
  });

  it('кто печатает каждый день, заканчивает функцию примерно вдвое быстрее', () => {
    const daysToFinish = (typing: boolean): number => {
      let s = working();
      let n = 0;
      while (s.tasks.length > 0 && n < 400) {
        if (typing) s = type(s, f.typeCharsPerDay);
        s = { ...tick(s, quiet), energy: 100 };
        n++;
      }
      return n;
    };
    const plain = daysToFinish(false);
    const typed = daysToFinish(true);
    expect(typed).toBeLessThanOrEqual(Math.ceil(plain / 2) + 1);
    expect(typed).toBeGreaterThanOrEqual(Math.floor(plain / 2));
  });

  it('с командой набор весит больше: игрок ускоряет всех, а не только себя', () => {
    const solo = working();
    let team: GameState = { ...solo, cash: 1e6 };
    const hired = run(team, { type: 'hire', candidateId: team.team!.candidates.find((c) => c.role === 'developer')!.id });
    team = hired;
    expect(progress(type(team, 15)) - progress(team)).toBeGreaterThan(progress(type(solo, 15)) - progress(solo));
  });

  it('функцию набором не закрыть: её завершает шаг дня, вместе с ошибками и долгом', () => {
    const cost = featuresOf(working(), content).find((x) => x.id === 'core')!.cost;
    const almost: GameState = { ...working(), tasks: [{ kind: 'feature', featureId: 'core', progress: cost - 0.01 }] };
    const typed = type(almost, f.typeCharsPerDay);
    expect(typed.tasks).toHaveLength(1);
    expect(progress(typed)).toBeLessThan(cost);
    expect(typed.doneFeatures).not.toContain('core');
    expect(tick(typed, quiet).doneFeatures).toContain('core');
  });

  it('задач нет, а продукт уже есть — набор не пропадает: основатель берётся улучшать продукт', () => {
    const built: GameState = { ...newGame(), doneFeatures: ['core'], tasks: [] };
    expect(roomView(built, content).founder.typingStartsPolish).toBe(true);
    const typed = type(built, 15);
    expect(typed.tasks).toHaveLength(1);
    expect(typed.tasks[0]!.kind).toBe('polish');
    expect(progress(typed)).toBeGreaterThan(0);
    expect(typed.typedToday).toBeCloseTo(0.5, 6);
    // Дальше это обычная задача: полная норма за день даёт столько же работы, сколько сам день.
    const queued = run(built, { type: 'startPolish' });
    expect(progress(type(queued, 15))).toBeCloseTo(progress(typed), 6);
    expect(roomView(typed, content).founder.typingStartsPolish).toBe(false);
    // Улучшения копятся: продукт становится лучше, чем без набора.
    let withTyping = built;
    let without = built;
    for (let i = 0; i < 20; i++) {
      withTyping = tick(type({ ...withTyping, energy: 100 }, f.typeCharsPerDay), quiet);
      without = tick({ ...without, energy: 100 }, quiet);
    }
    expect(withTyping.polish).toBeGreaterThan(without.polish);
    expect(without.polish).toBe(built.polish);
  });

  it('пока основы продукта нет, улучшать нечего: без задачи, на отдыхе и после конца партии набор ничего не двигает', () => {
    const idle = type(newGame(), 30);
    expect(idle.tasks).toHaveLength(0);
    expect(idle.typedToday ?? 0).toBe(0);
    expect(roomView(newGame(), content).founder.typingStartsPolish).toBe(false);
    const restingBuilt: GameState = { ...newGame(), doneFeatures: ['core'], resting: true };
    expect(type(restingBuilt, 30).tasks).toHaveLength(0);
    const resting: GameState = { ...working(), resting: true };
    expect(progress(type(resting, 30))).toBe(progress(resting));
    const over: GameState = { ...working(), status: 'bankrupt' };
    expect(applyCommand(over, { type: 'typeCode', chars: 30 }, content).ok).toBe(false);
  });

  it('старое сохранение без новых полей открывается и работает', () => {
    const old = working();
    delete old.typedDay;
    delete old.typedToday;
    expect(roomView(old, content).founder.typedBoost).toBe(0);
    expect(progress(type(old, 3))).toBeGreaterThan(progress(old));
  });

  it('не меняет исходное состояние', () => {
    const s = deepFreeze(working());
    type(s, 10);
  });
});

describe('плашка в редакторе кода', () => {
  it('все её тексты короткие: вместе с кнопкой не достают до значков нижней панели', () => {
    const texts = ui.founderCare as Record<string, string>;
    for (const key of ['typing', 'typingMax', 'typingIdle', 'typingPolish']) {
      const longest = texts[key]!.replace('{{pct}}', '100').replace('{{boost}}', '100');
      expect(longest.length, key).toBeLessThanOrEqual(28);
    }
  });
});
