import { OfficeMotion, OfficeNavigation } from '../src/ui/isometric/movement';
import { officeLayouts } from '../src/ui/isometric/layout';
import { monitorPoint, type Point } from '../src/ui/isometric/raster';
import { describe, expect, it } from 'vitest';
import { content } from '../src/content';
import { sceneTeam, type Employee } from '../src/core';
import { newGame } from './helpers';
import { sceneForOffice, peopleForScene } from '../src/ui/isometric/state';

const coworking = officeLayouts.coworking;
const founderSeat = coworking.art.desks.length - 1;
const nav = new OfficeNavigation(coworking.art);
const coffeePoint = coworking.coffee.target;

const employee = (id: number, seat: number): Employee => ({
  id, seat, nameSeed: id, role: 'developer', skill: 1, salary: 2400, salaryAsk: 2400,
  hiredDay: 0, motivation: 80, trait: 'calm', driver: 'money', star: id === 1,
});
describe('коворкинг в настоящей партии', () => {
  it('выбирает изометрическую квартиру до переезда и соответствующий офис после него', () => {
    expect(sceneForOffice('home')).toBe('home');
    expect(sceneForOffice('coworking')).toBe('coworking');
    expect(sceneForOffice('smallOffice')).toBe('smallOffice');
    expect(sceneForOffice('office')).toBe('apartment');
    expect(sceneForOffice('floor')).toBe('apartment');
  });
  it('в квартире сохраняет игровой состав, а на сцене оставляет только основателя', () => {
    const game = { ...newGame(), office: 'home' };
    const person = employee(15, 0);
    const view = sceneTeam({ ...game, team: { ...game.team!, employees: [person] } }, content);
    expect(view.people.map(p => p.id)).toEqual([15]);
    expect([...peopleForScene(view, 0).values()]).toEqual([]);
  });
  it('отдельное место основателя добавляется к шести местам сотрудников', () => {
    expect(coworking.art.desks).toHaveLength(content.config.offices.find(o => o.id === 'coworking')!.seats + 1);
  });
  it('перестановка состава и увольнение не пересаживают оставшихся', () => {
    const game = { ...newGame(), office: 'coworking' };
    const a = employee(1, 0), b = employee(2, 4);
    const view = (employees: Employee[]) => sceneTeam({ ...game, team: { ...game.team!, employees } }, content);
    expect([...peopleForScene(view([b, a]))].map(([seat, p]) => [seat, p.id, p.star])).toEqual([[0, 1, true], [4, 2, false]]);
    expect([...peopleForScene(view([b]))].map(([seat, p]) => [seat, p.id])).toEqual([[4, 2]]);
    expect(peopleForScene(view([])).size).toBe(0);
  });
});

describe('небольшой офис в настоящей партии', () => {
  it('показывает все места до 11 и оставляет их за сотрудниками после увольнения', () => {
    const game = { ...newGame(), office: 'smallOffice' };
    const employees = Array.from({ length: 12 }, (_, seat) => employee(seat + 1, seat));
    const view = (people: Employee[]) => sceneTeam({ ...game, team: { ...game.team!, employees: people } }, content);
    expect([...peopleForScene(view([...employees].reverse())).keys()]).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    const withoutNeighbor = peopleForScene(view(employees.filter(e => e.seat !== 8)));
    expect(withoutNeighbor.has(8)).toBe(false);
    expect(withoutNeighbor.get(9)?.id).toBe(10);
    expect(withoutNeighbor.get(11)?.nameSeed).toBe(12);
  });

  it('вмещает 13 видимых мониторов и даёт добраться из прохода до каждого кресла', () => {
    const { art, spawn } = officeLayouts.smallOffice;
    const officeNav = new OfficeNavigation(art);
    expect(art.desks).toHaveLength(13);
    expect(new Set(art.desks.map(desk => desk.join(','))).size).toBe(13);
    for (let seat = 0; seat <= 12; seat++) {
      const monitor = monitorPoint(art, seat);
      expect(monitor.x).toBeGreaterThan(15);
      expect(monitor.x).toBeLessThan(art.width - 15);
      expect(monitor.y).toBeGreaterThan(12);
      expect(monitor.y).toBeLessThan(art.height - 12);
      const entry = officeNav.entryPoint(seat);
      const path = officeNav.route(spawn, entry);
      expect(path.at(-1), 'вход к креслу ' + seat).toEqual(entry);
    }
  });

  it('идёт через проёмы к кофе, отдыху и местам прогулок', () => {
    const { art, spawn, coffee, rest, breakPoints } = officeLayouts.smallOffice;
    const officeNav = new OfficeNavigation(art);
    function expectClearRoute(from: Point, to: Point) {
      const route = officeNav.route(from, to);
      expect(route.at(-1), JSON.stringify(to)).toEqual(to);
      for (const [i, end] of route.entries()) {
        const start = i ? route[i - 1]! : from;
        const samples = Math.max(1, Math.ceil(Math.hypot(end.x - start.x, end.y - start.y)));
        for (let step = 0; step <= samples; step++) {
          const x = start.x + (end.x - start.x) * step / samples;
          const y = start.y + (end.y - start.y) * step / samples;
          const overlapsFurniture = art.fixedObstacles.some(([x0, x1, y0, y1]) =>
            x > x0! - 2.5 && x < x1! + 2.5 && y > y0! - 2.5 && y < y1! + 2.5);
          if (overlapsFurniture) throw new Error('Маршрут пересекает препятствие у ' + x + ', ' + y);
        }
      }
    }
    expectClearRoute(spawn, coffee.target);
    expectClearRoute(coffee.target, rest.target);
    breakPoints.forEach((to, seat) => {
      const entry = officeNav.entryPoint(seat);
      expectClearRoute(entry, to);
      expectClearRoute(to, entry);
    });
  });
});

