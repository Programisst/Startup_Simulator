import * as T from 'three';
import { room, meeting } from './layout';
import { box, cylinder, group, chair, mug, plant, palette, material } from './models';

function woodTexture(): T.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1024;
  const c = canvas.getContext('2d')!;
  c.fillStyle = '#b18b62';
  c.fillRect(0, 0, 1024, 1024);
  for (let row = 0; row < 18; row++) {
    const y = row * 57;
    for (let column = -1; column < 5; column++) {
      const offset = (row % 3) * 87;
      const x = column * 260 + offset;
      const lightness = 57 + ((row * 7 + column * 13 + 30) % 11);
      c.fillStyle = `hsl(32 34% ${lightness}%)`;
      c.fillRect(x + 1, y + 1, 258, 55);
      c.strokeStyle = 'rgba(81,49,28,.08)';
      for (let grain = 0; grain < 7; grain++) {
        c.beginPath();
        c.moveTo(x + 8, y + grain * 8 + 4);
        c.bezierCurveTo(x + 80, y + grain * 8, x + 180, y + grain * 8 + 10, x + 246, y + grain * 8 + 4);
        c.stroke();
      }
    }
  }
  const texture = new T.CanvasTexture(canvas);
  texture.colorSpace = T.SRGBColorSpace;
  texture.wrapS = texture.wrapT = T.RepeatWrapping;
  texture.repeat.set(2, 2);
  texture.anisotropy = 8;
  return texture;
}

function glassWall(parent: T.Object3D, length: number, x: number, z: number, angle: number) {
  const g = group(parent, x, 0, z, angle);
  const glass = new T.MeshPhysicalMaterial({
    color: 0x9bbcb9, transparent: true, opacity: .12, roughness: .2,
    metalness: .1, side: T.DoubleSide, depthWrite: false,
  });
  box(g, [length, .045, .07], [0, .045, 0], palette.frame);
  box(g, [length, .06, .08], [0, 2.35, 0], palette.frame);
  const segments = Math.ceil(length / 1.15);
  for (let i = 0; i <= segments; i++) {
    const at = -length / 2 + i * length / segments;
    box(g, [.035, 2.3, .045], [at, 1.2, 0], palette.frame);
    if (i < segments) {
      const pane = box(g, [length / segments - .035, 2.22, .016], [at + length / segments / 2, 1.2, 0], glass);
      pane.castShadow = false;
      box(g, [length / segments - .035, .025, .018], [at + length / segments / 2, 1.07, .009], 0xd0dcce).castShadow = false;
    }
  }
}
function sofa(parent: T.Object3D, x: number, z: number, angle: number) {
  const g = group(parent, x, 0, z, angle);
  for (const a of [-1, 1]) for (const b of [-1, 1]) cylinder(g, .03, .16, [a * 1.25, .08, b * .34], palette.frame);
  box(g, [2.8, .32, .85], [0, .30, 0], 0x496b7d, .09);
  box(g, [2.8, .61, .17], [0, .66, .36], 0x496b7d, .07);
  for (const side of [-1, 1]) box(g, [.20, .50, .85], [side * 1.35, .57, 0], 0x496b7d, .06);
  for (let i = 0; i < 3; i++) box(g, [.79, .12, .66], [-.85 + i * .85, .52, -.04], 0x648496, .035);
  box(g, [.38, .38, .15], [-.97, .8, .17], 0xc0b397, .055).rotation.z = .12;
}
function pendant(parent: T.Object3D, x: number, z: number, length: number) {
  cylinder(parent, .008, .45, [x, 2.62, z], palette.frame);
  box(parent, [length, .07, .14], [x, 2.36, z], palette.frame, .02);
  const strip = box(parent, [length - .08, .015, .09], [x, 2.315, z], new T.MeshStandardMaterial({
    color: 0xfff4d7, emissive: 0xffdba7, emissiveIntensity: .7,
  }));
  strip.castShadow = false;
}

