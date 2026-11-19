// «Режиссёр» экрана: что основатель делает дальше. Пишет код кусками, сохраняет,
// гоняет тесты, смотрит свой продукт в браузере, иногда ищет ответ в поисковике.
// Каждый раз начинает с того, что сейчас на экране, — даже если до этого за клавиатурой был игрок.
import type { Actions } from './actions';
import { browserTabCenter, browserTabClose, dockIconCenter, explorerRowCenter, NTP_SEARCH, OMNIBOX, RELOAD, type DockItem } from './layout';
import { lineOffset, repairPrefix, searchUrl } from './logic';
import { foldersOf, PROJECT_FILES, testRunOutput, visibleTree, WRITTEN_FILES } from './project';
import { initialTexts, type AppId, type LaptopStore } from './store';
import { buildTypingScript } from './typing';

class Stopped extends Error {}

const PARK = { x: 1310, y: 330 };

export class Director {
  private stopped = false;
  private cycle = 0;

  /** speed — во сколько раз быстрее обычного (для проверок: room.html?speed=4). */
  constructor(
    private store: LaptopStore,
    private actions: Actions,
    private queries: string[],
    private speed = 1,
  ) {}

  stop(): void {
    this.stopped = true;
  }

  async run(): Promise<void> {
    try {
      await this.sleep(700);
      for (;;) {
        const s = this.store.get();
        const order = [...WRITTEN_FILES].sort((a, b) => (a.i === s.fileIndex ? -1 : b.i === s.fileIndex ? 1 : a.i - b.i));
        const next = order.find(({ f, i }) => repairPrefix(s.texts[i] ?? '', f.code).length < f.code.length);
        if (!next) {
          // Всё написано — новая задача с того же места.
          await this.sleep(1500);
          this.store.set({ texts: initialTexts(), openFiles: [0], fileIndex: 0, explorerSelected: 'session.ts' });
          continue;
        }
        await this.writeFile(next.i);
      }
    } catch (e) {
      if (!(e instanceof Stopped)) throw e;
    }
  }

  private ms(value: number): number {
    return value / this.speed;
  }

  private async sleep(ms: number): Promise<void> {
    let left = this.ms(ms);
    while (left > 0) {
      if (this.stopped) throw new Stopped();
      const chunk = Math.min(left, 50);
      await new Promise((r) => setTimeout(r, chunk));
      left -= chunk;
    }
    if (this.stopped) throw new Stopped();
  }

  private async moveMouse(to: { x: number; y: number }, ms = 650): Promise<void> {
    this.store.set({ mouse: { ...to, visible: true } });
    await this.sleep(ms);
  }

  private async click(): Promise<void> {
    this.store.set({ click: Date.now() });
    await this.sleep(160);
  }

  private async openApp(app: AppId): Promise<void> {
    const s = this.store.get();
    if (s.app === app && s.windows[app] === 'open') return;
    await this.moveMouse(dockIconCenter(app as DockItem), 750);
    await this.click();
    if (!s.running.includes(app)) {
      this.store.set({ bounce: app });
      await this.sleep(900);
      this.store.set({ bounce: null });
    }
    this.actions.openApp(app);
    await this.sleep(500);
  }

  // ——— Код ———

  private async writeFile(f: number): Promise<void> {
    const file = PROJECT_FILES[f]!;
    await this.openApp('editor');
    if (this.store.get().fileIndex !== f) {
      // Раскрывает папки и кликает по файлу в дереве.
      const folders = foldersOf(file.name);
      this.store.set((s) => ({ collapsed: s.collapsed.filter((c) => !folders.includes(c)) }));
      const rows = visibleTree(this.store.get().collapsed);
      const row = rows.findIndex((n) => n.name === file.name);
      await this.moveMouse(explorerRowCenter(row, rows[row]?.depth ?? 0), 800);
      await this.click();
      this.actions.openFile(f);
      this.store.set({ terminalOpen: false, focus: null });
      await this.sleep(700);
    }
    await this.moveMouse(PARK, 600);

    const lines = file.code.split('\n');
    if (lines[lines.length - 1] === '') lines.pop();
    const stops = [...file.breaks, lines.length].map((l) => lineOffset(file.code, l));
    for (const stop of stops) {
      const current = repairPrefix(this.store.get().texts[f] ?? '', file.code);
      if (current.length >= stop) continue;
      await this.openApp('editor');
      if (this.store.get().fileIndex !== f) this.actions.openFile(f);
      this.store.set((s) => ({ texts: s.texts.map((t, k) => (k === f ? current : t)), typo: false, focus: null }));
      if (this.store.get().terminalOpen) {
        this.store.set({ terminalOpen: false });
        await this.sleep(400);
      }
      await this.typeSource(f, file.code.slice(current.length, stop));
      await this.save(f);
      await this.runTests();
      await this.visitBrowser();
    }
  }

