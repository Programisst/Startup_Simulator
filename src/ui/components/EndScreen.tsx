import { useTranslation } from 'react-i18next';
import { valuation } from '../../core';
import { gameDate, money, num } from '../format';
import { usePersonName } from '../names';
import { useStore } from '../store';

export function EndScreen() {
  const { t } = useTranslation();
  const game = useStore((s) => s.game)!;
  const dispatch = useStore((s) => s.dispatch);
  const quit = useStore((s) => s.quit);
  const won = game.status === 'won';
  const nameOf = usePersonName();

  return (
    <div className="overlay">
      <div className="modal wide">
        <h2>{won ? t('end.wonTitle') : t('end.bankruptTitle')}</h2>
        <p>{t(won ? 'end.wonBody' : 'end.bankruptBody', { company: game.companyName, ...gameDate(game.day) })}</p>
        <div className="cards">
          <div className="card">
            <span>{t('metrics.users')}</span>
            <b>{num(game.users)}</b>
          </div>
          <div className="card">
            <span>{t('metrics.cash')}</span>
            <b>{money(game.cash)}</b>
          </div>
          <div className="card">
            <span>{t('metrics.valuation')}</span>
            <b>{money(valuation(game.months, game.users, game.market))}</b>
          </div>
        </div>
        <h3>{t('end.chronicle')}</h3>
        <ul className="log">
          {game.eventLog.length === 0 && <li>{t('overview.noEvents')}</li>}
          {game.eventLog.map((e, i) => (
            <li key={i}>
              <span className="muted">{t('top.date', gameDate(e.day))}</span> {t(`events.${e.eventId}.title`, { name: e.subjectNameSeed === undefined ? '' : nameOf(e.subjectNameSeed) })}
              {e.choiceId && <> — {t(`events.${e.eventId}.choices.${e.choiceId}`)}</>}
            </li>
          ))}
        </ul>
        <div className="choices">
          {won && <button onClick={() => dispatch({ type: 'continueAsSandbox' })}>{t('end.continue')}</button>}
          <button onClick={quit}>{t('end.newGame')}</button>
        </div>
      </div>
    </div>
  );
}
