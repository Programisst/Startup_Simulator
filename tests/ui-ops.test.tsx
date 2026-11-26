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

  it('пока лишних людей нет, сокращение не предлагается', () => {
    useStore.setState({ game: { ...game(1_000_000), ops: { level: 1_000_000 } } });
    const { container, close } = show(<OpsPanel />);
    expect(container.querySelector('[data-ops-cut]')).toBeNull();
    expect(container.textContent).toContain('по своей воле за год уходит только 15% людей');
    close();
  });

  it('доход упал: видно, сколько стоят лишние люди, и оба сокращения с ценой, последствиями и риском', () => {
    const g = game(1_000_000);
    useStore.setState({ game: { ...g, cash: 1e7, ops: { level: 1_000_000 }, recentDays: g.recentDays.map((d, i) => (i >= 60 ? { ...d, revenue: 500_000 / 30 } : d)) } });
    const { container, close } = show(<OpsPanel />);
    expect(container.textContent).toMatch(/Доход упал до \$500[\s ]000 в месяц, а службы набраны под \$1[\s ]000[\s ]000\. Лишние люди стоят \$325[\s ]000 в месяц\./);
    const options = container.querySelectorAll('[data-ops-cut-option]');
    expect(options).toHaveLength(2);
    const full = container.querySelector('[data-ops-cut-option="full"]')!;
    expect(full.textContent).toMatch(/Службы станут дешевле на \$325[\s ]000 в месяц\. Пособия уволенным — \$650[\s ]000 сразу: окупится за 2 мес\./);
    expect(full.textContent).toContain('Репутация -4, настрой команды -10.');
    expect(full.textContent).toContain('Риск 35%: сократите лишнего, и 60 дней пользователи будут уходить на 20% чаще.');
    expect(container.querySelector('[data-ops-cut-option="part"]')!.textContent).toMatch(/дешевле на \$162[\s ]500 в месяц/);
    expect(missing(container.textContent)).toEqual([]);

    // Нажали — службы сжались, появилась запись о сокращении, второе подряд недоступно.
    act(() => (container.querySelector('[data-ops-cut-button="full"]') as HTMLButtonElement).click());
    const after = useStore.getState().game!;
    expect(after.ops?.level).toBeCloseTo(500_000, 6);
    expect(after.cash).toBe(1e7 - 650_000);
    expect(container.querySelector('[data-ops-cut]')).toBeNull();
    expect(container.querySelector('[data-ops-last]')!.textContent).toMatch(/Последнее сокращение: пособия \$650[\s ]000, службы дешевле на \$325[\s ]000 в месяц/);
    expect(missing(container.textContent)).toEqual([]);
    close();
  });

  it('без денег на пособия кнопки не нажимаются и объясняют почему', () => {
    const g = game(1_000_000);
    useStore.setState({ game: { ...g, cash: 1000, ops: { level: 1_000_000 }, recentDays: g.recentDays.map((d, i) => (i >= 60 ? { ...d, revenue: 500_000 / 30 } : d)) } });
    const { container, close } = show(<OpsPanel />);
    expect((container.querySelector('[data-ops-cut-button="full"]') as HTMLButtonElement).disabled).toBe(true);
    expect(container.textContent).toContain('Не хватает денег на пособия.');
    close();
  });
});
