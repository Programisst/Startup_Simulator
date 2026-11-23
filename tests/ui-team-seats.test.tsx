// @vitest-environment jsdom
// «Команда»: свободные места в офисе видны пустыми столами — сколько ещё людей можно взять.
import { describe, expect, it } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import '../src/ui/i18n';
import { content } from '../src/content';
import { officeView } from '../src/core';
import { Team } from '../src/ui/screens/Team';
import { useStore } from '../src/ui/store';
import { launchedGame } from './helpers';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('свободные места', () => {
  it('без сотрудников показано столько пустых мест, сколько мест в офисе', () => {
    const game = launchedGame();
    useStore.setState({ game });
    const container = document.createElement('div');
    const root = createRoot(container);
    act(() => root.render(<Team />));
    const seats = officeView(game, content.config).current.seats;
    expect(container.querySelectorAll('[data-free-seat]').length).toBe(seats);
    expect(container.textContent).toContain('Свободное место');
    act(() => root.unmount());
  });
});
