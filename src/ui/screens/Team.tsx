// Экран команды: кого можно нанять, кто уже работает, сколько это стоит.
// Все числа берутся из ядра (teamView); экран только показывает их и отправляет команды.
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { content } from '../../content';
import { teamView, type Candidate, type TeamMemberView } from '../../core';
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

export function Team() {
  const { t } = useTranslation();
  const game = useStore((s) => s.game)!;
  const dispatch = useStore((s) => s.dispatch);
  const [firing, setFiring] = useState<number | null>(null);
  const view = teamView(game, content);
  const cfg = content.config.team;

  const nameOf = usePersonName();

  /** Что человек даёт компании при обычной мотивации. */
  function benefit(p: Candidate): string {
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
          <small>{t('team.sizeHint')}</small>
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
        </section>

        <section className="panel">
          <h3>{t('team.candidates')}</h3>
          <p className="muted">{t('team.nextCandidates', { days: view.daysToNewCandidates })}</p>
          {view.candidates.length === 0 && <p className="muted">{t('team.noCandidates')}</p>}
          {view.candidates.map((c) => (
            <article key={c.id} className="person">
              {person(c)}
              <p>{benefit(c)}</p>
              <div className="row">
                <span>
                  <b>{money(c.salaryAsk)}</b> {t('team.perMonth')}
                </span>
                <button className="primary" disabled={!view.canHire} onClick={() => dispatch({ type: 'hire', candidateId: c.id })}>
                  {t('team.hire')}
                </button>
              </div>
            </article>
          ))}
          {!view.canHire && view.size >= view.maxSize && <p className="muted">{t('team.full')}</p>}
        </section>
      </div>

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
