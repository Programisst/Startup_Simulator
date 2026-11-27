import { FounderMotion, entryPoint, coffeePoint, route } from '../src/ui/isometric/movement';
import { describe, expect, it } from 'vitest';
import { content } from '../src/content';
import { sceneTeam, type Employee } from '../src/core';
import { newGame } from './helpers';
import { sceneForOffice, peopleForScene, teamSeats, founderSeat } from '../src/ui/isometric/state';

const employee = (id: number, seat: number): Employee => ({
  id, seat, nameSeed: id, role: 'developer', skill: 1, salary: 2400, salaryAsk: 2400,
  hiredDay: 0, motivation: 80, trait: 'calm', driver: 'money', star: id === 1,
});
describe('коворкинг в настоящей партии', () => {
  it('выбирается после переезда, квартира доступна в начале', () => {
    expect(sceneForOffice('home')).toBe('apartment');
    expect(sceneForOffice('coworking')).toBe('coworking');
    expect(sceneForOffice('smallOffice')).toBe('apartment');
  });
  it('отдельное место основателя добавляется к шести местам сотрудников', () => {
    expect(teamSeats).toBe(content.config.offices.find(o => o.id === 'coworking')!.seats);
    expect(founderSeat).toBe(teamSeats);
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

describe('основатель в коворкинге', () => {
  it('доходит до своего компьютера, садится, встаёт и идёт к кофе', () => {
    const motion = new FounderMotion();
    const initial = motion.pose.at;
    motion.go(entryPoint(founderSeat), 'computer');
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
    const motion = new FounderMotion();
    motion.go(coffeePoint, 'coffee');
    const before = structuredClone(motion.pose);
    expect(motion.step(0)).toBeNull();
    expect(motion.pose).toEqual(before);
    expect(motion.moving).toBe(true);
    expect(route(before.at, coffeePoint).length).toBeGreaterThan(0);
  });
});
