// Правила «настоящего компьютера» без картинок: куда ведёт адресная строка,
// как клавиши игрока превращаются в код, что отвечает терминал, что находит поиск.
import type { TermLine } from './project';

export type Nav =
  | { view: 'newtab'; url: '' }
  | { view: 'product'; url: string }
  | { view: 'results'; query: string; url: string }
  | { view: 'error'; url: string };

export function searchUrl(query: string): string {
  return `gugle.com/search?q=${query.replace(/\s+/g, '+')}`;
}

/** Что откроется, если ввести текст в адресную строку и нажать Enter. */
export function navigateFromInput(input: string): Nav {
  const text = input.trim();
  if (!text) return { view: 'newtab', url: '' };
  const bare = text.replace(/^https?:\/\//i, '').replace(/\/$/, '');
  if (/^(localhost|127\.0\.0\.1)(:\d+)?(\/.*)?$/i.test(bare)) return { view: 'product', url: 'localhost:5173' };
  if (/^(?:gugle|goagle)\.com\/?$/i.test(bare)) return { view: 'newtab', url: '' };
  if (!/\s/.test(bare) && /^[\w-]+(\.[\w-]+)+(\/\S*)?$/.test(bare)) return { view: 'error', url: bare };
  return { view: 'results', query: text, url: searchUrl(text) };
}

/** Самое длинное начало текста, которое совпадает с настоящим кодом (опечатки отбрасываются). */
export function repairPrefix(text: string, code: string): string {
  let i = 0;
  while (i < text.length && i < code.length && text[i] === code[i]) i++;
  return code.slice(0, i);
}

/** Одно нажатие клавиши игрока: допечатать следующие символы настоящего кода. */
export function advanceCode(text: string, code: string, chars = 3): string {
  const base = repairPrefix(text, code);
  if (base.length >= code.length) return base;
  let next = code.slice(base.length, base.length + chars);
  const nl = next.indexOf('\n');
  if (nl >= 0) {
    next = next.slice(0, nl + 1);
    const indent = /^[ \t]*/.exec(code.slice(base.length + next.length))?.[0] ?? '';
    next += indent;
  }
  return base + next;
}

/** Начало строки с номером line (с нуля) — сколько символов кода до неё. */
export function lineOffset(code: string, line: number): number {
  let offset = 0;
  for (let i = 0; i < line; i++) {
    const nl = code.indexOf('\n', offset);
    if (nl < 0) return code.length;
    offset = nl + 1;
  }
  return offset;
}

const LS = ['node_modules', 'public', 'src', 'tests', 'README.md', 'package.json', 'tsconfig.json', 'vite.config.ts'];

/** Ответ терминала на команду. */
export function runCommand(input: string): { lines: TermLine[]; tests: boolean; clear: boolean } {
  const cmd = input.trim().replace(/\s+/g, ' ');
  const none = { lines: [] as TermLine[], tests: false, clear: false };
  if (!cmd) return none;
  if (/^(npm (run )?test|npx qtest( run)?)$/.test(cmd)) return { ...none, tests: true };
  if (cmd === 'clear') return { ...none, clear: true };
  if (cmd === 'pwd') return { ...none, lines: [{ text: '/Users/founder/projects/pulse-app' }] };
  if (cmd === 'whoami') return { ...none, lines: [{ text: 'founder' }] };
  if (cmd === 'ls' || cmd === 'ls -la' || cmd === 'll') return { ...none, lines: [{ text: LS.join('   '), tone: 'accent' }] };
  if (cmd === 'git status') {
    return {
      ...none,
      lines: [
        { text: 'On branch main' },
        { text: 'Changes not staged for commit:' },
        { text: '\tmodified:   src/api/session.ts', tone: 'fail' },
        { text: '\tmodified:   src/lib/billing.ts', tone: 'fail' },
        { text: 'Untracked files:' },
        { text: '\tsrc/components/Dashboard.tsx', tone: 'fail' },
      ],
    };
  }
  if (cmd === 'npm run dev') {
    return {
      ...none,
      lines: [
        { text: '  VITE ready in 212 ms', tone: 'ok' },
        { text: '  ➜  Local:   http://localhost:5173/', tone: 'accent' },
      ],
    };
  }
  return { ...none, lines: [{ text: `zsh: command not found: ${cmd.split(' ')[0]}` }] };
}

export interface SearchResult {
  site: string;
  url: string;
  title: string;
  text: string;
}

/** Результаты поиска: на знакомый запрос — подобранные, на любой другой — собранные из шаблонов. */
export function resultsFor(
  query: string,
  curated: { queries: string[]; results: SearchResult[] },
  templates: SearchResult[],
): SearchResult[] {
  const q = query.trim();
  if (curated.queries.some((c) => c.toLowerCase() === q.toLowerCase())) return curated.results;
  const fill = (s: string) => s.replaceAll('{q}', q);
  return templates.map((r) => ({ site: fill(r.site), url: fill(r.url), title: fill(r.title), text: fill(r.text) }));
}
