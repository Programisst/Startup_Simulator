import { content } from '../../../src/content';
import { createGame, sceneTeam, teamOf, type Employee } from '../../../src/core';
import { findPath, type FloorPoint, type Box } from '../../../src/ui/apartment/engine/nav';

export const room = { width: 16, depth: 12 };
export const desks = [2.5, 5.5, 8.5].flatMap(x =>
  [2.0, 5.0].flatMap(z => [{ x, z, angle: 0 }, { x: x + 1.55, z, angle: 0 }]));
export const deskSize = { width: 1.42, depth: .76 };
export const meeting = { x: 11, z: .5, width: 4.5, depth: 5.2 };
export const kitchen = { x: 11.1, z: 8.8, width: 4.4, depth: 2.8 };
export const lounge = { x: .7, z: 8.3, width: 5.1, depth: 3 };

const game = createGame({
  seed: 42, companyName: 'Pulse', productType: 'saas', audienceId: 'smallBusiness',
  businessModel: 'subscription', goal: 'sandbox', difficulty: 'normal',
}, content);

const occupied = [0, 1, 2, 4, 5, 7, 9, 11];
const employees: Employee[] = occupied.map((seat, i) => ({
  id: i + 1, nameSeed: i, seat, role: i === 5 ? 'marketer' : 'developer',
  skill: 1, trait: 'calm', driver: 'money', salary: 2400, salaryAsk: 2400,
  hiredDay: 35, motivation: [85, 68, 80, 59, 78, 65, 70, 83][i]!, star: i === 0,
}));
export const officeTeam = sceneTeam({
  ...game, office: 'smallOffice', day: 80, cash: 35000, launched: true, launchDay: 50,
  doneFeatures: ['core'], tasks: [{ kind: 'polish', progress: 0 }],
  team: { ...teamOf(game, content), employees },
}, content);

const obstacles: Box[] = [
  ...desks.flatMap(({ x, z }) => [
    { x: x - .71, y: z - .38, w: 1.42, h: .76 },
    { x: x - .33, y: z + .52, w: .66, h: .65 },
  ]),
  { x: meeting.x - .08, y: .5, w: .16, h: 5.15 },
  { x: meeting.x, y: 5.62, w: 2.6, h: .16 },
  { x: 14.7, y: 5.62, w: .8, h: .16 },
  { x: 12.1, y: 2.0, w: 2.4, h: 1.2 },
  { x: lounge.x, y: 9.8, w: 3.8, h: 1.1 },
  { x: 2.5, y: 8.5, w: 1.4, h: .7 },
  { x: 14.65, y: 8.8, w: .85, h: 2.8 },
  { x: 11.1, y: 10.8, w: 3.55, h: .8 },
];
const walk = { x: .4, y: .5, w: 15.2, h: 11.1 };
const foot = .34;

export function isWalkable(p: FloorPoint): boolean {
  return p.x > walk.x && p.x < walk.x + walk.w && p.z > walk.y && p.z < walk.y + walk.h &&
    obstacles.every(b => p.x + foot / 2 <= b.x || p.x - foot / 2 >= b.x + b.w ||
      p.z + foot / 2 <= b.y || p.z - foot / 2 >= b.y + b.h);
}

export function homeOf(seat: number): FloorPoint {
  const desk = desks[seat]!;
  return { x: desk.x, z: desk.z + .8 };
}

export const routes = new Map(occupied.map(seat => {
  const desk = desks[seat]!;
  const entry = { x: desk.x - .62, z: desk.z + 1.6 };
  const target = { x: 7.1, z: 9.5 };
  const result = findPath(entry, target, obstacles, walk, foot);
  if (!result) throw new Error('No route from office seat ' + seat);
  return [seat, [entry, ...result]] as const;
}));
