// Простые автоматические игроки для проверки баланса.
import { acquisitionsView, cac, campaignsView, featuresOf, fundingView, headhuntView, officeView, releaseView, teamView, type Command, type GameContent, type GameState } from '../../src/core';

export type Strategy = (s: GameState, content: GameContent) => Command[];

function coreId(s: GameState, content: GameContent): string {
  return featuresOf(s, content).find((f) => f.core)?.id ?? 'core';
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

/** Бережёт силы: отдыхает, когда устал, и пьёт кофе, когда есть над чем работать. */
function care(s: GameState): Command[] {
  const cmds: Command[] = [];
  const energy = s.energy ?? 100;
  if (energy < 50 && !s.resting) cmds.push({ type: 'rest' });
  else if (s.tasks.length > 0 && s.day >= (s.coffeeReadyDay ?? 0) && energy > 60) cmds.push({ type: 'coffee' });
  return cmds;
}

function scaleServers(s: GameState, content: GameContent): Command[] {
  const tiers = content.config.capacityTiers;
  const wanted = tiers.find((t) => t >= s.users * 1.25) ?? tiers[tiers.length - 1]!;
  return wanted !== s.capacity ? [{ type: 'setCapacity', capacity: wanted }] : [];
}

/**
 * Игрок, который развивает продукт и следит за деньгами.
 * launchAfter — сколько функций он делает до выхода на рынок.
 */
function builder(launchAfter: number): Strategy {
  return (s, content) => {
    const cmds = answerEvent(s, content);
    cmds.push(...care(s));
    const defs = featuresOf(s, content);
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

    if (!s.launched && s.doneFeatures.includes(core) && s.doneFeatures.length >= launchAfter) cmds.push({ type: 'launch' });

    if (s.launched) {
      const monthRevenue = recent.reduce((sum, d) => sum + d.revenue, 0);
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
}

/** Разумный игрок: делает три функции и только потом выходит на рынок. */
export const sensible: Strategy = builder(3);

/** Опытный игрок: выходит на рынок сразу после основы — раньше появляются пользователи и доход. */
export const expert: Strategy = builder(1);

/** Только подработка на полный день, продукт не делается вообще. */
export const sideJobOnly: Strategy = (s, content) => {
  const cmds = answerEvent(s, content);
  if (s.sideJobShare !== 1) cmds.push({ type: 'setSideJob', share: 1 });
  return cmds;
};

/**
 * Новичок: без подработки, сразу делает основу, запускается и включает рекламу,
 * продукт дальше почти не развивает. Так обычно играют первую партию.
 */
export const novice: Strategy = (s, content) => {
  const cmds = answerEvent(s, content);
  const defs = featuresOf(s, content);
  const core = coreId(s, content);
  if (s.tasks.length === 0) {
    const next = defs.find((f) => !s.doneFeatures.includes(f.id));
    if (next) cmds.push({ type: 'queueFeature', featureId: next.id });
  }
  if (!s.launched && s.doneFeatures.includes(core)) cmds.push({ type: 'launch' });
  if (s.launched) {
    if (s.adSpendPerDay !== 10) cmds.push({ type: 'setAdSpend', perDay: 10 });
    cmds.push(...scaleServers(s, content));
  }
  return cmds;
};

/**
 * Опытный игрок, который нанимает осторожно: только когда прибыль прошлого месяца
 * покрывает зарплату с запасом и на счёте есть деньги на полгода этой зарплаты.
 * Берёт кандидата с лучшим отношением навыка к зарплате.
 */
export const carefulHirer: Strategy = (s, content) => {
  const cmds = expert(s, content);
  const team = teamView(s, content);
  const lastMonth = s.months[s.months.length - 1];
  if (!team.canHire || !lastMonth) return cmds;
  const best = [...team.candidates].sort((a, b) => b.skill / b.salaryAsk - a.skill / a.salaryAsk)[0];
  if (best && lastMonth.profit >= best.salaryAsk * 1.5 && s.cash >= best.salaryAsk * 6) cmds.push({ type: 'hire', candidateId: best.id });
  return cmds;
};

/** Нетерпеливый игрок: в первый же день нанимает самого сильного разработчика, не глядя на деньги. */
export const recklessHirer: Strategy = (s, content) => {
  const cmds = expert(s, content);
  const team = teamView(s, content);
  if (team.size === 0 && s.day === 0) {
    const top = [...team.candidates].sort((a, b) => b.skill - a.skill)[0];
    if (top) cmds.push({ type: 'hire', candidateId: top.id });
  }
  return cmds;
};

/**
 * Активный игрок: всё, что делает осторожный наниматель, плюс все «решения с риском» —
 * акции, обещанные обновления, охота за звёздами, раунды инвестиций и покупка компаний.
 * Рискует с оглядкой: не тратит на одну ставку больше пятой части денег, проверяет компании перед покупкой
 * и не покупает следующую, пока не вычистил ошибки и долг от предыдущей.
 * Нужен, чтобы видеть, не стала ли игра проходиться сама собой, когда всё это сложено вместе.
 */
export const active: Strategy = (s, content) => {
  const cmds = carefulHirer(s, content);
  if (!s.launched || s.pendingEvent !== null) return cmds;
  const cfg = content.config;
  const revenue = s.recentDays.slice(-30).reduce((sum, d) => sum + d.revenue, 0);

  // Порядок в продукте: чинит сразу, не дожидаясь пустой очереди (купленные компании привозят ошибки и долг).
  if (s.bugs >= 5 && !s.tasks.some((t) => t.kind === 'bugfix')) cmds.push({ type: 'startBugfix' });
  if (s.debt >= 25 && !s.tasks.some((t) => t.kind === 'refactor')) cmds.push({ type: 'startRefactor' });

  // Офис: переезжает, когда мест нет, а денег хватает на переезд и полтора года аренды.
  const office = officeView(s, cfg);
  const seats = teamView(s, content);
  if (office.next && seats.size >= seats.maxSize && s.cash > office.next.moveCost + office.next.rentPerMonth * 18) cmds.push({ type: 'moveOffice' });

  // Акция: первая доступная, если она по карману и провал не слишком вероятен.
  const campaign = campaignsView(s, cfg).list.find((c) => c.blocked === null && c.cost <= s.cash * 0.2 && c.odds.fail <= 40);
  if (campaign) cmds.push({ type: 'runCampaign', campaignId: campaign.id });

  // Обновление: крупное, срок впритык — и сам печатает код, пока оно в работе.
  const release = releaseView(s, content);
  if (release.active) {
    if (s.tasks.length > 0 && !s.resting) cmds.push({ type: 'typeCode', chars: cfg.founder.typeCharsPerDay * cfg.founder.typeBonusCap });
  } else if (release.blocked === null && s.tasks.length > 0 && (s.energy ?? 100) > 60) {
    cmds.push({ type: 'announceRelease', size: 'large', deadline: 'exact' });
  }

  // Звезда: щедрое предложение, если зарплаты после него останутся меньше 40% дохода.
  const team = teamView(s, content);
  const offer = headhuntView(s, content).star?.offers.find((o) => o.id === 'generous');
  if (offer && offer.blocked === null && !offer.risky && team.payrollPerMonth + offer.salary < revenue * 0.4 && s.cash > offer.bonus * 3) {
    cmds.push({ type: 'headhunt', offer: 'generous' });
  }

  // Инвесторы: два раунда с ангелами за партию, с одной попыткой выторговать больше; звать — только не из слабой позиции.
  const funding = fundingView(s, content);
  const angels = funding.investors.find((i) => i.id === 'angels');
  if (funding.rounds < 2 && angels?.blocked === null && funding.position.level !== 'weak') {
    cmds.push({ type: 'openRound', investorId: 'angels' }, { type: 'counterOffer', stance: 'ask' }, { type: 'closeRound' });
  }

  // Покупка компании: сначала проверка, пустышки пропускает; серверы поднимает заранее.
  const target = acquisitionsView(s, content).target;
  if (target && target.price <= s.cash * 0.5 && s.bugs < 8 && s.debt < 30) {
    if (target.check.state === 'none' && target.check.blocked === null) cmds.push({ type: 'checkTarget' });
    else if (target.check.state === 'done' && target.health !== 'hollow') {
      const tiers = cfg.capacityTiers;
      const wanted = tiers.find((t) => t >= (s.users + target.users) * 1.25) ?? tiers[tiers.length - 1]!;
      if (wanted > s.capacity) cmds.push({ type: 'setCapacity', capacity: wanted });
      cmds.push({ type: 'buyTarget', offer: 'full' });
    }
  }
  return cmds;
};

export const strategies: Record<string, Strategy> = { idle, sideJobOnly, adsOnly, novice, sensible, expert, carefulHirer, recklessHirer, active };
