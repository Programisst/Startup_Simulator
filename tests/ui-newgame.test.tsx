// @vitest-environment jsdom
// Экран создания компании: идея словами, разбор, подсказки и запуск партии.
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import '../src/ui/i18n';
import { NewGame } from '../src/ui/screens/NewGame';
import { useStore } from '../src/ui/store';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let box: HTMLDivElement;
let root: Root;

beforeEach(() => {
  useStore.setState({ game: null });
  box = document.createElement('div');
  document.body.append(box);
  root = createRoot(box);
  act(() => root.render(<NewGame />));
});

afterEach(() => {
  act(() => root.unmount());
  box.remove();
});

function type(el: HTMLTextAreaElement | HTMLInputElement | HTMLSelectElement, value: string) {
  const proto = Object.getPrototypeOf(el) as object;
  Object.getOwnPropertyDescriptor(proto, 'value')!.set!.call(el, value);
  act(() => {
    el.dispatchEvent(new Event(el instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }));
  });
}

function click(el: Element) {
  act(() => {
    el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
}

const idea = () => box.querySelector('textarea')!;
const selects = () => [...box.querySelectorAll('select')];
const startButton = () => box.querySelector<HTMLButtonElement>('.ng-start')!;
const button = (text: string) => [...box.querySelectorAll('button')].find((b) => b.textContent?.includes(text))!;

describe('экран создания компании', () => {
  it('без идеи и без выбора начать нельзя', () => {
    expect(startButton().disabled).toBe(true);
    expect(box.textContent).toContain('Сначала запишите идею или выберите продукт');
  });

  it('идея словами определяет продукт, аудиторию и доход и попадает в партию', () => {
    type(idea(), 'Приложение для родителей: расписание ребёнка, по подписке');
    expect(selects().map((s) => s.value)).toEqual(['mobile', 'parents', 'subscription']);
    expect(startButton().disabled).toBe(false);
    click(startButton());
    const game = useStore.getState().game!;
    expect(game.productType).toBe('mobile');
    expect(game.audienceId).toBe('parents');
    expect(game.idea).toBe('Приложение для родителей: расписание ребёнка, по подписке');
  });

  it('непонятную идею можно доопределить руками', () => {
    type(idea(), 'Хочу сделать что-то великое');
    expect(startButton().disabled).toBe(true);
    expect(box.textContent).toContain('не удалось понять');
    type(selects()[0]!, 'devtools');
    expect(selects()[1]!.value).toBe('developers');
    expect(startButton().disabled).toBe(false);
    click(startButton());
    expect(useStore.getState().game!.productType).toBe('devtools');
  });

  it('ручная поправка держится, пока игрок не перепишет идею', () => {
    type(idea(), 'Нейросеть для студентов');
    type(selects()[2]!, 'oneTime');
    expect(selects().map((s) => s.value)).toEqual(['ai', 'students', 'oneTime']);
    type(idea(), 'Маркетплейс для фрилансеров');
    expect(selects().map((s) => s.value)).toEqual(['marketplace', 'freelancers', 'commission']);
  });

  it('«Нет идеи?» показывает три подсказки, выбранная заполняет всё сама', () => {
    click(button('Нет идеи?'));
    const stickers = [...box.querySelectorAll('.ng-sticker')];
    expect(stickers).toHaveLength(3);
    click(stickers[0]!);
    expect(idea().value.length).toBeGreaterThan(20);
    expect(startButton().disabled).toBe(false);
    click(startButton());
    expect(useStore.getState().game!.idea).toBe(idea().value);
  });

  it('подсказки можно сузить до одной темы', () => {
    click(button('Нет идеи?'));
    click(button('Еда'));
    const labels = [...box.querySelectorAll('.ng-sticker small')].map((s) => s.textContent);
    expect(labels).toEqual(['Еда', 'Еда', 'Еда']);
  });

  it('кнопка «Придумать» даёт название компании', () => {
    const name = box.querySelector<HTMLInputElement>('.ng-name input')!;
    expect(name.value).toBe('');
    click(button('Придумать'));
    expect(name.value.length).toBeGreaterThan(3);
  });
});
