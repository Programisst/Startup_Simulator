// Команда: кандидаты, наём, зарплаты, мотивация и вклад сотрудников в работу.
// Описание формул — в docs/02-economy.md, раздел 16.

import { clamp } from './formulas';
import { createRng, nextFloat, nextInt, nextRange, type RngState } from './rng';
import type { Candidate, Employee, EmployeeRole, GameContent, GameState, TeamConfig, TeamLogEntry, TeamState, TraitId } from './types';

const TRAITS: TraitId[] = ['diligent', 'calm', 'loyal', 'sloppy'];
/** Сдвиг seed, чтобы случайность найма не совпадала со случайностью рынка. */
const TEAM_SEED_SALT = 0x5eed7ea3;
const LOG_LIMIT = 50;

function makeCandidate(rng: RngState, id: number, cfg: TeamConfig): { candidate: Candidate; rng: RngState } {
  const roleRoll = nextFloat(rng);
  const role: EmployeeRole = roleRoll.value < cfg.developerShare ? 'developer' : 'marketer';
  const skillRoll = nextRange(roleRoll.next, cfg.skillMin, cfg.skillMax);
  const skill = Math.round(skillRoll.value * 100) / 100;
  const traitRoll = nextInt(skillRoll.next, 0, TRAITS.length - 1);
  const spread = nextRange(traitRoll.next, 1 - cfg.salarySpread, 1 + cfg.salarySpread);
  const nameRoll = nextInt(spread.next, 0, 9999);
  // Зарплата растёт с навыком быстрее, чем сам навык: сильные специалисты стоят непропорционально дорого.
  const ask = cfg.salaryBase[role] * skill ** cfg.salaryExponent * spread.value;
  return {
    candidate: { id, role, skill, trait: TRAITS[traitRoll.value]!, salaryAsk: Math.max(50, Math.round(ask / 50) * 50), nameSeed: nameRoll.value },
    rng: nameRoll.next,
  };
}

function refreshCandidates(team: TeamState, cfg: TeamConfig, day: number): TeamState {
  let rng = team.rng;
  let nextId = team.nextId;
  const candidates: Candidate[] = [];
  for (let i = 0; i < cfg.candidatesShown; i++) {
    const made = makeCandidate(rng, nextId, cfg);
    candidates.push(made.candidate);
    rng = made.rng;
    nextId += 1;
  }
  return { ...team, rng, nextId, candidates, refreshedDay: day };
}

export function createTeam(seed: number, content: GameContent): TeamState {
  const empty: TeamState = { rng: createRng(seed ^ TEAM_SEED_SALT), nextId: 1, refreshedDay: 0, employees: [], candidates: [], log: [] };
  return refreshCandidates(empty, content.config.team, 0);
}

/** Команда партии. В старых сохранениях её нет — тогда создаётся пустая, с первым списком кандидатов. */
export function teamOf(s: GameState, content: GameContent): TeamState {
  return s.team ?? { ...createTeam(s.seed, content), refreshedDay: s.day };
}

/** Во сколько раз сотрудник работает лучше или хуже обычного из-за мотивации. */
export function motivationFactor(motivation: number, cfg: TeamConfig): number {
  return clamp(motivation / cfg.startMotivation, 0.4, 1.3);
}

function output(e: Employee, cfg: TeamConfig): number {
  return e.skill * motivationFactor(e.motivation, cfg) * (e.trait === 'diligent' ? 1 + cfg.diligentBonus : 1);
}

/** Сколько работы над продуктом в день делают разработчики (без основателя и без спешки). */
export function teamWorkPerDay(team: TeamState, cfg: TeamConfig): number {
  return team.employees.filter((e) => e.role === 'developer').reduce((sum, e) => sum + output(e, cfg), 0);
}

/** Множитель притока пользователей от маркетологов: 1 — никого нет. */
export function marketingBoost(team: TeamState, cfg: TeamConfig): number {
  const points = team.employees.filter((e) => e.role === 'marketer').reduce((sum, e) => sum + output(e, cfg), 0);
  return 1 + Math.min(cfg.marketingCap, points * cfg.marketingPerPoint);
}

export function payrollPerMonth(team: TeamState): number {
  return team.employees.reduce((sum, e) => sum + e.salary, 0);
}

/** Сколько небрежных разработчиков: каждый добавляет ошибку к готовой функции. */
export function sloppyDevelopers(team: TeamState): number {
  return team.employees.filter((e) => e.role === 'developer' && e.trait === 'sloppy').length;
}

/** К какой мотивации сотрудник стремится при нынешних условиях. */
export function motivationTarget(e: Employee, s: Pick<GameState, 'rush' | 'cash' | 'months'>, cfg: TeamConfig): number {
  let target = cfg.startMotivation;
  // Платят меньше ожиданий — мотивация падает быстро; больше — растёт, но с потолком.
  target += clamp((e.salary / e.salaryAsk - 1) * 100, -40, 20);
  if (s.rush && e.trait !== 'calm') target -= cfg.rushPenalty;
  if (s.cash < 0) target -= cfg.brokePenalty;
  const lastMonth = s.months[s.months.length - 1];
  if (lastMonth && lastMonth.profit > 0) target += cfg.profitBonus;
  if (e.trait === 'loyal') target += cfg.loyalBonus;
  return clamp(target, 0, 100);
}

function addLog(log: TeamLogEntry[], entry: TeamLogEntry): TeamLogEntry[] {
  return [...log, entry].slice(-LOG_LIMIT);
}

