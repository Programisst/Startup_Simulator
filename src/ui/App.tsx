import { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Coach, useTutorialStep } from './components/Coach';
import { EndScreen } from './components/EndScreen';
import { EventModal } from './components/EventModal';
import { TopBar } from './components/TopBar';
import { GameRoom, has3D, SimpleRoom } from './office/GameRoom';
import { Finance } from './screens/Finance';
import { Marketing } from './screens/Marketing';
import { NewGame } from './screens/NewGame';
import { Overview } from './screens/Overview';
import { Product } from './screens/Product';
import { Team } from './screens/Team';
import { useStore, type ScreenId } from './store';

const SCREENS: ScreenId[] = ['office', 'overview', 'product', 'team', 'marketing', 'finance'];

export function App() {
  const { t } = useTranslation();
  const game = useStore((s) => s.game);
  const speed = useStore((s) => s.speed);
  const screen = useStore((s) => s.screen);
  const setScreen = useStore((s) => s.setScreen);
  const step = useStore((s) => s.step);
  const lastError = useStore((s) => s.lastError);
  const computerOpen = useStore((s) => s.computerOpen);
  const roomBroken = useStore((s) => s.roomBroken);
  // С 3D игра идёт в квартире, а меню компании — в компьютере. Без 3D — прежний вид с меню сбоку.
  const roomMode = useMemo(has3D, []) && !roomBroken;
  const tutorial = useTutorialStep(!roomMode);

  const running = game !== null && game.status === 'running' && game.pendingEvent === null && speed > 0;

  // Время идёт по таймеру: один игровой день за секунду на скорости ×1.
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(step, 1000 / speed);
    return () => clearInterval(timer);
  }, [running, speed, step]);

  if (!game) return <NewGame />;

  const overlays = (
    <>
      {game.status === 'running' && game.pendingEvent !== null && <EventModal />}
      {game.status !== 'running' && <EndScreen />}
    </>
  );

  if (roomMode) {
    return (
      <div className="layout room-mode" data-coach={tutorial ?? undefined}>
        <TopBar />
        <main className="content full">
          <GameRoom step={tutorial} />
        </main>
        {/* За компьютером подсказка показывается внутри его экрана. */}
        {!computerOpen && <Coach step={tutorial} />}
        {overlays}
      </div>
    );
  }

  return (
    <div className="layout" data-coach={tutorial ?? undefined}>
      <TopBar />
      <nav className="sidebar">
        {SCREENS.map((id) => (
          <button key={id} data-nav={id} className={id === screen ? 'active' : ''} onClick={() => setScreen(id)}>
            {t(`nav.${id}`)}
          </button>
        ))}
      </nav>
      <main className="content">
        <Coach step={tutorial} inline />
        {lastError && <p className="error">{t(`errors.${lastError}`)}</p>}
        {screen === 'office' && <SimpleRoom />}
        {screen === 'overview' && <Overview />}
        {screen === 'product' && <Product />}
        {screen === 'team' && <Team />}
        {screen === 'marketing' && <Marketing />}
        {screen === 'finance' && <Finance />}
      </main>
      {overlays}
    </div>
  );
}
