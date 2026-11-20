import { useTranslation } from 'react-i18next';
import { content } from '../../content';
import { featuresOf, overload, type Task } from '../../core';
import { FounderCare } from '../components/FounderCare';
import { ReleasePanel } from '../components/ReleasePanel';
import { money, num } from '../format';
import { useStore } from '../store';

export function Product() {
  const { t } = useTranslation();
  const game = useStore((s) => s.game)!;
  const dispatch = useStore((s) => s.dispatch);
  const cfg = content.config;
  const defs = featuresOf(game, content);
  const core = defs.find((f) => f.core);
  const coreDone = !core || game.doneFeatures.includes(core.id);
  const hasPrice = game.businessModel === 'subscription' || game.businessModel === 'oneTime';
  const over = overload(game.users, game.capacity);

  const featureName = (id: string) =>
    id === 'core' ? t(`productTypes.${game.productType}.core`) : t(`features.${id}`);

  function taskLabel(task: Task): string {
    if (task.kind === 'feature') {
      const def = defs.find((f) => f.id === task.featureId);
      return `${featureName(task.featureId)} — ${num(task.progress)} / ${def?.cost ?? 0}`;
    }
    return t(`product.task.${task.kind}`);
  }

  return (
    <div className="screen">
      <div className="cards">
        <div className="card"><span>{t('metrics.quality')}</span><b>{num(game.quality)}</b><small>{t('product.qualityHint')}</small></div>
        <div className="card"><span>{t('metrics.bugs')}</span><b>{num(game.bugs)}</b><small>{t('product.bugsHint')}</small></div>
        <div className="card"><span>{t('metrics.debt')}</span><b>{num(game.debt)}</b><small>{t('product.debtHint')}</small></div>
      </div>

      {game.launched && <ReleasePanel />}

      {!game.launched && (
        <p className="notice">
          {coreDone ? t('product.readyToLaunch') : t('product.needCore')}{' '}
          <button className="primary" data-coach-target="launch" disabled={!coreDone} onClick={() => dispatch({ type: 'launch' })}>
            {t('product.launch')}
          </button>
        </p>
      )}

      <div className="two">
        <section className="panel">
          <h3>{t('product.queue')}</h3>
          <ul className="log">
            {game.tasks.length === 0 && <li className="muted">{t('product.queueEmpty')}</li>}
            {game.tasks.map((task, i) => (
              <li key={i} className="row">
                <span>{i === 0 ? '▶ ' : ''}{taskLabel(task)}</span>
                <button onClick={() => dispatch({ type: 'removeTask', index: i })}>{t('product.remove')}</button>
              </li>
            ))}
          </ul>
          <div className="choices">
            <button disabled={game.bugs <= 0} onClick={() => dispatch({ type: 'startBugfix' })}>{t('product.fixBugs')}</button>
            <button disabled={game.debt <= 0} onClick={() => dispatch({ type: 'startRefactor' })}>{t('product.refactor')}</button>
            <button disabled={!coreDone} onClick={() => dispatch({ type: 'startPolish' })}>{t('product.polish')}</button>
          </div>
          <label className="check">
            <input type="checkbox" checked={game.rush} onChange={(e) => dispatch({ type: 'setRush', rush: e.target.checked })} />
            {t('product.rush')}
          </label>

          <h3>{t('founderCare.title')}</h3>
          <FounderCare />

          <h3>{t('product.founderTime')}</h3>
          <div className="speeds">
            {cfg.sideJobShares.map((share) => (
              <button key={share} className={share === game.sideJobShare ? 'active' : ''} onClick={() => dispatch({ type: 'setSideJob', share })}>
                {num(share * 100)}%
              </button>
            ))}
          </div>
          <p className="muted">
            {t('product.sideJobInfo', {
              income: money(game.sideJobIncomePerMonth * game.sideJobShare),
              living: money(game.livingCostPerMonth),
            })}
          </p>
        </section>

        <section className="panel">
          <h3>{t('product.features')}</h3>
          {game.themeId && <p className="muted">{t('product.themeLine', { name: t(`new.themes.${game.themeId}`), note: t(`themeNotes.${game.themeId}`) })}</p>}
          <table>
            <thead>
              <tr><th>{t('product.feature')}</th><th>{t('product.cost')}</th><th>{t('product.value')}</th><th /></tr>
            </thead>
            <tbody>
              {defs.map((f) => {
                const done = game.doneFeatures.includes(f.id);
                const queued = game.tasks.some((task) => task.kind === 'feature' && task.featureId === f.id);
                return (
                  <tr key={f.id} className={done ? 'muted' : ''}>
                    <td>{featureName(f.id)}</td>
                    <td>{f.cost}</td>
                    <td>{f.value}</td>
                    <td>
                      {done ? t('product.done') : queued ? t('product.queued') : (
                        <button data-coach-target={f.core ? 'queueCore' : undefined} onClick={() => dispatch({ type: 'queueFeature', featureId: f.id })}>{t('product.add')}</button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      </div>

      <div className="two">
        <section className="panel">
          <h3>{t('product.servers')}</h3>
          <p className={over > 0 ? 'negative' : 'muted'}>
            {t(over > 0 ? 'product.overloaded' : 'product.load', { users: num(game.users), capacity: num(game.capacity) })}
          </p>
          <select value={game.capacity} onChange={(e) => dispatch({ type: 'setCapacity', capacity: Number(e.target.value) })}>
            {cfg.capacityTiers.map((cap) => (
              <option key={cap} value={cap}>
                {t('product.capacityOption', { capacity: num(cap), cost: money(cap * game.market.serverCostPerUser) })}
              </option>
            ))}
          </select>
        </section>

        {hasPrice && (
          <section className="panel">
            <h3>{t('product.price')}</h3>
            <p className="muted">{t('product.priceHint', { ref: money(game.market.priceRef) })}</p>
            <input
              type="number"
              min={0}
              step={1}
              value={game.price}
              onChange={(e) => dispatch({ type: 'setPrice', price: Number(e.target.value) })}
            />
          </section>
        )}
      </div>
    </div>
  );
}
