// События: содержимое (тексты, условия, числа) и события о людях.
import { describe, expect, it } from 'vitest';
import { applyCommand, conditionHolds, eventSubject, teamOf, tick, type Effect, type Employee, type EventDef, type GameState } from '../src/core';
import { content } from '../src/content';
import en from '../src/content/en/events.json';
import ru from '../src/content/ru/events.json';
import { deepFreeze, launchedGame, newGame, run } from './helpers';

const byId = (id: string): EventDef => content.events.find((e) => e.id === id)!;
const worker = (over: Partial<Employee> = {}): Employee => ({ id: 900, role: 'developer', skill: 1, trait: 'calm', salaryAsk: 3000, salary: 3000, nameSeed: 77, hiredDay: 0, motivation: 70, ...over });
const withTeam = (s: GameState, employees: Employee[]): GameState => ({ ...s, team: { ...teamOf(s, content), employees } });
/** Партия, в которой прямо сейчас ждёт ответа заданное событие. */
function pending(s: GameState, id: string): GameState {
  const subject = byId(id).condition.subject;
  const person = subject ? eventSubject(subject, s) : null;
  return { ...s, pendingEvent: id, pendingSubject: person?.id ?? null, eventLog: [...s.eventLog, { day: s.day, eventId: id, choiceId: null, chanceResults: [] }] };
}
const choose = (s: GameState, choiceId: string) => run(s, { type: 'chooseEvent', choiceId });
const member = (s: GameState, id = 900) => teamOf(s, content).employees.find((e) => e.id === id);

function flat(effects: Effect[]): Effect[] {
  return effects.flatMap((e) => (e.type === 'chance' ? [e, ...flat(e.then), ...flat(e.otherwise ?? [])] : [e]));
}
const touchesSubject = (e: Effect) => e.type === 'subjectMotivation' || e.type === 'subjectRaise' || e.type === 'subjectSkill' || e.type === 'subjectLeaves';

describe('содержимое событий', () => {
  it('событий достаточно, чтобы партия не повторялась', () => {
    expect(content.events.length).toBeGreaterThanOrEqual(25);
    expect(new Set(content.events.map((e) => e.id)).size).toBe(content.events.length);
  });

  it.each([
    ['ru', ru],
    ['en', en],
  ] as const)('%s: у каждого события есть заголовок, текст и подпись каждого варианта — и ничего лишнего', (_lang, texts) => {
    const dict = texts as Record<string, { title: string; body: string; choices: Record<string, string> }>;
    expect(Object.keys(dict).sort()).toEqual(content.events.map((e) => e.id).sort());
    for (const def of content.events) {
      const text = dict[def.id]!;
      expect(text.title.length, def.id).toBeGreaterThan(3);
      expect(text.body.length, def.id).toBeGreaterThan(20);
      expect(Object.keys(text.choices).sort(), def.id).toEqual(def.choices.map((c) => c.id).sort());
    }
  });

  it('имя сотрудника в тексте бывает только у событий о сотруднике', () => {
    for (const def of content.events) {
      const text = JSON.stringify((ru as Record<string, unknown>)[def.id]);
      if (text.includes('{{name}}')) expect(def.condition.subject, def.id).toBeDefined();
    }
  });

  it('у каждого события два-три варианта, вероятности и суммы в разумных пределах', () => {
    for (const def of content.events) {
      expect(def.choices.length, def.id).toBeGreaterThanOrEqual(2);
      expect(def.choices.length, def.id).toBeLessThanOrEqual(3);
      expect(def.weight, def.id).toBeGreaterThan(0);
      // Развилки разработки возникают по ходу работы, перерыв между ними задаёт сама работа.
      if (!def.dev) expect(def.cooldownDays, def.id).toBeGreaterThanOrEqual(60);
      for (const e of def.choices.flatMap((c) => flat(c.effects))) {
        if (e.type === 'chance') {
          expect(e.probability, def.id).toBeGreaterThan(0);
          expect(e.probability, def.id).toBeLessThan(1);
        }
        if (e.type === 'cash') expect(Math.abs(e.amount), def.id).toBeLessThanOrEqual(2500);
        if (e.type === 'subjectRaise') expect(e.pct, def.id).toBeLessThanOrEqual(0.3);
      }
    }
  });

  it('последствия «для сотрудника» есть только у событий, где сотрудник выбран', () => {
    for (const def of content.events) {
      const uses = def.choices.some((c) => flat(c.effects).some(touchesSubject));
      if (uses) expect(def.condition.subject, def.id).toBeDefined();
    }
  });

  it('события о команде не случаются у одиночки', () => {
    const solo = { ...launchedGame(), day: 400, rush: true, cash: -10 };
    for (const def of content.events) {
      if (def.condition.minTeam || def.condition.subject) expect(conditionHolds(def.condition, solo), def.id).toBe(false);
    }
  });

  it('каждое событие может случиться: его условие выполнимо', () => {
    const rich = { ...launchedGame(), day: 500, users: 5000, quality: 60, bugs: 10, debt: 50, cash: 5000 };
    const team = [worker({ motivation: 40 }), worker({ id: 901, hiredDay: 100, skill: 1.4 })];
    const states: GameState[] = [
      withTeam(rich, team),
      withTeam({ ...rich, rush: true }, team),
      withTeam({ ...rich, cash: -50 }, team),
      { ...rich, quality: 30, cash: 900 },
      { ...rich, capacity: 100 },
      { ...rich, energy: 10 },
    ];
    for (const def of content.events) expect(states.some((s) => conditionHolds(def.condition, s)), def.id).toBe(true);
  });
});

