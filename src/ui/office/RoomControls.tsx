// Управление временем прямо в квартире: пауза, скорость, сохранение.
// Выглядит как остальные плашки квартиры, а не как строка меню.
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PixelIcon, type PixelIconName } from '../pixelIcons';
import { useStore, type Speed } from '../store';

const SPEEDS: Speed[] = [0, 1, 2, 5];
/** Пиксельные значки вместо надписей: пауза и одна, две, три стрелки. */
const GLYPH: Record<Speed, PixelIconName> = { 0: 'pause', 1: 'play', 2: 'fast', 5: 'fastest' };

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
            <PixelIcon name={GLYPH[sp]} />
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
        <PixelIcon name="disk" />
        {saved ? t('top.saved') : t('top.save')}
      </button>
    </>
  );
}
