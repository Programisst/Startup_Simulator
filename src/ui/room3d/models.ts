// Мебель и вещи 3D-квартиры. Всё собрано из простых фигур кодом — своё, без скачанных моделей.
// Стиль: минимализм, светлый дуб, матовый чёрный, белый, лён.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { seeded } from '../room/engine/pixels';
import { mixColor } from '../room/engine/sky';
import { HERO_PIXEL_M } from './hero/HeroSprite';
import { PLACES, ROOM, WALL_SQUASH } from './layout';
import { linen, plaster, poster, rug, woodFloor } from './textures';

// ——— Материалы ———

function mat(color: string, roughness = 0.6, metalness = 0, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra });
}

export const MAT = {
  oak: mat('#c9a273', 0.55),
  oakDark: mat('#8a6440', 0.6),
  black: mat('#1e1f22', 0.45, 0.25),
  blackMatte: mat('#26272b', 0.8),
  white: mat('#f1efea', 0.5),
  whiteGloss: mat('#f6f5f2', 0.25),
  alu: mat('#c9ccd2', 0.32, 0.85),
  chrome: mat('#dfe2e6', 0.18, 1),
  sage: mat('#9db5a0', 0.42, 0.1),
  sageLight: mat('#b8cbb9', 0.4, 0.05),
  charcoal: mat('#45474c', 0.9),
  sheets: mat('#f4f1ea', 0.9),
  leather: mat('#9a5a36', 0.55),
  ceramic: mat('#ecebe7', 0.35),
  concrete: mat('#b9b5ae', 0.85),
  leaf: mat('#3f6b45', 0.6, 0, { side: THREE.DoubleSide }),
  leafLight: mat('#5a8f5c', 0.6, 0, { side: THREE.DoubleSide }),
  cardboard: mat('#c79a64', 0.85),
  tape: mat('#e9d6a6', 0.6),
  orange: mat('#e07a5f', 0.5),
  key: mat('#e6e6e8', 0.55),
  coffee: mat('#3b2418', 0.25),
  /** Абажуры: вечером начинают светиться изнутри. */
  shade: new THREE.MeshStandardMaterial({ color: '#f3ead9', roughness: 1, emissive: '#ffcf8a', emissiveIntensity: 0, side: THREE.DoubleSide }),
  glass: new THREE.MeshStandardMaterial({ color: '#cfe3ff', roughness: 0.05, metalness: 0, transparent: true, opacity: 0.12, depthWrite: false }),
};

/** У каждой лампы своё свечение, чтобы включать и выключать их по отдельности. */
export const LAMP_GLOW = {
  lampDesk: new THREE.MeshStandardMaterial({ color: '#f6eedd', roughness: 1, emissive: '#ffd79a', emissiveIntensity: 0 }),
  lampBed: MAT.shade.clone(),
  lampFloor: MAT.shade.clone(),
};

// ——— Помощники ———

function shadow<T extends THREE.Object3D>(o: T): T {
  o.traverse((c) => {
    if ((c as THREE.Mesh).isMesh) {
      c.castShadow = true;
      c.receiveShadow = true;
    }
  });
  return o;
}

/** Скруглённый брусок; координаты — центр. */
function rbox(w: number, h: number, d: number, r: number, m: THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh {
  const mesh = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 3, Math.min(r, w / 2, h / 2, d / 2)), m);
  mesh.position.set(x, y, z);
  return shadow(mesh);
}

function box(w: number, h: number, d: number, m: THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  mesh.position.set(x, y, z);
  return shadow(mesh);
}

function cyl(rt: number, rb: number, h: number, m: THREE.Material, x = 0, y = 0, z = 0, seg = 28): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m);
  mesh.position.set(x, y, z);
  return shadow(mesh);
}

/** Центр места на полу из планировки. */
function centerOf(p: { x: number; y: number; w: number; h: number }) {
  return { x: p.x + p.w / 2, z: p.y + p.h / 2 };
}

// ——— Стены, пол, окно ———

export interface Shell {
  group: THREE.Group;
  skyMaterial: THREE.MeshBasicMaterial;
  skyCanvas: HTMLCanvasElement;
  ledMaterial: THREE.MeshStandardMaterial;
  beam: THREE.Mesh;
}

export const WINDOW_HOLE = { x0: 1.95, x1: 3.25, y0: 0.85, y1: 2.35 };

