import ru from '../../../src/content/ru/coworking-preview.json';
import en from '../../../src/content/en/coworking-preview.json';
import { mountComputer } from './computer';
import { coworkingTeam } from '../coworking-scene';
import { layout, motionFor, poseAt } from './motion';
import { loadRoom, makeWorker, monitorCenter } from './raster';
import './style.css';

const language = new URLSearchParams(location.search).get('lang') === 'en' ? 'en' : 'ru';
const copy = language === 'en' ? en : ru;
document.documentElement.lang = language;
document.title = copy.title;
document.querySelector('h1')!.textContent = copy.title;

const scene = document.querySelector<HTMLElement>('#scene')!;
const room = document.querySelector<HTMLCanvasElement>('#room')!;
const screenDetails = document.querySelector<HTMLCanvasElement>('#screen-details')!;
const walk = document.querySelector<HTMLButtonElement>('#walk')!;
const pause = document.querySelector<HTMLButtonElement>('#pause')!;
const loading = document.querySelector<HTMLElement>('#loading')!;
const hint = document.querySelector<HTMLElement>('#hint')!;
const monitors = document.querySelector<HTMLElement>('#monitors')!;
const screen = document.querySelector<HTMLDialogElement>('#screen')!;
const computer = document.querySelector<HTMLElement>('#computer')!;
let unmountComputer: (() => void) | undefined;

room.width = layout.width;
room.height = layout.height;
scene.style.aspectRatio = `${layout.width} / ${layout.height}`;
walk.textContent = copy.walk;
loading.textContent = copy.loading;
hint.textContent = copy.hint;

let paused = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
let elapsed = 0;
let time = 0;
const workers = coworkingTeam.people.map((p, i) => ({ plan: motionFor(p.seat), worker: makeWorker(p, i) }));
const cycle = Math.max(...workers.map(({ plan }) => plan.end)) + 5;

function updatePause() {
  pause.textContent = paused ? copy.play : copy.pause;
  pause.setAttribute('aria-pressed', String(paused));
}
updatePause();

pause.addEventListener('click', () => { paused = !paused; updatePause(); });
walk.addEventListener('click', () => {
  time = workers[0]!.plan.start - .15;
  paused = false;
  updatePause();
});
screen.addEventListener('close', () => {
  if (screen.open) return;
  unmountComputer?.();
  unmountComputer = undefined;
});

for (const { worker } of workers) {
  if (!worker.person.busy) continue;
  const seat = worker.person.seat;
  const point = monitorCenter(seat);
  const button = document.createElement('button');
  button.className = 'monitor';
  button.type = 'button';
  button.dataset.seat = String(seat);
  button.setAttribute('aria-label', copy.monitor.replace('{{seat}}', String(seat + 1)));
  button.style.left = `${100 * point.x / layout.width}%`;
  button.style.top = `${100 * point.y / layout.height}%`;
  button.addEventListener('click', () => {
    screen.showModal();
    unmountComputer?.();
    unmountComputer = mountComputer(computer, worker, copy, language, () => screen.close());
  });
  monitors.append(button);
}

async function start() {
  const raster = await loadRoom(room, screenDetails);
  loading.hidden = true;
  scene.dataset.coworking = 'ready';
  walk.disabled = false;
  pause.disabled = false;
  let nextPaint = 0;
  let previous = performance.now();
  function animate(now: number) {
    requestAnimationFrame(animate);
    if (now < nextPaint) return;
    nextPaint = now + 1000 / 28;
    const dt = paused || screen.open ? 0 : Math.min(.1, (now - previous) / 1000);
    previous = now;
    elapsed += dt;
    time = (time + dt) % cycle;
    const poses = new Map(workers.map(({ worker, plan }) => {
      const pose = poseAt(plan, time);
      if (pose.kind === 'sit' && worker.person.busy) worker.monitor.advance(dt);
      return [worker.person.seat, { worker, pose }] as const;
    }));
    scene.dataset.walking = [...poses.values()].filter(({ pose }) => pose.kind === 'walk').map(({ worker }) => worker.person.seat).join(',');
    raster.draw(poses, elapsed);
  }
  requestAnimationFrame(animate);
}
void start().catch(error => {
  scene.dataset.coworking = 'error';
  loading.textContent = copy.error;
  console.error(error);
});
