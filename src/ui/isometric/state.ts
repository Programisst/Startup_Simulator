import art from './coworking-art.json';

export const teamSeats = art.desks.length - 1;
export const founderSeat = teamSeats;
export function sceneForOffice(id: string): 'apartment' | 'coworking' {
  return id === 'coworking' ? 'coworking' : 'apartment';
}
export function peopleForScene<T extends { seat: number }>(team: { people: T[] }): Map<number, T> {
  return new Map([...team.people].sort((a, b) => a.seat - b.seat).filter(p => p.seat >= 0 && p.seat < teamSeats).map(p => [p.seat, p]));
}
