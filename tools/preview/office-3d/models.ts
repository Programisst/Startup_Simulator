import * as T from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

export const palette = {
  frame: 0x323f43, cream: 0xe7e2d4, wood: 0xb98957, oak: 0xd2ad7b,
  fabric: 0x3d6671, sage: 0x6b806e, metal: 0xadb2ac, paper: 0xf1e9d6,
};
const materials = new Map<number, T.MeshStandardMaterial>();
export function material(color: number): T.MeshStandardMaterial {
  if (!materials.has(color)) materials.set(color, new T.MeshStandardMaterial({ color, roughness: .68, metalness: .06 }));
  return materials.get(color)!;
}

export function box(parent: T.Object3D, size: [number, number, number], pos: [number, number, number], color: number | T.Material, radius = 0): T.Mesh {
  const geometry = radius ? new RoundedBoxGeometry(...size, 2, radius) : new T.BoxGeometry(...size);
  const mesh = new T.Mesh(geometry, typeof color === 'number' ? material(color) : color);
  mesh.position.set(...pos);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}
export function cylinder(parent: T.Object3D, radius: number, height: number, pos: [number, number, number], color: number, top = radius): T.Mesh {
  const mesh = new T.Mesh(new T.CylinderGeometry(top, radius, height, 16), material(color));
  mesh.position.set(...pos);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}
