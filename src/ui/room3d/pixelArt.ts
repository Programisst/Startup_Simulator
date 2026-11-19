// Пиксельная подача 3D-комнаты: свет ступеньками, как у художника, и тёмные контуры по краям предметов.
// Сцена рисуется в маленьком разрешении (пиксель комнаты = пиксель героя) и увеличивается без размытия.
import * as THREE from 'three';
import { FullScreenQuad, Pass } from 'three/examples/jsm/postprocessing/Pass.js';

/** Ступени света: тень, полутень, свет, блик. */
function toonGradient(): THREE.DataTexture {
  const steps = [70, 140, 205, 255];
  const data = new Uint8Array(steps.length * 4);
  steps.forEach((v, i) => data.set([v, v, v, 255], i * 4));
  const tex = new THREE.DataTexture(data, steps.length, 1, THREE.RGBAFormat);
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}

export interface Toonified {
  /** Переносит изменения исходных материалов (например, свечение ламп вечером) в новые. */
  sync(): void;
}

/**
 * Заменяет обычные материалы комнаты на «мультяшные» со светом ступеньками.
 * Объекты с userData.keepMaterial не трогаем (например, пиксельного героя — у него свои цвета).
 */
export function toonify(root: THREE.Object3D): Toonified {
  const gradientMap = toonGradient();
  const made = new Map<THREE.MeshStandardMaterial, THREE.MeshToonMaterial>();
  const convert = (m: THREE.Material): THREE.Material => {
    if (!(m instanceof THREE.MeshStandardMaterial)) return m;
    let toon = made.get(m);
    if (!toon) {
      toon = new THREE.MeshToonMaterial({
        color: m.color,
        map: m.map,
        emissive: m.emissive,
        emissiveMap: m.emissiveMap,
        emissiveIntensity: m.emissiveIntensity,
        transparent: m.transparent,
        opacity: m.opacity,
        depthWrite: m.depthWrite,
        side: m.side,
        alphaTest: m.alphaTest,
        gradientMap,
      });
      made.set(m, toon);
    }
    return toon;
  };
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh || skipped(mesh)) return;
    mesh.material = Array.isArray(mesh.material) ? mesh.material.map(convert) : convert(mesh.material);
  });
  return {
    sync() {
      for (const [src, toon] of made) {
        toon.emissiveIntensity = src.emissiveIntensity;
        toon.opacity = src.opacity;
      }
    },
  };
}

function skipped(o: THREE.Object3D): boolean {
  for (let p: THREE.Object3D | null = o; p; p = p.parent) if (p.userData.keepMaterial) return true;
  return false;
}

/**
 * Рисует сцену и обводит края предметов: тёмная линия там, где предмет заканчивается,
 * и светлая — на рёбрах, где поверхность поворачивает. Объекты с userData.noEdges
 * (пиксельный герой) в поиске рёбер не участвуют: у них уже есть свой контур.
 */
