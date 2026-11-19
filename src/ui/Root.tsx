// Вся игра по одной ссылке: заставка → «Новая игра» → вечер и переписка с другом → утро первого дня.
// «Продолжить» сразу открывает сохранённую партию. Где рисовать нельзя (старый браузер, проверки) — обычный экран игры.
import { useEffect, useMemo, useState } from 'react';
import { hasSave } from '../save/storage';
import { App } from './App';
import { Intro } from './intro/Intro';
import { canDraw } from './office/GameRoom';
import { Opening } from './opening/Opening';
import { useStore } from './store';

export function Root() {
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

  // Пока идёт заставка, квартира уже подгружается — после полёта она открывается без ожидания.
  useEffect(() => {
    if (showStart) void import('./apartment/Apartment');
  }, [showStart]);

  if (!showStart) return <App />;
  if (stage === 'opening') return <Opening onStart={start} />;
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
