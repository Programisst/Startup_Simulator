// Силы основателя: работа утомляет, усталый работает медленнее, отдых и кофе меняют темп.
// Описание — в docs/02-economy.md, раздел 19.

import { clamp } from './formulas';
import type { FounderConfig, GameConfig, GameState } from './types';

/** Силы основателя; в старых сохранениях поля нет — считаем, что он полон сил. */
export const energyOf = (s: GameState): number => s.energy ?? 100;

/** Во сколько раз медленнее работает уставший основатель: 1 — в полную силу. */
export function energyFactor(energy: number, cfg: FounderConfig): number {
  if (energy >= cfg.tiredBelow) return 1;
  return cfg.minFactor + (1 - cfg.minFactor) * (Math.max(0, energy) / cfg.tiredBelow);
}

export const coffeeActive = (s: GameState): boolean => (s.coffeeUntilDay ?? -1) > s.day;
export const coffeeReady = (s: GameState): boolean => s.day >= (s.coffeeReadyDay ?? 0);

/** Сколько работы над продуктом основатель делает сегодня (без команды и без спешки). */
export function founderWorkPerDay(s: GameState, cfg: GameConfig): number {
  if (s.resting) return 0;
  const coffee = coffeeActive(s) ? cfg.founder.coffeeBoost : 1;
  return cfg.founderSkill * (1 - s.sideJobShare) * energyFactor(energyOf(s), cfg.founder) * coffee;
}

/** Был ли у основателя сегодня рабочий день: есть задачи или подработка. */
export function founderBusy(s: GameState): boolean {
  if (s.resting) return false;
  return s.sideJobShare > 0 || (s.tasks.length > 0 && s.sideJobShare < 1);
}

/** Силы на конец дня. busy — работал ли основатель сегодня (считается до того, как задачи закрылись). */
export function energyAfterDay(s: GameState, cfg: FounderConfig, busy: boolean): number {
  const energy = energyOf(s);
  if (s.resting) return clamp(energy + cfg.restGain, 0, 100);
  if (!busy) return clamp(energy + cfg.idleRecovery, 0, 100);
  return clamp(energy - cfg.drainPerDay * (s.rush ? cfg.rushDrain : 1), 0, 100);
}
