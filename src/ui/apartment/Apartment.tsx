// Квартира основателя: пиксель-арт, вид сверху. Ходьба клавишами и мышью, компьютер, кофе, сон, лампы, окно, время суток.
// В игре (есть link) показывает настоящие дату и деньги, сон проматывает игровой день, а герой сам садится работать.
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { money } from '../format';
import { loadArt } from './engine/art';
import { daylightAt, realMinutes } from './engine/daylight';
import { SPOTS, type LampId, type Spot } from './engine/scene';
import { World } from './engine/world';
import { PixelIcon } from '../pixelIcons';
import { Laptop } from './laptop/Laptop';
import { AUTOPILOT_IDLE_SECONDS, frameSeconds, LINKED_CLOCK_RATE, worksAtDesk, type RoomLink } from './link';
import './apartment.css';

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
const DESK = SPOTS.find((s) => s.id === 'computer')!;
const BED = SPOTS.find((s) => s.id === 'bed')!;

/** Начало игры: вечер перед первым днём. Герой за компьютером, на экране — переписка с другом. */
export interface OpeningLink {
  /** Программа, открытая на экране компьютера (мессенджер) */
  app: ReactNode;
  /** Её название в верхней строке экрана */
  title: string;
  /** Переписка закончена: герой встаёт и идёт спать */
  finished: boolean;
  /** Герой уснул — пора начинать партию */
  onSlept: () => void;
}

