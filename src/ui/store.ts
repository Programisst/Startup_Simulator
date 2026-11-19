// Связь ядра с экранами: хранит текущую партию и передаёт команды в ядро.
import { create } from 'zustand';
import { applyCommand, createGame, tick, type Command, type CommandError, type GameState, type NewGameSetup } from '../core';
import { content } from '../content';
import { deleteSave, loadGame, saveGame } from '../save/storage';
import { markTutorialSeen, tutorialSeen } from './tutorial';

export type ScreenId = 'office' | 'overview' | 'product' | 'team' | 'marketing' | 'finance';
export type Speed = 0 | 1 | 2 | 5;
/** Сколько настоящих миллисекунд длится игровой день на скорости ×1. */
export const DAY_MS = 4000;

interface Store {
  game: GameState | null;
  speed: Speed;
  screen: ScreenId;
  lastError: CommandError | null;
  /** Игрок сидит за компьютером в квартире */
  computerOpen: boolean;
  /** Квартира не загрузилась — игра показывает обычное меню сбоку */
  roomBroken: boolean;
  /** Идёт обучение первой партии */
  tutorial: boolean;
  setComputerOpen: (open: boolean) => void;
  endTutorial: () => void;
  start: (setup: NewGameSetup) => void;
  dispatch: (cmd: Command) => void;
  step: () => void;
  setSpeed: (speed: Speed) => void;
  setScreen: (screen: ScreenId) => void;
  save: () => boolean;
  load: () => boolean;
  quit: () => void;
}

export const useStore = create<Store>((set, get) => ({
  game: null,
  speed: 0,
  screen: 'office',
  lastError: null,
  computerOpen: false,
  roomBroken: false,
  tutorial: false,

  setComputerOpen: (computerOpen) => set({ computerOpen }),
  endTutorial: () => {
    markTutorialSeen();
    set({ tutorial: false });
  },

  start: (setup) => set({ game: createGame(setup, content), speed: 0, screen: 'office', lastError: null, computerOpen: false, tutorial: !tutorialSeen() }),

  dispatch: (cmd) => {
    const { game } = get();
    if (!game) return;
    const result = applyCommand(game, cmd, content);
    if (result.ok) set({ game: result.state, lastError: null });
    else set({ lastError: result.error });
  },

  step: () => {
    const { game } = get();
    if (!game) return;
    const next = tick(game, content);
    if (next === game) return;
    set({ game: next });
    // Автосохранение раз в игровой месяц и в конце партии.
    if (next.day % 30 === 0 || next.status !== 'running') saveGame(next);
  },

  setSpeed: (speed) => set({ speed }),
  setScreen: (screen) => set({ screen }),

  save: () => {
    const { game } = get();
    return game ? saveGame(game) : false;
  },

  load: () => {
    const game = loadGame();
    if (!game) return false;
    set({ game, speed: 0, screen: 'office', lastError: null, computerOpen: false, tutorial: false });
    return true;
  },

  quit: () => {
    deleteSave();
    set({ game: null, speed: 0, lastError: null, computerOpen: false, tutorial: false });
  },
}));