export function buildShell(): Shell {
  const g = new THREE.Group();
  const T = 0.14;
  const wallMat = new THREE.MeshStandardMaterial({ color: '#efebe5', roughness: 0.92, map: plaster('#efebe5', 9) });

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(ROOM.w, ROOM.d), new THREE.MeshStandardMaterial({ map: woodFloor(), roughness: 0.48, metalness: 0 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(ROOM.w / 2, 0, ROOM.d / 2);
  floor.receiveShadow = true;
  g.add(floor);
  // Торцы пола — «срез» диорамы.
  g.add(box(ROOM.w + T, 0.12, 0.02, MAT.oakDark, ROOM.w / 2 - T / 2, -0.06, ROOM.d + 0.01));
  g.add(box(0.02, 0.12, ROOM.d + T, MAT.oakDark, ROOM.w + 0.01, -0.06, ROOM.d / 2 - T / 2));

  // Задняя стена с проёмом окна.
  const { x0, x1, y0, y1 } = WINDOW_HOLE;
  const back = [
    [-T, 0, x0, ROOM.h],
    [x1, 0, ROOM.w, ROOM.h],
    [x0, 0, x1, y0],
    [x0, y1, x1, ROOM.h],
  ];
  for (const [ax, ay, bx, by] of back) g.add(box(bx! - ax!, by! - ay!, T, wallMat, (ax! + bx!) / 2, (ay! + by!) / 2, -T / 2));
  // Левая стена.
  g.add(box(T, ROOM.h, ROOM.d + T, wallMat, -T / 2, ROOM.h / 2, ROOM.d / 2 - T / 2));
  // Срезы стен сверху — тёмная кромка.
  g.add(box(ROOM.w + T, 0.012, T, MAT.blackMatte, ROOM.w / 2 - T / 2, ROOM.h + 0.006, -T / 2));
  g.add(box(T, 0.012, ROOM.d + T, MAT.blackMatte, -T / 2, ROOM.h + 0.006, ROOM.d / 2 - T / 2));

  // Плинтусы.
  g.add(box(ROOM.w, 0.07, 0.015, MAT.white, ROOM.w / 2, 0.035, 0.008));
  g.add(box(0.015, 0.07, ROOM.d, MAT.white, 0.008, 0.035, ROOM.d / 2));

  // Акцентная стена за столом: тёмные рейки.
  const slatMat = mat('#2b2724', 0.7);
  const panelX0 = 3.42;
  g.add(box(ROOM.w - panelX0, ROOM.h, 0.012, mat('#1c1a19', 0.9), (panelX0 + ROOM.w) / 2, ROOM.h / 2, 0.006));
  for (let x = panelX0 + 0.025; x < ROOM.w - 0.01; x += 0.055) g.add(box(0.03, ROOM.h, 0.022, slatMat, x, ROOM.h / 2, 0.023));

  // Окно: тонкая чёрная рама, подоконник, стекло.
  const fw = 0.035;
  const wx = (x0 + x1) / 2;
  const wy = (y0 + y1) / 2;
  g.add(box(x1 - x0, fw, 0.05, MAT.black, wx, y0 + fw / 2, -0.05));
  g.add(box(x1 - x0, fw, 0.05, MAT.black, wx, y1 - fw / 2, -0.05));
  g.add(box(fw, y1 - y0, 0.05, MAT.black, x0 + fw / 2, wy, -0.05));
  g.add(box(fw, y1 - y0, 0.05, MAT.black, x1 - fw / 2, wy, -0.05));
  g.add(box(0.022, y1 - y0, 0.04, MAT.black, wx, wy, -0.05));
  g.add(rbox(x1 - x0 + 0.16, 0.035, 0.24, 0.01, MAT.oak, wx, y0 - 0.017, 0.03));
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, y1 - y0), MAT.glass);
  glass.position.set(wx, wy, -0.06);
  g.add(glass);

  // Небо и город за окном — картинка, которая меняется со временем суток.
  // Картинка рисуется ровно в пикселях комнаты: один её пиксель = один пиксель на экране.
  const skyCanvas = document.createElement('canvas');
  skyCanvas.width = Math.round(((x1 - x0 + 0.5) * WALL_SQUASH.x) / HERO_PIXEL_M);
  skyCanvas.height = Math.round((1.85 * WALL_SQUASH.y) / HERO_PIXEL_M);
  const skyTex = new THREE.CanvasTexture(skyCanvas);
  skyTex.colorSpace = THREE.SRGBColorSpace;
  skyTex.magFilter = THREE.NearestFilter;
  skyTex.minFilter = THREE.NearestFilter;
  skyTex.generateMipmaps = false;
  const skyMaterial = new THREE.MeshBasicMaterial({ map: skyTex, toneMapped: false });
  // Небо стоит сразу за стеной и чуть больше окна — сверху его не видно.
  const sky = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0 + 0.5, 1.85), skyMaterial);
  sky.position.set(wx, 0.62 + 1.85 / 2, -0.3);
  g.add(sky);

  // Лёгкая штора слева от окна.
  const curtainGeo = new THREE.PlaneGeometry(0.42, 2.45, 24, 1);
  const pos = curtainGeo.attributes.position!;
  for (let i = 0; i < pos.count; i++) pos.setZ(i, Math.sin(pos.getX(i) * 46) * 0.025);
  curtainGeo.computeVertexNormals();
  const curtain = new THREE.Mesh(
    curtainGeo,
    new THREE.MeshStandardMaterial({ color: '#f3efe6', roughness: 1, transparent: true, opacity: 0.86, side: THREE.DoubleSide, map: linen('#f3efe6') }),
  );
  curtain.position.set(x0 - 0.12, 1.36, 0.07);
  curtain.castShadow = true;
  g.add(curtain);
  g.add(cyl(0.008, 0.008, 1.9, MAT.black, wx - 0.2, 2.6, 0.07).rotateZ(Math.PI / 2));

  // Солнечный луч из окна — мягкий световой «столб».
  const beamGeo = new THREE.BufferGeometry();
  const bx0 = x0 + 0.05;
  const bx1 = x1 - 0.05;
  const verts = new Float32Array([
    bx0, y1, 0, bx1, y1, 0, bx1 + 0.55, 0.01, 2.3, bx0 + 0.55, 0.01, 2.3,
    bx0, y0, 0, bx1, y0, 0, bx1 + 0.4, 0.01, 1.5, bx0 + 0.4, 0.01, 1.5,
  ]);
  beamGeo.setAttribute('position', new THREE.BufferAttribute(verts, 3));
  beamGeo.setIndex([0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7, 0, 3, 7, 0, 7, 4, 1, 2, 6, 1, 6, 5]);
  const beam = new THREE.Mesh(
    beamGeo,
    new THREE.MeshBasicMaterial({ color: '#ffe6bd', transparent: true, opacity: 0.06, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
  );
  g.add(beam);

  // Подсветка под полкой над столом.
  const ledMaterial = new THREE.MeshStandardMaterial({ color: '#2b2724', emissive: '#ffd9a0', emissiveIntensity: 0 });
  g.add(box(1.5, 0.008, 0.012, ledMaterial, 4.62, 1.565, 0.2));

  // Постер над кроватью.
  const frame = rbox(0.62, 0.82, 0.03, 0.006, MAT.black, 0.82, 1.62, 0.02);
  frame.rotation.y = 0;
  g.add(frame);
  const art = new THREE.Mesh(new THREE.PlaneGeometry(0.56, 0.76), new THREE.MeshStandardMaterial({ map: poster(), roughness: 0.8 }));
  art.position.set(0.82, 1.62, 0.037);
  g.add(art);

  // Ковёр.
  const rugMesh = new THREE.Mesh(new RoundedBoxGeometry(2.7, 0.012, 2.0, 2, 0.004), new THREE.MeshStandardMaterial({ map: rug(), roughness: 1 }));
  rugMesh.position.set(3.15, 0.006, 2.9);
  rugMesh.receiveShadow = true;
  g.add(rugMesh);

  return { group: g, skyMaterial, skyCanvas, ledMaterial, beam };
}

/** Рисует небо и город за окном под время суток. */
/** Порог для ровного «шахматного» перехода между полосами цвета. */
const BAYER = [0, 0.5, 0.75, 0.25];

/**
 * Небо и город за окном в пиксель-арте: небо полосами с аккуратным переходом,
 * звёзды и луна ночью, три плана домов; ночью в окнах горит свет.
 */
export function paintSky(c: HTMLCanvasElement, top: string, bottom: string, night: number, stars: boolean): void {
  const g = c.getContext('2d');
  if (!g) return;
  const W = c.width;
  const H = c.height;
  const px = (x: number, y: number, color: string) => {
    g.fillStyle = color;
    g.fillRect(Math.round(x), Math.round(y), 1, 1);
  };
  const rect = (x: number, y: number, w: number, h: number, color: string) => {
    g.fillStyle = color;
    g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  };

  // Небо: шесть оттенков, между ними — шахматный переход.
  const bands = 6;
  const shades = Array.from({ length: bands }, (_, i) => mixColor(top, bottom, i / (bands - 1)));
  for (let y = 0; y < H; y++) {
    const v = Math.min(0.999, y / (H * 0.85)) * (bands - 1);
    const base = Math.floor(v);
    for (let x = 0; x < W; x++) {
      const step = v - base > BAYER[(x % 2) + (y % 2) * 2]! ? 1 : 0;
      px(x, y, shades[Math.min(bands - 1, base + step)]!);
    }
  }

  const rand = seeded(3);
  if (stars) {
    for (let i = 0; i < 46; i++) {
      const x = Math.floor(rand() * W);
      const y = Math.floor(rand() * H * 0.5);
      const big = rand() < 0.12;
      px(x, y, big ? '#fffbe8' : rand() < 0.5 ? '#d9dcf0' : '#9fa6c8');
      if (big) {
        for (const [dx, dy] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ] as const)
          px(x + dx, y + dy, '#8c93b8');
      }
    }
    // Месяц.
    const mx = Math.round(W * 0.74);
    const my = Math.round(H * 0.2);
    for (let dy = -4; dy <= 4; dy++)
      for (let dx = -4; dx <= 4; dx++) {
        if (dx * dx + dy * dy > 17) continue;
        const shadow = (dx - 2) * (dx - 2) + (dy + 1) * (dy + 1) <= 12;
        if (!shadow) px(mx + dx, my + dy, dx + dy < -2 ? '#fffbe6' : '#efe6c4');
      }
  }

  // Дома: дальний план светлее (воздух), ближний темнее. Днём — стекло отражает небо, ночью горят окна.
  const layers = [
    { seed: 31, base: H, min: 0.34, max: 0.5, day: '#b9c1d3', nightC: '#2b3352', windows: false },
    { seed: 32, base: H, min: 0.24, max: 0.42, day: '#97a1b8', nightC: '#20273f', windows: true },
    { seed: 33, base: H, min: 0.12, max: 0.3, day: '#7a849c', nightC: '#161b2e', windows: true },
  ];
  for (const L of layers) {
    const r = seeded(L.seed);
    const facade = mixColor(L.day, L.nightC, night);
    const edge = mixColor(facade, '#ffffff', 0.18 * (1 - night));
    let x = -Math.floor(r() * 6);
    while (x < W) {
      const w = 7 + Math.floor(r() * 9);
      const h = Math.round(H * (L.min + r() * (L.max - L.min)));
      const y = L.base - h;
      rect(x, y, w, h, facade);
      rect(x, y, 1, h, edge); // освещённая грань
      // Крыша: надстройка или антенна.
      const roof = r();
      if (roof < 0.3) rect(x + 2, y - 2, Math.max(2, w - 5), 2, facade);
      else if (roof < 0.5) rect(x + Math.floor(w / 2), y - 4, 1, 4, facade);
      if (L.windows) {
        for (let wy = y + 2; wy < H - 1; wy += 3) {
          for (let wx = x + 2; wx < x + w - 1; wx += 2) {
            const k = r();
            if (night > 0.35) {
              if (k < 0.3) px(wx, wy, r() < 0.8 ? '#ffd38a' : '#a9d4ff');
            } else if (k < 0.55) px(wx, wy, mixColor(facade, bottom, 0.45));
          }
        }
      }
      x += w + (r() < 0.4 ? 0 : 1);
    }
  }
}

