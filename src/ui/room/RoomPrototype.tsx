// Пробная квартира основателя: ходьба, предметы, время суток и ноутбук крупным планом.
// Пока не связана с расчётом игры — это шаг 1, чтобы оценить вид и ощущения.
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ROOM_H, ROOM_W, SEAT, type Interactable, type InteractionId } from './engine/apartment';
import { Scene } from './engine/scene';
import { skyAt } from './engine/sky';
import { Laptop } from './laptop/Laptop';
import './room.css';

type LaptopPhase = 'closed' | 'open' | 'closing';
type Fade = null | 'out' | 'in';

const MOVE_KEYS: Record<string, [number, number]> = {
  KeyW: [0, -1],
  ArrowUp: [0, -1],
  KeyS: [0, 1],
  ArrowDown: [0, 1],
  KeyA: [-1, 0],
  ArrowLeft: [-1, 0],
  KeyD: [1, 0],
  ArrowRight: [1, 0],
};

function fitScale(): number {
  const byW = (window.innerWidth - 40) / ROOM_W;
  const byH = (window.innerHeight - 110) / ROOM_H;
  return Math.max(2, Math.floor(Math.min(byW, byH)));
}

function clock(minutes: number): string {
  const m = Math.floor(minutes) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

export function RoomPrototype() {
  const { t } = useTranslation();
  const scene = useMemo(() => {
    const s = new Scene();
    // Для проверок: room.html?time=21:30 — начать вечером.
    const time = /^(\d{1,2}):(\d{2})$/.exec(new URLSearchParams(window.location.search).get('time') ?? '');
    if (time) s.minutes = Number(time[1]) * 60 + Number(time[2]);
    return s;
  }, []);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const keys = useRef(new Set<string>());
  const busy = useRef(false);

  const [scale, setScale] = useState(fitScale);
  const [near, setNear] = useState<Interactable | null>(null);
  const [laptop, setLaptop] = useState<LaptopPhase>('closed');
  const [bubble, setBubble] = useState<{ text: string; id: number } | null>(null);
  const [hud, setHud] = useState({ minutes: scene.minutes, day: scene.day });
  const [fade, setFade] = useState<Fade>(null);
  const [origin, setOrigin] = useState({ x: 0, y: 0 });
  const [wakeDay, setWakeDay] = useState(1);

  const weekdays = t('room.hud.weekdays', { returnObjects: true }) as string[];
  const weekday = weekdays[(hud.day - 1) % 7] ?? '';

  const say = useCallback((text: string, ms = 3800) => {
    const id = Date.now();
    setBubble({ text, id });
    window.setTimeout(() => setBubble((b) => (b?.id === id ? null : b)), ms);
  }, []);

  useEffect(() => {
    scene.onCoffeeReady = () => {
      busy.current = false;
      say(t('room.bubble.coffeeReady'));
    };
  }, [scene, say, t]);

  useLayoutEffect(() => {
    const onResize = () => setScale(fitScale());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Главный цикл: обновить сцену, нарисовать, сдвинуть облачко за героем.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const view = canvas.getContext('2d');
    const native = document.createElement('canvas');
    native.width = ROOM_W;
    native.height = ROOM_H;
    const light = document.createElement('canvas');
    light.width = ROOM_W;
    light.height = ROOM_H;
    const g = native.getContext('2d');
    const lg = light.getContext('2d');
    if (!view || !g || !lg) return;

    let last = performance.now();
    let hudTimer = 0;
    let nearId: InteractionId | null = null;
    let raf = 0;

    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const input = { x: 0, y: 0 };
      for (const code of keys.current) {
        const v = MOVE_KEYS[code];
        if (v) {
          input.x += v[0];
          input.y += v[1];
        }
      }
      scene.update(dt, busy.current ? { x: 0, y: 0 } : input);
      scene.render(g, lg);

      view.imageSmoothingEnabled = false;
      view.clearRect(0, 0, canvas.width, canvas.height);
      view.drawImage(native, 0, 0, canvas.width, canvas.height);

      const found = scene.nearby();
      if ((found?.id ?? null) !== nearId) {
        nearId = found?.id ?? null;
        setNear(found);
      }

      // Облачко висит над головой героя, где бы он ни был.
      const k = canvas.clientWidth / ROOM_W;
      const head =
        scene.mode === 'sitting'
          ? { x: SEAT.x + 8, y: SEAT.y - 2 }
          : scene.mode === 'sleeping'
            ? { x: 32, y: 38 }
            : { x: scene.pos.x + 5, y: scene.pos.y - 20 };
      if (bubbleRef.current) bubbleRef.current.style.transform = `translate(${head.x * k}px, ${head.y * k}px) translate(-50%, -100%)`;

      hudTimer += dt;
      if (hudTimer > 0.25) {
        hudTimer = 0;
        setHud({ minutes: scene.minutes, day: scene.day });
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [scene, scale]);

  const interact = useCallback(
    (target: Interactable) => {
      if (busy.current) return;
      if (target.id === 'computer') {
        busy.current = true;
        scene.sit();
        const rect = canvasRef.current?.getBoundingClientRect();
        if (rect) setOrigin({ x: rect.left + 239 * (rect.width / ROOM_W), y: rect.top + 25 * (rect.height / ROOM_H) });
        window.setTimeout(() => setLaptop('open'), 420);
      } else if (target.id === 'coffee') {
        busy.current = true;
        scene.brew();
        say(t('room.bubble.brewing'), 2600);
      } else if (target.id === 'bed') {
        busy.current = true;
        setBubble(null);
        setWakeDay(scene.minutes > 7 * 60 + 30 ? scene.day + 1 : scene.day);
        scene.sleep();
        window.setTimeout(() => setFade('out'), 900);
        window.setTimeout(() => {
          scene.wakeUp();
          setHud({ minutes: scene.minutes, day: scene.day });
          setFade('in');
        }, 3400);
        window.setTimeout(() => {
          setFade(null);
          busy.current = false;
          say(t('room.bubble.wake'));
        }, 4300);
      } else if (target.id === 'window') {
        const thoughts = t('room.bubble.window', { returnObjects: true }) as string[];
        say(thoughts[Math.floor(Math.random() * thoughts.length)] ?? '', 4400);
      }
    },
    [scene, say, t],
  );

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code in MOVE_KEYS) e.preventDefault();
      if (laptop !== 'closed') {
        if (e.code === 'Escape' && laptop === 'open') setLaptop('closing');
        return;
      }
      keys.current.add(e.code);
      if ((e.code === 'KeyE' || e.code === 'Enter' || e.code === 'Space') && !e.repeat) {
        const target = scene.nearby();
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
  }, [laptop, interact, scene]);

  const onLaptopClosed = useCallback(() => {
    setLaptop('closed');
    scene.stand();
    busy.current = false;
    keys.current.clear();
  }, [scene]);

  const sky = skyAt(hud.minutes);
  const night = sky.darkness > 0.4;

  return (
    <div className="room-page">
      <div className="room-stage" style={{ width: ROOM_W * scale, height: ROOM_H * scale }}>
        <canvas
          ref={canvasRef}
          className={laptop !== 'closed' ? 'dimmed' : ''}
          width={ROOM_W * scale * Math.max(1, Math.round(window.devicePixelRatio || 1))}
          height={ROOM_H * scale * Math.max(1, Math.round(window.devicePixelRatio || 1))}
          style={{ width: ROOM_W * scale, height: ROOM_H * scale }}
        />

        <div className="room-hud">
          <div className="hud-card">
            <span className={`hud-sun${night ? ' moon' : ''}`} />
            <div>
              <div className="hud-clock">{clock(hud.minutes)}</div>
              <div className="hud-day">
                {weekday} · {t('room.hud.day', { day: hud.day })}
              </div>
            </div>
          </div>
          <div className="hud-card">
            <div>
              <div className="hud-money">$3 000</div>
              <div className="hud-day">{t('room.hud.account')}</div>
            </div>
          </div>
        </div>

        {near && laptop === 'closed' && !fade && !bubble && (
          <div key={near.id} className="room-prompt" style={{ left: near.anchor.x * scale, top: near.anchor.y * scale }}>
            <kbd>E</kbd>
            {t(`room.prompt.${near.id}`)}
          </div>
        )}

        <div ref={bubbleRef} className={`room-bubble${bubble ? ' show' : ''}`}>
          <span key={bubble?.id}>{bubble?.text}</span>
        </div>
      </div>

      <div className="room-keys">
        <kbd>W</kbd>
        <kbd>A</kbd>
        <kbd>S</kbd>
        <kbd>D</kbd> {t('room.controls.move')}
        <span className="room-keys-sep" />
        <kbd>E</kbd> {t('room.controls.act')}
      </div>

      {fade && (
        <div className={`room-fade ${fade}`}>
          <div className="room-fade-title">{t('room.sleep.title')}</div>
          <div className="room-fade-sub">{t('room.sleep.subtitle', { day: wakeDay })}</div>
        </div>
      )}

      {laptop !== 'closed' && (
        <Laptop minutes={hud.minutes} weekday={weekday} origin={origin} closing={laptop === 'closing'} onClosed={onLaptopClosed} />
      )}
    </div>
  );
}
