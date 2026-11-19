// Квартира основателя, привязанная к партии: главный вид игры.
// Если браузер не умеет рисовать на холсте или квартира сломалась, игра показывает обычное меню сбоку.
import { Component, lazy, Suspense, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { content } from '../../content';
import { roomView } from '../../core';
import type { RoomLink } from '../apartment/link';
import { useStore } from '../store';
import type { TutorialStep } from '../tutorial';
import { CompanyApp } from './CompanyApp';
import { RoomControls } from './RoomControls';

// Квартира со всей графикой подгружается отдельным файлом: первый экран игры открывается быстрее.
const Apartment = lazy(() => import('../apartment/Apartment').then((m) => ({ default: m.Apartment })));

/** Умеет ли браузер рисовать на холсте (в тестах — нет). */
export function canDraw(): boolean {
  if (typeof CanvasRenderingContext2D === 'undefined') return false;
  try {
    return document.createElement('canvas').getContext('2d') !== null;
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

export function GameRoom({ step }: { step: TutorialStep | null }) {
  const { t } = useTranslation();
  const game = useStore((s) => s.game)!;
  const speed = useStore((s) => s.speed);
  const stepDay = useStore((s) => s.step);
  const setComputerOpen = useStore((s) => s.setComputerOpen);
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
    sleep: stepDay,
    companyApp: <CompanyApp step={step} />,
    onComputer: setComputerOpen,
  };

  return (
    <RoomGuard>
      <Suspense fallback={<p className="muted office-loading">{t('office.loading')}</p>}>
        <Apartment link={link} />
      </Suspense>
    </RoomGuard>
  );
}
