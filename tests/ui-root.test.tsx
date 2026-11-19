// @vitest-environment jsdom
// Одна ссылка на всю игру: заставка, потом квартира. Где рисовать нельзя (здесь, в тестах) — сразу обычный экран игры.
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, describe, expect, it } from 'vitest';
import '../src/ui/i18n';
import { Root } from '../src/ui/Root';
import { useStore } from '../src/ui/store';
import { newGame } from './helpers';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function render(): string {
  const container = document.createElement('div');
  const root = createRoot(container);
  act(() => root.render(<Root />));
  const html = container.innerHTML;
  act(() => root.unmount());
  return html;
}

describe('вход в игру', () => {
  beforeEach(() => useStore.setState({ game: null, roomBroken: false }));

  it('без холста заставка не показывается — открывается экран создания компании', () => {
    const html = render();
    expect(html).not.toContain('in-page');
    expect(html).toContain('ng');
  });

  it('идёт партия — заставки нет, показывается игра', () => {
    useStore.setState({ game: newGame() });
    const html = render();
    expect(html).not.toContain('in-page');
    expect(html).toContain('layout');
  });
});