function clock(minutes: number): string {
  const m = Math.floor(minutes) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

export function Apartment({ link, opening }: { link?: RoomLink; opening?: OpeningLink } = {}) {
  const { t } = useTranslation();
  // Связь с партией читается из ref: главный цикл создаётся один раз и не перезапускается каждый игровой день.
  const linkRef = useRef(link);
  linkRef.current = link;
  const openingRef = useRef(opening);
  openingRef.current = opening;
  const linked = link !== undefined;
  /** Герой сел за компьютер сам, без игрока: экран компьютера не открывается. */
  const autoSeated = useRef(false);
  /** Кто посадил героя за стол без открытого экрана: сам (работа по расчёту игры) или игрок (Esc за компьютером). */
  const seatedBy = useRef<'auto' | 'player'>('auto');
  const autoWalking = useRef(false);
  const idleFor = useRef(0);
  const [seatedAlone, setSeatedAlone] = useState(false);
  const seat = useCallback((value: boolean) => {
    autoSeated.current = value;
    setSeatedAlone(value);
  }, []);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const promptRef = useRef<HTMLDivElement>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const arrowRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<World | null>(null);
  const keys = useRef(new Set<string>());
  const busy = useRef(false);
  const interactRef = useRef<(spot: Spot) => void>(() => {});

  const [near, setNear] = useState<Spot | null>(null);
  const [computer, setComputer] = useState<ComputerPhase>('closed');
  const [bubble, setBubble] = useState<{ text: string; id: number } | null>(null);
  const [hud, setHud] = useState(() => ({ minutes: realMinutes(new Date()), day: 1 }));
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

  const weekdays = t('room.hud.weekdays', { returnObjects: true }) as string[];
  const weekday = weekdays[(link ? link.weekday : hud.day - 1) % 7] ?? '';
  const startMinutes = useMemo(() => {
    const m = /^(\d{1,2}):(\d{2})$/.exec(new URLSearchParams(window.location.search).get('time') ?? '');
    if (m) return Number(m[1]) * 60 + Number(m[2]);
    // Без ?time — настоящее время игрока: у него утро — и в игре утро, ночь — ночь.
    return null;
  }, []);

  const say = useCallback((text: string, ms = 3800) => {
    const id = Date.now();
    setBubble({ text, id });
    window.setTimeout(() => setBubble((b) => (b?.id === id ? null : b)), ms);
  }, []);

  // Рисуем графику, создаём мир и запускаем главный цикл.
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
        if (startMinutes === null) {
          world.realClock = true;
          world.minutes = realMinutes(new Date());
        } else world.minutes = startMinutes;
        // На мониторе настоящий код и издалека; ?monitor=pixel — издалека пиксели, текст только вблизи.
        world.monitorText = new URLSearchParams(window.location.search).get('monitor') !== 'pixel';
        if (linkRef.current) {
          world.externalDay = true;
          world.clockRate = LINKED_CLOCK_RATE;
        }
        // Только для проверок в режиме разработки.
        if (import.meta.env.DEV) (window as unknown as { __room?: World }).__room = world;
        world.onArrive = (spot) => interactRef.current(spot);
        world.onCoffeeReady = () => {
          busy.current = false;
          say(t(linkRef.current ? 'room.bubble.coffeeBoost' : 'room.bubble.coffeeReady'));
        };
        onResize = () => world.resize();
        window.addEventListener('resize', onResize);
        if (openingRef.current) {
          // Начало игры: герой уже сидит за компьютером, через миг экран приближается — там пишет друг.
          world.stand();
          world.sit();
          busy.current = true;
          window.setTimeout(() => {
            setOrigin(world.monitorOnScreen());
            setComputer('open');
          }, 1500);
        }

        let last = performance.now();
        let hudTimer = 0;
        let nearId: string | null = null;
        const frame = (now: number) => {
          const dt = frameSeconds(now, last);
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
          if (game?.locked || openingRef.current) {
            ix = 0;
            iy = 0;
          }
          // Игрок взялся за управление — герой встаёт из-за стола и слушается.
          if (ix !== 0 || iy !== 0) {
            idleFor.current = 0;
            autoWalking.current = false;
            if (autoSeated.current) {
              seat(false);
              world.stand();
              busy.current = false;
            }
          } else {
            idleFor.current += dt;
          }
          if (game) {
            world.clockPaused = !game.timeRuns;
            const wantsDesk = worksAtDesk(game.activity) && game.timeRuns;
            // Героя, которого посадил сам игрок, игра не поднимает: он сидит, пока игрок не пойдёт.
            if (autoSeated.current && seatedBy.current === 'auto' && !wantsDesk) {
              // Работа кончилась или игра на паузе — герой встаёт.
              seat(false);
              world.stand();
            } else if (wantsDesk && !busy.current && !autoSeated.current && !autoWalking.current && world.idle && idleFor.current > AUTOPILOT_IDLE_SECONDS) {
              autoWalking.current = world.walkTo(DESK.at, DESK);
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
          if (arrowRef.current) {
            const p = world.project(DESK.anchor);
            arrowRef.current.style.transform = `translate(${Math.round(p.x)}px, ${Math.round(p.y)}px) translate(-50%, -100%)`;
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
  }, [say, t, startMinutes, seat]);

  const interact = useCallback(
    (spot: Spot) => {
      const world = worldRef.current;
      if (!world || busy.current) return;
      if (spot.id === 'computer' && autoWalking.current) {
        // Герой дошёл до стола сам: просто садится работать.
        autoWalking.current = false;
        seatedBy.current = 'auto';
        seat(true);
        world.sit();
        return;
      }
      autoWalking.current = false;
      const alreadySeated = autoSeated.current;
      if (alreadySeated && spot.id !== 'computer') world.stand();
      seat(false);
      idleFor.current = 0;
      if (spot.id === 'computer') {
        busy.current = true;
        world.sit();
        setOrigin(world.monitorOnScreen());
        // Уже сидит за столом — экран открывается сразу.
        window.setTimeout(() => setComputer('open'), alreadySeated ? 80 : 700);
      } else if (spot.id === 'coffee') {
        // В игре кофе помогает не всегда: после чашки нужен перерыв в несколько дней.
        if (linkRef.current && !linkRef.current.coffee()) {
          say(t('room.bubble.coffeeTooSoon'), 2600);
          return;
        }
        busy.current = true;
        world.brew();
        say(t('room.bubble.brewing'), 2600);
      } else if (spot.id === 'bed') {
        busy.current = true;
        setBubble(null);
        setWakeDay(world.minutes % 1440 > 7 * 60 + 30 ? world.day + 1 : world.day);
        world.sleep();
        window.setTimeout(() => setFade('out'), 1100);
        window.setTimeout(() => {
          // В игре сон — это переход на следующий игровой день.
          // Начало игры: герой уснул — партия начинается утром.
          const start = openingRef.current;
          if (start) {
            start.onSlept();
            return;
          }
          linkRef.current?.sleep();
          world.wakeUp();
          setHud({ minutes: world.minutes, day: world.day });
          setFade('in');
        }, 3600);
        window.setTimeout(() => {
          setFade(null);
          busy.current = false;
          idleFor.current = 0;
          say(t(linkRef.current ? 'room.bubble.wakeRested' : 'room.bubble.wake'));
        }, 4500);
      } else if (isLamp(spot.id)) {
        world.toggleLamp(spot.id);
        setLampTick((n) => n + 1);
      } else if (spot.id === 'boxes') {
        say(t('room.bubble.boxes'));
      } else {
        busy.current = true;
        world.hold(true);
        const thoughts = t('room.bubble.window', { returnObjects: true }) as string[];
        say(thoughts[Math.floor(Math.random() * thoughts.length)] ?? '', 4200);
        window.setTimeout(() => {
          world.hold(false);
          busy.current = false;
        }, 4200);
      }
    },
    [say, t, seat],
  );
  interactRef.current = interact;

  // Игра узнаёт, что игрок сел за компьютер или встал.
  const computerOpen = computer !== 'closed';
  useEffect(() => {
    linkRef.current?.onComputer(computerOpen);
  }, [computerOpen]);
  useEffect(() => () => linkRef.current?.onComputer(false), []);

  // Мысль героя вслух, когда его занятие меняется.
  const heroThought = link?.thought;
  useEffect(() => {
    if (heroThought && !busy.current) say(heroThought, 4200);
  }, [heroThought, say]);

  // Мышь: клик по полу — идти туда, по предмету — подойти и использовать.
  const canClick = computer === 'closed' && !fade && !link?.locked && !opening;
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
      // Клик — тоже управление: герой бросает самостоятельную работу и идёт, куда сказали.
      idleFor.current = 0;
      autoWalking.current = false;
      const picked = world.pick(e.clientX, e.clientY);
      if (autoSeated.current) {
        // Герой уже за столом: клик по столу открывает компьютер, клик в другое место — встаёт и идёт.
        if (picked.spot?.id === 'computer') return interact(picked.spot);
        seat(false);
        world.stand();
      }
      // Уже стоим у предмета — действуем сразу.
      if (picked.spot && world.nearby()?.id === picked.spot.id) interact(picked.spot);
      else world.walkTo(picked.target, picked.spot);
    },
    [canClick, interact, touched, seat],
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
      // В начале игры управляет сцена: клавиши идут только в мессенджер.
      if (linkRef.current?.locked || openingRef.current) return;
      // За компьютером клавиши принадлежат его программам; квартира слушает только Esc.
      if (computer !== 'closed') {
        if (e.code === 'Escape' && computer === 'open') setComputer('closing');
        return;
      }
      // Клавиши не перехватываются, когда игрок печатает или нажимает кнопку игры.
      const el = e.target as HTMLElement | null;
      if (el?.tagName === 'INPUT' || el?.tagName === 'TEXTAREA' || el?.tagName === 'SELECT') return;
      if (el?.tagName === 'BUTTON' && (e.code === 'Enter' || e.code === 'Space')) return;
      if (e.code in MOVE) e.preventDefault();
      touched();
      const act = (e.code === 'KeyE' || e.code === 'Enter' || e.code === 'Space') && !e.repeat;
      if (act && autoSeated.current) {
        // Герой уже сидит за столом — открываем компьютер.
        interact(DESK);
        return;
      }
      keys.current.add(e.code);
      if (act) {
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

  // Переписка закончена — экран отъезжает.
  const openingDone = opening?.finished ?? false;
  useEffect(() => {
    if (openingDone) setComputer((c) => (c === 'open' ? 'closing' : c));
  }, [openingDone]);

  // Экран закрыт (Esc): камера снова показывает комнату, а герой остаётся за столом и печатает.
  // Встаёт он, когда игрок пошёл (клавиши или клик по комнате); E снова открывает экран.
  const onComputerClosed = useCallback(() => {
    setComputer('closed');
    const world = worldRef.current;
    if (openingRef.current && world) {
      // Переписка закончена: герой встаёт и идёт спать.
      seat(false);
      world.stand();
      busy.current = false;
      autoWalking.current = false;
      world.walkTo(BED.at, BED);
      return;
    }
    seatedBy.current = 'player';
    seat(true);
    busy.current = false;
    idleFor.current = 0;
    keys.current.clear();
  }, [seat]);

  const night = daylightAt(hud.minutes).dark > 0.5;
  const promptText = near
    ? isLamp(near.id)
      ? t(worldRef.current?.isLampOn(near.id) ? 'room.prompt.lampOff' : 'room.prompt.lampOn')
      : near.id === 'boxes'
        ? ''
        : t(`room.prompt.${near.id}`)
    : '';

  return (
    <div className={`lm-page${ready ? ' ready' : ''}${linked ? ' embedded' : ''}`}>
      <canvas
        ref={canvasRef}
        className={`lm-stage${computer !== 'closed' ? ' dimmed' : ''}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onWheel={onWheel}
      />
      <div className="lm-vignette" />

      {opening ? null : link ? (
        <div className="lm-hud-row">
          <div className="lm-card">
            <PixelIcon name={night ? 'moon' : 'sun'} className={`lm-sun${night ? ' moon' : ''}`} />
            <div>
              <div className="lm-date">{t('top.date', link.date)}</div>
              <div className="lm-sub">
                {weekday} · {clock(hud.minutes)}
              </div>
            </div>
          </div>
          <div className="lm-card">
            <div>
              <div className={`lm-cash${link.cash < 0 ? ' negative' : ''}`}>{money(link.cash)}</div>
              <div className={`lm-sub${link.daysToBankruptcy !== null ? ' alert' : ''}`}>
                {link.daysToBankruptcy !== null ? t('top.crisis', { days: link.daysToBankruptcy }) : t('room.hud.account')}
              </div>
            </div>
          </div>
          <div className="lm-card lm-status">{link.status}</div>
        </div>
      ) : (
        <div className="lm-hud">
          <span className={`lm-sun${night ? ' moon' : ''}`} />
          <span className="lm-clock">{clock(hud.minutes)}</span>
          <span className="lm-day">
            {weekday} · {t('room.hud.day', { day: hud.day })}
          </span>
          <span className="lm-sep" />
          <span className="lm-coin" />
          <span className="lm-money">$3 000</span>
          <span className="lm-day">{t('room.hud.account')}</span>
        </div>
      )}

      {link && <div className="lm-hud-row lm-hud-right">{link.controls}</div>}

      {seatedAlone && computer === 'closed' && !fade && (
        <div className="lm-prompt lm-prompt-fixed">
          <kbd>E</kbd>
          {t('room.prompt.openComputer')}
          <i className="lm-prompt-sep" />
          <kbd>W</kbd>
          <kbd>A</kbd>
          <kbd>S</kbd>
          <kbd>D</kbd>
          {t('room.prompt.standUp')}
        </div>
      )}
      {near && promptText && computer === 'closed' && !fade && !bubble && !opening && (
        <div ref={promptRef} key={near.id} className="lm-prompt">
          <kbd>E</kbd>
          {promptText}
        </div>
      )}
      {/* Обучение: стрелка над столом — «тебе сюда». Пропадает, когда герой уже за компьютером. */}
      <div ref={arrowRef} className={`lm-arrow${link?.pointAtDesk && computer === 'closed' && !seatedAlone && !fade ? ' show' : ''}`} aria-hidden="true">
        <svg viewBox="0 0 14 16" width="28" height="32" shapeRendering="crispEdges">
          <path d="M4 0h6v8h4l-7 8-7-8h4z" fill="#f6c34a" stroke="#26324a" strokeWidth="1.4" />
        </svg>
      </div>
      <div ref={bubbleRef} className={`lm-bubble${bubble ? ' show' : ''}`}>
        <span key={bubble?.id}>{bubble?.text}</span>
      </div>

      <div className={`lm-keys${hintGone || opening ? ' gone' : ''}`}>
        <kbd>W</kbd>
        <kbd>A</kbd>
        <kbd>S</kbd>
        <kbd>D</kbd>
        <span>{t('room.controls.move')}</span>
        <i />
        <kbd>E</kbd>
        <span>{t('room.controls.act')}</span>
        <i />
        <span>{t('room.controls.click')}</span>
        <i />
        <span>{t('room.controls.zoom')}</span>
      </div>

      {fade && (
        <div className={`lm-fade ${fade}`}>
          <div className="lm-fade-title">{opening ? t('opening.dayTitle') : t('room.sleep.title')}</div>
          <div className="lm-fade-sub">{link ? t('room.sleep.restDay') : opening ? t('opening.morning') : t('room.sleep.subtitle', { day: wakeDay })}</div>
        </div>
      )}

      {error && <div className="lm-error">{error}</div>}

      {computer !== 'closed' && (
        <Laptop
          minutes={hud.minutes}
          weekday={weekday}
          origin={origin}
          closing={computer === 'closing'}
          onClosed={onComputerClosed}
          company={opening?.app ?? link?.companyApp}
          appTitle={opening?.title}
          canLeave={!opening}
          onTyped={link?.onTyped}
          onDockApp={link?.onDockApp}
          focusText={link?.focusText}
          controls={link?.controls}
        />
      )}
    </div>
  );
}
