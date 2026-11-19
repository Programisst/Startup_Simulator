// Проект, который основатель пишет на экране: настоящий код его стартапа Pulse.
// Это содержимое «внутри мира» игры, а не надписи интерфейса.

export interface ProjectFile {
  path: string[];
  name: string;
  /** С какой строки начинается непрописанная часть (выше — уже написано раньше). */
  writtenLines: number;
  /** Строки, после которых основатель прерывается: сохраняет, гоняет тесты, смотрит браузер. */
  breaks: number[];
  code: string;
  testFile: string;
  tests: number;
  /** Готовый файл, который основатель не пишет, — его можно только открыть и посмотреть. */
  static?: boolean;
}

const SESSION = `import { db } from '../lib/db';
import { hashToken, randomToken } from '../lib/crypto';
import type { Session, User } from '../types';

const SESSION_TTL_DAYS = 30;
const DAY_MS = 86_400_000;

// Сессия живёт 30 дней, потом пользователь входит заново.
export async function createSession(user: User): Promise<Session> {
  const token = randomToken(32);
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * DAY_MS);

  await db.sessions.insert({
    userId: user.id,
    tokenHash: await hashToken(token),
    expiresAt,
  });

  return { token, userId: user.id, expiresAt };
}

export async function readSession(token: string): Promise<Session | null> {
  const row = await db.sessions.findOne({ tokenHash: await hashToken(token) });
  if (!row) return null;

  if (row.expiresAt.getTime() < Date.now()) {
    await db.sessions.delete(row.id);
    return null;
  }

  return { token, userId: row.userId, expiresAt: row.expiresAt };
}

export async function revokeAll(userId: string): Promise<number> {
  const removed = await db.sessions.deleteMany({ userId });
  console.info(\`Закрыто сессий: \${removed}\`);
  return removed;
}
`;

const BILLING = `import type { Plan, Subscription } from '../types';

export const PLANS: Record<Plan, number> = {
  starter: 9,
  team: 29,
  business: 79,
};

const TRIAL_DAYS = 14;
const YEARLY_DISCOUNT = 0.2;

/** Сколько клиент заплатит в этом месяце с учётом пробного периода. */
export function monthlyCharge(sub: Subscription, today: Date): number {
  const trialEnds = addDays(sub.startedAt, TRIAL_DAYS);
  if (today < trialEnds) return 0;

  const base = PLANS[sub.plan] * sub.seats;
  const discount = sub.yearly ? YEARLY_DISCOUNT : 0;
  return Math.round(base * (1 - discount) * 100) / 100;
}

/** Доля клиентов, которые ушли за месяц. */
export function churnRate(active: number, cancelled: number): number {
  if (active + cancelled === 0) return 0;
  return cancelled / (active + cancelled);
}

export function mrr(subs: Subscription[], today: Date): number {
  return subs
    .filter((s) => s.status === 'active')
    .reduce((sum, s) => sum + monthlyCharge(s, today), 0);
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86_400_000);
}
`;

const DASHBOARD = `import { useMemo } from 'react';
import { useMetrics } from '../hooks/useMetrics';
import { Chart } from './Chart';
import { StatCard } from './StatCard';

export function Dashboard({ teamId }: { teamId: string }) {
  const { data, isLoading } = useMetrics(teamId, { range: '30d' });

  const growth = useMemo(() => {
    if (!data) return 0;
    const first = data.revenue[0] ?? 0;
    const last = data.revenue.at(-1) ?? 0;
    return first === 0 ? 0 : (last - first) / first;
  }, [data]);

  if (isLoading || !data) return <Skeleton rows={4} />;

  return (
    <main className="dashboard">
      <header className="dashboard__head">
        <h1>Обзор</h1>
        <RangePicker value="30d" />
      </header>

      <section className="dashboard__stats">
        <StatCard label="Выручка" value={data.mrr} format="money" trend={growth} />
        <StatCard label="Клиенты" value={data.customers} />
        <StatCard label="Отток" value={data.churn} format="percent" invert />
      </section>

      <Chart series={data.revenue} height={280} />
    </main>
  );
}
`;


const PACKAGE = `{
  "name": "pulse-app",
  "version": "0.3.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "test": "qtest run"
  },
  "dependencies": {
    "react": "^19.2.0",
    "react-dom": "^19.2.0"
  },
  "devDependencies": {
    "typescript": "^5.9.0",
    "vite": "^7.1.0"
  }
}
`;

const README = `# Pulse

Аналитика для малого бизнеса: выручка, клиенты и отток на одном экране.

## Запуск

npm install
npm run dev

## Что дальше

- [x] Вход и сессии
- [ ] Оплата подписки
- [ ] Экран «Обзор»
- [ ] Первые 10 клиентов
`;

const TYPES = `export type Plan = 'starter' | 'team' | 'business';

export interface User {
  id: string;
  email: string;
  name: string;
}

export interface Session {
  token: string;
  userId: string;
  expiresAt: Date;
}

export interface Subscription {
  id: string;
  plan: Plan;
  seats: number;
  yearly: boolean;
  status: 'active' | 'trial' | 'cancelled';
  startedAt: Date;
}
`;

