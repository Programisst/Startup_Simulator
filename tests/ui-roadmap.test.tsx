// @vitest-environment jsdom
// Простая панель «Запросы» на экране «Продукт»: три запроса с ценой, шансом и исходом, проверка спроса, что в работе.
import { describe, expect, it } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import '../src/ui/i18n';
import { content } from '../src/content';
import { featuresOf, requestOfWindow, tick, type GameState, type RequestSource } from '../src/core';
import { FeedList } from '../src/ui/components/Feed';
import { RoadmapPanel } from '../src/ui/components/RoadmapPanel';
import { Product } from '../src/ui/screens/Product';
import { useStore } from '../src/ui/store';
import { launchedGame } from './helpers';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const missing = (text: string | null) => text?.match(/\b(product|feed|errors|metrics|office)\.[A-Za-z0-9_.]+/g) ?? [];
const cfg = content.config.roadmap;
const quiet = { ...content, events: [], milestones: [] };

/** Партия, в которой продукт собран и приносит $40 000 в месяц; период запросов — wave. */
function built(wave = 10): GameState {
  const base = launchedGame();
  return {
    ...base,
    day: wave * cfg.periodDays,
    cash: 1e7,
    energy: 100,
    tasks: [],
    doneFeatures: featuresOf(base, content).map((f) => f.id),
    recentDays: Array.from({ length: 90 }, (_, i) => ({ day: wave * cfg.periodDays - 90 + i, cash: 1e7, users: 5000, paying: 500, revenue: 40_000 / 30, expenses: 0 })),
  };
}

function waveWhere(source: RequestSource, works: boolean): number {
  const def = cfg.sources.find((s) => s.id === source)!;
  let wave = 1;
  while (requestOfWindow(42, wave, def, content.config).works !== works) wave++;
  return wave;
}

function show(node: React.ReactNode) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => root.render(node));
  return { container, close: () => { act(() => root.unmount()); container.remove(); } };
}

