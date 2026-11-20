// @vitest-environment jsdom
// Простая панель обещанного обновления на экране «Продукт»: тексты на месте, кнопка объявляет.
import { describe, expect, it } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import '../src/ui/i18n';
import { ReleasePanel } from '../src/ui/components/ReleasePanel';
import { useStore } from '../src/ui/store';
import { launchedGame, run } from './helpers';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('панель «Большое обновление»', () => {
  it('показывает девять обещаний без пропущенных текстов; после нажатия — ход работы', () => {
    useStore.setState({ game: { ...run(launchedGame(), { type: 'startPolish' }), cash: 50_000 } });
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => root.render(<ReleasePanel />));

    expect(container.querySelectorAll('[data-release-deadline]')).toHaveLength(9);
    expect(container.textContent).toContain('Большое обновление');
    expect(container.textContent).toMatch(/Смело · \d+ дн\./);
    expect(container.textContent).toMatch(/В срок: приток \+\d+% на \d+ дн\. Срыв: репутация -\d/);
    expect(container.textContent?.match(/\b(product|feed|errors)\.[A-Za-z0-9_.]+/g) ?? []).toEqual([]);

    act(() => container.querySelector<HTMLButtonElement>('[data-release-size="medium"] [data-release-deadline="exact"]')!.click());
    expect(useStore.getState().game!.release!.active).toMatchObject({ size: 'medium', deadline: 'exact' });
    expect(container.textContent).toContain('Обещано обновление: среднее, срок «впритык»');
    expect(container.textContent).toContain('При нынешнем темпе успеваете');
    expect(container.querySelectorAll('[data-release-deadline]')).toHaveLength(0);
    expect(container.textContent?.match(/\b(product|feed|errors)\.[A-Za-z0-9_.]+/g) ?? []).toEqual([]);

    act(() => root.unmount());
    container.remove();
  });
});
