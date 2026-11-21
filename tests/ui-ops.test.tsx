// @vitest-environment jsdom
// Простая панель «Службы компании» на экране «Финансы»: тексты на месте, расход разложен по службам.
import { describe, expect, it } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import '../src/ui/i18n';
import type { GameState } from '../src/core';
import { OpsPanel } from '../src/ui/components/OpsPanel';
import { Finance } from '../src/ui/screens/Finance';
import { useStore } from '../src/ui/store';
import { launchedGame } from './helpers';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const missing = (text: string | null) => text?.match(/\b(finance|feed|errors|metrics)\.[A-Za-z0-9_.]+/g) ?? [];

function game(perMonth: number): GameState {
  const base = launchedGame();
  return {
    ...base,
    recentDays: Array.from({ length: 90 }, (_, i) => ({ day: base.day - 90 + i, cash: 1e6, users: 1000, paying: 100, revenue: perMonth / 30, expenses: 0 })),
  };
}

function show(node: React.ReactNode) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => root.render(node));
  return { container, close: () => { act(() => root.unmount()); container.remove(); } };
}

describe('панель «Службы компании»', () => {
  it('маленькой компании объясняет, когда службы появятся', () => {
    useStore.setState({ game: game(5000) });
    const { container, close } = show(<OpsPanel />);
    expect(container.textContent).toContain('Службы компании');
    expect(container.textContent).toMatch(/Службы появятся, когда доход продукта превысит \$20[\s ]000 в месяц/);
    expect(container.querySelectorAll('[data-ops-line]')).toHaveLength(0);
    expect(missing(container.textContent)).toEqual([]);
    close();
  });

  it('большой компании показывает расход, его долю в доходе и четыре службы', () => {
    useStore.setState({ game: game(1_000_000) });
    const { container, close } = show(<OpsPanel />);
    expect(container.textContent).toMatch(/Сейчас службы стоят \$613[\s ]000 в месяц — это 61% дохода\. Они набраны под доход \$1[\s ]000[\s ]000 в месяц/);
    expect(container.querySelectorAll('[data-ops-line]')).toHaveLength(4);
    expect(container.textContent).toContain('Поддержка пользователей');
    expect(container.textContent).toContain('С каждого следующего доллара дохода на службы уйдёт 65 центов.');
    expect(missing(container.textContent)).toEqual([]);
    close();
  });

  it('на экране «Финансы» службы стоят отдельной строкой расходов', () => {
    const g = game(1_000_000);
    useStore.setState({ game: { ...g, lastDay: { ...g.lastDay, opsCost: 613_000 / 30 } } });
    const { container, close } = show(<Finance />);
    expect(container.querySelector('[data-ops]')).not.toBeNull();
    expect(container.textContent).toMatch(/Службы компании−\$613[\s ]000/);
    expect(missing(container.textContent)).toEqual([]);
    close();
  });
});
