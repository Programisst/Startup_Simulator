// Охота за звёздами в стиле игры: пока рано — строка «откроется позже» с полоской дохода;
// потом — визитка звезды (кто, где работает, чем поможет) и три варианта предложения с шансом.
import { useTranslation } from 'react-i18next';
import { content } from '../../content';
import { headhuntView, revenue30Of } from '../../core';
import { dec, money, num } from '../format';
import { usePersonName } from '../names';
import { useStore } from '../store';
import { LockedRow, Meter } from './FinanceParts';

const initials = (name: string) =>
  name
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

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

  if (!view.unlocked) {
    return (
      <LockedRow
        attr={{ 'data-headhunt': '' }}
        title={t('team.headhunt.title')}
        what={t('team.headhunt.lockedWhat')}
        when={t('team.headhunt.locked', { value: money(view.minRevenue30) })}
        now={game.launched ? revenue30Of(game) : 0}
        goal={view.minRevenue30}
      />
    );
  }

  return (
    <section className="panel hh" data-headhunt>
      <div className="fin-spread">
        <h3>{t('team.headhunt.title')}</h3>
        {view.stars > 0 && <span className="muted fin-small">{t('team.headhunt.stars', { count: view.stars, dev: view.auraPct.developer, mkt: view.auraPct.marketer, cap: view.auraCapPct })}</span>}
      </div>
      <p className="muted fin-small">{t('team.headhunt.lead')}</p>

      {p && (
        <div className="fin-promise">
          <p>
            <b>{t('team.headhunt.pending', { name: nameOf(p.nameSeed), company: companyOf(p.companySeed), salary: money(p.salary), chance: p.chancePct, days: p.daysLeft })}</b>
          </p>
          <Meter pct={p.chancePct} tone="amber" />
        </div>
      )}

      {!p && view.last && (
        <p className={`fin-last ${view.last.outcome === 'joined' ? 'positive' : 'negative'}`}>
          {t(`team.headhunt.last.${view.last.outcome}`, { name: nameOf(view.last.nameSeed) })}
          {view.last.retaliation && ` ${t('team.headhunt.last.retaliation')}`}
        </p>
      )}

      {view.nextInDays !== null && <p className="muted fin-small">{t('team.headhunt.waiting', { days: view.nextInDays })}</p>}

      {star && (
        <div className="hh-star" data-headhunt-star>
          <div className="hh-card">
            <span className="fin-ava hh-ava" aria-hidden="true">
              {initials(nameOf(star.nameSeed))}
            </span>
            <div>
              <b>
                {t('team.headhunt.starLine', {
                  name: nameOf(star.nameSeed),
                  role: t(`team.roles.${star.role}`).toLowerCase(),
                  skill: dec(star.skill),
                  company: companyOf(star.companySeed),
                  salary: money(star.salaryNow),
                })}
              </b>
              <p className="fin-small">{t('team.headhunt.starAura', { pct: star.auraPct, days: star.daysLeft })}</p>
              <p className="muted fin-small">
                {t(`team.traits.${star.trait}`)} · {t(`team.headhunt.why.${star.driver}`, { reputation: num(game.reputation) })}
              </p>
            </div>
          </div>
          <div className="hh-offers">
            {star.offers.map((o) => (
              <div key={o.id} className="fin-term hh-offer">
                <button className={o.id === 'generous' ? 'primary' : ''} data-headhunt-offer={o.id} disabled={o.blocked !== null} onClick={() => dispatch({ type: 'headhunt', offer: o.id })}>
                  {t('team.headhunt.offer', { name: t(`team.headhunt.offers.${o.id}`), salary: money(o.salary) })}
                </button>
                <div className="fin-chance hh-chance fin-small">
                  <Meter pct={o.chancePct} tone="dark" />
                  <b>{t('team.headhunt.chance', { chance: o.chancePct })}</b>
                </div>
                {(o.fit !== 'neutral' || o.bonus > 0 || o.jealousCount > 0 || o.underpaid) && (
                  <span className="muted fin-small">
                    {o.fit !== 'neutral' && `${t(`team.headhunt.fit.${o.fit}`)} `}
                    {o.bonus > 0 && `${t('team.headhunt.bonus', { bonus: money(o.bonus) })} `}
                    {o.jealousCount > 0 && `${t('team.headhunt.jealous', { count: o.jealousCount, amount: o.jealousy })} `}
                    {o.underpaid && `${t('team.headhunt.underpaid')} `}
                  </span>
                )}
                {o.risky && <span className="negative fin-small">{t('team.headhunt.risky', { days: o.cashDays ?? 0 })}</span>}
              </div>
            ))}
          </div>
          {view.blocked && view.blocked !== 'cash' && <p className="negative fin-small">{t(`team.headhunt.blocked.${view.blocked}`)}</p>}
          <p className="muted fin-small">
            {t('team.headhunt.retaliation', { joined: view.retaliationPct.joined, declined: view.retaliationPct.declined })} {t('team.headhunt.energy', { energy: view.energyCost })}
          </p>
        </div>
      )}
    </section>
  );
}
