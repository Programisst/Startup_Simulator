// Темы стартапов и тип продукта «Игра»: свои функции, свой рынок, разные партии.
import { describe, expect, it } from 'vitest';
import { applyCommand, createGame, featuresOf, pickFeatures, themeForIdea, type ProductTypeId } from '../src/core';
import { content } from '../src/content';
import { ideaSeeds, ideaThemes, themeLexicon } from '../src/content/ideas';
import featureTexts from '../src/content/ru/features.json';
import ru from '../src/content/ru/ui.json';
import { advance, baseSetup, run } from './helpers';

const TYPES = Object.keys(content.productTypes) as ProductTypeId[];
const game = (over: Partial<typeof baseSetup> & { themeId?: string } = {}) => createGame({ ...baseSetup, ...over }, content);
const names = featureTexts as Record<string, string>;

describe('темы', () => {
  it('тем столько же, сколько на экране создания, и у каждой есть описание особенностей', () => {
    expect(content.themes.map((t) => t.id).sort()).toEqual([...ideaThemes].sort());
    const notes = (ru as unknown as { themeNotes: Record<string, string> }).themeNotes;
    for (const t of content.themes) expect(notes[t.id]?.length ?? 0, t.id).toBeGreaterThan(30);
  });

  it('у каждой темы четыре своих функции с названиями, и они не повторяются нигде', () => {
    const all = content.themes.flatMap((t) => t.features.map((f) => f.id));
    expect(new Set(all).size).toBe(all.length);
    const generic = new Set(TYPES.flatMap((type) => content.features[type].map((f) => f.id)));
    for (const t of content.themes) {
      expect(t.features, t.id).toHaveLength(4);
      for (const f of t.features) {
        expect(generic.has(f.id), f.id).toBe(false);
        expect(names[f.id]?.length ?? 0, f.id).toBeGreaterThan(3);
        expect(f.cost).toBeGreaterThan(0);
        expect(f.value).toBeGreaterThan(0);
        expect(f.core).toBeUndefined();
      }
    }
  });

  it('особенности рынка умеренные: ни одна тема не обречена и не даёт победу даром', () => {
    for (const t of content.themes) {
      expect(Object.keys(t.market).length, t.id).toBeGreaterThan(0);
      for (const [key, value] of Object.entries(t.market)) {
        expect(value, `${t.id}.${key}`).toBeGreaterThanOrEqual(0.6);
        expect(value, `${t.id}.${key}`).toBeLessThanOrEqual(1.4);
      }
    }
  });

  it('тема меняет рынок партии', () => {
    const plain = game();
    const finance = game({ themeId: 'finance' });
    expect(finance.market.priceRef).toBeCloseTo(plain.market.priceRef * 1.3, 6);
    expect(finance.market.cacBase).toBeCloseTo(plain.market.cacBase * 1.3, 6);
    expect(finance.market.churnBase).toBeCloseTo(plain.market.churnBase * 0.85, 6);
    expect(game({ themeId: 'city' }).market.marketSize).toBeCloseTo(plain.market.marketSize * 0.6, 6);
  });
});

