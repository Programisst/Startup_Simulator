// Три кнопки окна: закрыть, свернуть, развернуть. При наведении появляются значки — как в настоящей системе.
import type { Actions } from './actions';
import type { AppId } from './store';

export function TrafficLights({ app, actions }: { app: AppId; actions: Actions }) {
  const stop = (e: React.PointerEvent) => e.stopPropagation();
  return (
    <div className="traffic" onPointerDown={stop}>
      <button type="button" className="tl-red" aria-label="Закрыть" onClick={() => actions.windowControl(app, 'close')}>
        <svg viewBox="0 0 12 12">
          <path d="M3.5 3.5l5 5M8.5 3.5l-5 5" />
        </svg>
      </button>
      <button type="button" className="tl-yellow" aria-label="Свернуть" onClick={() => actions.windowControl(app, 'min')}>
        <svg viewBox="0 0 12 12">
          <path d="M3 6h6" />
        </svg>
      </button>
      <button type="button" className="tl-green" aria-label="Развернуть" onClick={() => actions.windowControl(app, 'zoom')}>
        <svg viewBox="0 0 12 12">
          <path d="M3.5 7.5V3.5h4M8.5 4.5v4h-4" />
        </svg>
      </button>
    </div>
  );
}
