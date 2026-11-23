// Программа «Компания» на компьютере основателя: всё управление игрой — здесь.
// Выглядит как обычная программа той системы, что нарисована на экране компьютера.
import { useTranslation } from 'react-i18next';
import { GoalCard } from '../components/GoalCard';
import { TopBar } from '../components/TopBar';
import { FeedApp, GoalsApp, MailApp, SettingsApp } from '../screens/Apps';
import { Bank } from '../screens/Bank';
import { Finance } from '../screens/Finance';
import { Marketing } from '../screens/Marketing';
import { Overview } from '../screens/Overview';
import { Product } from '../screens/Product';
import { Team } from '../screens/Team';
import { PixelIcon, type PixelIconName } from '../pixelIcons';
import { useStore, type ScreenId } from '../store';
import './company.css';
// После company.css: экраны с решениями (финансы, команда, маркетинг, продукт) уточняют общий вид.
import './decisions.css';
import './overview.css';

export const COMPANY_TABS: ScreenId[] = ['overview', 'product', 'team', 'marketing', 'finance'];

/** Пиксельные значки разделов — как предметы в квартире. */
const ICONS: Partial<Record<ScreenId, PixelIconName>> = {
  overview: 'chart',
  product: 'box',
  team: 'people',
  marketing: 'horn',
  finance: 'money',
};

export function CompanyApp() {
  const { t } = useTranslation();
  const companyName = useStore((s) => s.game?.companyName ?? '');
  const screen = useStore((s) => s.screen);
  const setScreen = useStore((s) => s.setScreen);
  const lastError = useStore((s) => s.lastError);
  // «Офис» — это сама квартира; в компьютере на его месте открывается сводка.
  const tab = screen === 'office' ? 'overview' : screen;

  return (
    <div className="company-app">
      <header className="ca-title">
        <span className="ca-lights" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
        {COMPANY_TABS.includes(tab) ? t('laptop.company.title') : t(`apps.${tab}.title`)} — {companyName}
      </header>
      <nav className="sidebar" aria-label={t('laptop.company.title')}>
        <span className="ca-side-label">{companyName}</span>
        {COMPANY_TABS.map((id) => (
          <button key={id} data-nav={id} className={id === tab ? 'active' : ''} onClick={() => setScreen(id)}>
            <span className="ca-ico" aria-hidden="true">
              <PixelIcon name={ICONS[id]!} />
            </span>
            {t(`nav.${id}`)}
          </button>
        ))}
        <span className="ca-fill" />
        <GoalCard variant="app" />
      </nav>
      <TopBar timeControls={false} />
      <main className="content">
        {lastError && <p className="error">{t(`errors.${lastError}`)}</p>}
        {tab === 'overview' && <Overview />}
        {tab === 'product' && <Product />}
        {tab === 'team' && <Team />}
        {tab === 'marketing' && <Marketing />}
        {tab === 'finance' && <Finance />}
        {tab === 'feed' && <FeedApp />}
        {tab === 'mail' && <MailApp />}
        {tab === 'goals' && <GoalsApp />}
        {tab === 'settings' && <SettingsApp />}
        {tab === 'bank' && <Bank />}
      </main>
    </div>
  );
}
