// @vitest-environment jsdom
// Простая панель «Угрозы» на экране «Финансы»: что происходит, чем можно ответить и что из этого вышло.
import { describe, expect, it } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import '../src/ui/i18n';
import { content } from '../src/content';
import { threatOfWindow, tick, type GameState, type ThreatKind } from '../src/core';
import { EventModal } from '../src/ui/components/EventModal';
import { FeedList } from '../src/ui/components/Feed';
import { ThreatPanel } from '../src/ui/components/ThreatPanel';
import { Finance } from '../src/ui/screens/Finance';
import { useStore } from '../src/ui/store';
import { launchedGame } from './helpers';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const missing = (text: string | null) => text?.match(/\b(finance|feed|errors|metrics|events)\.[A-Za-z0-9_.]+/g) ?? [];
const cfg = content.config.threats;
const quiet = { ...content, events: content.events.filter((e) => e.threat) };

function big(): GameState {
  const base = launchedGame();
  return {
    ...base,
    cash: 1e9,
    users: 50_000,
    paying: 5000,
    capacity: 100_000,
    quality: 70,
    ops: { level: 600_000 },
    recentDays: Array.from({ length: 90 }, (_, i) => ({ day: base.day - 90 + i, cash: 1e9, users: 50_000, paying: 5000, revenue: 20_000, expenses: 0 })),
  };
}

/** Большая компания в день, когда началась угроза: сообщение ещё не прочитано. */
function started(kind: ThreatKind): GameState {
  const base = big();
  let window = 1;
  while (threatOfWindow(base.seed, window, content.config)?.kind !== kind) window++;
  return tick({ ...base, day: window * cfg.periodDays }, quiet);
}

function show(node: React.ReactNode) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => root.render(node));
  return { container, close: () => { act(() => root.unmount()); container.remove(); } };
}

