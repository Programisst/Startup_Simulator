// Переписка с другом после заставки — вместо анкеты. Только логика: кто что пишет и что из этого следует.
// Друг спрашивает, игрок отвечает своими словами; из ответов собирается своя партия.
// Нейросеть помогает понять идею (resolveIdea получает её ответ), но без неё переписка тоже доходит до конца.
import { content } from '../../content';
import { ideaLexicon, themeLexicon } from '../../content/ideas';
import {
  analyzeIdea,
  audienceForIdea,
  cleanIdea,
  modelForIdea,
  themeForIdea,
  type BusinessModel,
  type DifficultyId,
  type GoalId,
  type NewGameSetup,
  type ProductTypeId,
} from '../../core';

export type Stage = 'idea' | 'audience' | 'name' | 'thinking' | 'pickType' | 'savings' | 'goal' | 'done';

/** Одно сообщение. Готовая реплика — ключ перевода; то, что написал игрок или нейросеть, — текст. */
export interface Line {
  from: 'friend' | 'me';
  key?: string;
  /** Числа для подстановки в реплику (деньги показываются как деньги) */
  params?: Record<string, number>;
  text?: string;
  /** Живая реплика друга: ждёт ответа нейросети, а пока не дождалась — стоит заготовка из key */
  live?: boolean;
}

export interface ChatState {
  stage: Stage;
  lines: Line[];
  idea: string;
  audienceText: string;
  name: string;
  productType?: ProductTypeId;
  audienceId?: string;
  businessModel?: BusinessModel;
  difficulty?: DifficultyId;
  goal?: GoalId;
}

/** Ответ нейросети на идею (как у aiAnalyzeIdea). */
export interface IdeaReviewLike {
  productType: ProductTypeId;
  audienceId: string;
  businessModel: BusinessModel;
  strengths: string;
  risks: string;
}

export interface QuickReply {
  id: string;
  key: string;
  params?: Record<string, number>;
}

/** Короче этого идея — просто слово, друг попросит рассказать подробнее. */
const MIN_IDEA = 12;
const TYPES = Object.keys(content.productTypes) as ProductTypeId[];
const SAVINGS: DifficultyId[] = ['easy', 'normal', 'hard'];
const GOALS: GoalId[] = ['profit', 'valuation', 'sandbox'];

const friend = (...keys: string[]): Line[] => keys.map((key) => ({ from: 'friend', key: `opening.friend.${key}` }));
/** Реакция друга на слова игрока: живая от нейросети, заготовка — если та не ответила. */
const liveLine = (key: string): Line => ({ from: 'friend', key: `opening.friend.${key}`, live: true });
const say = (s: ChatState, stage: Stage, ...lines: Line[]): ChatState => ({ ...s, stage, lines: [...s.lines, ...lines] });

export function startChat(): ChatState {
  return { stage: 'idea', lines: friend('hello', 'askIdea'), idea: '', audienceText: '', name: '' };
}

/** Игрок написал своими словами. */
export function reply(s: ChatState, raw: string): ChatState {
  const text = raw.replace(/\s+/g, ' ').trim();
  if (!text) return s;
  const me: Line = { from: 'me', text };
  if (s.stage === 'idea') {
    if (text.length < MIN_IDEA) return say(s, 'idea', me, ...friend('tooShort'));
    return say({ ...s, idea: cleanIdea(text) }, 'audience', me, liveLine('likeIt'), ...friend('askAudience'));
  }
  if (s.stage === 'audience') return say({ ...s, audienceText: text }, 'name', me, liveLine('audienceOk'), ...friend('askName'));
  if (s.stage === 'name') return say({ ...s, name: text.slice(0, 40) }, 'thinking', me, ...friend('thinking'));
  return s;
}

/** Кнопки-ответы для текущего шага. */
export function quickReplies(s: ChatState): QuickReply[] {
  if (s.stage === 'name') return [{ id: 'skipName', key: 'opening.me.skipName' }];
  if (s.stage === 'pickType') return TYPES.map((id) => ({ id, key: `opening.type.${id}` }));
  // В ответе видно, с какими деньгами начнёшь: игрок выбирает не наугад.
  if (s.stage === 'savings') return SAVINGS.map((id) => ({ id, key: `opening.me.savings.${id}`, params: { cash: content.difficulties[id].startCash } }));
  if (s.stage === 'goal') return GOALS.map((id) => ({ id, key: `opening.me.goal.${id}` }));
  return [];
}

