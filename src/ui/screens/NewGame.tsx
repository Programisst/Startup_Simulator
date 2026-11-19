// Создание компании: окно «Новая компания» на рабочем столе ноутбука. Игрок записывает идею своими словами,
// игра по словам определяет тип продукта, аудиторию и способ заработка. Нет идеи — есть готовые подсказки.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { aiAnalyzeIdea, aiAvailable, aiSuggestIdeas } from '../../ai/client';
import { content } from '../../content';
import { ideaLexicon, ideaSeeds, ideaThemes, nameParts, type IdeaSeed, type IdeaThemeId } from '../../content/ideas';
import { analyzeIdea, audienceForIdea, IDEA_MAX_LENGTH, modelForIdea, type BusinessModel, type DifficultyId, type GoalId, type ProductTypeId } from '../../core';
import { hasSave } from '../../save/storage';
import { Landscape } from '../apartment/laptop/Landscape';
import { money } from '../format';
import { useStore } from '../store';
import './newgame.css';

const TYPES = Object.keys(content.productTypes) as ProductTypeId[];
const MODELS: BusinessModel[] = ['subscription', 'ads', 'oneTime', 'commission'];
const DIFFICULTIES: DifficultyId[] = ['easy', 'normal', 'hard'];
const GOALS: GoalId[] = ['profit', 'valuation', 'sandbox'];
const IDEAS_SHOWN = 3;

/** То, что игрок выбрал руками поверх разбора идеи. */
interface Manual {
  productType?: ProductTypeId;
  audienceId?: string;
  businessModel?: BusinessModel;
}

function pick<T>(list: T[]): T {
  return list[Math.floor(Math.random() * list.length)]!;
}

/** Идея-подсказка на стикере: из готового списка или от нейросети. */
interface Offer {
  key: string;
  label: string;
  text: string;
  productType: ProductTypeId;
  audienceId: string;
  businessModel: BusinessModel;
}

/** Несколько случайных готовых идей по теме, по возможности не те, что показаны сейчас. */
function drawIdeas(theme: IdeaThemeId | null, shownKeys: string[]): IdeaSeed[] {
  const pool = ideaSeeds.filter((s) => theme === null || s.theme === theme);
  const fresh = pool.filter((s) => !shownKeys.includes(s.id));
  const from = (fresh.length >= IDEAS_SHOWN ? fresh : pool).slice();
  const out: IdeaSeed[] = [];
  while (out.length < IDEAS_SHOWN && from.length > 0) out.push(from.splice(Math.floor(Math.random() * from.length), 1)[0]!);
  return out;
}

