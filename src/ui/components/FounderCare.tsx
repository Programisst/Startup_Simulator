// Силы основателя: сколько осталось, как он работает, отдых и кофе.
import { useTranslation } from 'react-i18next';
import { content } from '../../content';
import { roomView } from '../../core';
import { num } from '../format';
import { useStore } from '../store';

export function FounderCare() {
  const { t } = useTranslation();
  const game = useStore((s) => s.game)!;
  const dispatch = useStore((s) => s.dispatch);
  const f = roomView(game, content).founder;
  const state = f.exhausted ? 'exhaustedState' : f.tired ? 'tiredState' : 'fresh';

  return (
    <div className="founder-care">
      <div className="meter" title={t('founderCare.restHint')}>
        <span>{t('founderCare.energy')}</span>
        <div className="meter-bar">
          <i className={f.tired ? 'low' : ''} style={{ width: `${f.energy}%` }} />
        </div>
        <span>{num(f.energy)}</span>
      </div>
      <p className={f.tired ? 'negative' : 'muted'}>
        {t(`founderCare.${state}`)}
        {f.tired && ` · ${t('founderCare.pace', { pct: num(f.pace * 100) })}`}
      </p>
      <div className="choices">
        <button disabled={game.resting === true} onClick={() => dispatch({ type: 'rest' })}>
          {game.resting ? t('founderCare.restingNow') : t('founderCare.rest')}
        </button>
        <button disabled={!f.coffeeReady} onClick={() => dispatch({ type: 'coffee' })} title={t('founderCare.coffeeHint')}>
          {t('founderCare.coffee')}
        </button>
      </div>
      {f.coffeeActive ? (
        <p className="muted">{t('founderCare.coffeeActive', { days: f.coffeeDaysLeft })}</p>
      ) : (
        !f.coffeeReady && <p className="muted">{t('founderCare.coffeeWait', { days: f.coffeeReadyInDays })}</p>
      )}
    </div>
  );
}