describe('панель «Угрозы»', () => {
  it('у маленькой компании панели нет', () => {
    useStore.setState({ game: launchedGame() });
    const { container, close } = show(<ThreatPanel />);
    expect(container.querySelector('[data-threat]')).toBeNull();
    close();
  });

  it('большой компании в спокойное время называет шансы за год', () => {
    useStore.setState({ game: big() });
    const { container, close } = show(<ThreatPanel />);
    expect(container.querySelector('[data-threat="calm"]')).not.toBeNull();
    expect(container.textContent).toContain('спад рынка (шанс за год 15%) и сильный конкурент (шанс за год 22%)');
    expect(missing(container.textContent)).toEqual([]);
    close();
  });

  it('о начале угрозы игра сообщает отдельным окном, а в ленте появляется запись', () => {
    for (const [kind, title, line] of [
      ['downturn', 'На рынке спад', 'На рынке спад: новых клиентов меньше, старые уходят чаще.'],
      ['rival', 'В вашу нишу пришёл большой игрок', 'В вашу нишу пришёл сильный конкурент.'],
    ] as const) {
      useStore.setState({ game: started(kind) });
      const modal = show(<EventModal />);
      expect(modal.container.textContent).toContain(title);
      expect(modal.container.textContent).toContain('«Финансах»');
      expect(modal.container.querySelectorAll('button')).toHaveLength(1);
      expect(missing(modal.container.textContent)).toEqual([]);
      act(() => modal.container.querySelector('button')!.click());
      expect(useStore.getState().game!.pendingEvent).toBeNull();
      modal.close();

      const feed = show(<FeedList />);
      expect(feed.container.textContent).toContain(line);
      expect(missing(feed.container.textContent)).toEqual([]);
      feed.close();
    }
  });

  it('в спад показывает, что происходит, и два ответа с ценой, шансом и исходом', () => {
    useStore.setState({ game: { ...started('downturn'), pendingEvent: null } });
    const { container, close } = show(<Finance />);
    const panel = container.querySelector('[data-threat="downturn"]')!;
    expect(panel.textContent).toContain('Спад рынка');
    expect(panel.textContent).toContain('обычно спад длится от 8 до 18 месяцев');
    expect(panel.querySelector('[data-threat-pressure]')!.textContent).toBe('Сейчас: новых людей приходит на 25% меньше, пользователи уходят на 50% чаще.');

    const discount = panel.querySelector('[data-threat-response="discount"]')!;
    expect(discount.textContent).toContain('Денег сразу не стоит. Исход известен заранее.');
    expect(discount.textContent).toMatch(/людей приходит на 25% меньше обычного, уходят на 15% чаще\. Доход меньше на 10% — это около \$\d+[\s ]\d+ в месяц\./);
    const attack = panel.querySelector('[data-threat-response="attack"]')!;
    expect(attack.textContent).toMatch(/Стоит \$\d+[\s ]\d+ сразу\. Шанс удачи 50%\./);
    expect(attack.textContent).toContain('людей приходит на 10% больше обычного, уходят на 50% чаще.');
    expect(attack.textContent).toContain('Если нет: деньги потеряны, всё остаётся как сейчас.');
    expect(missing(container.textContent)).toEqual([]);

    // Выбрали скидки — ответы исчезли, давление изменилось.
    act(() => (panel.querySelector('[data-threat-respond="discount"]') as HTMLButtonElement).click());
    expect(useStore.getState().game!.threats?.active?.response).toBe('discount');
    expect(container.querySelector('[data-threat-response]')).toBeNull();
    expect(container.querySelector('[data-threat-answer]')!.textContent).toBe('Ваш ответ: «Скидки тем, кто хочет уйти». Сработало.');
    expect(container.querySelector('[data-threat-pressure]')!.textContent).toBe('Сейчас: новых людей приходит на 25% меньше, пользователи уходят на 15% чаще. Доход меньше на 10%.');
    expect(missing(container.textContent)).toEqual([]);
    close();
  });

  it('с конкурентом: рискованный ответ показывает шанс по качеству продукта и оба исхода', () => {
    useStore.setState({ game: { ...started('rival'), pendingEvent: null, quality: 70 } });
    const { container, close } = show(<ThreatPanel />);
    const outbuild = container.querySelector('[data-threat-response="outbuild"]')!;
    // 25% и по 0,6% за каждый пункт качества.
    expect(outbuild.textContent).toContain('Шанс удачи 67%.');
    expect(outbuild.textContent).toContain('Конкурент отступит через 60 дн.');
    expect(outbuild.textContent).toContain('спешка добавит технического долга (+10)');
    expect(container.querySelector('[data-threat-response="priceWar"]')!.textContent).toContain('Доход меньше на 15%');

    act(() => (container.querySelector('[data-threat-respond="outbuild"]') as HTMLButtonElement).click());
    const a = useStore.getState().game!.threats!.active!;
    const answer = container.querySelector('[data-threat-answer]')!.textContent!;
    if (a.success) expect(answer).toMatch(/Ваш ответ: «Обогнать продуктом»\. Сработало\. Конкурент отступит через 60 дн\./);
    else expect(answer).toMatch(/Ваш ответ: «Обогнать продуктом»\. Не получилось: \$\d+[\s ]\d+ потрачены зря\./);
    expect(missing(container.textContent)).toEqual([]);
    close();
  });

  it('без денег рискованный ответ не нажимается', () => {
    useStore.setState({ game: { ...started('downturn'), pendingEvent: null, cash: 500 } });
    const { container, close } = show(<ThreatPanel />);
    expect((container.querySelector('[data-threat-respond="attack"]') as HTMLButtonElement).disabled).toBe(true);
    expect((container.querySelector('[data-threat-respond="discount"]') as HTMLButtonElement).disabled).toBe(false);
    expect(container.textContent).toContain('Не хватает денег.');
    close();
  });

  it('после угрозы помнит, сколько она длилась', () => {
    const g = big();
    useStore.setState({ game: { ...g, threats: { active: null, endedDay: g.day - 10, count: 1, last: { kind: 'downturn', startDay: g.day - 310, endDay: g.day - 10, response: null, success: null } } } });
    const { container, close } = show(<ThreatPanel />);
    expect(container.textContent).toContain('Прошлая угроза — «Спад рынка» — закончилась. Она длилась 10 мес.');
    expect(missing(container.textContent)).toEqual([]);
    close();
  });
});
