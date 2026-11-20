// Охота за звёздами: кого можно переманить, с каким шансом и чем это грозит. Простой рабочий вид — нужно оформление.
import { useTranslation } from 'react-i18next';
import { content } from '../../content';
import { headhuntView } from '../../core';
import { dec, money, num } from '../format';
import { usePersonName } from '../names';
import { useStore } from '../store';

export function HeadhuntPanel() {
  const { t } = useTranslation();
  const game = useStore((s) => s.game)!;
  const dispatch = useStore((s) => s.dispatch);
  const nameOf = usePersonName();
  const view = headhuntView(game, content);
  const companies = t('team.headhunt.companies', { returnObjects: true }) as string[];
  const companyOf = (seed: number) => companies[seed % companies.length];
  const star = view.star;
  const p = view.pending;

  return (
    <section className="panel" data-headhunt>
      <h3>{t('team.headhunt.title')}</h3>
      <p className="muted">{t('team.headhunt.lead')}</p>

      {!view.unlocked && <p className="muted">{t('team.headhunt.locked', { value: money(view.minRevenue30) })}</p>}

      {p && (
        <p>
          <b>{t('team.headhunt.pending', { name: nameOf(p.nameSeed), company: companyOf(p.companySeed), salary: money(p.salary), chance: p.chancePct, days: p.daysLeft })}</b>
        </p>
      )}

      {!p && view.last && (
        <p className={view.last.outcome === 'joined' ? '' : 'negative'}>
          {t(`team.headhunt.last.${view.last.outcome}`, { name: nameOf(view.last.nameSeed) })}
          {view.last.retaliation && ` ${t('team.headhunt.last.retaliation')}`}
        </p>
      )}

      {view.nextInDays !== null && <p className="muted">{t('team.headhunt.waiting', { days: view.nextInDays })}</p>}

      {star && (
        <div data-headhunt-star>
          <p>
            <b>
              {t('team.headhunt.starLine', {
                name: nameOf(star.nameSeed),
                role: t(`team.roles.${star.role}`).toLowerCase(),
                skill: dec(star.skill),
                company: companyOf(star.companySeed),
                salary: money(star.salaryNow),
              })}
            </b>
          </p>
          <p>{t('team.headhunt.starAura', { pct: star.auraPct, days: star.daysLeft })}</p>
          <p className="muted">
            {t(`team.traits.${star.trait}`)} · {t(`team.headhunt.why.${star.driver}`, { reputation: num(game.reputation) })}
          </p>
          {star.offers.map((o) => (
            <p key={o.id}>
              <button data-headhunt-offer={o.id} disabled={o.blocked !== null} onClick={() => dispatch({ type: 'headhunt', offer: o.id })}>
                {t('team.headhunt.offer', { name: t(`team.headhunt.offers.${o.id}`), salary: money(o.salary) })}
              </button>{' '}
              <span>{t('team.headhunt.chance', { chance: o.chancePct })}</span>{' '}
              <span className="muted">
                {o.fit !== 'neutral' && `${t(`team.headhunt.fit.${o.fit}`)} `}
                {o.bonus > 0 && `${t('team.headhunt.bonus', { bonus: money(o.bonus) })} `}
                {o.jealousCount > 0 && `${t('team.headhunt.jealous', { count: o.jealousCount, amount: o.jealousy })} `}
                {o.underpaid && `${t('team.headhunt.underpaid')} `}
              </span>
              {o.risky && <span className="negative">{t('team.headhunt.risky', { days: o.cashDays ?? 0 })}</span>}
            </p>
          ))}
          {view.blocked && view.blocked !== 'cash' && <p className="negative">{t(`team.headhunt.blocked.${view.blocked}`)}</p>}
          <p className="muted">
            {t('team.headhunt.retaliation', { joined: view.retaliationPct.joined, declined: view.retaliationPct.declined })} {t('team.headhunt.energy', { energy: view.energyCost })}
          </p>
        </div>
      )}

      {view.stars > 0 && (
        <p>{t('team.headhunt.stars', { count: view.stars, dev: view.auraPct.developer, mkt: view.auraPct.marketer, cap: view.auraCapPct })}</p>
      )}
    </section>
  );
}
