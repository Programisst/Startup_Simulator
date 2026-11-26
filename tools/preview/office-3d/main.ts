import * as T from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import copy from '../../../src/content/ru/office-3d.json';
import computerCopy from '../../../src/content/ru/coworking-preview.json';
import { drawEditorScreen } from '../../../src/ui/apartment/engine/editorScreen';
import { MonitorTyping } from '../../../src/ui/apartment/engine/monitor';
import { mountComputer } from '../coworking/computer';
import { makeWorker } from '../coworking/raster';
import { desks, officeTeam, routes, homeOf } from './layout';
import { buildInterior } from './interior';
import { box, chair, desk, human, monitor, mug, plant, type Human } from './models';
import '../coworking/style.css';
import './style.css';

const canvas = document.querySelector<HTMLCanvasElement>('#office')!;
const viewport = document.querySelector<HTMLElement>('#viewport')!;
const loading = document.querySelector<HTMLElement>('#loading')!;
const pauseButton = document.querySelector<HTMLButtonElement>('#pause')!;
const resetButton = document.querySelector<HTMLButtonElement>('#reset')!;
const walkButton = document.querySelector<HTMLButtonElement>('#walk')!;
const dialog = document.querySelector<HTMLDialogElement>('#screen')!;
const host = document.querySelector<HTMLElement>('#computer')!;
document.title = copy.title;
document.querySelector('h1')!.textContent = copy.title;
document.querySelector('#subtitle')!.textContent = copy.subtitle;
document.querySelector('#hint')!.textContent = copy.hint;
loading.textContent = copy.loading;
resetButton.textContent = copy.reset;
walkButton.textContent = copy.walk;

interface Actor {
  seat: number;
  model: Human;
  chair: T.Group;
  monitor: MonitorTyping;
  texture: T.CanvasTexture;
  ctx: CanvasRenderingContext2D;
  screen: T.Mesh;
}
const actors: Actor[] = [];
let time = 0;
let dirty = true;
let paused = matchMedia('(prefers-reduced-motion: reduce)').matches;
let unmount: (() => void) | undefined;
let renderer: T.WebGLRenderer | undefined;

function updatePause() {
  pauseButton.textContent = paused ? copy.play : copy.pause;
  pauseButton.setAttribute('aria-pressed', String(paused));
}
updatePause();
dialog.addEventListener('close', () => { if (!dialog.open) { unmount?.(); unmount = undefined; } });