export const PROJECT_FILES: ProjectFile[] = [
  { path: ['src', 'api'], name: 'session.ts', writtenLines: 7, breaks: [20, 33], code: SESSION, testFile: 'src/api/session.test.ts', tests: 14 },
  { path: ['src', 'lib'], name: 'billing.ts', writtenLines: 10, breaks: [21, 33], code: BILLING, testFile: 'src/lib/billing.test.ts', tests: 9 },
  { path: ['src', 'components'], name: 'Dashboard.tsx', writtenLines: 5, breaks: [16, 33], code: DASHBOARD, testFile: 'src/components/Dashboard.test.tsx', tests: 6 },
  { path: ['src'], name: 'types.ts', writtenLines: 99, breaks: [], code: TYPES, testFile: '', tests: 0, static: true },
  { path: [], name: 'package.json', writtenLines: 99, breaks: [], code: PACKAGE, testFile: '', tests: 0, static: true },
  { path: [], name: 'README.md', writtenLines: 99, breaks: [], code: README, testFile: '', tests: 0, static: true },
];

/** Файлы, которые основатель пишет сам (остальные — готовые). */
export const WRITTEN_FILES = PROJECT_FILES.map((f, i) => ({ f, i })).filter(({ f }) => !f.static);

/** Дерево файлов в боковой панели редактора. */
export interface TreeNode {
  name: string;
  depth: number;
  folder?: boolean;
  open?: boolean;
  dim?: boolean;
  git?: 'M' | 'U';
}

export const TREE: TreeNode[] = [
  { name: '.github', depth: 0, folder: true },
  { name: 'node_modules', depth: 0, folder: true, dim: true },
  { name: 'public', depth: 0, folder: true },
  { name: 'src', depth: 0, folder: true, open: true },
  { name: 'api', depth: 1, folder: true, open: true },
  { name: 'session.ts', depth: 2, git: 'M' },
  { name: 'users.ts', depth: 2 },
  { name: 'components', depth: 1, folder: true, open: true },
  { name: 'Chart.tsx', depth: 2 },
  { name: 'Dashboard.tsx', depth: 2, git: 'U' },
  { name: 'StatCard.tsx', depth: 2 },
  { name: 'hooks', depth: 1, folder: true },
  { name: 'lib', depth: 1, folder: true, open: true },
  { name: 'billing.ts', depth: 2, git: 'M' },
  { name: 'crypto.ts', depth: 2 },
  { name: 'db.ts', depth: 2 },
  { name: 'main.tsx', depth: 1 },
  { name: 'types.ts', depth: 1 },
  { name: 'tests', depth: 0, folder: true },
  { name: '.env.example', depth: 0 },
  { name: '.gitignore', depth: 0 },
  { name: 'package.json', depth: 0, git: 'M' },
  { name: 'README.md', depth: 0 },
  { name: 'tsconfig.json', depth: 0 },
  { name: 'vite.config.ts', depth: 0 },
];

export interface TermLine {
  text: string;
  tone?: 'muted' | 'ok' | 'fail' | 'accent' | 'bold' | 'prompt';
}

/** Вывод прогона тестов: строки появляются по очереди, как в настоящем терминале. */
export function testRunOutput(): { line: TermLine; delay: number }[] {
  const files = PROJECT_FILES.filter((f) => !f.static).map((f) => ({ name: f.testFile, tests: f.tests }));
  const total = files.reduce((s, f) => s + f.tests, 0);
  const ms = () => 8 + Math.floor(Math.random() * 90);
  return [
    { line: { text: '' }, delay: 120 },
    { line: { text: '> pulse-app@0.3.0 test', tone: 'muted' }, delay: 60 },
    { line: { text: '> qtest run', tone: 'muted' }, delay: 220 },
    { line: { text: '' }, delay: 300 },
    { line: { text: ' RUN  v2.4.1 ~/projects/pulse-app', tone: 'accent' }, delay: 650 },
    { line: { text: '' }, delay: 200 },
    ...files.map((f) => ({ line: { text: ` ✓ ${f.name} (${f.tests} tests) ${ms()}ms`, tone: 'ok' as const }, delay: 380 + Math.floor(Math.random() * 500) })),
    { line: { text: '' }, delay: 200 },
    { line: { text: ` Test Files  ${files.length} passed (${files.length})`, tone: 'bold' }, delay: 120 },
    { line: { text: `      Tests  ${total} passed (${total})`, tone: 'bold' }, delay: 80 },
    { line: { text: `   Duration  ${(0.9 + Math.random() * 0.8).toFixed(2)}s`, tone: 'muted' }, delay: 80 },
    { line: { text: '' }, delay: 60 },
  ];
}

/** Строки дерева файлов, которые видны с учётом свёрнутых папок. */
export function visibleTree(collapsed: string[]): TreeNode[] {
  const out: TreeNode[] = [];
  let hideDeeperThan = Infinity;
  for (const node of TREE) {
    if (node.depth > hideDeeperThan) continue;
    hideDeeperThan = Infinity;
    out.push(node);
    if (node.folder && collapsed.includes(node.name)) hideDeeperThan = node.depth;
  }
  return out;
}

/** Папки, в которых лежит файл, — чтобы раскрыть их перед открытием. */
export function foldersOf(name: string): string[] {
  const index = TREE.findIndex((n) => n.name === name);
  const result: string[] = [];
  let depth = TREE[index]?.depth ?? 0;
  for (let i = index - 1; i >= 0 && depth > 0; i--) {
    const n = TREE[i]!;
    if (n.folder && n.depth < depth) {
      result.push(n.name);
      depth = n.depth;
    }
  }
  return result;
}