/** Всё, что игрок рассказал об идее, одним текстом — для разбора по словам. */
const story = (s: ChatState) => `${s.idea}. ${s.audienceText}`;

/** Тип продукта понятен: подбираем аудиторию и способ заработка по словам игрока. */
function withType(s: ChatState, productType: ProductTypeId): ChatState {
  return {
    ...s,
    productType,
    audienceId: audienceForIdea(story(s), productType, ideaLexicon, content),
    businessModel: modelForIdea(story(s), productType, ideaLexicon),
  };
}

/** Игрок нажал кнопку-ответ. */
export function choose(s: ChatState, id: string): ChatState {
  const option = quickReplies(s).find((o) => o.id === id);
  if (!option) return s;
  const me: Line = { from: 'me', key: option.key, ...(option.params ? { params: option.params } : {}) };
  if (s.stage === 'name') return say({ ...s, name: '' }, 'thinking', me, ...friend('thinking'));
  if (s.stage === 'pickType') return say(withType(s, id as ProductTypeId), 'savings', me, ...friend(`react.${id}`, 'askSavings'));
  if (s.stage === 'savings') return say({ ...s, difficulty: id as DifficultyId }, 'goal', me, ...friend(`savings.${id}`, 'askGoal'));
  if (s.stage === 'goal') return say({ ...s, goal: id as GoalId }, 'done', me, ...friend(`goal.${id}`, 'bye', 'byeSleep'));
  return s;
}

/**
 * Друг подумал над идеей. Есть ответ нейросети — он пересказывает её разбор своими словами.
 * Нет — понимает по словам; не понял — спрашивает кнопками, что это за продукт.
 */
export function resolveIdea(s: ChatState, review: IdeaReviewLike | null): ChatState {
  if (s.stage !== 'thinking') return s;
  if (review) {
    const next = { ...s, productType: review.productType, audienceId: review.audienceId, businessModel: review.businessModel };
    const lines: Line[] = [];
    if (review.strengths) lines.push(...friend('strong'), { from: 'friend', text: review.strengths });
    if (review.risks) lines.push(...friend('risk'), { from: 'friend', text: review.risks });
    if (lines.length === 0) lines.push(...friend(`react.${review.productType}`));
    return say(next, 'savings', ...lines, ...friend('askSavings'));
  }
  const guess = analyzeIdea(story(s), ideaLexicon, content).productType;
  if (!guess) return say(s, 'pickType', ...friend('askType'));
  return say(withType(s, guess), 'savings', ...friend(`react.${guess}`, 'askSavings'));
}

/** Партия из переписки. Начальное число и обычное название приходят снаружи: логика остаётся повторяемой. */
export function chatSetup(s: ChatState, seed: number, defaultName: string): NewGameSetup {
  const productType = s.productType ?? 'saas';
  const themeId = themeForIdea(story(s), themeLexicon);
  return {
    seed,
    companyName: s.name || defaultName,
    idea: s.idea,
    ...(themeId ? { themeId } : {}),
    productType,
    audienceId: s.audienceId ?? audienceForIdea(story(s), productType, ideaLexicon, content),
    businessModel: s.businessModel ?? modelForIdea(story(s), productType, ideaLexicon),
    goal: s.goal ?? 'profit',
    difficulty: s.difficulty ?? 'normal',
  };
}

/** Номер живой реплики друга, которая ещё ждёт нейросеть; null — таких нет. */
export function pendingLive(s: ChatState): number | null {
  const i = s.lines.findIndex((l) => l.live);
  return i < 0 ? null : i;
}

/** Нейросеть ответила (text) или нет (null — остаётся заготовка). */
export function settleLive(s: ChatState, index: number, text: string | null): ChatState {
  const line = s.lines[index];
  if (!line?.live) return s;
  const settled: Line = { from: line.from, ...(line.key ? { key: line.key } : {}), ...(text ? { text } : {}) };
  return { ...s, lines: s.lines.map((l, i) => (i === index ? settled : l)) };
}
