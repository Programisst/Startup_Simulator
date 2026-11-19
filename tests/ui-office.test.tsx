// @vitest-environment jsdom
// Экран «Офис» и сводка. В тестах 3D нет, поэтому показывается запасная рисованная комната.
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { GameState } from '../src/core';
import '../src/ui/i18n';
import { App } from '../src/ui/App';
import { has3D } from '../src/ui/office/GameRoom';
import { worksAtDesk } from '../src/ui/room3d/link';
import { useStore, type ScreenId } from '../src/ui/store';
import { advance, baseSetup, launchedGame, newGame, run } from './helpers';

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

  it('в меню есть и офис, и сводка', () => {
    show(newGame(), 'office');
    const nav = [...box.querySelectorAll('.sidebar button')].map((b) => b.textContent);
    expect(nav).toEqual(['Офис', 'Сводка', 'Продукт', 'Команда', 'Маркетинг', 'Финансы']);
  });

  it('без 3D показывает запасную комнату с занятием основателя, без пропущенных текстов', () => {
    expect(has3D()).toBe(false);
    show(newGame(), 'office');
    expect(box.querySelector('.office-scene')).not.toBeNull();
    expect(box.textContent).toContain('Основателю нечем заняться');
    show(run(newGame(), { type: 'queueFeature', featureId: 'core' }), 'office');
    expect(box.textContent).toContain('Основатель работает над продуктом');
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

describe('когда герой сам садится работать', () => {
  it('за продуктом и за подработкой — да; без дела и в кассовом разрыве — нет', () => {
    expect(worksAtDesk('building')).toBe(true);
    expect(worksAtDesk('sideJob')).toBe(true);
    expect(worksAtDesk('idle')).toBe(false);
    expect(worksAtDesk('broke')).toBe(false);
  });
});

describe('цель компании на экране', () => {
  it('ближайшая цель видна с подсказкой и наградой', () => {
    show(newGame(), 'overview');
    expect(box.textContent).toContain('Ближайшая цель');
    expect(box.textContent).toContain('Сделать основу продукта');
    expect(box.textContent?.match(/\bgoalsLadder\.[A-Za-z0-9_.]+/g) ?? []).toEqual([]);
  });

  it('когда цель достигнута, всплывает уведомление, а при загрузке старые цели не всплывают', () => {
    const s = { ...launchedGame(), users: 40 };
    show(s, 'overview');
    expect(box.querySelector('.goal-toast')).toBeNull();
    act(() => useStore.getState().step());
    expect(box.querySelector('.goal-toast')?.textContent).toContain('Цель достигнута');
    // Цели засчитываются по порядку, по одной в день: первой идёт запуск.
    expect(box.querySelector('.goal-toast')?.textContent).toContain('Выпустить продукт');
    act(() => useStore.getState().step());
    expect(box.querySelector('.goal-toast')?.textContent).toContain('Первые 10 пользователей');
  });

  it('после банкротства игра объясняет, что пошло не так', () => {
    show({ ...newGame(), status: 'bankrupt' }, 'overview');
    expect(box.textContent).toContain('Что пошло не так.');
    expect(box.textContent).toContain('раньше, чем продукт вышел на рынок');
  });
});
