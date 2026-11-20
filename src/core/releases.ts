// Обещанное обновление: игрок объявляет размер и срок, успел — всплеск интереса, сорвал — удар по репутации.
// Описание — docs/02-economy.md, раздел 26.

import { clamp } from './formulas';
import { founderWorkPerDay } from './founder';
import { teamOf, teamWorkPerDay } from './team';
import type { GameContent, GameState, NewsItem, ReleaseConfig, ReleaseDeadlineDef, ReleaseOutcome, ReleaseSizeDef, ReleaseState } from './types';

export const releaseOf = (s: GameState): ReleaseState => s.release ?? { active: null, last: null, shipped: 0 };

/** Обычный темп: основатель без подработки и усталости плюс команда. От него считается объём обещанной работы. */
export function basePace(s: GameState, content: GameContent): number {
  return content.config.founderSkill + teamWorkPerDay(teamOf(s, content), content.config.team);
}

/** Сколько работы делается за день прямо сейчас — с усталостью, подработкой, кофе и спешкой. */
function currentPace(s: GameState, content: GameContent): number {
  const cfg = content.config;
  return (founderWorkPerDay(s, cfg) + teamWorkPerDay(teamOf(s, content), cfg.team)) * (s.rush ? cfg.rushSpeed : 1);
}

export interface ReleaseTerms {
  /** Сколько работы нужно сделать и за сколько дней */
  need: number;
  days: number;
  /** Что даст выпуск в срок: приток в процентах, на сколько дней, репутация */
  boostPct: number;
  boostDays: number;
  reputation: number;
  /** Что будет при срыве срока */
  failReputation: number;
}

const r1 = (x: number): number => Math.round(x * 10) / 10;

export function releaseTerms(s: GameState, content: GameContent, size: ReleaseSizeDef, deadline: ReleaseDeadlineDef): ReleaseTerms {
  return {
    need: size.teamDays * basePace(s, content),
    days: Math.max(1, Math.round(size.teamDays * deadline.time)),
    boostPct: Math.round((size.factor - 1) * deadline.reward * 100),
    boostDays: size.days,
    reputation: r1(size.reputation * deadline.reward),
    failReputation: r1(size.failReputation * deadline.penalty),
  };
}

export type ReleaseBlock = 'notLaunched' | 'busy' | 'cooldown';

export function releaseBlock(s: GameState, cfg: ReleaseConfig): ReleaseBlock | null {
  const st = releaseOf(s);
  if (!s.launched) return 'notLaunched';
  if (st.active) return 'busy';
  if (st.last && s.day < st.last.day + cfg.cooldownDays) return 'cooldown';
  return null;
}

/** Объявляет обновление. Возвращает null, если сейчас нельзя или такого размера или срока нет. */
export function announceRelease(s: GameState, content: GameContent, sizeId: string, deadlineId: string): GameState | null {
  const cfg = content.config.releases;
  const size = cfg.sizes.find((x) => x.id === sizeId);
  const deadline = cfg.deadlines.find((x) => x.id === deadlineId);
  if (!size || !deadline || releaseBlock(s, cfg) !== null) return null;
  const terms = releaseTerms(s, content, size, deadline);
  return { ...s, release: { ...releaseOf(s), active: { size: size.id, deadline: deadline.id, startDay: s.day, dueDay: s.day + terms.days, need: terms.need, done: 0 } } };
}

/** Засчитывает сделанную работу в обещанное обновление. Возвращает новое состояние обновления или прежнее. */
export function withReleaseWork(s: GameState, work: number): ReleaseState | undefined {
  const st = s.release;
  if (!st?.active || work <= 0) return st;
  return { ...st, active: { ...st.active, done: st.active.done + work } };
}

