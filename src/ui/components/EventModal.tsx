import { useTranslation } from 'react-i18next';
import { content } from '../../content';
import { useStore } from '../store';

export function EventModal() {
  const { t } = useTranslation();
  const game = useStore((s) => s.game)!;
  const dispatch = useStore((s) => s.dispatch);
  const def = content.events.find((e) => e.id === game.pendingEvent);
  if (!def) return null;

  return (
    <div className="overlay">
      <div className="modal">
        <h2>{t(`events.${def.id}.title`)}</h2>
        <p>{t(`events.${def.id}.body`)}</p>
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
