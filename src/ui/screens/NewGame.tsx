// Создание компании: игрок записывает идею своими словами в «блокнот основателя»,
// игра по словам определяет тип продукта, аудиторию и способ заработка. Нет идеи — есть готовые подсказки.
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { content } from '../../content';
import { ideaLexicon, ideaSeeds, ideaThemes, nameParts, type IdeaSeed, type IdeaThemeId } from '../../content/ideas';
import { analyzeIdea, audienceForIdea, IDEA_MAX_LENGTH, modelForIdea, type BusinessModel, type DifficultyId, type GoalId, type ProductTypeId } from '../../core';
import { hasSave } from '../../save/storage';
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

/** Несколько случайных идей по теме, по возможности не те, что показаны сейчас. */
function drawIdeas(theme: IdeaThemeId | null, shown: IdeaSeed[]): IdeaSeed[] {
  const pool = ideaSeeds.filter((s) => theme === null || s.theme === theme);
  const fresh = pool.filter((s) => !shown.includes(s));
  const from = (fresh.length >= IDEAS_SHOWN ? fresh : pool).slice();
  const out: IdeaSeed[] = [];
  while (out.length < IDEAS_SHOWN && from.length > 0) out.push(from.splice(Math.floor(Math.random() * from.length), 1)[0]!);
  return out;
}

export function NewGame() {
  const { t } = useTranslation();
  const start = useStore((s) => s.start);
  const load = useStore((s) => s.load);

  const [idea, setIdea] = useState('');
  const [manual, setManual] = useState<Manual>({});
  const [theme, setTheme] = useState<IdeaThemeId | null>(null);
  const [offers, setOffers] = useState<IdeaSeed[]>([]);
  const [name, setName] = useState('');
  const [difficulty, setDifficulty] = useState<DifficultyId>('normal');
  const [goal, setGoal] = useState<GoalId>('profit');

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

  function writeIdea(text: string) {
    setIdea(text);
    // Игрок переписал идею — разбираем заново, прежние ручные поправки не держим.
    setManual({});
  }

  function takeIdea(seed: IdeaSeed) {
    setIdea(t(`new.ideas.${seed.id}`));
    setManual({ productType: seed.productType, audienceId: seed.audienceId, businessModel: seed.businessModel });
  }

  function suggest(nextTheme: IdeaThemeId | null = theme) {
    setTheme(nextTheme);
    setOffers((shown) => drawIdeas(nextTheme, shown));
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
      <article className="ng-sheet">
        <header className="ng-head">
          <span className="ng-kicker">
            {t('app.title')} · {t('new.kicker')}
          </span>
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
            <button className="ng-link" onClick={() => (offers.length > 0 ? setOffers([]) : suggest())}>
              {offers.length > 0 ? t('new.hideIdeas') : t('new.noIdea')}
            </button>
            <span className="ng-count">
              {idea.length} / {IDEA_MAX_LENGTH}
            </span>
          </div>

          {offers.length > 0 && (
            <div className="ng-offers">
              <div className="ng-themes">
                <button className={theme === null ? 'ng-tag on' : 'ng-tag'} onClick={() => suggest(null)}>
                  {t('new.allThemes')}
                </button>
                {ideaThemes.map((id) => (
                  <button key={id} className={theme === id ? 'ng-tag on' : 'ng-tag'} onClick={() => suggest(id)}>
                    {t(`new.themes.${id}`)}
                  </button>
                ))}
              </div>
              <p className="ng-note">{t('new.ideasTitle')}</p>
              <div className="ng-stickers">
                {offers.map((seed) => (
                  <button key={seed.id} className="ng-sticker" onClick={() => takeIdea(seed)}>
                    <small>{t(`new.themes.${seed.theme}`)}</small>
                    {t(`new.ideas.${seed.id}`)}
                  </button>
                ))}
              </div>
              <button className="ng-link" onClick={() => suggest()}>
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
