// Экран редактора кода, как в VS Code: панель файлов, вкладка, путь к файлу, код с номерами строк,
// линиями отступов и подсветкой текущей строки, миникарта. Общий для монитора в комнате и iMac в окне заставки.
import { highlightLine } from '../laptop/highlight';
import { WRITTEN_FILES } from '../laptop/project';
import { explorerRows, fitText, type MonitorTyping } from './monitor';

/** Цвет значка файла в панели файлов на мониторе. */
export const FILE_ICON: Record<string, string> = { ts: '#3178c6', tsx: '#4fc1ff', json: '#cbcb41', md: '#519aba', example: '#e5c07b', gitignore: '#f05133' };
/** Цвета кода — как в редакторе компьютера (laptop.css, .tk-*). */
export const TOKEN_COLORS: Record<string, string> = {
  keyword: '#569cd6',
  tag: '#569cd6',
  control: '#c586c0',
  type: '#4ec9b0',
  function: '#dcdcaa',
  string: '#ce9178',
  number: '#b5cea8',
  comment: '#6a9955',
  property: '#9cdcfe',
  variable: '#9cdcfe',
  constant: '#4fc1ff',
  punct: '#b4b4b4',
};


/**
 * Настоящий редактор на мониторе: панель файлов, вкладка, путь к файлу, код с номерами строк,
 * линиями отступов и подсветкой текущей строки, миникарта справа. Рисуется поверх увеличенной сцены
 * в точных пикселях экрана: размеры и координаты округлены, чтобы буквы были чёткими.
 */
