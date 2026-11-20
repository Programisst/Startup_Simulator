// @vitest-environment jsdom
// Простая панель охоты за звёздами на экране «Команда»: тексты на месте, кнопка делает предложение.
import { describe, expect, it } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import '../src/ui/i18n';
import { content } from '../src/content';
import type { GameState } from '../src/core';
import { HeadhuntPanel } from '../src/ui/components/HeadhuntPanel';
import { useFeedText } from '../src/ui/components/Feed';
import { useStore } from '../src/ui/store';
import { launchedGame } from './helpers';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const h = content.config.headhunt;
const missing = (text: string | null) => text?.match(/\b(team|feed|errors)\.[A-Za-z0-9_.]+/g) ?? [];

function game(): GameState {
  const base = launchedGame();
  const day = Math.ceil(base.day / h.periodDays) * h.periodDays;
  return {
    ...base,
    day,
    cash: 1e6,
    office: 'office',
    energy: 100,
    recentDays: Array.from({ length: 30 }, (_, i) => ({ day: day - 30 + i, cash: 1e6, users: 100, paying: 10, revenue: 1000, expenses: 0 })),
  };
}

function FeedLine() {
  const text = useFeedText();
  return <p data-feed>{text({ day: 1, kind: 'headhunt', id: 'joined', tone: 'good', value: 17 })}</p>;
}

describe('панель «Охота за звёздами»', () => {
  it('показывает звезду и три предложения без пропущенных текстов; после нажатия — ожидание ответа', () => {
    useStore.setState({ game: game() });
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => root.render(<HeadhuntPanel />));

    expect(container.textContent).toContain('Охота за звёздами');
    expect(container.querySelectorAll('[data-headhunt-offer]')).toHaveLength(3);
    expect(container.textContent).toMatch(/навык \d,\d\. Компания «[А-Яа-яё]+», зарплата/);
    expect(container.textContent).toMatch(/Очень щедро · .+ в месяц/);
    expect(container.textContent).toMatch(/Шанс \d+%\./);
    expect(container.textContent).toMatch(/Риск ответного удара: 35% после перехода, 15% после отказа\./);
    expect(missing(container.textContent)).toEqual([]);

    act(() => container.querySelector<HTMLButtonElement>('[data-headhunt-offer="generous"]')!.click());
    expect(useStore.getState().game!.headhunt!.pending).toMatchObject({ offer: 'generous' });
    expect(container.textContent).toMatch(/Предложение сделано: .+ из «.+», .+ в месяц\. Шанс \d+%\. Ответ через 3 дн\./);
    expect(container.querySelectorAll('[data-headhunt-offer]')).toHaveLength(0);
    expect(missing(container.textContent)).toEqual([]);

    act(() => root.unmount());
    container.remove();
  });

  it('пока компанию не заметили, объясняет, чего ждать; новость в ленте называет человека по имени', () => {
    useStore.setState({ game: { ...game(), recentDays: [] } });
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() =>
      root.render(
        <>
          <HeadhuntPanel />
          <FeedLine />
        </>,
      ),
    );
    expect(container.textContent).toContain('Сильные люди заметят вашу компанию');
    expect(container.querySelectorAll('[data-headhunt-offer]')).toHaveLength(0);
    expect(container.querySelector('[data-feed]')!.textContent).toMatch(/^Звезда в команде: \S+ \S+\./);
    expect(missing(container.textContent)).toEqual([]);
    act(() => root.unmount());
    container.remove();
  });
});
