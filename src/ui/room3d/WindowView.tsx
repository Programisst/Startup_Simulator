// Вид из окна на весь экран: живой пиксельный город и мысль героя внизу.
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { CITY_H, CITY_W, CityView } from './cityView';

interface Props {
  /** Игровое время — от него зависят небо, свет в окнах и машины с фарами. */
  minutes: () => number;
  thought: string;
  closing: boolean;
  onClose: () => void;
  onClosed: () => void;
}

export function WindowView({ minutes, thought, closing, onClose, onClosed }: Props) {
  const { t } = useTranslation();
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const g = canvas?.getContext('2d');
    if (!canvas || !g) return;
    const city = new CityView();
    const start = performance.now();
    let raf = 0;
    let last = 0;
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      if (now - last < 1000 / 30) return; // 30 кадров в секунду достаточно для пикселей
      last = now;
      city.draw(g, minutes(), (now - start) / 1000);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [minutes]);

  useEffect(() => {
    if (!closing) return;
    const id = window.setTimeout(onClosed, 450);
    return () => window.clearTimeout(id);
  }, [closing, onClosed]);

  return (
    <div className={`r3-window${closing ? ' closing' : ''}`} onClick={onClose} role="dialog" aria-label={t('room.windowView.title')}>
      <canvas ref={ref} width={CITY_W} height={CITY_H} className="r3-window-canvas" />
      <div className="r3-window-thought">{thought}</div>
      <div className="r3-window-hint">
        <kbd>Esc</kbd> {t('room.windowView.leave')}
      </div>
    </div>
  );
}
