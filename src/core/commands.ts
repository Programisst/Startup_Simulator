// Команды игрока. Интерфейс меняет игру только через applyCommand.

import { startCampaign } from './campaigns';
import { applyEffects } from './events';
import { featuresOf } from './features';
import { coffeeReady, energyOf, focusOf, founderWorkPerDay, typedTodayOf } from './founder';
import { nextOffice } from './office';
import { loanLimit, loanTerms } from './bank';
import { fire, hire, setSalary, talk, teamOf, teamWorkPerDay, type TeamChange } from './team';
import type { Command, CommandError, CommandResult, GameContent, GameState } from './types';

function fail(error: CommandError): CommandResult {
  return { ok: false, error };
}

function applyTeam(state: GameState, change: TeamChange): CommandResult {
  if (!change.ok) return fail(change.error);
  return { ok: true, state: { ...state, team: change.team, cash: Math.round((state.cash + change.cashDelta) * 100) / 100 } };
}

function isMoney(x: number, max: number): boolean {
  return Number.isFinite(x) && x >= 0 && x <= max;
}

export function applyCommand(state: GameState, cmd: Command, content: GameContent): CommandResult {
  if (cmd.type === 'continueAsSandbox') {
    if (state.status !== 'won') return fail('invalidValue');
    return { ok: true, state: { ...state, status: 'running', goal: 'sandbox' } };
  }
  if (state.status !== 'running') return fail('gameOver');

  const features = featuresOf(state, content);

  switch (cmd.type) {
    case 'rest':
      return { ok: true, state: { ...state, resting: true } };

    case 'coffee': {
      if (!coffeeReady(state)) return fail('coffeeTooSoon');
      const f = content.config.founder;
      return {
        ok: true,
        state: {
          ...state,
          coffeeUntilDay: state.day + f.coffeeDays,
          coffeeReadyDay: state.day + f.coffeeCooldownDays,
          energy: Math.max(0, energyOf(state) - f.coffeeCost),
        },
      };
    }

    case 'typeCode': {
      if (!Number.isFinite(cmd.chars) || cmd.chars <= 0 || cmd.chars > 10_000) return fail('invalidValue');
      const cfg = content.config;
      const f = cfg.founder;
      const next: GameState = { ...state, focus: Math.min(1, focusOf(state) + cmd.chars / f.focusChars) };
      // Набор кода сразу двигает текущую задачу: игрок ведёт команду своим примером.
      // За игровой день так можно добавить не больше typeBonusCap дневных норм — иначе работу можно было бы «напечатать» на паузе.
      const task = state.tasks[0];
      const share = Math.min(f.typeBonusCap - typedTodayOf(state), cmd.chars / f.typeCharsPerDay);
      if (!task || share <= 0 || state.resting || state.status !== 'running') return { ok: true, state: next };
      const work = share * (founderWorkPerDay(state, cfg) + teamWorkPerDay(teamOf(state, content), cfg.team)) * (state.rush ? cfg.rushSpeed : 1);
      let progress = task.progress + work;
      if (task.kind === 'feature') {
        // Функцию завершает шаг дня (там появляются ошибки и долг), поэтому набор доводит её почти до конца, но не закрывает.
        const cost = featuresOf(state, content).find((d) => d.id === task.featureId)?.cost ?? 0;
        progress = Math.max(task.progress, Math.min(progress, cost - 1e-6));
      }
      next.tasks = [{ ...task, progress }, ...state.tasks.slice(1)];
      next.typedDay = state.day;
      next.typedToday = typedTodayOf(state) + share;
      return { ok: true, state: next };
    }

    case 'runCampaign': {
      const def = content.config.marketing.campaigns.find((c) => c.id === cmd.campaignId);
      const started = def ? startCampaign(state, def) : null;
      return started ? { ok: true, state: started } : fail('campaignUnavailable');
    }

    case 'moveOffice': {
      const next = nextOffice(state, content.config);
      if (!next) return fail('noBiggerOffice');
      if (state.cash < next.moveCost) return fail('notEnoughCash');
      return {
        ok: true,
        state: {
          ...state,
          office: next.id,
          cash: Math.round((state.cash - next.moveCost) * 100) / 100,
          news: [...(state.news ?? []), { day: state.day, kind: 'office' as const, id: next.id }].slice(-40),
        },
      };
    }

    case 'hire':
      return applyTeam(state, hire(state, cmd.candidateId, content));

    case 'fire':
      return applyTeam(state, fire(state, cmd.employeeId, content));

    case 'talk': {
      const outcome = cmd.outcome === 'same' || cmd.outcome === 'worse' ? cmd.outcome : 'better';
      const result = talk(state, cmd.employeeId, content, outcome, cmd.lines);
      if (!result.ok) return fail(result.error);
      // Разговор по душам требует сил.
      return { ok: true, state: { ...state, team: result.team, energy: Math.max(0, energyOf(state) - content.config.team.talkEnergy) } };
    }

    case 'takeLoan': {
      const bank = content.config.bank;
      if (!isMoney(cmd.amount, 1e9) || cmd.amount < bank.minLoan) return fail('invalidValue');
      if (cmd.amount > loanLimit(state, bank)) return fail('overLoanLimit');
      const terms = loanTerms(cmd.amount, bank);
      return {
        ok: true,
        state: {
          ...state,
          cash: Math.round((state.cash + cmd.amount) * 100) / 100,
          loans: [...state.loans, { dailyPayment: terms.total / bank.loanTermDays, untilDay: state.day + bank.loanTermDays }],
        },
      };
    }

    case 'deposit': {
      if (!isMoney(cmd.amount, 1e12) || cmd.amount <= 0) return fail('invalidValue');
      if (cmd.amount > state.cash) return fail('notEnoughCash');
      return { ok: true, state: { ...state, cash: Math.round((state.cash - cmd.amount) * 100) / 100, deposit: Math.round(((state.deposit ?? 0) + cmd.amount) * 100) / 100 } };
    }

    case 'withdraw': {
      const have = state.deposit ?? 0;
      if (!isMoney(cmd.amount, 1e12) || cmd.amount <= 0 || cmd.amount > have + 0.005) return fail('invalidValue');
      const amount = Math.min(cmd.amount, have);
      return { ok: true, state: { ...state, cash: Math.round((state.cash + amount) * 100) / 100, deposit: Math.round((have - amount) * 100) / 100 } };
    }

    case 'setSalary':
      if (!isMoney(cmd.salary, 1_000_000)) return fail('invalidValue');
      return applyTeam(state, setSalary(state, cmd.employeeId, cmd.salary, content));

    case 'setAdSpend':
      if (!isMoney(cmd.perDay, 1_000_000)) return fail('invalidValue');
      return { ok: true, state: { ...state, adSpendPerDay: cmd.perDay } };

    case 'setChannelSpend': {
      if (!isMoney(cmd.perDay, 1_000_000)) return fail('invalidValue');
      if (!content.config.marketing.channels.some((c) => c.id === cmd.channel)) return fail('invalidValue');
      // Поиск хранится в прежнем поле: так работают старые сохранения и команда setAdSpend.
      if (cmd.channel === 'search') return { ok: true, state: { ...state, adSpendPerDay: cmd.perDay } };
      return { ok: true, state: { ...state, adChannels: { ...state.adChannels, [cmd.channel]: cmd.perDay } } };
    }

    case 'setPrice':
      if (!isMoney(cmd.price, 100_000)) return fail('invalidValue');
      return { ok: true, state: { ...state, price: cmd.price } };

    case 'setCapacity':
      if (!content.config.capacityTiers.includes(cmd.capacity)) return fail('invalidValue');
      return { ok: true, state: { ...state, capacity: cmd.capacity } };

    case 'queueFeature': {
      const def = features.find((f) => f.id === cmd.featureId);
      if (!def) return fail('unknownFeature');
      if (state.doneFeatures.includes(def.id)) return fail('featureAlreadyDone');
      const queued = state.tasks.some((t) => t.kind === 'feature' && t.featureId === def.id);
      if (queued) return fail('featureAlreadyQueued');
      if (!def.core) {
        const core = features.find((f) => f.core);
        const coreReady =
          !core ||
          state.doneFeatures.includes(core.id) ||
          state.tasks.some((t) => t.kind === 'feature' && t.featureId === core.id);
        if (!coreReady) return fail('coreFeatureRequired');
      }
      return {
        ok: true,
        state: { ...state, tasks: [...state.tasks, { kind: 'feature', featureId: def.id, progress: 0 }] },
      };
    }

    case 'startBugfix':
      if (state.bugs <= 0) return fail('nothingToFix');
      if (state.tasks.some((t) => t.kind === 'bugfix')) return fail('alreadyQueued');
      // Починка идёт вне очереди: встаёт первой.
      return { ok: true, state: { ...state, tasks: [{ kind: 'bugfix', progress: 0 }, ...state.tasks] } };

    case 'startRefactor':
      if (state.debt <= 0) return fail('nothingToFix');
      if (state.tasks.some((t) => t.kind === 'refactor')) return fail('alreadyQueued');
      return { ok: true, state: { ...state, tasks: [{ kind: 'refactor', progress: 0 }, ...state.tasks] } };

    case 'startPolish': {
      const core = features.find((f) => f.core);
      if (core && !state.doneFeatures.includes(core.id)) return fail('coreFeatureRequired');
      if (state.tasks.some((t) => t.kind === 'polish')) return fail('alreadyQueued');
      return { ok: true, state: { ...state, tasks: [...state.tasks, { kind: 'polish', progress: 0 }] } };
    }

    case 'setSideJob':
      if (!content.config.sideJobShares.includes(cmd.share)) return fail('invalidValue');
      return { ok: true, state: { ...state, sideJobShare: cmd.share } };

    case 'removeTask':
      if (!Number.isInteger(cmd.index) || cmd.index < 0 || cmd.index >= state.tasks.length) {
        return fail('noSuchTask');
      }
      return { ok: true, state: { ...state, tasks: state.tasks.filter((_, i) => i !== cmd.index) } };

    case 'setRush':
      return { ok: true, state: { ...state, rush: cmd.rush } };

    case 'launch': {
      if (state.launched) return fail('alreadyLaunched');
      const core = features.find((f) => f.core);
      if (core && !state.doneFeatures.includes(core.id)) return fail('coreFeatureRequired');
      // Первые недели после запуска к новинке приходит больше людей, чем потом.
      const pace = content.config.pace;
      return {
        ok: true,
        state: {
          ...state,
          launched: true,
          launchDay: state.day,
          modifiers: [...state.modifiers, { target: 'acquisition', factor: pace.launchBoost, untilDay: state.day + pace.launchDays }],
        },
      };
    }

    case 'chooseEvent': {
      if (state.pendingEvent === null) return fail('noEvent');
      const def = content.events.find((e) => e.id === state.pendingEvent);
      const choice = def?.choices.find((c) => c.id === cmd.choiceId);
      if (!choice) return fail('unknownChoice');

      const draft: GameState = { ...state, pendingEvent: null, pendingSubject: null };
      const chanceResults: boolean[] = [];
      draft.rng = applyEffects(draft, choice.effects, draft.rng, chanceResults, state.pendingSubject ?? null);
      draft.eventLog = draft.eventLog.map((entry, i) =>
        i === draft.eventLog.length - 1 ? { ...entry, choiceId: choice.id, chanceResults } : entry,
      );
      return { ok: true, state: draft };
    }
  }
}