// ——— Рабочее место ———

export interface Workstation {
  group: THREE.Group;
  screen: THREE.Mesh;
  deskLampBulb: THREE.Vector3;
  mugTop: THREE.Vector3;
}

export function buildWorkstation(screenTexture: THREE.Texture): Workstation {
  const g = new THREE.Group();
  const d = PLACES.desk;
  const cx = d.x + d.w / 2;
  const cz = d.y + 0.39;
  const topY = 0.74;

  // Стол: дубовая столешница, чёрная рама.
  g.add(rbox(d.w, 0.035, 0.76, 0.012, MAT.oak, cx, topY - 0.017, cz));
  for (const sx of [-1, 1]) {
    g.add(box(0.06, topY - 0.05, 0.06, MAT.black, cx + sx * (d.w / 2 - 0.12), (topY - 0.035) / 2, cz));
    g.add(rbox(0.07, 0.035, 0.68, 0.01, MAT.black, cx + sx * (d.w / 2 - 0.12), 0.018, cz));
  }
  g.add(box(d.w - 0.3, 0.05, 0.05, MAT.black, cx, topY - 0.06, cz + 0.2));
  // Войлочный коврик.
  g.add(rbox(0.86, 0.004, 0.36, 0.002, mat('#4a4c52', 1), cx + 0.02, topY + 0.002, cz + 0.16));

  // Моноблок: тонкий корпус шалфейного цвета, белая рамка, алюминиевая ножка.
  const mono = new THREE.Group();
  const W = 0.64;
  const H = 0.43;
  mono.add(rbox(0.2, 0.008, 0.16, 0.004, MAT.alu, 0, 0.004, 0.02));
  const arm = rbox(0.12, 0.28, 0.012, 0.004, MAT.alu, 0, 0.15, -0.035);
  arm.rotation.x = -0.18;
  mono.add(arm);
  const body = new THREE.Group();
  body.position.set(0, 0.33, -0.015);
  body.rotation.x = -0.06;
  body.add(rbox(W, H, 0.016, 0.012, MAT.sage, 0, 0, -0.005));
  body.add(rbox(W - 0.002, H - 0.002, 0.004, 0.01, MAT.whiteGloss, 0, 0.0, 0.004));
  body.add(rbox(W, 0.07, 0.017, 0.01, MAT.sageLight, 0, -H / 2 + 0.035, -0.0045));
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(W - 0.03, (W - 0.03) * 0.625), new THREE.MeshBasicMaterial({ map: screenTexture, toneMapped: false }));
  screen.position.set(0, 0.03, 0.0065);
  body.add(screen);
  // Свой логотип сзади: кольцо.
  const logo = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.006, 12, 40), MAT.sageLight);
  logo.position.set(0, 0.05, -0.0135);
  body.add(logo);
  mono.add(body);
  mono.position.set(cx + 0.02, topY, cz - 0.14);
  g.add(mono);

  // Клавиатура: алюминиевая пластина и 72 клавиши.
  const kb = new THREE.Group();
  kb.add(rbox(0.4, 0.008, 0.12, 0.004, MAT.alu, 0, 0.004, 0));
  const keyGeo = new RoundedBoxGeometry(0.022, 0.006, 0.02, 2, 0.003);
  const keys = new THREE.InstancedMesh(keyGeo, MAT.key, 72);
  const m4 = new THREE.Matrix4();
  let k = 0;
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < (row === 4 ? 8 : 16) && k < 72; col++) {
      const wide = row === 4 && col === 3 ? 6 : 1;
      m4.makeScale(wide, 1, 1);
      m4.setPosition(-0.18 + col * 0.0235 + (row === 4 ? 0.04 + (col > 3 ? 0.11 : 0) : 0), 0.011, -0.045 + row * 0.0225);
      keys.setMatrixAt(k++, m4);
    }
  }
  keys.count = k;
  keys.castShadow = true;
  kb.add(keys);
  kb.position.set(cx - 0.06, topY, cz + 0.17);
  g.add(kb);
  // Трекпад.
  g.add(rbox(0.13, 0.006, 0.11, 0.008, MAT.alu, cx + 0.22, topY + 0.003, cz + 0.17));

  // Кружка с кофе.
  const mugPos = new THREE.Vector3(cx + 0.55, topY, cz + 0.1);
  g.add(cyl(0.04, 0.036, 0.095, MAT.ceramic, mugPos.x, topY + 0.048, mugPos.z));
  g.add(cyl(0.041, 0.041, 0.012, MAT.orange, mugPos.x, topY + 0.07, mugPos.z));
  g.add(cyl(0.035, 0.035, 0.004, MAT.coffee, mugPos.x, topY + 0.09, mugPos.z));
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.022, 0.006, 8, 20, Math.PI), MAT.ceramic);
  handle.position.set(mugPos.x + 0.04, topY + 0.05, mugPos.z);
  handle.rotation.z = -Math.PI / 2;
  g.add(shadow(handle));

  // Настольная лампа: чёрная, на шарнире.
  const lamp = new THREE.Group();
  lamp.add(cyl(0.07, 0.075, 0.018, MAT.black, 0, 0.009, 0));
  const a1 = cyl(0.008, 0.008, 0.42, MAT.black, 0.06, 0.21, 0);
  a1.rotation.z = -0.3;
  lamp.add(a1);
  const a2 = cyl(0.008, 0.008, 0.3, MAT.black, 0.22, 0.4, 0);
  a2.rotation.z = 1.15;
  lamp.add(a2);
  const head = cyl(0.03, 0.065, 0.11, MAT.black, 0.35, 0.33, 0);
  head.rotation.z = 0.5;
  lamp.add(head);
  // Лампочка под колпаком — светится, когда лампа включена.
  const bulb = cyl(0.045, 0.045, 0.01, LAMP_GLOW.lampDesk, 0.375, 0.285, 0);
  bulb.rotation.z = 0.5;
  lamp.add(bulb);
  lamp.position.set(d.x + 0.16, topY, cz - 0.12);
  g.add(lamp);
  const deskLampBulb = new THREE.Vector3(d.x + 0.16 + 0.37, topY + 0.28, cz - 0.12);

  // Суккулент в бетонном горшке, блокнот с ручкой.
  g.add(cyl(0.05, 0.042, 0.07, MAT.concrete, d.x + d.w - 0.16, topY + 0.035, cz - 0.2));
  for (let i = 0; i < 9; i++) {
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.018, 10, 8), MAT.leafLight);
    const ang = (i / 9) * Math.PI * 2;
    leaf.scale.set(0.7, 1.6, 0.7);
    leaf.position.set(d.x + d.w - 0.16 + Math.cos(ang) * 0.022, topY + 0.09, cz - 0.2 + Math.sin(ang) * 0.022);
    leaf.rotation.set(Math.sin(ang) * 0.6, 0, -Math.cos(ang) * 0.6);
    g.add(shadow(leaf));
  }
  const nb = rbox(0.15, 0.012, 0.21, 0.004, mat('#2f3e46', 0.8), cx + 0.62, topY + 0.006, cz + 0.22);
  nb.rotation.y = 0.25;
  g.add(nb);
  const pen = cyl(0.004, 0.004, 0.14, MAT.black, cx + 0.62, topY + 0.016, cz + 0.22);
  pen.rotation.set(Math.PI / 2, 0, 0.6);
  g.add(pen);

  // Полка над столом: книги, колонка, рамка с фото, кубок.
  const shelfY = 1.58;
  g.add(rbox(1.5, 0.03, 0.22, 0.006, MAT.oak, 4.62, shelfY, 0.13));
  const books: [string, number, number][] = [
    ['#e07a5f', 0.24, 0.035],
    ['#f1efea', 0.22, 0.03],
    ['#2f3e46', 0.26, 0.04],
    ['#9db5a0', 0.21, 0.03],
  ];
  let bx = 4.0;
  for (const [c, h, w] of books) {
    g.add(box(w, h, 0.16, mat(c, 0.7), bx, shelfY + 0.015 + h / 2, 0.13));
    bx += w + 0.004;
  }
  const leaning = box(0.032, 0.23, 0.16, mat('#d6c6a8', 0.7), bx + 0.04, shelfY + 0.125, 0.13);
  leaning.rotation.z = -0.2;
  g.add(leaning);
  g.add(rbox(0.1, 0.16, 0.1, 0.02, MAT.blackMatte, 4.62, shelfY + 0.095, 0.13));
  g.add(cyl(0.03, 0.03, 0.002, MAT.charcoal, 4.62, shelfY + 0.12, 0.181).rotateX(Math.PI / 2));
  const photo = rbox(0.14, 0.18, 0.015, 0.003, MAT.oak, 4.92, shelfY + 0.1, 0.1);
  photo.rotation.x = -0.12;
  g.add(photo);
  g.add(cyl(0.025, 0.035, 0.03, mat('#d9b44a', 0.3, 0.9), 5.18, shelfY + 0.03, 0.13));
  g.add(cyl(0.035, 0.012, 0.07, mat('#d9b44a', 0.3, 0.9), 5.18, shelfY + 0.08, 0.13));

  return { group: g, screen, deskLampBulb, mugTop: new THREE.Vector3(mugPos.x, topY + 0.1, mugPos.z) };
}

