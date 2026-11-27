import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import type { OpeningLink } from '../apartment/Apartment';
import { daylightAt, realMinutes } from '../apartment/engine/daylight';
import { advanceClock, LINKED_CLOCK_RATE, frameSeconds, worksAtDesk, type RoomLink } from '../apartment/link';
import { Laptop } from '../apartment/laptop/Laptop';
import { money } from '../format';
import { peopleForScene, type IsometricOfficeId } from './state';
import { officeLayouts, type HomeAction } from './layout';
import { createRoom, makeWorker, projectPoint, monitorPoint, type Worker, type VisiblePerson, type Pose, type Point } from './raster';
import { OfficeMotion, OfficeNavigation, type Destination } from './movement';
import '../apartment/apartment.css';
import './office.css';

const INITIAL_ZOOM = { scale: 1, x: 0, y: 0 };
const HOME_MAX_WIDTH = 1060;
const DIRECTIONS: Record<string, readonly [number, number]> = {
  ArrowLeft: [-1, 0], KeyA: [-1, 0], ArrowRight: [1, 0], KeyD: [1, 0],
  ArrowUp: [0, -1], KeyW: [0, -1], ArrowDown: [0, 1], KeyS: [0, 1],
};
type Props = { office: IsometricOfficeId; link: RoomLink; opening?: never } | { office: 'home'; opening: OpeningLink; link?: never };

