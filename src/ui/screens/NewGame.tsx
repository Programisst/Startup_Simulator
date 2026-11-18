import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { content } from '../../content';
import type { BusinessModel, DifficultyId, GoalId, ProductTypeId } from '../../core';
import { hasSave } from '../../save/storage';
import { money } from '../format';
import { useStore } from '../store';

const TYPES = Object.keys(content.productTypes) as ProductTypeId[];
const MODELS: BusinessModel[] = ['subscription', 'ads', 'oneTime', 'commission'];
const DIFFICULTIES: DifficultyId[] = ['easy', 'normal', 'hard'];
const GOALS: GoalId[] = ['profit', 'valuation', 'sandbox'];

export function NewGame() {
  const { t } = useTranslation();
  const start = useStore((s) => s.start);
  const load = useStore((s) => s.load);

  const [name, setName] = useState('');
  const [productType, setProductType] = useState<ProductTypeId>('saas');
  const [audienceId, setAudienceId] = useState(content.productTypes.saas.audiences[0]!.id);
  const [businessModel, setBusinessModel] = useState<BusinessModel>('subscription');
  const [difficulty, setDifficulty] = useState<DifficultyId>('normal');
  const [goal, setGoal] = useState<GoalId>('profit');

  const audiences = content.productTypes[productType].audiences;
  const diff = content.difficulties[difficulty];

  function chooseType(id: ProductTypeId) {
    setProductType(id);
    setAudienceId(content.productTypes[id].audiences[0]!.id);
  }

  function begin() {
    start({
      // Начальное число берётся здесь, а не в ядре: ядро должно оставаться повторяемым.
      seed: Math.floor(Math.random() * 2 ** 31),
      companyName: name.trim() || t('new.defaultName'),
      productType,
      audienceId,
      businessModel,
      goal,
      difficulty,
    });
  }

  return (
    <main className="newgame">
      <h1>{t('app.title')}</h1>
      <p className="muted">{t('new.intro')}</p>

      <section>
        <h3>{t('new.name')}</h3>
        <input value={name} maxLength={40} placeholder={t('new.defaultName')} onChange={(e) => setName(e.target.value)} />
      </section>

      <section>
        <h3>{t('new.productType')}</h3>
        <div className="options">
          {TYPES.map((id) => (
            <button key={id} className={id === productType ? 'option active' : 'option'} onClick={() => chooseType(id)}>
              <b>{t(`productTypes.${id}.name`)}</b>
              <span>{t(`productTypes.${id}.hint`)}</span>
            </button>
          ))}
        </div>
      </section>

      <section>
        <h3>{t('new.audience')}</h3>
        <div className="options">
          {audiences.map((a) => (
            <button key={a.id} className={a.id === audienceId ? 'option active' : 'option'} onClick={() => setAudienceId(a.id)}>
              <b>{t(`audiences.${a.id}`)}</b>
            </button>
          ))}
        </div>
      </section>

      <section>
        <h3>{t('new.businessModel')}</h3>
        <div className="options">
          {MODELS.map((id) => (
            <button key={id} className={id === businessModel ? 'option active' : 'option'} onClick={() => setBusinessModel(id)}>
              <b>{t(`models.${id}.name`)}</b>
              <span>{t(`models.${id}.hint`)}</span>
            </button>
          ))}
        </div>
      </section>

      <section>
        <h3>{t('new.difficulty')}</h3>
        <div className="options">
          {DIFFICULTIES.map((id) => (
            <button key={id} className={id === difficulty ? 'option active' : 'option'} onClick={() => setDifficulty(id)}>
              <b>{t(`difficulties.${id}`)}</b>
            </button>
          ))}
        </div>
        <p className="muted">
          {t('new.difficultyInfo', { cash: money(diff.startCash), living: money(diff.livingCostPerMonth) })}
        </p>
      </section>

      <section>
        <h3>{t('new.goal')}</h3>
        <div className="options">
          {GOALS.map((id) => (
            <button key={id} className={id === goal ? 'option active' : 'option'} onClick={() => setGoal(id)}>
              <b>{t(`goals.${id}`)}</b>
            </button>
          ))}
        </div>
      </section>

      <div className="choices">
        <button className="primary" onClick={begin}>
          {t('new.start')}
        </button>
        {hasSave() && <button onClick={() => load()}>{t('new.load')}</button>}
      </div>
    </main>
  );
}
