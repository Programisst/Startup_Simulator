// Экран команды: кого можно нанять, кто уже работает, сколько это стоит.
// Все числа берутся из ядра (teamView); экран только показывает их и отправляет команды.
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { aiAvailable } from '../../ai/client';
import { content } from '../../content';
import { officeView, teamView, type Candidate, type TeamMemberView } from '../../core';
import { HeadhuntPanel } from '../components/HeadhuntPanel';
import { TalkChat } from '../components/TalkChat';
import { dec, gameDate, money, num } from '../format';
import { usePersonName } from '../names';
import { useStore } from '../store';

/** Словами о навыке: число игроку мало что говорит. */
function skillLevel(skill: number): 'junior' | 'middle' | 'senior' | 'star' {
  // Границы стоят на «…5», чтобы подпись не расходилась с навыком, округлённым до десятых.
  return skill < 0.75 ? 'junior' : skill < 1.15 ? 'middle' : skill < 1.45 ? 'senior' : 'star';
}

function Avatar({ seed, name }: { seed: number; name: string }) {
  const initials = name
    .split(' ')
    .map((part) => part[0] ?? '')
    .join('');
  return (
    <span className="avatar" style={{ background: `hsl(${(seed * 47) % 360} 45% 38%)` }} aria-hidden="true">
      {initials}
    </span>
  );
}

/** Сколько пустых мест рисовать; остальные — строкой «и ещё …». */
const SEATS_SHOWN = 6;

