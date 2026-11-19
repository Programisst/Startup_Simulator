// Разговор основателя с сотрудником один на один. Реплики сотрудника пишет нейросеть,
// но чем разговор кончился в числах, решает расчёт игры: нейросеть только называет один из трёх исходов.
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { aiTalk } from '../../ai/client';
import { CHAT_LINE_MAX, revenue30Of, type ChatLine, type TalkOutcome, type TeamMemberView } from '../../core';
import { money, num } from '../format';
import { useStore } from '../store';

/** Сколько реплик основатель может сказать за один разговор. */
export const TALK_TURNS = 3;

interface Props {
  member: TeamMemberView;
  name: string;
  bio: string;
  quirk: string;
  onClose: () => void;
}

export function TalkChat({ member, name, bio, quirk, onClose }: Props) {
  const { t, i18n } = useTranslation();
  const game = useStore((s) => s.game)!;
  const dispatch = useStore((s) => s.dispatch);
  const [lines, setLines] = useState<ChatLine[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [result, setResult] = useState<TalkOutcome | null>(null);
  const outcome = useRef<TalkOutcome>('same');
  const alive = useRef(true);

  const said = lines.filter((l) => l.from === 'founder').length;
  const answered = lines.filter((l) => l.from === 'employee').length;
  const earlier = member.chat ?? [];

  /** Что происходит в компании — короткими фактами, которые сотрудник «знает». */
  function facts(): string[] {
    const f = (key: string, vars?: Record<string, unknown>) => t(`team.chat.facts.${key}`, vars);
    const out = [f('day', { months: Math.floor(game.day / 30) })];
    if (!game.launched) out.push(f('notLaunched'));
    else out.push(f('users', { users: num(game.users) }), f('revenue', { revenue: money(revenue30Of(game)) }));
    const lastMonth = game.months[game.months.length - 1];
    if (lastMonth) out.push(f(lastMonth.profit > 0 ? 'profit' : 'loss'));
    if (game.cash < 0) out.push(f('broke'));
    out.push(f(game.rush ? 'rush' : 'noRush'));
    const size = game.team?.employees.length ?? 1;
    out.push(size <= 1 ? f('alone') : f('team', { count: size }));
    if (game.launched && game.reputation >= 50) out.push(f('reputationGood'));
    if (game.launched && game.reputation < 25) out.push(f('reputationBad'));
    const pay = member.salary / member.salaryAsk;
    out.push(f(pay < 0.97 ? 'underpaid' : pay > 1.05 ? 'overpaid' : 'fairPay'), f('tenure', { days: game.day - member.hiredDay }));
    return out;
  }

  /** Разговор окончен: исход и реплики уходят в расчёт игры. */
  function finish(all: ChatLine[]) {
    dispatch({ type: 'talk', employeeId: member.id, outcome: outcome.current, lines: all });
    setResult(outcome.current);
  }

  async function say() {
    const message = draft.trim();
    if (!message || busy) return;
    const mine: ChatLine = { from: 'founder', text: message };
    const before = lines;
    setLines([...before, mine]);
    setDraft('');
    setBusy(true);
    setFailed(false);
    const answer = await aiTalk({
      lang: i18n.language === 'en' ? 'en' : 'ru',
      person: {
        name,
        role: t(`team.roles.${member.role}`),
        driver: `${t(`team.drivers.${member.driver}.name`)}. ${t(`team.drivers.${member.driver}.hint`)}`,
        trait: `${t(`team.traits.${member.trait}`)} — ${t(`team.traitHints.${member.trait}`)}`,
        mood: member.mood,
        bio,
        quirk,
      },
      company: { name: game.companyName, idea: game.idea ?? '', facts: facts() },
      history: [...earlier, ...before],
      message,
    });
    if (!alive.current) return;
    setBusy(false);
    if (!answer) {
      // Ответа нет: реплика основателя не засчитывается, можно сказать её ещё раз.
      setLines(before);
      setDraft(message);
      setFailed(true);
      return;
    }
    outcome.current = answer.outcome;
    const all: ChatLine[] = [...before, mine, { from: 'employee', text: answer.reply }];
    setLines(all);
    if (said + 1 >= TALK_TURNS) finish(all);
  }

  return (
    <div className="talk" ref={(el) => void (alive.current = el !== null)}>
      <b>
        {t('team.chat.title')} · {name}
      </b>
      {earlier.length > 0 && lines.length === 0 && (
        <details className="talk-earlier">
          <summary>{t('team.chat.earlier')}</summary>
          {earlier.map((l, i) => (
            <p key={i} className={`talk-line talk-${l.from}`}>
              <span>{l.from === 'founder' ? t('team.chat.you') : name}:</span> {l.text}
            </p>
          ))}
        </details>
      )}
      <div className="talk-lines" aria-live="polite">
        {lines.map((l, i) => (
          <p key={i} className={`talk-line talk-${l.from}`}>
            <span>{l.from === 'founder' ? t('team.chat.you') : name}:</span> {l.text}
          </p>
        ))}
        {busy && (
          <p className="talk-line talk-employee muted">
            <span>{name}:</span> {t('team.chat.thinking')}
          </p>
        )}
      </div>

      {result ? (
        <>
          <p className={`talk-result talk-${result}`}>{t(`team.chat.outcome.${result}`)}</p>
          <button onClick={onClose}>{t('team.chat.finish')}</button>
        </>
      ) : (
        <>
          <textarea
            className="talk-input"
            value={draft}
            rows={2}
            maxLength={CHAT_LINE_MAX}
            placeholder={t('team.chat.placeholder')}
            aria-label={t('team.chat.placeholder')}
            disabled={busy}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void say();
              }
            }}
          />
          {failed && <p className="negative">{t('team.chat.failed')}</p>}
          <div className="row">
            <small className="muted">{answered === 0 ? t('team.chat.hint') : t('team.chat.turnsLeft', { count: TALK_TURNS - said })}</small>
            <span className="choices">
              <button className="primary" data-talk-send disabled={busy || draft.trim().length === 0} onClick={() => void say()}>
                {t('team.chat.send')}
              </button>
              {/* Пока сотрудник ничего не ответил, разговора не было — его можно отложить без последствий. */}
              <button data-talk-end disabled={busy} onClick={() => (answered > 0 ? finish(lines) : onClose())}>
                {answered > 0 ? t('team.chat.finish') : t('team.chat.cancel')}
              </button>
            </span>
          </div>
        </>
      )}
    </div>
  );
}
