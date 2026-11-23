// Пробная страница экранов с решениями в четырёх состояниях партии (только при `npm run dev`):
// http://localhost:5173/tools/preview/finance.html?s=1 — первый день; 2 — инвесторы ждут; 3 — идёт торг; 4 — большая компания.
// Раздел: &tab=finance (по умолчанию), overview, team, marketing, product. Ширина окна программы: &w=560 (как в игре на маленьком экране), высота: &h=2000 (чтобы всё было видно без прокрутки).
import { createRoot } from 'react-dom/client';
import { content } from '../../src/content';
import { acquisitionsView, applyCommand, createGame, tick, type Command, type GameState } from '../../src/core';
import '../../src/ui/i18n';
import { CompanyApp } from '../../src/ui/office/CompanyApp';
import { useStore, type ScreenId } from '../../src/ui/store';
import '../../src/ui/styles.css';

const run = (s: GameState, cmd: Command) => {
  const r = applyCommand(s, cmd, content);
  return r.ok ? r.state : s;
};

function fresh(seed = 42): GameState {
  return createGame({ seed, companyName: 'Соседская кухня', productType: 'saas', audienceId: 'smallBusiness', businessModel: 'subscription', goal: 'sandbox', difficulty: 'normal' }, content);
}

function launched(seed = 42): GameState {
  let s: GameState = { ...fresh(seed), cash: 100_000 };
  s = run(s, { type: 'queueFeature', featureId: 'core' });
  for (let i = 0; i < 40; i++) s = tick({ ...s, energy: 100, pendingEvent: null }, content);
  return run({ ...s, pendingEvent: null }, { type: 'launch' });
}

/** Растущая компания: доход за 30 дней $18 000, инвесторы уже готовы говорить. */
function growing(seed = 42): GameState {
  const base = launched(seed);
  const m = (i: number) => ({ month: i, revenue: 18_000, expenses: 15_000, profit: 3000, sideIncome: 0, users: 1200, paying: 180, cash: 20_000 });
  return {
    ...base,
    cash: 22_000,
    users: 1200,
    energy: 100,
    reputation: 55,
    months: [m(0), m(1)],
    recentDays: Array.from({ length: 30 }, (_, i) => ({ day: base.day - 30 + i, cash: Math.round(9000 + 13_000 * (i / 29) ** 1.4), users: Math.round(300 + 900 * (i / 29) ** 1.2), paying: 180, revenue: 600, expenses: 0 })),
  };
}

function inTalks(): GameState {
  for (let seed = 1; seed < 80; seed++) {
    const s = run(growing(seed), { type: 'openRound', investorId: 'fund' });
    if (s.funding?.talks) return run(s, { type: 'counterOffer', stance: 'ask' });
  }
  return growing();
}

function big(): GameState {
  for (let seed = 1; seed < 80; seed++) {
    const base = launched(seed);
    const day = Math.ceil(base.day / content.config.acquisitions.periodDays) * content.config.acquisitions.periodDays;
    const s: GameState = {
      ...base,
      day,
      cash: 1_240_000,
      users: 30_000,
      paying: 4000,
      capacity: 1e6,
      bugs: 0,
      debt: 0,
      reputation: 60,
      founderShare: 0.79,
      recentDays: Array.from({ length: 90 }, (_, i) => ({ day: day - 90 + i, cash: 1e6, users: 30_000, paying: 4000, revenue: 7000, expenses: 0 })),
    };
    if (acquisitionsView(s, content).target) return s;
  }
  return launched();
}

const state = new URLSearchParams(location.search).get('s') ?? '1';
const game = state === '2' ? growing() : state === '3' ? inTalks() : state === '4' ? big() : fresh();
const tab = (new URLSearchParams(location.search).get('tab') ?? 'finance') as ScreenId;
useStore.setState({ game, screen: tab, speed: 0, lastError: null });
const width = Number(new URLSearchParams(location.search).get('w')) || 1180;

createRoot(document.getElementById('root')!).render(
  <div style={{ width, height: Number(new URLSearchParams(location.search).get("h")) || (width === 1180 ? 820 : Math.round(width * 0.55)), margin: '24px auto' }}>
    <CompanyApp />
  </div>,
);
