export type IsometricOfficeId = 'home' | 'coworking' | 'smallOffice';

export function sceneForOffice(id: string): 'apartment' | IsometricOfficeId {
  return id === 'home' || id === 'coworking' || id === 'smallOffice' ? id : 'apartment';
}

export function peopleForScene<T extends { seat: number }>(team: { office: { seats: number }; people: T[] }, capacity = team.office.seats): Map<number, T> {
  return new Map([...team.people].sort((a, b) => a.seat - b.seat)
    .filter(p => p.seat >= 0 && p.seat < capacity).map(p => [p.seat, p]));
}
