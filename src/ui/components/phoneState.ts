// Телефон в квартире — только логика: какие сообщения пришли, открыт ли он, сколько непрочитанных.
// Друг пишет подсказки обучения. Первое сообщение выдвигает телефон само; дальше новое ждёт на значке с цифрой.
import type { TutorialStep } from '../tutorial';

export type PhoneParams = Record<string, string | number>;
export type PhoneMsg = { from: 'friend'; step: TutorialStep; params: PhoneParams } | { from: 'me'; key: string };

export interface PhoneState {
  msgs: PhoneMsg[];
  open: boolean;
  unread: number;
}

export function phoneStart(): PhoneState {
  return { msgs: [], open: false, unread: 0 };
}

const lastFriend = (s: PhoneState) => [...s.msgs].reverse().find((m) => m.from === 'friend');

/**
 * Подсказка обучения сменилась — друг пишет новое сообщение.
 * visible = телефон на экране (игрок в комнате). За компьютером подсказка видна там — в телефоне она уже прочитана.
 */
export function phoneReceive(s: PhoneState, step: TutorialStep | null, params: PhoneParams, visible: boolean): PhoneState {
  if (!step) return s;
  const last = lastFriend(s);
  if (last?.from === 'friend' && last.step === step) return s;
  const msgs: PhoneMsg[] = [...s.msgs, { from: 'friend', step, params }];
  if (!visible) return { msgs, open: false, unread: 0 };
  // Самое первое сообщение — телефон выезжает сам; открыт — сообщение приходит прямо в переписку.
  if (s.open || !last) return { msgs, open: true, unread: 0 };
  return { msgs, open: false, unread: s.unread + 1 };
}

export function phoneOpen(s: PhoneState): PhoneState {
  return { ...s, open: true, unread: 0 };
}

export function phoneClose(s: PhoneState): PhoneState {
  return s.open ? { ...s, open: false } : s;
}

/** Игрок ответил кнопкой — его ответ остаётся в переписке. */
export function phoneAnswer(s: PhoneState, key: string): PhoneState {
  return { ...s, msgs: [...s.msgs, { from: 'me', key }] };
}
