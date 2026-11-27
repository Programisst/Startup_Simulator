// Действия на экране ноутбука. Их вызывают и мышь с клавиатурой игрока, и «режиссёр»,
// поэтому компьютер ведёт себя одинаково, кто бы за ним ни сидел.
import { advanceCode, navigateFromInput, repairPrefix, runCommand, type Nav, type SearchResult } from './logic';
import { foldersOf, PROJECT_FILES, testRunOutput, WRITTEN_FILES } from './project';
import { initialTexts, newTab, type AppId, type BrowserTab, type Focus, type LaptopStore, type Page } from './store';

const SCROLL_LIMIT: Record<string, number> = { product: 420, results: 700, article: 620 };

function navToPage(nav: Nav): Page {
  return { view: nav.view, url: nav.url, query: nav.view === 'results' ? nav.query : '' };
}

export class Actions {
  private nextTabId = 100;
  private timers = new Set<number>();

  constructor(private store: LaptopStore) {}

  dispose(): void {
    for (const id of this.timers) window.clearTimeout(id);
    this.timers.clear();
  }

  private later(ms: number, fn: () => void): void {
    const id = window.setTimeout(() => {
      this.timers.delete(id);
      fn();
    }, ms);
    this.timers.add(id);
  }

  private get s() {
    return this.store.get();
  }

  // ——— Окна ———

  openApp(app: AppId): void {
    this.store.set((s) => ({
      app,
      running: s.running.includes(app) ? s.running : [...s.running, app],
      windows: { ...s.windows, [app]: 'open' },
    }));
  }

  windowControl(app: AppId, kind: 'close' | 'min' | 'zoom'): void {
    if (kind === 'zoom') {
      this.store.set((s) => ({ zoomed: { ...s.zoomed, [app]: !s.zoomed[app] } }));
      return;
    }
    this.store.set((s) => {
      const windows = { ...s.windows, [app]: kind === 'close' ? 'closed' : 'min' } as const;
      const other: AppId = app === 'editor' ? 'browser' : 'editor';
      return { windows, app: windows[other] === 'open' ? other : s.app, focus: null, omniboxFocus: false, ntpFocus: false };
    });
  }

  bringToFront(app: AppId): void {
    if (this.s.windows[app] === 'open' && this.s.app !== app) this.store.set({ app });
  }

  setFocus(focus: Focus): void {
    if (this.s.focus !== focus) this.store.set({ focus, omniboxFocus: focus === 'omnibox', ntpFocus: focus === 'ntp' });
  }

  clearTerminal(): void {
    this.store.set({ terminal: [] });
  }

  selectDesktop(name: string | null): void {
    this.store.set({ desktopSelected: name, focus: null, omniboxFocus: false, ntpFocus: false });
  }

  // ——— Редактор ———

  openFile(index: number): void {
    const file = PROJECT_FILES[index];
    if (!file) return;
    const folders = foldersOf(file.name);
    this.store.set((s) => ({
      app: 'editor',
      windows: { ...s.windows, editor: 'open' },
      fileIndex: index,
      openFiles: s.openFiles.includes(index) ? s.openFiles : [...s.openFiles, index],
      explorerSelected: file.name,
      collapsed: s.collapsed.filter((c) => !folders.includes(c)),
      focus: 'editor',
    }));
  }

  selectTreeRow(name: string, folder: boolean): void {
    if (folder) {
      this.store.set((s) => ({
        explorerSelected: name,
        collapsed: s.collapsed.includes(name) ? s.collapsed.filter((c) => c !== name) : [...s.collapsed, name],
      }));
      return;
    }
    const index = PROJECT_FILES.findIndex((f) => f.name === name);
    if (index >= 0) this.openFile(index);
    else this.store.set({ explorerSelected: name });
  }

  closeFile(index: number): void {
    this.store.set((s) => {
      const openFiles = s.openFiles.filter((i) => i !== index);
      const pos = s.openFiles.indexOf(index);
      const fileIndex = s.fileIndex !== index ? s.fileIndex : (openFiles[Math.min(pos, openFiles.length - 1)] ?? -1);
      return { openFiles, fileIndex };
    });
  }

