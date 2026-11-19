import { describe, expect, it } from 'vitest';
import { analyzeIdea, audienceForIdea, cleanIdea, createGame, IDEA_MAX_LENGTH, modelForIdea, type ProductTypeId } from '../src/core';
import { content } from '../src/content';
import { ideaLexicon, ideaSeeds, ideaThemes, nameParts } from '../src/content/ideas';
import ru from '../src/content/ru/ui.json';
import { baseSetup } from './helpers';

const analyze = (text: string) => analyzeIdea(text, ideaLexicon, content);
const TYPES = Object.keys(content.productTypes) as ProductTypeId[];

describe('разбор идеи игрока', () => {
  it('пустой или непонятный текст — продукт не определён', () => {
    expect(analyze('')).toEqual({ productType: null, audienceId: null, businessModel: null });
    expect(analyze('хочу стать богатым')).toEqual({ productType: null, audienceId: null, businessModel: null });
  });

  it('узнаёт тип продукта по словам идеи', () => {
    expect(analyze('Приложение для телефона, которое напоминает полить цветы').productType).toBe('mobile');
    expect(analyze('CRM и учёт склада для небольших компаний').productType).toBe('saas');
    expect(analyze('Нейросеть, которая пишет письма за юриста').productType).toBe('ai');
    expect(analyze('Площадка, где сдают в аренду инструменты').productType).toBe('marketplace');
    expect(analyze('Библиотека для программистов, ускоряет деплой').productType).toBe('devtools');
    expect(analyze('Сообщество и лента для любителей бега, друзья и чаты').productType).toBe('social');
  });

  it('понимает английский и буквы любого регистра, «ё» и «е» равны', () => {
    expect(analyze('A MOBILE APP for runners').productType).toBe('mobile');
    expect(analyze('УЧЁТ для бухгалтера').productType).toBe('saas');
  });

  it('короткое слово «ИИ» узнаётся только целиком', () => {
    expect(analyze('ИИ для всех').productType).toBe('ai');
    expect(analyze('иифть').productType).toBeNull();
  });

  it('аудитория берётся из идеи и всегда подходит типу продукта', () => {
    expect(analyze('Приложение для родителей и детей').audienceId).toBe('parents');
    expect(analyze('Нейросеть для студентов перед экзаменом').audienceId).toBe('students');
    // Родителей среди аудиторий SaaS нет — берётся первая подходящая.
    expect(analyze('CRM и учёт для родителей').audienceId).toBe(content.productTypes.saas.audiences[0]!.id);
    for (const type of TYPES) {
      const id = audienceForIdea('что угодно для родителей, студентов и разработчиков', type, ideaLexicon, content);
      expect(content.productTypes[type].audiences.map((a) => a.id)).toContain(id);
    }
  });

  it('способ заработка: из идеи, иначе обычный для типа', () => {
    expect(analyze('Мобильная игра, бесплатная, с рекламой').businessModel).toBe('ads');
    expect(analyze('Приложение по подписке').businessModel).toBe('subscription');
    expect(analyze('Приложение, которое покупают один раз').businessModel).toBe('oneTime');
    expect(modelForIdea('', 'marketplace', ideaLexicon)).toBe('commission');
    expect(modelForIdea('', 'social', ideaLexicon)).toBe('ads');
  });

  it('один и тот же текст всегда даёт один и тот же ответ', () => {
    const text = 'Маркетплейс для фрилансеров с комиссией';
    expect(analyze(text)).toEqual(analyze(text));
    expect(analyze(text)).toEqual({ productType: 'marketplace', audienceId: 'freelancers', businessModel: 'commission' });
  });
});

describe('готовые идеи-подсказки', () => {
  it('у каждой идеи есть текст, тема и допустимые тип, аудитория и доход', () => {
    const texts = ru.new.ideas as Record<string, string>;
    const themeNames = ru.new.themes as Record<string, string>;
    expect(new Set(ideaSeeds.map((s) => s.id)).size).toBe(ideaSeeds.length);
    expect(Object.keys(texts).sort()).toEqual(ideaSeeds.map((s) => s.id).sort());
    expect(Object.keys(themeNames).sort()).toEqual([...ideaThemes].sort());
    for (const seed of ideaSeeds) {
      expect(texts[seed.id]!.length).toBeLessThanOrEqual(IDEA_MAX_LENGTH);
      expect(ideaThemes).toContain(seed.theme);
      expect(content.productTypes[seed.productType].audiences.map((a) => a.id), seed.id).toContain(seed.audienceId);
      expect(Object.keys(ideaLexicon.models)).toContain(seed.businessModel);
    }
  });

  it('в каждой теме не меньше трёх идей, и все типы продукта представлены', () => {
    for (const theme of ideaThemes) expect(ideaSeeds.filter((s) => s.theme === theme).length, theme).toBeGreaterThanOrEqual(3);
    for (const type of TYPES) expect(ideaSeeds.some((s) => s.productType === type), type).toBe(true);
  });

  it('разбор текста готовой идеи даёт тот же тип продукта, что записан у идеи', () => {
    const texts = ru.new.ideas as Record<string, string>;
    for (const seed of ideaSeeds) expect(analyze(texts[seed.id]!).productType, seed.id).toBe(seed.productType);
  });

  it('словарь знает все типы продукта и все аудитории', () => {
    const audienceIds = new Set(TYPES.flatMap((t) => content.productTypes[t].audiences.map((a) => a.id)));
    for (const type of TYPES) expect(ideaLexicon.productTypes[type].length).toBeGreaterThan(0);
    for (const id of audienceIds) expect(ideaLexicon.audiences[id]?.length ?? 0, id).toBeGreaterThan(0);
  });

  it('слогов хватает на много разных названий', () => {
    expect(nameParts.starts.length * nameParts.ends.length).toBeGreaterThanOrEqual(100);
  });
});

describe('идея в партии', () => {
  it('сохраняется в партии в чистом виде и не длиннее предела', () => {
    const s = createGame({ ...baseSetup, idea: '  Приложение   для\nсобак  ' }, content);
    expect(s.idea).toBe('Приложение для собак');
    expect(cleanIdea('я'.repeat(1000))).toHaveLength(IDEA_MAX_LENGTH);
  });

  it('без идеи партия такая же, как раньше: поле не появляется', () => {
    const s = createGame(baseSetup, content);
    expect('idea' in s).toBe(false);
    expect(createGame({ ...baseSetup, idea: '   ' }, content)).toEqual(s);
  });

  it('идея не влияет на расчёт: рынок зависит только от выбранных типа и аудитории', () => {
    const a = createGame(baseSetup, content);
    const b = createGame({ ...baseSetup, idea: 'Гениальная нейросеть для всех' }, content);
    expect(b.market).toEqual(a.market);
    expect(b.cash).toBe(a.cash);
  });
});
