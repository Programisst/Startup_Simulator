// Квартира основателя, привязанная к партии: главный вид игры.
// Если браузер не умеет рисовать на холсте или квартира сломалась, игра показывает обычное меню сбоку.
import { Component, lazy, Suspense, useRef, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { content } from '../../content';
import { roomView } from '../../core';
import type { RoomLink } from '../apartment/link';
import { num } from '../format';
import { useStore, type ScreenId } from '../store';
import type { TutorialStep } from '../tutorial';
import { CompanyApp } from './CompanyApp';
import { RoomControls } from './RoomControls';

// Квартира со всей графикой подгружается отдельным файлом: первый экран игры открывается быстрее.
const Apartment = lazy(() => import('../apartment/Apartment').then((m) => ({ default: m.Apartment })));

/** Сколько набранных знаков кода уходит в расчёт одной пачкой. */
const TYPED_BATCH = 12;

/** Какой раздел «Компании» открывает значок нижней панели компьютера. */
const DOCK_SCREENS: Record<string, ScreenId> = {
  files: 'overview',
  messenger: 'feed',
  mail: 'mail',
  notes: 'goals',
  bank: 'bank',
  settings: 'settings',
};

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
export class RoomGuard extends Component<{ children: ReactNode }, { failed: boolean }> {
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
  const dispatch = useStore((s) => s.dispatch);
  const setScreen = useStore((s) => s.setScreen);
  // Набранные знаки копятся и уходят в расчёт пачками, чтобы игра не пересчитывалась на каждую клавишу.
  const typed = useRef(0);
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
    onTyped: () => {
      typed.current += 1;
      if (typed.current >= TYPED_BATCH) {
        dispatch({ type: 'typeCode', chars: typed.current });
        typed.current = 0;
      }
    },
    onDockApp: (item) => {
      const target = DOCK_SCREENS[item];
      if (target) setScreen(target);
    },
    focusText: t('founderCare.focus', { pct: num(view.founder.focus * 100), boost: num(view.founder.focusBoost * 100) }),
    onComputer: setComputerOpen,
    pointAtDesk: step === 'goToComputer' || step === 'backToComputer',
  };

  return (
    <RoomGuard>
      <Suspense fallback={<p className="muted office-loading">{t('office.loading')}</p>}>
        <Apartment link={link} />
      </Suspense>
    </RoomGuard>
  );
}
