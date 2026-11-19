// Мессенджер на компьютере основателя: переписка с другом после заставки.
// Реплики друга появляются по одной, с «печатает…»; отвечать можно своими словами или кнопками.
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { money } from '../format';
import { FriendAvatar as Avatar } from './Avatar';
import { quickReplies, type ChatState, type Line } from './chat';
import { lastAnswers, rememberAnswer, sampleAnswers, type Typed } from './quick';
import './messenger.css';

interface Props {
  chat: ChatState;
  onReply: (text: string) => void;
  onChoose: (id: string) => void;
  /** Все сообщения уже на экране (друг ничего не допечатывает). */
  onSettled: (settled: boolean) => void;
}

/** Шаги, на которых игрок пишет сам. */
const TYPED_STAGES = new Set(['idea', 'audience', 'name']);

/** Сколько друг «печатает» реплику: чем длиннее, тем дольше, но без долгих пауз. */
function typingMs(text: string): number {
  return Math.min(2300, 520 + text.length * 20);
}

export function Messenger({ chat, onReply, onChoose, onSettled }: Props) {
  const { t } = useTranslation();
  const [shown, setShown] = useState(0);
  const [draft, setDraft] = useState('');
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const settledRef = useRef(onSettled);
  settledRef.current = onSettled;

  /** Числа в репликах — это деньги: показываем их как деньги. */
  const fmt = (params?: Record<string, number>) => Object.fromEntries(Object.entries(params ?? {}).map(([k, v]) => [k, money(v)]));
  const textOf = (l: Line) => l.text ?? t(l.key ?? '', fmt(l.params));
  const next = chat.lines[shown];

  // Реплики появляются по очереди: свои — сразу, друга — после «печатает…».
  useEffect(() => {
    if (!next) {
      settledRef.current(true);
      return;
    }
    settledRef.current(false);
    if (next.from === 'me') {
      setShown((n) => n + 1);
      return;
    }
    // Живая реплика ещё ждёт нейросеть — друг «печатает», пока она не придёт.
    if (next.live) return;
    const id = window.setTimeout(() => setShown((n) => n + 1), typingMs(textOf(next)));
    return () => window.clearTimeout(id);
    // textOf зависит только от t
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shown, chat.lines.length, next]);

  const ready = !next;
  const canType = ready && TYPED_STAGES.has(chat.stage);
  const options = ready ? quickReplies(chat) : [];
  const typing = next?.from === 'friend' || chat.stage === 'thinking';

  // Новое сообщение или выехали кнопки-ответы (список стал ниже) — плавно прокручиваем вниз.
  useLayoutEffect(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    // Кнопки выезжают 0,35 с — докручиваем, когда они встали на место.
    const id = window.setTimeout(() => el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' }), 380);
    return () => window.clearTimeout(id);
  }, [shown, options.length]);

  useEffect(() => {
    if (!canType) return;
    // Для разработчиков: в поле уже стоит прошлый ответ (или образец) — достаточно нажать Enter.
    if (import.meta.env.DEV) {
      const stage = chat.stage as Typed;
      setDraft(lastAnswers()[stage] ?? sampleAnswers(t)[stage]);
      window.setTimeout(() => inputRef.current?.select(), 0);
    }
    inputRef.current?.focus();
    // Подставляем один раз на каждый вопрос, не на каждую перерисовку.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canType, chat.stage, chat.lines.length]);

  const send = () => {
    if (!canType || !draft.trim()) return;
    if (import.meta.env.DEV) rememberAnswer(chat.stage as Typed, draft.trim());
    onReply(draft);
    setDraft('');
  };

  const visible = chat.lines.slice(0, shown);
  const lastFriend = [...visible].reverse().find((l) => l.from === 'friend');

  return (
    <div className="ms-app">
      <aside className="ms-chats">
        <div className="ms-chats-title">{t('opening.appTitle')}</div>
        <div className="ms-chat active">
          <Avatar size={38} />
          <div>
            <b>{t('opening.friendName')}</b>
            <span>{typing ? t('opening.typing') : lastFriend ? textOf(lastFriend) : ''}</span>
          </div>
        </div>
        {(t('opening.chats', { returnObjects: true }) as { name: string; last: string }[]).map((c) => (
          <div className="ms-chat" key={c.name}>
            <span className="ms-avatar ms-avatar-plain">{c.name[0]}</span>
            <div>
              <b>{c.name}</b>
              <span>{c.last}</span>
            </div>
          </div>
        ))}
      </aside>

      <section className="ms-talk">
        <header className="ms-head">
          <Avatar size={42} />
          <div>
            <b>{t('opening.friendName')}</b>
            <span className={typing ? 'typing' : ''}>{typing ? t('opening.typing') : t('opening.online')}</span>
          </div>
        </header>

        <div className="ms-list" ref={listRef}>
          {visible.map((l, i) => {
            const prev = visible[i - 1];
            return (
              <div key={i} className={`ms-msg ${l.from}${prev?.from === l.from ? ' cont' : ''}`}>
                <p>{textOf(l)}</p>
              </div>
            );
          })}
          {typing && (
            <div className="ms-msg friend ms-dots" aria-label={t('opening.typing')}>
              <i />
              <i />
              <i />
            </div>
          )}
        </div>

        <div className={`ms-quick${options.length ? ' shown' : ''}`}>
          {options.map((o, i) => (
            <button key={o.id} type="button" className="ms-chip" style={{ animationDelay: `${i * 60}ms` }} onClick={() => onChoose(o.id)}>
              {t(o.key, fmt(o.params))}
            </button>
          ))}
        </div>

        <form
          className={`ms-input${canType ? '' : ' off'}`}
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
        >
          <input
            ref={inputRef}
            value={draft}
            maxLength={300}
            disabled={!canType}
            placeholder={t('opening.placeholder')}
            onChange={(e) => setDraft(e.target.value)}
          />
          <button type="submit" disabled={!canType || !draft.trim()} aria-label={t('opening.send')}>
            <svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true">
              <path d="M3 10h11M10 4l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="square" />
            </svg>
          </button>
        </form>
      </section>
    </div>
  );
}
