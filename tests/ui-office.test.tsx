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
    expect(nav).toEqual(['Офис', 'Сводка', 'Продукт', 'Команда', 'Маркетинг', 'Финансы', 'Банк', 'Сообщения', 'Почта', 'Цели', 'Настройки']);
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

describe('разделы из нижней панели компьютера', () => {
  const noMissing = () => expect(box.textContent?.match(/\b(apps|feed|goalsLadder|office|finance|founderCare|nav)\.[A-Za-z0-9_.]+/g) ?? []).toEqual([]);

  it('сообщения, почта, цели и настройки открываются без пропущенных текстов', () => {
    const s = advance(launchedGame(), 60);
    for (const screen of ['feed', 'mail', 'goals', 'settings', 'finance', 'team', 'product', 'bank'] as const) {
      show(s, screen);
      noMissing();
    }
    show(s, 'goals');
    expect(box.textContent).toContain('Переехать в коворкинг');
    show(s, 'mail');
    expect(box.querySelectorAll('.mail li').length).toBeGreaterThan(0);
  });

  it('панель офиса: переезд по кнопке, когда хватает денег', () => {
    show({ ...newGame(), cash: 500 }, 'team');
    expect(box.textContent).toContain('Комната основателя');
    expect(box.textContent).toContain('На переезд не хватает');
    show({ ...newGame(), cash: 20_000 }, 'team');
    const move = [...box.querySelectorAll('button')].find((b) => b.textContent === 'Переехать')!;
    act(() => {
      move.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(useStore.getState().game!.office).toBe('coworking');
    expect(box.textContent).toContain('Коворкинг');
    expect(box.textContent).toContain('0 / 6');
  });

  it('радостное событие показывается празднично', () => {
    const s = launchedGame();
    show({ ...s, pendingEvent: 'angelOffer', eventLog: [...s.eventLog, { day: s.day, eventId: 'angelOffer', choiceId: null, chanceResults: [] }] }, 'overview');
    expect(box.querySelector('.modal.win')).not.toBeNull();
    expect(box.querySelector('.confetti')).not.toBeNull();
    expect(box.textContent).toContain('В вас поверили');
  });

  it('настройки: обучение можно включить заново', () => {
    useStore.setState({ tutorial: false });
    show(newGame(), 'settings');
    const again = [...box.querySelectorAll('button')].find((b) => b.textContent === 'Показать обучение заново')!;
    act(() => {
      again.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(useStore.getState().tutorial).toBe(true);
  });
});

describe('банк и характеры на экране', () => {
  const click = (el: Element) =>
    act(() => {
      el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

  it('кредит берётся кнопкой, долг появляется на экране', () => {
    show(newGame(), 'bank');
    const before = useStore.getState().game!.cash;
    click(box.querySelector('[data-bank="take"]')!);
    const game = useStore.getState().game!;
    expect(game.cash).toBeGreaterThan(before);
    expect(game.loans).toHaveLength(1);
    expect(box.textContent).toContain('Ваши кредиты');
  });

  it('вклад: положить и снять всё', () => {
    show({ ...newGame(), cash: 10_000 }, 'bank');
    const input = box.querySelector<HTMLInputElement>('[data-bank="amount"]')!;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, '4000');
    act(() => {
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    click(box.querySelector('[data-bank="put"]')!);
    expect(useStore.getState().game).toMatchObject({ cash: 6000, deposit: 4000 });
    click(box.querySelector('[data-bank="withdrawAll"]')!);
    expect(useStore.getState().game).toMatchObject({ cash: 10_000, deposit: 0 });
  });

  it('у сотрудника видны характер, биография и реплика; разговор поднимает мотивацию', () => {
    const s = newGame();
    const worker = { id: 900, role: 'developer' as const, skill: 1, trait: 'calm' as const, salaryAsk: 3000, salary: 3000, nameSeed: 5, hiredDay: 0, motivation: 30, driver: 'people' as const };
    show({ ...s, cash: 1e6, team: { ...s.team!, employees: [worker] } }, 'team');
    expect(box.textContent).toContain('Держится за команду');
    expect(box.textContent).toContain('Мне не с кем даже кофе выпить');
    expect(box.querySelector('.profile')).not.toBeNull();
    click(box.querySelector('[data-talk="900"]')!);
    expect(useStore.getState().game!.team!.employees[0]!.motivation).toBeGreaterThan(30);
    expect(box.textContent).toContain('Говорили недавно');
  });
});
