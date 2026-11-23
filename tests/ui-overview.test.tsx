// @vitest-environment jsdom
// «Сводка» в стиле игры: деньги крупно с запасом дней, вчерашний день чеком с итогом, без пропущенных текстов.
import { describe, expect, it } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import '../src/ui/i18n';
import type { GameState } from '../src/core';
import { money } from '../src/ui/format';
import { Overview } from '../src/ui/screens/Overview';
import { useStore } from '../src/ui/store';
import { launchedGame } from './helpers';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function render(game: GameState): HTMLElement {
  useStore.setState({ game });
  const container = document.createElement('div');
  const root = createRoot(container);
  act(() => root.render(<Overview />));
  return container;
}

const day = { paid: 3, organic: 2, viral: 1, churned: 1, converted: 1, revenue: 120, sideIncome: 30, expenses: 200 };

function burning(): GameState {
  const base = launchedGame();
  return {
    ...base,
    cash: 9000,
    lastDay: { ...base.lastDay, ...day },
    recentDays: Array.from({ length: 30 }, (_, i) => ({ day: base.day - 30 + i, cash: 9000 - i * 50, users: 100, paying: 0, revenue: 100, expenses: 400 })),
  };
}

describe('сводка', () => {
  it('деньги показаны крупно, а при расходе — сколько дней хватит и полоска запаса', () => {
    const el = render(burning());
    const cash = el.querySelector('[data-ov-cash]');
    expect(cash?.textContent).toContain(money(9000));
    expect(cash?.textContent).toContain('Хватит на');
    expect(cash?.querySelector('.fin-meter')).not.toBeNull();
  });

  it('вчерашний день — чек: приток, отток, деньги и итог за день', () => {
    const receipt = render(burning()).querySelector('[data-ov-receipt]');
    expect(receipt).not.toBeNull();
    const text = receipt!.textContent ?? '';
    expect(text).toContain('Пришли с рекламы');
    expect(text).toContain('Ушли');
    expect(text).toContain('Итого за день');
    // 120 + 30 − 200 = −50
    expect(receipt!.querySelector('[data-ov-total]')?.textContent).toContain(money(-50));
  });

  it('на экране нет ключей вместо текста', () => {
    const text = render(burning()).textContent ?? '';
    expect(text.match(/\b(overview|metrics|sources|finance|feed)\.[A-Za-z0-9_.]+/g) ?? []).toEqual([]);
  });
});
