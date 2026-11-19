// 3D-квартира целиком: свет, тени, камера, герой, время суток, пар от кофе.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { moveWithCollision } from '../room/engine/physics';
import type { Facing, OutfitId } from './hero/hero';
import { HERO_PIXEL_M, HeroSprite } from './hero/HeroSprite';
import { CAMERA, COLLIDERS, findInteraction, LAMP_IDS, WALL_SQUASH, type LampId, interactionAt, SEAT, STAND_SPOT, START_SPOT, WAKE_SPOT, WALK, type Interaction3D } from './layout';
import { findPath, type FloorPoint } from './nav';
import { lightingAt } from './lighting';
import { buildBed, buildBoxes, buildChair, buildKitchen, buildLounge, buildPlant, buildShell, buildWorkstation, LAMP_GLOW, paintSky } from './models';
import { PixelEdgePass, toonify, type Toonified } from './pixelArt';
import { MonitorScreen } from './screen';

export type Mode = 'walk' | 'sitting' | 'sleeping' | 'brewing';

/** Камера смотрит на комнату спереди и сверху, чуть справа; без перспективы, как в пиксельных играх. */
const CAM = { ...CAMERA, dist: 20 };
/** Пределы поворота: дальше видно, что у комнаты нет передней и правой стен. */
const YAW_RANGE = [0.08, 1.25] as const;
/** Куда смотрит камера и сколько метров должно помещаться в кадр по высоте. */
const VIEW = { target: new THREE.Vector3(2.95, 1.0, 2.45) };

/**
 * Камера (для выбора варианта): follow — близко и едет за героем; fill — стоит на месте,
 * комната крупно на весь экран. Число — сколько метров помещается в кадр по высоте.
 */
export type CamMode = 'follow' | 'fill';
const VIEW_HEIGHT: Record<CamMode, number> = { follow: 3.6, fill: 4.5 };
/** Куда смотрит камера, когда герой у окна. */
const WINDOW_FOCUS = { target: new THREE.Vector3(2.6, 1.55, 0.15), height: 1.9 };

const FOOT = 0.34;
const SPEED = 1.75;

interface Puff {
  sprite: THREE.Sprite;
  life: number;
  max: number;
  vel: THREE.Vector3;
}

/** Свечение вокруг лампы в духе пиксель-арта: несколько чётких колец, к краю прозрачнее. */
function steppedGlow(): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = c.height = 48;
  const g = c.getContext('2d')!;
  const rings = [
    [24, 0.05],
    [17, 0.08],
    [11, 0.13],
    [6, 0.2],
  ] as const;
  for (const [r, a] of rings) {
    for (let y = 0; y < 48; y++)
      for (let x = 0; x < 48; x++) {
        if ((x - 23.5) ** 2 + (y - 23.5) ** 2 > r * r) continue;
        g.fillStyle = `rgba(255,214,150,${a})`;
        g.fillRect(x, y, 1, 1);
      }
  }
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  return t;
}

function softDot(): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,0.9)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

