// @vitest-environment jsdom
// Разговор с сотрудником на экране команды. Нейросеть подменена — настоящих запросов нет.
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AI_ROUTES } from '../src/ai/protocol';
import { content } from '../src/content';
import { teamOf, type Employee, type GameState } from '../src/core';
import '../src/ui/i18n';
import { TALK_TURNS } from '../src/ui/components/TalkChat';
import { Team } from '../src/ui/screens/Team';
import { useStore } from '../src/ui/store';
import { newGame } from './helpers';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let box: HTMLDivElement;
let root: Root;
const worker: Employee = { id: 900, role: 'developer', skill: 1, trait: 'calm', salaryAsk: 3000, salary: 3000, nameSeed: 5, hiredDay: 0, motivation: 50, driver: 'peace' };
const withWorker = (over: Partial<Employee> = {}): GameState => {
  const s = newGame();
  return { ...s, cash: 1e6, idea: 'Приложение для собак', team: { ...teamOf(s, content), employees: [{ ...worker, ...over }] } };
};

type Reply = { status?: number; body: unknown } | 'network-error';
function fakeServer(replies: Record<string, Reply | Reply[]>) {
  const calls: { url: string; body: any }[] = [];
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    calls.push({ url, body: init?.body ? JSON.parse(init.body as string) : null });
    const entry = replies[url];
    const reply = Array.isArray(entry) ? (entry.length > 1 ? entry.shift() : entry[0]) : entry;
    if (!reply || reply === 'network-error') throw new Error('offline');
    return { ok: (reply.status ?? 200) < 400, json: async () => reply.body };
  });
  return calls;
}

async function mount(game: GameState) {
  useStore.setState({ game, screen: 'team', speed: 0, lastError: null });
  box = document.createElement('div');
  document.body.append(box);
  root = createRoot(box);
  await act(async () => root.render(<Team />));
}

beforeEach(() => vi.unstubAllGlobals());
afterEach(() => {
  act(() => root.unmount());
  box.remove();
  vi.unstubAllGlobals();
  useStore.setState({ game: null });
});

