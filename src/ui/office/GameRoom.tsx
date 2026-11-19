// Экран «Офис»: квартира основателя, привязанная к партии.
// Если на компьютере игрока нет 3D-графики, показывается прежняя рисованная комната.
import { Component, lazy, Suspense, useMemo, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { content } from '../../content';
import { roomView } from '../../core';
import type { RoomLink } from '../room3d/link';
import { useStore } from '../store';
import { OfficeScene } from './OfficeScene';

// Квартира тяжёлая (3D-библиотека), поэтому подгружается отдельно и только на этом экране.
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

/** Если квартира не загрузилась или 3D сломалось на ходу — показываем запасную комнату, а не пустой экран. */
class RoomGuard extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export function GameRoom() {
  const { t } = useTranslation();
  const game = useStore((s) => s.game)!;
  const speed = useStore((s) => s.speed);
  const step = useStore((s) => s.step);
  const supported = useMemo(has3D, []);
  const view = roomView(game, content);

  const featureName = (id: string) => (id === 'core' ? t(`productTypes.${game.productType}.core`) : t(`features.${id}`));
  const thought =
    view.activity === 'building' && view.task
      ? view.task.kind === 'feature'
        ? t('office.bubble.feature', { name: featureName(view.task.featureId ?? '') })
        : t(`office.bubble.${view.task.kind}`)
      : t(`office.bubble.${view.activity === 'building' ? 'idle' : view.activity}`);

  const simpleRoom = (
    <div className="screen office-fallback">
      <OfficeScene game={game} speed={speed} />
    </div>
  );
  if (!supported) return simpleRoom;

  const link: RoomLink = {
    date: { year: view.calendar.year, month: view.calendar.month, day: view.calendar.dayOfMonth },
    weekday: view.calendar.weekday,
    cash: game.cash,
    activity: view.activity,
    thought,
    status: t(`office.status.${view.activity}`),
    timeRuns: view.timeRuns && speed > 0,
    locked: !view.timeRuns,
    sleep: step,
  };

  return (
    <RoomGuard fallback={simpleRoom}>
      <Suspense fallback={<p className="muted office-loading">{t('office.loading')}</p>}>
        <Room3D link={link} />
      </Suspense>
    </RoomGuard>
  );
}