describe('панель «Запросы»', () => {
  it('до выхода на рынок панели нет; после — говорит, сколько функций осталось', () => {
    const fresh = launchedGame();
    useStore.setState({ game: { ...fresh, launched: false } });
    const hidden = show(<RoadmapPanel />);
    expect(hidden.container.querySelector('[data-roadmap]')).toBeNull();
    hidden.close();

    useStore.setState({ game: fresh });
    const { container, close } = show(<RoadmapPanel />);
    expect(container.querySelector('[data-roadmap="locked"]')).not.toBeNull();
    expect(container.textContent).toMatch(/все функции готовы \(1 из \d+\)/);
    expect(missing(container.textContent)).toEqual([]);
    close();
  });

  it('продукт собран: три запроса с названием, ценой, шансом и тем, что будет', () => {
    useStore.setState({ game: built() });
    const { container, close } = show(<Product />);
    const panel = container.querySelector('[data-roadmap="open"]')!;
    expect(panel.querySelectorAll('[data-request]')).toHaveLength(3);

    const users = panel.querySelector('[data-request="users"]')!;
    expect(users.textContent).toContain('Просят пользователи');
    expect(users.textContent).toMatch(/Работы: \d+ — около \d+ дн\. для вашей команды\./);
    expect(users.querySelector('[data-request-chance]')!.textContent).toBe('Шанс, что сработает: 50%.');
    expect(users.textContent).toContain('Если сработает: пользователи уходят на 2% реже — навсегда. Репутация +2.');
    expect(users.textContent).toContain('Если нет: работа впустую, технический долг +3.');

    const client = panel.querySelector('[data-request="client"]')!;
    expect(client.querySelector('[data-request-chance]')!.textContent).toBe('Исход известен заранее.');
    expect(client.textContent).toMatch(/Заплатит \$8[\s ]000, если успеете за 40 дн\. Технический долг \+6\. Сорвёте срок — денег не будет, репутация -3\./);
    expect(client.querySelector('[data-request-check]')).toBeNull();

    const bet = panel.querySelector('[data-request="bet"]')!;
    expect(bet.querySelector('[data-request-chance]')!.textContent).toBe('Шанс, что сработает: 33%.');
    expect(bet.textContent).toContain('рынок вырастет на 4% — навсегда, и 30 дн. новых людей будет на 30% больше');
    expect(bet.querySelector('[data-request-check]')!.textContent).toMatch(/Проверить спрос · \$4[\s ]000/);
    expect(missing(container.textContent)).toEqual([]);
    close();
  });

  it('взяли запрос — он в очереди под своим названием, кнопка гаснет, виден срок клиента', () => {
    useStore.setState({ game: built() });
    const { container, close } = show(<Product />);
    const name = container.querySelector('[data-request="client"] h4')!.textContent!;
    act(() => (container.querySelector('[data-request-take="client"]') as HTMLButtonElement).click());
    const game = useStore.getState().game!;
    expect(game.tasks[0]).toMatchObject({ kind: 'request', source: 'client' });
    expect((container.querySelector('[data-request-take="client"]') as HTMLButtonElement).disabled).toBe(true);
    expect(container.querySelector('[data-request-take="client"]')!.textContent).toBe('Уже взято');
    expect(container.querySelector('[data-roadmap-work="client"]')!.textContent).toMatch(new RegExp(`В работе: «${name}» — 0%\\. До срока клиента 40 дн\\., оплата \\$8[\\s ]000\\.`));
    // В очереди задач запрос назван по имени, а не ключом.
    expect(container.querySelector('.log')!.textContent).toContain(name);
    expect(missing(container.textContent)).toEqual([]);
    close();
  });

  it('проверка спроса: сначала идёт, потом вместо шанса — что она показала', () => {
    useStore.setState({ game: built(waveWhere('bet', false)) });
    const { container, close } = show(<RoadmapPanel />);
    act(() => (container.querySelector('[data-request-check="bet"]') as HTMLButtonElement).click());
    expect(container.querySelector('[data-request="bet"]')!.textContent).toContain('Проверяем спрос: ещё 7 дн.');
    // Вторая проверка в этом периоде недоступна.
    expect((container.querySelector('[data-request-check="users"]') as HTMLButtonElement).disabled).toBe(true);
    expect(container.textContent).toContain('Проверка в этом периоде уже потрачена.');

    const game = useStore.getState().game!;
    act(() => useStore.setState({ game: { ...game, day: game.day + 7 } }));
    expect(container.querySelector('[data-request="bet"] [data-request-chance]')!.textContent).toBe('Проверка показала: этим не будут пользоваться.');
    expect(missing(container.textContent)).toEqual([]);
    close();
  });

  it('готовый запрос попадает в ленту и в итог панели', () => {
    const start = built(waveWhere('users', true));
    useStore.setState({ game: start });
    const { container, close } = show(<RoadmapPanel />);
    const name = container.querySelector('[data-request="users"] h4')!.textContent!;
    act(() => (container.querySelector('[data-request-take="users"]') as HTMLButtonElement).click());
    const taken = useStore.getState().game!;
    const almost: GameState = { ...taken, tasks: taken.tasks.map((t) => (t.kind === 'request' ? { ...t, progress: t.cost - 0.01 } : t)) };
    act(() => useStore.setState({ game: tick(almost, quiet) }));
    expect(container.textContent).toContain('Сделано запросов: 1. Сработало: 1, впустую: 0.');
    expect(container.querySelector('[data-roadmap-last]')!.textContent).toBe(`Последний запрос — «${name}»: сработало.`);
    expect(missing(container.textContent)).toEqual([]);
    close();

    const feed = show(<FeedList />);
    expect(feed.container.textContent).toContain(`«${name}» понравилось пользователям: уходят реже.`);
    expect(missing(feed.container.textContent)).toEqual([]);
    feed.close();
  });

  it('у каждого источника ровно столько названий, сколько ждёт расчёт', async () => {
    const ui = (await import('../src/content/ru/ui.json')).default as unknown as { product: { roadmap: { names: Record<string, string[]> } } };
    for (const source of cfg.sources) {
      const names = ui.product.roadmap.names[source.id]!;
      expect(names, source.id).toHaveLength(cfg.names);
      expect(new Set(names).size, source.id).toBe(cfg.names);
    }
  });
});