/** Эргономичное кресло, повёрнуто к столу. */
export function buildChair(): THREE.Group {
  const g = new THREE.Group();
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const leg = rbox(0.3, 0.025, 0.04, 0.01, MAT.black, Math.cos(a) * 0.15, 0.05, Math.sin(a) * 0.15);
    leg.rotation.y = -a;
    g.add(leg);
    g.add(new THREE.Mesh(new THREE.SphereGeometry(0.025, 12, 10), MAT.blackMatte).translateX(Math.cos(a) * 0.29).translateY(0.025).translateZ(Math.sin(a) * 0.29));
  }
  g.add(cyl(0.022, 0.022, 0.3, MAT.chrome, 0, 0.2, 0));
  g.add(rbox(0.5, 0.075, 0.48, 0.035, MAT.charcoal, 0, 0.44, 0));
  g.add(rbox(0.44, 0.012, 0.38, 0.01, MAT.blackMatte, 0, 0.4, 0));
  // Спинка из сетки: тёмная рамка и полупрозрачная сетка.
  const back = new THREE.Group();
  back.add(rbox(0.46, 0.6, 0.035, 0.05, MAT.black, 0, 0, 0));
  back.add(rbox(0.4, 0.54, 0.036, 0.04, new THREE.MeshStandardMaterial({ color: '#3a3c42', roughness: 1, transparent: true, opacity: 0.85 }), 0, 0, 0));
  back.position.set(0, 0.82, 0.24);
  back.rotation.x = 0.12;
  g.add(back);
  g.add(rbox(0.3, 0.1, 0.06, 0.03, MAT.charcoal, 0, 0.62, 0.22));
  for (const sx of [-1, 1]) {
    g.add(box(0.025, 0.2, 0.025, MAT.black, sx * 0.25, 0.55, 0.02));
    g.add(rbox(0.06, 0.03, 0.24, 0.012, MAT.blackMatte, sx * 0.25, 0.66, 0.02));
  }
  const c = centerOf(PLACES.chair);
  g.position.set(c.x, 0, c.z + 0.04);
  return shadow(g);
}