export class PixelEdgePass extends Pass {
  private beauty = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType });
  private normals = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType });
  private normalMaterial = new THREE.MeshNormalMaterial();
  private quad: FullScreenQuad;
  private material: THREE.ShaderMaterial;

  constructor(
    private scene: THREE.Scene,
    private camera: THREE.Camera,
  ) {
    super();
    for (const t of [this.beauty, this.normals]) {
      t.texture.minFilter = THREE.NearestFilter;
      t.texture.magFilter = THREE.NearestFilter;
    }
    this.beauty.depthTexture = new THREE.DepthTexture(1, 1);
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: null },
        tDepth: { value: null },
        tNormal: { value: null },
        resolution: { value: new THREE.Vector4() },
        darkEdge: { value: 0.42 },
        lightEdge: { value: 0.22 },
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
      `,
      fragmentShader: /* glsl */ `
        uniform sampler2D tDiffuse;
        uniform sampler2D tDepth;
        uniform sampler2D tNormal;
        uniform vec4 resolution;
        uniform float darkEdge;
        uniform float lightEdge;
        varying vec2 vUv;

        float depthAt(int x, int y) { return texture2D(tDepth, vUv + vec2(x, y) * resolution.zw).r; }
        vec3 normalAt(int x, int y) { return texture2D(tNormal, vUv + vec2(x, y) * resolution.zw).rgb * 2.0 - 1.0; }

        float depthEdge(float d) {
          float diff = 0.0;
          diff += clamp(depthAt(1, 0) - d, 0.0, 1.0);
          diff += clamp(depthAt(-1, 0) - d, 0.0, 1.0);
          diff += clamp(depthAt(0, 1) - d, 0.0, 1.0);
          diff += clamp(depthAt(0, -1) - d, 0.0, 1.0);
          return floor(smoothstep(0.004, 0.008, diff) * 2.0) / 2.0;
        }

        float neighborNormal(int x, int y, float d, vec3 n) {
          float dd = depthAt(x, y) - d;
          vec3 nn = normalAt(x, y);
          float nd = dot(n - nn, vec3(1.0, 1.0, 1.0));
          float ni = clamp(smoothstep(-0.01, 0.01, nd), 0.0, 1.0);
          float di = clamp(sign(dd * 0.25 + 0.0025), 0.0, 1.0);
          return (1.0 - dot(n, nn)) * di * ni;
        }

        float normalEdge(float d, vec3 n) {
          float k = 0.0;
          k += neighborNormal(0, -1, d, n);
          k += neighborNormal(0, 1, d, n);
          k += neighborNormal(-1, 0, d, n);
          k += neighborNormal(1, 0, d, n);
          return step(0.12, k);
        }

        void main() {
          vec4 texel = texture2D(tDiffuse, vUv);
          float d = depthAt(0, 0);
          vec3 n = normalAt(0, 0);
          float de = depthEdge(d);
          float ne = normalEdge(d, n);
          float k = de > 0.0 ? 1.0 - darkEdge * de : 1.0 + lightEdge * ne;
          gl_FragColor = vec4(texel.rgb * k, texel.a);
        }
      `,
    });
    this.quad = new FullScreenQuad(this.material);
  }

  override setSize(width: number, height: number): void {
    this.beauty.setSize(width, height);
    this.normals.setSize(width, height);
    (this.material.uniforms.resolution!.value as THREE.Vector4).set(width, height, 1 / width, 1 / height);
  }

  override render(renderer: THREE.WebGLRenderer, writeBuffer: THREE.WebGLRenderTarget): void {
    renderer.setRenderTarget(this.beauty);
    renderer.render(this.scene, this.camera);

    // Прозрачное (стекло, луч солнца, пар) и героя в поиске рёбер не учитываем.
    const hide: THREE.Object3D[] = [];
    this.scene.traverseVisible((o) => {
      const m = (o as THREE.Mesh).material as THREE.Material | undefined;
      if (o.userData.noEdges || (m && !Array.isArray(m) && m.transparent) || (o as THREE.Sprite).isSprite) hide.push(o);
    });
    const was = hide.map((o) => o.visible);
    for (const o of hide) o.visible = false;
    const old = this.scene.overrideMaterial;
    this.scene.overrideMaterial = this.normalMaterial;
    renderer.setRenderTarget(this.normals);
    renderer.render(this.scene, this.camera);
    this.scene.overrideMaterial = old;
    hide.forEach((o, i) => (o.visible = was[i]!));

    const u = this.material.uniforms;
    u.tDiffuse!.value = this.beauty.texture;
    u.tDepth!.value = this.beauty.depthTexture;
    u.tNormal!.value = this.normals.texture;
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer);
    if (!this.renderToScreen && this.clear) renderer.clear();
    this.quad.render(renderer);
  }

  override dispose(): void {
    this.beauty.dispose();
    this.normals.dispose();
    this.normalMaterial.dispose();
    this.material.dispose();
    this.quad.dispose();
  }
}
