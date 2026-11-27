// Вся игра по одной ссылке: заставка → «Новая игра» → вечер и переписка с другом → утро первого дня.
// «Продолжить» сразу открывает сохранённую партию. Где рисовать нельзя (старый браузер, проверки) — обычный экран игры.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { hasSave } from '../save/storage';
import { App } from './App';
import { Intro } from './intro/Intro';
import { canDraw } from './office/GameRoom';
import { Opening } from './opening/Opening';
import { lastAnswers, quickSetup, sampleAnswers, wantedCity, wantsSkip } from './opening/quick';
import { useStore } from './store';
import './opening/curtain.css';

/** Сколько «День 1» стоит на тёмном экране, пока за ним открывается утро, и сколько длится рассвет. */
const CURTAIN_HOLD_MS = 1100;
const DAWN_MS = 2600;

export function Root() {
  const { t } = useTranslation();
  // Занавес «День 1»: тот же, что в конце сна, — за ним партия начинается, и квартира проступает рассветом.
  const [curtain, setCurtain] = useState<'on' | 'dawn' | null>(null);
  const game = useStore((s) => s.game);
  const roomBroken = useStore((s) => s.roomBroken);
  const start = useStore((s) => s.start);
  const load = useStore((s) => s.load);
  const drawable = useMemo(canDraw, []);
  const [stage, setStage] = useState<'intro' | 'opening'>('intro');
  const showStart = game === null && drawable && !roomBroken;

  // Партия закончилась (игрок вышел) — в следующий раз снова с заставки.
  useEffect(() => {
    if (game) setStage('intro');
  }, [game]);

  // Для разработчиков (npm run dev): сразу утро первого дня с готовой компанией, один раз за загрузку. Заставка и переписка — по ссылке ?story.
  const skip = useRef(import.meta.env.DEV && wantsSkip(window.location.search));
  useEffect(() => {
    if (!skip.current || !showStart) return;
    skip.current = false;
    setCurtain('dawn');
    start(quickSetup(lastAnswers(), sampleAnswers(t), Math.floor(Math.random() * 2 ** 31), wantedCity(window.location.search)));
  }, [showStart, start, t]);

  // Пока идёт заставка, квартира уже подгружается — после полёта она открывается без ожидания.
  useEffect(() => {
    if (showStart) void import('./isometric/IsometricOffice');
  }, [showStart]);

  useEffect(() => {
    if (curtain !== 'on' || !game) return;
    const id = window.setTimeout(() => setCurtain('dawn'), CURTAIN_HOLD_MS);
    return () => window.clearTimeout(id);
  }, [curtain, game]);
  useEffect(() => {
    if (curtain !== 'dawn') return;
    const id = window.setTimeout(() => setCurtain(null), DAWN_MS);
    return () => window.clearTimeout(id);
  }, [curtain]);

  if (!showStart)
    return (
      <>
        <App />
        {curtain && (
          <div className={`rt-curtain ${curtain}`} aria-hidden="true">
            <div className="rt-curtain-title">{t('opening.dayTitle')}</div>
            <div className="rt-curtain-sub">{t('opening.morning')}</div>
          </div>
        )}
      </>
    );
  if (stage === 'opening')
    return (
      <Opening
        onStart={(setup) => {
          setCurtain('on');
          start(setup);
        }}
      />
    );
  return (
    <Intro
      hasSave={hasSave()}
      onDone={(choice) => {
        if (choice === 'continue' && load()) return;
        setStage('opening');
      }}
    />
  );
}