const click = (el: Element) =>
  act(async () => {
    el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
async function say(text: string) {
  const input = box.querySelector<HTMLTextAreaElement>('.talk-input')!;
  Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(input, text);
  await act(async () => {
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await click(box.querySelector('[data-talk-send]')!);
}
const member = () => teamOf(useStore.getState().game!, content).employees[0]!;
const ON = { body: { available: true } };

describe('разговор с сотрудником', () => {
  it('без нейросети кнопка работает по-старому: разговор одной кнопкой', async () => {
    fakeServer({});
    await mount(withWorker());
    await click(box.querySelector('[data-talk="900"]')!);
    expect(box.querySelector('.talk')).toBeNull();
    expect(member().motivation).toBe(50 + content.config.team.talkBoost);
  });

  it('с нейросетью открывается разговор; ей уходят характер человека, дела компании и слова основателя', async () => {
    const calls = fakeServer({ [AI_ROUTES.status]: ON, [AI_ROUTES.talk]: { body: { reply: 'Спасибо, что заметили.', outcome: 'better' } } });
    await mount(withWorker());
    await click(box.querySelector('[data-talk="900"]')!);
    expect(box.querySelector('.talk')).not.toBeNull();
    // Пока ничего не сказано, разговора не было: мотивация и перерыв не тронуты.
    expect(member()).toMatchObject({ motivation: 50 });
    expect(member().lastTalkDay).toBeUndefined();

    await say('Отменяю спешку с понедельника.');
    const sent = calls.at(-1)!;
    expect(sent.url).toBe(AI_ROUTES.talk);
    expect(sent.body.message).toBe('Отменяю спешку с понедельника.');
    expect(sent.body.person.driver).toContain('Ценит спокойный ритм');
    expect(sent.body.person.mood).toBe('mid');
    expect(sent.body.company).toMatchObject({ idea: 'Приложение для собак' });
    expect(sent.body.company.facts.join(' ')).toContain('Продукт ещё не вышел на рынок');
    expect(box.textContent).toContain('Спасибо, что заметили.');
    expect(box.textContent?.match(/\bteam\.chat\.[A-Za-z0-9_.]+/g) ?? []).toEqual([]);

    await click(box.querySelector('[data-talk-end]')!);
    expect(member().motivation).toBe(50 + content.config.team.talkBoost);
    expect(member().chat).toEqual([
      { from: 'founder', text: 'Отменяю спешку с понедельника.' },
      { from: 'employee', text: 'Спасибо, что заметили.' },
    ]);
    expect(box.textContent).toContain('Разговор пошёл на пользу');
  });

  it('плохой разговор роняет мотивацию; неизвестный исход считается «без изменений»', async () => {
    fakeServer({ [AI_ROUTES.status]: ON, [AI_ROUTES.talk]: { body: { reply: 'Понятно.', outcome: 'worse' } } });
    await mount(withWorker());
    await click(box.querySelector('[data-talk="900"]')!);
    await say('Работай быстрее.');
    await click(box.querySelector('[data-talk-end]')!);
    expect(member().motivation).toBe(50 + content.config.team.talkWorse);
    expect(box.textContent).toContain('сделал хуже');
  });

  it('нейросеть не может назвать свой исход или подсунуть числа', async () => {
    fakeServer({ [AI_ROUTES.status]: ON, [AI_ROUTES.talk]: { body: { reply: 'Ладно.', outcome: 'motivation+100', motivation: 100, salary: 1 } } });
    await mount(withWorker());
    await click(box.querySelector('[data-talk="900"]')!);
    await say('Ты лучший.');
    await click(box.querySelector('[data-talk-end]')!);
    expect(member().motivation).toBe(50 + content.config.team.talkSame);
    expect(member().salary).toBe(3000);
  });

  it('после трёх реплик разговор заканчивается сам, исход берётся из последнего ответа', async () => {
    const calls = fakeServer({
      [AI_ROUTES.status]: ON,
      [AI_ROUTES.talk]: [{ body: { reply: 'Раз.', outcome: 'worse' } }, { body: { reply: 'Два.', outcome: 'same' } }, { body: { reply: 'Три.', outcome: 'better' } }],
    });
    await mount(withWorker());
    await click(box.querySelector('[data-talk="900"]')!);
    for (let i = 0; i < TALK_TURNS; i++) await say(`Реплика ${i}`);
    expect(calls.filter((c) => c.url === AI_ROUTES.talk)).toHaveLength(TALK_TURNS);
    // Во втором запросе нейросеть уже видит начало разговора.
    expect(calls.filter((c) => c.url === AI_ROUTES.talk)[1]!.body.history).toEqual([
      { from: 'founder', text: 'Реплика 0' },
      { from: 'employee', text: 'Раз.' },
    ]);
    expect(member().motivation).toBe(50 + content.config.team.talkBoost);
    expect(member().chat).toHaveLength(TALK_TURNS * 2);
    expect(box.querySelector('.talk-input')).toBeNull();
  });

  it('нейросеть не ответила — реплика не засчитана, разговор можно отложить без последствий', async () => {
    fakeServer({ [AI_ROUTES.status]: ON, [AI_ROUTES.talk]: 'network-error' });
    await mount(withWorker());
    await click(box.querySelector('[data-talk="900"]')!);
    await say('Привет.');
    expect(box.textContent).toContain('Разговор не сложился');
    expect(box.querySelector<HTMLTextAreaElement>('.talk-input')!.value).toBe('Привет.');
    await click(box.querySelector('[data-talk-end]')!);
    expect(member()).toMatchObject({ motivation: 50 });
    expect(member().lastTalkDay).toBeUndefined();
    expect(box.querySelector('.talk')).toBeNull();
  });

  it('прошлый разговор виден при следующем и уходит нейросети как история', async () => {
    const calls = fakeServer({ [AI_ROUTES.status]: ON, [AI_ROUTES.talk]: { body: { reply: 'Помню.', outcome: 'same' } } });
    await mount(withWorker({ chat: [{ from: 'founder', text: 'Обещаю выходные.' }, { from: 'employee', text: 'Хорошо бы.' }] }));
    await click(box.querySelector('[data-talk="900"]')!);
    expect(box.textContent).toContain('Из прошлых разговоров');
    expect(box.textContent).toContain('Обещаю выходные.');
    await say('Как ты?');
    expect(calls.at(-1)!.body.history[0]).toEqual({ from: 'founder', text: 'Обещаю выходные.' });
  });
});