/** Шаг дня для команды: мотивация, уходы, обновление списка кандидатов. */
export function stepTeam(s: GameState, content: GameContent): TeamState {
  const cfg = content.config.team;
  let team = teamOf(s, content);
  let rng = team.rng;
  let log = team.log;
  const employees: Employee[] = [];

  for (const e of team.employees) {
    const target = motivationTarget(e, s, cfg);
    const motivation = clamp(e.motivation + (target - e.motivation) * cfg.motivationSpeed, 0, 100);
    if (motivation < cfg.quitBelow) {
      const roll = nextFloat(rng);
      rng = roll.next;
      if (roll.value < cfg.quitDailyChance) {
        log = addLog(log, { day: s.day, kind: 'quit', employeeId: e.id, nameSeed: e.nameSeed, role: e.role });
        continue;
      }
    }
    employees.push({ ...e, motivation });
  }

  team = { ...team, rng, employees, log };
  if (s.day + 1 - team.refreshedDay >= cfg.candidatesEveryDays) team = refreshCandidates(team, cfg, s.day + 1);
  return team;
}

export type TeamCommandError = 'noSuchCandidate' | 'noSuchEmployee' | 'teamFull';
export type TeamChange = { ok: true; team: TeamState; cashDelta: number } | { ok: false; error: TeamCommandError };

export function hire(s: GameState, candidateId: number, content: GameContent): TeamChange {
  const cfg = content.config.team;
  const team = teamOf(s, content);
  const candidate = team.candidates.find((c) => c.id === candidateId);
  if (!candidate) return { ok: false, error: 'noSuchCandidate' };
  if (team.employees.length >= cfg.maxSize) return { ok: false, error: 'teamFull' };
  const employee: Employee = { ...candidate, salary: candidate.salaryAsk, hiredDay: s.day, motivation: cfg.startMotivation };
  return {
    ok: true,
    cashDelta: 0,
    team: {
      ...team,
      employees: [...team.employees, employee],
      candidates: team.candidates.filter((c) => c.id !== candidateId),
      log: addLog(team.log, { day: s.day, kind: 'hired', employeeId: employee.id, nameSeed: employee.nameSeed, role: employee.role }),
    },
  };
}

export function fire(s: GameState, employeeId: number, content: GameContent): TeamChange {
  const team = teamOf(s, content);
  const employee = team.employees.find((e) => e.id === employeeId);
  if (!employee) return { ok: false, error: 'noSuchEmployee' };
  return {
    ok: true,
    // Выходное пособие платится сразу.
    cashDelta: -employee.salary * content.config.team.severanceMonths,
    team: {
      ...team,
      employees: team.employees.filter((e) => e.id !== employeeId),
      log: addLog(team.log, { day: s.day, kind: 'fired', employeeId, nameSeed: employee.nameSeed, role: employee.role }),
    },
  };
}

export function setSalary(s: GameState, employeeId: number, salary: number, content: GameContent): TeamChange {
  const team = teamOf(s, content);
  if (!team.employees.some((e) => e.id === employeeId)) return { ok: false, error: 'noSuchEmployee' };
  return { ok: true, cashDelta: 0, team: { ...team, employees: team.employees.map((e) => (e.id === employeeId ? { ...e, salary } : e)) } };
}

// ---------- Сводка для интерфейса ----------

export interface TeamMemberView extends Employee {
  /** Во сколько раз работает лучше или хуже обычного из-за мотивации */
  motivationFactor: number;
  /** К какой мотивации идёт при нынешних условиях */
  motivationTarget: number;
  /** Может уйти сам, если ничего не менять */
  mayQuit: boolean;
  severance: number;
}

export interface TeamView {
  members: TeamMemberView[];
  candidates: Candidate[];
  log: TeamLogEntry[];
  size: number;
  maxSize: number;
  canHire: boolean;
  payrollPerMonth: number;
  /** Работа над продуктом в день: основатель и вся команда, с учётом спешки и подработки */
  workPerDay: number;
  founderWorkPerDay: number;
  /** Множитель притока пользователей от маркетологов */
  marketingBoost: number;
  /** Через сколько дней придут новые кандидаты */
  daysToNewCandidates: number;
}

/** Всё, что экрану команды нужно знать. Состояние игры не меняет. */
export function teamView(s: GameState, content: GameContent): TeamView {
  const cfg = content.config;
  const team = teamOf(s, content);
  const rush = s.rush ? cfg.rushSpeed : 1;
  const founder = cfg.founderSkill * (1 - s.sideJobShare) * rush;
  return {
    members: team.employees.map((e) => {
      const target = motivationTarget(e, s, cfg.team);
      return {
        ...e,
        motivationFactor: motivationFactor(e.motivation, cfg.team),
        motivationTarget: target,
        mayQuit: target < cfg.team.quitBelow,
        severance: e.salary * cfg.team.severanceMonths,
      };
    }),
    candidates: team.candidates,
    log: team.log,
    size: team.employees.length,
    maxSize: cfg.team.maxSize,
    canHire: team.employees.length < cfg.team.maxSize && s.status === 'running',
    payrollPerMonth: payrollPerMonth(team),
    workPerDay: founder + teamWorkPerDay(team, cfg.team) * rush,
    founderWorkPerDay: founder,
    marketingBoost: marketingBoost(team, cfg.team),
    daysToNewCandidates: Math.max(0, cfg.team.candidatesEveryDays - (s.day - team.refreshedDay)),
  };
}
