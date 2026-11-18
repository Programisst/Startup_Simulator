// Простые автоматические игроки для проверки баланса.
import { cac, type Command, type GameContent, type GameState } from '../../src/core';

export type Strategy = (s: GameState, content: GameContent) => Command[];

function coreId(s: GameState, content: GameContent): string {
  return content.features[s.productType].find((f) => f.core)?.id ?? 'core';
}

function answerEvent(s: GameState, content: GameContent): Command[] {
  if (s.pendingEvent === null) return [];
  const def = content.events.find((e) => e.id === s.pendingEvent);
  const first = def?.choices[0];
  return first ? [{ type: 'chooseEvent', choiceId: first.id }] : [];
}

/** Ничего не делает. */
export const idle: Strategy = (s, content) => answerEvent(s, content);

/** Делает только основу продукта, запускается и льёт все деньги в рекламу. */
export const adsOnly: Strategy = (s, content) => {
  const cmds = answerEvent(s, content);
  const core = coreId(s, content);
  if (!s.doneFeatures.includes(core) && s.tasks.length === 0) cmds.push({ type: 'queueFeature', featureId: core });
  if (!s.launched && s.doneFeatures.includes(core)) cmds.push({ type: 'launch' });
  if (s.launched) {
    const spend = Math.max(50, Math.round(s.cash * 0.03));
    if (spend !== s.adSpendPerDay) cmds.push({ type: 'setAdSpend', perDay: spend });
    cmds.push(...scaleServers(s, content));
  }
  return cmds;
};

function scaleServers(s: GameState, content: GameContent): Command[] {
  const tiers = content.config.capacityTiers;
  const wanted = tiers.find((t) => t >= s.users * 1.25) ?? tiers[tiers.length - 1]!;
  return wanted !== s.capacity ? [{ type: 'setCapacity', capacity: wanted }] : [];
}

/** Разумный игрок: три функции до запуска, потом развитие продукта и умеренная реклама. */
export const sensible: Strategy = (s, content) => {
  const cmds = answerEvent(s, content);
  const defs = content.features[s.productType];
  const core = coreId(s, content);

  if (s.tasks.length === 0) {
    if (s.bugs >= 5) cmds.push({ type: 'startBugfix' });
    else if (s.debt >= 30) cmds.push({ type: 'startRefactor' });
    else {
      // Сначала основа, затем функции с лучшим отношением ценности к стоимости.
      const next = defs
        .filter((f) => !s.doneFeatures.includes(f.id))
        .sort((a, b) => Number(b.core ?? false) - Number(a.core ?? false) || b.value / b.cost - a.value / a.cost)[0];
      if (next) cmds.push({ type: 'queueFeature', featureId: next.id });
      else if (s.bugs > 0) cmds.push({ type: 'startBugfix' });
      else if (s.debt > 0) cmds.push({ type: 'startRefactor' });
      else cmds.push({ type: 'startPolish' });
    }
  }

  // Подработка: чем меньше запас денег в месяцах, тем больше времени на заказы.
  const recent = s.recentDays.slice(-30);
  const burn = recent.reduce((sum, d) => sum + d.expenses - d.revenue, 0) * (30 / Math.max(1, recent.length));
  const runway = burn > 0 ? s.cash / burn : Infinity;
  const share = runway > 12 ? 0 : runway > 6 ? 0.25 : runway > 3 ? 0.5 : 0.75;
  if (share !== s.sideJobShare) cmds.push({ type: 'setSideJob', share });

  if (!s.launched && s.doneFeatures.includes(core) && s.doneFeatures.length >= 3) cmds.push({ type: 'launch' });

  if (s.launched) {
    // Реклама: доля дохода плюс небольшая часть запаса, но только при приличном качестве.
    const monthRevenue = s.recentDays.slice(-30).reduce((sum, d) => sum + d.revenue, 0);
    // Реклама окупается, если пользователь за полгода приносит больше, чем стоит его привлечение.
    const revenuePerUser = s.users > 50 ? monthRevenue / s.users : Infinity;
    const paysOff = revenuePerUser * 6 > cac(s.market, s.users);
    let spend = 0;
    if (s.quality >= 40 && s.cash > 500 && paysOff) spend = Math.round((monthRevenue * 0.3) / 30 + s.cash * 0.004);
    if (spend !== s.adSpendPerDay) cmds.push({ type: 'setAdSpend', perDay: spend });
    cmds.push(...scaleServers(s, content));
  }
  return cmds;
};

export const strategies: Record<string, Strategy> = { idle, adsOnly, sensible };