// ——— Спальное место ———

export function buildBed(): { group: THREE.Group; sleeper: THREE.Group } {
  const g = new THREE.Group();
  const b = PLACES.bed;
  const cx = b.x + b.w / 2 + 0.02;
  const cz = b.y + b.h / 2 + 0.02;
  g.add(rbox(b.w - 0.04, 0.2, b.h - 0.04, 0.02, MAT.oak, cx, 0.1, cz));
  g.add(rbox(b.w - 0.12, 0.2, b.h - 0.16, 0.06, MAT.sheets, cx, 0.3, cz + 0.02));
  // Мягкое изголовье.
  g.add(rbox(b.w - 0.02, 0.62, 0.09, 0.04, new THREE.MeshStandardMaterial({ color: '#cfc6b8', roughness: 1, map: linen('#cfc6b8') }), cx, 0.55, 0.06));
  // Подушки.
  for (const sx of [-0.33, 0.33]) {
    const p = rbox(0.56, 0.12, 0.34, 0.06, MAT.sheets, cx + sx, 0.46, 0.34);
    p.rotation.x = -0.25;
    g.add(p);
  }
  g.add(rbox(0.36, 0.3, 0.1, 0.05, MAT.sage, cx + 0.05, 0.53, 0.47).rotateX(-0.35));
  // Льняное одеяло с отворотом.
  const duvet = new THREE.MeshStandardMaterial({ color: '#d9cfc0', roughness: 1, map: linen('#d9cfc0') });
  g.add(rbox(b.w - 0.08, 0.07, 1.42, 0.035, duvet, cx, 0.43, cz + 0.32));
  g.add(rbox(b.w - 0.08, 0.075, 0.18, 0.035, MAT.sheets, cx, 0.435, cz - 0.42));
  // Графитовый плед в ногах.
  g.add(rbox(b.w - 0.02, 0.05, 0.42, 0.025, MAT.charcoal, cx, 0.47, b.y + b.h - 0.3));

  // Спящий под одеялом: голова на подушке и «горка» одеяла. Видно только во сне.
  const sleeper = new THREE.Group();
  sleeper.add(new THREE.Mesh(new THREE.SphereGeometry(0.1, 20, 16), mat('#e9b896', 0.7)).translateX(cx + 0.2).translateY(0.56).translateZ(0.42));
  sleeper.add(new THREE.Mesh(new THREE.SphereGeometry(0.105, 20, 16, 0, Math.PI * 2, 0, Math.PI / 1.8), mat('#3a2a24', 0.8)).translateX(cx + 0.2).translateY(0.575).translateZ(0.4));
  sleeper.add(rbox(0.5, 0.12, 1.2, 0.06, duvet, cx + 0.15, 0.5, cz + 0.25));
  sleeper.visible = false;
  g.add(shadow(sleeper));

  // Тумбочка с лампой, книгой и телефоном.
  const n = PLACES.nightstand;
  const nx = n.x + n.w / 2;
  const nz = n.y + n.h / 2;
  g.add(rbox(n.w, 0.42, n.h, 0.015, MAT.oak, nx, 0.21, nz));
  g.add(box(n.w - 0.04, 0.004, 0.002, MAT.oakDark, nx, 0.26, nz + n.h / 2 + 0.001));
  g.add(cyl(0.07, 0.09, 0.16, MAT.ceramic, nx - 0.05, 0.5, nz - 0.03));
  g.add(cyl(0.12, 0.13, 0.15, LAMP_GLOW.lampBed, nx - 0.05, 0.66, nz - 0.03));
  g.add(rbox(0.16, 0.025, 0.22, 0.004, mat('#e07a5f', 0.8), nx + 0.1, 0.433, nz + 0.05));
  g.add(rbox(0.075, 0.008, 0.15, 0.008, MAT.black, nx + 0.1, 0.45, nz + 0.05));

  return { group: g, sleeper };
}

