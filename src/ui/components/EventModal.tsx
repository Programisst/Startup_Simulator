import { useTranslation } from 'react-i18next';
import { content } from '../../content';
import { usePersonName } from '../names';
import { useStore } from '../store';

export function EventModal() {
  const { t } = useTranslation();
  const game = useStore((s) => s.game)!;
  const dispatch = useStore((s) => s.dispatch);
  const nameOf = usePersonName();
  const def = content.events.find((e) => e.id === game.pendingEvent);
  if (!def) return null;
  // Событие о сотруднике: его имя подставляется в текст.
  const seed = game.eventLog[game.eventLog.length - 1]?.subjectNameSeed;
  const name = seed === undefined ? '' : nameOf(seed);
  // Развилка в разработке: подставляется название функции, над которой идёт работа.
  const task = game.tasks[0];
  const feature = task?.kind === 'feature' ? (task.featureId === 'core' ? t(`productTypes.${game.productType}.core`) : t(`features.${task.featureId}`)) : '';

  return (
    <div className={def.mood === 'good' ? 'overlay win' : 'overlay'}>
      {def.mood === 'good' && <div className="confetti" aria-hidden="true">{Array.from({ length: 28 }, (_, i) => <i key={i} />)}</div>}
      <div className={def.mood === 'good' ? 'modal win' : 'modal'}>
        <h2>{t(`events.${def.id}.title`, { name, feature })}</h2>
        <p>{t(`events.${def.id}.body`, { name, feature })}</p>
        <div className="choices">
          {def.choices.map((c) => (
            <button key={c.id} onClick={() => dispatch({ type: 'chooseEvent', choiceId: c.id })}>
              {t(`events.${def.id}.choices.${c.id}`)}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
