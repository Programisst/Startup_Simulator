// События с выбором: проверка условий, выбор очередного события, применение последствий.

import { clamp, overload } from './formulas';
import { energyOf } from './founder';
import { nextFloat, type RngState } from './rng';
import type { Effect, Employee, EventCondition, EventDef, EventSubject, GameContent, GameState, TeamState } from './types';

const employeesOf = (s: GameState): Employee[] => s.team?.employees ?? [];

/** Доход продукта за последние 30 дней. */
export function revenue30(s: GameState): number {
  return s.recentDays.slice(-30).reduce((sum, d) => sum + d.revenue, 0);
}

/** Сотрудник, о котором будет событие, или null, если подходящего нет. */
export function eventSubject(subject: EventSubject, s: GameState): Employee | null {
  const fits = employeesOf(s).filter(
    (e) =>
      (subject.role === undefined || e.role === subject.role) &&
      (subject.minSkill === undefined || e.skill >= subject.minSkill) &&
      (subject.minMotivation === undefined || e.motivation >= subject.minMotivation) &&
      (subject.maxMotivation === undefined || e.motivation <= subject.maxMotivation) &&
      (subject.minDaysHired === undefined || s.day - e.hiredDay >= subject.minDaysHired),
  );
  if (fits.length === 0) return null;
  // При равенстве берётся нанятый раньше (меньший номер) — выбор всегда один и тот же.
  const better: Record<EventSubject['pick'], (a: Employee, b: Employee) => number> = {
    lowestMotivation: (a, b) => a.motivation - b.motivation || a.id - b.id,
    highestSkill: (a, b) => b.skill - a.skill || a.id - b.id,
    newest: (a, b) => b.hiredDay - a.hiredDay || b.id - a.id,
  };
  return [...fits].sort(better[subject.pick])[0] ?? null;
}

export function conditionHolds(c: EventCondition, s: GameState, cfg?: { offices: { id: string }[] }): boolean {
  if (c.minOffice !== undefined && Math.max(0, (cfg?.offices ?? []).findIndex((o) => o.id === s.office)) < c.minOffice) return false;
  if (c.launched !== undefined && c.launched !== s.launched) return false;
  if (c.minDay !== undefined && s.day < c.minDay) return false;
  if (c.minUsers !== undefined && s.users < c.minUsers) return false;
  if (c.maxUsers !== undefined && s.users > c.maxUsers) return false;
  if (c.minQuality !== undefined && s.quality < c.minQuality) return false;
  if (c.maxQuality !== undefined && s.quality > c.maxQuality) return false;
  if (c.minCash !== undefined && s.cash < c.minCash) return false;
  if (c.maxCash !== undefined && s.cash > c.maxCash) return false;
  if (c.minBugs !== undefined && s.bugs < c.minBugs) return false;
  if (c.minDebt !== undefined && s.debt < c.minDebt) return false;
  if (c.overloaded !== undefined && c.overloaded !== overload(s.users, s.capacity) > 0) return false;
  if (c.cashNegative !== undefined && c.cashNegative !== s.cash < 0) return false;
  if (c.maxEnergy !== undefined && energyOf(s) > c.maxEnergy) return false;
  if (c.minFeatures !== undefined && s.doneFeatures.length < c.minFeatures) return false;
  if (c.minRevenue30 !== undefined && revenue30(s) < c.minRevenue30) return false;
  if (c.minMonthProfit !== undefined && (s.months[s.months.length - 1]?.profit ?? -Infinity) < c.minMonthProfit) return false;
  const teamSize = employeesOf(s).length;
  if (c.minTeam !== undefined && teamSize < c.minTeam) return false;
  if (c.maxTeam !== undefined && teamSize > c.maxTeam) return false;
  if (c.rush !== undefined && c.rush !== s.rush) return false;
  if (c.subject !== undefined && eventSubject(c.subject, s) === null) return false;
  return true;
}

function isAvailable(def: EventDef, s: GameState, content: GameContent): boolean {
  let lastDay = -Infinity;
  for (const entry of s.eventLog) {
    if (entry.eventId === def.id) lastDay = Math.max(lastDay, entry.day);
  }
  if (def.once && lastDay > -Infinity) return false;
  if (s.day - lastDay < def.cooldownDays) return false;
  return conditionHolds(def.condition, s, content.config);
}

/**
 * Решает, случится ли сегодня событие. Возвращает его id или null.
 * Срочные события случаются сразу; обычные — с заданной вероятностью и не чаще,
 * чем раз в eventMinGapDays дней.
 */
export function rollEvent(
  s: GameState,
  content: GameContent,
  rng: RngState,
): { eventId: string | null; rng: RngState } {
  // Развилки разработки возникают по ходу работы над функцией, а не случайно.
  const available = content.events.filter((e) => !e.dev && isAvailable(e, s, content));

  const urgent = available.find((e) => e.urgent);
  if (urgent) return { eventId: urgent.id, rng };

  if (s.day - s.lastEventDay < content.config.eventMinGapDays) return { eventId: null, rng };

  const roll = nextFloat(rng);
  if (roll.value >= content.config.eventDailyChance) return { eventId: null, rng: roll.next };

  const regular = available.filter((e) => !e.urgent);
  const total = regular.reduce((sum, e) => sum + e.weight, 0);
  if (total <= 0) return { eventId: null, rng: roll.next };

  const pick = nextFloat(roll.next);
  let threshold = pick.value * total;
  for (const e of regular) {
    threshold -= e.weight;
    if (threshold < 0) return { eventId: e.id, rng: pick.next };
  }
  return { eventId: regular[regular.length - 1]?.id ?? null, rng: pick.next };
}

