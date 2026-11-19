// Программа «Компания» на компьютере основателя: всё управление игрой — здесь.
// Выглядит как обычная программа той системы, что нарисована на экране компьютера.
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Coach } from '../components/Coach';
import { GoalCard } from '../components/GoalCard';
import { TopBar } from '../components/TopBar';
import { FeedApp, GoalsApp, MailApp, SettingsApp } from '../screens/Apps';
import { Finance } from '../screens/Finance';
import { Marketing } from '../screens/Marketing';
import { Overview } from '../screens/Overview';
import { Product } from '../screens/Product';
import { Team } from '../screens/Team';
import { useStore, type ScreenId } from '../store';
import type { TutorialStep } from '../tutorial';
import './company.css';

export const COMPANY_TABS: ScreenId[] = ['overview', 'product', 'team', 'marketing', 'finance'];

/** Значки разделов: простые линии на цветном квадрате. */
const ICONS: Partial<Record<ScreenId, ReactNode>> = {
  overview: <path d="M2.5 11.5V8M6.5 11.5V4.5M10.5 11.5V6.5" />,
  product: <path d="M2.5 4.2 6.5 2l4 2.2v4.6l-4 2.2-4-2.2zM2.5 4.2l4 2.2 4-2.2M6.5 6.4V11" />,
  team: <path d="M6.5 6.2a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM2.6 11.2c.4-2 1.9-3 3.9-3s3.5 1 3.9 3" />,
  marketing: <path d="M2.5 5.4v2.2l5 2.4V3zM7.5 4.2c1.6.2 2.6 1 2.6 2.3s-1 2.1-2.6 2.3M4 7.8l.6 2.7" />,
  finance: <path d="M6.5 2v9M9 4.2c-.5-.8-1.4-1.2-2.500-1.200-1.400 0-2.500.700-2.500 1.800 0 2.400 5.200 1.100 5.200 3.600 0 1.100-1.100 1.800-2.700 1.800-1.200 0-2.200-.4-2.700-1.200" />,
};

export function CompanyApp({ step }: { step: TutorialStep | null }) {
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
              <svg viewBox="0 0 13 13">{ICONS[id]}</svg>
            </span>
            {t(`nav.${id}`)}
          </button>
        ))}
        <span className="ca-fill" />
        <GoalCard variant="app" />
      </nav>
      <TopBar />
      <main className="content">
        <Coach step={step} inline />
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
      </main>
    </div>
  );
}
