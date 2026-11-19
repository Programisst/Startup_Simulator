// Всё, что ядро отдаёт наружу. Интерфейс и инструменты импортируют только отсюда.
export * from './types';
export * from './formulas';
export { createGame } from './game';
export { analyzeIdea, audienceForIdea, modelForIdea, cleanIdea, checkIdeaAnswer, IDEA_MAX_LENGTH, type IdeaAnalysis, type IdeaLexicon, type IdeaVerdict } from './idea';
export { tick, currentQuality, featureScore } from './tick';
export { applyCommand } from './commands';
export { conditionHolds } from './events';
export { createRng, nextFloat, nextInt, nextRange, type RngState } from './rng';
export { roomView, roomClock, type FounderActivity, type RoomAlerts, type RoomCalendar, type RoomProduct, type RoomTask, type RoomView } from './room';
export { teamView, teamOf, createTeam, motivationFactor, motivationTarget, teamWorkPerDay, marketingBoost, payrollPerMonth, type TeamView, type TeamMemberView } from './team';
