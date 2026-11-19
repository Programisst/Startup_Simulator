// Офис компании: от комнаты основателя до целого этажа. Определяет, сколько людей можно нанять.

import type { GameConfig, GameState, OfficeDef } from './types';

export function officeIndex(s: GameState, cfg: GameConfig): number {
  const i = cfg.offices.findIndex((o) => o.id === s.office);
  return i < 0 ? 0 : i;
}

export function officeOf(s: GameState, cfg: GameConfig): OfficeDef {
  return cfg.offices[officeIndex(s, cfg)]!;
}

export function nextOffice(s: GameState, cfg: GameConfig): OfficeDef | null {
  return cfg.offices[officeIndex(s, cfg) + 1] ?? null;
}

export interface OfficeView {
  current: OfficeDef;
  index: number;
  /** Следующий офис; null — больше некуда */
  next: OfficeDef | null;
  canAfford: boolean;
}

export function officeView(s: GameState, cfg: GameConfig): OfficeView {
  const next = nextOffice(s, cfg);
  return { current: officeOf(s, cfg), index: officeIndex(s, cfg), next, canAfford: next !== null && s.cash >= next.moveCost };
}
