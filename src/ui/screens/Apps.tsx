// Разделы, которые открываются значками нижней панели компьютера: сообщения, почта, заметки с целями, настройки.
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { content } from '../../content';
import { milestoneView } from '../../core';
import { FeedList } from '../components/Feed';
import { gameDate } from '../format';
import { usePersonName } from '../names';
import { useStore } from '../store';

/** Сообщения: полная лента. */
export function FeedApp() {
  const { t } = useTranslation();
  return (
    <div className="screen">
      <section className="panel">
        <h3>{t('apps.feed.title')}</h3>
        <p className="muted">{t('apps.feed.hint')}</p>
        <FeedList limit={40} />
      </section>
    </div>
  );
}

/** Почта: события как письма, с ответом игрока. */
export function MailApp() {
  const { t } = useTranslation();
  const game = useStore((s) => s.game)!;
  const nameOf = usePersonName();
  const featureName = (id?: string) => (!id ? '…' : id === 'core' ? t(`productTypes.${game.productType}.core`) : t(`features.${id}`));
  return (
    <div className="screen">
      <section className="panel">
        <h3>{t('apps.mail.title')}</h3>
        <p className="muted">{t('apps.mail.hint')}</p>
        <ul className="log mail">
          {game.eventLog.length === 0 && <li className="muted">{t('apps.mail.empty')}</li>}
          {[...game.eventLog].reverse().map((e, i) => {
            const vars = { name: e.subjectNameSeed === undefined ? '' : nameOf(e.subjectNameSeed), feature: featureName(e.featureId) };
            return (
              <li key={i}>
                <b>{t(`events.${e.eventId}.title`, vars)}</b>
                <span className="muted">{t('top.date', gameDate(e.day))}</span>
                <p>{t(`events.${e.eventId}.body`, vars)}</p>
                <span className="muted">{e.choiceId ? t('apps.mail.answer', { text: t(`events.${e.eventId}.choices.${e.choiceId}`) }) : t('apps.mail.waiting')}</span>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}

/** Заметки: вся лестница целей — что сделано, что сейчас, что впереди. */
export function GoalsApp() {
  const { t } = useTranslation();
  const game = useStore((s) => s.game)!;
  const view = milestoneView(game, content);
  const doneDay = new Map(view.done.map((m) => [m.id, m.day]));
  return (
    <div className="screen">
      <section className="panel">
        <h3>
          {t('apps.goals.title')} · {t('goalsLadder.count', { done: view.done.length, total: view.total })}
        </h3>
        <ul className="log goals-list">
          {content.milestones.map((m) => {
            const day = doneDay.get(m.id);
            const state = day !== undefined ? 'done' : view.current?.id === m.id ? 'now' : 'later';
            return (
              <li key={m.id} className={`goal-${state}`}>
                <span className="goal-mark" aria-hidden="true">
                  {state === 'done' ? '✓' : state === 'now' ? '→' : '·'}
                </span>
                <b>{t(`goalsLadder.items.${m.id}.title`)}</b>
                <span className="muted">{state === 'done' ? t('top.date', gameDate(day!)) : state === 'now' ? t(`goalsLadder.items.${m.id}.hint`) : t('apps.goals.later')}</span>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}

/** Настройки: сохранение, обучение, новая компания. */
export function SettingsApp() {
  const { t } = useTranslation();
  const save = useStore((s) => s.save);
  const quit = useStore((s) => s.quit);
  const tutorial = useStore((s) => s.tutorial);
  const restartTutorial = useStore((s) => s.restartTutorial);
  const [saved, setSaved] = useState(false);
  const [confirming, setConfirming] = useState(false);
  return (
    <div className="screen">
      <section className="panel">
        <h3>{t('apps.settings.title')}</h3>
        <div className="choices settings-list">
          <button onClick={() => setSaved(save())}>{saved ? t('apps.settings.saved') : t('apps.settings.save')}</button>
          <button disabled={tutorial} onClick={restartTutorial}>
            {tutorial ? t('apps.settings.tutorialOn') : t('apps.settings.tutorial')}
          </button>
          {confirming ? (
            <>
              <button className="primary" onClick={quit}>
                {t('apps.settings.quitConfirm')}
              </button>
              <button onClick={() => setConfirming(false)}>{t('apps.settings.cancel')}</button>
            </>
          ) : (
            <button onClick={() => setConfirming(true)}>{t('apps.settings.quit')}</button>
          )}
        </div>
        <p className="muted">{t('apps.settings.about')}</p>
      </section>
    </div>
  );
}
