// @vitest-environment jsdom
// Простая панель покупки компаний на экране «Финансы»: тексты на месте, кнопки проверяют и покупают.
import { describe, expect, it } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import '../src/ui/i18n';
import { content } from '../src/content';
import type { GameState, NewsItem } from '../src/core';
import { AcquisitionPanel } from '../src/ui/components/AcquisitionPanel';
import { useFeedText } from '../src/ui/components/Feed';
import { useStore } from '../src/ui/store';
import { launchedGame } from './helpers';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const a = content.config.acquisitions;
const missing = (text: string | null) => text?.match(/\b(finance|feed|errors)\.[A-Za-z0-9_.]+/g) ?? [];

function game(over: Partial<GameState> = {}): GameState {
  const base = launchedGame();
  const day = Math.ceil(base.day / a.periodDays) * a.periodDays;
  return {
    ...base,
    day,
    cash: 5e6,
    users: 10_000,
    paying: 1000,
    capacity: 1e6,
    recentDays: Array.from({ length: 30 }, (_, i) => ({ day: day - 30 + i, cash: 5e6, users: 10_000, paying: 1000, revenue: 2000, expenses: 0 })),
    ...over,
  };
}

const NEWS: NewsItem[] = (['solid', 'messy', 'hollow', 'refused'] as const).map((id) => ({ day: 1, kind: 'acquisition', id, value: 900 }));
function FeedLines() {
  const text = useFeedText();
  return (
    <ul data-feed>
      {NEWS.map((n) => (
        <li key={n.id}>{text(n)}</li>
      ))}
    </ul>
  );
}

describe('панель «Покупка компаний»', () => {
  it('показывает компанию, три возможных исхода и кнопки; проверка и покупка работают с экрана', () => {
    useStore.setState({ game: game() });
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() =>
      root.render(
        <>
          <AcquisitionPanel />
          <FeedLines />
        </>,
      ),
    );
    const click = (selector: string) => act(() => container.querySelector<HTMLButtonElement>(selector)!.click());

    expect(container.textContent).toContain('Покупка компаний');
    expect(container.textContent).toMatch(/«.+» — (небольшая|средняя|крупная) компания\. По её словам, [\d\s ]+ пользователей\. Цена \$[\d\s ]+\. Продаётся ещё 60 дн\./);
    expect(container.textContent).toContain('Что внутри — неизвестно');
    expect(container.textContent).toMatch(/Здоровая \(30 из 100\)/);
    expect(container.textContent).toMatch(/Пустышка \(25 из 100\).+Репутация -5\. Всплывут её долги: ещё \$[\d\s ]+\./);
    expect(container.textContent).toMatch(/Предложить \$[\d\s ]+ · шанс 40%/);
    expect(container.querySelector('[data-feed]')!.textContent).toContain('оказалась пустышкой: перешло всего 900');
    expect(missing(container.textContent)).toEqual([]);

    const cash = useStore.getState().game!.cash;
    click('[data-acquire-check]');
    expect(useStore.getState().game!.cash).toBeLessThan(cash);
    expect(container.textContent).toContain('Идёт проверка: результат через 20 дн.');
    expect(container.querySelector('[data-acquire-check]')).toBeNull();

    // Проверка готова: видно, что внутри, и остаётся только один исход.
    const checked = useStore.getState().game!;
    act(() => useStore.setState({ game: { ...checked, day: checked.day + a.checkDays } }));
    expect(container.querySelector('[data-acquire-health]')).not.toBeNull();
    expect(container.textContent).toMatch(/Проверка: (компания здоровая|у компании проблемы|это пустышка)/);
    expect(container.querySelectorAll('.log li')).toHaveLength(1);
    expect(missing(container.textContent)).toEqual([]);

    click('[data-acquire-buy="full"]');
    expect(useStore.getState().game!.acquisitions!.integrating).not.toBeNull();
    expect(container.textContent).toMatch(/Куплена «.+» за \$[\d\s ]+\. Обещано [\d\s ]+ пользователей\. Присоединение закончится через 90 дн\./);
    expect(container.querySelectorAll('[data-acquire-buy]')).toHaveLength(0);
    expect(missing(container.textContent)).toEqual([]);

    act(() => root.unmount());
    container.remove();
  });

  it('маленькой компании объясняет, чего ждать; при нехватке денег и слабых серверах предупреждает', () => {
    useStore.setState({ game: game({ recentDays: [] }) });
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => root.render(<AcquisitionPanel />));
    expect(container.textContent).toContain('Компании начнут предлагать вам, когда доход за 30 дней превысит');
    expect(container.querySelectorAll('[data-acquire-buy]')).toHaveLength(0);

    act(() => useStore.setState({ game: game({ cash: 10, capacity: 10_000, bugs: 12 }) }));
    expect(container.textContent).toContain('На покупку не хватает денег.');
    expect(container.textContent).toContain('Продукт ещё не в порядке: ошибок 12');
    expect(container.textContent).toContain('Серверы не выдержат столько новых людей');
    expect(container.querySelector<HTMLButtonElement>('[data-acquire-buy="full"]')!.disabled).toBe(true);
    expect(missing(container.textContent)).toEqual([]);
    act(() => root.unmount());
    container.remove();
  });
});
