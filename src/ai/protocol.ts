// Формат обмена между игрой (браузер) и AI-посредником (сервер).
// Ключ к нейросети есть только у посредника; игра знает лишь эти адреса и формы ответов.

export const AI_ROUTES = {
  status: '/api/ai/status',
  analyze: '/api/ai/analyze',
  ideas: '/api/ai/ideas',
  talk: '/api/ai/talk',
} as const;

export type AiLang = 'ru' | 'en';

export interface AiStatus {
  available: boolean;
}

export interface AiAnalyzeRequest {
  idea: string;
  lang: AiLang;
}

/** Сырой ответ: игра проверяет его сама (checkIdeaAnswer), прежде чем использовать. */
export interface AiAnalyzeResponse {
  productType: string;
  audienceId: string;
  businessModel: string;
  /** Короткий разбор словами: что в идее сильного и в чём риск */
  strengths: string;
  risks: string;
}

export interface AiIdeasRequest {
  /** Название темы словами игрока или null — любая тема */
  theme: string | null;
  lang: AiLang;
}

export interface AiIdea {
  text: string;
  productType: string;
  audienceId: string;
  businessModel: string;
}

export interface AiIdeasResponse {
  ideas: AiIdea[];
}

/** Разговор основателя с сотрудником. Всё о человеке и компании передаётся готовыми словами: посредник ничего не знает об игре. */
export interface AiTalkRequest {
  lang: AiLang;
  /** Кто собеседник: имя, должность, что им движет, настроение, биография, привычка */
  person: { name: string; role: string; driver: string; trait: string; mood: 'high' | 'mid' | 'low'; bio: string; quirk: string };
  /** Что происходит в компании — короткими фактами */
  company: { name: string; idea: string; facts: string[] };
  /** О чём уже говорили (включая прошлые разговоры), по порядку */
  history: { from: 'founder' | 'employee'; text: string }[];
  /** Новая реплика основателя */
  message: string;
}

/** Сырой ответ: игра сама проверяет его, прежде чем использовать. */
export interface AiTalkResponse {
  reply: string;
  /** Как реплика основателя подействовала на человека */
  outcome: string;
}
