import { describe, expect, it } from 'vitest';
import { coworkingTeam } from '../tools/preview/coworking-scene';
import { layout, motionFor, pathIsClear, poseAt, type WalkPlan } from '../tools/preview/coworking/motion';

describe('движение сотрудников в образце коворкинга', () => {
  it('рисует все места офиса, включая свободные', () => {
    expect(layout.desks).toHaveLength(coworkingTeam.office.seats);
    expect(coworkingTeam.freeSeats).toEqual([1, 4]);
  });

  it('маршрут от дальнего места меняет направление, чтобы обойти столы', () => {
    expect(motionFor(5).path.length).toBeGreaterThan(2);
  });

  it.each(coworkingTeam.people)('сотрудник места $seat обходит мебель и возвращается домой', (person) => {
    const plan: WalkPlan = motionFor(person.seat);
    expect(plan.path.length).toBeGreaterThanOrEqual(2);
    expect(pathIsClear(plan.path)).toBe(true);
    const atDesk = poseAt(plan, 0);
    expect(atDesk.kind).toBe('sit');
    expect(poseAt(plan, plan.start + 0.3).chair).toBeGreaterThan(atDesk.chair);
    const walking = poseAt(plan, plan.start + 1.0);
    expect(walking.kind).toBe('walk');
    expect(walking.at).not.toEqual(atDesk.at);
    expect(poseAt(plan, plan.end + 0.1)).toEqual(atDesk);
  });
});
