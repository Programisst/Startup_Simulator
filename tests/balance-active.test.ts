// Баланс для игрока, который пользуется всеми «решениями с риском» сразу:
// акции, обещанные обновления, звёзды, инвесторы и покупка компаний вместе не должны ни ломать партию, ни делать её бессмысленной.
import { describe, expect, it, vi } from 'vitest';
import { content } from '../src/content';
import { applyCommand, createGame, tick, type GameState } from '../src/core';
import { PRODUCT_TYPES, defaultModel, median, runAll, summarize } from '../tools/balance/simulate';
import { active, carefulHirer, type Strategy } from '../tools/balance/strategies';

vi.setConfig({ testTimeout: 240_000 });

const GAMES_PER_TYPE = 3;
const winDay = (results: GameState[]) => median(results.filter((r) => r.status === 'won').map((r) => r.day));

/** Свободная игра на заданное число дней: без цели партия не заканчивается победой. */
function sandbox(strategy: Strategy, days: number): GameState[] {
  return PRODUCT_TYPES.map((productType) => {
    let s = createGame({ seed: 1000, companyName: 'Bot', productType, audienceId: content.productTypes[productType].audiences[0]!.id, businessModel: defaultModel[productType], goal: 'sandbox', difficulty: 'normal' }, content);
    while (s.status === 'running' && s.day < days) {
      for (const cmd of strategy(s, content)) {
        const result = applyCommand(s, cmd, content);
        if (result.ok) s = result.state;
      }
      s = tick(s, content);
    }
    return s;
  });
}

describe('активный игрок', () => {
  it('обычная сложность: побеждает заметно раньше осторожного, но не мгновенно', () => {
    const calm = runAll(carefulHirer, 'normal', GAMES_PER_TYPE);
    const bold = runAll(active, 'normal', GAMES_PER_TYPE);
    expect(summarize(bold).won).toBeGreaterThanOrEqual(0.95);
    expect(winDay(bold)).toBeLessThan(winDay(calm) * 0.8);
    // Победа раньше года означала бы, что новые механики обесценили всю остальную игру.
    expect(winDay(bold)).toBeGreaterThan(10 * 30);
  });

  it('сложная: риск с оглядкой спасает от банкротства чаще, чем осторожность', () => {
    expect(summarize(runAll(active, 'hard', GAMES_PER_TYPE)).bankrupt).toBeLessThanOrEqual(summarize(runAll(carefulHirer, 'hard', GAMES_PER_TYPE)).bankrupt);
  });

  it('долгая свободная игра: покупки компаний не разваливают продукт и дают рост, которого без них нет', () => {
    const calm = sandbox(carefulHirer, 4 * 360);
    const bold = sandbox(active, 4 * 360);
    expect(bold.every((r) => r.status === 'running')).toBe(true);
    expect(median(bold.map((r) => r.quality))).toBeGreaterThan(70);
    expect(median(bold.map((r) => r.reputation))).toBeGreaterThan(70);
    // Компании стоят четыре годовых дохода, а службы съедают две трети дохода: покупка — редкое событие.
    expect(median(bold.map((r) => r.acquisitions?.bought ?? 0))).toBeGreaterThanOrEqual(1);
    expect(median(bold.map((r) => r.users))).toBeGreaterThan(median(calm.map((r) => r.users)) * 1.5);
  });

  it('большая компания — не печатный станок: прибыль около трети дохода, запас денег — месяцы, а не десятилетия', () => {
    for (const results of [sandbox(carefulHirer, 4 * 360), sandbox(active, 4 * 360)]) {
      const margin = median(results.map((r) => r.months[r.months.length - 1]!.profit / r.months[r.months.length - 1]!.revenue));
      const reserve = median(results.map((r) => r.cash / r.months[r.months.length - 1]!.expenses));
      // В жизни частные софтверные компании тратят 91–101% дохода; в игре оставлено около 30% прибыли.
      expect(margin).toBeGreaterThan(0.15);
      expect(margin).toBeLessThan(0.45);
      expect(reserve).toBeLessThan(36);
    }
  });
});
