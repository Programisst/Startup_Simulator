// Выбор города, где основана компания. Простой рабочий вид — нужно оформление (в замысле — карта).
// У каждого города настоящие цифры и то, что они значат в игре.
import { useTranslation } from 'react-i18next';
import { content } from '../../content';
import { citiesView } from '../../core';
import { money, num } from '../format';

const signed = (x: number): string => (x > 0 ? `+${x}` : `${x}`);

export function CityPicker({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const { t } = useTranslation();
  const cities = citiesView(content);
  const chosen = cities.find((c) => c.id === value);

  return (
    <div data-city-picker>
      <div className="ng-tabs">
        {cities.map((c) => (
          <button key={c.id} data-city={c.id} className={c.id === value ? 'ng-tab on' : 'ng-tab'} onClick={() => onChange(c.id)}>
            <b>{t(`cities.${c.id}.name`)}</b>
            <small>{t(`cities.${c.id}.note`)}</small>
          </button>
        ))}
      </div>
      {chosen && (
        <div className="ng-receipt" data-city-facts={chosen.id}>
          <p>
            {t('new.cityFacts', {
              jobs: num(chosen.devJobs),
              wage: money(chosen.devWage),
              price: num(chosen.priceLevel),
              rent: money(chosen.officeRent),
              venture: num(chosen.venture),
            })}
          </p>
          <p>
            <b>
              {t('new.cityEffects', {
                living: signed(chosen.livingPct),
                salary: signed(chosen.salaryPct.developer),
                rent: signed(chosen.rentPct),
                investors: signed(chosen.investorsPct),
              })}
            </b>{' '}
            {chosen.extraCandidates > 0
              ? t('new.cityTalentMore', { count: chosen.extraCandidates })
              : chosen.extraCandidates < 0
                ? t('new.cityTalentLess', { count: -chosen.extraCandidates })
                : t('new.cityTalentSame')}{' '}
            {t('new.cityReach', { reach: chosen.reach })}
          </p>
        </div>
      )}
    </div>
  );
}
