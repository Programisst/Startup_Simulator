// @vitest-environment jsdom
// Экран команды: наём, зарплата, увольнение — через настоящие команды ядра.
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { teamOf, teamView, type Employee, type GameState } from '../src/core';
import { content } from '../src/content';
import ru from '../src/content/ru/ui.json';
import '../src/ui/i18n';
import { App } from '../src/ui/App';
import { money } from '../src/ui/format';
import { useStore } from '../src/ui/store';
import { launchedGame, newGame } from './helpers';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let box: HTMLDivElement;
let root: Root;

function show(game: GameState, screen: 'team' | 'finance' = 'team') {
  useStore.setState({ game, screen, speed: 0, lastError: null });
  act(() => root.render(<App />));
}

beforeEach(() => {
  box = document.createElement('div');
  document.body.append(box);
  root = createRoot(box);
});

afterEach(() => {
  act(() => root.unmount());
  box.remove();
  useStore.setState({ game: null });
});

function click(el: Element) {
  act(() => {
    el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
}

const button = (text: string) => [...box.querySelectorAll('button')].filter((b) => b.textContent?.includes(text));
const game = () => useStore.getState().game!;
const worker: Employee = { id: 900, role: 'developer', skill: 1, trait: 'calm', salaryAsk: 3000, salary: 3000, nameSeed: 5, hiredDay: 0, motivation: 70 };
const withTeam = (s: GameState, employees: Employee[]): GameState => ({ ...s, team: { ...teamOf(s, content), employees } });

/** Пропущенный перевод i18next показывает как сам ключ. */
function expectNoMissingTexts() {
  expect(box.textContent?.match(/\b(team|nav|finance|errors)\.[A-Za-z0-9_.]+/g) ?? []).toEqual([]);
}

describe('экран команды', () => {
  it('в начале: трое кандидатов, команда пуста, все тексты на месте', () => {
    show(newGame());
    expect(box.textContent).toContain('Пока вы работаете в одиночку');
    expect(button('Нанять')).toHaveLength(content.config.team.candidatesShown);
    expect(box.textContent).toContain('0 / 3');
    expectNoMissingTexts();
  });

  it('кнопка «Нанять» нанимает кандидата и добавляет зарплату', () => {
    show(newGame());
    const first = teamView(game(), content).candidates[0]!;
    click(button('Нанять')[0]!);
    const view = teamView(game(), content);
    expect(view.members.map((m) => m.id)).toEqual([first.id]);
    expect(box.textContent).toContain('1 / 3');
    expect(box.textContent).toContain('Новый человек в команде');
    expect(button('Нанять')).toHaveLength(content.config.team.candidatesShown - 1);
    expectNoMissingTexts();
  });

  it('когда мест нет, нанять нельзя', () => {
    show(withTeam(newGame(), [worker, { ...worker, id: 901 }, { ...worker, id: 902 }]));
    for (const b of button('Нанять')) expect(b.disabled).toBe(true);
    expect(box.textContent).toContain('Мест больше нет');
  });

  it('зарплату можно поменять в поле', () => {
    show(withTeam(newGame(), [worker]));
    const input = box.querySelector<HTMLInputElement>('.salary input')!;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, '3500');
    act(() => {
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(teamView(game(), content).payrollPerMonth).toBe(3500);
  });

  it('увольнение — в два шага и с выходным пособием', () => {
    show(withTeam(newGame(), [worker]));
    const cash = game().cash;
    click(button('Уволить')[0]!);
    expect(teamView(game(), content).members).toHaveLength(1);
    expect(box.textContent).toContain(`Уволить и выплатить ${money(1500)}`);
    click(button('Отмена')[0]!);
    expect(teamView(game(), content).members).toHaveLength(1);
    click(button('Уволить')[0]!);
    click(button('Уволить и выплатить')[0]!);
    expect(teamView(game(), content).members).toHaveLength(0);
    expect(game().cash).toBe(cash - 1500);
    expect(box.textContent).toContain('Увольнение:');
  });

  it('предупреждает, когда денег мало, и когда человек готов уйти', () => {
    show(withTeam({ ...newGame(), cash: 2000 }, [worker]));
    expect(box.textContent).toContain('меньше, чем на три месяца зарплат');
    show(withTeam({ ...newGame(), cash: -5, rush: true }, [{ ...worker, trait: 'diligent', salary: 100, motivation: 20 }]));
    expect(box.textContent).toContain('Счёт в минусе, а зарплаты идут');
    expect(box.textContent).toContain('уйдёт из компании');
    expectNoMissingTexts();
  });

  it('имён хватает, чтобы люди редко совпадали', () => {
    expect(ru.team.firstNames.length * ru.team.lastNames.length).toBeGreaterThanOrEqual(400);
    expect(new Set(ru.team.firstNames).size).toBe(ru.team.firstNames.length);
    expect(new Set(ru.team.lastNames).size).toBe(ru.team.lastNames.length);
  });

  it('старое сохранение без команды открывается', () => {
    const old = { ...launchedGame() };
    delete old.team;
    show(old);
    expect(button('Нанять')).toHaveLength(content.config.team.candidatesShown);
  });

  it('зарплаты видны на экране финансов', () => {
    let s = withTeam(newGame(), [worker]);
    useStore.setState({ game: s });
    useStore.getState().step();
    s = useStore.getState().game!;
    show(s, 'finance');
    expect(box.textContent).toContain('Зарплаты');
    expect(box.textContent).toContain(money(-3000));
  });
});