export function IsometricOffice({ link, office, opening }: Props) {
  const layout = officeLayouts[office];
  const { art, coffee, rest, home } = layout;
  const maxWidth = home ? HOME_MAX_WIDTH : Infinity;
  const founderSeat = art.desks.length - 1;
  const [nav] = useState(() => new OfficeNavigation(art));
  const [founder] = useState(() => new OfficeMotion(nav, founderSeat, opening ? undefined : layout.spawn));
  const { t } = useTranslation();
  const linkRef = useRef(link);
  linkRef.current = link;
  const openingRef = useRef(opening);
  openingRef.current = opening;
  const keys = useRef(new Set<string>());
  const canvas = useRef<HTMLCanvasElement>(null), details = useRef<HTMLCanvasElement>(null);
  const autoWalking = useRef(false);
  const autoSeated = useRef(false);
  const openRequested = useRef(false);
  const openRef = useRef(false);
  const [computer, setComputer] = useState<'closed' | 'open' | 'closing'>('closed');
  const [origin, setOrigin] = useState({ x: 0, y: 0 });
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [bubble, setBubble] = useState('');
  const [minutes, setMinutes] = useState(() => opening ? 21 * 60 + 30 : home ? 8 * 60 : realMinutes(new Date()));
  const [lamp, setLamp] = useState(false);
  const sleepProgress = useRef(0);
  const clock = useRef(minutes);
  const dayKey = useRef('');
  const [zoom, setZoom] = useState(INITIAL_ZOOM);
  const viewport = useRef<HTMLDivElement>(null);
  const restingRef = useRef(false);
  const [resting, setResting] = useState(false);
  const status = useRef<HTMLDivElement>(null);
  const bubbleTimer = useRef(0), restTimer = useRef(0);
  const lastActivity = useRef(link?.activity);
  const spots = useMemo(() => {
    const actions: { id: Exclude<Destination, 'floor'>; target: Point; point: Point }[] = [
      { id: 'computer', target: nav.entryPoint(founderSeat), point: monitorPoint(art, founderSeat) },
      { id: 'coffee', target: coffee.target, point: projectPoint(art, coffee.surface, coffee.height) },
      { id: 'rest', target: rest.target, point: projectPoint(art, rest.surface, rest.height) },
    ];
    if (home) {
      for (const id of Object.keys(home.extras) as HomeAction[]) {
        const { target, surface, height } = home.extras[id];
        actions.push({ id, target, point: projectPoint(art, surface, height) });
      }
    }
    return actions;
  }, [art, coffee, founderSeat, home, nav, rest]);

  const say = useCallback((text: string) => {
    setBubble(text);
    clearTimeout(bubbleTimer.current);
    bubbleTimer.current = window.setTimeout(() => setBubble(''), 3500);
  }, []);

  const open = useCallback(() => {
    const element = canvas.current;
    if (!element) return;
    const r = element.getBoundingClientRect(), p = monitorPoint(art, founderSeat);
    setOrigin({ x: r.left + p.x / art.width * r.width, y: r.top + p.y / art.height * r.height });
    openRef.current = true;
    setComputer('open');
  }, [art, founderSeat]);

  const go = useCallback((target: Point, destination: Destination) => {
    if (linkRef.current?.locked || openingRef.current || openRef.current || restingRef.current) return;
    keys.current.clear();
    autoWalking.current = false;
    autoSeated.current = false;
    openRequested.current = destination === 'computer';
    if (destination === 'computer' && founder.pose.kind === 'sit' && !founder.moving) open();
    else founder.go(target, destination);
  }, [founder, open]);

  const onComputer = link?.onComputer;
  useEffect(() => {
    onComputer?.(computer !== 'closed');
    return () => onComputer?.(false);
  }, [computer, onComputer]);

  useEffect(() => {
    if (link && lastActivity.current !== link.activity) {
      lastActivity.current = link.activity;
      say(link.thought);
    }
  }, [link, say]);

  const openingFinished = opening?.finished ?? false;
  useEffect(() => {
    if (openingFinished) setComputer(phase => phase === 'open' ? 'closing' : phase);
  }, [openingFinished]);

  const computerClosed = useCallback(() => {
    openRef.current = false;
    keys.current.clear();
    setComputer('closed');
    if (openingRef.current) founder.go(rest.target, 'rest');
  }, [founder, rest]);

  useEffect(() => {
    const element = viewport.current;
    if (!element) return;
    const onWheel = (event: WheelEvent) => {
      if (openingRef.current || openRef.current || event.ctrlKey || event.metaKey) return;
      event.preventDefault();
      const view = element.getBoundingClientRect();
      const width = Math.min(view.width, view.height * art.width / art.height, maxWidth);
      const height = width * art.height / art.width;
      const pointerX = event.clientX - view.left - view.width / 2;
      const pointerY = event.clientY - view.top - view.height / 2;
      const delta = event.deltaMode === WheelEvent.DOM_DELTA_LINE ? event.deltaY * 16 : event.deltaY;
      setZoom(previous => {
        const scale = Math.max(1, Math.min(2.4, previous.scale - delta * .0015));
        if (scale === 1) return INITIAL_ZOOM;
        if (scale === previous.scale) return previous;
        const ratio = scale / previous.scale;
        const limitX = Math.max(0, (width * scale - view.width) / 2);
        const limitY = Math.max(0, (height * scale - view.height) / 2);
        const x = pointerX - (pointerX - previous.x) * ratio;
        const y = pointerY - (pointerY - previous.y) * ratio;
        return { scale, x: Math.max(-limitX, Math.min(limitX, x)), y: Math.max(-limitY, Math.min(limitY, y)) };
      });
    };
    element.addEventListener('wheel', onWheel, { passive: false });
    return () => element.removeEventListener('wheel', onWheel);
  }, [art, maxWidth]);

  useEffect(() => {
    const pixels = canvas.current, screen = details.current;
    if (!pixels || !screen) return;
    let disposed = false, raf = 0, openingTimer = 0;
    const workers = new Map<number, Worker>();
    const movement = new Map<number, { motion: OfficeMotion; idle: number; rest: number; away: boolean }>();
    const founderPerson: VisiblePerson = { id: -1, nameSeed: 0, seat: founderSeat, busy: false, mood: 'mid', leaving: false, star: false };
    const hero = makeWorker(founderPerson, 0);
    let last = performance.now(), time = 0, idle = 0;
    let paintAt = 0;
    let previousLink: RoomLink | undefined;
    let painted = false, wasSteering = false;
    layout.loadAtlas().then(({ default: atlas }) => disposed ? null : createRoom(pixels, screen, art, atlas, Boolean(home))).then(raster => {
      if (disposed || !raster) return;
      if (openingRef.current) openingTimer = window.setTimeout(open, 1200);
      const tick = (now: number) => {
        if (disposed) return;
        if (now < paintAt) { raf = requestAnimationFrame(tick); return; }
        paintAt = now + 1000 / 30;
        const dt = frameSeconds(now, last);
        last = now;
        const current = linkRef.current;
        const runs = current?.timeRuns && !current.locked;
        if (painted && !runs && !founder.moving && !restingRef.current && !keys.current.size && !wasSteering && previousLink === current) {
          raf = requestAnimationFrame(tick);
          return;
        }
        previousLink = current;
        if (current) {
          const day = [current.date.year, current.date.month, current.date.day].join('.');
          if (dayKey.current && dayKey.current !== day) clock.current = 8 * 60;
          dayKey.current = day;
        }
        clock.current = advanceClock(clock.current, dt, { rate: LINKED_CLOCK_RATE, paused: !runs, sleeping: restingRef.current });
        const minute = Math.floor(clock.current) % 1440;
        setMinutes(previous => previous === minute ? previous : minute);
        if (runs) time += dt;
        const people = current ? peopleForScene(current.team, founderSeat) : [];
        for (const [id] of workers) if (!current?.team.people.some(p => p.id === id)) { workers.delete(id); movement.delete(id); }
        const poses = new Map<number, { worker: Worker; pose: Pose }>();
        for (const [seat, person] of people) {
          const visible = { ...person, star: person.star === true };
          let worker = workers.get(person.id);
          if (!worker) {
            worker = makeWorker(visible, person.nameSeed % 4);
            workers.set(person.id, worker);
            movement.set(person.id, { motion: new OfficeMotion(nav, seat), idle: -person.id * 3, rest: 0, away: false });
          }
          worker.person = visible;
          const state = movement.get(person.id)!;
          if (runs) {
            if (person.busy && state.away) {
              state.motion.go(nav.entryPoint(seat), 'computer');
              state.away = false;
            }
            const arrived = state.motion.step(dt);
            if (!person.busy && !state.away && !state.motion.moving) {
              state.idle += dt;
              if (state.idle > 14) {
                state.idle = 0;
                state.rest = 0;
                state.away = true;
                state.motion.go(layout.breakPoints[seat % layout.breakPoints.length]!, 'floor');
              }
            }
            if (state.away && !state.motion.moving) {
              state.rest += dt;
              if (state.rest > 4) {
                state.motion.go(nav.entryPoint(seat), 'computer');
                state.away = false;
              }
            }
            if (arrived === 'computer') state.idle = -person.id * 3;
            if (person.busy && state.motion.pose.kind === 'sit') worker.monitor.advance(dt);
          }
          poses.set(seat, { worker, pose: state.motion.pose });
        }
        const moving = founder.moving;
        if (!openRef.current && !current?.locked && !restingRef.current) {
          let horizontal = 0, vertical = 0;
          for (const key of keys.current) {
            const direction = DIRECTIONS[key]!;
            horizontal += direction[0];
            vertical += direction[1];
          }
          const pace = current?.pace ?? 1;
          const wantsDesk = runs && worksAtDesk(current.activity);
          if (home && autoSeated.current && !wantsDesk) {
            autoSeated.current = false;
            founder.go(nav.entryPoint(founderSeat), 'floor');
          }
          let arrived: Destination | null = null;
          wasSteering = Boolean(horizontal || vertical);
          if (wasSteering) {
            autoWalking.current = false;
            autoSeated.current = false;
            openRequested.current = false;
            founder.steer(horizontal, vertical, dt * pace);
          } else {
            founder.stopSteering();
            arrived = founder.step((autoWalking.current && !runs ? 0 : dt) * pace);
          }
          if (arrived === 'computer') {
            autoSeated.current = autoWalking.current;
            autoWalking.current = false;
          }
          if (arrived === 'computer' && openRequested.current) { openRequested.current = false; open(); }
          if (arrived === 'coffee') say(t(current?.coffee() ? 'room.bubble.coffeeBoost' : 'room.bubble.coffeeTooSoon'));
          if (arrived === 'boxes') say(t('room.bubble.boxes'));
          if (arrived === 'lamp') setLamp(on => !on);
          if (arrived === 'window') {
            const thoughts = t('room.bubble.window', { returnObjects: true }) as string[];
            say(thoughts[Math.floor(Math.random() * thoughts.length)] ?? '');
          }
          if (arrived === 'rest') {
            sleepProgress.current = 0;
            restingRef.current = true;
            setBubble('');
            setResting(true);
            restTimer.current = window.setTimeout(() => {
              if (openingRef.current) { openingRef.current.onSlept(); return; }
              if (!linkRef.current?.locked) linkRef.current?.sleep();
              restingRef.current = false;
              setResting(false);
              say(t('room.bubble.wakeRested'));
            }, home ? 1900 : 900);
          }
          if (!moving && !wasSteering && founder.pose.kind !== 'sit' && wantsDesk) idle += dt;
          else idle = 0;
          if (idle > 5) { idle = 0; autoWalking.current = true; openRequested.current = false; founder.go(nav.entryPoint(founderSeat), 'computer'); }
        }
        hero.person = { ...founderPerson, busy: current ? worksAtDesk(current.activity) : false };
        if (runs && founder.pose.kind === 'sit' && hero.person.busy) hero.monitor.advance(dt);
        const pillow = restingRef.current ? home?.pillow : undefined;
        if (pillow) {
          sleepProgress.current += dt;
          const at = founder.pose.at;
          const t = Math.min(1, sleepProgress.current / .6);
          const lying = t >= 1;
          const pose = {
            ...founder.pose,
            at: { x: at.x + (pillow.x - at.x) * t, y: at.y + (pillow.y - at.y) * t },
            sink: Math.round(20 * t),
          };
          raster.draw(poses, time, lying ? undefined : { worker: hero, pose }, lying ? { worker: hero, pillow } : undefined);
        } else {
          raster.draw(poses, time, { worker: hero, pose: founder.pose });
        }
        if (!painted) { painted = true; setReady(true); }
        if (status.current) {
          const p = projectPoint(art, founder.pose.at, founder.pose.kind === 'sit' ? 40 : 45);
          status.current.style.left = p.x / art.width * 100 + '%';
          status.current.style.top = p.y / art.height * 100 + '%';
        }
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }).catch(reason => { if (!disposed) setError(reason instanceof Error ? reason : new Error(String(reason))); });
    return () => { disposed = true; cancelAnimationFrame(raf); clearTimeout(openingTimer); };
  }, [art, founder, founderSeat, home, layout, nav, open, say, t]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (openingRef.current) return;
      if (e.key === 'Escape' && openRef.current) setComputer('closing');
      if (openRef.current || linkRef.current?.locked || restingRef.current) return;
      const el = e.target as HTMLElement | null;
      if (el?.matches('input,textarea,select,[contenteditable="true"]')) return;
      if (home && DIRECTIONS[e.code]) {
        e.preventDefault();
        keys.current.add(e.code);
        return;
      }
      if (e.repeat || el?.matches('button')) return;
      const act = e.code === 'KeyE' || e.key === 'Enter' || (home && e.code === 'Space');
      if (!act) return;
      e.preventDefault();
      const { at, kind } = founder.pose;
      const nearest = () => spots.map(spot => ({ spot, distance: Math.hypot(at.x - spot.target.x, at.y - spot.target.y) }))
        .filter(({ distance }) => distance <= 19).sort((a, b) => a.distance - b.distance)[0]?.spot;
      const spot = !home || kind === 'sit' ? spots[0] : nearest();
      if (spot) go(spot.target, spot.id);
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
      clearTimeout(bubbleTimer.current);
      clearTimeout(restTimer.current);
    };
  }, [founder, go, home, spots]);

  if (error) throw error;
  const weekdays = t('room.hud.weekdays', { returnObjects: true }) as string[];
  const employeeButtons = art.desks.slice(0, founderSeat).map((_, seat) => {
    const p = monitorPoint(art, seat), person = link?.team.people.find(p => p.seat === seat);
    return <button key={seat} type="button" className="iso-target employee" data-seat={seat} data-employee={person?.id}
      style={{ left: p.x / art.width * 100 + '%', top: p.y / art.height * 100 + '%' }}
      aria-label={person ? t('coworking.person', { name: person.name, role: person.roleTitle }) : t('coworking.free', { seat: seat + 1 })}
      disabled={link?.locked}
      onClick={() => { if (person) say(person.quote); }} />;
  });
  const dark = home ? daylightAt(minutes).dark : 0;
  const labels: Record<Exclude<Destination, 'floor'>, string> = {
    computer: t('coworking.computer'),
    coffee: t('coworking.coffee'),
    rest: t(home ? 'room.prompt.bed' : 'coworking.rest'),
    window: t('room.prompt.window'),
    lamp: t(lamp ? 'room.prompt.lampOff' : 'room.prompt.lampOn'),
    boxes: t('room.prompt.boxes'),
  };

  return <div className={`lm-page ready iso-page${link ? ' embedded' : ''}`} data-scene={office} data-ready={ready} data-opening={!!opening}>
    <div className="iso-view" ref={viewport} style={home ? {
      filter: `brightness(${1 - dark * .44 + (lamp ? .055 + dark * .11 : 0)}) saturate(${1 - dark * .18})`,
    } : undefined}>
      <div className="iso-room" style={{
        '--iso-aspect': art.width / art.height,
        '--iso-max-width': home ? HOME_MAX_WIDTH + 'px' : '100cqw',
        '--iso-target-width': 30 / art.width * 100 + '%',
        '--iso-target-height': 24 / art.height * 100 + '%',
        transform: `translate(${zoom.x}px, ${zoom.y}px) scale(${zoom.scale})`,
      } as CSSProperties}>
        <canvas ref={canvas} width={art.width} height={art.height} className="iso-pixels"
          onPointerDown={e => {
            if (e.button !== 0) return;
            const r = e.currentTarget.getBoundingClientRect();
            const sx = (e.clientX - r.left) / r.width * art.width - art.origin[0]!;
            const sy = (e.clientY - r.top) / r.height * art.height - art.origin[1]!;
            go({ x: sy + sx / 2, y: sy - sx / 2 }, 'floor');
          }} />
        <canvas ref={details} className="iso-details" />
        {employeeButtons}
        {!opening && spots.map(spot => <button key={spot.id} type="button" className="iso-target" data-spot={spot.id}
          title={labels[spot.id]} aria-label={labels[spot.id]} disabled={link?.locked || resting || computer !== 'closed'}
          style={{ left: spot.point.x / art.width * 100 + '%', top: spot.point.y / art.height * 100 + '%' }}
          onClick={() => go(spot.target, spot.id)} />)}
        {link?.pointAtDesk && computer === 'closed' && !resting && <div className="lm-arrow show" aria-hidden="true" style={{
          left: monitorPoint(art, founderSeat).x / art.width * 100 + '%',
          top: monitorPoint(art, founderSeat).y / art.height * 100 + '%',
          transform: 'translate(-50%, -125%)',
        }}>
          <svg viewBox="0 0 14 16" width="28" height="32" shapeRendering="crispEdges">
            <path d="M4 0h6v8h4l-7 8-7-8h4z" fill="#f6c34a" stroke="#26324a" strokeWidth="1.4" />
          </svg>
        </div>}
        <div ref={status} className="iso-thought" role="status">{bubble}</div>
      </div>
    </div>
    {link && <>
      <div className="lm-hud-row">
        <div className="lm-card"><div><div className="lm-date">{t('top.date', link.date)}</div><div className="lm-sub">{weekdays[link.weekday]} · {link.team.office.title}</div></div></div>
        <div className="lm-card"><div><div className="lm-cash">{money(link.cash)}</div><div className="lm-sub">{link.daysToBankruptcy !== null ? t('top.crisis', { days: link.daysToBankruptcy }) : link.status}</div></div></div>
      </div>
      {computer === 'closed' && <div className="lm-hud-row lm-hud-right">{link.controls}</div>}
      <p className="iso-hint">{t(home ? 'room.controls.isometric' : 'coworking.hint')}</p>
    </>}
    {!ready && <p className="iso-loading">{t('office.loading')}</p>}
    {resting && (home ? <div className="iso-rest iso-sleep">
      <div>{t(opening ? 'opening.dayTitle' : 'room.sleep.title')}</div>
      <small>{t(opening ? 'opening.morning' : 'room.sleep.restDay')}</small>
    </div> : <div className="iso-rest">{t('coworking.resting')}</div>)}
    {computer !== 'closed' && <Laptop fullscreen minutes={minutes} weekday={weekdays[link?.weekday ?? 0] ?? ''} origin={origin}
      closing={computer === 'closing'} onClosed={computerClosed}
      company={opening?.app ?? link?.companyApp} onTyped={link?.onTyped} onDockApp={link?.onDockApp}
      focusText={link?.focusText} controls={link?.controls} appTitle={opening?.title} canLeave={!opening} />}
  </div>;
}
