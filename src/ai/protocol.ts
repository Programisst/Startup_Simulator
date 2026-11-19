// Формат обмена между игрой (браузер) и AI-посредником (сервер).
// Ключ к нейросети есть только у посредника; игра знает лишь эти адреса и формы ответов.

export const AI_ROUTES = {
  status: '/api/ai/status',
  analyze: '/api/ai/analyze',
  ideas: '/api/ai/ideas',
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
