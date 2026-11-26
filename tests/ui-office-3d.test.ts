import { describe, expect, it } from 'vitest';
import { content } from '../src/content';
import { officeTeam, desks, routes, isWalkable } from '../tools/preview/office-3d/layout';

describe('офис smallOffice в 3D-образце', () => {
  it('вмещает весь этап и сохраняет свободные места', () => {
    expect(desks).toHaveLength(content.config.offices.find(o => o.id === 'smallOffice')!.seats);
    const seats = officeTeam.people.map(p => p.seat);
    expect(new Set(seats).size).toBe(8);
    expect(officeTeam.freeSeats).toEqual(desks.map((_, i) => i).filter(i => !seats.includes(i)));
  });

  it('маршруты всех сотрудников обходят мебель', () => {
    for (const person of officeTeam.people) {
      const path = routes.get(person.seat)!;
      expect(path.length).toBeGreaterThan(1);
      for (let i = 1; i < path.length; i++) {
        const from = path[i - 1]!;
        const to = path[i]!;
        const count = Math.ceil(Math.hypot(to.x - from.x, to.z - from.z) / .03);
        for (let n = 0; n <= count; n++) {
          expect(isWalkable({ x: from.x + (to.x - from.x) * n / count, z: from.z + (to.z - from.z) * n / count })).toBe(true);
        }
      }
    }
  });
});
