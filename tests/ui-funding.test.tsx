// @vitest-environment jsdom
// Простая панель раунда инвестиций на экране «Финансы»: тексты на месте, кнопки ведут переговоры.
import { describe, expect, it } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import '../src/ui/i18n';
import { content } from '../src/content';
import { applyCommand, type GameState, type NewsItem } from '../src/core';
import { FundingPanel } from '../src/ui/components/FundingPanel';
import { useFeedText } from '../src/ui/components/Feed';
import { useStore } from '../src/ui/store';
import { launchedGame } from './helpers';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const missing = (text: string | null) => text?.match(/\b(finance|feed|errors)\.[A-Za-z0-9_.]+/g) ?? [];

function game(): GameState {
  const base = launchedGame();
  const m = (i: number) => ({ month: i, revenue: 30_000, expenses: 30_000, profit: 0, sideIncome: 0, users: 1000, paying: 0, cash: 0 });
  return {
    ...base,
    cash: 50_000,
    users: 1000,
    energy: 100,
    reputation: 50,
    months: [m(0), m(1)],
    recentDays: Array.from({ length: 30 }, (_, i) => ({ day: base.day - 30 + i, cash: 50_000, users: 1000, paying: 0, revenue: 1000, expenses: 0 })),
  };
}

const NEWS: NewsItem[] = [
  { day: 1, kind: 'funding', id: 'walked', tone: 'bad' },
  { day: 1, kind: 'funding', id: 'promiseKept', tone: 'good' },
  { day: 1, kind: 'funding', id: 'promiseBroken', tone: 'bad', value: 5 },
  { day: 1, kind: 'funding', id: 'buyback', tone: 'good', value: 1 },
];
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

describe('панель «Раунд инвестиций»', () => {
  it('три инвестора без пропущенных текстов; переговоры, сделка и выкуп доли работают с экрана', () => {
    // Партия, в которой ангелы на первой встрече делают предложение (чаще они отказывают).
    const lucky = Array.from({ length: 50 }, (_, i) => ({ ...game(), seed: i + 1 })).find((g) => {
      const met = applyCommand(g, { type: 'openRound', investorId: 'angels' }, content);
      return met.ok && met.state.funding?.talks;
    })!;
    useStore.setState({ game: lucky });
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() =>
      root.render(
        <>
          <FundingPanel />
          <FeedLines />
        </>,
      ),
    );
    const click = (selector: string) => act(() => container.querySelector<HTMLButtonElement>(selector)!.click());

    expect(container.textContent).toContain('Раунд инвестиций');
    expect(container.textContent).toContain('Ваша позиция на переговорах — обычная');
    expect(container.querySelectorAll('[data-funding-open]')).toHaveLength(3);
    expect(container.textContent).toMatch(/Венчурный фонд: \$[\d\s ]+ за 20% компании — 100% от оценки\. У вас останется 80%\./);
    expect(container.textContent).toMatch(/доход за 30 дней должен вырасти на 100% — до \$60[\s ]000/);
    expect(container.textContent).toContain('приток пользователей +30% на 120 дн.');
    expect(container.textContent).toMatch(/Встретиться · шанс 45%/);
    expect(container.textContent).toContain('Шанс, что сделают предложение: 25%.');
    expect(container.querySelector('[data-funding-buyback]')).toBeNull();
    expect(container.querySelector('[data-feed]')!.textContent).toContain('фонд забрал 5% вашей доли');
    expect(missing(container.textContent)).toEqual([]);

    click('[data-funding-open="angels"]');
    expect(container.textContent).toContain('Переговоры: Бизнес-ангелы');
    expect(container.textContent).toMatch(/Попросить больше\s*\$[\d\s ]+ · шанс 60%/);
    expect(container.textContent).toContain('Отказов до ухода инвестора: 3.');
    expect(container.querySelectorAll('[data-funding-open]')).toHaveLength(0);
    expect(missing(container.textContent)).toEqual([]);

    click('[data-funding-counter="ask"]');
    expect(container.textContent).toMatch(/Инвестор уступил\.|Инвестор отказал: предложение прежнее\./);
    expect(missing(container.textContent)).toEqual([]);

    const before = useStore.getState().game!.cash;
    click('[data-funding-accept]');
    const after = useStore.getState().game!;
    expect(after.cash).toBeGreaterThan(before);
    expect(after.founderShare).toBeCloseTo(0.9, 6);
    expect(container.textContent).toMatch(/Раунд закрыт: \$[\d\s ]+ за 10% компании\./);
    expect(container.textContent).toContain('Следующий раунд можно начать через 360 дн.');
    expect(container.textContent).toContain('Ваша доля: 90%');
    expect(container.querySelectorAll('[data-funding-buy]')).toHaveLength(2);
    expect(missing(container.textContent)).toEqual([]);

    useStore.setState({ game: { ...after, cash: 1e7 } });
    click('[data-funding-buy="0.01"]');
    expect(useStore.getState().game!.founderShare).toBeCloseTo(0.91, 6);

    act(() => root.unmount());
    container.remove();
  });
});
