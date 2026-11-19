// Команды игрока. Интерфейс меняет игру только через applyCommand.

import { applyEffects } from './events';
import { fire, hire, setSalary, type TeamChange } from './team';
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

  const features = content.features[state.productType];

  switch (cmd.type) {
    case 'hire':
      return applyTeam(state, hire(state, cmd.candidateId, content));

    case 'fire':
      return applyTeam(state, fire(state, cmd.employeeId, content));

    case 'setSalary':
      if (!isMoney(cmd.salary, 1_000_000)) return fail('invalidValue');
      return applyTeam(state, setSalary(state, cmd.employeeId, cmd.salary, content));

    case 'setAdSpend':
      if (!isMoney(cmd.perDay, 1_000_000)) return fail('invalidValue');
      return { ok: true, state: { ...state, adSpendPerDay: cmd.perDay } };

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
      return { ok: true, state: { ...state, launched: true, launchDay: state.day } };
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
