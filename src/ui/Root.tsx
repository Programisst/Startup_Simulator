// Вся игра по одной ссылке: заставка → «Новая игра» или «Продолжить» → квартира основателя.
// Где нарисовать заставку нельзя (старый браузер, проверки) — сразу обычный экран игры.
import { useEffect, useMemo } from 'react';
import { hasSave } from '../save/storage';
import { App } from './App';
import { Intro } from './intro/Intro';
import { enterGame } from './intro/enter';
import { canDraw } from './office/GameRoom';
import { useStore } from './store';

export function Root() {
  const game = useStore((s) => s.game);
  const roomBroken = useStore((s) => s.roomBroken);
  const drawable = useMemo(canDraw, []);
  const showIntro = game === null && drawable && !roomBroken;

  // Пока идёт заставка, квартира уже подгружается — после полёта она открывается без ожидания.
  useEffect(() => {
    if (showIntro) void import('./apartment/Apartment');
  }, [showIntro]);

  if (!showIntro) return <App />;
  // Начальное число партии берётся здесь, а не в ядре: ядро должно оставаться повторяемым.
  return <Intro hasSave={hasSave()} onDone={(choice) => enterGame(choice, Math.floor(Math.random() * 2 ** 31))} />;
}
