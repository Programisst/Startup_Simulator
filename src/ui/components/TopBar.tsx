import { useTranslation } from 'react-i18next';
import { gameDate, money } from '../format';
import { useStore, type Speed } from '../store';

const SPEEDS: Speed[] = [0, 1, 2, 5];

export function TopBar() {
  const { t } = useTranslation();
  const game = useStore((s) => s.game)!;
  const speed = useStore((s) => s.speed);
  const setSpeed = useStore((s) => s.setSpeed);
  const save = useStore((s) => s.save);

  return (
    <header className="topbar">
      <strong className="company">{game.companyName}</strong>
      <span className="date">{t('top.date', gameDate(game.day))}</span>
      <span className={game.cash < 0 ? 'cash negative' : 'cash'}>{money(game.cash)}</span>
      {game.negativeCashDays > 0 && (
        <span className="warning">{t('top.crisis', { days: 30 - game.negativeCashDays })}</span>
      )}
      <div className="speeds">
        {SPEEDS.map((sp) => (
          <button key={sp} data-coach-target={sp === 1 ? 'speed1' : undefined} className={sp === speed ? 'active' : ''} onClick={() => setSpeed(sp)}>
            {sp === 0 ? t('top.pause') : `×${sp}`}
          </button>
        ))}
      </div>
      <button onClick={() => save()}>{t('top.save')}</button>
    </header>
  );
}
