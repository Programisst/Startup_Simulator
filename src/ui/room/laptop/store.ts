// Состояние экрана ноутбука: какие окна открыты, что напечатано, где фокус ввода.
import { lineOffset, type SearchResult } from './logic';
import { PROJECT_FILES, type TermLine } from './project';

export type AppId = 'editor' | 'browser';
export type BrowserView = 'newtab' | 'product' | 'results' | 'error' | 'article';

/** Одна страница в браузере. */
export interface Page {
  view: BrowserView;
  url: string;
  query: string;
  /** Для статьи: какой результат поиска открыт. */
  article?: SearchResult;
}

export interface BrowserTab extends Page {
  id: number;
  loading: boolean;
  back: Page[];
  forward: Page[];
}

/** Куда сейчас идут нажатия клавиш. */
export type Focus = 'editor' | 'terminal' | 'omnibox' | 'ntp' | 'srbox' | null;
export type WindowState = 'open' | 'min' | 'closed';

export interface LaptopState {
  app: AppId;
  running: AppId[];
  windows: Record<AppId, WindowState>;
  zoomed: Record<AppId, boolean>;
  bounce: string | null;
  desktopSelected: string | null;

  fileIndex: number;
  openFiles: number[];
  texts: string[];
  dirty: boolean[];
  typo: boolean;
  suggest: { prefix: string; word: string } | null;
  keystroke: number;
  savedAt: number;
  explorerSelected: string;
  collapsed: string[];

  terminalOpen: boolean;
  terminal: TermLine[];
  termInput: string;
  termRunning: boolean;

  tabs: BrowserTab[];
  activeTab: number;
  omnibox: string;
  omniboxFocus: boolean;
  /** Адрес выделен целиком — первое нажатие заменит его. */
  omniSelected: boolean;
  ntpSearch: string;
  ntpFocus: boolean;
  srInput: string;
  pageScroll: number;
  hoverResult: number | null;
  hoverChart: number | null;
  productSection: number;

  focus: Focus;
  mouse: { x: number; y: number; visible: boolean };
  click: number;
  manual: boolean;
}

export function initialTexts(): string[] {
  return PROJECT_FILES.map((f) => f.code.slice(0, lineOffset(f.code, f.writtenLines)));
}

export function newTab(id: number, page: Page = { view: 'newtab', url: '', query: '' }): BrowserTab {
  return { ...page, id, loading: false, back: [], forward: [] };
}

export function initialState(): LaptopState {
  return {
    app: 'editor',
    running: ['editor'],
    windows: { editor: 'open', browser: 'closed' },
    zoomed: { editor: true, browser: true },
    bounce: null,
    desktopSelected: null,
    fileIndex: 0,
    openFiles: [0],
    texts: initialTexts(),
    dirty: PROJECT_FILES.map(() => false),
    typo: false,
    suggest: null,
    keystroke: 0,
    savedAt: 0,
    explorerSelected: 'session.ts',
    collapsed: ['.github', 'node_modules', 'public', 'hooks', 'tests'],
    terminalOpen: false,
    terminal: [],
    termInput: '',
    termRunning: false,
    tabs: [newTab(1)],
    activeTab: 1,
    omnibox: '',
    omniboxFocus: false,
    omniSelected: false,
    ntpSearch: '',
    ntpFocus: false,
    srInput: '',
    pageScroll: 0,
    hoverResult: null,
    hoverChart: null,
    productSection: 0,
    focus: null,
    mouse: { x: 900, y: 520, visible: true },
    click: 0,
    manual: false,
  };
}

export class LaptopStore {
  private state: LaptopState = initialState();
  private listeners = new Set<() => void>();

  get = (): LaptopState => this.state;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  set(patch: Partial<LaptopState> | ((s: LaptopState) => Partial<LaptopState>)): void {
    const next = typeof patch === 'function' ? patch(this.state) : patch;
    this.state = { ...this.state, ...next };
    for (const l of this.listeners) l();
  }
}
