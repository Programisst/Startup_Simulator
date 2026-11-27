import { createRoom, monitorPoint } from '../../../src/ui/isometric/raster';
import { layout } from './motion';
import atlasUrl from './coworking-art.png';
export { makeWorker, type Worker } from '../../../src/ui/isometric/raster';
export const loadRoom = (canvas: HTMLCanvasElement, details: HTMLCanvasElement) =>
  createRoom(canvas, details, layout, atlasUrl);
export const monitorCenter = (seat: number) => monitorPoint(layout, seat);
