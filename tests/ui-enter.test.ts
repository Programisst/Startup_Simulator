// @vitest-environment jsdom
// Вход в игру после заставки: «Новая игра» — сразу квартира с готовой компанией, «Продолжить» — сохранённая партия.
import { beforeEach, describe, expect, it } from 'vitest';
import { content } from '../src/content';
import { createGame } from '../src/core';
import '../src/ui/i18n';
import { enterGame, quickSetup } from '../src/ui/intro/enter';
import { useStore } from '../src/ui/store';
import { newGame } from './helpers';

const store = () => useStore.getState();

describe('вход в игру после заставки', () => {
  beforeEach(() => {
    store().quit();
  });

  it('готовая компания годится для ядра: есть название, идея и все выборы', () => {
    const setup = quickSetup(7);
    expect(setup.seed).toBe(7);
    expect(setup.companyName.length).toBeGreaterThan(0);
    expect(setup.companyName).not.toMatch(/^intro\./);
    expect(setup.idea?.length ?? 0).toBeGreaterThan(10);
    // Тема стартапа даёт партии свои функции и рынок.
    expect(content.themes.some((th) => th.id === setup.themeId)).toBe(true);
    expect(() => createGame(setup, content)).not.toThrow();
  });

  it('«Новая игра» сразу запускает партию в квартире', () => {
    enterGame('new', 1);
    const s = store();
    expect(s.game).not.toBeNull();
    expect(s.game?.day).toBe(0);
    expect(s.screen).toBe('office');
  });

  it('«Продолжить» открывает сохранённую партию', () => {
    useStore.setState({ game: { ...newGame(), day: 33 } });
    expect(store().save()).toBe(true);
    useStore.setState({ game: null });
    enterGame('continue', 1);
    expect(store().game?.day).toBe(33);
  });

  it('«Продолжить» без сохранения не оставляет пустой экран — начинается новая партия', () => {
    enterGame('continue', 1);
    expect(store().game).not.toBeNull();
    expect(store().game?.day).toBe(0);
  });
});
