// Телефон в квартире: друг пишет подсказки как сообщения. Первое выдвигает телефон само,
// дальше — значок с цифрой; «Понял» — свой ответ, и телефон прячется. Пока игрок за компьютером, подсказки видны там же — они прочитаны.
import { describe, expect, it } from 'vitest';
import i18n from '../src/ui/i18n';
import { phoneAnswer, phoneClose, phoneOpen, phoneReceive, phoneStart, type PhoneState } from '../src/ui/components/phoneState';

const friendSteps = (s: PhoneState) => s.msgs.flatMap((m) => (m.from === 'friend' ? [m.step] : []));

describe('телефон с сообщениями друга', () => {
  it('первое сообщение само выдвигает телефон', () => {
    const s = phoneReceive(phoneStart(), 'goToComputer', {}, true);
    expect(s.open).toBe(true);
    expect(s.unread).toBe(0);
    expect(friendSteps(s)).toEqual(['goToComputer']);
  });

  it('одно и то же сообщение не повторяется; нет подсказки — ничего не меняется', () => {
    let s = phoneReceive(phoneStart(), 'goToComputer', {}, true);
    expect(phoneReceive(s, 'goToComputer', {}, true)).toBe(s);
    expect(phoneReceive(s, null, {}, true)).toBe(s);
    s = phoneClose(s);
    expect(phoneReceive(s, 'goToComputer', {}, true)).toBe(s);
  });

  it('«Понял» — свой ответ в переписке, телефон потом убирается', () => {
    let s = phoneReceive(phoneStart(), 'goToComputer', {}, true);
    s = phoneAnswer(s, 'coach.gotIt');
    expect(s.msgs.at(-1)).toEqual({ from: 'me', key: 'coach.gotIt' });
    s = phoneClose(s);
    expect(s.open).toBe(false);
  });

  it('телефон убран — новое сообщение ждёт на значке с цифрой, открыл — прочитано', () => {
    let s = phoneClose(phoneReceive(phoneStart(), 'goToComputer', {}, true));
    s = phoneReceive(s, 'backToComputer', {}, true);
    expect(s.open).toBe(false);
    expect(s.unread).toBe(1);
    s = phoneOpen(s);
    expect(s.open).toBe(true);
    expect(s.unread).toBe(0);
  });

  it('телефон открыт — новое сообщение приходит прямо в переписку', () => {
    let s = phoneReceive(phoneStart(), 'goToComputer', {}, true);
    s = phoneReceive(s, 'backToComputer', {}, true);
    expect(s.open).toBe(true);
    expect(s.unread).toBe(0);
    expect(friendSteps(s)).toEqual(['goToComputer', 'backToComputer']);
  });

  it('за компьютером подсказка видна на его экране — в телефоне она уже прочитана, телефон убран', () => {
    let s = phoneReceive(phoneStart(), 'goToComputer', {}, true);
    s = phoneReceive(s, 'openProduct', {}, false);
    expect(s.open).toBe(false);
    expect(s.unread).toBe(0);
    expect(friendSteps(s)).toEqual(['goToComputer', 'openProduct']);
  });

  it('числа в сообщении запоминаются такими, какими были, когда друг написал', () => {
    const s = phoneReceive(phoneStart(), 'waitCore', { days: 4 }, true);
    expect(s.msgs[0]).toEqual({ from: 'friend', step: 'waitCore', params: { days: 4 } });
  });

  it('подписи телефона есть в переводе', () => {
    for (const k of ['phone.title', 'phone.online', 'phone.yesterday', 'phone.today', 'opening.friend.byeSleep']) expect(i18n.exists(k), k).toBe(true);
  });
});
