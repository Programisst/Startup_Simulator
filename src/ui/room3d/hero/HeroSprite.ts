// Пиксельный герой внутри 3D-комнаты: плоская картинка, которая всегда повёрнута к камере,
// освещается светом комнаты и отбрасывает тень. Кадр выбирается по направлению и шагу.
import * as THREE from 'three';
import { drawHero, HERO_FEET, HERO_H, HERO_SCALE, HERO_TALL, HERO_W, heroFrameKey, type Facing, type HeroPose, type OutfitId } from './hero';

/** Рост героя в метрах. */
const HEIGHT_M = 1.5;
/** Условный пиксель героя (сетка 32×48) в метрах. */
const PX = HEIGHT_M / HERO_TALL;
/** Настоящий пиксель героя в метрах — такого же размера и пиксели комнаты. */
export const HERO_PIXEL_M = PX / HERO_SCALE;

export type HeroMode = 'stand' | 'walk' | 'sit' | 'hidden';

export interface HeroFrameInput {
  mode: HeroMode;
  facing: Facing;
  /** Скорость в м/с — от неё зависит темп шагов. */
  speed: number;
  typing: boolean;
}

export class HeroSprite {
  readonly root = new THREE.Group();
  private canvas = document.createElement('canvas');
  private ctx: CanvasRenderingContext2D;
  private texture: THREE.CanvasTexture;
  private mesh: THREE.Mesh;
  private blob: THREE.Mesh;
  private cache = new Map<string, HTMLCanvasElement>();
  private key = '';
  private stride = 0;
  private blinkIn = 2.5;
  private blinkLeft = 0;
  private typeTimer = 0;
  private typeHand = 0;
  private stretch: number;
  private look = new THREE.Vector3();

  constructor(
    private outfit: OutfitId,
    /** Наклон камеры: картинку чуть вытягиваем по высоте, чтобы с высоты она не казалась приплюснутой. */
    pitch: number,
    blobTexture: THREE.Texture,
  ) {
    this.canvas.width = HERO_W * HERO_SCALE;
    this.canvas.height = HERO_H * HERO_SCALE;
    this.ctx = this.canvas.getContext('2d')!;
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.magFilter = THREE.NearestFilter;
    this.texture.minFilter = THREE.NearestFilter;
    this.texture.generateMipmaps = false;
    this.texture.colorSpace = THREE.SRGBColorSpace;

    const stretch = 1 / Math.cos(pitch);
    this.stretch = stretch;
    const w = HERO_W * PX;
    const h = HERO_H * PX * stretch;
    const geo = new THREE.PlaneGeometry(w, h);
    // Низ подошв — ровно на полу.
    geo.translate(0, h / 2 - (HERO_H - HERO_FEET) * PX * stretch, 0);
    const mat = new THREE.MeshStandardMaterial({
      map: this.texture,
      alphaTest: 0.5,
      side: THREE.DoubleSide,
      roughness: 1,
      metalness: 0,
      emissive: new THREE.Color('#ffffff'),
      emissiveMap: this.texture,
      emissiveIntensity: 0.35,
    });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.castShadow = true;
    this.root.add(this.mesh);

    // Мягкое пятно тени под ногами — герой «стоит», а не висит.
    this.blob = new THREE.Mesh(
      new THREE.PlaneGeometry(0.62, 0.36),
      new THREE.MeshBasicMaterial({ map: blobTexture, color: '#1a1012', transparent: true, opacity: 0.42, depthWrite: false }),
    );
    this.blob.rotation.x = -Math.PI / 2;
    this.blob.position.y = 0.006;
    this.root.add(this.blob);
  }

  /** Сколько света «своего» добавить к картинке: днём немного, ночью почти ничего. */
  setFill(level: number): void {
    (this.mesh.material as THREE.MeshStandardMaterial).emissiveIntensity = level;
  }

  /** Верх головы в метрах — для облачка с мыслями. */
  headHeight(): number {
    return HERO_TALL * PX * this.stretch;
  }

  update(dt: number, input: HeroFrameInput, camera: THREE.Camera): void {
    this.root.visible = input.mode !== 'hidden';
    this.blob.visible = input.mode !== 'sit';
    // Повёрнут ровно к камере, только вокруг вертикали.
    camera.getWorldDirection(this.look);
    this.mesh.rotation.y = Math.atan2(-this.look.x, -this.look.z);

    // Моргание раз в несколько секунд.
    this.blinkIn -= dt;
    if (this.blinkIn <= 0) {
      this.blinkLeft = 0.13;
      this.blinkIn = 2.4 + ((this.root.position.x * 7.3) % 1.7);
    }
    this.blinkLeft = Math.max(0, this.blinkLeft - dt);

    const pose: HeroPose = { facing: input.facing, walk: null, breath: 0, blink: this.blinkLeft > 0 };
    if (input.mode === 'walk') {
      this.stride = (this.stride + dt * input.speed * 0.95) % 1;
      pose.walk = Math.floor(this.stride * 8) / 8;
    } else {
      this.stride = 0;
      pose.breath = Math.floor(performance.now() / 900) % 2;
    }
    if (input.mode === 'sit') {
      pose.facing = 'up';
      this.typeTimer -= dt;
      if (this.typeTimer <= 0) {
        this.typeTimer = 0.11 + Math.random() * 0.09;
        this.typeHand = input.typing ? 1 - this.typeHand : -1;
      }
      pose.sit = { typing: input.typing && this.typeHand >= 0 ? this.typeHand : null };
    }
    this.show(pose);
  }

  private show(pose: HeroPose): void {
    const flip = pose.facing === 'left';
    const base: HeroPose = flip ? { ...pose, facing: 'right' } : pose;
    const key = heroFrameKey(base, this.outfit) + (flip ? '|flip' : '');
    if (key === this.key) return;
    this.key = key;
    let frame = this.cache.get(key);
    if (!frame) {
      frame = drawHero(base, this.outfit).toCanvas(flip);
      this.cache.set(key, frame);
    }
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.drawImage(frame, 0, 0);
    this.texture.needsUpdate = true;
  }
}