export function drawEditorScreen(c: CanvasRenderingContext2D, rect: { x: number; y: number; w: number; h: number }, monitor: MonitorTyping, time: number, amount: number): void {
  if (amount <= 0) return;
  const X = Math.round(rect.x);
  const Y = Math.round(rect.y);
  const W = Math.round(rect.w);
  const H = Math.round(rect.h);
  const s = W / 20; // единица толщины: как пиксель сцены у монитора в комнате
  const px = Math.max(1, Math.round(s / 12)); // толщина тонкой линии
  const R = Math.round;

  // Размеры от высоты экрана: около двенадцати строк кода.
  const font = Math.max(4, R(H / 18.5));
  const line = R(font * 1.42);
  const small = Math.max(4, font - 1);
  const mono = (f: number) => `${f}px Menlo, ui-monospace, Consolas, monospace`;
  const sans = (f: number) => `${f}px -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif`;

  c.save();
  c.globalAlpha = amount;
  c.beginPath();
  c.rect(X, Y, W, H);
  c.clip();
  c.textBaseline = 'middle';
  c.fillStyle = '#1f1f1f';
  c.fillRect(X, Y, W, H);

  // ── Панель файлов
  const ew = R(W * 0.24);
  c.fillStyle = '#181818';
  c.fillRect(X, Y, ew, H);
  c.fillStyle = '#2b2b2b';
  c.fillRect(X + ew - px, Y, px, H);
  const eLine = R(small * 1.55);
  const step = R(small * 0.75); // сдвиг на один уровень вложенности
  c.font = sans(small);
  const tree = explorerRows(monitor.fileName, Math.floor((H - R(font * 0.4)) / eLine));
  tree.forEach((r, i) => {
    const top = Y + R(font * 0.3) + i * eLine;
    const cy = top + R(eLine / 2);
    if (r.active) {
      c.fillStyle = '#37373d';
      c.fillRect(X, top, ew - px, eLine);
      c.fillStyle = '#0078d4';
      c.fillRect(X, top, px, eLine);
    }
    // Линии вложенности, как в редакторе.
    c.fillStyle = '#2f2f2f';
    for (let d = 1; d <= r.node.depth; d++) c.fillRect(X + R(small * 0.7) + (d - 1) * step + R(step / 2), top, px, eLine);
    const ix = X + R(small * 0.55) + r.node.depth * step;
    if (r.node.folder) {
      // Стрелка папки: вниз — открыта, вправо — закрыта.
      const a = Math.max(2, R(small * 0.28));
      c.strokeStyle = '#c5c5c5';
      c.lineWidth = px;
      c.beginPath();
      if (r.node.open) {
        c.moveTo(ix, cy - a / 2);
        c.lineTo(ix + a, cy + a / 2);
        c.lineTo(ix + 2 * a, cy - a / 2);
      } else {
        c.moveTo(ix + a / 2, cy - a);
        c.lineTo(ix + a * 1.5, cy);
        c.lineTo(ix + a / 2, cy + a);
      }
      c.stroke();
    } else {
      const ext = r.node.name.split('.').pop() ?? '';
      const box = Math.max(2, R(small * 0.5));
      c.fillStyle = FILE_ICON[ext] ?? '#8a8a8a';
      c.fillRect(ix + R(small * 0.1), cy - R(box / 2), box, box);
    }
    const nx = ix + R(small * 0.95);
    // Буква изменения справа (M — изменён, U — новый), имя обрезается многоточием до неё.
    const badge = r.node.git ?? '';
    const badgeW = badge ? R(c.measureText('M').width + small * 0.6) : R(small * 0.4);
    const color = r.node.dim ? '#6e7681' : r.node.git === 'M' ? '#e2c08d' : r.node.git === 'U' ? '#73c991' : '#cccccc';
    c.fillStyle = color;
    c.fillText(fitText(c, r.node.name, X + ew - px - badgeW - nx), nx, cy);
    if (badge) c.fillText(badge, X + ew - px - badgeW + R(small * 0.25), cy);
  });

  // ── Редактор справа
  const CX = X + ew;
  const CW = W - ew;
  const tab = R(font * 1.9);
  c.fillStyle = '#181818';
  c.fillRect(CX, Y, CW, tab);
  c.fillStyle = '#2b2b2b';
  c.fillRect(CX, Y + tab - px, CW, px);
  // Вкладка открытого файла: значок, имя, крестик.
  const name = monitor.fileName;
  c.font = sans(small);
  const nameW = R(c.measureText(name).width);
  const tabW = nameW + R(small * 3.4);
  c.fillStyle = '#1f1f1f';
  c.fillRect(CX, Y, tabW, tab);
  c.fillStyle = '#0078d4';
  c.fillRect(CX, Y, tabW, px);
  const ext = name.split('.').pop() ?? '';
  const box = Math.max(2, R(small * 0.5));
  c.fillStyle = FILE_ICON[ext] ?? '#8a8a8a';
  c.fillRect(CX + R(small * 0.7), Y + R(tab / 2) - R(box / 2), box, box);
  c.fillStyle = '#ffffff';
  c.fillText(name, CX + R(small * 1.5), Y + R(tab / 2));
  c.fillStyle = '#8b8b8b';
  c.fillText('×', CX + tabW - R(small * 1.2), Y + R(tab / 2));

  // Путь к файлу под вкладкой.
  const crumbs = R(font * 1.5);
  const path = [...(WRITTEN_FILES.find(({ f }) => f.name === name)?.f.path ?? []), name].join('  ›  ');
  c.fillStyle = '#a0a0a0';
  c.font = sans(Math.max(4, small - 1));
  c.fillText(fitText(c, path, CW - R(font)), CX + R(font * 0.8), Y + tab + R(crumbs / 2));

  // Код.
  c.font = mono(font);
  const charW = c.measureText('M').width;
  const mapW = R(font * 1.8); // миникарта
  const gutter = R(charW * 3.2);
  const codeX = CX + gutter + R(charW * 0.6);
  const top = Y + tab + crumbs;
  const cols = Math.max(8, Math.floor((CW - gutter - R(charW * 0.6) - mapW - charW) / charW));
  const rows = monitor.rows(cols, Math.floor((H - tab - crumbs) / line));
  rows.forEach((row, r) => {
    const rt = top + r * line;
    const cy = rt + R(line / 2);
    if (row.caret !== null) {
      // Подсветка строки с курсором.
      c.fillStyle = '#2a2a2a';
      c.fillRect(CX, rt, CW - mapW, line);
    }
    if (row.number !== null) {
      c.fillStyle = row.caret !== null ? '#cccccc' : '#6e7681';
      c.font = mono(font);
      const num = String(row.number);
      c.textAlign = 'right';
      c.fillText(num, CX + gutter, cy);
      c.textAlign = 'left';
    }
    // Линии отступов: по одной на каждые два пробела в начале строки.
    const lead = row.number !== null ? (row.tokens[0]?.kind === 'space' ? row.tokens[0].text.length : 0) : row.indent;
    c.fillStyle = '#404040';
    for (let k = 2; k <= lead; k += 2) {
      if (row.number === null && k > lead - 2) break;
      c.fillRect(R(codeX + (k - 2) * charW), rt, px, line);
    }
    c.font = mono(font);
    let col = row.indent;
    for (const t of row.tokens) {
      if (t.kind !== 'space') {
        c.fillStyle = TOKEN_COLORS[t.kind] ?? '#cccccc';
        c.fillText(t.text, R(codeX + col * charW), cy);
      }
      col += t.text.length;
    }
    if (row.caret !== null && Math.floor(time * 2) % 2 === 0) {
      c.fillStyle = '#aeafad';
      c.fillRect(R(codeX + (row.indent + row.caret) * charW), rt + R(line * 0.12), Math.max(1, px), line - R(line * 0.24));
    }
  });

  // Миникарта: весь файл в маленьких цветных чёрточках, видимая часть подсвечена.
  const mapX = X + W - mapW;
  c.fillStyle = '#1f1f1f';
  c.fillRect(mapX, top, mapW, H - tab - crumbs);
  const all = monitor.text.split('\n');
  const mh = Math.max(1, Math.min(px * 2, R((H - tab - crumbs) / Math.max(all.length, 1))));
  const cw = Math.max(0.5, (mapW - px * 2) / 60);
  all.forEach((src, i) => {
    let col = 0;
    for (const t of highlightLine(src)) {
      if (t.kind !== 'space' && t.text.trim()) {
        c.fillStyle = TOKEN_COLORS[t.kind] ?? '#cccccc';
        c.globalAlpha = amount * 0.55;
        c.fillRect(mapX + px + col * cw, top + px + i * mh, Math.max(px / 2, t.text.length * cw), Math.max(1, mh - (mh > 1 ? 1 : 0)));
      }
      col += t.text.length;
    }
  });
  c.globalAlpha = amount;
  const firstShown = rows[0]?.number ?? 1;
  c.fillStyle = 'rgba(255,255,255,0.07)';
  c.fillRect(mapX, top + px + (firstShown - 1) * mh, mapW, Math.max(mh * rows.length, px * 4));
  c.fillStyle = '#2b2b2b';
  c.fillRect(mapX, top, px, H - tab - crumbs);

  c.restore();
}