/** Шаг дня после работы над задачами: вышло ли обновление или сорван срок. Меняет черновик состояния. */
export function stepRelease(s: GameState, content: GameContent): void {
  const st = s.release;
  const a = st?.active;
  if (!st || !a) return;
  const cfg = content.config.releases;
  const finished = a.done >= a.need - 1e-6;
  // Последний рабочий день обещанного срока — накануне dueDay.
  if (!finished && s.day < a.dueDay - 1) return;

  const size = cfg.sizes.find((x) => x.id === a.size);
  const deadline = cfg.deadlines.find((x) => x.id === a.deadline);
  const outcome: ReleaseOutcome = !finished ? 'missed' : s.bugs >= cfg.buggyAt ? 'rough' : 'onTime';
  s.release = { active: null, last: { size: a.size, deadline: a.deadline, day: s.day, outcome }, shipped: st.shipped + (finished ? 1 : 0) };
  if (!size || !deadline) return;

  let boostPct = 0;
  if (outcome === 'missed') {
    s.reputation = clamp(s.reputation + size.failReputation * deadline.penalty, 0, 100);
  } else {
    const share = outcome === 'rough' ? cfg.roughShare : 1;
    const factor = 1 + (size.factor - 1) * deadline.reward * share;
    boostPct = Math.round((factor - 1) * 100);
    s.modifiers = [...s.modifiers, { target: 'acquisition', factor, untilDay: s.day + size.days }];
    // Сырой выпуск репутации не прибавляет.
    if (outcome === 'onTime') s.reputation = clamp(s.reputation + size.reputation * deadline.reward, 0, 100);
  }
  const tone: NewsItem['tone'] = outcome === 'onTime' ? 'good' : outcome === 'rough' ? 'mixed' : 'bad';
  s.news = [...(s.news ?? []), { day: s.day, kind: 'release' as const, id: a.size, tone, value: boostPct }].slice(-40);
}

export interface ReleaseOption extends ReleaseTerms {
  size: ReleaseSizeDef['id'];
  deadline: ReleaseDeadlineDef['id'];
  /** За сколько дней этот объём делается при нынешнем темпе; null — работа стоит */
  daysAtCurrentPace: number | null;
}

export interface ReleaseView {
  options: ReleaseOption[];
  blocked: ReleaseBlock | null;
  cooldownDaysLeft: number;
  /** Объявленное обновление: готовность 0…1, дней до срока, успеваем ли при нынешнем темпе */
  active: {
    size: ReleaseSizeDef['id'];
    deadline: ReleaseDeadlineDef['id'];
    progress: number;
    daysLeft: number;
    onTrack: boolean;
    /** Есть ли задачи в очереди: без них работа не идёт и не засчитывается */
    hasWork: boolean;
    boostPct: number;
    failReputation: number;
  } | null;
  last: ReleaseState['last'];
  shipped: number;
  /** С какого числа ошибок выпуск выйдет сырым, и сколько их сейчас */
  buggyAt: number;
  bugs: number;
}

/** Всё, что экрану нужно знать об обещанном обновлении. Состояние не меняет. */
export function releaseView(s: GameState, content: GameContent): ReleaseView {
  const cfg = content.config.releases;
  const st = releaseOf(s);
  const pace = currentPace(s, content);
  const options = cfg.sizes.flatMap((size) =>
    cfg.deadlines.map((deadline): ReleaseOption => {
      const terms = releaseTerms(s, content, size, deadline);
      return { size: size.id, deadline: deadline.id, ...terms, daysAtCurrentPace: pace > 0 ? Math.ceil(terms.need / pace - 1e-9) : null };
    }),
  );
  let active: ReleaseView['active'] = null;
  if (st.active) {
    const a = st.active;
    const size = cfg.sizes.find((x) => x.id === a.size);
    const deadline = cfg.deadlines.find((x) => x.id === a.deadline);
    const daysLeft = Math.max(0, a.dueDay - s.day);
    active = {
      size: a.size,
      deadline: a.deadline,
      progress: a.need > 0 ? clamp(a.done / a.need, 0, 1) : 1,
      daysLeft,
      onTrack: s.tasks.length > 0 && a.done + pace * daysLeft >= a.need - 1e-6,
      hasWork: s.tasks.length > 0,
      boostPct: size && deadline ? Math.round((size.factor - 1) * deadline.reward * 100) : 0,
      failReputation: size && deadline ? r1(size.failReputation * deadline.penalty) : 0,
    };
  }
  const cooldownDaysLeft = st.last ? Math.max(0, st.last.day + cfg.cooldownDays - s.day) : 0;
  return { options, blocked: releaseBlock(s, cfg), cooldownDaysLeft, active, last: st.last, shipped: st.shipped, buggyAt: cfg.buggyAt, bugs: s.bugs };
}
