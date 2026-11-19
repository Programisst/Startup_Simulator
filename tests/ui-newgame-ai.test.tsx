// @vitest-environment jsdom
// Экран создания компании с нейросетью. Настоящих запросов нет: посредник подменён.
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AI_ROUTES } from '../src/ai/protocol';
import '../src/ui/i18n';
import { NewGame } from '../src/ui/screens/NewGame';
import { useStore } from '../src/ui/store';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let box: HTMLDivElement;
let root: Root;

type Reply = { status?: number; body: unknown } | 'network-error';

/** Подменяет посредника: на каждый адрес — свой ответ. Возвращает журнал запросов. */
function fakeServer(replies: Record<string, Reply>) {
  const calls: { url: string; body: unknown }[] = [];
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    calls.push({ url, body: init?.body ? JSON.parse(init.body as string) : null });
    const reply = replies[url];
    if (!reply || reply === 'network-error') throw new Error('offline');
    return { ok: (reply.status ?? 200) < 400, json: async () => reply.body };
  });
  return calls;
}

async function mount() {
  useStore.setState({ game: null });
  box = document.createElement('div');
  document.body.append(box);
  root = createRoot(box);
  await act(async () => root.render(<NewGame />));
}

afterEach(() => {
  act(() => root.unmount());
  box.remove();
  vi.unstubAllGlobals();
});

async function click(el: Element) {
  await act(async () => {
    el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
}

async function typeIdea(value: string) {
  const el = box.querySelector('textarea')!;
  Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(el, value);
  await act(async () => {
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

const button = (text: string) => [...box.querySelectorAll('button')].find((b) => b.textContent?.includes(text));
const selects = () => [...box.querySelectorAll('select')].map((s) => s.value);
const ON = { body: { available: true } };

describe('экран создания компании с нейросетью', () => {
  it('без посредника кнопки нейросети нет, экран работает как обычно', async () => {
    fakeServer({});
    await mount();
    await typeIdea('Приложение для собак');
    expect(button('Спросить мнение нейросети')).toBeUndefined();
    await click(button('Нет идеи?')!);
    expect(box.querySelectorAll('.ng-sticker')).toHaveLength(3);
  });

  it('«Нет идеи?» показывает идеи нейросети и передаёт ей тему', async () => {
    const calls = fakeServer({
      [AI_ROUTES.status]: ON,
      [AI_ROUTES.ideas]: {
        body: {
          ideas: [
            { text: 'Площадка, где соседи меняются рассадой', productType: 'marketplace', audienceId: 'everyone', businessModel: 'commission' },
            { text: 'Идея с выдуманным типом', productType: 'unicorn', audienceId: 'everyone', businessModel: 'ads' },
            { text: 'Нейросеть подбирает корм собаке', productType: 'ai', audienceId: 'parents', businessModel: 'subscription' },
          ],
        },
      },
    });
    await mount();
    await click(button('Нет идеи?')!);
    // Идея с неизвестным типом отброшена.
    const stickers = [...box.querySelectorAll('.ng-sticker')];
    expect(stickers).toHaveLength(2);
    expect(box.textContent).toContain('придумала нейросеть');

    await click(stickers[1]!);
    // У AI-продукта нет аудитории «родители» — игра заменила её допустимой.
    expect(selects()).toEqual(['ai', 'professionals', 'subscription']);

    await click(button('Еда')!);
    expect(calls.at(-1)).toEqual({ url: AI_ROUTES.ideas, body: { theme: 'Еда', lang: 'ru' } });
  });

  it('нейросеть не ответила на просьбу об идеях — показываются готовые', async () => {
    fakeServer({ [AI_ROUTES.status]: ON, [AI_ROUTES.ideas]: 'network-error' });
    await mount();
    await click(button('Нет идеи?')!);
    expect(box.querySelectorAll('.ng-sticker')).toHaveLength(3);
    expect(box.textContent).toContain('Нейросеть не ответила — вот готовые идеи');
  });

  it('мнение нейросети меняет разбор и показывает сильное и риск', async () => {
    const calls = fakeServer({
      [AI_ROUTES.status]: ON,
      [AI_ROUTES.analyze]: { body: { productType: 'saas', audienceId: 'freelancers', businessModel: 'subscription', strengths: 'Понятная польза.', risks: 'Много конкурентов.' } },
    });
    await mount();
    await typeIdea('Помогаю людям, которые работают на себя, не забывать про счета');
    await click(button('Спросить мнение нейросети')!);
    expect(calls.at(-1)!.body).toEqual({ idea: 'Помогаю людям, которые работают на себя, не забывать про счета', lang: 'ru' });
    expect(selects()).toEqual(['saas', 'freelancers', 'subscription']);
    expect(box.textContent).toContain('Понятная польза.');
    expect(box.textContent).toContain('Много конкурентов.');

    // Игрок переписал идею — старое мнение к ней уже не относится.
    await typeIdea('Мобильная игра');
    expect(box.textContent).not.toContain('Понятная польза.');
    expect(selects()[0]).toBe('mobile');
  });

  it('негодный ответ нейросети не ломает экран и не меняет разбор', async () => {
    fakeServer({ [AI_ROUTES.status]: ON, [AI_ROUTES.analyze]: { body: { productType: 'unicorn', startCash: 1e9 } } });
    await mount();
    await typeIdea('Мобильная игра для студентов');
    await click(button('Спросить мнение нейросети')!);
    expect(selects()).toEqual(['mobile', 'students', 'subscription']);
    expect(box.textContent).toContain('Нейросеть не ответила. Попробуйте ещё раз.');
  });

  it('ошибка посредника (нет ключа, предел запросов) — тот же запасной путь', async () => {
    fakeServer({ [AI_ROUTES.status]: ON, [AI_ROUTES.analyze]: { status: 429, body: { error: 'limit' } } });
    await mount();
    await typeIdea('Мобильная игра');
    await click(button('Спросить мнение нейросети')!);
    expect(box.textContent).toContain('Нейросеть не ответила. Попробуйте ещё раз.');
    expect(box.querySelector<HTMLButtonElement>('.ng-start')!.disabled).toBe(false);
  });
});
