// Имена сотрудников. Ядро хранит только число (nameSeed), а имя по нему подбирается здесь из списков перевода.
import { useTranslation } from 'react-i18next';

export function usePersonName(): (seed: number) => string {
  const { t } = useTranslation();
  const first = t('team.firstNames', { returnObjects: true }) as string[];
  const last = t('team.lastNames', { returnObjects: true }) as string[];
  return (seed) => `${first[seed % first.length]} ${last[Math.floor(seed / first.length) % last.length]}`;
}