export function sphere(parent: T.Object3D, size: [number, number, number], pos: [number, number, number], color: number): T.Mesh {
  const mesh = new T.Mesh(new T.SphereGeometry(1, 16, 12), material(color));
  mesh.scale.set(...size);
  mesh.position.set(...pos);
  mesh.castShadow = true;
  parent.add(mesh);
  return mesh;
}
export function group(parent: T.Object3D, x: number, y: number, z: number, angle = 0): T.Group {
  const g = new T.Group();
  g.position.set(x, y, z);
  g.rotation.y = angle;
  parent.add(g);
  return g;
}
export function chair(parent: T.Object3D, x: number, z: number, angle = 0, color = palette.fabric): T.Group {
  const g = group(parent, x, 0, z, angle);
  cylinder(g, .043, .36, [0, .3, 0], palette.metal);
  const back = box(g, [.49, .49, .075], [0, .79, .20], color, .038);
  back.rotation.x = -.1;
  box(g, [.49, .10, .46], [0, .52, 0], color, .035);
  for (const side of [-1, 1]) {
    box(g, [.035, .23, .035], [side * .28, .63, .08], palette.frame);
    box(g, [.06, .045, .30], [side * .28, .76, -.025], palette.frame, .02);
  }
  for (let i = 0; i < 5; i++) {
    const a = i * Math.PI * 2 / 5;
    const arm = box(g, [.035, .035, .34], [Math.sin(a) * .14, .13, Math.cos(a) * .14], palette.metal, .009);
    arm.rotation.y = a;
    sphere(g, [.045, .045, .035], [Math.sin(a) * .28, .075, Math.cos(a) * .28], palette.frame);
  }
  return g;
}
export function mug(parent: T.Object3D, x: number, y: number, z: number, color = palette.cream) {
  cylinder(parent, .043, .09, [x, y + .045, z], color);
  cylinder(parent, .033, .003, [x, y + .091, z], 0x3c2d26);
  const handle = new T.Mesh(new T.TorusGeometry(.025, .009, 6, 12), material(color));
  handle.position.set(x + .044, y + .05, z);
  parent.add(handle);
}
export function plant(parent: T.Object3D, x: number, z: number, scale = 1, y = 0) {
  const g = group(parent, x, y, z);
  g.scale.setScalar(scale);
  cylinder(g, .17, .28, [0, .14, 0], 0xc8b9a0, .21);
  cylinder(g, .185, .015, [0, .28, 0], 0x554c3c);
  for (let i = 0; i < 9; i++) {
    const a = i * 2.39;
    const h = .48 + (i % 4) * .11;
    const stem = cylinder(g, .008, h, [Math.sin(a) * .08, .28 + h / 2, Math.cos(a) * .08], 0x536c43);
    stem.rotation.z = Math.sin(a) * .24;
    const leaf = sphere(g, [.08, .22, .035], [Math.sin(a) * .17, h + .22, Math.cos(a) * .17], [0x48664d, 0x6b855b, 0x7e945f][i % 3]!);
    leaf.rotation.set(.35, a, .5);
  }
}
export function desk(parent: T.Object3D, x: number, z: number) {
  box(parent, [1.42, .065, .76], [x, .76, z], palette.oak, .025);
  for (const dx of [-.62, .62]) {
    for (const dz of [-.27, .27]) box(parent, [.045, .7, .045], [x + dx, .375, z + dz], palette.frame, .008);
    box(parent, [.045, .035, .58], [x + dx, .09, z], palette.frame);
  }
  box(parent, [.67, .015, .25], [x - .05, .801, z + .18], 0x29383c, .009);
  box(parent, [.36, .022, .12], [x - .11, .817, z + .17], 0xc1c7c1, .009);
  for (let row = 0; row < 3; row++) for (let key = 0; key < 11; key++) {
    box(parent, [.022, .003, .02], [x - .26 + key * .027, .831, z + .135 + row * .025], 0x6a7778, .002);
  }
  sphere(parent, [.035, .015, .049], [x + .27, .818, z + .18], 0xb9bfba);
  box(parent, [.38, .17, .32], [x + .39, .12, z - .13], 0x3f4848, .02);
  box(parent, [.38, .004, .015], [x + .39, .21, z + .033], palette.metal);
}
export function monitor(parent: T.Object3D, x: number, z: number, texture: T.Texture | null): T.Mesh {
  box(parent, [.27, .022, .19], [x, .81, z - .11], palette.metal, .015);
  box(parent, [.04, .21, .035], [x, .91, z - .16], palette.metal);
  box(parent, [.68, .41, .047], [x, 1.145, z - .15], palette.frame, .018);
  const surface = new T.Mesh(new T.PlaneGeometry(.642, .367), new T.MeshBasicMaterial({
    map: texture, color: texture ? 0xffffff : 0x263137, toneMapped: false,
  }));
  surface.position.set(x, 1.15, z - .125);
  parent.add(surface);
  return surface;
}
export interface Human {
  root: T.Group;
  body: T.Group;
  leftArm: T.Group;
  rightArm: T.Group;
  leftLeg: T.Group;
  rightLeg: T.Group;
  knees: T.Group[];
}
export function human(parent: T.Object3D, seed: number): Human {
  const root = group(parent, 0, 0, 0);
  const body = group(root, 0, .87, 0);
  const skin = [0xe4b69a, 0xc28d73, 0x9e715b, 0xf0c6a5][seed % 4]!;
  const shirt = [0xd4cbbb, 0x62808b, 0x826b62, 0x6d8066, 0x3b5267][seed % 5]!;
  const hair = [0x48352e, 0x242d35, 0x77513b, 0x4c3934][seed % 4]!;
  const pants = seed % 2 ? 0x354249 : 0x46536a;
  sphere(body, [.19, .27, .105], [0, .20, 0], shirt);
  cylinder(body, .052, .09, [0, .47, 0], skin);
  sphere(body, [.115, .15, .11], [0, .64, 0], skin);
  const cap = sphere(body, [.119, .095, .113], [0, .72, .012], hair);
  cap.rotation.x = -.25;
  sphere(body, [.116, .10, .085], [0, .64, .07], hair);
  sphere(body, [.016, .029, .025], [-.112, .635, -.005], skin);
  sphere(body, [.016, .029, .025], [.112, .635, -.005], skin);
  for (const side of [-1, 1]) sphere(body, [.012, .009, .004], [side * .04, .65, -.104], 0x303335);
  const knees: T.Group[] = [];
  const limb = (x: number, upper: number, lower: number, color: number, arm: boolean) => {
    const g = group(body, x, arm ? .37 : -.01, 0);
    cylinder(g, arm ? .045 : .062, upper, [0, -upper / 2, 0], color);
    sphere(g, [arm ? .046 : .06, .045, .048], [0, -upper, 0], color);
    const lowerLimb = group(g, 0, -upper, 0);
    cylinder(lowerLimb, arm ? .034 : .05, lower, [0, -lower / 2, 0], arm ? skin : color);
    sphere(lowerLimb, arm ? [.038, .055, .033] : [.065, .035, .12], [0, -lower, arm ? 0 : -.04], arm ? skin : 0xddd8cc);
    if (!arm) knees.push(lowerLimb);
    return g;
  };
  const leftArm = limb(-.20, .21, .20, shirt, true);
  const rightArm = limb(.20, .21, .20, shirt, true);
  const leftLeg = limb(-.09, .37, .35, pants, false);
  const rightLeg = limb(.09, .37, .35, pants, false);
  return { root, body, leftArm, rightArm, leftLeg, rightLeg, knees };
}
