// Телефон основателя в квартире: друг пишет подсказки как сообщения — та же переписка, что была вечером на компьютере.
// Первое сообщение выдвигает телефон само; «Понял» — и телефон уезжает в значок. Новое сообщение — значок жужжит с цифрой.
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { content } from '../../content';
import { roomView } from '../../core';
import { FriendAvatar } from '../opening/Avatar';
import { useStore } from '../store';
import type { TutorialStep } from '../tutorial';
import { phoneAnswer, phoneClose, phoneOpen, phoneReceive, phoneStart, type PhoneMsg } from './phoneState';
import './phone.css';

/** Сначала рассветает (занавес «День 1»), потом друг пишет. */
const WAKE_MS = 2400;
/** Сколько друг «печатает» сообщение. */
const TYPING_MS = 1100;
/** Ответил — пауза, чтобы увидеть свой ответ, и телефон уезжает. */
const AWAY_MS = 700;
/** Телефон выезжает ~0,6 с — жужжит уже после. */
const BUZZ_DELAY_MS = 620;

export function Phone({ step, hidden }: { step: TutorialStep | null; hidden: boolean }) {
  const { t } = useTranslation();
  const game = useStore((s) => s.game);
  const endTutorial = useStore((s) => s.endTutorial);
  const [phone, setPhone] = useState(phoneStart);
  const [awake, setAwake] = useState(false);
  const [typing, setTyping] = useState(false);
  /** Больше нуля — телефон жужжит прямо сейчас; чётность перезапускает дрожь на каждое сообщение. */
  const [buzz, setBuzz] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const count = useRef(0);

  useEffect(() => {
    const id = window.setTimeout(() => setAwake(true), WAKE_MS);
    return () => window.clearTimeout(id);
  }, []);

  // Подсказка сменилась — друг пишет. Числа берём сейчас: сообщение остаётся таким, каким его написали.
  const core = game ? t(`productTypes.${game.productType}.core`) : '';
  const days = game ? (roomView(game, content).task?.daysLeft ?? 0) : 0;
  useEffect(() => {
    if (!awake) return;
    setPhone((s) => phoneReceive(s, step, { core, days }, !hidden));
    // Числа нужны только в момент, когда пришло новое сообщение.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, hidden, awake]);

  // Сел за компьютер — телефон убирается (подсказки там на экране).
  useEffect(() => {
    if (hidden) setPhone(phoneClose);
  }, [hidden]);

  // Новое сообщение друга: телефон жужжит, а если открыт — друг сначала «печатает».
  const friendCount = phone.msgs.filter((m) => m.from === 'friend').length;
  useEffect(() => {
    if (friendCount <= count.current) return;
    count.current = friendCount;
    if (hidden) return;
    // Жужжит, когда телефон уже выехал: иначе дрожь перебьёт плавный выезд.
    const ids = [window.setTimeout(() => setBuzz((n) => Math.abs(n) + 1), BUZZ_DELAY_MS), window.setTimeout(() => setBuzz((n) => -Math.abs(n)), BUZZ_DELAY_MS + 550)];
    if (phone.open) {
      setTyping(true);
      ids.push(window.setTimeout(() => setTyping(false), TYPING_MS));
    }
    return () => ids.forEach((id) => window.clearTimeout(id));
    // Срабатывает только на новое сообщение.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [friendCount]);

  useLayoutEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [phone.msgs.length, typing, phone.open]);

  if (!game) return null;

  const shown = typing ? phone.msgs.slice(0, -1) : phone.msgs;
  const last = phone.msgs.at(-1);
  // Отвечать можно, пока идёт обучение и последнее слово — за другом.
  const canAnswer = !typing && step !== null && last?.from === 'friend' && last.step === step;

  const answer = (key: string, end: boolean) => {
    setPhone((s) => phoneAnswer(s, key));
    window.setTimeout(() => {
      setPhone(phoneClose);
      if (end) endTutorial();
    }, AWAY_MS);
  };

  const textOf = (m: PhoneMsg) => (m.from === 'me' ? t(m.key) : t(`coach.${m.step}`, m.params));

  return (
    <div className="ph-wrap" hidden={hidden || phone.msgs.length === 0}>
      <section className={`ph${phone.open ? ' open' : ''}${buzz > 0 ? ` buzz${buzz % 2}` : ''}`} inert={!phone.open} aria-label={t('phone.title')}>
        <header className="ph-head">
          <FriendAvatar size={30} className="ph-avatar" />
          <div>
            <b>{t('coach.label')}</b>
            <span className={typing ? 'typing' : ''}>{typing ? t('phone.typing') : t('phone.online')}</span>
          </div>
          <button type="button" className="ph-x" aria-label={t('phone.hide')} onClick={() => setPhone(phoneClose)}>
            <svg viewBox="0 0 10 10" width="12" height="12" aria-hidden="true">
              <path d="M2 2l6 6M8 2l-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="square" />
            </svg>
          </button>
        </header>

        <div className="ph-list" ref={listRef} role="log" aria-live="polite">
          <div className="ph-day">{t('phone.yesterday')}</div>
          <div className="ph-msg friend old">
            <p>{t('opening.friend.byeSleep')}</p>
          </div>
          <div className="ph-day">{t('phone.today')}</div>
          {shown.map((m, i) => (
            <div key={i} className={`ph-msg ${m.from}${shown[i - 1]?.from === m.from ? ' cont' : ''}`}>
              <p>{textOf(m)}</p>
            </div>
          ))}
          {typing && (
            <div className="ph-msg friend ph-dots" aria-label={t('phone.typing')}>
              <i />
              <i />
              <i />
            </div>
          )}
        </div>

        <div className={`ph-quick${canAnswer ? ' shown' : ''}`}>
          {canAnswer && (
            <>
              <button type="button" className="ph-chip" onClick={() => answer('coach.gotIt', step === 'done')}>
                {t('coach.gotIt')}
              </button>
              {step !== 'done' && (
                <button type="button" className="ph-chip ghost" onClick={() => answer('coach.skip', true)}>
                  {t('coach.skip')}
                </button>
              )}
            </>
          )}
        </div>
        <i className="ph-home" aria-hidden="true" />
      </section>

      <button
        type="button"
        className={`ph-icon${phone.unread ? ' ring' : ''}`}
        hidden={phone.open}
        aria-label={phone.unread ? t('phone.unread', { count: phone.unread }) : t('phone.title')}
        onClick={() => setPhone(phoneOpen)}
      >
        <FriendAvatar size={24} className="ph-icon-face" />
        {phone.unread > 0 && <b>{phone.unread}</b>}
      </button>
    </div>
  );
}
