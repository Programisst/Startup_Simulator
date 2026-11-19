// Сценарий печати кода «живым человеком»: неровный темп, паузы на подумать,
// автодополнение длинных слов и редкие опечатки, которые тут же стираются.

export type TypingStep =
  | { type: 'insert'; text: string; delay: number; typo?: boolean; accept?: boolean }
  | { type: 'backspace'; delay: number; fix?: boolean };

/** Маленький генератор случайных чисел с seed: одинаковый seed — одинаковая печать. */
function rng(seed: number): () => number {
  let a = seed >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Соседние клавиши: опечатка — это почти всегда соседняя буква.
const NEIGHBOURS: Record<string, string> = {
  a: 'sq', b: 'vn', c: 'xv', d: 'sf', e: 'wr', f: 'dg', g: 'fh', h: 'gj', i: 'uo', j: 'hk', k: 'jl',
  l: 'k;', m: 'n,', n: 'bm', o: 'ip', p: 'o[', q: 'wa', r: 'et', s: 'ad', t: 'ry', u: 'yi', v: 'cb',
  w: 'qe', x: 'zc', y: 'tu', z: 'xa',
};

function wrongKey(ch: string, rand: () => number): string {
  const lower = ch.toLowerCase();
  const options = NEIGHBOURS[lower];
  if (!options) return ch === 'e' ? 'r' : 'e';
  const pick = options[Math.floor(rand() * options.length)] ?? 'e';
  return ch === lower ? pick : pick.toUpperCase();
}

const between = (rand: () => number, min: number, max: number) => Math.round(min + rand() * (max - min));

/** Строит пошаговую печать текста. Итог после всех шагов всегда равен исходному тексту. */
export function buildTypingScript(source: string, seed: number): TypingStep[] {
  const rand = rng(seed);
  const steps: TypingStep[] = [];
  let i = 0;

  while (i < source.length) {
    const ch = source[i] ?? '';

    // Отступ в начале строки ставит редактор сам — одним шагом.
    if (ch === '\n') {
      steps.push({ type: 'insert', text: '\n', delay: between(rand, 90, 220) });
      i += 1;
      const indent = /^[ \t]+/.exec(source.slice(i))?.[0] ?? '';
      if (indent) {
        steps.push({ type: 'insert', text: indent, delay: 16 });
        i += indent.length;
      }
      // Иногда человек задумывается перед новой строкой.
      if (rand() < 0.16 && source[i] !== '\n') steps.push({ type: 'insert', text: '', delay: between(rand, 500, 1400) });
      continue;
    }

    // Длинное слово часто дописывает автодополнение.
    const word = /^[A-Za-z_$][\w$]*/.exec(source.slice(i))?.[0];
    if (word && word.length >= 6 && rand() < 0.4) {
      const typed = between(rand, 2, 3);
      for (let k = 0; k < typed; k++) steps.push({ type: 'insert', text: word[k] ?? '', delay: between(rand, 45, 110) });
      steps.push({ type: 'insert', text: word.slice(typed), delay: between(rand, 260, 520), accept: true });
      i += word.length;
      continue;
    }

    // Редкая опечатка: лишняя буква, короткая пауза «ой», стирание.
    if (/[a-z]/i.test(ch) && rand() < 0.022) {
      steps.push({ type: 'insert', text: wrongKey(ch, rand), delay: between(rand, 40, 90), typo: true });
      const extra = rand() < 0.4 && /[a-z]/i.test(source[i + 1] ?? '') ? (source[i + 1] ?? '') : '';
      if (extra) steps.push({ type: 'insert', text: extra, delay: between(rand, 40, 90), typo: true });
      steps.push({ type: 'backspace', delay: between(rand, 220, 420), fix: !extra });
      if (extra) steps.push({ type: 'backspace', delay: between(rand, 60, 110), fix: true });
      steps.push({ type: 'insert', text: ch, delay: between(rand, 60, 140) });
      i += 1;
      continue;
    }

    let delay = between(rand, 28, 85);
    if (';{}),'.includes(ch)) delay += between(rand, 40, 140);
    if (ch === ' ' && rand() < 0.1) delay += between(rand, 120, 380);
    steps.push({ type: 'insert', text: ch, delay });
    i += 1;
  }
  return steps;
}

/** Применяет шаги к пустому тексту — для проверок и для перемотки. */
export function applyTypingSteps(steps: TypingStep[], start = ''): string {
  let text = start;
  for (const step of steps) text = step.type === 'insert' ? text + step.text : text.slice(0, -1);
  return text;
}
