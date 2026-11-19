// Сцена после заставки: переписка с другом вместо анкеты. Друг спрашивает, игрок отвечает своими словами,
// из ответов собирается своя компания. Нейросеть помогает понять идею, но без неё переписка тоже доходит до конца.
import { describe, expect, it } from 'vitest';
import { content } from '../src/content';
import { createGame } from '../src/core';
import i18n from '../src/ui/i18n';
import { chatSetup, choose, quickReplies, reply, resolveIdea, startChat, type ChatState } from '../src/ui/opening/chat';

const friendKeys = (s: ChatState) => s.lines.filter((l) => l.from === 'friend' && l.key).map((l) => l.key!);
const lastFriend = (s: ChatState) => [...s.lines].reverse().find((l) => l.from === 'friend')!;

/** Довести переписку до места, где друг думает над идеей. */
function upToThinking(idea: string, who = 'Малый бизнес, им некогда возиться с бумагами'): ChatState {
  let s = startChat();
  s = reply(s, idea);
  s = reply(s, who);
  return reply(s, 'Счётчик');
}

const REVIEW = {
  productType: 'marketplace' as const,
  audienceId: content.productTypes.marketplace.audiences[0]!.id,
  businessModel: 'commission' as const,
  strengths: 'Срочная реальная проблема.',
  risks: 'Главный риск — доверие.',
};

describe('переписка с другом', () => {
  it('начинается с друга: он здоровается и спрашивает про идею', () => {
    const s = startChat();
    expect(s.stage).toBe('idea');
    expect(s.lines.every((l) => l.from === 'friend')).toBe(true);
    expect(s.lines.length).toBeGreaterThanOrEqual(2);
  });

  it('слишком короткую идею друг просит рассказать подробнее', () => {
    const s = reply(startChat(), 'еда');
    expect(s.stage).toBe('idea');
    expect(lastFriend(s).key).toBe('opening.friend.tooShort');
    expect(s.lines.some((l) => l.from === 'me' && l.text === 'еда')).toBe(true);
  });

  it('после идеи спрашивает, кто платит, потом название, потом думает', () => {
    let s = reply(startChat(), 'Сервис, который сам выставляет счета клиентам малого бизнеса');
    expect(s.stage).toBe('audience');
    s = reply(s, 'Владельцы кафе и салонов');
    expect(s.stage).toBe('name');
    s = reply(s, 'Счётчик');
    expect(s.stage).toBe('thinking');
    expect(s.name).toBe('Счётчик');
  });

  it('название можно пропустить — компания получит обычное имя', () => {
    let s = reply(startChat(), 'Сервис, который сам выставляет счета клиентам малого бизнеса');
    s = reply(s, 'Кафе');
    expect(quickReplies(s).map((o) => o.id)).toContain('skipName');
    s = choose(s, 'skipName');
    expect(s.stage).toBe('thinking');
    expect(s.name).toBe('');
  });

  it('ответ нейросети: друг пересказывает сильную сторону и риск, тип продукта берётся из ответа', () => {
    const s = resolveIdea(upToThinking('Приложение, где мамы находят няню рядом с домом'), REVIEW);
    expect(s.stage).toBe('savings');
    expect(s.productType).toBe('marketplace');
    expect(s.businessModel).toBe('commission');
    const texts = s.lines.map((l) => l.text);
    expect(texts).toContain('Срочная реальная проблема.');
    expect(texts).toContain('Главный риск — доверие.');
  });

  it('без нейросети идея разбирается по словам', () => {
    const s = resolveIdea(upToThinking('Мобильное приложение-трекер привычек: сон, вода, зарядка'), null);
    expect(s.stage).toBe('savings');
    expect(s.productType).toBe('mobile');
  });

  it('без нейросети и без понятных слов друг предлагает варианты кнопками', () => {
    let s = resolveIdea(upToThinking('Штука, которая делает жизнь лучше', 'Все, кому понравится'), null);
    expect(s.stage).toBe('pickType');
    const options = quickReplies(s).map((o) => o.id);
    expect(options).toEqual(Object.keys(content.productTypes));
    s = choose(s, 'saas');
    expect(s.productType).toBe('saas');
    expect(s.audienceId).toBeTruthy();
    expect(s.stage).toBe('savings');
  });

  it('сбережения задают сложность, цель — цель партии; в конце друг прощается', () => {
    let s = resolveIdea(upToThinking('Сервис, который сам выставляет счета клиентам малого бизнеса'), null);
    expect(quickReplies(s).map((o) => o.id)).toEqual(['easy', 'normal', 'hard']);
    s = choose(s, 'hard');
    expect(s.stage).toBe('goal');
    expect(quickReplies(s).map((o) => o.id)).toEqual(['profit', 'valuation', 'sandbox']);
    s = choose(s, 'valuation');
    expect(s.stage).toBe('done');
    expect(s.difficulty).toBe('hard');
    expect(s.goal).toBe('valuation');
  });

  it('из переписки собирается партия: своя идея, название, тема', () => {
    let s = resolveIdea(upToThinking('Сервис для малого бизнеса: счета, акты и напоминания клиентам об оплате'), null);
    s = choose(choose(s, 'normal'), 'profit');
    const setup = chatSetup(s, 5, 'Моя компания');
    expect(setup.companyName).toBe('Счётчик');
    expect(setup.idea).toContain('напоминания');
    expect(setup.seed).toBe(5);
    expect(() => createGame(setup, content)).not.toThrow();
  });

  it('каждая реплика и кнопка переписки есть в файле перевода', () => {
    let s = startChat();
    s = reply(s, 'еда');
    s = reply(s, 'Сервис, который сам выставляет счета клиентам малого бизнеса');
    s = reply(s, 'Кафе');
    const keys = [...friendKeys(s), ...quickReplies(s).map((o) => o.key)];
    s = choose(s, 'skipName');
    let unknown = resolveIdea(s, null);
    keys.push(...friendKeys(unknown), ...quickReplies(unknown).map((o) => o.key));
    unknown = choose(unknown, 'ai');
    keys.push(...friendKeys(unknown), ...quickReplies(unknown).map((o) => o.key));
    unknown = choose(unknown, 'easy');
    keys.push(...quickReplies(unknown).map((o) => o.key));
    unknown = choose(unknown, 'sandbox');
    keys.push(...friendKeys(unknown), ...unknown.lines.filter((l) => l.key).map((l) => l.key!));
    const missing = [...new Set(keys)].filter((k) => !i18n.exists(k));
    expect(missing).toEqual([]);
  });
});
