// Ноутбук основателя крупным планом. Внутри — «экран» 1440×900, который масштабируется под окно.
// Пока игрок не трогает мышь и клавиатуру, работает основатель. Любой клик или клавиша — и управление у игрока.
import { useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Actions } from './actions';
import { BrowserWindow } from './BrowserWindow';
import { Director } from './director';
import { EditorWindow } from './EditorWindow';
import { DeskView } from './DeskView';
import { DockGlyph, Icon } from './icons';
import { Landscape } from './Landscape';
import { dockIconCenter, DOCK_H, DOCK_ITEMS, DOCK_W, DOCK_X, DOCK_Y, MENU_H, SCREEN_H, SCREEN_W, WINDOW, type DockItem } from './layout';
import { repairPrefix } from './logic';
import { PROJECT_FILES } from './project';
import { LaptopStore, type AppId, type LaptopState } from './store';
import './laptop.css';

/** Окно не на весь экран (после зелёной кнопки). */
const SMALL_WINDOW = { x: 150, y: 76, w: 1140, h: 690 };

interface DesktopItem {
  name: string;
  kind: 'pdf' | 'sheet' | 'image' | 'folder';
}

function clock(minutes: number): string {
  const m = Math.floor(minutes) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

function windowStyle(s: LaptopState, app: AppId): { style: CSSProperties; height: number } {
  const box = s.zoomed[app] ? WINDOW : SMALL_WINDOW;
  const dock = dockIconCenter(app);
  return {
    height: box.h,
    style: {
      left: box.x,
      top: box.y,
      width: box.w,
      height: box.h,
      // Сворачивание «втягивает» окно в его иконку в доке.
      transformOrigin: `${dock.x - box.x}px ${dock.y - box.y}px`,
    },
  };
}

function windowClass(s: LaptopState, app: AppId): string {
  const state = s.windows[app];
  if (state === 'min') return 'os-window min';
  if (state === 'closed') return 'os-window closed';
  return `os-window${s.app === app ? ' front' : ' back'}`;
}

function DesktopIcon({ kind }: { kind: DesktopItem['kind'] }) {
  if (kind === 'folder') {
    return (
      <svg viewBox="0 0 64 52">
        <path d="M2 8a5 5 0 0 1 5-5h15l6 6h29a5 5 0 0 1 5 5v31a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5z" fill="#5aa9f0" />
        <path d="M2 16h60v29a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5z" fill="#7cc0fa" />
      </svg>
    );
  }
  const badge = { pdf: ['PDF', '#e2483d'], sheet: ['XLSX', '#1f9d55'], image: ['PNG', '#7b61ff'] }[kind];
  return (
    <svg viewBox="0 0 52 64">
      <path d="M4 3h30l14 14v42a3 3 0 0 1-3 3H4a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3z" fill="#fbfbfd" />
      <path d="M34 3v11a3 3 0 0 0 3 3h11" fill="#e4e5ea" />
      {kind === 'image' ? (
        <>
          <rect x="8" y="24" width="36" height="24" rx="3" fill="#ede9ff" />
          <path d="M10 46l10-12 8 8 6-6 8 10z" fill="#7b61ff" />
          <circle cx="35" cy="31" r="3" fill="#ffb84d" />
        </>
      ) : kind === 'sheet' ? (
        [26, 32, 38, 44].map((y) => <rect key={y} x="9" y={y} width="34" height="3" rx="1" fill="#d6ecdf" />)
      ) : (
        [24, 30, 36, 42].map((y) => <rect key={y} x="9" y={y} width={y === 42 ? 20 : 34} height="3" rx="1" fill="#e5e6eb" />)
      )}
      <rect x="6" y="50" width="26" height="10" rx="2" fill={badge[1]} />
      <text x="19" y="57.6" textAnchor="middle" fontSize="7" fontWeight="700" fill="#fff" fontFamily="system-ui">
        {badge[0]}
      </text>
    </svg>
  );
}

interface Props {
  fullscreen?: boolean;
  minutes: number;
  weekday: string;
  origin: { x: number; y: number };
  closing: boolean;
  onClosed: () => void;
  /** Программа «Компания» из игры. Если задана, она открыта поверх остальных окон, а управление сразу у игрока. */
  company?: ReactNode;
  /** Игрок сам набрал знак кода в редакторе */
  onTyped?: () => void;
  /** Игрок нажал значок программы на нижней панели (кроме редактора и браузера) */
  onDockApp?: (item: DockItem) => void;
  /** Строка о том, что даёт набор кода, — показывается, пока открыт редактор */
  focusText?: string;
  /** Название программы в верхней строке, если поверх открыта не «Компания» (например, мессенджер в начале игры). */
  appTitle?: string;
  /** Можно ли отойти от экрана по Esc (в начале игры — нельзя, пока не договорили с другом). */
  canLeave?: boolean;
  /** Пауза, скорость и сохранение — те же плашки, что в квартире; стоят в углу рядом с подсказкой «Esc». */
  controls?: ReactNode;
}

export function Laptop({ minutes, weekday, origin, closing, onClosed, company, onTyped, onDockApp, focusText, appTitle, canLeave = true, controls, fullscreen = false }: Props) {
  const typedRef = useRef(onTyped);
  typedRef.current = onTyped;
  const { t } = useTranslation();
  const hasCompany = company !== undefined && company !== null;
  const [companyFront, setCompanyFront] = useState(true);
  const store = useMemo(() => {
    const created = new LaptopStore();
    // В игре за компьютером работает игрок, а не «основатель на автопилоте».
    if (hasCompany) created.set({ manual: true });
    return created;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const actions = useMemo(() => new Actions(store), [store]);
  const s = useSyncExternalStore(store.subscribe, store.get);
  const screenRef = useRef<HTMLDivElement>(null);
  const deviceRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.6);
  const [screenHeight, setScreenHeight] = useState(SCREEN_H);
  const [entered, setEntered] = useState(false);

  useEffect(() => () => actions.dispose(), [actions]);

  // Основатель работает, пока игрок не взял управление. Отдал — основатель продолжает с того же места.
  useEffect(() => {
    if (s.manual) {
      store.set((st) => ({
        texts: st.texts.map((text, i) => {
          const file = PROJECT_FILES[i];
          return file && !file.static ? repairPrefix(text, file.code) : text;
        }),
        typo: false,
        suggest: null,
        hoverResult: null,
        hoverChart: null,
      }));
      return;
    }
    store.set({ focus: null, omniboxFocus: false, ntpFocus: false });
    const speed = Number(new URLSearchParams(window.location.search).get('speed')) || 1;
    const director = new Director(store, actions, t('laptop.browser.queries', { returnObjects: true }) as string[], speed);
    void director.run();
    return () => director.stop();
  }, [s.manual, store, actions, t]);

  // Клавиатура игрока.
  useEffect(() => {
    // Пока открыта «Компания», клавиши идут в её поля, а не в редактор кода.
    if (closing || (hasCompany && companyFront)) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') return;
      if (!store.get().manual) store.set({ manual: true });
      const before = store.get();
      const inEditor = before.app === 'editor' && before.windows.editor === 'open' && (before.focus === 'editor' || before.focus === null);
      if (actions.handleKey(e)) {
        e.preventDefault();
        // Знак кода, набранный игроком в редакторе, идёт в зачёт работы.
        if (inEditor && !e.metaKey && !e.ctrlKey && (e.key.length === 1 || e.key === 'Enter' || e.key === 'Tab')) typedRef.current?.();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [closing, store, actions, hasCompany, companyFront]);

  useLayoutEffect(() => {
    const el = screenRef.current;
    if (!el) return;
    const update = () => {
      const nextScale = el.clientWidth / SCREEN_W;
      setScale(nextScale);
      if (fullscreen && nextScale > 0) setScreenHeight(el.clientHeight / nextScale);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setEntered(true)));
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    if (!closing) return;
    const id = window.setTimeout(onClosed, 520);
    return () => window.clearTimeout(id);
  }, [closing, onClosed]);

  const takeOver = () => {
    if (!store.get().manual) store.set({ manual: true });
  };

  const openDock = (item: DockItem) => {
    if (item === 'browser' || item === 'editor') {
      setCompanyFront(false);
      if (!s.running.includes(item)) {
        store.set({ bounce: item });
        window.setTimeout(() => store.set({ bounce: null }), 900);
      }
      actions.openApp(item);
    } else {
      store.set({ bounce: item });
      window.setTimeout(() => store.set({ bounce: null }), 900);
      // В игре остальные значки открывают разделы программы «Компания».
      if (hasCompany && onDockApp) {
        onDockApp(item);
        setCompanyFront(true);
      }
    }
  };

  const open = entered && !closing;
  const fromX = origin.x - window.innerWidth / 2;
  const fromY = origin.y - window.innerHeight / 2;
  const menu = t(s.app === 'browser' ? 'laptop.os.menuBrowser' : 'laptop.os.menuEditor', { returnObjects: true }) as string[];
  const desktop = t('laptop.os.desktop', { returnObjects: true }) as DesktopItem[];
  const fullBox = { left: 0, top: MENU_H, width: SCREEN_W, height: Math.max(180, screenHeight - MENU_H - DOCK_H - 22) };
  const editorWin = fullscreen && s.zoomed.editor ? { style: fullBox, height: fullBox.height } : windowStyle(s, 'editor');
  const browserWin = fullscreen && s.zoomed.browser ? { style: fullBox, height: fullBox.height } : windowStyle(s, 'browser');

  return (
    <div className={`lp-overlay desk${fullscreen ? ' fullscreen' : ''}${open ? ' open' : ''}`}>
      {!fullscreen && <DeskView minutes={minutes} device={deviceRef} />}
      <div ref={deviceRef} className="lp-device mono" style={{ transform: open ? 'translate(0, 0) scale(1)' : `translate(${fromX}px, ${fromY}px) scale(0.08)` }}>
        <div className="lp-bezel">
          <i className="lp-camera" />
          <div ref={screenRef} className={`lp-screen${open ? ' on' : ''}${s.manual ? ' manual' : ''}`} onPointerDown={takeOver}>
            <div className="lp-canvas" style={{ width: SCREEN_W, height: fullscreen ? screenHeight : SCREEN_H, transform: `scale(${scale})` }}>
              <div className="os-desktop" onClick={() => actions.selectDesktop(null)}>
                <Landscape variant="dusk" id="desk" />
              </div>

              <div className="os-icons">
                {desktop.map((item) => (
                  <button
                    type="button"
                    key={item.name}
                    className={`os-icon${s.desktopSelected === item.name ? ' selected' : ''}`}
                    onClick={() => actions.selectDesktop(item.name)}
                  >
                    <span className="os-icon-img">
                      <DesktopIcon kind={item.kind} />
                    </span>
                    <span className="os-icon-label">{item.name}</span>
                  </button>
                ))}
              </div>

              <div className="os-menubar" style={{ height: MENU_H }}>
                <span className="os-logo" />
                <b>{hasCompany && companyFront ? (appTitle ?? t('laptop.company.title')) : s.app === 'browser' ? t('laptop.os.browser') : t('laptop.os.editor')}</b>
                {menu.map((m, i) => (
                  <button
                    type="button"
                    key={m}
                    className="os-menu-item"
                    onClick={() => {
                      if (s.app === 'editor' && i === 6) actions.toggleTerminal();
                      if (s.app === 'browser' && i === 6) actions.newTab();
                    }}
                  >
                    {m}
                  </button>
                ))}
                <span className="os-fill" />
                <span className="os-status">
                  <Icon name="battery" size={20} /> 80%
                </span>
                <Icon name="wifi" size={17} />
                <Icon name="search" size={15} />
                <Icon name="control" size={17} />
                <span className="os-clock">
                  {weekday} {clock(minutes)}
                </span>
              </div>

              <div className={windowClass(s, 'editor')} style={editorWin.style} onPointerDown={() => actions.bringToFront('editor')}>
                <EditorWindow s={s} actions={actions} height={editorWin.height} scrollable={fullscreen} />
              </div>
              <div className={windowClass(s, 'browser')} style={browserWin.style} onPointerDown={() => actions.bringToFront('browser')}>
                <BrowserWindow s={s} actions={actions} />
              </div>

              {hasCompany && (
                <div
                  className={`os-window os-company ${companyFront ? 'front' : 'closed'}`}
                  style={fullscreen ? fullBox : { left: WINDOW.x, top: WINDOW.y, width: WINDOW.w, height: WINDOW.h }}
                >
                  <div className="os-company-zoom">{company}</div>
                </div>
              )}

              <div className="os-dock" style={{ left: DOCK_X, top: fullscreen ? screenHeight - DOCK_H - 8 : DOCK_Y, width: DOCK_W, height: DOCK_H }}>
                {DOCK_ITEMS.map((item) => (
                  <button
                    key={item}
                    type="button"
                    className={`os-dock-item${s.bounce === item ? ' bounce' : ''}`}
                    onClick={() => openDock(item)}
                    aria-label={t(`laptop.os.dock.${item}`)}
                  >
                    <span className="os-dock-tip">{t(`laptop.os.dock.${item}`)}</span>
                    <DockGlyph item={item} />
                    {(item === 'files' || s.running.includes(item as AppId)) && <i className="os-dock-dot" />}
                  </button>
                ))}
              </div>

              <div className={`os-pill${s.manual ? ' manual' : ''}`} hidden={hasCompany && companyFront}>
                {hasCompany ? (
                  <>
                    {focusText && <span>{focusText}</span>}
                    <button type="button" onPointerDown={(e) => e.stopPropagation()} onClick={() => setCompanyFront(true)}>
                      ← {t('laptop.company.back')}
                    </button>
                  </>
                ) : s.manual ? (
                  <>
                    <span>{t('laptop.autopilot.manual')}</span>
                    <button
                      type="button"
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={(e) => {
                        e.stopPropagation();
                        store.set({ manual: false });
                      }}
                    >
                      ▶ {t('laptop.autopilot.resume')}
                    </button>
                  </>
                ) : (
                  <>
                    <i className="os-pill-dot" />
                    <span>{t('laptop.autopilot.working')}</span>
                  </>
                )}
              </div>

              {!s.manual && (
                <div className="os-cursor" style={{ transform: `translate(${s.mouse.x}px, ${s.mouse.y}px)` }}>
                  <span key={s.click} className={s.click ? 'os-click' : ''} />
                  <svg width="22" height="30" viewBox="0 0 22 30" aria-hidden="true">
                    <path d="M2 2v22l6-5.5 4 9 4-1.8-4-8.7h8z" fill="#111" stroke="#fff" strokeWidth="1.6" strokeLinejoin="round" />
                  </svg>
                </div>
              )}
            </div>
          </div>
          <div className="lp-chin">
            <span className="lp-logo" />
          </div>
        </div>
        <div className="lp-stand">
          <i />
        </div>
      </div>
      <div className="lp-corner">
        {controls}
        <div className="lp-hint" hidden={!canLeave}>
          <kbd>Esc</kbd> {t('laptop.autopilot.leave')}
        </div>
      </div>
    </div>
  );
}
