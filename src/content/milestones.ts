// Цели на пути компании: по порядку, от первой строчки кода до большой компании.
// Порядок — это порядок показа: цель засчитывается, когда выполнена, даже если более ранняя ещё не пройдена.
// Названия и подсказки для игрока лежат в переводах под ключом goalsLadder.items.<id>.
// Награды намеренно небольшие: это призы и известность, а не способ выжить. Большие деньги приносят инвесторы.
import type { ChapterDef, MilestoneDef } from '../core/types';

export const milestones: MilestoneDef[] = [
  { id: 'coreBuilt', condition: { minFeatures: 1 }, effects: [{ type: 'reputation', amount: 1 }], progress: { metric: 'features', target: 1 } },
  { id: 'launched', condition: { launched: true }, effects: [{ type: 'reputation', amount: 1 }] },
  { id: 'users10', condition: { minUsers: 10 }, effects: [{ type: 'reputation', amount: 1 }], progress: { metric: 'users', target: 10 } },
  { id: 'users100', condition: { minUsers: 100 }, effects: [{ type: 'cash', amount: 100 }], progress: { metric: 'users', target: 100 } },
  { id: 'revenue100', condition: { minRevenue30: 100 }, effects: [{ type: 'reputation', amount: 1 }], progress: { metric: 'revenue30', target: 100 } },
  { id: 'features3', condition: { minFeatures: 3 }, effects: [{ type: 'reputation', amount: 1 }], progress: { metric: 'features', target: 3 } },
  { id: 'users500', condition: { minUsers: 500 }, effects: [{ type: 'cash', amount: 100 }], progress: { metric: 'users', target: 500 } },
  { id: 'revenue1000', condition: { minRevenue30: 1000 }, effects: [{ type: 'reputation', amount: 3 }], progress: { metric: 'revenue30', target: 1000 } },
  { id: 'profitMonth', condition: { minMonthProfit: 1 }, effects: [{ type: 'cash', amount: 300 }, { type: 'reputation', amount: 1 }] },
  { id: 'firstHire', condition: { minTeam: 1 }, effects: [{ type: 'reputation', amount: 1 }], progress: { metric: 'team', target: 1 } },
  { id: 'users2000', condition: { minUsers: 2000 }, effects: [{ type: 'cash', amount: 500 }], progress: { metric: 'users', target: 2000 } },
  { id: 'team3', condition: { minTeam: 3 }, effects: [{ type: 'reputation', amount: 2 }], progress: { metric: 'team', target: 3 } },
  { id: 'officeCoworking', condition: { minOffice: 1 }, effects: [{ type: 'reputation', amount: 3 }] },
  { id: 'revenue5000', condition: { minRevenue30: 5000 }, effects: [{ type: 'reputation', amount: 4 }], progress: { metric: 'revenue30', target: 5000 } },
  // Засчитывается, когда игрок сам позвал инвестора на переговоры или предложение пришло само.
  // Соглашаться не обязательно. Раньше цель ждала только случайного события — и могла не закрыться месяцами.
  { id: 'investorOffer', condition: { investorContact: { events: ['angelOffer', 'seedRound', 'seriesA'] } }, effects: [{ type: 'reputation', amount: 2 }] },
  { id: 'team6', condition: { minTeam: 6 }, effects: [{ type: 'reputation', amount: 2 }], progress: { metric: 'team', target: 6 } },
  { id: 'users10000', condition: { minUsers: 10_000 }, effects: [{ type: 'cash', amount: 1500 }], progress: { metric: 'users', target: 10_000 } },
  { id: 'officeSmall', condition: { minOffice: 2 }, effects: [{ type: 'reputation', amount: 4 }] },
  { id: 'revenue20000', condition: { minRevenue30: 20_000 }, effects: [{ type: 'reputation', amount: 5 }], progress: { metric: 'revenue30', target: 20_000 } },
  { id: 'team12', condition: { minTeam: 12 }, effects: [{ type: 'reputation', amount: 3 }], progress: { metric: 'team', target: 12 } },
  { id: 'officeBig', condition: { minOffice: 3 }, effects: [{ type: 'reputation', amount: 5 }] },
  { id: 'revenue100000', condition: { minRevenue30: 100_000 }, effects: [{ type: 'reputation', amount: 6 }], progress: { metric: 'revenue30', target: 100_000 } },
  { id: 'officeFloor', condition: { minOffice: 4 }, effects: [{ type: 'reputation', amount: 6 }] },
  { id: 'users250000', condition: { minUsers: 250_000 }, effects: [{ type: 'reputation', amount: 8 }], progress: { metric: 'users', target: 250_000 } },
];

/** Шесть глав пути: от гаража до единорога. Главы идут подряд и вместе покрывают все цели. */
export const chapters: ChapterDef[] = [
  { id: 'garage', milestones: ['coreBuilt', 'launched', 'users10', 'users100'] },
  { id: 'firstClients', milestones: ['revenue100', 'features3', 'users500', 'revenue1000'] },
  { id: 'team', milestones: ['profitMonth', 'firstHire', 'users2000', 'team3'] },
  { id: 'investor', milestones: ['officeCoworking', 'revenue5000', 'investorOffer', 'team6'] },
  { id: 'office', milestones: ['users10000', 'officeSmall', 'revenue20000', 'team12'] },
  { id: 'unicorn', milestones: ['officeBig', 'revenue100000', 'officeFloor', 'users250000'] },
];
