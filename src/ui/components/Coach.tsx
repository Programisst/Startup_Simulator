// Подсказка обучения: одна короткая фраза о том, что сделать сейчас.
import { useTranslation } from 'react-i18next';
import { content } from '../../content';
import { featuresOf, roomView } from '../../core';
import { useStore } from '../store';
import { FriendAvatar } from '../opening/Avatar';
import { tutorialStep, type TutorialStep } from '../tutorial';
import './coach.css';

/** Текущий шаг обучения. menuAlwaysOpen — когда квартиры нет и меню компании всегда на экране. */
export function useTutorialStep(menuAlwaysOpen = false): TutorialStep | null {
  const game = useStore((s) => s.game);
  const active = useStore((s) => s.tutorial);
  const computerOpen = useStore((s) => s.computerOpen);
  const screen = useStore((s) => s.screen);
  const speed = useStore((s) => s.speed);
  const financeSeen = useStore((s) => s.financeSeen);
  if (!game) return null;
  const core = featuresOf(game, content).find((f) => f.core);
  return tutorialStep({
    active,
    running: game.status === 'running',
    computerOpen: computerOpen || menuAlwaysOpen,
    onProduct: screen === 'product',
    onMarketing: screen === 'marketing',
    onFinance: screen === 'finance',
    financeSeen,
    paused: speed === 0,
    coreQueued: game.tasks.some((task) => task.kind === 'feature' && task.featureId === core?.id),
    coreDone: !core || game.doneFeatures.includes(core.id),
    launched: game.launched,
    adsOn: game.adSpendPerDay > 0,
    earned: game.lastDay.revenue > 0 || game.paying > 0,
  });
}

export function Coach({ step, inline = false }: { step: TutorialStep | null; inline?: boolean }) {
  const { t } = useTranslation();
  const game = useStore((s) => s.game);
  const endTutorial = useStore((s) => s.endTutorial);
  if (!step || !game) return null;
  const view = roomView(game, content);

  return (
    // Подсказки пишет друг: как сообщение в мессенджере. Новый шаг — новое сообщение (заново выезжает).
    <aside key={step} className={inline ? 'coach friend inline' : 'coach friend'} role="status" aria-live="polite">
      <FriendAvatar size={inline ? 32 : 42} className="coach-avatar" />
      <div className="coach-body">
        <span className="coach-label">{t('coach.label')}</span>
        <p>
          {t(`coach.${step}`, {
            core: t(`productTypes.${game.productType}.core`),
            days: view.task?.daysLeft ?? 0,
          })}
        </p>
      </div>
      <button className={step === 'done' ? 'primary' : 'coach-skip'} onClick={endTutorial}>
        {t(step === 'done' ? 'coach.gotIt' : 'coach.skip')}
      </button>
    </aside>
  );
}