// ——— Зона отдыха ———

export function buildLounge(): { group: THREE.Group; floorLampBulb: THREE.Vector3 } {
  const g = new THREE.Group();
  // Кресло: дубовая рама, кожаные подушки.
  const a = centerOf(PLACES.armchair);
  const chair = new THREE.Group();
  for (const sx of [-1, 1]) {
    chair.add(rbox(0.05, 0.56, 0.72, 0.02, MAT.oak, sx * 0.36, 0.3, 0));
  }
  chair.add(rbox(0.7, 0.14, 0.66, 0.05, MAT.leather, 0, 0.32, 0.03));
  const backrest = rbox(0.7, 0.5, 0.13, 0.05, MAT.leather, 0, 0.62, -0.27);
  backrest.rotation.x = -0.25;
  chair.add(backrest);
  chair.add(rbox(0.3, 0.26, 0.1, 0.05, MAT.sheets, 0.12, 0.55, -0.13).rotateX(-0.3));
  chair.position.set(a.x, 0, a.z);
  chair.rotation.y = Math.PI * 0.25;
  g.add(shadow(chair));

  // Круглый столик: книги и свеча.
  const s = centerOf(PLACES.sideTable);
  g.add(cyl(0.2, 0.2, 0.025, MAT.black, s.x, 0.5, s.z, 40));
  g.add(cyl(0.012, 0.012, 0.48, MAT.black, s.x, 0.25, s.z));
  g.add(cyl(0.12, 0.12, 0.012, MAT.black, s.x, 0.006, s.z, 32));
  g.add(rbox(0.2, 0.03, 0.26, 0.004, mat('#2f3e46', 0.7), s.x - 0.02, 0.528, s.z));
  g.add(rbox(0.18, 0.025, 0.24, 0.004, mat('#efe9df', 0.7), s.x - 0.01, 0.556, s.z).rotateY(0.3));
  g.add(cyl(0.035, 0.035, 0.07, MAT.ceramic, s.x + 0.11, 0.548, s.z - 0.08));

  // Торшер с льняным абажуром.
  const f = centerOf(PLACES.floorLamp);
  g.add(cyl(0.13, 0.14, 0.02, MAT.black, f.x, 0.01, f.z, 32));
  g.add(cyl(0.01, 0.01, 1.42, MAT.black, f.x, 0.72, f.z));
  g.add(cyl(0.17, 0.2, 0.26, LAMP_GLOW.lampFloor, f.x, 1.5, f.z));
  return { group: g, floorLampBulb: new THREE.Vector3(f.x, 1.45, f.z) };
}

