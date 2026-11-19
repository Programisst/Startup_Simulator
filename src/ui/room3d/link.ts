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
}

/** Сколько игровых минут суток проходит в квартире за секунду, пока идёт игровое время: сутки — за две минуты. */
export const LINKED_CLOCK_RATE = 12;
/** Через сколько секунд без управления герой сам идёт работать. */
export const AUTOPILOT_IDLE_SECONDS = 5;

/** Должен ли герой сам сидеть за компьютером при таком занятии. */
export function worksAtDesk(activity: FounderActivity): boolean {
  return activity === 'building' || activity === 'sideJob';
}