describe('основатель в коворкинге', () => {
  it('доходит до своего компьютера, садится, встаёт и идёт к кофе', () => {
    const motion = new OfficeMotion(nav, founderSeat, coworking.spawn);
    const initial = motion.pose.at;
    motion.go(nav.entryPoint(founderSeat), 'computer');
    let arrived: string | null = null;
    for (let i = 0; i < 500 && arrived !== 'computer'; i++) arrived = motion.step(.025);
    expect(arrived).toBe('computer');
    expect(motion.pose.kind).toBe('sit');
    expect(motion.pose.at).not.toEqual(initial);
    motion.go(coffeePoint, 'coffee');
    for (let i = 0; i < 1000 && arrived !== 'coffee'; i++) arrived = motion.step(.025);
    expect(arrived).toBe('coffee');
    expect(motion.pose.kind).toBe('stand');
  });
  it('нулевое время сохраняет позу и маршрут', () => {
    const motion = new OfficeMotion(nav, founderSeat, coworking.spawn);
    motion.go(coffeePoint, 'coffee');
    const before = structuredClone(motion.pose);
    expect(motion.step(0)).toBeNull();
    expect(motion.pose).toEqual(before);
    expect(motion.moving).toBe(true);
    expect(nav.route(before.at, coffeePoint).length).toBeGreaterThan(0);
  });
  it('смена цели во время посадки не переносит героя в кресло', () => {
    const motion = new OfficeMotion(nav, founderSeat, coworking.spawn);
    const entry = nav.entryPoint(founderSeat);
    motion.go(entry, 'computer');
    for (let i = 0; i < 600; i++) {
      motion.step(.025);
      if (motion.pose.kind === 'stand' && motion.pose.at.x === entry.x && motion.pose.at.y === entry.y) break;
    }
    expect(motion.pose.at).toEqual(entry);
    motion.step(.1);
    const before = motion.pose.at;
    motion.go(coffeePoint, 'coffee');
    motion.step(.025);
    expect(Math.hypot(motion.pose.at.x - before.x, motion.pose.at.y - before.y)).toBeLessThan(2);
  });
});

describe('стартовая квартира', () => {
  it('есть один стол и свободные подходы к нему, кровати, кухне и предметам', () => {
    const home = officeLayouts.home;
    const navigation = new OfficeNavigation(home.art);
    expect(home.art.desks).toHaveLength(1);
    const entry = navigation.entryPoint(0);
    for (const target of [entry, home.coffee.target, home.rest.target, ...Object.values(home.home!.extras).map(p => p.target)]) {
      expect(navigation.canWalk(target)).toBe(true);
      const fromStart = navigation.route(home.spawn, target);
      expect(fromStart.at(-1)).toEqual(target);
      expect(navigation.route(entry, target).at(-1)).toEqual(target);
    }
  });

  it('клавиатурой можно встать из кресла, а после остановки герой остаётся на месте', () => {
    const home = officeLayouts.home;
    const navigation = new OfficeNavigation(home.art);
    const founder = new OfficeMotion(navigation, 0);
    for (let i = 0; i < 80; i++) founder.steer(0, 1, .025);
    expect(founder.pose.kind).toBe('walk');
    expect(navigation.canWalk(founder.pose.at)).toBe(true);
    founder.stopSteering();
    const restingAt = founder.pose.at;
    founder.step(.25);
    expect(founder.pose).toMatchObject({ kind: 'stand', at: restingAt });
  });
});