/** Высокое растение в углу между окном и столом. */
/**
 * Фикус лировидный в керамическом горшке: изогнутый ствол и крупные широкие листья по спирали.
 * Листья лежат в userData.leaves — мир слегка покачивает их, будто в комнате движется воздух.
 */
export function buildPlant(): THREE.Group {
  const g = new THREE.Group();
  const p = centerOf(PLACES.plant);
  // Горшок: матовая керамика с ободком, сверху земля.
  g.add(cyl(0.18, 0.14, 0.4, MAT.ceramic, p.x, 0.2, p.z, 36));
  g.add(cyl(0.186, 0.186, 0.03, MAT.ceramic, p.x, 0.395, p.z, 36));
  g.add(cyl(0.165, 0.165, 0.01, mat('#3d2b20', 1), p.x, 0.405, p.z, 32));

  // Ствол — плавная кривая, к верху тоньше.
  const trunkCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(p.x, 0.4, p.z),
    new THREE.Vector3(p.x + 0.03, 0.85, p.z + 0.02),
    new THREE.Vector3(p.x - 0.02, 1.35, p.z - 0.01),
    new THREE.Vector3(p.x + 0.02, 1.82, p.z + 0.02),
  ]);
  const trunk = new THREE.Mesh(new THREE.TubeGeometry(trunkCurve, 24, 0.018, 8), mat('#6b5040', 0.9));
  trunk.castShadow = true;
  g.add(trunk);

  // Лист: широкий, к кончику расширяется, как скрипка; немного выгнут.
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.bezierCurveTo(0.07, 0.02, 0.06, 0.1, 0.1, 0.17);
  shape.bezierCurveTo(0.13, 0.24, 0.05, 0.28, 0, 0.26);
  shape.bezierCurveTo(-0.05, 0.28, -0.13, 0.24, -0.1, 0.17);
  shape.bezierCurveTo(-0.06, 0.1, -0.07, 0.02, 0, 0);
  const leafGeo = new THREE.ShapeGeometry(shape, 10);
  const pos = leafGeo.attributes.position!;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    pos.setZ(i, -Math.abs(x) * 0.35 + Math.sin((y / 0.26) * Math.PI) * 0.015);
  }
  leafGeo.computeVertexNormals();

  const dark = mat('#2f5a37', 0.55, 0, { side: THREE.DoubleSide });
  const mid = mat('#3f7343', 0.5, 0, { side: THREE.DoubleSide });
  const light = mat('#5c9254', 0.5, 0, { side: THREE.DoubleSide });
  const rand = seeded(11);
  const leaves: THREE.Object3D[] = [];
  const count = 24;
  for (let i = 0; i < count; i++) {
    const t = i / (count - 1);
    const at = trunkCurve.getPoint(0.3 + t * 0.7);
    const ang = i * 2.4 + rand() * 0.3; // золотой угол — листья не закрывают друг друга
    const pivot = new THREE.Group();
    pivot.position.copy(at);
    pivot.rotation.y = ang;
    const leaf = new THREE.Mesh(leafGeo, t > 0.75 ? light : rand() < 0.5 ? mid : dark);
    // Нижние листья почти горизонтальны и крупнее, верхние смотрят вверх.
    leaf.rotation.x = -(0.5 + t * 0.6) - rand() * 0.2;
    leaf.position.z = 0.015;
    leaf.scale.setScalar(1.15 - t * 0.35 + rand() * 0.1);
    leaf.castShadow = true;
    pivot.add(leaf);
    pivot.userData.base = pivot.rotation.z;
    pivot.userData.phase = rand() * Math.PI * 2;
    leaves.push(pivot);
    g.add(pivot);
  }
  g.userData.leaves = leaves;
  return g;
}

// ——— Кухня ———

