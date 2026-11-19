import { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Coach, useTutorialStep } from './components/Coach';
import { EndScreen } from './components/EndScreen';
import { EventModal } from './components/EventModal';
import { FeedToasts } from './components/Feed';
import { GoalCard, GoalToast } from './components/GoalCard';
import { Phone } from './components/Phone';
import { TopBar } from './components/TopBar';
import { canDraw, GameRoom } from './office/GameRoom';
import { FeedApp, GoalsApp, MailApp, SettingsApp } from './screens/Apps';
import { Bank } from './screens/Bank';
import { Finance } from './screens/Finance';
import { Marketing } from './screens/Marketing';
import { NewGame } from './screens/NewGame';
import { Overview } from './screens/Overview';
import { Product } from './screens/Product';
import { Team } from './screens/Team';
import { DAY_MS, useStore, type ScreenId } from './store';

/** Меню сбоку — только когда квартиру показать нельзя, поэтому «Офиса» в нём нет. */
const SCREENS: ScreenId[] = ['overview', 'product', 'team', 'marketing', 'finance', 'bank', 'feed', 'mail', 'goals', 'settings'];

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
  // Игра идёт в квартире, а меню компании — в компьютере. Если квартиру нарисовать нельзя — обычный вид с меню сбоку.
  const roomMode = useMemo(canDraw, []) && !roomBroken;
  const tutorial = useTutorialStep(!roomMode);

  const running = game !== null && game.status === 'running' && game.pendingEvent === null && speed > 0;

  // Время идёт по таймеру: на скорости ×1 игровой день длится DAY_MS.
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(step, DAY_MS / speed);
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
      <div className={computerOpen ? 'layout room-mode at-computer' : 'layout room-mode'} data-coach={tutorial ?? undefined}>
        <main className="content full">
          <GameRoom step={tutorial} />
        </main>
        {/* Друг пишет на телефон: в комнате и за компьютером (телефон лежит слева от монитора). */}
        <Phone step={tutorial} />
        <GoalToast />
        <FeedToasts />
        {overlays}
      </div>
    );
  }

  // Без квартиры вместо «Офиса» открывается сводка.
  const shown: ScreenId = screen === 'office' ? 'overview' : screen;

  return (
    <div className="layout" data-coach={tutorial ?? undefined}>
      <TopBar />
      <nav className="sidebar">
        {SCREENS.map((id) => (
          <button key={id} data-nav={id} className={id === shown ? 'active' : ''} onClick={() => setScreen(id)}>
            {t(`nav.${id}`)}
          </button>
        ))}
      </nav>
      <main className="content">
        <Coach step={tutorial} inline />
        <GoalCard variant="app" />
        <GoalToast />
        <FeedToasts />
        {lastError && <p className="error">{t(`errors.${lastError}`)}</p>}
        {shown === 'overview' && <Overview />}
        {shown === 'product' && <Product />}
        {shown === 'team' && <Team />}
        {shown === 'marketing' && <Marketing />}
        {shown === 'finance' && <Finance />}
        {shown === 'feed' && <FeedApp />}
        {shown === 'mail' && <MailApp />}
        {shown === 'goals' && <GoalsApp />}
        {shown === 'settings' && <SettingsApp />}
        {shown === 'bank' && <Bank />}
      </main>
      {overlays}
    </div>
  );
}
