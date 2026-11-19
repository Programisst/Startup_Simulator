// @vitest-environment jsdom
// Обучение первой партии: шаги выводятся из состояния игры и ведут к запуску продукта.
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import ru from '../src/content/ru/ui.json';
import '../src/ui/i18n';
import { App } from '../src/ui/App';
import { COMPANY_TABS } from '../src/ui/office/CompanyApp';
import { useStore } from '../src/ui/store';
import { tutorialSeen, tutorialStep, type TutorialInput, type TutorialStep } from '../src/ui/tutorial';
import { baseSetup } from './helpers';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const start: TutorialInput = { active: true, running: true, computerOpen: false, onProduct: false, paused: true, coreQueued: false, coreDone: false, launched: false };
const step = (over: Partial<TutorialInput>) => tutorialStep({ ...start, ...over });

describe('шаги обучения', () => {
  it('ведут от двери до запуска продукта', () => {
    expect(step({})).toBe('goToComputer');
    expect(step({ computerOpen: true })).toBe('openProduct');
    expect(step({ computerOpen: true, onProduct: true })).toBe('queueCore');
    expect(step({ computerOpen: true, onProduct: true, coreQueued: true })).toBe('startTime');
    expect(step({ coreQueued: true, paused: false })).toBe('waitCore');
    expect(step({ coreDone: true })).toBe('backToComputer');
    expect(step({ coreDone: true, computerOpen: true })).toBe('openProductLaunch');
    expect(step({ coreDone: true, computerOpen: true, onProduct: true })).toBe('launch');
    expect(step({ coreDone: true, launched: true })).toBe('done');
  });

  it('подстраиваются, если игрок сделал шаг раньше подсказки', () => {
    // Поставил задачу и сразу запустил время, не вставая из-за компьютера.
    expect(step({ computerOpen: true, onProduct: true, coreQueued: true, paused: false })).toBe('waitCore');
    // Встал из-за компьютера на полпути — подсказка снова зовёт к столу.
    expect(step({ onProduct: true })).toBe('goToComputer');
  });

  it('выключенное обучение и оконченная партия подсказок не дают', () => {
    expect(step({ active: false })).toBeNull();
    expect(step({ running: false })).toBeNull();
  });

  it('у каждого шага есть текст', () => {
    const steps: TutorialStep[] = ['goToComputer', 'openProduct', 'queueCore', 'startTime', 'waitCore', 'backToComputer', 'openProductLaunch', 'launch', 'done'];
    for (const s of steps) expect((ru.coach as Record<string, string>)[s]?.length ?? 0, s).toBeGreaterThan(10);
  });

  it('в компьютере есть все разделы компании, а «Офис» — это сама квартира', () => {
    expect(COMPANY_TABS).toEqual(['overview', 'product', 'team', 'marketing', 'finance']);
  });
});

describe('обучение на экране (без 3D меню всегда под рукой)', () => {
  let box: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    window.localStorage.clear();
    box = document.createElement('div');
    document.body.append(box);
    root = createRoot(box);
    useStore.getState().start(baseSetup);
    act(() => root.render(<App />));
  });

  afterEach(() => {
    act(() => root.unmount());
    box.remove();
    useStore.setState({ game: null, tutorial: false });
  });

  const click = (el: Element) =>
    act(() => {
      el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
  const button = (text: string) => [...box.querySelectorAll('button')].find((b) => b.textContent?.trim() === text)!;
  const coach = () => box.querySelector('.coach')?.textContent ?? '';
  const stepNow = () => box.querySelector('[data-coach]')?.getAttribute('data-coach');

  it('новая партия начинается с обучения и проходит все шаги до запуска', () => {
    expect(useStore.getState().tutorial).toBe(true);
    expect(stepNow()).toBe('openProduct');
    expect(coach()).toContain('Откройте «Продукт»');

    click(box.querySelector('[data-nav="product"]')!);
    expect(stepNow()).toBe('queueCore');
    expect(coach()).toContain('Основа сервиса');

    click(box.querySelector('[data-coach-target="queueCore"]')!);
    expect(stepNow()).toBe('startTime');

    click(box.querySelector('[data-coach-target="speed1"]')!);
    expect(stepNow()).toBe('waitCore');
    expect(coach()).toMatch(/ещё \d+ дн\./);

    for (let i = 0; i < 60 && !useStore.getState().game!.doneFeatures.includes('core'); i++) {
      act(() => {
        const s = useStore.getState();
        if (s.game!.pendingEvent) s.dispatch({ type: 'chooseEvent', choiceId: 'sideJob' });
        if (useStore.getState().game!.pendingEvent) useStore.setState({ game: { ...useStore.getState().game!, pendingEvent: null } });
        useStore.getState().step();
      });
    }
    expect(useStore.getState().game!.doneFeatures).toContain('core');
    expect(stepNow()).toBe('launch');

    click(box.querySelector('[data-coach-target="launch"]')!);
    expect(useStore.getState().game!.launched).toBe(true);
    expect(stepNow()).toBe('done');
    expect(coach()).toContain('Продукт на рынке');
    expect(box.textContent?.match(/\bcoach\.[A-Za-z0-9_.]+/g) ?? []).toEqual([]);

    click(button('Понятно'));
    expect(box.querySelector('.coach')).toBeNull();
    expect(tutorialSeen()).toBe(true);
  });

  it('обучение можно пропустить, и во второй партии оно не появляется', () => {
    click(button('Пропустить обучение'));
    expect(box.querySelector('.coach')).toBeNull();
    act(() => useStore.getState().start(baseSetup));
    expect(useStore.getState().tutorial).toBe(false);
    expect(box.querySelector('.coach')).toBeNull();
  });

  it('загруженная партия идёт без обучения', () => {
    act(() => {
      useStore.getState().save();
      useStore.getState().load();
    });
    expect(useStore.getState().tutorial).toBe(false);
  });
});
