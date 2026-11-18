import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { EndScreen } from './components/EndScreen';
import { EventModal } from './components/EventModal';
import { TopBar } from './components/TopBar';
import { Finance } from './screens/Finance';
import { Marketing } from './screens/Marketing';
import { NewGame } from './screens/NewGame';
import { Overview } from './screens/Overview';
import { Product } from './screens/Product';
import { useStore, type ScreenId } from './store';

const SCREENS: ScreenId[] = ['overview', 'product', 'marketing', 'finance'];

export function App() {
  const { t } = useTranslation();
  const game = useStore((s) => s.game);
  const speed = useStore((s) => s.speed);
  const screen = useStore((s) => s.screen);
  const setScreen = useStore((s) => s.setScreen);
  const step = useStore((s) => s.step);
  const lastError = useStore((s) => s.lastError);

  const running = game !== null && game.status === 'running' && game.pendingEvent === null && speed > 0;

  // Время идёт по таймеру: один игровой день за секунду на скорости ×1.
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(step, 1000 / speed);
    return () => clearInterval(timer);
  }, [running, speed, step]);

  if (!game) return <NewGame />;

  return (
    <div className="layout">
      <TopBar />
      <nav className="sidebar">
        {SCREENS.map((id) => (
          <button key={id} className={id === screen ? 'active' : ''} onClick={() => setScreen(id)}>
            {t(`nav.${id}`)}
          </button>
        ))}
      </nav>
      <main className="content">
        {lastError && <p className="error">{t(`errors.${lastError}`)}</p>}
        {screen === 'overview' && <Overview />}
        {screen === 'product' && <Product />}
        {screen === 'marketing' && <Marketing />}
        {screen === 'finance' && <Finance />}
      </main>
      {game.status === 'running' && game.pendingEvent !== null && <EventModal />}
      {game.status !== 'running' && <EndScreen />}
    </div>
  );
}