export class World {
  readonly renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 60);
  private hero: HeroSprite;
  private composer: EffectComposer;
  private toon: Toonified;
  /** Сколько экранных точек в одном пикселе комнаты. */
  private pixelSize = 1;
  /** Поворот камеры: можно крутить мышкой в пределах, где видны обе стены. */
  private yaw = CAMERA.yaw;
  private camMode: CamMode;
  private viewH: number;
  private zoom = 1;
  private camTarget = VIEW.target.clone();
  private focus: { target: THREE.Vector3; height: number } | null = null;
  /** Включена ли лампа (null — ещё не решили: решим по времени суток в первом кадре). */
  private lampOn: Record<LampId, boolean> | null = null;
  private lampLevel: Record<LampId, number> = { lampDesk: 0, lampBed: 0, lampFloor: 0 };
  private yawGoal = CAMERA.yaw;
  private screenX = new THREE.Vector3();
  private screenY = new THREE.Vector3();
  private screen = new MonitorScreen(0.61 * WALL_SQUASH.x, 0.381 * WALL_SQUASH.y);
  private hemi = new THREE.HemisphereLight('#e6eeff', '#9c7b5a', 1);
  private sun = new THREE.DirectionalLight('#fff1d8', 3);
  private lamps: THREE.PointLight[] = [];
  private screenLight = new THREE.PointLight('#9cc3ff', 0, 2.2, 2);
  private halos: { sprite: THREE.Sprite; size: number }[] = [];
  private leaves: THREE.Object3D[] = [];
  private dust!: THREE.Points;
  private dustSeeds: number[] = [];
  private shell = buildShell();
  private sleeper: THREE.Group;
  private mugTop: THREE.Vector3;
  private machineSpout: THREE.Vector3;
  private puffs: Puff[] = [];
  private dot = softDot();
  private spawn = { mug: 0, machine: 0 };
  private brewLeft = 0;
  private skyKey = '';
  private velocity = new THREE.Vector2();
  private facing: Facing = 'down';
  private monitorPoint: THREE.Vector3;

  private path: FloorPoint[] | null = null;
  private pathAction: Interaction3D | null = null;
  private raycaster = new THREE.Raycaster();

  pos = { x: START_SPOT.x, z: START_SPOT.z };
  /** Герой дошёл по клику до предмета — пора действовать. */
  onArrive: ((target: Interaction3D) => void) | null = null;
  mode: Mode = 'walk';
  minutes = 7 * 60 + 40;
  day = 1;
  /** Во сколько раз часы квартиры идут быстрее обычного (обычно: секунда — минута). */
  clockRate = 1;
  /** Часы стоят: игра на паузе. */
  clockPaused = false;
  /** Номер дня ведёт игра, а не сама квартира. */
  externalDay = false;
  t = 0;
  onCoffeeReady: (() => void) | null = null;

  constructor(
    private container: HTMLElement,
    outfit: OutfitId = 'knit',
    camMode: CamMode = 'follow',
  ) {
    this.camMode = camMode;
    this.viewH = VIEW_HEIGHT[camMode];
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(this.renderer.domElement);

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    this.scene.add(this.shell.group, this.hemi);

    // Солнце светит снаружи через окно.
    this.sun.position.set(1.2, 5.5, -5.5);
    this.sun.target.position.set(3.2, 0, 2.2);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.camera.left = -5;
    this.sun.shadow.camera.right = 5;
    this.sun.shadow.camera.top = 5;
    this.sun.shadow.camera.bottom = -5;
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.02;
    this.scene.add(this.sun, this.sun.target);

    this.hero = new HeroSprite(outfit, CAM.pitch, this.dot);
    const work = buildWorkstation(this.screen.texture);
    const bed = buildBed();
    const lounge = buildLounge();
    const kitchen = buildKitchen();
    this.sleeper = bed.sleeper;
    this.mugTop = work.mugTop;
    this.machineSpout = kitchen.machineSpout;
    this.monitorPoint = new THREE.Vector3(4.62, 1.1, 0.26);
    const plant = buildPlant();
    this.leaves = (plant.userData.leaves as THREE.Object3D[]) ?? [];
    this.scene.add(work.group, buildChair(), bed.group, lounge.group, kitchen.group, plant, buildBoxes(), this.hero.root);

    // Тёплые лампы: настольная, у кровати, торшер.
    const warm = '#ffc98a';
    const glow = steppedGlow();
    for (const [p, power, dist] of [
      [work.deskLampBulb, 1.1, 2.6],
      [new THREE.Vector3(1.84, 0.68, 0.2), 0.7, 2.6],
      [lounge.floorLampBulb, 1.6, 4.2],
    ] as const) {
      const l = new THREE.PointLight(warm, 0, dist, 2);
      l.position.copy(p);
      l.userData.power = power;
      this.lamps.push(l);
      this.scene.add(l);
      // Тёплое свечение вокруг лампочки.
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
      halo.position.copy(p);
      const size = 0.35 + power * 0.35;
      halo.scale.setScalar(size);
      this.halos.push({ sprite: halo, size });
      this.scene.add(halo);
    }
    this.dust = this.buildDust();
    this.scene.add(this.dust);
    // Подсветка под полкой.
    const led = new THREE.PointLight('#ffd9a0', 0, 2.2, 2);
    led.position.set(4.62, 1.45, 0.3);
    led.userData.power = 0.9;
    this.lamps.push(led);
    this.scene.add(led);
    this.screenLight.position.set(4.62, 1.1, 0.55);
    this.scene.add(this.screenLight);

    this.hero.root.userData.keepMaterial = true;
    this.hero.root.userData.noEdges = true;
    this.toon = toonify(this.scene);
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new PixelEdgePass(this.scene, this.camera));
    this.composer.addPass(new OutputPass());

    this.placeCamera();
    this.resize();
    this.applyTime(true);
  }

  dispose(): void {
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  resize(): void {
    const dpr = Math.min(window.devicePixelRatio, 2);
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    this.applyView();
  }

  /**
   * Вся сцена рисуется в маленьком разрешении и увеличивается без сглаживания.
   * Пиксель комнаты по размеру равен пикселю героя; приближение просто делает пиксели крупнее.
   */
  private applyView(): void {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    if (!w || !h) return;
    const dpr = this.renderer.getPixelRatio();
    // На узком экране помещаем в кадр больше, чтобы по ширине было что разглядеть.
    const fit = Math.max(this.viewH, ((this.viewH * 1.75) / w) * h);
    this.pixelSize = Math.max(1.5, (h * dpr * HERO_PIXEL_M) / fit);
    const lowW = Math.floor((w * dpr) / this.pixelSize);
    const lowH = Math.floor((h * dpr) / this.pixelSize);
    const viewH = lowH * HERO_PIXEL_M;
    const viewW = lowW * HERO_PIXEL_M;
    this.camera.left = -viewW / 2;
    this.camera.right = viewW / 2;
    this.camera.top = viewH / 2;
    this.camera.bottom = -viewH / 2;
    this.camera.updateProjectionMatrix();
    this.composer.setPixelRatio(dpr / this.pixelSize);
    this.composer.setSize(w, h);
    for (const t of [this.composer.renderTarget1, this.composer.renderTarget2]) {
      t.texture.minFilter = THREE.NearestFilter;
      t.texture.magFilter = THREE.NearestFilter;
    }
  }

  /** Колесо мыши: ближе или дальше. */
  zoomBy(deltaY: number): void {
    this.zoom = Math.min(1.7, Math.max(0.7, this.zoom * Math.exp(deltaY * 0.0012)));
  }

  /** Камера подлетает к окну (true) или возвращается к герою (false). */
  focusWindow(on: boolean): void {
    this.focus = on ? { target: WINDOW_FOCUS.target, height: WINDOW_FOCUS.height } : null;
    if (on) this.facing = 'up';
  }

  // ——— Лампы ———

  isLampOn(id: LampId): boolean {
    return this.lampOn?.[id] ?? false;
  }

  toggleLamp(id: LampId): boolean {
    if (!this.lampOn) return false;
    this.lampOn[id] = !this.lampOn[id];
    return this.lampOn[id];
  }

  /**
   * Ставит камеру. Точку, куда она смотрит, двигаем только целыми пикселями —
   * иначе при движении камеры пиксели «рябят».
   */
  private placeCamera(): void {
    const sp = Math.sin(CAM.pitch);
    const cp = Math.cos(CAM.pitch);
    const sy = Math.sin(this.yaw);
    const cy = Math.cos(this.yaw);
    this.screenX.set(cy, 0, -sy);
    this.screenY.set(-sp * sy, cp, -sp * cy);
    const t = this.camTarget.clone();
    const step = HERO_PIXEL_M;
    const x = t.dot(this.screenX);
    const y = t.dot(this.screenY);
    t.addScaledVector(this.screenX, Math.round(x / step) * step - x);
    t.addScaledVector(this.screenY, Math.round(y / step) * step - y);
    this.camera.position.set(t.x + CAM.dist * cp * sy, t.y + CAM.dist * sp, t.z + CAM.dist * cp * cy);
    this.camera.lookAt(t);
    this.camera.updateMatrixWorld();
  }

  /** Повернуть комнату: dx — сколько точек протащили мышью по горизонтали. */
  rotate(dx: number): void {
    this.yawGoal = Math.min(YAW_RANGE[1], Math.max(YAW_RANGE[0], this.yawGoal - dx * 0.0035));
  }

  /** Клавиши → направление в комнате: W всегда ведёт вверх по экрану, D — вправо. */
  screenToWorld(ix: number, iy: number): { x: number; y: number } {
    const fx = -Math.sin(this.yaw);
    const fz = -Math.cos(this.yaw);
    const rx = Math.cos(this.yaw);
    const rz = -Math.sin(this.yaw);
    return { x: rx * ix - fx * iy, y: rz * ix - fz * iy };
  }

  nearby(): Interaction3D | null {
    return this.mode === 'walk' ? findInteraction(this.pos) : null;
  }

  // ——— Действия героя ———

  sit(): void {
    this.cancelWalk();
    this.mode = 'sitting';
    this.pos = { ...SEAT };
    this.facing = 'up';
    this.velocity.set(0, 0);
  }

  stand(): void {
    this.mode = 'walk';
    this.pos = { ...STAND_SPOT };
    this.facing = 'down';
  }

  sleep(): void {
    this.cancelWalk();
    this.mode = 'sleeping';
    this.velocity.set(0, 0);
  }

  wakeUp(): void {
    const morning = 7 * 60 + 30;
    if (this.minutes > morning && !this.externalDay) this.day += 1;
    this.minutes = morning;
    this.mode = 'walk';
    // Утром свет выключен.
    if (this.lampOn) for (const id of LAMP_IDS) this.lampOn[id] = false;
    this.pos = { ...WAKE_SPOT };
    this.facing = 'down';
    this.applyTime(true);
  }

  brew(): void {
    this.cancelWalk();
    this.mode = 'brewing';
    this.brewLeft = 2.8;
    this.facing = 'left';
    this.velocity.set(0, 0);
  }

  // ——— Кадр ———

  update(dt: number, input: { x: number; y: number }): void {
    this.t += dt;
    if (!this.clockPaused) this.minutes += dt * this.clockRate;
    if (this.minutes >= 1440) {
      this.minutes -= 1440;
      if (!this.externalDay) this.day += 1;
    }

    let speed = 0;
    if (this.mode === 'walk') {
      // Клавиши важнее клика: нажал — маршрут по клику отменяется.
      if (input.x || input.y) this.cancelWalk();
      else if (this.path) input = this.steer();
      const len = Math.hypot(input.x, input.y);
      const k = (SPEED * Math.min(1, len)) / (len || 1);
      const want = new THREE.Vector2(input.x * k, input.y * k);
      this.velocity.lerp(want, 1 - Math.exp(-dt * 12));
      if (len === 0 && this.velocity.length() < 0.05) this.velocity.set(0, 0);
      speed = this.velocity.length();
      const half = FOOT / 2;
      const next = moveWithCollision(
        { x: this.pos.x - half, y: this.pos.z - half },
        this.velocity.x * dt,
        this.velocity.y * dt,
        { w: FOOT, h: FOOT },
        COLLIDERS,
        WALK,
      );
      this.pos = { x: next.x + half, z: next.y + half };
      if (speed > 0.15) this.facing = this.facingFor(this.velocity.x, this.velocity.y);
    }
    if (this.mode === 'brewing') {
      this.brewLeft -= dt;
      if (this.brewLeft <= 0) {
        this.mode = 'walk';
        this.onCoffeeReady?.();
      }
    }

    this.updateCamera(dt);

    // Герой: кадр по направлению и шагу. Ставим его точно по сетке пикселей экрана,
    // чтобы рисунок не искажался при движении.
    this.hero.root.position.set(this.pos.x, 0, this.pos.z);
    this.snapToPixels(this.hero.root.position);
    const heroMode = this.mode === 'sleeping' ? 'hidden' : this.mode === 'sitting' ? 'sit' : speed > 0.05 ? 'walk' : 'stand';
    this.hero.update(dt, { mode: heroMode, facing: this.facing, speed, typing: this.mode === 'sitting' }, this.camera);
    this.sleeper.visible = this.mode === 'sleeping';

    const clock = `${String(Math.floor(this.minutes / 60) % 24).padStart(2, '0')}:${String(Math.floor(this.minutes) % 60).padStart(2, '0')}`;
    this.screen.update(this.mode === 'sitting' ? 'work' : this.mode === 'sleeping' ? 'off' : 'lock', this.t, dt, clock);
    this.applyTime(false);
    this.updatePuffs(dt);
    this.updateLife(dt);
  }

  private applyTime(force: boolean): void {
    const L = lightingAt(this.minutes);
    this.hemi.intensity = 0.25 + L.ambient * 0.9;
    this.scene.environmentIntensity = 0.15 + L.ambient * 0.55;
    this.sun.intensity = L.sun * 3.4;
    this.sun.color.set(L.sun < 0.6 ? '#ffc79a' : '#fff1d8');
    (this.shell.beam.material as THREE.MeshBasicMaterial).opacity = 0.07 * L.sun;
    this.shell.ledMaterial.emissiveIntensity = L.lamps * 1.8;
    this.screenLight.intensity = this.mode === 'sleeping' ? 0 : (0.25 + L.lamps * 0.6) * (this.mode === 'sitting' ? 1.4 : 1);
    this.renderer.toneMappingExposure = 1.05 - (1 - L.ambient) * 0.12;
    this.hero.setFill(0.06 + L.ambient * 0.34);
    this.toon?.sync();

    // Небо в окне перерисовываем, только когда оно заметно поменялось.
    const key = `${L.skyTop}${L.skyBottom}${Math.round(L.lamps * 10)}`;
    if (force || key !== this.skyKey) {
      this.skyKey = key;
      paintSky(this.shell.skyCanvas, L.skyTop, L.skyBottom, L.lamps, L.stars);
      if (this.shell.skyMaterial.map) this.shell.skyMaterial.map.needsUpdate = true;
    }
  }

  /** Пылинки в солнечном луче от окна: по одному пикселю, медленно плывут. */
  private buildDust(): THREE.Points {
    const n = 60;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(n * 3);
    const rand = (i: number) => {
      const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
      return x - Math.floor(x);
    };
    for (let i = 0; i < n; i++) {
      this.dustSeeds.push(rand(i) * 100);
      pos.set([2.0 + rand(i + 1) * 1.3, 0.3 + rand(i + 2) * 1.9, 0.2 + rand(i + 3) * 1.4], i * 3);
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const points = new THREE.Points(geo, new THREE.PointsMaterial({ color: '#fff3d6', size: 1, sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false }));
    points.frustumCulled = false;
    return points;
  }

  private updateLife(dt: number): void {
    const L = lightingAt(this.minutes);
    // Лампы чуть «дышат» — свет живой, но не мигает.
    const breathe = 1 + Math.sin(this.t * 1.7) * 0.025 + Math.sin(this.t * 4.3) * 0.012;
    // Лампы: в первый кадр включены, если на улице темно; дальше — как решит игрок.
    if (!this.lampOn) {
      const dark = L.lamps > 0.3;
      this.lampOn = { lampDesk: dark, lampBed: dark, lampFloor: dark };
    }
    LAMP_IDS.forEach((id, i) => {
      // Включённая лампа днём светит слабее: вокруг и так светло.
      const want = this.lampOn![id] ? 0.35 + 0.65 * L.lamps : 0;
      this.lampLevel[id] += (want - this.lampLevel[id]) * (1 - Math.exp(-dt * 14));
      const level = this.lampLevel[id];
      const lamp = this.lamps[i]!;
      lamp.intensity = level * (lamp.userData.power as number) * 0.95 * breathe;
      const halo = this.halos[i]!;
      (halo.sprite.material as THREE.SpriteMaterial).opacity = level * 0.8 * breathe;
      halo.sprite.scale.setScalar(halo.size * (0.97 + 0.03 * breathe));
      LAMP_GLOW[id].emissiveIntensity = level * (id === 'lampDesk' ? 1.4 : 0.45);
    });
    this.toon.sync();
    // Листья покачиваются от воздуха.
    for (const leaf of this.leaves) {
      leaf.rotation.z = (leaf.userData.base as number) + Math.sin(this.t * 1.1 + (leaf.userData.phase as number)) * 0.035;
    }
    // Пылинки: днём видны в луче, медленно поднимаются и кружатся.
    const mat = this.dust.material as THREE.PointsMaterial;
    mat.opacity = L.sun * 0.55;
    mat.size = 1 / this.renderer.getPixelRatio(); // ровно один пиксель комнаты
    if (L.sun > 0.01) {
      const pos = this.dust.geometry.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < pos.count; i++) {
        const sd = this.dustSeeds[i]!;
        let y = pos.getY(i) + dt * 0.035;
        if (y > 2.25) y = 0.3;
        pos.setXYZ(i, pos.getX(i) + Math.sin(this.t * 0.4 + sd) * dt * 0.03, y, pos.getZ(i) + Math.cos(this.t * 0.3 + sd) * dt * 0.02);
      }
      pos.needsUpdate = true;
    }
  }

  private puff(at: THREE.Vector3, rise: number, life: number, size: number): void {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.dot, transparent: true, opacity: 0, depthWrite: false }));
    sprite.position.copy(at).add(new THREE.Vector3((Math.random() - 0.5) * 0.02, 0, (Math.random() - 0.5) * 0.02));
    sprite.scale.setScalar(size);
    this.scene.add(sprite);
    this.puffs.push({ sprite, life, max: life, vel: new THREE.Vector3((Math.random() - 0.5) * 0.03, rise, (Math.random() - 0.5) * 0.03) });
  }

  private updatePuffs(dt: number): void {
    this.spawn.mug -= dt;
    if (this.spawn.mug <= 0) {
      this.spawn.mug = 0.35;
      this.puff(this.mugTop, 0.07, 2.2, 0.035);
    }
    if (this.mode === 'brewing') {
      this.spawn.machine -= dt;
      if (this.spawn.machine <= 0) {
        this.spawn.machine = 0.07;
        this.puff(this.machineSpout, 0.22, 1.2, 0.06);
      }
    }
    for (const p of this.puffs) {
      p.life -= dt;
      p.sprite.position.addScaledVector(p.vel, dt);
      const k = p.life / p.max;
      (p.sprite.material as THREE.SpriteMaterial).opacity = Math.sin(k * Math.PI) * 0.35;
      p.sprite.scale.multiplyScalar(1 + dt * 0.5);
    }
    for (const p of this.puffs.filter((x) => x.life <= 0)) {
      this.scene.remove(p.sprite);
      p.sprite.material.dispose();
    }
    this.puffs = this.puffs.filter((x) => x.life > 0);
  }

  render(): void {
    this.composer.render();
  }

  // ——— Ходьба по клику ———

  /** Куда попал клик: предмет, с которым можно что-то сделать, или просто место на полу. */
  pick(clientX: number, clientY: number): { target: FloorPoint; action: Interaction3D | null } | null {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    const hits = this.raycaster.intersectObjects(this.scene.children, true);
    const hit = hits.find((h) => {
      const m = (h.object as THREE.Mesh).material as THREE.Material | undefined;
      return (h.object as THREE.Mesh).isMesh && h.object.visible && !(m && !Array.isArray(m) && m.transparent) && !this.isHero(h.object);
    });
    if (!hit) return null;
    const action = interactionAt(hit.point);
    return { target: action ? action.approach : { x: hit.point.x, z: hit.point.z }, action };
  }

  walkTo(target: FloorPoint, action: Interaction3D | null = null): boolean {
    if (this.mode !== 'walk') return false;
    const path = findPath(this.pos, target, COLLIDERS, WALK, FOOT);
    if (!path) return false;
    this.path = path;
    this.pathAction = action;
    return true;
  }

  cancelWalk(): void {
    this.path = null;
    this.pathAction = null;
  }

  private steer(): { x: number; y: number } {
    const next = this.path?.[0];
    if (!next) return { x: 0, y: 0 };
    const dx = next.x - this.pos.x;
    const dz = next.z - this.pos.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.05) {
      this.path!.shift();
      if (!this.path!.length) {
        const action = this.pathAction;
        this.cancelWalk();
        this.velocity.set(0, 0);
        if (action) this.onArrive?.(action);
        return { x: 0, y: 0 };
      }
      return this.steer();
    }
    // У последней точки притормаживаем, чтобы не проскочить.
    const slow = this.path!.length === 1 ? Math.min(1, d / 0.35) : 1;
    return { x: (dx / d) * Math.max(0.25, slow), y: (dz / d) * Math.max(0.25, slow) };
  }

  private isHero(o: THREE.Object3D): boolean {
    for (let p: THREE.Object3D | null = o; p; p = p.parent) if (p === this.hero.root) return true;
    return false;
  }

  private snapToPixels(p: THREE.Vector3): void {
    const step = HERO_PIXEL_M;
    const x = p.dot(this.screenX);
    const y = p.dot(this.screenY);
    p.addScaledVector(this.screenX, Math.round(x / step) * step - x);
    // По вертикали экрана двигаем по полу (вглубь комнаты), чтобы герой не отрывался от пола.
    const deep = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    p.addScaledVector(deep, (Math.round(y / step) * step - y) / deep.dot(this.screenY));
  }

  private updateCamera(dt: number): void {
    // Поворот мышью.
    if (Math.abs(this.yawGoal - this.yaw) > 0.0005) this.yaw += (this.yawGoal - this.yaw) * (1 - Math.exp(-dt * 10));
    // Куда смотреть: на окно, за героем или на середину комнаты.
    let goal = VIEW.target;
    let height = VIEW_HEIGHT[this.camMode] * this.zoom;
    if (this.focus) {
      goal = this.focus.target;
      height = this.focus.height;
    } else if (this.camMode === 'follow') {
      goal = new THREE.Vector3(Math.min(4.3, Math.max(1.7, this.pos.x)), 0.95, Math.min(3.2, Math.max(1.3, this.pos.z)));
    }
    const k = this.focus ? 3.2 : 4;
    this.camTarget.lerp(goal, 1 - Math.exp(-dt * k));
    if (Math.abs(height - this.viewH) > 0.002) {
      this.viewH += (height - this.viewH) * (1 - Math.exp(-dt * k));
      this.applyView();
    }
    this.placeCamera();
  }

  /** Направление движения → какой стороной повернуть героя к зрителю. */
  private facingFor(vx: number, vz: number): Facing {
    const sx = vx * Math.cos(this.yaw) - vz * Math.sin(this.yaw);
    const sy = -(vx * Math.sin(this.yaw) + vz * Math.cos(this.yaw));
    if (Math.abs(sx) > Math.abs(sy) * 0.85) return sx > 0 ? 'right' : 'left';
    return sy > 0 ? 'up' : 'down';
  }

  /** Точка мира → пиксели внутри контейнера. */
  project(p: { x: number; y: number; z: number }): { x: number; y: number } {
    const v = new THREE.Vector3(p.x, p.y, p.z).project(this.camera);
    return { x: ((v.x + 1) / 2) * this.container.clientWidth, y: ((1 - v.y) / 2) * this.container.clientHeight };
  }

  headPoint(): { x: number; y: number; z: number } {
    if (this.mode === 'sleeping') return { x: 1.0, y: 0.75, z: 0.42 };
    return { x: this.pos.x, y: this.hero.headHeight() * (this.mode === 'sitting' ? 0.85 : 1) + 0.12, z: this.pos.z };
  }

  monitorOnScreen(): { x: number; y: number } {
    return this.project(this.monitorPoint);
  }
}