export function buildInterior(scene: T.Scene) {
  box(scene, [room.width + .3, .30, room.depth + .3], [8, -.19, 6], 0x646c69, .035);
  const floorMaterial = new T.MeshStandardMaterial({ map: woodTexture(), roughness: .72, metalness: .03 });
  box(scene, [room.width, .08, room.depth], [8, -.015, 6], floorMaterial);
  // The rear facade and one side remain full height. Front edges stay low.
  box(scene, [16.1, 2.7, .17], [8, 1.35, -.08], palette.cream);
  box(scene, [.17, 2.7, 12], [-.08, 1.35, 6], palette.cream);
  box(scene, [16, .16, .08], [8, .08, 12], 0xcac6b9);
  box(scene, [.08, .16, 12], [16, .08, 6], 0xcac6b9);
  box(scene, [16, .10, .13], [8, .10, .06], palette.frame);
  box(scene, [.13, .10, 12], [.06, .10, 6], palette.frame);
  // Large industrial windows, with a soft sky surface behind them.
  const windowMaterial = new T.MeshStandardMaterial({ color: 0xbacacd, roughness: .24, emissive: 0x6f858d, emissiveIntensity: .15 });
  for (let i = 0; i < 7; i++) {
    const x = 1.45 + i * 1.95;
    box(scene, [1.7, 1.65, .035], [x, 1.61, .025], windowMaterial);
    box(scene, [1.8, .045, .10], [x, .77, .08], palette.frame);
    box(scene, [1.8, .045, .08], [x, 2.46, .08], palette.frame);
    for (const side of [-1, 1]) box(scene, [.043, 1.72, .07], [x + side * .87, 1.62, .08], palette.frame);
    box(scene, [.035, 1.68, .06], [x, 1.62, .08], palette.frame);
    box(scene, [1.8, .035, .06], [x, 1.63, .08], palette.frame);
  }
  // Back wall detailing and storage on the side facade.
  for (let z = .3; z < 11.8; z += .42) box(scene, [.028, .8, .025], [.02, .52, z], 0xb0ab9d);
  for (const z of [2, 5]) {
    box(scene, [.39, 1.16, 1.3], [.24, .58, z], 0xaa8058, .018);
    for (let h = 0; h < 3; h++) box(scene, [.4, .035, 1.24], [.25, .19 + h * .35, z], palette.oak);
    for (let j = 0; j < 5; j++) box(scene, [.30, .22 + j % 2 * .05, .065], [.25, 1.29, z - .47 + j * .1], [0x637d79, 0xbc9c7c, 0x655d53][j % 3]!);
  }
  glassWall(scene, 5.2, meeting.x, 3.1, Math.PI / 2);
  glassWall(scene, 2.65, 12.32, 5.7, 0);
  glassWall(scene, .85, 15.08, 5.7, 0);
  // A visibly open doorway with frame and handle.
  box(scene, [.04, 2.3, .06], [13.66, 1.16, 5.7], palette.frame);
  box(scene, [.98, .06, .07], [14.18, 2.35, 5.7], palette.frame);
  const meetingRug = material(0x7c8880);
  box(scene, [3.8, .012, 3.9], [13.2, .04, 3.1], meetingRug, .12);
  box(scene, [2.35, .065, 1.1], [13.2, .78, 2.7], palette.oak, .15);
  for (const x of [12.45, 13.95]) box(scene, [.07, .75, .65], [x, .38, 2.7], palette.frame);
  for (const x of [12.45, 13.2, 13.95]) {
    chair(scene, x, 1.65, Math.PI, palette.sage);
    chair(scene, x, 3.75, 0, palette.sage);
  }
  box(scene, [.02, .9, 1.4], [.08, 1.55, 7.2], 0xf5f1df);
  // Screen and whiteboard in the meeting room.
  box(scene, [1.65, .96, .055], [13.2, 1.6, .18], palette.frame, .025);
  box(scene, [1.54, .85, .01], [13.2, 1.6, .215], 0x385356);
  for (let i = 0; i < 5; i++) box(scene, [.13, .14 + i * .075, .014], [12.72 + i * .22, 1.38 + i * .03, .226], 0x9bb3a5);
  box(scene, [.015, .85, 1.5], [15.65, 1.5, 2.8], 0xf6f2e5);
  plant(scene, 15.2, 4.8, 1.3);
  plant(scene, 11.55, .65, 1.05);
  // Lounge, with a different floor finish and a long bookcase.
  box(scene, [5.0, .012, 3.25], [3.2, .04, 9.8], 0x82928d, .15);
  sofa(scene, 2.9, 10.4, 0);
  sofa(scene, 1.15, 8.8, Math.PI / 2);
  box(scene, [1.35, .065, .72], [3.1, .43, 8.85], 0xd3ba8f, .18);
  for (const x of [2.7, 3.5]) cylinder(scene, .028, .40, [x, .21, 8.85], palette.frame);
  box(scene, [.28, .035, .34], [3.25, .49, 8.8], 0x5f7173, .005);
  mug(scene, 2.8, .47, 8.85);
  plant(scene, .55, 11.3, 1.3);
  plant(scene, 5.7, 10.8, 1.5);
  box(scene, [2.3, .45, .40], [7.5, .25, 10.9], 0x987550, .02);
  for (let i = 0; i < 6; i++) plant(scene, 6.55 + i * .37, 10.9, .68, .5);
  // Kitchen with tall refrigerator, sink, shelves and espresso machine.
  box(scene, [.72, .95, 2.7], [15.10, .49, 10.1], 0xb5b9ae, .025);
  box(scene, [.80, .05, 2.8], [15.10, .995, 10.1], palette.paper, .015);
  box(scene, [3.6, .95, .72], [12.9, .49, 11.15], 0xb5b9ae, .025);
  box(scene, [3.7, .05, .80], [12.9, .995, 11.15], palette.paper, .015);
  for (const x of [11.55, 12.45, 13.35, 14.2]) box(scene, [.025, .65, .025], [x, .50, 11.52], 0x868e86);
  for (const x of [11.8, 12.65, 13.5]) box(scene, [.27, .02, .025], [x, .81, 11.53], palette.frame);
  box(scene, [.65, .025, .44], [13.7, 1.03, 11.1], 0x6e7b7c, .045);
  cylinder(scene, .018, .27, [13.7, 1.16, 10.85], palette.metal);
  box(scene, [.018, .018, .16], [13.7, 1.28, 10.92], palette.metal);
  box(scene, [.75, 1.9, .72], [15.1, .96, 8.1], 0x63736e, .04);
  box(scene, [.025, .62, .025], [14.7, 1.22, 8.1], palette.metal);
  box(scene, [.45, .5, .38], [11.55, 1.25, 11.1], palette.frame, .025);
  box(scene, [.30, .20, .27], [11.55, 1.12, 11.23], palette.metal, .02);
  mug(scene, 11.57, 1.03, 11.31, 0xf0d5ac);
  for (const x of [12.15, 12.4]) mug(scene, x, 1.025, 11.1);
  box(scene, [.16, .01, .16], [12.9, 1.03, 11.0], 0xbbac93);
  // Island with stools, away from the route into the kitchen.
  box(scene, [1.7, .08, .75], [12.35, 1.05, 8.55], palette.oak, .05);
  box(scene, [1.45, .95, .45], [12.35, .52, 8.55], 0x67786c, .02);
  for (const x of [11.9, 12.8]) {
    cylinder(scene, .21, .055, [x, .72, 7.75], palette.oak);
    cylinder(scene, .027, .69, [x, .36, 7.75], palette.frame);
    cylinder(scene, .22, .025, [x, .04, 7.75], palette.frame);
  }
  plant(scene, 14.2, 11.1, .37, 1.025);
  pendant(scene, 13.2, 2.7, 2);
  pendant(scene, 12.35, 8.55, 1.3);
  pendant(scene, 3.2, 3.5, 2.4);
  pendant(scene, 7.7, 3.5, 2.4);
  // Indoor planters and a low entry bench articulate the open central circulation.
  for (const x of [1, 5.0, 10.45]) plant(scene, x, .52, 1);
  box(scene, [1.7, .11, .46], [8.3, .47, 11.5], palette.oak, .035);
  for (const x of [7.65, 8.95]) box(scene, [.06, .43, .34], [x, .23, 11.5], palette.frame);
}
