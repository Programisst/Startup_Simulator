// Всё, что ядро отдаёт наружу. Интерфейс и инструменты импортируют только отсюда.
export * from './types';
export * from './formulas';
export { createGame } from './game';
export { analyzeIdea, audienceForIdea, modelForIdea, cleanIdea, IDEA_MAX_LENGTH, type IdeaAnalysis, type IdeaLexicon } from './idea';
export { tick, currentQuality, featureScore } from './tick';
export { applyCommand } from './commands';
export { conditionHolds } from './events';
export { createRng, nextFloat, nextInt, nextRange, type RngState } from './rng';
