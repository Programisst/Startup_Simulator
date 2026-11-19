// Квартира основателя, привязанная к партии: главный вид игры.
// Если на компьютере игрока нет 3D-графики или квартира не загрузилась, игра показывает прежнюю рисованную комнату и меню сбоку.
import { Component, lazy, Suspense, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { content } from '../../content';
import { roomView } from '../../core';
import type { RoomLink } from '../room3d/link';
import { useStore } from '../store';
import type { TutorialStep } from '../tutorial';
import { CompanyApp } from './CompanyApp';
import { OfficeScene } from './OfficeScene';
import { RoomControls } from './RoomControls';

// Квартира тяжёлая (3D-библиотека), поэтому подгружается отдельным файлом.
const Room3D = lazy(() => import('../room3d/Room3D').then((m) => ({ default: m.Room3D })));

/** Умеет ли браузер рисовать 3D. */
export function has3D(): boolean {
  // Там, где 3D нет вовсе (например, в тестах), даже не пробуем создавать холст.
  if (typeof WebGLRenderingContext === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    return Boolean(canvas.getContext('webgl2') ?? canvas.getContext('webgl'));
  } catch {
    return false;
  }
}

/** Квартира сломалась на ходу — сообщаем игре, чтобы она вернула обычное меню. */
class RoomGuard extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    useStore.setState({ roomBroken: true, computerOpen: false });
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

/** Запасная рисованная комната. */
export function SimpleRoom() {
  const game = useStore((s) => s.game)!;
  const speed = useStore((s) => s.speed);
  return (
    <div className="screen">
      <OfficeScene game={game} speed={speed} />
    </div>
  );
}

export function GameRoom({ step }: { step: TutorialStep | null }) {
  const { t } = useTranslation();
  const game = useStore((s) => s.game)!;
  const speed = useStore((s) => s.speed);
  const stepDay = useStore((s) => s.step);
  const setComputerOpen = useStore((s) => s.setComputerOpen);
  const dispatch = useStore((s) => s.dispatch);
  const view = roomView(game, content);

  const featureName = (id: string) => (id === 'core' ? t(`productTypes.${game.productType}.core`) : t(`features.${id}`));
  const thought =
    view.activity === 'building' && view.task
      ? view.task.kind === 'feature'
        ? t('office.bubble.feature', { name: featureName(view.task.featureId ?? '') })
        : t(`office.bubble.${view.task.kind}`)
      : t(`office.bubble.${view.activity === 'building' ? 'idle' : view.activity}`);

  const link: RoomLink = {
    date: { year: view.calendar.year, month: view.calendar.month, day: view.calendar.dayOfMonth },
    weekday: view.calendar.weekday,
    cash: game.cash,
    daysToBankruptcy: view.alerts.daysToBankruptcy,
    controls: <RoomControls />,
    activity: view.activity,
    thought,
    status: t(`office.status.${view.activity}`),
    timeRuns: view.timeRuns && speed > 0,
    locked: !view.timeRuns,
    sleep: () => {
      dispatch({ type: 'rest' });
      stepDay();
    },
    energy: view.founder.energy,
    tired: view.founder.tired,
    coffee: () => {
      if (!view.founder.coffeeReady) return false;
      dispatch({ type: 'coffee' });
      return true;
    },
    companyApp: <CompanyApp step={step} />,
    onComputer: setComputerOpen,
  };

  return (
    <RoomGuard>
      <Suspense fallback={<p className="muted office-loading">{t('office.loading')}</p>}>
        <Room3D link={link} />
      </Suspense>
    </RoomGuard>
  );
}
