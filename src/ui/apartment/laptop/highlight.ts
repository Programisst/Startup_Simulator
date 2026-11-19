// Подсветка кода на экране ноутбука. Разбирает одну строку TypeScript на цветные кусочки.
// Не настоящий компилятор: нужен только чтобы код на экране выглядел как в редакторе.

export type TokenKind =
  | 'keyword' // const, function, async — синие
  | 'control' // import, return, if — фиолетовые
  | 'type' // User, Promise — бирюзовые
  | 'function' // load(), sum() — жёлтые
  | 'string'
  | 'number'
  | 'comment'
  | 'property' // db.users — голубые
  | 'constant' // MAX_DAYS
  | 'variable'
  | 'tag' // <div> в JSX
  | 'punct'
  | 'space';

export interface Token {
  kind: TokenKind;
  text: string;
}

const KEYWORDS = new Set([
  'const', 'let', 'var', 'function', 'async', 'class', 'interface', 'type', 'enum', 'new', 'typeof',
  'keyof', 'extends', 'implements', 'in', 'of', 'as', 'this', 'void', 'null', 'undefined', 'true',
  'false', 'readonly', 'private', 'public', 'static', 'declare', 'satisfies',
]);
const CONTROL = new Set([
  'import', 'export', 'from', 'default', 'return', 'if', 'else', 'for', 'while', 'await', 'try',
  'catch', 'finally', 'throw', 'switch', 'case', 'break', 'continue', 'yield',
]);
const BUILTIN_TYPES = new Set(['string', 'number', 'boolean', 'unknown', 'never', 'any', 'bigint']);

const IDENT = /^[A-Za-z_$][\w$]*/;
const NUMBER = /^\d[\d_]*(\.\d+)?(e[+-]?\d+)?n?/i;
const SPACE = /^\s+/;
const PUNCT = /^[^\w\s'"`$]+/;

function readString(line: string, start: number): number {
  const quote = line[start];
  let i = start + 1;
  while (i < line.length) {
    if (line[i] === '\\') i += 2;
    else if (line[i] === quote) return i + 1;
    else i += 1;
  }
  return line.length;
}

function nextNonSpace(line: string, from: number): string {
  for (let i = from; i < line.length; i++) if (line[i] !== ' ') return line[i] ?? '';
  return '';
}

function prevNonSpace(line: string, before: number): string {
  for (let i = before - 1; i >= 0; i--) if (line[i] !== ' ') return line[i] ?? '';
  return '';
}

function classifyIdent(line: string, start: number, word: string): TokenKind {
  const end = start + word.length;
  const before = prevNonSpace(line, start);
  const after = nextNonSpace(line, end);
  // В разметке компоненты (с большой буквы) — бирюзовые, обычные теги — синие.
  const inTag = (before === '<' && /^\s*[A-Za-z]/.test(line.slice(start)) && !/[\w)\]]\s*$/.test(line.slice(0, start - 1)))
    || line.slice(Math.max(0, start - 2), start) === '</';
  if (inTag) return /^[A-Z]/.test(word) ? 'type' : 'tag';
  if (before === '.') return after === '(' ? 'function' : 'property';
  if (CONTROL.has(word)) return 'control';
  if (KEYWORDS.has(word)) return 'keyword';
  if (BUILTIN_TYPES.has(word)) return 'type';
  if (/^[A-Z][A-Z0-9_]+$/.test(word)) return 'constant';
  if (/^[A-Z]/.test(word)) return 'type';
  if (after === '(') return 'function';
  if (after === ':' && /^\s*[A-Za-z_$]/.test(line.slice(0, start)) === false) return 'property';
  return 'variable';
}

/** Делит строку на кусочки с видом подсветки. Склеенные обратно, они дают ровно исходную строку. */
export function highlightLine(line: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const push = (kind: TokenKind, text: string) => {
    const last = tokens[tokens.length - 1];
    if (last && last.kind === kind && (kind === 'punct' || kind === 'space')) last.text += text;
    else tokens.push({ kind, text });
  };

  while (i < line.length) {
    const rest = line.slice(i);
    const ch = line[i] ?? '';

    if (rest.startsWith('//')) {
      push('comment', rest);
      break;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      const end = readString(line, i);
      push('string', line.slice(i, end));
      i = end;
      continue;
    }
    const space = SPACE.exec(rest);
    if (space) {
      push('space', space[0]);
      i += space[0].length;
      continue;
    }
    const num = NUMBER.exec(rest);
    if (num) {
      push('number', num[0]);
      i += num[0].length;
      continue;
    }
    const ident = IDENT.exec(rest);
    if (ident) {
      push(classifyIdent(line, i, ident[0]), ident[0]);
      i += ident[0].length;
      continue;
    }
    const punct = PUNCT.exec(rest);
    if (punct) {
      // Не съедаем начало комментария или строки, которые идут сразу за знаками.
      let text = punct[0];
      const cut = text.indexOf('//');
      if (cut > 0) text = text.slice(0, cut);
      push('punct', text);
      i += text.length;
      continue;
    }
    push('punct', ch);
    i += 1;
  }
  return tokens;
}