export function Team() {
  const { t } = useTranslation();
  const game = useStore((s) => s.game)!;
  const dispatch = useStore((s) => s.dispatch);
  const [firing, setFiring] = useState<number | null>(null);
  const [confirming, setConfirming] = useState<number | null>(null);
  // С кем сейчас идёт разговор. Настоящий разговор возможен, только когда доступна нейросеть.
  const [talkingTo, setTalkingTo] = useState<number | null>(null);
  const [ai, setAi] = useState(false);
  useEffect(() => {
    let alive = true;
    void aiAvailable().then((ok) => {
      if (alive) setAi(ok);
    });
    return () => {
      alive = false;
    };
  }, []);
  const view = teamView(game, content);
  const cfg = content.config.team;
  const office = officeView(game, content.config);
  const free = Math.max(0, office.current.seats - view.members.length);

  const nameOf = usePersonName();
  const bios = t('team.bios', { returnObjects: true }) as string[];
  const quirks = t('team.quirks', { returnObjects: true }) as string[];
  /** Биография и привычка подбираются по тому же числу, что и имя, — у человека они всегда одни и те же. */
  const bioOf = (seed: number) => bios[(seed * 7) % bios.length];
  const quirkOf = (seed: number) => quirks[(seed * 13 + 5) % quirks.length];

  /** Что человек даёт компании при обычной мотивации. */
  function benefit(p: Pick<Candidate, 'role' | 'skill' | 'trait'>): string {
    const out = p.skill * (p.trait === 'diligent' ? 1 + cfg.diligentBonus : 1);
    return p.role === 'developer'
      ? t('team.benefitDeveloper', { work: dec(out) })
      : t('team.benefitMarketer', { pct: num(Math.min(cfg.marketingCap, out * cfg.marketingPerPoint) * 100) });
  }

  function person(p: Candidate) {
    const name = nameOf(p.nameSeed);
    return (
      <div className="person-head">
        <Avatar seed={p.nameSeed} name={name} />
        <div>
          <b>{name}</b>
          <span>
            {t(`team.roles.${p.role}`)} · {t(`team.skill.${skillLevel(p.skill)}`)} ({dec(p.skill)})
          </span>
          <span title={t(`team.traitHints.${p.trait}`)}>
            {t(`team.traits.${p.trait}`)} — {t(`team.traitHints.${p.trait}`)}
          </span>
          <span title={t(`team.drivers.${p.driver ?? 'money'}.hint`)}>{t(`team.drivers.${p.driver ?? 'money'}.name`)}</span>
        </div>
      </div>
    );
  }

  function trend(m: TeamMemberView): string {
    const diff = m.motivationTarget - m.motivation;
    return diff > 2 ? t('team.rising') : diff < -2 ? t('team.falling') : t('team.steady');
  }

  const monthsOfPayroll = view.payrollPerMonth > 0 ? game.cash / view.payrollPerMonth : Infinity;

  return (
    <div className="screen">
      <div className="cards">
        <div className="card">
          <span>{t('team.size')}</span>
          <b>
            {view.size} / {view.maxSize}
          </b>
          <small>{t(`office.tiers.${office.current.id}`)}</small>
        </div>
        <div className="card">
          <span>{t('team.payroll')}</span>
          <b>{money(view.payrollPerMonth)}</b>
          <small>{t('team.payrollHint')}</small>
        </div>
        <div className="card">
          <span>{t('team.work')}</span>
          <b>{dec(view.workPerDay)}</b>
          <small>{t('team.workHint', { founder: dec(view.founderWorkPerDay) })}</small>
        </div>
        <div className="card">
          <span>{t('team.marketing')}</span>
          <b>+{num((view.marketingBoost - 1) * 100)}%</b>
          <small>{t('team.marketingHint')}</small>
        </div>
      </div>

      {view.size > 0 && monthsOfPayroll < 3 && <p className="notice">{t(game.cash < 0 ? 'team.warnBroke' : 'team.warnPayroll')}</p>}

      <section className="panel office-panel">
        <h3>{t('office.panel.title')}</h3>
        <div className="row">
          <div>
            <b>{t('office.panel.now', { name: t(`office.tiers.${office.current.id}`), seats: office.current.seats })}</b>
            <p className="muted">{office.current.rentPerMonth > 0 ? t('office.panel.rent', { rent: money(office.current.rentPerMonth) }) : t('office.panel.free')}</p>
          </div>
          {office.next ? (
            <div className="office-next">
              <span>{t('office.panel.next', { name: t(`office.tiers.${office.next.id}`), seats: office.next.seats })}</span>
              <span className="muted">{t('office.panel.cost', { cost: money(office.next.moveCost), rent: money(office.next.rentPerMonth) })}</span>
              <button className="primary" disabled={!office.canAfford} onClick={() => dispatch({ type: 'moveOffice' })}>
                {t('office.panel.move')}
              </button>
              {!office.canAfford && <span className="negative">{t('office.panel.cantAfford', { gap: money(office.next.moveCost - game.cash) })}</span>}
            </div>
          ) : (
            <span className="muted">{t('office.panel.last')}</span>
          )}
        </div>
      </section>

      <div className="two">
        <section className="panel">
          <h3>{t('team.members')}</h3>
          {view.members.length === 0 && <p className="muted">{t('team.noMembers')}</p>}
          {view.members.map((m) => (
            <article key={m.id} className="person">
              {person(m)}
              <div className="meter" title={t('team.motivationHint')}>
                <span>{t('team.motivation')}</span>
                <div className="meter-bar">
                  <i className={m.motivation < cfg.quitBelow + 15 ? 'low' : ''} style={{ width: `${m.motivation}%` }} />
                </div>
                <span>
                  {num(m.motivation)} · {trend(m)}
                </span>
              </div>
              {m.mayQuit && <p className="negative">{t('team.mayQuit')}</p>}
              <details className="profile">
                <summary>{t('team.profile')}</summary>
                <p>{bioOf(m.nameSeed)}</p>
                <p className="muted">{quirkOf(m.nameSeed)}</p>
                <p className="muted">{t(`team.drivers.${m.driver}.hint`)}</p>
              </details>
              <p className={`quote quote-${m.mood}`}>
                <span className="muted">{t('team.says')}</span> «{t(`team.quotes.${m.driver}.${m.mood}`)}»
              </p>
              <div className="row">
                <button
                  data-talk={m.id}
                  disabled={!m.canTalk || talkingTo === m.id}
                  title={t('team.talkHint')}
                  // С нейросетью открывается настоящий разговор; без неё — прежний разговор «одной кнопкой».
                  onClick={() => (ai ? setTalkingTo(m.id) : dispatch({ type: 'talk', employeeId: m.id }))}
                >
                  {t('team.talk')}
                </button>
                {!m.canTalk && talkingTo !== m.id && <small className="muted">{t('team.talkWait', { days: m.talkInDays })}</small>}
              </div>
              {talkingTo === m.id && (
                <TalkChat member={m} name={nameOf(m.nameSeed)} bio={bioOf(m.nameSeed) ?? ''} quirk={quirkOf(m.nameSeed) ?? ''} onClose={() => setTalkingTo(null)} />
              )}
              <div className="row">
                <label className="salary">
                  {t('team.salary')}
                  <input
                    type="number"
                    min={0}
                    step={50}
                    value={m.salary}
                    onChange={(e) => dispatch({ type: 'setSalary', employeeId: m.id, salary: Number(e.target.value) })}
                  />
                </label>
                <small className="muted">{t('team.expects', { ask: money(m.salaryAsk) })}</small>
              </div>
              <div className="row">
                <small className="muted">{t('team.since', gameDate(m.hiredDay))}</small>
                {firing === m.id ? (
                  <span className="choices">
                    <button
                      onClick={() => {
                        dispatch({ type: 'fire', employeeId: m.id });
                        setFiring(null);
                      }}
                    >
                      {t('team.fireConfirm', { cost: money(m.severance) })}
                    </button>
                    <button onClick={() => setFiring(null)}>{t('team.cancel')}</button>
                  </span>
                ) : (
                  <button onClick={() => setFiring(m.id)}>{t('team.fire')}</button>
                )}
              </div>
            </article>
          ))}
          {free > 0 && (
            <div className="seats">
              {Array.from({ length: Math.min(free, SEATS_SHOWN) }, (_, i) => (
                <div key={i} className="seat" data-free-seat>
                  <span className="seat-desk" aria-hidden="true" />
                  {t('team.freeSeat')}
                </div>
              ))}
              {free > SEATS_SHOWN && <span className="muted fin-small">{t('team.freeSeatsMore', { count: free - SEATS_SHOWN })}</span>}
            </div>
          )}
        </section>

        <section className="panel">
          <h3>{t('team.candidates')}</h3>
          <p className="muted">{t('team.nextCandidates', { days: view.daysToNewCandidates })}</p>
          {/* Рынок труда города: простой рабочий вид — нужно оформление. */}
          {view.market && (
            <p className={view.market.tight ? 'negative' : 'muted'} data-labor-market={view.market.cityId}>
              {t('team.market.city', { city: t(`cities.${view.market.cityId}.name`), reach: view.market.reach, size: view.size })}{' '}
              {view.market.premiumPct > 0 || view.market.candidatesPct < 100
                ? t('team.market.tight', { premium: view.market.premiumPct, candidates: view.market.candidatesPct })
                : t('team.market.easy')}
            </p>
          )}
          {view.candidates.length === 0 && <p className="muted">{t('team.noCandidates')}</p>}
          {view.candidates.map((c) => (
            <article key={c.id} className="person">
              {person(c)}
              <p className="muted">{bioOf(c.nameSeed)}</p>
              <p>{benefit(c)}</p>
              {c.risky && <p className="negative">{t('team.riskyHire', { days: c.cashDaysIfHired })}</p>}
              <div className="row">
                <span>
                  <b>{money(c.salaryAsk)}</b> {t('team.perMonth')}
                </span>
                {c.risky && confirming !== c.id ? (
                  // Опасный найм — в два нажатия: сначала игрок видит, чем рискует.
                  <button disabled={!view.canHire} onClick={() => setConfirming(c.id)}>
                    {t('team.hire')}
                  </button>
                ) : (
                  <button
                    className="primary"
                    disabled={!view.canHire}
                    onClick={() => {
                      dispatch({ type: 'hire', candidateId: c.id });
                      setConfirming(null);
                    }}
                  >
                    {c.risky ? t('team.hireAnyway') : t('team.hire')}
                  </button>
                )}
              </div>
            </article>
          ))}
          {!view.canHire && view.size >= view.maxSize && <p className="muted">{t('team.full')}</p>}
        </section>
      </div>

      <HeadhuntPanel />

      <section className="panel">
        <h3>{t('team.log')}</h3>
        <ul className="log">
          {view.log.length === 0 && <li className="muted">{t('team.noLog')}</li>}
          {view.log
            .slice(-8)
            .reverse()
            .map((entry, i) => (
              <li key={i}>
                <span className="muted">{t('top.date', gameDate(entry.day))}</span>{' '}
                {t(`team.logKinds.${entry.kind}`, { name: nameOf(entry.nameSeed), role: t(`team.roles.${entry.role}`).toLowerCase() })}
              </li>
            ))}
        </ul>
      </section>
    </div>
  );
}