function start() {
  renderer = new T.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.needsUpdate = true;
  renderer.shadowMap.type = T.PCFSoftShadowMap;
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  const scene = new T.Scene();
  scene.background = new T.Color(0xd5dbd8);
  const camera = new T.OrthographicCamera(-12, 12, 9, -9, .1, 160);
  camera.position.set(23, 22, 27);
  const controls = new OrbitControls(camera, canvas);
  controls.target.set(8, .5, 6);
  controls.enableDamping = true;
  controls.dampingFactor = .08;
  controls.enablePan = true;
  controls.minPolarAngle = .25;
  controls.maxPolarAngle = 1.25;
  controls.minZoom = .65;
  controls.maxZoom = 3;
  const initialPosition = camera.position.clone();
  const initialTarget = controls.target.clone();
  controls.update();
  resetButton.addEventListener('click', () => {
    camera.position.copy(initialPosition);
    controls.target.copy(initialTarget);
    camera.zoom = 1;
    camera.updateProjectionMatrix();
    controls.update();
  });
  scene.add(new T.HemisphereLight(0xecf4f6, 0x78796c, 2.1));
  const sun = new T.DirectionalLight(0xffe4bf, 3.4);
  sun.position.set(-3, 14, 1);
  sun.target.position.set(8, 0, 6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -17, right: 17, top: 17, bottom: -17, near: .5, far: 55 });
  sun.shadow.normalBias = .025;
  sun.shadow.bias = -.0002;
  sun.shadow.radius = 3;
  scene.add(sun, sun.target);
  const fill = new T.DirectionalLight(0xc1d6e2, 1.3);
  fill.position.set(20, 10, 15);
  scene.add(fill);
  // A pale plinth and broad ground receive the building's soft cast shadow.
  const ground = new T.Mesh(new T.PlaneGeometry(200, 200), new T.MeshStandardMaterial({ color: 0xd1d7d4, roughness: 1 }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -.36;
  ground.receiveShadow = true;
  scene.add(ground);
  buildInterior(scene);
  const bySeat = new Map(officeTeam.people.map(p => [p.seat, p]));
  const screens: T.Mesh[] = [];
  desks.forEach(({ x, z }, seat) => {
    desk(scene, x, z);
    const person = bySeat.get(seat);
    const seatChair = chair(scene, x, z + .8);
    let texture: T.CanvasTexture | null = null;
    if (person) {
      const c = document.createElement('canvas');
      c.width = 1050;
      c.height = 650;
      texture = new T.CanvasTexture(c);
      texture.colorSpace = T.SRGBColorSpace;
      texture.anisotropy = Math.min(8, renderer!.capabilities.getMaxAnisotropy());
      const typing = new MonitorTyping();
      typing.advance(seat * 2.7);
      const model = human(scene, person.nameSeed);
      const surface = monitor(scene, x, z, texture);
      surface.userData.seat = seat;
      screens.push(surface);
      actors.push({ seat, model, chair: seatChair, texture, ctx: c.getContext('2d')!, monitor: typing, screen: surface });
    } else {
      const surface = monitor(scene, x, z, null);
      surface.userData.seat = seat;
      screens.push(surface);
    }
    if (seat % 3 === 0) mug(scene, x - .52, .8, z + .1, 0xe9d8b9);
    if (seat % 4 === 2) plant(scene, x + .53, z - .18, .25, .8);
    if (seat % 4 === 1) {
      box(scene, [.20, .025, .27], [x + .49, .807, z + .10], 0x63716e, .006);
      box(scene, [.02, .008, .18], [x + .5, .825, z + .1], 0xc9b585);
    }
  });
  // Low dividers organise desk clusters without hiding seats from the camera.
  for (const x of [4.8, 7.8]) {
    box(scene, [.055, 1.0, 1.3], [x, .52, 2], 0x9baca4, .02);
    box(scene, [.055, 1.0, 1.3], [x, .52, 5], 0x9baca4, .02);
  }
  const raycaster = new T.Raycaster();
  let pointerStart = { x: 0, y: 0 };
  canvas.addEventListener('pointerdown', e => { pointerStart = { x: e.clientX, y: e.clientY }; });
  canvas.addEventListener('pointerup', e => {
    if (Math.hypot(e.clientX - pointerStart.x, e.clientY - pointerStart.y) > 5) return;
    const r = canvas.getBoundingClientRect();
    raycaster.setFromCamera(new T.Vector2((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1), camera);
    const hit = raycaster.intersectObjects(screens)[0];
    if (!hit) return;
    const actor = actors.find(a => a.seat === hit.object.userData.seat);
    if (!actor) return;
    const person = bySeat.get(actor.seat)!;
    const worker = makeWorker(person, 0);
    worker.monitor = actor.monitor;
    dialog.showModal();
    unmount?.();
    unmount = mountComputer(host, worker, computerCopy, 'ru', () => dialog.close());
  });
  const resize = () => {
    const w = viewport.clientWidth, h = viewport.clientHeight;
    renderer!.setSize(w, h, false);
    dirty = true;
    const vertical = 10;
    camera.left = -vertical * w / h;
    camera.right = vertical * w / h;
    camera.top = vertical;
    camera.bottom = -vertical;
    camera.updateProjectionMatrix();
  };
  new ResizeObserver(resize).observe(viewport);
  resize();
  pauseButton.addEventListener('click', () => { paused = !paused; updatePause(); });
  walkButton.addEventListener('click', () => { time = 1.8; paused = false; updatePause(); });
  viewport.dataset.office = 'ready';
  loading.hidden = true;
  let last = performance.now(), nextFrame = 0, textureTime = -1, shadowTime = -1;
  const render = (now: number) => {
    requestAnimationFrame(render);
    if (now < nextFrame) return;
    nextFrame = now + 1000 / 30;
    const dt = paused || dialog.open ? 0 : Math.max(0, Math.min(.08, (now - last) / 1000));
    last = now;
    time += dt;
    const cameraChanged = controls.update();
    if (dt === 0 && !cameraChanged && !dirty) return;
    dirty = false;
    const cycle = time % 120;
    const moving: number[] = [];
    for (let i = 0; i < actors.length; i++) {
      const actor = actors[i]!;
      const progress = (cycle - 2 - i * 13);
      const seated = animateActor(actor, progress, time);
      if (!seated) moving.push(actor.seat);
      if (seated && bySeat.get(actor.seat)!.busy) actor.monitor.advance(dt);
      if (time - textureTime > .12 || textureTime < 0) {
        drawEditorScreen(actor.ctx, { x: 0, y: 0, w: 1050, h: 650 }, actor.monitor, time, 1);
        actor.texture.needsUpdate = true;
      }
    }
    if (time - textureTime > .12 || textureTime < 0) textureTime = time;
    viewport.dataset.walking = moving.join(',');
    if (time - shadowTime > .16 || shadowTime < 0) {
      renderer!.shadowMap.needsUpdate = true;
      shadowTime = time;
    }
    renderer!.render(scene, camera);
    // Development inspection uses actual projected screen centers for browser checks.
    if (import.meta.env.DEV) {
      (window as unknown as { __office?: unknown }).__office = {
        seats: desks.length, occupied: officeTeam.people.map(p => p.seat), time,
        screens: actors.map(a => {
          const point = a.screen.getWorldPosition(new T.Vector3()).project(camera);
          return { seat: a.seat, x: (point.x + 1) * canvas.clientWidth / 2, y: (1 - point.y) * canvas.clientHeight / 2 + canvas.getBoundingClientRect().top };
        }),
      };
    }
  };
  requestAnimationFrame(render);
  window.addEventListener('pagehide', () => {
    controls.dispose();
    scene.traverse(object => {
      const mesh = object as T.Mesh;
      mesh.geometry?.dispose();
    });
    actors.forEach(a => a.texture.dispose());
    renderer?.dispose();
  }, { once: true });
}

function animateActor(actor: Actor, elapsed: number, time: number): boolean {
  const { model } = actor;
  const home = homeOf(actor.seat);
  const route = routes.get(actor.seat)!;
  const lengths = route.slice(1).map((p, i) => Math.hypot(p.x - route[i]!.x, p.z - route[i]!.z));
  const travel = lengths.reduce((sum, length) => sum + length, 0) / 1.25;
  const standTime = 1.75;
  const out = standTime + travel;
  const total = out * 2 + 2;
  let t = elapsed;
  const returning = elapsed > out + 2;
  if (returning) t = total - elapsed;
  const sitting = elapsed < 0 || elapsed >= total || t < .35;
  const lift = Math.max(0, Math.min(1, (t - .35) / .40));
  let x = home.x, z = home.z, angle = 0, walking = false;
  actor.chair.position.z = home.z + (sitting ? Math.max(0, t) / .35 * .22 : .22);
  if (elapsed < 0 || elapsed >= total) actor.chair.position.z = home.z;
  if (!sitting) {
    if (t < .75) z = home.z - .2 * lift;
    else if (t < 1.15) {
      x = home.x - .62 * (t - .75) / .4;
      z = home.z - .2;
      angle = Math.PI / 2;
    } else if (t < standTime) {
      x = route[0]!.x;
      z = T.MathUtils.lerp(home.z - .2, route[0]!.z, (t - 1.15) / (standTime - 1.15));
      angle = Math.PI;
    } else {
      let distance = Math.min(travel, t - standTime) * 1.25;
      for (let i = 0; i < lengths.length; i++) {
        const length = lengths[i]!;
        const a = route[i]!, b = route[i + 1]!;
        if (distance <= length || i === lengths.length - 1) {
          const k = Math.min(1, distance / length);
          x = T.MathUtils.lerp(a.x, b.x, k);
          z = T.MathUtils.lerp(a.z, b.z, k);
          angle = Math.atan2(-(b.x - a.x), -(b.z - a.z)) + (returning ? Math.PI : 0);
          break;
        }
        distance -= length;
      }
    }
    walking = t > .75 && elapsed < total && !(elapsed >= out && elapsed <= out + 2);
  }
  model.root.position.set(x, 0, z);
  model.root.rotation.y = angle;
  model.body.position.y = .58 + (sitting ? 0 : .19 * lift);
  const swing = walking ? Math.sin(time * 10) * .32 : 0;
  model.knees.forEach(knee => { knee.rotation.x = sitting ? -1.48 : -.1; });
  model.leftLeg.rotation.x = sitting ? 1.48 : swing;
  model.rightLeg.rotation.x = sitting ? 1.48 : -swing;
  model.leftArm.rotation.x = sitting ? 1.05 + Math.sin(time * 8) * .035 : -swing * .6;
  model.rightArm.rotation.x = sitting ? 1.05 - Math.sin(time * 8) * .035 : swing * .6;
  return sitting;
}

try { start(); }
catch (error) { loading.textContent = copy.error; viewport.dataset.office = 'error'; console.error(error); }
