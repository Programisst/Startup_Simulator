// 3D-квартира основателя: ходьба, предметы, время суток и компьютер крупным планом.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Laptop } from '../room/laptop/Laptop';
import { money } from '../format';
import { lightingAt } from './lighting';
import { INTERACTIONS, type Interaction3D } from './layout';
import { AUTOPILOT_IDLE_SECONDS, LINKED_CLOCK_RATE, worksAtDesk, type RoomLink } from './link';
import type { OutfitId } from './hero/hero';
import type { LampId } from './layout';
import { WindowView } from './WindowView';
import { World, type CamMode } from './World';
import './room3d.css';

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

const OUTFIT_IDS: OutfitId[] = ['knit', 'shirt', 'overshirt'];
const CAM_MODES: CamMode[] = ['follow', 'fill'];
const isLamp = (id: string): id is LampId => id.startsWith('lamp');

function clock(minutes: number): string {
  const m = Math.floor(minutes) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

export function Room3D({ link }: { link?: RoomLink } = {}) {
  const { t } = useTranslation();
  // Связь с партией читается из ref: главный цикл создаётся один раз и не должен перезапускаться на каждый игровой день.
  const linkRef = useRef(link);
  linkRef.current = link;
  const linked = link !== undefined;
  /** Герой сел за компьютер сам, без игрока: экран ноутбука не открывается. */
  const autoSeated = useRef(false);
  const autoWalking = useRef(false);
  const idleFor = useRef(0);
  const stageRef = useRef<HTMLDivElement>(null);
  const promptRef = useRef<HTMLDivElement>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<World | null>(null);
  const keys = useRef(new Set<string>());
  const busy = useRef(false);
  const interactRef = useRef<(target: Interaction3D) => void>(() => {});

  const [near, setNear] = useState<Interaction3D | null>(null);
  const [computer, setComputer] = useState<ComputerPhase>('closed');
  const [bubble, setBubble] = useState<{ text: string; id: number } | null>(null);
  const [hud, setHud] = useState({ minutes: 7 * 60 + 40, day: 1 });
  const [fade, setFade] = useState<null | 'out' | 'in'>(null);
  const [wakeDay, setWakeDay] = useState(1);
  const [origin, setOrigin] = useState({ x: 0, y: 0 });
  const [ready, setReady] = useState(false);
  const [windowView, setWindowView] = useState<null | 'open' | 'closing'>(null);
  const [thought, setThought] = useState('');
  const [, setLampTick] = useState(0);
  const getMinutes = useCallback(() => worldRef.current?.minutes ?? 0, []);

  const weekdays = t('room.hud.weekdays', { returnObjects: true }) as string[];
  const weekday = weekdays[(hud.day - 1) % 7] ?? '';
  const startTime = useMemo(() => /^(\d{1,2}):(\d{2})$/.exec(new URLSearchParams(window.location.search).get('time') ?? ''), []);

  const say = useCallback((text: string, ms = 3800) => {
    const id = Date.now();
    setBubble({ text, id });
    window.setTimeout(() => setBubble((b) => (b?.id === id ? null : b)), ms);
  }, []);

  // Создаём мир и запускаем главный цикл.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const params = new URLSearchParams(window.location.search);
    const outfit = OUTFIT_IDS.find((o) => o === params.get('outfit')) ?? 'knit';
    const cam = CAM_MODES.find((c) => c === params.get('cam')) ?? 'follow';
    const world = new World(stage, outfit, cam);
    worldRef.current = world;
    if (linkRef.current) {
      world.externalDay = true;
      world.clockRate = LINKED_CLOCK_RATE;
      world.minutes = 9 * 60;
    }
    // Только для проверок в режиме разработки: доступ к миру из консоли.
    if (import.meta.env.DEV) (window as unknown as { __world?: World }).__world = world;
    if (startTime) world.minutes = Number(startTime[1]) * 60 + Number(startTime[2]);
    world.onArrive = (target) => interactRef.current(target);
    world.onCoffeeReady = () => {
      busy.current = false;
      say(t('room.bubble.coffeeReady'));
    };
    const onResize = () => world.resize();
    window.addEventListener('resize', onResize);

    let last = performance.now();
    let hudTimer = 0;
    let nearId: string | null = null;
    let raf = 0;
    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
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
      const game = linkRef.current;
      if (game) {
        world.clockPaused = !game.timeRuns;
        if (game.locked) {
          ix = 0;
          iy = 0;
        }
        // Игрок взялся за управление — герой встаёт из-за стола и слушается.
        const steering = ix !== 0 || iy !== 0;
        if (steering) {
          idleFor.current = 0;
          autoWalking.current = false;
          if (autoSeated.current) {
            autoSeated.current = false;
            world.stand();
            busy.current = false;
          }
        } else {
          idleFor.current += dt;
        }
        const wantsDesk = worksAtDesk(game.activity) && game.timeRuns;
        if (autoSeated.current && !wantsDesk) {
          // Работа кончилась или игра на паузе — герой встаёт.
          autoSeated.current = false;
          world.stand();
        } else if (wantsDesk && !busy.current && !autoSeated.current && !autoWalking.current && world.mode === 'walk' && idleFor.current > AUTOPILOT_IDLE_SECONDS) {
          const desk = INTERACTIONS.find((i) => i.id === 'computer');
          if (desk) autoWalking.current = world.walkTo(desk.approach, desk);
        }
      }
      const input = busy.current ? { x: 0, y: 0 } : world.screenToWorld(ix, iy);
      world.update(dt, input);
      world.render();

      const found = world.nearby();
      if ((found?.id ?? null) !== nearId) {
        nearId = found?.id ?? null;
        setNear(found);
      }
      if (found && promptRef.current) {
        const p = world.project(found.anchor);
        promptRef.current.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, -100%)`;
      }
      if (bubbleRef.current) {
        const p = world.project(world.headPoint());
        bubbleRef.current.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, -100%)`;
      }
      hudTimer += dt;
      if (hudTimer > 0.25) {
        hudTimer = 0;
        setHud({ minutes: world.minutes, day: world.day });
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    const readyTimer = window.setTimeout(() => setReady(true), 60);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(readyTimer);
      window.removeEventListener('resize', onResize);
      world.dispose();
      worldRef.current = null;
    };
  }, [say, t, startTime]);

  const interact = useCallback(
    (target: Interaction3D) => {
      const world = worldRef.current;
      if (!world || busy.current) return;
      if (target.id === 'computer' && autoWalking.current) {
        // Герой дошёл до стола сам: просто садится работать.
        autoWalking.current = false;
        autoSeated.current = true;
        world.sit();
        return;
      }
      autoWalking.current = false;
      if (autoSeated.current) {
        autoSeated.current = false;
        world.stand();
      }
      idleFor.current = 0;
      if (target.id === 'computer') {
        busy.current = true;
        world.sit();
        const rect = stageRef.current?.getBoundingClientRect();
        const m = world.monitorOnScreen();
        setOrigin({ x: (rect?.left ?? 0) + m.x, y: (rect?.top ?? 0) + m.y });
        window.setTimeout(() => setComputer('open'), 650);
      } else if (target.id === 'coffee') {
        busy.current = true;
        world.brew();
        say(t('room.bubble.brewing'), 2600);
      } else if (target.id === 'bed') {
        busy.current = true;
        setBubble(null);
        setWakeDay(world.minutes > 7 * 60 + 30 ? world.day + 1 : world.day);
        world.sleep();
        window.setTimeout(() => setFade('out'), 900);
        window.setTimeout(() => {
          // В игре сон — это переход на следующий игровой день.
          linkRef.current?.sleep();
          world.wakeUp();
          setHud({ minutes: world.minutes, day: world.day });
          setFade('in');
        }, 3400);
        window.setTimeout(() => {
          setFade(null);
          busy.current = false;
          idleFor.current = 0;
          say(t('room.bubble.wake'));
        }, 4300);
      } else if (isLamp(target.id)) {
        // Щёлк — и свет плавно загорается или гаснет.
        world.toggleLamp(target.id);
        setLampTick((n) => n + 1);
      } else {
        // Камера подлетает к окну, затем открывается вид на город.
        busy.current = true;
        setBubble(null);
        const thoughts = t('room.bubble.window', { returnObjects: true }) as string[];
        setThought(thoughts[Math.floor(Math.random() * thoughts.length)] ?? '');
        world.focusWindow(true);
        window.setTimeout(() => setWindowView('open'), 850);
      }
    },
    [say, t],
  );

  interactRef.current = interact;

  // Мысль героя вслух, когда его занятие меняется.
  const heroThought = link?.thought;
  useEffect(() => {
    if (heroThought && !busy.current) say(heroThought, 4200);
  }, [heroThought, say]);

  // Мышь: короткий клик по полу — идти туда, по предмету — подойти и сделать действие.
  // Зажать и потянуть — повернуть комнату.
  const canClick = computer === 'closed' && !fade && !windowView && !link?.locked;
  const drag = useRef<{ x: number; startX: number; moved: boolean } | null>(null);
  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0) return;
    drag.current = { x: e.clientX, startX: e.clientX, moved: false };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }, []);
  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const world = worldRef.current;
      const stage = stageRef.current;
      if (!world || !stage) return;
      const d = drag.current;
      if (d) {
        if (!d.moved && Math.abs(e.clientX - d.startX) > 6) d.moved = true;
        if (d.moved) {
          world.rotate(e.clientX - d.x);
          stage.style.cursor = 'grabbing';
        }
        d.x = e.clientX;
        return;
      }
      stage.style.cursor = canClick && world.pick(e.clientX, e.clientY)?.action ? 'pointer' : '';
    },
    [canClick],
  );
  const onPointerUp = useCallback(
    (e: React.PointerEvent) => {
      const d = drag.current;
      drag.current = null;
      const world = worldRef.current;
      if (stageRef.current) stageRef.current.style.cursor = '';
      if (!world || !d || d.moved || !canClick || busy.current) return;
      // Клик — тоже управление: герой бросает самостоятельную работу и идёт, куда сказали.
      idleFor.current = 0;
      autoWalking.current = false;
      if (autoSeated.current) {
        autoSeated.current = false;
        world.stand();
      }
      const picked = world.pick(e.clientX, e.clientY);
      if (!picked) return;
      // Уже стоим у предмета — действуем сразу.
      if (picked.action && world.nearby()?.id === picked.action.id) interact(picked.action);
      else world.walkTo(picked.target, picked.action);
    },
    [canClick, interact],
  );

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      // Клавиши не перехватываются, когда игрок печатает или поверх открыто окно игры.
      const el = e.target as HTMLElement | null;
      const typing = el?.tagName === 'INPUT' || el?.tagName === 'TEXTAREA' || el?.tagName === 'SELECT';
      if (typing || linkRef.current?.locked) return;
      const onButton = el?.tagName === 'BUTTON' && (e.code === 'Enter' || e.code === 'Space');
      if (onButton) return;
      if (e.code in MOVE) e.preventDefault();
      if (windowView) {
        if (e.code === 'Escape' && windowView === 'open') setWindowView('closing');
        return;
      }
      if (computer !== 'closed') {
        if (e.code === 'Escape' && computer === 'open') setComputer('closing');
        return;
      }
      keys.current.add(e.code);
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
  }, [computer, interact, windowView]);

  const onWindowClosed = useCallback(() => {
    setWindowView(null);
    worldRef.current?.focusWindow(false);
    window.setTimeout(() => {
      busy.current = false;
    }, 500);
  }, []);

  const onComputerClosed = useCallback(() => {
    setComputer('closed');
    worldRef.current?.stand();
    busy.current = false;
    keys.current.clear();
  }, []);

  const night = lightingAt(hud.minutes).lamps > 0.5;

  return (
    <div className={`r3-page${ready ? ' ready' : ''}${linked ? ' embedded' : ''}`}>
      <div
        ref={stageRef}
        className={`r3-stage${computer !== 'closed' ? ' dimmed' : ''}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => (drag.current = null)}
        onWheel={(e) => worldRef.current?.zoomBy(e.deltaY)}
      />

      <div className="r3-hud">
        <div className="r3-card">
          <span className={`r3-sun${night ? ' moon' : ''}`} />
          {link ? (
            <div>
              <div className="r3-date">{t('top.date', link.date)}</div>
              <div className="r3-sub">{weekdays[link.weekday % 7]}</div>
            </div>
          ) : (
            <div>
              <div className="r3-clock">{clock(hud.minutes)}</div>
              <div className="r3-sub">
                {weekday} · {t('room.hud.day', { day: hud.day })}
              </div>
            </div>
          )}
        </div>
        <div className="r3-card">
          <div>
            <div className={`r3-money${link && link.cash < 0 ? ' negative' : ''}`}>{link ? money(link.cash) : '$3 000'}</div>
            <div className="r3-sub">{t('room.hud.account')}</div>
          </div>
        </div>
        {link && (
          <div className="r3-card">
            <div className="r3-status">{link.status}</div>
          </div>
        )}
      </div>

      {near && computer === 'closed' && !fade && !bubble && !windowView && (
        <div ref={promptRef} key={near.id} className="r3-prompt">
          <kbd>E</kbd>
          {isLamp(near.id) ? t(worldRef.current?.isLampOn(near.id) ? 'room.prompt.lampOff' : 'room.prompt.lampOn') : t(`room.prompt.${near.id}`)}
        </div>
      )}
      <div ref={bubbleRef} className={`r3-bubble${bubble ? ' show' : ''}`}>
        <span key={bubble?.id}>{bubble?.text}</span>
      </div>

      <div className="r3-keys">
        <kbd>W</kbd>
        <kbd>A</kbd>
        <kbd>S</kbd>
        <kbd>D</kbd> {t('room.controls.move')}
        <span className="r3-gap" />
        <kbd>E</kbd> {t('room.controls.act')}
        <span className="r3-gap" />
        <span className="r3-mouse" aria-hidden />
        {t('room.controls.click')}
        <span className="r3-gap" />
        {t('room.controls.rotate')}
        <span className="r3-gap" />
        {t('room.controls.zoom')}
      </div>

      {fade && (
        <div className={`r3-fade ${fade}`}>
          <div className="r3-fade-title">{t('room.sleep.title')}</div>
          <div className="r3-fade-sub">{link ? t('room.sleep.nextDay') : t('room.sleep.subtitle', { day: wakeDay })}</div>
        </div>
      )}

      {windowView && (
        <WindowView
          minutes={getMinutes}
          thought={thought}
          closing={windowView === 'closing'}
          onClose={() => setWindowView((v) => (v === 'open' ? 'closing' : v))}
          onClosed={onWindowClosed}
        />
      )}

      {computer !== 'closed' && (
        <Laptop minutes={hud.minutes} weekday={weekday} origin={origin} closing={computer === 'closing'} onClosed={onComputerClosed} />
      )}
    </div>
  );
}