describe('о ком событие', () => {
  const s = withTeam({ ...newGame(), day: 200 }, [
    worker({ id: 1, motivation: 80, skill: 0.6, hiredDay: 0 }),
    worker({ id: 2, motivation: 40, skill: 1.5, hiredDay: 50, role: 'marketer' }),
    worker({ id: 3, motivation: 40, skill: 1.1, hiredDay: 190 }),
  ]);

  it('выбирается по правилу события, при равенстве — всегда один и тот же', () => {
    expect(eventSubject({ pick: 'lowestMotivation' }, s)!.id).toBe(2);
    expect(eventSubject({ pick: 'highestSkill' }, s)!.id).toBe(2);
    expect(eventSubject({ pick: 'highestSkill', role: 'developer' }, s)!.id).toBe(3);
    expect(eventSubject({ pick: 'newest' }, s)!.id).toBe(3);
  });

  it('учитывает стаж, навык и мотивацию; подходящих нет — событие не случается', () => {
    expect(eventSubject({ pick: 'newest', minDaysHired: 30 }, s)!.id).toBe(2);
    expect(eventSubject({ pick: 'lowestMotivation', minMotivation: 60 }, s)!.id).toBe(1);
    expect(eventSubject({ pick: 'lowestMotivation', minSkill: 2 }, s)).toBeNull();
    expect(conditionHolds({ subject: { pick: 'newest', minSkill: 2 } }, s)).toBe(false);
    expect(conditionHolds({ minTeam: 4 }, s)).toBe(false);
    expect(conditionHolds({ maxTeam: 3, rush: false }, s)).toBe(true);
  });

  it('событие, выпавшее в игре, запоминает человека и его имя для текста', () => {
    // Оставляем в игре одно событие о человеке, чтобы выпало именно оно.
    const only = { ...content, events: [{ ...byId('raiseRequest'), cooldownDays: 0 }], config: { ...content.config, eventDailyChance: 1, eventMinGapDays: 0 } };
    let x = withTeam({ ...newGame(), day: 100, cash: 100_000 }, [worker({ nameSeed: 77 })]);
    x = tick(x, only);
    expect(x.pendingEvent).toBe('raiseRequest');
    expect(x.pendingSubject).toBe(900);
    expect(x.eventLog.at(-1)!.subjectNameSeed).toBe(77);
  });
});

describe('последствия событий о людях', () => {
  const base = withTeam({ ...launchedGame(), day: 300 }, [worker(), worker({ id: 901, motivation: 60 })]);

  it('прибавка поднимает и зарплату, и ожидания, и мотивацию', () => {
    const before = pending(withTeam(base, [worker({ motivation: 50 })]), 'raiseRequest');
    const after = choose(before, 'give');
    expect(member(after)).toMatchObject({ salary: 3450, salaryAsk: 3450, motivation: 62 });
    expect(after.pendingEvent).toBeNull();
    expect(after.pendingSubject).toBeNull();
  });

  it('отказ бьёт только по тому, кто просил', () => {
    const after = choose(pending(base, 'raiseRequest'), 'refuse');
    expect(member(after, 901)!.motivation).toBe(42);
    expect(member(after, 900)!.motivation).toBe(70);
  });

  it('отпущенный сотрудник уходит, и зарплата больше не платится', () => {
    const after = choose(pending(withTeam(base, [worker()]), 'poaching'), 'letGo');
    expect(teamOf(after, content).employees).toHaveLength(0);
    expect(teamOf(after, content).log.at(-1)).toMatchObject({ kind: 'quit', employeeId: 900 });
    expect(tick(after, { ...content, events: [] }).lastDay.salaryCost).toBe(0);
  });

  it('общие последствия меняют мотивацию всех и не выходят за 0…100', () => {
    const after = choose(pending(base, 'teamConflict'), 'ignore');
    expect(teamOf(after, content).employees.map((e) => e.motivation)).toEqual([60, 50]);
    const low = choose(pending(withTeam(base, [worker({ motivation: 5 }), worker({ id: 901, motivation: 3 })]), 'teamConflict'), 'ignore');
    expect(teamOf(low, content).employees.map((e) => e.motivation)).toEqual([0, 0]);
  });

  it('курс повышает навык', () => {
    const after = choose(pending({ ...base, cash: 5000 }, 'courseRequest'), 'pay');
    const subjectId = eventSubject(byId('courseRequest').condition.subject!, base)!.id;
    expect(member(after, subjectId)!.skill).toBeCloseTo(1.1, 5);
    expect(after.cash).toBe(5000 - 350);
  });

  it('если человека уже уволили, пока событие ждало ответа, ничего не ломается', () => {
    let s = pending(withTeam(base, [worker()]), 'raiseRequest');
    s = { ...s, team: { ...teamOf(s, content), employees: [] } };
    const after = choose(s, 'give');
    expect(teamOf(after, content).employees).toHaveLength(0);
    expect(after.pendingEvent).toBeNull();
  });

  it('старое сохранение без команды переживает любое событие', () => {
    const old = { ...launchedGame(), day: 300 };
    delete old.team;
    for (const def of content.events) {
      for (const c of def.choices) {
        const r = applyCommand(pending(old, def.id), { type: 'chooseEvent', choiceId: c.id }, content);
        expect(r.ok, `${def.id}/${c.id}`).toBe(true);
      }
    }
  });

  it('ответ на событие не меняет исходное состояние', () => {
    const s = deepFreeze(pending(base, 'teamConflict'));
    for (const c of byId('teamConflict').choices) choose(s, c.id);
  });
});
