// Программа «Компания» на компьютере основателя: всё управление игрой — здесь.
import { useTranslation } from 'react-i18next';
import { Coach } from '../components/Coach';
import { TopBar } from '../components/TopBar';
import { Finance } from '../screens/Finance';
import { Marketing } from '../screens/Marketing';
import { Overview } from '../screens/Overview';
import { Product } from '../screens/Product';
import { Team } from '../screens/Team';
import { useStore, type ScreenId } from '../store';
import type { TutorialStep } from '../tutorial';

export const COMPANY_TABS: ScreenId[] = ['overview', 'product', 'team', 'marketing', 'finance'];

export function CompanyApp({ step }: { step: TutorialStep | null }) {
  const { t } = useTranslation();
  const screen = useStore((s) => s.screen);
  const setScreen = useStore((s) => s.setScreen);
  const lastError = useStore((s) => s.lastError);
  // «Офис» — это сама квартира; в компьютере на его месте открывается сводка.
  const tab = screen === 'office' ? 'overview' : screen;

  return (
    <div className="company-app">
      <TopBar />
      <nav className="sidebar">
        {COMPANY_TABS.map((id) => (
          <button key={id} data-nav={id} className={id === tab ? 'active' : ''} onClick={() => setScreen(id)}>
            {t(`nav.${id}`)}
          </button>
        ))}
      </nav>
      <main className="content">
        <Coach step={step} inline />
        {lastError && <p className="error">{t(`errors.${lastError}`)}</p>}
        {tab === 'overview' && <Overview />}
        {tab === 'product' && <Product />}
        {tab === 'team' && <Team />}
        {tab === 'marketing' && <Marketing />}
        {tab === 'finance' && <Finance />}
      </main>
    </div>
  );
}
