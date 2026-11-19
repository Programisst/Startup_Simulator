// Квартира основателя, привязанная к партии: главный вид игры.
// Если браузер не умеет рисовать на холсте или квартира сломалась, игра показывает обычное меню сбоку.
import { Component, lazy, Suspense, useRef, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { content } from '../../content';
import { milestoneView, roomView } from '../../core';
import type { RoomLink } from '../apartment/link';
import { money, num } from '../format';
import { usePersonName } from '../names';
import { useStore, type ScreenId } from '../store';
import type { TutorialStep } from '../tutorial';
import { CompanyApp } from './CompanyApp';
import { RoomControls } from './RoomControls';

// Квартира со всей графикой подгружается отдельным файлом: первый экран игры открывается быстрее.
const Apartment = lazy(() => import('../apartment/Apartment').then((m) => ({ default: m.Apartment })));

/** Сколько набранных знаков кода уходит в расчёт одной пачкой. */
const TYPED_BATCH = 3;

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
  const nameOf = usePersonName();
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

  // Глава и цель для сцены: напарник решает, как их показать (стикер на доске, смена обстановки).
  const goals = milestoneView(game, content);
  const goalDef = goals.current ? content.milestones.find((m) => m.id === goals.current!.id) : undefined;
  const asMoney = goalDef?.progress?.metric === 'revenue30';
  const showValue = (x: number) => (asMoney ? money(x) : num(x));
  const goalForScene = goals.current
    ? {
        id: goals.current.id,
        title: t(`goalsLadder.items.${goals.current.id}.title`),
        hint: t(`goalsLadder.items.${goals.current.id}.hint`),
        share: goalDef?.progress ? goals.current.share : 0,
        progress: goalDef?.progress ? t('goalsLadder.progress', { value: showValue(Math.min(goals.current.value, goals.current.target)), target: showValue(goals.current.target) }) : '',
        reward: t('goalsLadder.reward', { value: goals.current.cashReward > 0 ? money(goals.current.cashReward) : t('goalsLadder.rewardFame') }),
      }
    : null;

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
    fatigue: view.founder.fatigue,
    pace: view.founder.pace,
    chapter: { ...goals.chapter, title: t(`goalsLadder.chapters.${goals.chapter.id}`) },
    goal: goalForScene,
    coffee: () => {
      if (!view.founder.coffeeReady) return false;
      dispatch({ type: 'coffee' });
      return true;
    },
    companyApp: <CompanyApp />,
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
    // Плашка в редакторе: игрок видит, как его набор двигает задачу прямо сейчас.
    focusText: view.task
      ? t(view.founder.typedBoost >= view.founder.typedCap ? 'founderCare.typingMax' : 'founderCare.typing', { pct: num(view.task.progress * 100), boost: num(view.founder.typedBoost * 100) })
      : t('founderCare.typingIdle'),
    onComputer: setComputerOpen,
    pointAtDesk: step === 'goToComputer' || step === 'backToComputer' || step === 'openMarketing' || step === 'openFinance',
    // Команда для сцены: кто на каком месте, занят ли, в каком настроении. Как это нарисовать, решает напарник.
    team: {
      office: { ...view.team.office, title: t(`office.tiers.${view.team.office.id}`) },
      people: view.team.people.map((p) => ({
        id: p.id,
        name: nameOf(p.nameSeed),
        nameSeed: p.nameSeed,
        role: p.role,
        roleTitle: t(`team.roles.${p.role}`),
        seat: p.seat,
        busy: p.busy,
        mood: p.mood,
        leaving: p.leaving,
        quote: t(`team.quotes.${p.driver}.${p.mood}`),
      })),
      freeSeats: view.team.freeSeats,
    },
  };

  return (
    <RoomGuard>
      <Suspense fallback={<p className="muted office-loading">{t('office.loading')}</p>}>
        <Apartment link={link} />
      </Suspense>
    </RoomGuard>
  );
}
