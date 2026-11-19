// @vitest-environment jsdom
// Простой экран акций: все тексты на месте, кнопка запускает акцию.
import { describe, expect, it } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import '../src/ui/i18n';
import { content } from '../src/content';
import { Marketing } from '../src/ui/screens/Marketing';
import { useStore } from '../src/ui/store';
import { launchedGame } from './helpers';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('акции на экране «Маркетинг»', () => {
  it('показаны все акции с шансами, без пропущенных текстов; кнопка запускает', () => {
    useStore.setState({ game: { ...launchedGame(), cash: 50_000, quality: 60 } });
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => root.render(<Marketing />));

    const cards = container.querySelectorAll('[data-campaign]');
    expect(cards).toHaveLength(content.config.marketing.campaigns.length);
    expect(container.textContent).toContain('Обзор у блогера');
    expect(container.textContent).toMatch(/Провал \d+% · сработает \d+% · выстрелит \d+%/);
    expect(container.textContent?.match(/\b(marketing|feed|errors)\.[A-Za-z0-9_.]+/g) ?? []).toEqual([]);

    const button = container.querySelector<HTMLButtonElement>('[data-campaign="blogger"] button')!;
    expect(button.disabled).toBe(false);
    act(() => button.click());
    expect(useStore.getState().game!.campaigns!.active).toMatchObject({ id: 'blogger' });
    expect(container.textContent).toContain('Идёт акция «Обзор у блогера»');
    expect(container.querySelector<HTMLButtonElement>('[data-campaign="giveaway"] button')!.disabled).toBe(true);

    act(() => root.unmount());
    container.remove();
  });
});