export function buildKitchen(): { group: THREE.Group; machineSpout: THREE.Vector3 } {
  const g = new THREE.Group();
  const c = PLACES.counter;
  const x = c.x + c.w / 2;
  // Белые фасады без ручек, швы между дверцами.
  g.add(rbox(c.w - 0.02, 0.86, c.h, 0.008, MAT.white, x, 0.45, c.y + c.h / 2));
  g.add(box(c.w - 0.04, 0.08, c.h - 0.02, MAT.blackMatte, x - 0.02, 0.04, c.y + c.h / 2));
  for (let z = c.y + 0.47; z < c.y + c.h - 0.1; z += 0.47) g.add(box(0.004, 0.76, 0.003, mat('#d7d4ce', 0.6), c.x + c.w - 0.008, 0.5, z).rotateY(Math.PI / 2));
  g.add(box(0.003, 0.003, c.h - 0.02, mat('#d7d4ce'), c.x + c.w - 0.008, 0.55, c.y + c.h / 2));
  // Столешница из дуба.
  g.add(rbox(c.w + 0.02, 0.04, c.h + 0.02, 0.006, MAT.oak, x, 0.9, c.y + c.h / 2));
  // Кофемашина.
  const m = new THREE.Group();
  m.add(rbox(0.26, 0.36, 0.3, 0.03, MAT.black, 0, 0.18, 0));
  m.add(rbox(0.2, 0.03, 0.22, 0.01, MAT.chrome, 0.02, 0.025, 0.02));
  m.add(cyl(0.02, 0.02, 0.06, MAT.chrome, 0.1, 0.2, 0));
  m.add(cyl(0.035, 0.03, 0.06, MAT.ceramic, 0.1, 0.07, 0));
  m.add(rbox(0.12, 0.05, 0.01, 0.005, new THREE.MeshStandardMaterial({ color: '#111', emissive: '#7fd1ff', emissiveIntensity: 0.6 }), 0.0, 0.3, 0.151));
  m.position.set(x - 0.02, 0.92, c.y + 0.32);
  m.rotation.y = Math.PI / 2;
  g.add(shadow(m));
  // Раковина и кран.
  g.add(rbox(0.36, 0.01, 0.4, 0.02, mat('#a7adb3', 0.25, 0.8), x, 0.921, c.y + 0.85));
  const tap = new THREE.Group();
  tap.add(cyl(0.012, 0.014, 0.24, MAT.black, 0, 0.12, 0));
  tap.add(cyl(0.01, 0.01, 0.16, MAT.black, 0.07, 0.24, 0).rotateZ(Math.PI / 2));
  tap.position.set(c.x + 0.07, 0.92, c.y + 0.85);
  g.add(shadow(tap));
  // Доска, банки, травы.
  g.add(rbox(0.22, 0.02, 0.32, 0.01, MAT.oakDark, x + 0.04, 0.93, c.y + 1.2).rotateY(0.15));
  g.add(cyl(0.05, 0.05, 0.14, MAT.ceramic, c.x + 0.12, 0.99, c.y + 1.28));
  for (let i = 0; i < 7; i++) g.add(new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), MAT.leafLight).translateX(c.x + 0.12 + Math.cos(i) * 0.03).translateY(1.08 + (i % 3) * 0.02).translateZ(c.y + 1.28 + Math.sin(i) * 0.03));
  // Открытая полка на стене с посудой.
  g.add(rbox(0.26, 0.025, 1.2, 0.006, MAT.oak, 0.13, 1.55, c.y + 0.7));
  for (let i = 0; i < 4; i++) g.add(cyl(0.04, 0.035, 0.09, i % 2 ? MAT.ceramic : MAT.sage, 0.13, 1.61, c.y + 0.3 + i * 0.13));
  g.add(cyl(0.05, 0.05, 0.16, MAT.glass, 0.13, 1.645, c.y + 0.95));
  g.add(cyl(0.05, 0.05, 0.12, MAT.glass, 0.13, 1.625, c.y + 1.1));

  // Холодильник: встроенный, белый, с одной длинной ручкой.
  const fr = PLACES.fridge;
  g.add(rbox(fr.w - 0.02, 1.9, fr.h - 0.02, 0.01, MAT.white, fr.x + fr.w / 2, 0.95, fr.y + fr.h / 2));
  g.add(box(0.004, 0.003, fr.h - 0.06, mat('#d7d4ce'), fr.x + fr.w - 0.01, 1.25, fr.y + fr.h / 2));
  g.add(rbox(0.02, 0.6, 0.02, 0.008, MAT.alu, fr.x + fr.w - 0.002, 1.0, fr.y + 0.1));

  return { group: g, machineSpout: new THREE.Vector3(x + 0.08, 1.12, c.y + 0.32) };
}

/** Коробки после переезда — ещё не разобраны. */
export function buildBoxes(): THREE.Group {
  const g = new THREE.Group();
  const b = PLACES.boxes;
  const cx = b.x + b.w / 2;
  const cz = b.y + b.h / 2;
  const stack: [number, number, number, number, number][] = [
    [0.6, 0.38, 0.5, 0, 0],
    [0.46, 0.3, 0.38, 0.03, 0.12],
    [0.3, 0.2, 0.26, -0.05, -0.2],
  ];
  let y = 0;
  stack.forEach(([w, h, d, dx, rot], i) => {
    const bx = new THREE.Group();
    bx.add(rbox(w, h, d, 0.01, MAT.cardboard, 0, h / 2, 0));
    bx.add(box(0.06, 0.003, d + 0.004, MAT.tape, 0, h + 0.001, 0));
    bx.add(box(0.06, h * 0.25, 0.003, MAT.tape, 0, h - h * 0.125, d / 2 + 0.002));
    if (i === 0) bx.add(box(0.14, 0.06, 0.002, MAT.white, -0.15, h * 0.5, d / 2 + 0.002));
    bx.position.set(cx + dx, y, cz);
    bx.rotation.y = rot;
    g.add(bx);
    y += h;
  });
  return shadow(g);
}