export function NewGame() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language === 'en' ? 'en' : 'ru';
  const start = useStore((s) => s.start);
  const load = useStore((s) => s.load);

  const [idea, setIdea] = useState('');
  const [manual, setManual] = useState<Manual>({});
  const [theme, setTheme] = useState<IdeaThemeId | null>(null);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [offersOpen, setOffersOpen] = useState(false);
  // Нейросеть есть только рядом с AI-посредником; без неё экран работает на словаре и готовых идеях.
  const [ai, setAi] = useState(false);
  const [busy, setBusy] = useState<'ideas' | 'review' | null>(null);
  const [fromAi, setFromAi] = useState(false);
  const [review, setReview] = useState<{ strengths: string; risks: string } | null>(null);
  const [aiFailed, setAiFailed] = useState(false);
  const alive = useRef(true);
  const ideaRef = useRef('');
  const [name, setName] = useState('');
  const [difficulty, setDifficulty] = useState<DifficultyId>('normal');
  const [goal, setGoal] = useState<GoalId>('profit');

  useEffect(() => {
    alive.current = true;
    void aiAvailable().then((ok) => {
      if (alive.current) setAi(ok);
    });
    return () => {
      alive.current = false;
    };
  }, []);

  const analysis = useMemo(() => analyzeIdea(idea, ideaLexicon, content), [idea]);
  const diff = content.difficulties[difficulty];

  // Выбор игрока важнее разбора; разбор важнее пустоты.
  const productType = manual.productType ?? analysis.productType;
  const audiences = productType ? content.productTypes[productType].audiences : [];
  const audienceId = productType
    ? manual.audienceId && audiences.some((a) => a.id === manual.audienceId)
      ? manual.audienceId
      : audienceForIdea(idea, productType, ideaLexicon, content)
    : null;
  const businessModel = productType ? (manual.businessModel ?? modelForIdea(idea, productType, ideaLexicon)) : null;

  const hasText = idea.trim().length > 0;
  const reading = productType ? 'readingHint' : hasText ? 'readingUnknown' : 'readingEmpty';

  function setText(text: string) {
    ideaRef.current = text;
    setIdea(text);
    setReview(null);
    setAiFailed(false);
  }

  function writeIdea(text: string) {
    setText(text);
    // Игрок переписал идею — разбираем заново, прежние ручные поправки не держим.
    setManual({});
  }

  function takeIdea(offer: Offer) {
    setText(offer.text);
    setManual({ productType: offer.productType, audienceId: offer.audienceId, businessModel: offer.businessModel });
  }

  function showReadyIdeas(nextTheme: IdeaThemeId | null) {
    setFromAi(false);
    setOffers((shown) =>
      drawIdeas(
        nextTheme,
        shown.map((o) => o.key),
      ).map((seed) => ({ ...seed, key: seed.id, label: t(`new.themes.${seed.theme}`), text: t(`new.ideas.${seed.id}`) })),
    );
  }

  async function suggest(nextTheme: IdeaThemeId | null = theme) {
    setTheme(nextTheme);
    setOffersOpen(true);
    setAiFailed(false);
    if (!ai) return showReadyIdeas(nextTheme);
    setBusy('ideas');
    const label = nextTheme ? t(`new.themes.${nextTheme}`) : null;
    const fresh = await aiSuggestIdeas(label, lang);
    if (!alive.current) return;
    setBusy(null);
    if (!fresh) {
      // Нейросеть не ответила — молча берём готовые идеи.
      setAiFailed(true);
      return showReadyIdeas(nextTheme);
    }
    setFromAi(true);
    setOffers(fresh.slice(0, IDEAS_SHOWN).map((o, i) => ({ ...o, key: `ai-${Date.now()}-${i}`, label: label ?? t(`productTypes.${o.productType}.name`) })));
  }

  async function askReview() {
    const asked = idea;
    setBusy('review');
    setAiFailed(false);
    const result = await aiAnalyzeIdea(asked, lang);
    if (!alive.current) return;
    setBusy(null);
    // Пока нейросеть думала, игрок мог переписать идею — тогда ответ уже не про неё.
    if (ideaRef.current !== asked) return;
    if (!result) return setAiFailed(true);
    setManual({ productType: result.productType, audienceId: result.audienceId, businessModel: result.businessModel });
    setReview({ strengths: result.strengths, risks: result.risks });
  }

  function begin() {
    if (!productType || !audienceId || !businessModel) return;
    start({
      // Начальное число берётся здесь, а не в ядре: ядро должно оставаться повторяемым.
      seed: Math.floor(Math.random() * 2 ** 31),
      companyName: name.trim() || t('new.defaultName'),
      idea,
      productType,
      audienceId,
      businessModel,
      goal,
      difficulty,
    });
  }

  return (
    <main className="ng">
      {/* Тот же рабочий стол, что на компьютере в квартире: игра начинается за ноутбуком. */}
      <div className="ng-wall" aria-hidden="true">
        <Landscape variant="dusk" id="newgame" />
      </div>
      <div className="ng-menubar" aria-hidden="true">
        <span className="ng-logo" />
        <b>{t('app.title')}</b>
        <span>{t('new.kicker')}</span>
      </div>
      <article className="ng-sheet">
        <div className="ng-titlebar">
          <span className="ng-lights" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          {t('new.kicker')}
        </div>
        <header className="ng-head">
          <h1>{t('new.title')}</h1>
          <p>{t('new.lead', { cash: money(diff.startCash) })}</p>
        </header>

        <section className="ng-idea">
          <textarea
            className="ng-idea-text"
            aria-label={t('new.ideaLabel')}
            value={idea}
            rows={3}
            maxLength={IDEA_MAX_LENGTH}
            placeholder={t('new.ideaPlaceholder')}
            onChange={(e) => writeIdea(e.target.value)}
          />
          <div className="ng-idea-foot">
            <button className="ng-link" disabled={busy !== null} onClick={() => (offersOpen ? setOffersOpen(false) : void suggest())}>
              {offersOpen ? t('new.hideIdeas') : t('new.noIdea')}
            </button>
            <span className="ng-count">
              {idea.length} / {IDEA_MAX_LENGTH}
            </span>
          </div>

          {offersOpen && (
            <div className="ng-offers">
              <div className="ng-themes">
                <button className={theme === null ? 'ng-tag on' : 'ng-tag'} disabled={busy !== null} onClick={() => void suggest(null)}>
                  {t('new.allThemes')}
                </button>
                {ideaThemes.map((id) => (
                  <button key={id} className={theme === id ? 'ng-tag on' : 'ng-tag'} disabled={busy !== null} onClick={() => void suggest(id)}>
                    {t(`new.themes.${id}`)}
                  </button>
                ))}
              </div>
              <p className="ng-note" aria-live="polite">
                {busy === 'ideas' ? t('new.aiThinking') : aiFailed && !fromAi ? t('new.aiIdeasFailed') : fromAi ? t('new.aiIdeasTitle') : t('new.ideasTitle')}
              </p>
              <div className={busy === 'ideas' ? 'ng-stickers waiting' : 'ng-stickers'}>
                {offers.map((offer) => (
                  <button key={offer.key} className="ng-sticker" disabled={busy !== null} onClick={() => takeIdea(offer)}>
                    <small>{offer.label}</small>
                    {offer.text}
                  </button>
                ))}
              </div>
              <button className="ng-link" disabled={busy !== null} onClick={() => void suggest()}>
                {t('new.moreIdeas')}
              </button>
            </div>
          )}
        </section>

        <section className="ng-reading">
          <h2>{t('new.readingTitle')}</h2>
          <p className="ng-note">{t(`new.${reading}`)}</p>
          <dl className="ng-fields">
            <div>
              <dt>{t('new.productType')}</dt>
              <dd>
                <select
                  aria-label={t('new.productType')}
                  value={productType ?? ''}
                  onChange={(e) => setManual({ productType: e.target.value as ProductTypeId, businessModel: manual.businessModel })}
                >
                  {!productType && <option value="">{t('new.choose')}</option>}
                  {TYPES.map((id) => (
                    <option key={id} value={id}>
                      {t(`productTypes.${id}.name`)}
                    </option>
                  ))}
                </select>
                {productType && <small>{t(`productTypes.${productType}.hint`)}</small>}
              </dd>
            </div>
            <div>
              <dt>{t('new.audience')}</dt>
              <dd>
                <select
                  aria-label={t('new.audience')}
                  value={audienceId ?? ''}
                  disabled={!productType}
                  onChange={(e) => setManual({ ...manual, productType: productType ?? undefined, audienceId: e.target.value })}
                >
                  {!productType && <option value="">—</option>}
                  {audiences.map((a) => (
                    <option key={a.id} value={a.id}>
                      {t(`audiences.${a.id}`)}
                    </option>
                  ))}
                </select>
              </dd>
            </div>
            <div>
              <dt>{t('new.businessModel')}</dt>
              <dd>
                <select
                  aria-label={t('new.businessModel')}
                  value={businessModel ?? ''}
                  disabled={!productType}
                  onChange={(e) => setManual({ ...manual, productType: productType ?? undefined, businessModel: e.target.value as BusinessModel })}
                >
                  {!productType && <option value="">—</option>}
                  {MODELS.map((id) => (
                    <option key={id} value={id}>
                      {t(`models.${id}.name`)}
                    </option>
                  ))}
                </select>
                {businessModel && <small>{t(`models.${businessModel}.hint`)}</small>}
              </dd>
            </div>
          </dl>
          {ai && hasText && (
            <div className="ng-review" aria-live="polite">
              {review ? (
                <div className="ng-review-note">
                  <p>
                    <b>{t('new.aiStrengths')}</b> {review.strengths}
                  </p>
                  <p>
                    <b>{t('new.aiRisks')}</b> {review.risks}
                  </p>
                </div>
              ) : (
                <button className="ng-link" disabled={busy !== null} onClick={() => void askReview()}>
                  {busy === 'review' ? t('new.aiThinking') : t('new.aiReview')}
                </button>
              )}
              {aiFailed && !offersOpen && <span className="ng-note">{t('new.aiReviewFailed')}</span>}
            </div>
          )}
        </section>

        <section className="ng-name">
          <h2>{t('new.name')}</h2>
          <div className="ng-name-row">
            <input value={name} maxLength={40} placeholder={t('new.defaultName')} aria-label={t('new.name')} onChange={(e) => setName(e.target.value)} />
            <button className="ng-link" onClick={() => setName(pick(nameParts.starts) + pick(nameParts.ends))}>
              {t('new.suggestName')}
            </button>
          </div>
        </section>

        <section>
          <h2>{t('new.difficulty')}</h2>
          <div className="ng-tabs">
            {DIFFICULTIES.map((id) => (
              <button key={id} className={id === difficulty ? 'ng-tab on' : 'ng-tab'} onClick={() => setDifficulty(id)}>
                <b>{t(`difficulties.${id}`)}</b>
                <small>{t(`new.difficultyHint.${id}`)}</small>
              </button>
            ))}
          </div>
          <p className="ng-receipt">
            {t('new.difficultyInfo', {
              cash: money(diff.startCash),
              living: money(diff.livingCostPerMonth),
              side: money(diff.sideJobIncomePerMonth),
            })}
          </p>
        </section>

        <section>
          <h2>{t('new.goal')}</h2>
          <div className="ng-tabs">
            {GOALS.map((id) => (
              <button key={id} className={id === goal ? 'ng-tab on' : 'ng-tab'} onClick={() => setGoal(id)}>
                <b>{t(`goals.${id}`)}</b>
              </button>
            ))}
          </div>
        </section>

        <footer className="ng-foot">
          <button className="ng-start" disabled={!productType} onClick={begin}>
            {t('new.start')}
          </button>
          {!productType && <span className="ng-note">{t('new.startBlocked')}</span>}
          {hasSave() && (
            <button className="ng-link" onClick={() => load()}>
              {t('new.load')}
            </button>
          )}
        </footer>
      </article>
    </main>
  );
}
