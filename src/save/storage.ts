// Сохранение и загрузка партии в хранилище браузера.
import type { GameState } from '../core';

const KEY = 'startup-simulator.save.v1';

interface SaveFile {
  version: 1;
  savedAt: string;
  state: GameState;
}

function looksLikeState(x: unknown): x is GameState {
  if (typeof x !== 'object' || x === null) return false;
  const s = x as Record<string, unknown>;
  return (
    s.version === 1 &&
    typeof s.day === 'number' &&
    typeof s.cash === 'number' &&
    typeof s.rng === 'number' &&
    typeof s.market === 'object' &&
    Array.isArray(s.tasks) &&
    Array.isArray(s.months) &&
    Array.isArray(s.eventLog)
  );
}

/** Возвращает true, если сохранить удалось. */
export function saveGame(state: GameState): boolean {
  try {
    const file: SaveFile = { version: 1, savedAt: new Date().toISOString(), state };
    localStorage.setItem(KEY, JSON.stringify(file));
    return true;
  } catch {
    return false;
  }
}

/** Возвращает сохранённую партию или null, если её нет или она повреждена. */
export function loadGame(): GameState | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const file = JSON.parse(raw) as Partial<SaveFile>;
    return looksLikeState(file.state) ? file.state : null;
  } catch {
    return null;
  }
}

export function hasSave(): boolean {
  return loadGame() !== null;
}

export function deleteSave(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // хранилище недоступно — удалять нечего
  }
}
