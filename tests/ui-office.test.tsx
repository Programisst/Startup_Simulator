// @vitest-environment jsdom
// Экран «Офис» и сводка. В тестах нет рисования на холсте, поэтому игра показывает обычное меню сбоку без квартиры.
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { GameState } from '../src/core';
import '../src/ui/i18n';
import { App } from '../src/ui/App';
import { canDraw } from '../src/ui/office/GameRoom';
import { useStore, type ScreenId } from '../src/ui/store';
import { advance, baseSetup, newGame } from './helpers';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let box: HTMLDivElement;
let root: Root;

function show(game: GameState, screen: ScreenId) {
  useStore.setState({ game, screen, speed: 0, lastError: null });
  act(() => root.render(<App />));
}

beforeEach(() => {
  box = document.createElement('div');
  document.body.append(box);
  root = createRoot(box);
});

afterEach(() => {
  act(() => root.unmount());
  box.remove();
  useStore.setState({ game: null });
});

describe('экран «Офис»', () => {
  it('новая партия открывается в офисе', () => {
    useStore.getState().start(baseSetup);
    expect(useStore.getState().screen).toBe('office');
  });

  it('без квартиры в меню нет пункта «Офис», а вместо него открывается сводка', () => {
    expect(canDraw()).toBe(false);
    show(newGame(), 'office');
    const nav = [...box.querySelectorAll('.sidebar button')].map((b) => b.textContent);
    expect(nav).toEqual(['Сводка', 'Продукт', 'Команда', 'Маркетинг', 'Финансы']);
    expect(box.querySelector('.sidebar button.active')?.textContent).toBe('Сводка');
    expect(box.textContent).toContain('Продукт ещё не запущен');
    expect(box.textContent?.match(/\b(office|room|nav|overview)\.[A-Za-z0-9_.]+/g) ?? []).toEqual([]);
  });

  it('сводка больше не дублирует комнату', () => {
    show(newGame(), 'overview');
    expect(box.querySelector('.office-scene')).toBeNull();
    expect(box.textContent).toContain('Продукт ещё не запущен');
  });
});

describe('подпись под деньгами в сводке', () => {
  it('в первый день не обещает, что денег прибавляется', () => {
    show(newGame(), 'overview');
    expect(box.textContent).toContain('Счёт пока не меняется');
    expect(box.textContent).not.toContain('Денег прибавляется');
  });

  it('когда деньги уходят, показывает, на сколько дней их хватит', () => {
    show(advance(newGame(), 10), 'overview');
    expect(box.textContent).toMatch(/Хватит на \d+/);
  });
});
