import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createRoot } from 'react-dom/client';
import i18n from '../../../src/ui/i18n';
import type ru from '../../../src/content/ru/coworking-preview.json';
import { Actions } from '../../../src/ui/apartment/laptop/actions';
import { BrowserWindow } from '../../../src/ui/apartment/laptop/BrowserWindow';
import { EditorWindow } from '../../../src/ui/apartment/laptop/EditorWindow';
import { PROJECT_FILES } from '../../../src/ui/apartment/laptop/project';
import { LaptopStore, type AppId } from '../../../src/ui/apartment/laptop/store';
import '../../../src/ui/apartment/laptop/laptop.css';
import type { Worker } from './raster';

type Copy = typeof ru;
interface Setup {
  store: LaptopStore;
  actions: Actions;
  copy: Copy;
  close: () => void;
}

function Computer({ store, actions, copy, close }: Setup) {
  const state = useSyncExternalStore(store.subscribe, store.get);
  const surface = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(Math.max(180, innerHeight - 50));

  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setHeight(Math.max(160, Math.floor(entry.contentRect.height)));
    });
    if (surface.current) observer.observe(surface.current);
    const keyboard = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.isComposing || event.target instanceof HTMLInputElement) return;
      if (event.key === 'Tab' && !event.metaKey && !event.ctrlKey) return;
      if (event.target instanceof HTMLButtonElement && ['Enter', ' '].includes(event.key)) return;
      if (actions.handleKey(event)) event.preventDefault();
    };
    window.addEventListener('keydown', keyboard);
    return () => {
      observer.disconnect();
      window.removeEventListener('keydown', keyboard);
      actions.dispose();
    };
  }, [actions]);

  function select(app: AppId) {
    actions.openApp(app);
    actions.setFocus(null);
  }

  return (
    <div className="computer-workspace">
      <header className="screen-bar">
        <button type="button" className="return-to-room" onClick={close} autoFocus>{copy.close}</button>
        <h2 id="screen-title">{state.app === 'editor' ? copy.editor : copy.browser}</h2>
        <nav>
          {(['editor', 'browser'] as const).map(app => (
            <button key={app} type="button" data-app={app} aria-pressed={state.app === app} onClick={() => select(app)}>{copy[app]}</button>
          ))}
        </nav>
      </header>
      <div ref={surface} className="computer-surface lp-canvas">
        {state.app === 'editor'
          ? <EditorWindow s={state} actions={actions} height={height} scrollable />
          : <BrowserWindow s={state} actions={actions} searchBrand={copy.searchBrand} searchPlaceholder={copy.searchPlaceholder} />}
      </div>
    </div>
  );
}

export function mountComputer(host: HTMLElement, worker: Worker, copy: Copy, language: string, close: () => void): () => void {
  void i18n.changeLanguage(language);
  const store = new LaptopStore();
  const actions = new Actions(store);
  const currentFile = PROJECT_FILES.findIndex(file => file.name === worker.monitor.fileName);
  actions.openFile(currentFile);
  store.set({
    manual: true,
    texts: PROJECT_FILES.map(file => file.code),
  });
  const root = createRoot(host);
  root.render(<Computer store={store} actions={actions} copy={copy} close={close} />);
  return () => root.unmount();
}
