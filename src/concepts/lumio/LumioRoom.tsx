// Концепт «Люмио»: квартира основателя в пиксель-арте, вид сверху.
// Ходьба клавишами и мышью, компьютер, кофе, сон, лампы, окно, смена времени суток.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Laptop } from '../../ui/room/laptop/Laptop';
import { loadArt } from './engine/art';
import { daylightAt } from './engine/daylight';
import type { LampId, Spot } from './engine/scene';
import { World } from './engine/world';
import './lumio.css';

type ComputerPhase = 'closed' | 'open' | 'closing';

const MOVE: Record<string, [number, number]> = {
  KeyW: [0, -1],
  ArrowUp: [0, -1],
  KeyS: [0, 1],
  ArrowDown: [0, 1],
  KeyA: [-1, 0],
  ArrowLeft: [-1, 0],
  KeyD: [1, 0],
  ArrowRight: [1, 0],
};

const isLamp = (id: string): id is LampId => id.startsWith('lamp');

function clock(minutes: number): string {
  const m = Math.floor(minutes) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

export function LumioRoom() {
  const { t } = useTranslation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const promptRef = useRef<HTMLDivElement>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<World | null>(null);
  const keys = useRef(new Set<string>());
  const busy = useRef(false);
  const interactRef = useRef<(spot: Spot) => void>(() => {});

  const [near, setNear] = useState<Spot | null>(null);
  const [computer, setComputer] = useState<ComputerPhase>('closed');
  const [bubble, setBubble] = useState<{ text: string; id: number } | null>(null);
  const [hud, setHud] = useState({ minutes: 21 * 60 + 30, day: 1 });
  const [fade, setFade] = useState<null | 'out' | 'in'>(null);
  const [wakeDay, setWakeDay] = useState(1);
  const [origin, setOrigin] = useState({ x: 0, y: 0 });
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, setLampTick] = useState(0);
  // Подсказка по управлению прячется через несколько секунд после первого действия игрока.
  const [hintGone, setHintGone] = useState(false);
  const hintTimer = useRef(0);
  const touched = useCallback(() => {
    if (hintTimer.current) return;
    hintTimer.current = window.setTimeout(() => setHintGone(true), 6000);
  }, []);

  const weekdays = t('conceptLumio.hud.weekdays', { returnObjects: true }) as string[];
  const weekday = weekdays[(hud.day - 1) % 7] ?? '';
  const startMinutes = useMemo(() => {
    const m = /^(\d{1,2}):(\d{2})$/.exec(new URLSearchParams(window.location.search).get('time') ?? '');
    return m ? Number(m[1]) * 60 + Number(m[2]) : 21 * 60 + 30;
  }, []);

  const say = useCallback((text: string, ms = 3800) => {
    const id = Date.now();
    setBubble({ text, id });
    window.setTimeout(() => setBubble((b) => (b?.id === id ? null : b)), ms);
  }, []);

  // Загружаем картинки, создаём мир и запускаем главный цикл.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let raf = 0;
    let disposed = false;
    let onResize = () => {};
    loadArt()
      .then((art) => {
        if (disposed) return;
        const world = new World(canvas, art);
        worldRef.current = world;
        world.minutes = startMinutes;
        // Только для проверок в режиме разработки.
        if (import.meta.env.DEV) (window as unknown as { __lumio?: World }).__lumio = world;
        world.onArrive = (spot) => interactRef.current(spot);
        world.onCoffeeReady = () => {
          busy.current = false;
          say(t('conceptLumio.bubble.coffeeReady'));
        };
        onResize = () => world.resize();
        window.addEventListener('resize', onResize);

        let last = performance.now();
        let hudTimer = 0;
        let nearId: string | null = null;
        const frame = (now: number) => {
          const dt = Math.min(0.1, (now - last) / 1000);
          last = now;
          let ix = 0;
          let iy = 0;
          for (const code of keys.current) {
            const v = MOVE[code];
            if (v) {
              ix += v[0];
              iy += v[1];
            }
          }
          world.update(dt, busy.current ? { x: 0, y: 0 } : { x: ix, y: iy });
          world.render();

          const found = world.nearby();
          if ((found?.id ?? null) !== nearId) {
            nearId = found?.id ?? null;
            setNear(found);
          }
          if (found && promptRef.current) {
            const p = world.project(found.anchor);
            promptRef.current.style.transform = `translate(${Math.round(p.x)}px, ${Math.round(p.y)}px) translate(-50%, -100%)`;
          }
          if (bubbleRef.current) {
            const p = world.project(world.headPoint());
            bubbleRef.current.style.transform = `translate(${Math.round(p.x)}px, ${Math.round(p.y)}px) translate(-50%, -100%)`;
          }
          hudTimer += dt;
          if (hudTimer > 0.25) {
            hudTimer = 0;
            setHud({ minutes: world.minutes, day: world.day });
          }
          raf = requestAnimationFrame(frame);
        };
        raf = requestAnimationFrame(frame);
        window.setTimeout(() => setReady(true), 50);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      worldRef.current = null;
    };
  }, [say, t, startMinutes]);

  const interact = useCallback(
    (spot: Spot) => {
      const world = worldRef.current;
      if (!world || busy.current) return;
      if (spot.id === 'computer') {
        busy.current = true;
        world.sit();
        setOrigin(world.monitorOnScreen());
        window.setTimeout(() => setComputer('open'), 700);
      } else if (spot.id === 'coffee') {
        busy.current = true;
        world.brew();
        say(t('conceptLumio.bubble.brewing'), 2600);
      } else if (spot.id === 'bed') {
        busy.current = true;
        setBubble(null);
        setWakeDay(world.minutes % 1440 > 7 * 60 + 30 ? world.day + 1 : world.day);
        world.sleep();
        window.setTimeout(() => setFade('out'), 1100);
        window.setTimeout(() => {
          world.wakeUp();
          setHud({ minutes: world.minutes, day: world.day });
          setFade('in');
        }, 3600);
        window.setTimeout(() => {
          setFade(null);
          busy.current = false;
          say(t('conceptLumio.bubble.wake'));
        }, 4500);
      } else if (isLamp(spot.id)) {
        world.toggleLamp(spot.id);
        setLampTick((n) => n + 1);
      } else if (spot.id === 'boxes') {
        say(t('conceptLumio.bubble.boxes'));
      } else {
        busy.current = true;
        world.hold(true);
        const thoughts = t('conceptLumio.bubble.window', { returnObjects: true }) as string[];
        say(thoughts[Math.floor(Math.random() * thoughts.length)] ?? '', 4200);
        window.setTimeout(() => {
          world.hold(false);
          busy.current = false;
        }, 4200);
      }
    },
    [say, t],
  );
  interactRef.current = interact;

  // Мышь: клик по полу — идти туда, по предмету — подойти и использовать.
  const canClick = computer === 'closed' && !fade;
  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const world = worldRef.current;
      const canvas = canvasRef.current;
      if (!world || !canvas) return;
      canvas.style.cursor = canClick && world.pick(e.clientX, e.clientY).spot ? 'pointer' : '';
    },
    [canClick],
  );
  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      const world = worldRef.current;
      if (e.button !== 0 || !world || !canClick || busy.current) return;
      touched();
      const picked = world.pick(e.clientX, e.clientY);
      // Уже стоим у предмета — действуем сразу.
      if (picked.spot && world.nearby()?.id === picked.spot.id) interact(picked.spot);
      else world.walkTo(picked.target, picked.spot);
    },
    [canClick, interact, touched],
  );

  const onWheel = useCallback(
    (e: React.WheelEvent) => {
      if (!canClick) return;
      touched();
      worldRef.current?.wheel(e.deltaMode === 1 ? e.deltaY * 30 : e.deltaY);
    },
    [canClick, touched],
  );

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code in MOVE) e.preventDefault();
      if (computer !== 'closed') {
        if (e.code === 'Escape' && computer === 'open') setComputer('closing');
        return;
      }
      keys.current.add(e.code);
      touched();
      if ((e.code === 'KeyE' || e.code === 'Enter' || e.code === 'Space') && !e.repeat) {
        const target = worldRef.current?.nearby();
        if (target) interact(target);
      }
    };
    const up = (e: KeyboardEvent) => keys.current.delete(e.code);
    const blur = () => keys.current.clear();
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
    };
  }, [computer, interact, touched]);

  const onComputerClosed = useCallback(() => {
    setComputer('closed');
    worldRef.current?.stand();
    busy.current = false;
    keys.current.clear();
  }, []);

  const night = daylightAt(hud.minutes).dark > 0.5;
  const promptText = near
    ? isLamp(near.id)
      ? t(worldRef.current?.isLampOn(near.id) ? 'conceptLumio.prompt.lampOff' : 'conceptLumio.prompt.lampOn')
      : near.id === 'boxes'
        ? ''
        : t(`conceptLumio.prompt.${near.id}`)
    : '';

  return (
    <div className={`lm-page${ready ? ' ready' : ''}`}>
      <canvas
        ref={canvasRef}
        className={`lm-stage${computer !== 'closed' ? ' dimmed' : ''}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onWheel={onWheel}
      />
      <div className="lm-vignette" />

      <div className="lm-hud">
        <span className={`lm-sun${night ? ' moon' : ''}`} />
        <span className="lm-clock">{clock(hud.minutes)}</span>
        <span className="lm-day">
          {weekday} · {t('conceptLumio.hud.day', { day: hud.day })}
        </span>
        <span className="lm-sep" />
        <span className="lm-coin" />
        <span className="lm-money">$3 000</span>
        <span className="lm-day">{t('conceptLumio.hud.account')}</span>
      </div>

      {near && promptText && computer === 'closed' && !fade && !bubble && (
        <div ref={promptRef} key={near.id} className="lm-prompt">
          <kbd>E</kbd>
          {promptText}
        </div>
      )}
      <div ref={bubbleRef} className={`lm-bubble${bubble ? ' show' : ''}`}>
        <span key={bubble?.id}>{bubble?.text}</span>
      </div>

      <div className={`lm-keys${hintGone ? ' gone' : ''}`}>
        <kbd>W</kbd>
        <kbd>A</kbd>
        <kbd>S</kbd>
        <kbd>D</kbd>
        <span>{t('conceptLumio.controls.move')}</span>
        <i />
        <kbd>E</kbd>
        <span>{t('conceptLumio.controls.act')}</span>
        <i />
        <span>{t('conceptLumio.controls.click')}</span>
        <i />
        <span>{t('conceptLumio.controls.zoom')}</span>
      </div>

      {fade && (
        <div className={`lm-fade ${fade}`}>
          <div className="lm-fade-title">{t('conceptLumio.sleep.title')}</div>
          <div className="lm-fade-sub">{t('conceptLumio.sleep.subtitle', { day: wakeDay })}</div>
        </div>
      )}

      {error && <div className="lm-error">{error}</div>}

      {computer !== 'closed' && (
        <Laptop minutes={hud.minutes} weekday={weekday} origin={origin} closing={computer === 'closing'} onClosed={onComputerClosed} />
      )}
    </div>
  );
}
