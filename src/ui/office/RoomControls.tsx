// Управление временем прямо в квартире: пауза, скорость, сохранение.
// Выглядит как остальные плашки квартиры, а не как строка меню.
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { GoalCard } from '../components/GoalCard';
import { useStore, type Speed } from '../store';

const SPEEDS: Speed[] = [0, 1, 2, 5];
/** Значки вместо надписей: пауза и одна, две, три стрелки. */
const GLYPH: Record<Speed, string> = { 0: '❚❚', 1: '▶', 2: '▶▶', 5: '▶▶▶' };

export function RoomControls() {
  const { t } = useTranslation();
  const speed = useStore((s) => s.speed);
  const setSpeed = useStore((s) => s.setSpeed);
  const save = useStore((s) => s.save);
  const [saved, setSaved] = useState(false);

  return (
    <>
      <div className="lm-card lm-speed" role="group" aria-label={t('top.speed')}>
        {SPEEDS.map((sp) => (
          <button
            key={sp}
            type="button"
            data-coach-target={sp === 1 ? 'speed1' : undefined}
            className={sp === speed ? 'on' : ''}
            aria-pressed={sp === speed}
            aria-label={sp === 0 ? t('top.pause') : `×${sp}`}
            title={sp === 0 ? t('top.pause') : `×${sp}`}
            onClick={() => setSpeed(sp)}
          >
            {GLYPH[sp]}
          </button>
        ))}
      </div>
      <button
        type="button"
        className="lm-card lm-save"
        onClick={() => {
          if (!save()) return;
          setSaved(true);
          window.setTimeout(() => setSaved(false), 1600);
        }}
      >
        {saved ? t('top.saved') : t('top.save')}
      </button>
      <div className="lm-card lm-goal">
        <GoalCard variant="room" />
      </div>
    </>
  );
}
