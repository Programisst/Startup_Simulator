// @vitest-environment jsdom
// Карточка «Пользователи»: «Платящих» показывается только там, где платят сами пользователи.
import { describe, expect, it } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import '../src/ui/i18n';
import { Overview } from '../src/ui/screens/Overview';
import { useStore } from '../src/ui/store';
import type { BusinessModel } from '../src/core';
import { launchedGame } from './helpers';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const html = (businessModel: BusinessModel): string => {
  useStore.setState({ game: { ...launchedGame(), businessModel, users: 1000, paying: businessModel === 'subscription' ? 40 : 0 } });
  const container = document.createElement('div');
  const root = createRoot(container);
  act(() => root.render(<Overview />));
  const out = container.innerHTML;
  act(() => root.unmount());
  return out;
};

describe('карточка пользователей', () => {
  it('при подписке показывает число платящих', () => {
    expect(html('subscription')).toContain('Платящих');
  });

  it('при остальных моделях объясняет, откуда доход, а не пишет «Платящих: 0»', () => {
    expect(html('ads')).toContain('Доход — реклама в продукте');
    expect(html('commission')).toContain('Доход — комиссия со сделок');
    expect(html('oneTime')).toContain('Доход — разовые покупки');
    for (const model of ['ads', 'commission', 'oneTime'] as const) expect(html(model)).not.toContain('Платящих');
  });
});
