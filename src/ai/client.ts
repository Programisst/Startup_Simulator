// AI-разъём со стороны игры. Любая неудача (нет посредника, нет сети, долгий ответ, кривой ответ)
// возвращает null — экран молча берёт запасной путь: разбор по словам и готовые идеи.
import { content } from '../content';
import { ideaLexicon } from '../content/ideas';
import { checkIdeaAnswer, cleanIdea, type IdeaVerdict } from '../core';
import { AI_ROUTES, type AiAnalyzeRequest, type AiAnalyzeResponse, type AiIdeasRequest, type AiIdeasResponse, type AiLang, type AiStatus } from './protocol';

const TIMEOUT_MS = 45_000;

export interface IdeaReview extends IdeaVerdict {
  strengths: string;
  risks: string;
}

export interface SuggestedIdea extends IdeaVerdict {
  text: string;
}

async function call<T>(url: string, body?: unknown, timeoutMs = TIMEOUT_MS): Promise<T | null> {
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: body === undefined ? 'GET' : 'POST',
      headers: body === undefined ? undefined : { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: abort.signal,
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

const text = (x: unknown, max: number): string => (typeof x === 'string' ? x.replace(/\s+/g, ' ').trim().slice(0, max) : '');

/** Есть ли сейчас живая нейросеть. В собранной для пересылки игре посредника нет — ответ false. */
export async function aiAvailable(): Promise<boolean> {
  const status = await call<AiStatus>(AI_ROUTES.status, undefined, 4000);
  return status?.available === true;
}

/** Разбор идеи нейросетью. Тип, аудитория и доход проходят ту же проверку, что и любой чужой ответ. */
export async function aiAnalyzeIdea(idea: string, lang: AiLang): Promise<IdeaReview | null> {
  const clean = cleanIdea(idea);
  if (!clean) return null;
  const raw = await call<AiAnalyzeResponse>(AI_ROUTES.analyze, { idea: clean, lang } satisfies AiAnalyzeRequest);
  const verdict = checkIdeaAnswer(raw, clean, ideaLexicon, content);
  if (!raw || !verdict) return null;
  return { ...verdict, strengths: text(raw.strengths, 400), risks: text(raw.risks, 400) };
}

/** Свежие идеи от нейросети. Идеи с неизвестным типом продукта или пустым текстом отбрасываются. */
export async function aiSuggestIdeas(theme: string | null, lang: AiLang): Promise<SuggestedIdea[] | null> {
  const raw = await call<AiIdeasResponse>(AI_ROUTES.ideas, { theme, lang } satisfies AiIdeasRequest);
  if (!raw || !Array.isArray(raw.ideas)) return null;
  const out: SuggestedIdea[] = [];
  for (const item of raw.ideas) {
    const ideaText = cleanIdea(text(item?.text, 1000));
    const verdict = checkIdeaAnswer(item, ideaText, ideaLexicon, content);
    if (ideaText && verdict) out.push({ ...verdict, text: ideaText });
  }
  return out.length > 0 ? out : null;
}