  private async typeSource(f: number, source: string): Promise<void> {
    const before = this.store.get().texts[f] ?? '';
    const atLineStart = before === '' || before.endsWith('\n');
    const indent = atLineStart ? (/^[ ]+/.exec(source)?.[0] ?? '') : '';
    if (indent) this.applyInsert(f, indent);
    const steps = buildTypingScript(source.slice(indent.length), 1000 * f + this.cycle * 7 + source.length);
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i]!;
      const next = steps[i + 1];
      await this.sleep(step.delay * 0.85);
      if (step.type === 'backspace') {
        this.store.set((s) => ({
          texts: s.texts.map((t, k) => (k === f ? t.slice(0, -1) : t)),
          typo: step.fix ? false : s.typo,
          keystroke: s.keystroke + 1,
        }));
        continue;
      }
      this.applyInsert(f, step.text, step.typo);
      if (step.accept) this.store.set({ suggest: null });
      if (next?.type === 'insert' && next.accept) {
        const text = this.store.get().texts[f] ?? '';
        const prefix = /[\w$]+$/.exec(text)?.[0] ?? '';
        if (prefix) this.store.set({ suggest: { prefix, word: prefix + next.text } });
      }
    }
  }

  private applyInsert(f: number, text: string, typo = false): void {
    if (!text) return;
    this.store.set((s) => ({
      texts: s.texts.map((t, k) => (k === f ? t + text : t)),
      dirty: s.dirty.map((d, k) => (k === f ? true : d)),
      typo: typo ? true : s.typo,
      keystroke: s.keystroke + 1,
    }));
  }

  private async save(f: number): Promise<void> {
    await this.sleep(450);
    this.store.set((s) => ({ dirty: s.dirty.map((d, k) => (k === f ? false : d)), savedAt: Date.now() }));
    await this.sleep(600);
  }

  // ——— Терминал ———

  private async runTests(): Promise<void> {
    if (!this.store.get().terminalOpen) {
      this.store.set({ terminalOpen: true });
      await this.sleep(550);
    }
    this.store.set({ termInput: '' });
    await this.typeField('termInput', 'npm test');
    await this.sleep(260);
    this.store.set((s) => ({
      terminal: [...s.terminal, { text: 'founder@laptop pulse-app % npm test', tone: 'prompt' as const }],
      termInput: '',
      termRunning: true,
    }));
    for (const { line, delay } of testRunOutput()) {
      await this.sleep(delay);
      this.store.set((s) => ({ terminal: [...s.terminal, line].slice(-80) }));
    }
    this.store.set({ termRunning: false });
    await this.sleep(1700);
  }

  private async typeField(field: 'termInput' | 'omnibox' | 'ntpSearch', text: string): Promise<void> {
    for (const ch of text) {
      await this.sleep(45 + Math.random() * 90);
      this.store.set((s) => ({ [field]: s[field] + ch, keystroke: s.keystroke + 1 }) as Partial<typeof s>);
    }
  }

  // ——— Браузер ———

  private async scrollPage(to: number, ms: number): Promise<void> {
    const from = this.store.get().pageScroll;
    const steps = Math.max(1, Math.round(this.ms(ms) / 40));
    for (let i = 1; i <= steps; i++) {
      await this.sleep(40 * this.speed);
      const t = i / steps;
      const ease = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
      this.store.set({ pageScroll: from + (to - from) * ease });
    }
  }

  private async visitBrowser(): Promise<void> {
    this.cycle += 1;
    await this.openApp('browser');
    const s = this.store.get();
    const product = s.tabs.find((t) => t.view === 'product');

    if (!product) {
      // Набирает адрес своего продукта в адресной строке.
      await this.moveMouse(OMNIBOX, 700);
      await this.click();
      this.store.set({ omniboxFocus: true, omnibox: '', omniSelected: false, focus: 'omnibox' });
      await this.typeField('omnibox', 'localhost:5173');
      await this.sleep(300);
      this.actions.goTo({ view: 'product', url: 'localhost:5173', query: '' }, this.ms(1300));
      this.store.set({ omnibox: '' });
      await this.sleep(1300);
    } else {
      const index = s.tabs.indexOf(product);
      if (s.activeTab !== product.id) {
        await this.moveMouse(browserTabCenter(index), 700);
        await this.click();
        this.actions.selectTab(product.id);
        await this.sleep(300);
      }
      // Обновляет страницу, чтобы увидеть свежие изменения.
      await this.moveMouse(RELOAD, 650);
      await this.click();
      this.actions.reload(this.ms(900));
      await this.sleep(900);
    }

    // Смотрит график и листает страницу.
    await this.moveMouse({ x: 980, y: 560 }, 800);
    for (const day of [18, 22, 26]) {
      this.store.set({ hoverChart: day, mouse: { x: 650 + day * 22, y: 560, visible: true } });
      await this.sleep(420);
    }
    this.store.set({ hoverChart: null });
    await this.scrollPage(300, 1500);
    await this.sleep(1300);
    await this.scrollPage(0, 1100);
    await this.sleep(500);

    if (this.cycle % 2 === 1) await this.searchSomething();
  }

  private async searchSomething(): Promise<void> {
    const query = this.queries[(this.cycle >> 1) % this.queries.length] ?? '';
    const id = this.actions.newTab(false);
    await this.sleep(700);
    await this.moveMouse(NTP_SEARCH, 750);
    await this.click();
    this.store.set({ ntpFocus: true, focus: 'ntp', ntpSearch: '' });
    await this.typeField('ntpSearch', query);
    await this.sleep(450);
    this.actions.goTo({ view: 'results', query, url: searchUrl(query) }, this.ms(1000));
    this.store.set({ ntpSearch: '' });
    await this.sleep(1000);

    // Пробегает глазами по результатам.
    for (const i of [0, 1, 2, 0]) {
      this.store.set({ hoverResult: i, mouse: { x: 520, y: 470 + i * 112, visible: true } });
      await this.sleep(900);
    }
    this.store.set({ hoverResult: null });
    await this.sleep(700);

    // Закрывает вкладку.
    const index = this.store.get().tabs.findIndex((t) => t.id === id);
    if (index < 0) return;
    await this.moveMouse(browserTabClose(index), 700);
    await this.click();
    this.actions.closeTab(id);
    await this.sleep(400);
  }
}
