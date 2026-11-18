// Единое оформление чисел, денег и дат на экранах.
const int = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 });
const one = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1 });

export function num(x: number): string {
  return int.format(Math.round(x));
}

export function dec(x: number): string {
  return one.format(x);
}

export function money(x: number): string {
  const sign = x < 0 ? '−' : '';
  return `${sign}$${int.format(Math.abs(Math.round(x)))}`;
}

export type GameDate = {
  year: number;
  month: number;
  day: number;
};

/** В игровом месяце 30 дней, в году 12 месяцев. */
export function gameDate(day: number): GameDate {
  return { year: Math.floor(day / 360) + 1, month: (Math.floor(day / 30) % 12) + 1, day: (day % 30) + 1 };
}
