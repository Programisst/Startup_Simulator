import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { realMinutes } from '../apartment/engine/daylight';
import { advanceClock, LINKED_CLOCK_RATE, frameSeconds, worksAtDesk, type RoomLink } from '../apartment/link';
import { Laptop } from '../apartment/laptop/Laptop';
import { money } from '../format';
import { peopleForScene, founderSeat } from './state';
import { createRoom, makeWorker, projectPoint, monitorPoint, type Worker, type VisiblePerson, type Pose, type Point } from './raster';
import { FounderMotion, entryPoint, coffeePoint, restPoint, type Destination } from './movement';
import art from './coworking-art.json';
import atlas from './coworking-art.png?inline';
import '../apartment/apartment.css';
import './coworking.css';

const FOUNDER: VisiblePerson = { id: -1, nameSeed: 0, seat: founderSeat, busy: false, mood: 'mid', leaving: false, star: false };

export function Coworking({ link }: { link: RoomLink }) {
  const { t } = useTranslation();
  const linkRef = useRef(link);
  linkRef.current = link;
  const canvas = useRef<HTMLCanvasElement>(null), details = useRef<HTMLCanvasElement>(null);
  const founder = useRef(new FounderMotion());
  const autoWalking = useRef(false);
  const openRequested = useRef(false);
  const openRef = useRef(false);
  const [computer, setComputer] = useState<'closed' | 'open' | 'closing'>('closed');
  const [origin, setOrigin] = useState({ x: 0, y: 0 });
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [bubble, setBubble] = useState('');
  const [minutes, setMinutes] = useState(() => realMinutes(new Date()));
  const clock = useRef(minutes);
  const dayKey = useRef('');
  const [zoom, setZoom] = useState(1);
  const restingRef = useRef(false);
  const [resting, setResting] = useState(false);
  const status = useRef<HTMLDivElement>(null);
  const bubbleTimer = useRef(0), restTimer = useRef(0);
  const lastActivity = useRef(link.activity);

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
  }, []);

  const go = useCallback((target: Point, destination: Destination) => {
    if (linkRef.current.locked || openRef.current || restingRef.current) return;
    autoWalking.current = false;
    openRequested.current = destination === 'computer';
    if (destination === 'computer' && founder.current.pose.kind === 'sit' && !founder.current.moving) open();
    else founder.current.go(target, destination);
  }, [open]);

  useEffect(() => {
    link.onComputer(computer !== 'closed');
    return () => linkRef.current.onComputer(false);
  }, [computer, link.onComputer]);

  useEffect(() => {
    if (lastActivity.current !== link.activity) {
      lastActivity.current = link.activity;
      say(link.thought);
    }
  }, [link.activity, link.thought, say]);

  useEffect(() => {
    if (!canvas.current || !details.current) return;
    let disposed = false, raf = 0;
    const workers = new Map<number, Worker>();
    const movement = new Map<number, { motion: FounderMotion; idle: number; rest: number; away: boolean }>();
    const hero = makeWorker(FOUNDER, 0);
    let last = performance.now(), time = 0, idle = 0;
    let paintAt = 0;
    let previousLink: RoomLink | undefined;
    createRoom(canvas.current, details.current, art, atlas).then(raster => {
      if (disposed) return;
      setReady(true);
      const tick = (now: number) => {
        if (disposed) return;
        if (now < paintAt) { raf = requestAnimationFrame(tick); return; }
        paintAt = now + 1000 / 30;
        const dt = frameSeconds(now, last);
        last = now;
        const current = linkRef.current;
        const runs = current.timeRuns && !current.locked;
        if (!runs && !founder.current.moving && previousLink === current) {
          raf = requestAnimationFrame(tick);
          return;
        }
        previousLink = current;
        const day = [current.date.year, current.date.month, current.date.day].join('.');
        if (dayKey.current && dayKey.current !== day) clock.current = 8 * 60;
        dayKey.current = day;
        clock.current = advanceClock(clock.current, dt, { rate: LINKED_CLOCK_RATE, paused: !runs, sleeping: restingRef.current });
        const minute = Math.floor(clock.current) % 1440;
        setMinutes(previous => previous === minute ? previous : minute);
        if (runs) time += dt;
        const people = peopleForScene(current.team);
        for (const [id] of workers) if (!current.team.people.some(p => p.id === id)) { workers.delete(id); movement.delete(id); }
        const poses = new Map<number, { worker: Worker; pose: Pose }>();
        for (const [seat, person] of people) {
          const visible = { ...person, star: person.star === true };
          let worker = workers.get(person.id);
          if (!worker) {
            worker = makeWorker(visible, person.nameSeed % 4);
            workers.set(person.id, worker);
            movement.set(person.id, { motion: new FounderMotion(seat, true), idle: -person.id * 3, rest: 0, away: false });
          }
          worker.person = visible;
          const state = movement.get(person.id)!;
          if (runs) {
            if (person.busy && state.away) {
              state.motion.go(entryPoint(seat), 'computer');
              state.away = false;
            }
            const arrived = state.motion.step(dt);
            if (!person.busy && !state.away && !state.motion.moving) {
              state.idle += dt;
              if (state.idle > 14) {
                state.idle = 0;
                state.rest = 0;
                state.away = true;
                state.motion.go(restPoint, 'floor');
              }
            }
            if (state.away && !state.motion.moving) {
              state.rest += dt;
              if (state.rest > 4) {
                state.motion.go(entryPoint(seat), 'computer');
                state.away = false;
              }
            }
            if (arrived === 'computer') state.idle = -person.id * 3;
            if (person.busy && state.motion.pose.kind === 'sit') worker.monitor.advance(dt);
          }
          poses.set(seat, { worker, pose: state.motion.pose });
        }
        const moving = founder.current.moving;
        if (!openRef.current && !current.locked) {
          const arrived = founder.current.step((autoWalking.current && !runs ? 0 : dt) * current.pace);
          if (arrived === 'computer') autoWalking.current = false;
          if (arrived === 'computer' && openRequested.current) { openRequested.current = false; open(); }
          if (arrived === 'coffee') say(t(current.coffee() ? 'room.bubble.coffeeBoost' : 'room.bubble.coffeeTooSoon'));
          if (arrived === 'rest') {
            restingRef.current = true;
            setResting(true);
            restTimer.current = window.setTimeout(() => {
              if (!linkRef.current.locked) linkRef.current.sleep();
              restingRef.current = false;
              setResting(false);
              say(t('room.bubble.wakeRested'));
            }, 900);
          }
          if (!moving && founder.current.pose.kind !== 'sit' && runs && worksAtDesk(current.activity)) idle += dt;
          else idle = 0;
          if (idle > 5) { idle = 0; autoWalking.current = true; openRequested.current = false; founder.current.go(entryPoint(founderSeat), 'computer'); }
        }
        hero.person = { ...FOUNDER, busy: worksAtDesk(current.activity) };
        if (runs && founder.current.pose.kind === 'sit' && hero.person.busy) hero.monitor.advance(dt);
        raster.draw(poses, time, { worker: hero, pose: founder.current.pose });
        if (status.current) {
          const p = projectPoint(art, founder.current.pose.at, founder.current.pose.kind === 'sit' ? 40 : 45);
          status.current.style.left = p.x / art.width * 100 + '%';
          status.current.style.top = p.y / art.height * 100 + '%';
        }
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }).catch(reason => { if (!disposed) setError(reason instanceof Error ? reason : new Error(String(reason))); });
    return () => { disposed = true; cancelAnimationFrame(raf); };
  }, [open, say, t]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && openRef.current) setComputer('closing');
      if (openRef.current || linkRef.current.locked || e.repeat) return;
      if ((e.target as HTMLElement)?.matches('input,textarea,select,button')) return;
      if (e.code === 'KeyE' || e.key === 'Enter') { e.preventDefault(); go(entryPoint(founderSeat), 'computer'); }
    };
    window.addEventListener('keydown', down);
    return () => {
      window.removeEventListener('keydown', down);
      clearTimeout(bubbleTimer.current);
      clearTimeout(restTimer.current);
    };
  }, [go]);

  if (error) throw error;
  const weekdays = t('room.hud.weekdays', { returnObjects: true }) as string[];
  const employeeButtons = art.desks.slice(0, founderSeat).map((_, seat) => {
    const p = monitorPoint(art, seat), person = link.team.people.find(p => p.seat === seat);
    return <button key={seat} type="button" className="iso-target employee" data-seat={seat} data-employee={person?.id}
      style={{ left: p.x / art.width * 100 + '%', top: p.y / art.height * 100 + '%' }}
      aria-label={person ? t('coworking.person', { name: person.name, role: person.roleTitle }) : t('coworking.free', { seat: seat + 1 })}
      disabled={link.locked}
      onClick={() => { if (person) say(person.quote); }} />;
  });
  const hotspots: { id: Destination; point: Point; label: string }[] = [
    { id: 'computer', point: monitorPoint(art, founderSeat), label: t('coworking.computer') },
    { id: 'coffee', point: projectPoint(art, { x: 17, y: 91 }, 24), label: t('coworking.coffee') },
    { id: 'rest', point: projectPoint(art, { x: 16, y: 146 }, 12), label: t('coworking.rest') },
  ];

  return <div className="lm-page embedded ready iso-page" data-scene="coworking" data-ready={ready}>
    <div className="iso-view">
      <div className="iso-room" style={{ aspectRatio: art.width + '/' + art.height, transform: `scale(${zoom})` }}
        onWheel={e => { if (!openRef.current) setZoom(z => Math.max(1, Math.min(1.7, z - e.deltaY * .001))); }}>
        <canvas ref={canvas} width={art.width} height={art.height} className="iso-pixels"
          onPointerDown={e => {
            const r = e.currentTarget.getBoundingClientRect();
            const sx = (e.clientX - r.left) / r.width * art.width - art.origin[0]!;
            const sy = (e.clientY - r.top) / r.height * art.height - art.origin[1]!;
            go({ x: sy + sx / 2, y: sy - sx / 2 }, 'floor');
          }} />
        <canvas ref={details} className="iso-details" />
        {employeeButtons}
        {hotspots.map(spot => <button key={spot.id} type="button" className="iso-target" data-spot={spot.id}
          title={spot.label} aria-label={spot.label} disabled={link.locked || resting}
          style={{ left: spot.point.x / art.width * 100 + '%', top: spot.point.y / art.height * 100 + '%' }}
          onClick={() => go(spot.id === 'computer' ? entryPoint(founderSeat) : spot.id === 'coffee' ? coffeePoint : restPoint, spot.id)} />)}
        {link.pointAtDesk && <div className="lm-arrow show" aria-hidden="true" style={{
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
    <div className="lm-hud-row">
      <div className="lm-card"><div><div className="lm-date">{t('top.date', link.date)}</div><div className="lm-sub">{weekdays[link.weekday]} · {link.team.office.title}</div></div></div>
      <div className="lm-card"><div><div className="lm-cash">{money(link.cash)}</div><div className="lm-sub">{link.daysToBankruptcy !== null ? t('top.crisis', { days: link.daysToBankruptcy }) : link.status}</div></div></div>
    </div>
    {computer === 'closed' && <div className="lm-hud-row lm-hud-right">{link.controls}</div>}
    <p className="iso-hint">{t('coworking.hint')}</p>
    {!ready && <p className="iso-loading">{t('coworking.loading')}</p>}
    {resting && <div className="iso-rest">{t('coworking.resting')}</div>}
    {computer !== 'closed' && <Laptop fullscreen minutes={minutes} weekday={weekdays[link.weekday] ?? ''} origin={origin}
      closing={computer === 'closing'} onClosed={() => { openRef.current = false; setComputer('closed'); }}
      company={link.companyApp} onTyped={link.onTyped} onDockApp={link.onDockApp}
      focusText={link.focusText} controls={link.controls} />}
  </div>;
}
