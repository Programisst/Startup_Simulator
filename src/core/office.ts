// Офис компании: от комнаты основателя до целого этажа. Определяет, сколько людей можно нанять.

import { cityOf } from './cities';
import type { GameConfig, GameState, OfficeDef } from './types';

export function officeIndex(s: GameState, cfg: GameConfig): number {
  const i = cfg.offices.findIndex((o) => o.id === s.office);
  return i < 0 ? 0 : i;
}

const round50 = (x: number): number => Math.round(x / 50) * 50;

/** Офис по ценам города партии: аренда и переезд в дорогом городе стоят дороже. */
function priced(def: OfficeDef, s: GameState): OfficeDef {
  const rent = cityOf(s).rent;
  return rent === 1 ? def : { ...def, rentPerMonth: round50(def.rentPerMonth * rent), moveCost: round50(def.moveCost * rent) };
}

export function officeOf(s: GameState, cfg: GameConfig): OfficeDef {
  return priced(cfg.offices[officeIndex(s, cfg)]!, s);
}

export function nextOffice(s: GameState, cfg: GameConfig): OfficeDef | null {
  const next = cfg.offices[officeIndex(s, cfg) + 1];
  return next ? priced(next, s) : null;
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
