// @vitest-environment jsdom
// Проверка, что каждый экран рисуется без ошибок и без пропущенных текстов.
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, describe, expect, it } from 'vitest';
import { tick, type GameState } from '../src/core';
import { content } from '../src/content';
import '../src/ui/i18n';
import { App } from '../src/ui/App';
import { useStore, type ScreenId } from '../src/ui/store';
import { advance, launchedGame, newGame, run } from './helpers';

/** Пропущенный перевод i18next показывает как сам ключ, например «product.launch». */
function expectNoMissingTexts(html: string) {
  const text = html.replace(/<[^>]+>/g, ' ');
  const keys = text.match(/\b(app|nav|top|metrics|new|productTypes|audiences|models|difficulties|goals|overview|sources|product|marketing|finance|end|errors|events|features)\.[A-Za-z0-9_.]+/g);
  expect(keys ?? []).toEqual([]);
}

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** Рисует приложение в настоящем дереве страницы и возвращает получившуюся разметку. */
function renderApp(): string {
  const container = document.createElement('div');
  const root = createRoot(container);
  act(() => root.render(<App />));
  const html = container.innerHTML;
  act(() => root.unmount());
  expectNoMissingTexts(html);
  return html;
}

function render(game: GameState | null, screen: ScreenId = 'overview'): string {
  useStore.setState({ game, screen, speed: 0, lastError: null });
  return renderApp();
}

describe('экраны', () => {
  beforeEach(() => useStore.setState({ game: null }));

  it('экран создания компании', () => {
    expect(render(null)).toContain('Основать компанию');
  });

  it('все экраны новой партии', () => {
    expect(render(newGame(), 'overview')).toContain('Продукт ещё не запущен');
    expect(render(newGame(), 'product')).toContain('Очередь работ');
    expect(render(newGame(), 'marketing')).toContain('Рекламный бюджет');
    expect(render(newGame(), 'finance')).toContain('Жизнь основателя');
  });

  it('все экраны запущенной компании для каждого типа продукта', () => {
    for (const productType of Object.keys(content.productTypes) as (keyof typeof content.productTypes)[]) {
      let s = launchedGame({ productType, audienceId: content.productTypes[productType].audiences[0]!.id });
      s = run(s, { type: 'setAdSpend', perDay: 25 });
      s = run(s, { type: 'startPolish' });
      s = advance(s, 120);
      for (const screen of ['overview', 'product', 'marketing', 'finance'] as const) render(s, screen);
    }
  });

  it('карточка события', () => {
    const s = tick({ ...newGame(), cash: 1 }, content);
    expect(s.pendingEvent).toBe('cashCrisis');
    expect(render(s)).toContain('Деньги кончились');
  });

  it('экраны конца партии', () => {
    expect(render({ ...launchedGame(), status: 'bankrupt' })).toContain('Банкротство');
    expect(render({ ...launchedGame(), status: 'won' })).toContain('Цель достигнута');
  });

  it('команды с экрана меняют партию, ошибки показываются текстом', () => {
    useStore.setState({ game: newGame(), lastError: null });
    useStore.getState().dispatch({ type: 'launch' });
    expect(useStore.getState().lastError).toBe('coreFeatureRequired');
    expect(renderApp()).toContain('Сначала нужна основа продукта');
    useStore.getState().dispatch({ type: 'queueFeature', featureId: 'core' });
    expect(useStore.getState().game?.tasks).toHaveLength(1);
    for (let i = 0; i < 30; i++) {
      // На середине работы игра задаёт вопрос-развилку — отвечаем первым вариантом, иначе время стоит.
      const pendingId = useStore.getState().game?.pendingEvent;
      const pendingDef = content.events.find((e) => e.id === pendingId);
      if (pendingDef) useStore.getState().dispatch({ type: 'chooseEvent', choiceId: pendingDef.choices[0]!.id });
      useStore.getState().step();
    }
    expect(useStore.getState().game?.doneFeatures).toEqual(['core']);
  });
});
