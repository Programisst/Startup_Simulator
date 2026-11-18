// Рисует комнату основателя в файл HTML — чтобы посмотреть сцену без запуска игры.
// Запуск: npx tsx tools/preview/office.tsx <папка для результата>
import { readFileSync, writeFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { applyCommand, createGame, tick, type GameState } from '../../src/core';
import { content } from '../../src/content';
import '../../src/ui/i18n';
import { OfficeScene } from '../../src/ui/office/OfficeScene';

const outDir = process.argv[2] ?? '.';
const css = readFileSync(new URL('../../src/ui/styles.css', import.meta.url), 'utf-8');

function page(game: GameState): string {
  const body = renderToStaticMarkup(<OfficeScene game={game} speed={1} />);
  return `<!doctype html><meta charset="utf-8"><style>${css}</style><body style="padding:16px;width:900px">${body}</body>`;
}

let s = createGame(
  { seed: 5, companyName: 'Demo', productType: 'social', audienceId: 'students', businessModel: 'ads', goal: 'sandbox', difficulty: 'easy' },
  content,
);
writeFileSync(`${outDir}/office-idle.html`, page(s));

const queued = applyCommand(s, { type: 'queueFeature', featureId: 'core' }, content);
if (queued.ok) s = queued.state;
for (let i = 0; i < 30; i++) s = tick(s, content);
const launched = applyCommand(s, { type: 'launch' }, content);
if (launched.ok) s = launched.state;
s = { ...s, cash: 50_000, rush: true, bugs: 9, users: 900, capacity: 2000 };
for (let i = 0; i < 60; i++) s = tick(s, content);
s = { ...s, pendingEvent: null, tasks: [{ kind: 'feature', featureId: 'recommendations', progress: 3 }] };
writeFileSync(`${outDir}/office-busy.html`, page(s));
console.log('готово');