/**
 * Применяет последствия к черновику состояния (draft — свежая копия, её можно менять).
 * Возвращает новое состояние генератора; исходы случайных веток пишет в chanceResults.
 */
export function applyEffects(
  draft: GameState,
  effects: Effect[],
  rng: RngState,
  chanceResults: boolean[],
  /** Номер сотрудника, о котором событие */
  subjectId: number | null = null,
): RngState {
  let r = rng;
  /** Меняет сотрудников команды; если команды нет, ничего не делает. */
  const changeTeam = (change: (team: TeamState) => TeamState) => {
    if (draft.team) draft.team = change(draft.team);
  };
  const changeSubject = (change: (e: Employee) => Employee) =>
    changeTeam((team) => ({ ...team, employees: team.employees.map((e) => (e.id === subjectId ? change(e) : e)) }));

  for (const e of effects) {
    switch (e.type) {
      case 'invest':
        draft.cash = Math.round((draft.cash + e.amount) * 100) / 100;
        draft.founderShare = Math.round((draft.founderShare ?? 1) * (1 - e.share) * 10_000) / 10_000;
        draft.news = [...(draft.news ?? []), { day: draft.day, kind: 'invest' as const, value: e.amount }].slice(-40);
        break;
      case 'energy':
        draft.energy = clamp(energyOf(draft) + e.amount, 0, 100);
        break;
      case 'taskProgress': {
        const first = draft.tasks[0];
        if (first?.kind === 'feature') draft.tasks = [{ ...first, progress: Math.max(0, first.progress + e.amount) }, ...draft.tasks.slice(1)];
        break;
      }
      case 'polish':
        draft.polish = Math.max(0, draft.polish + e.amount);
        break;
      case 'teamMotivation':
        changeTeam((team) => ({ ...team, employees: team.employees.map((m) => ({ ...m, motivation: clamp(m.motivation + e.amount, 0, 100) })) }));
        break;
      case 'subjectMotivation':
        changeSubject((m) => ({ ...m, motivation: clamp(m.motivation + e.amount, 0, 100) }));
        break;
      case 'subjectRaise':
        // Растёт и зарплата, и ожидания: к новой сумме человек привыкает.
        changeSubject((m) => ({ ...m, salary: Math.round((m.salary * (1 + e.pct)) / 50) * 50, salaryAsk: Math.round((m.salaryAsk * (1 + e.pct)) / 50) * 50 }));
        break;
      case 'subjectSkill':
        changeSubject((m) => ({ ...m, skill: Math.round(clamp(m.skill + e.amount, 0.1, 2.5) * 100) / 100 }));
        break;
      case 'subjectLeaves':
        changeTeam((team) => {
          const gone = team.employees.find((m) => m.id === subjectId);
          if (!gone) return team;
          return {
            ...team,
            employees: team.employees.filter((m) => m.id !== subjectId),
            log: [...team.log, { day: draft.day, kind: 'quit' as const, employeeId: gone.id, nameSeed: gone.nameSeed, role: gone.role }].slice(-50),
          };
        });
        break;
      case 'cash':
        draft.cash = Math.round((draft.cash + e.amount) * 100) / 100;
        break;
      case 'reputation':
        draft.reputation = clamp(draft.reputation + e.amount, 0, 100);
        break;
      case 'scandal':
        draft.scandal = clamp(draft.scandal + e.amount, 0, 60);
        break;
      case 'usersPct': {
        const factor = Math.max(0, 1 + e.pct / 100);
        draft.users = draft.users * factor;
        draft.paying = Math.min(draft.users, draft.paying * factor);
        break;
      }
      case 'bugs':
        draft.bugs = Math.max(0, draft.bugs + e.amount);
        break;
      case 'debt':
        draft.debt = clamp(draft.debt + e.amount, 0, 100);
        break;
      case 'modifier':
        draft.modifiers = [
          ...draft.modifiers,
          { target: e.target, factor: e.factor, untilDay: draft.day + e.days },
        ];
        break;
      case 'loan':
        draft.cash = Math.round((draft.cash + e.amount) * 100) / 100;
        draft.loans = [
          ...draft.loans,
          { dailyPayment: (e.amount * e.repayFactor) / e.days, untilDay: draft.day + e.days },
        ];
        break;
      case 'chance': {
        const roll = nextFloat(r);
        r = roll.next;
        const hit = roll.value < e.probability;
        chanceResults.push(hit);
        r = applyEffects(draft, hit ? e.then : (e.otherwise ?? []), r, chanceResults, subjectId);
        break;
      }
    }
  }
  return r;
}
