import { applyCommand, createGame, tick, type Command, type GameState, type NewGameSetup } from '../src/core';
import { content } from '../src/content';

export const baseSetup: NewGameSetup = {
  seed: 42,
  companyName: 'Test Co',
  productType: 'saas',
  audienceId: 'smallBusiness',
  businessModel: 'subscription',
  goal: 'sandbox',
  difficulty: 'normal',
};

export function newGame(overrides: Partial<NewGameSetup> = {}): GameState {
  return createGame({ ...baseSetup, ...overrides }, content);
}

/** Выполняет команду и падает, если она отклонена. */
export function run(state: GameState, cmd: Command): GameState {
  const result = applyCommand(state, cmd, content);
  if (!result.ok) throw new Error(`Команда ${cmd.type} отклонена: ${result.error}`);
  return result.state;
}

/** Проматывает дни; на события отвечает первым вариантом. */
export function advance(state: GameState, days: number): GameState {
  let s = state;
  const target = s.day + days;
  for (let guard = 0; s.day < target && s.status === 'running' && guard < days * 3; guard++) {
    if (s.pendingEvent !== null) {
      const def = content.events.find((e) => e.id === s.pendingEvent)!;
      s = run(s, { type: 'chooseEvent', choiceId: def.choices[0]!.id });
    }
    s = tick(s, content);
  }
  return s;
}

/** То же, что advance, но основатель каждое утро полон сил: для проверки формул без усталости. */
export function advanceFresh(state: GameState, days: number): GameState {
  let s = state;
  for (let i = 0; i < days && s.status === 'running'; i++) s = advance({ ...s, energy: 100 }, 1);
  return s;
}

/** Партия с готовой основой продукта, запущенная на рынок. */
export function launchedGame(overrides: Partial<NewGameSetup> = {}): GameState {
  // Запас денег большой, чтобы тесты продукта не зависели от расходов на жизнь.
  let s: GameState = { ...newGame(overrides), cash: 100_000 };
  s = run(s, { type: 'queueFeature', featureId: 'core' });
  s = advance(s, 40);
  return run(s, { type: 'launch' });
}

export function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const key of Object.keys(value)) deepFreeze((value as Record<string, unknown>)[key]);
  }
  return value;
}
