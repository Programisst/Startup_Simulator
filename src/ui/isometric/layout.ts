import homeArt from './founder-home-art.json';
import coworkingArt from './coworking-art.json';
import smallOfficeArt from './small-office-art.json';
import type { Point, RoomArt } from './raster';
import type { IsometricOfficeId } from './state';

interface ActionSpot {
  target: Point;
  surface: Point;
  height: number;
}

export type HomeAction = 'window' | 'lamp' | 'boxes';

interface OfficeLayout {
  art: RoomArt;
  loadAtlas: () => Promise<{ default: string }>;
  spawn: Point;
  coffee: ActionSpot;
  rest: ActionSpot;
  breakPoints: Point[];
  home?: { pillow: Point & { height: number }; extras: Record<HomeAction, ActionSpot> };
}

export const officeLayouts: Record<IsometricOfficeId, OfficeLayout> = {
  home: {
    art: homeArt,
    loadAtlas: () => import('./founder-home-art.png?inline'),
    spawn: homeArt.spawn,
    coffee: homeArt.coffee,
    rest: homeArt.rest,
    breakPoints: [],
    home: { pillow: homeArt.pillow, extras: homeArt.extras },
  },
  coworking: {
    art: coworkingArt,
    loadAtlas: () => import('./coworking-art.png?inline'),
    spawn: { x: 114, y: 174 },
    coffee: { target: { x: 34, y: 93 }, surface: { x: 17, y: 91 }, height: 24 },
    rest: { target: { x: 32, y: 142 }, surface: { x: 16, y: 146 }, height: 12 },
    breakPoints: [{ x: 32, y: 142 }],
  },
  smallOffice: {
    art: smallOfficeArt,
    loadAtlas: () => import('./small-office-art.png?inline'),
    spawn: smallOfficeArt.spawn,
    coffee: smallOfficeArt.coffee,
    rest: smallOfficeArt.rest,
    breakPoints: smallOfficeArt.breakPoints,
  },
};
