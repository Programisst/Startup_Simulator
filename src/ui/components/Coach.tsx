// Подсказка обучения: одна короткая фраза о том, что сделать сейчас.
import { useTranslation } from 'react-i18next';
import { content } from '../../content';
import { featuresOf, roomView } from '../../core';
import { useStore } from '../store';
import { tutorialStep, type TutorialStep } from '../tutorial';

/** Текущий шаг обучения. menuAlwaysOpen — когда квартиры нет и меню компании всегда на экране. */
export function useTutorialStep(menuAlwaysOpen = false): TutorialStep | null {
  const game = useStore((s) => s.game);
  const active = useStore((s) => s.tutorial);
  const computerOpen = useStore((s) => s.computerOpen);
  const screen = useStore((s) => s.screen);
  const speed = useStore((s) => s.speed);
  if (!game) return null;
  const core = featuresOf(game, content).find((f) => f.core);
  return tutorialStep({
    active,
    running: game.status === 'running',
    computerOpen: computerOpen || menuAlwaysOpen,
    onProduct: screen === 'product',
    paused: speed === 0,
    coreQueued: game.tasks.some((task) => task.kind === 'feature' && task.featureId === core?.id),
    coreDone: !core || game.doneFeatures.includes(core.id),
    launched: game.launched,
  });
}

export function Coach({ step, inline = false }: { step: TutorialStep | null; inline?: boolean }) {
  const { t } = useTranslation();
  const game = useStore((s) => s.game);
  const endTutorial = useStore((s) => s.endTutorial);
  if (!step || !game) return null;
  const view = roomView(game, content);

  return (
    <aside className={inline ? 'coach inline' : 'coach'} role="status" aria-live="polite">
      <span className="coach-label">{t('coach.label')}</span>
      <p>
        {t(`coach.${step}`, {
          core: t(`productTypes.${game.productType}.core`),
          days: view.task?.daysLeft ?? 0,
        })}
      </p>
      <button className={step === 'done' ? 'primary' : 'coach-skip'} onClick={endTutorial}>
        {t(step === 'done' ? 'coach.gotIt' : 'coach.skip')}
      </button>
    </aside>
  );
}