  /** Нажатие любой клавиши в редакторе — следующий кусок настоящего кода. */
  typeCode(): void {
    const s = this.s;
    const file = PROJECT_FILES[s.fileIndex];
    const writable = file !== undefined && !file.static;
    const text = s.texts[s.fileIndex] ?? '';
    const next = writable ? advanceCode(text, file.code, 2 + Math.floor(Math.random() * 3)) : text;
    if (next === text) {
      // Печатать здесь нечего: файл дописан, открыт готовый файл или не открыт никакой. Код при этом не кончается —
      // основатель берётся за следующий недописанный файл, а когда дописаны все, начинает новую задачу
      // с того же места (как и «режиссёр», когда печатает сам). Нажатия игрока всё это время идут в зачёт работы.
      const unfinished = WRITTEN_FILES.find(({ f, i }) => repairPrefix(s.texts[i] ?? '', f.code).length < f.code.length);
      if (!unfinished) this.store.set({ texts: initialTexts() });
      const target = unfinished?.i ?? WRITTEN_FILES.find(({ i }) => i !== s.fileIndex)?.i ?? WRITTEN_FILES[0]?.i;
      if (target === undefined) return;
      this.openFile(target);
      this.typeCode();
      return;
    }
    this.store.set((st) => ({
      texts: st.texts.map((t, i) => (i === st.fileIndex ? next : t)),
      dirty: st.dirty.map((d, i) => (i === st.fileIndex ? true : d)),
      typo: false,
      suggest: null,
      keystroke: st.keystroke + 1,
      focus: 'editor',
    }));
  }

  save(): void {
    this.store.set((s) => ({ dirty: s.dirty.map((d, i) => (i === s.fileIndex ? false : d)), savedAt: Date.now() }));
  }

  toggleTerminal(open = !this.s.terminalOpen): void {
    this.store.set({ terminalOpen: open, focus: open ? 'terminal' : 'editor' });
  }

  terminalEnter(): void {
    const cmd = this.s.termInput;
    const result = runCommand(cmd);
    this.store.set((s) => ({
      terminal: result.clear ? [] : [...s.terminal, { text: `founder@laptop pulse-app % ${cmd}`, tone: 'prompt' as const }, ...result.lines].slice(-80),
      termInput: '',
    }));
    if (!result.tests) return;
    this.store.set({ termRunning: true });
    let at = 0;
    for (const { line, delay } of testRunOutput()) {
      at += delay;
      this.later(at, () => this.store.set((s) => ({ terminal: [...s.terminal, line].slice(-80) })));
    }
    this.later(at + 50, () => this.store.set({ termRunning: false }));
  }

  // ——— Браузер ———

  activeTab(): BrowserTab | undefined {
    return this.s.tabs.find((t) => t.id === this.s.activeTab);
  }

  private patchActive(patch: Partial<BrowserTab>): void {
    this.store.set((s) => ({ tabs: s.tabs.map((t) => (t.id === s.activeTab ? { ...t, ...patch } : t)) }));
  }

  /** Открыть страницу в текущей вкладке: старая уходит в историю «назад». */
  goTo(page: Page, loadMs = 700): void {
    const tab = this.activeTab();
    if (!tab) return;
    const current: Page = { view: tab.view, url: tab.url, query: tab.query, article: tab.article };
    const back = tab.view === 'newtab' && !tab.url ? tab.back : [...tab.back, current];
    this.patchActive({ ...page, article: page.article, back, forward: [], loading: true });
    this.store.set({ pageScroll: 0, hoverResult: null, hoverChart: null, omniboxFocus: false, ntpFocus: false, focus: null, srInput: page.query });
    const id = tab.id;
    this.later(loadMs, () => this.store.set((s) => ({ tabs: s.tabs.map((t) => (t.id === id ? { ...t, loading: false } : t)) })));
  }

  navigate(input: string): void {
    this.goTo(navToPage(navigateFromInput(input)));
  }

  openResult(result: SearchResult): void {
    const url = result.url.replace(/\s*›\s*/g, '/');
    this.goTo({ view: 'article', url, query: this.activeTab()?.query ?? '', article: result }, 600);
  }

  back(): void {
    const tab = this.activeTab();
    const prev = tab?.back[tab.back.length - 1];
    if (!tab || !prev) return;
    const current: Page = { view: tab.view, url: tab.url, query: tab.query, article: tab.article };
    this.patchActive({ ...prev, back: tab.back.slice(0, -1), forward: [current, ...tab.forward], loading: false });
    this.store.set({ pageScroll: 0, srInput: prev.query });
  }

  forward(): void {
    const tab = this.activeTab();
    const next = tab?.forward[0];
    if (!tab || !next) return;
    const current: Page = { view: tab.view, url: tab.url, query: tab.query, article: tab.article };
    this.patchActive({ ...next, back: [...tab.back, current], forward: tab.forward.slice(1), loading: false });
    this.store.set({ pageScroll: 0, srInput: next.query });
  }

  reload(ms = 800): void {
    const tab = this.activeTab();
    if (!tab || tab.view === 'newtab') return;
    this.patchActive({ loading: true });
    this.store.set({ pageScroll: 0 });
    const id = tab.id;
    this.later(ms, () => this.store.set((s) => ({ tabs: s.tabs.map((t) => (t.id === id ? { ...t, loading: false } : t)) })));
  }

