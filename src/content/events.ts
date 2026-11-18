// События с выбором. Здесь — условия и последствия в цифрах.
// Тексты для игрока лежат в src/content/<язык>/events.json под тем же id.
import type { EventDef } from '../core/types';

export const events: EventDef[] = [
  {
    id: 'badReview',
    weight: 10,
    cooldownDays: 120,
    condition: { launched: true, minUsers: 300, maxQuality: 55 },
    choices: [
      { id: 'fixQuietly', effects: [{ type: 'scandal', amount: 6 }, { type: 'bugs', amount: -3 }] },
      {
        id: 'respondPublicly',
        effects: [
          { type: 'reputation', amount: -3 },
          { type: 'chance', probability: 0.3, then: [{ type: 'usersPct', pct: 8 }], otherwise: [{ type: 'scandal', amount: 8 }] },
        ],
      },
      { id: 'offerPartnership', effects: [{ type: 'cash', amount: -500 }, { type: 'reputation', amount: 4 }] },
    ],
  },
  {
    id: 'serverOutage',
    weight: 14,
    cooldownDays: 60,
    condition: { launched: true, overloaded: true, minUsers: 100 },
    choices: [
      { id: 'compensate', effects: [{ type: 'cash', amount: -400 }, { type: 'reputation', amount: 2 }] },
      { id: 'ignore', effects: [{ type: 'scandal', amount: 10 }, { type: 'usersPct', pct: -5 }] },
      {
        id: 'blameProvider',
        effects: [{ type: 'chance', probability: 0.5, then: [], otherwise: [{ type: 'scandal', amount: 15 }] }],
      },
    ],
  },
  {
    id: 'viralPost',
    weight: 8,
    cooldownDays: 150,
    condition: { launched: true, minUsers: 100, minQuality: 50 },
    choices: [
      { id: 'rideTheWave', effects: [{ type: 'modifier', target: 'acquisition', factor: 1.3, days: 14 }] },
      {
        id: 'payForBoost',
        effects: [{ type: 'cash', amount: -300 }, { type: 'modifier', target: 'acquisition', factor: 1.8, days: 14 }],
      },
      {
        id: 'rushFeature',
        effects: [{ type: 'debt', amount: 10 }, { type: 'modifier', target: 'acquisition', factor: 1.6, days: 14 }],
      },
    ],
  },
  {
    id: 'adPriceHike',
    weight: 8,
    cooldownDays: 180,
    condition: { launched: true, minDay: 60 },
    choices: [
      { id: 'accept', effects: [{ type: 'modifier', target: 'acquisition', factor: 0.8, days: 30 }] },
      {
        id: 'switchChannel',
        effects: [
          { type: 'cash', amount: -400 },
          {
            type: 'chance',
            probability: 0.5,
            then: [{ type: 'modifier', target: 'acquisition', factor: 1.2, days: 30 }],
            otherwise: [{ type: 'modifier', target: 'acquisition', factor: 0.7, days: 30 }],
          },
        ],
      },
      {
        id: 'contentMarketing',
        effects: [{ type: 'reputation', amount: 3 }, { type: 'modifier', target: 'acquisition', factor: 0.85, days: 30 }],
      },
    ],
  },
  {
    id: 'cashCrisis',
    weight: 1,
    cooldownDays: 90,
    urgent: true,
    condition: { cashNegative: true },
    choices: [
      { id: 'takeLoan', effects: [{ type: 'loan', amount: 5000, repayFactor: 1.4, days: 180 }] },
      { id: 'sellEquipment', effects: [{ type: 'cash', amount: 1500 }] },
      { id: 'holdOn', effects: [] },
    ],
  },
];
