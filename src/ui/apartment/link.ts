// Связь квартиры с партией. Без неё квартира работает сама по себе (пробная страница room.html);
// с ней — показывает настоящие деньги и дату, а сон проматывает игровой день.
import type { ReactNode } from 'react';
import type { FounderActivity } from '../../core';

export interface RoomLink {
  /** Дата партии: год, месяц, день месяца */
  date: { year: number; month: number; day: number };
  /** День недели, 0 — понедельник */
  weekday: number;
  cash: number;
  /** Сколько дней осталось до банкротства; null — счёт не в минусе */
  daysToBankruptcy: number | null;
  /** Кнопки управления временем — рисуются в правом верхнем углу квартиры */
  controls: ReactNode;
  /** Чем занят основатель по расчёту игры */
  activity: FounderActivity;
  /** Мысль героя о текущем деле — уже готовым текстом */
  thought: string;
  /** Строка состояния под часами */
  status: string;
  /** Идёт ли сейчас игровое время (не пауза, нет события, партия не окончена) */
  timeRuns: boolean;
  /** Поверх квартиры открыто окно игры (событие, конец партии): клавиши и клики не принимаются */
  locked: boolean;
  /** Лечь спать: день отдыха — силы возвращаются, работа стоит, наступает следующий день */
  sleep: () => void;
  /** Силы основателя 0…100 и признак усталости */
  energy: number;
  tired: boolean;
  /** Сварить кофе. Возвращает false, если сейчас он не поможет. */
  coffee: () => boolean;
  /** Программа «Компания» — открывается на экране компьютера */
  companyApp: ReactNode;
  /** Игрок сам набрал знак кода в редакторе компьютера */
  onTyped: () => void;
  /** Игрок нажал значок программы на нижней панели компьютера */
  onDockApp: (item: string) => void;
  /** Что даёт набор кода — строка для экрана редактора */
  focusText: string;
  /** Игрок сел за компьютер или встал */
  onComputer: (open: boolean) => void;
  /**
   * Команда и офис — чтобы сцена могла показать людей на местах.
   * office.index: 0 — комната основателя, дальше коворкинг, небольшой офис, большой офис, этаж.
   */
  team: {
    office: { id: string; index: number; seats: number; title: string };
    people: {
      id: number;
      /** Имя и число, по которому можно подобрать внешность: у человека они всегда одни и те же */
      name: string;
      nameSeed: number;
      role: 'developer' | 'marketer';
      roleTitle: string;
      /** Номер места в офисе с нуля; за человеком закреплён */
      seat: number;
      /** Занят делом прямо сейчас */
      busy: boolean;
      /** Настроение: доволен, спокоен, недоволен */
      mood: 'high' | 'mid' | 'low';
      /** Собирается уйти, если ничего не менять */
      leaving: boolean;
      /** Что он сейчас сказал бы — готовая реплика по характеру и настроению */
      quote: string;
    }[];
    freeSeats: number[];
  };
}

/** Сколько игровых минут суток проходит в квартире за секунду, пока идёт игровое время: сутки — за две минуты. */
export const LINKED_CLOCK_RATE = 12;
/** Через сколько секунд без управления герой сам идёт работать. */
export const AUTOPILOT_IDLE_SECONDS = 5;

/** Должен ли герой сам сидеть за компьютером при таком занятии. */
export function worksAtDesk(activity: FounderActivity): boolean {
  return activity === 'building' || activity === 'sideJob';
}

/** Сколько игровых минут показывают часы квартиры после dt секунд. Стоят на паузе и пока герой спит. */
export function advanceClock(minutes: number, dt: number, o: { rate: number; paused: boolean; sleeping: boolean }): number {
  return o.paused || o.sleeping ? minutes : minutes + dt * o.rate;
}