describe('функции партии', () => {
  it('в партии с темой: основа первой, все четыре функции темы и четыре общих', () => {
    const s = game({ themeId: 'food' });
    const list = featuresOf(s, content);
    expect(list[0]).toMatchObject({ id: 'core', core: true });
    expect(list).toHaveLength(1 + 4 + content.config.founder.genericFeaturesPerGame);
    const food = content.themes.find((t) => t.id === 'food')!.features.map((f) => f.id);
    for (const id of food) expect(list.map((f) => f.id)).toContain(id);
    const generic = list.filter((f) => !f.core && !food.includes(f.id));
    expect(generic).toHaveLength(4);
    for (const f of generic) expect(content.features.saas.map((x) => x.id)).toContain(f.id);
  });

  it('у разных партий наборы разные, у одинаковых — одинаковые', () => {
    const lists = Array.from({ length: 12 }, (_, seed) => pickFeatures(seed * 31 + 1, 'saas', 'work', content).join(','));
    expect(new Set(lists).size).toBeGreaterThanOrEqual(6);
    expect(pickFeatures(77, 'saas', 'work', content)).toEqual(pickFeatures(77, 'saas', 'work', content));
  });

  it('у разных тем функции разные даже при одном типе продукта', () => {
    const food = featuresOf(game({ themeId: 'food' }), content).map((f) => f.id);
    const dev = featuresOf(game({ themeId: 'dev' }), content).map((f) => f.id);
    expect(food.filter((id) => id.startsWith('t_')).some((id) => dev.includes(id))).toBe(false);
  });

  it('функцию темы можно поставить в очередь и сделать; чужую — нельзя', () => {
    let s = game({ themeId: 'food' });
    s = advance(run(s, { type: 'queueFeature', featureId: 'core' }), 40);
    expect(run(s, { type: 'queueFeature', featureId: 't_courierMap' }).tasks).toHaveLength(1);
    expect(applyCommand(s, { type: 'queueFeature', featureId: 't_bankLink' }, content)).toEqual({ ok: false, error: 'unknownFeature' });
    const missing = content.features.saas.find((f) => !f.core && !s.featureIds!.includes(f.id))!;
    expect(applyCommand(s, { type: 'queueFeature', featureId: missing.id }, content)).toEqual({ ok: false, error: 'unknownFeature' });
    const done = advance(run({ ...s, cash: 1e6 }, { type: 'queueFeature', featureId: 't_courierMap' }), 60);
    expect(done.doneFeatures).toContain('t_courierMap');
    expect(done.quality).toBeGreaterThan(0);
  });

  it('партия без темы и старое сохранение играются со всеми функциями типа', () => {
    const plain = game();
    expect(plain.featureIds).toBeUndefined();
    expect(featuresOf(plain, content)).toEqual(content.features.saas);
    expect(game({ themeId: 'нет-такой' }).themeId).toBeUndefined();
  });

  it('суммарная ценность функций у партий с темой сопоставима с партией без темы', () => {
    const sum = (ids: { value: number }[]) => ids.reduce((a, f) => a + f.value, 0);
    for (const type of TYPES) {
      const base = sum(content.features[type]);
      for (const theme of content.themes) {
        const s = createGame({ ...baseSetup, productType: type, audienceId: content.productTypes[type].audiences[0]!.id, themeId: theme.id }, content);
        const total = sum(featuresOf(s, content));
        expect(total / base, `${type}/${theme.id}`).toBeGreaterThan(0.8);
        expect(total / base, `${type}/${theme.id}`).toBeLessThan(1.35);
      }
    }
  });
});

describe('тип продукта «Игра»', () => {
  it('есть в игре: с числами, функциями, названиями и идеями', () => {
    expect(TYPES).toContain('game');
    expect(content.features.game[0]).toMatchObject({ id: 'core', core: true });
    expect(content.features.game.length).toBeGreaterThanOrEqual(8);
    for (const f of content.features.game) if (!f.core) expect(names[f.id]?.length ?? 0, f.id).toBeGreaterThan(3);
    const texts = ru.productTypes as Record<string, { name: string; hint: string; core: string }>;
    expect(texts.game).toMatchObject({ name: 'Игра' });
    expect(ideaSeeds.filter((s) => s.productType === 'game').length).toBeGreaterThanOrEqual(3);
    expect((ru.audiences as Record<string, string>).gamers).toBeDefined();
  });

  it('играется: игра про ферму создаётся и доходит до запуска', () => {
    let s = createGame({ ...baseSetup, productType: 'game', audienceId: 'everyone', businessModel: 'ads', themeId: 'games' }, content);
    s = advance(run({ ...s, cash: 1e6 }, { type: 'queueFeature', featureId: 'core' }), 40);
    s = advance(run(s, { type: 'launch' }), 60);
    expect(s.users).toBeGreaterThan(50);
    expect(s.status).toBe('running');
  });
});

describe('тема по словам идеи', () => {
  it('узнаёт тему', () => {
    expect(themeForIdea('Игра-головоломка с уровнями', themeLexicon)).toBe('games');
    expect(themeForIdea('Сервис считает налоги и ведёт бюджет', themeLexicon)).toBe('finance');
    expect(themeForIdea('Доставка обедов из кафе', themeLexicon)).toBe('food');
    expect(themeForIdea('что-то непонятное', themeLexicon)).toBeNull();
  });

  it('у готовых идей тема по тексту обычно совпадает с записанной', () => {
    const texts = ru.new.ideas as Record<string, string>;
    const hits = ideaSeeds.filter((s) => themeForIdea(texts[s.id]!, themeLexicon) === s.theme).length;
    expect(hits / ideaSeeds.length).toBeGreaterThanOrEqual(0.7);
  });
});