  newTab(focusAddress = true): number {
    const id = this.nextTabId++;
    this.store.set((s) => ({
      tabs: [...s.tabs, newTab(id)],
      activeTab: id,
      pageScroll: 0,
      omnibox: '',
      omniboxFocus: focusAddress,
      omniSelected: false,
      ntpFocus: false,
      focus: focusAddress ? 'omnibox' : null,
    }));
    return id;
  }

  selectTab(id: number): void {
    this.store.set((s) => ({ activeTab: id, pageScroll: 0, omniboxFocus: false, ntpFocus: false, focus: null, srInput: s.tabs.find((t) => t.id === id)?.query ?? '' }));
  }

  closeTab(id: number): void {
    const s = this.s;
    if (s.tabs.length === 1) {
      // Закрыли последнюю вкладку — закрывается и окно, как в настоящем браузере.
      const fresh = this.nextTabId++;
      this.store.set({ tabs: [newTab(fresh)], activeTab: fresh });
      this.windowControl('browser', 'close');
      return;
    }
    const index = s.tabs.findIndex((t) => t.id === id);
    const tabs = s.tabs.filter((t) => t.id !== id);
    const activeTab = s.activeTab === id ? (tabs[Math.min(index, tabs.length - 1)]?.id ?? tabs[0]!.id) : s.activeTab;
    this.store.set({ tabs, activeTab, pageScroll: 0 });
  }

  focusOmnibox(): void {
    const url = this.activeTab()?.url ?? '';
    this.store.set({ omniboxFocus: true, omnibox: url, omniSelected: url.length > 0, ntpFocus: false, focus: 'omnibox' });
  }

  focusNtp(): void {
    this.store.set({ ntpFocus: true, omniboxFocus: false, focus: 'ntp' });
  }

  focusSearchBox(): void {
    this.store.set({ focus: 'srbox', omniboxFocus: false, ntpFocus: false });
  }

  blurInputs(): void {
    this.store.set({ omniboxFocus: false, ntpFocus: false, focus: this.s.focus === 'terminal' || this.s.focus === 'editor' ? this.s.focus : null });
  }

  setProductSection(section: number): void {
    this.store.set({ productSection: section, pageScroll: 0 });
  }

  scrollPage(delta: number): void {
    const view = this.activeTab()?.view ?? 'newtab';
    const max = SCROLL_LIMIT[view] ?? 0;
    this.store.set((s) => ({ pageScroll: Math.max(0, Math.min(max, s.pageScroll + delta)) }));
  }

  // ——— Клавиатура игрока ———

  /** Возвращает true, если нажатие обработано экраном ноутбука. */
  handleKey(e: KeyboardEvent): boolean {
    if (e.key === 'Escape') return false;
    const s = this.s;
    const mod = e.metaKey || e.ctrlKey;
    if (mod) {
      if (e.code === 'KeyS' && s.app === 'editor') this.save();
      else if (e.code === 'Backquote' && s.app === 'editor') this.toggleTerminal();
      else if (e.code === 'KeyT' && s.app === 'browser') this.newTab();
      else if (e.code === 'KeyL' && s.app === 'browser') this.focusOmnibox();
      else if (e.code === 'KeyW') {
        if (s.app === 'browser') this.closeTab(s.activeTab);
        else if (s.fileIndex >= 0) this.closeFile(s.fileIndex);
      } else return false;
      return true;
    }

    const printable = e.key.length === 1;
    const field = s.focus === 'omnibox' ? 'omnibox' : s.focus === 'ntp' ? 'ntpSearch' : s.focus === 'srbox' ? 'srInput' : s.focus === 'terminal' ? 'termInput' : null;
    if (field) {
      if (printable) {
        this.store.set((st) => {
          const replace = field === 'omnibox' && st.omniSelected;
          return { [field]: (replace ? '' : st[field]) + e.key, omniSelected: false, keystroke: st.keystroke + 1 } as Partial<typeof st>;
        });
      } else if (e.key === 'Backspace') {
        this.store.set((st) => {
          const clear = field === 'omnibox' && st.omniSelected;
          return { [field]: clear ? '' : st[field].slice(0, -1), omniSelected: false, keystroke: st.keystroke + 1 } as Partial<typeof st>;
        });
      } else if (e.key === 'Enter') {
        if (field === 'termInput') this.terminalEnter();
        else this.navigate(s[field]);
      } else return false;
      return true;
    }

    if (s.app === 'editor' && s.windows.editor === 'open' && (printable || e.key === 'Enter' || e.key === 'Tab')) {
      this.typeCode();
      return true;
    }
    return false;
  }
}
