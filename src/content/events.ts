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
    cooldownDays: 360,
    urgent: true,
    condition: { cashNegative: true },
    choices: [
      { id: 'takeLoan', effects: [{ type: 'loan', amount: 5000, repayFactor: 1.4, days: 180 }] },
      { id: 'sellEquipment', effects: [{ type: 'cash', amount: 1500 }] },
      { id: 'holdOn', effects: [] },
    ],
  },

  // ---------- Продукт и рынок ----------
  {
    id: 'criticalBug',
    weight: 10,
    cooldownDays: 90,
    condition: { launched: true, minBugs: 8 },
    choices: [
      { id: 'hotfix', effects: [{ type: 'bugs', amount: -4 }, { type: 'debt', amount: 6 }] },
      { id: 'properFix', effects: [{ type: 'cash', amount: -300 }, { type: 'bugs', amount: -6 }] },
      { id: 'ignore', effects: [{ type: 'scandal', amount: 4 }, { type: 'modifier', target: 'churn', factor: 1.25, days: 20 }] },
    ],
  },
  {
    id: 'competitorClone',
    weight: 7,
    cooldownDays: 240,
    condition: { launched: true, minUsers: 800, minDay: 120 },
    choices: [
      { id: 'focusProduct', effects: [{ type: 'reputation', amount: 2 }, { type: 'modifier', target: 'churn', factor: 1.1, days: 20 }] },
      { id: 'adWar', effects: [{ type: 'cash', amount: -500 }, { type: 'modifier', target: 'acquisition', factor: 1.25, days: 20 }] },
      { id: 'rushFeatures', effects: [{ type: 'debt', amount: 10 }, { type: 'modifier', target: 'churn', factor: 0.92, days: 30 }] },
    ],
  },
  {
    id: 'bigClient',
    weight: 8,
    cooldownDays: 150,
    condition: { launched: true, minUsers: 200, minQuality: 35 },
    choices: [
      { id: 'politeNo', effects: [{ type: 'reputation', amount: 2 }] },
      { id: 'customWork', effects: [{ type: 'cash', amount: 1500 }, { type: 'debt', amount: 10 }, { type: 'bugs', amount: 2 }] },
      {
        id: 'bargain',
        effects: [
          { type: 'chance', probability: 0.5, then: [{ type: 'cash', amount: 2500 }, { type: 'debt', amount: 10 }], otherwise: [{ type: 'reputation', amount: -2 }] },
        ],
      },
    ],
  },
  {
    id: 'pressMention',
    weight: 6,
    cooldownDays: 200,
    condition: { launched: true, minQuality: 55, minDay: 60 },
    choices: [
      { id: 'interview', effects: [{ type: 'reputation', amount: 5 }] },
      { id: 'promote', effects: [{ type: 'cash', amount: -250 }, { type: 'modifier', target: 'acquisition', factor: 1.5, days: 14 }] },
      { id: 'skip', effects: [] },
    ],
  },
  {
    id: 'hostingBill',
    weight: 6,
    cooldownDays: 240,
    condition: { launched: true, minUsers: 500 },
    choices: [
      { id: 'pay', effects: [{ type: 'cash', amount: -250 }] },
      { id: 'migrate', effects: [{ type: 'debt', amount: 8 }, { type: 'bugs', amount: 2 }] },
      { id: 'negotiate', effects: [{ type: 'chance', probability: 0.4, then: [], otherwise: [{ type: 'cash', amount: -350 }] }] },
    ],
  },
  {
    id: 'angelOffer',
    weight: 5,
    cooldownDays: 360,
    once: true,
    condition: { launched: true, minUsers: 1000, minDay: 150 },
    choices: [
      { id: 'askAdvice', effects: [{ type: 'reputation', amount: 3 }] },
      { id: 'takeMoney', effects: [{ type: 'loan', amount: 8000, repayFactor: 1.25, days: 360 }] },
      { id: 'decline', effects: [] },
    ],
  },
  {
    id: 'paymentFreeze',
    weight: 6,
    cooldownDays: 240,
    condition: { launched: true, minCash: 300, minUsers: 300 },
    choices: [
      { id: 'wait', effects: [{ type: 'chance', probability: 0.5, then: [], otherwise: [{ type: 'cash', amount: -500 }] }] },
      { id: 'switchProvider', effects: [{ type: 'cash', amount: -250 }, { type: 'debt', amount: 3 }] },
      { id: 'tellUsers', effects: [{ type: 'cash', amount: -150 }, { type: 'reputation', amount: 2 }] },
    ],
  },
  {
    id: 'founderBurnout',
    weight: 9,
    cooldownDays: 150,
    condition: { minDay: 90, rush: true },
    choices: [
      { id: 'restWeekend', effects: [{ type: 'cash', amount: -150 }, { type: 'debt', amount: -3 }] },
      { id: 'pushThrough', effects: [{ type: 'bugs', amount: 5 }, { type: 'debt', amount: 6 }] },
      { id: 'moreCoffee', effects: [{ type: 'chance', probability: 0.5, then: [], otherwise: [{ type: 'bugs', amount: 4 }] }] },
    ],
  },
  {
    id: 'sideGig',
    weight: 8,
    cooldownDays: 150,
    condition: { maxCash: 1500, minDay: 30 },
    choices: [
      { id: 'refuse', effects: [] },
      { id: 'take', effects: [{ type: 'cash', amount: 900 }, { type: 'debt', amount: 4 }] },
      {
        id: 'bargain',
        effects: [{ type: 'chance', probability: 0.5, then: [{ type: 'cash', amount: 1600 }, { type: 'debt', amount: 6 }], otherwise: [] }],
      },
    ],
  },
  {
    id: 'userFeedback',
    weight: 8,
    cooldownDays: 120,
    condition: { launched: true, minUsers: 150, maxQuality: 50 },
    choices: [
      { id: 'listen', effects: [{ type: 'bugs', amount: -2 }, { type: 'reputation', amount: 3 }] },
      { id: 'survey', effects: [{ type: 'cash', amount: -150 }, { type: 'reputation', amount: 5 }] },
      { id: 'ignore', effects: [{ type: 'modifier', target: 'churn', factor: 1.1, days: 20 }] },
    ],
  },
  {
    id: 'licenseClaim',
    weight: 5,
    cooldownDays: 300,
    condition: { launched: true, minDebt: 30 },
    choices: [
      { id: 'pay', effects: [{ type: 'cash', amount: -300 }] },
      { id: 'rewrite', effects: [{ type: 'debt', amount: -10 }, { type: 'bugs', amount: 3 }] },
      {
        id: 'ignore',
        effects: [{ type: 'chance', probability: 0.5, then: [], otherwise: [{ type: 'cash', amount: -900 }, { type: 'scandal', amount: 5 }] }],
      },
    ],
  },
  {
    id: 'conference',
    weight: 5,
    cooldownDays: 300,
    condition: { launched: true, minDay: 150, minCash: 800 },
    choices: [
      { id: 'skip', effects: [] },
      { id: 'go', effects: [{ type: 'cash', amount: -600 }, { type: 'reputation', amount: 6 }, { type: 'modifier', target: 'acquisition', factor: 1.2, days: 20 }] },
      { id: 'online', effects: [{ type: 'cash', amount: -100 }, { type: 'reputation', amount: 2 }] },
    ],
  },
  {
    id: 'dataScare',
    weight: 5,
    cooldownDays: 360,
    condition: { launched: true, minUsers: 2000, minDebt: 40 },
    choices: [
      { id: 'disclose', effects: [{ type: 'scandal', amount: 6 }, { type: 'reputation', amount: 3 }] },
      { id: 'audit', effects: [{ type: 'cash', amount: -800 }, { type: 'debt', amount: -8 }, { type: 'reputation', amount: 2 }] },
      {
        id: 'hush',
        effects: [{ type: 'chance', probability: 0.5, then: [], otherwise: [{ type: 'scandal', amount: 18 }, { type: 'usersPct', pct: -6 }] }],
      },
    ],
  },
  {
    id: 'featureWave',
    weight: 6,
    cooldownDays: 180,
    condition: { launched: true, minUsers: 500, minQuality: 40 },
    choices: [
      { id: 'promise', effects: [{ type: 'reputation', amount: 2 }, { type: 'modifier', target: 'churn', factor: 0.95, days: 20 }] },
      { id: 'quickHack', effects: [{ type: 'debt', amount: 8 }, { type: 'modifier', target: 'churn', factor: 0.9, days: 30 }] },
      { id: 'sayNo', effects: [{ type: 'reputation', amount: -2 }] },
    ],
  },

  // ---------- Люди ----------
  {
    id: 'raiseRequest',
    weight: 10,
    cooldownDays: 120,
    condition: { minTeam: 1, subject: { pick: 'lowestMotivation', minDaysHired: 60 } },
    choices: [
      { id: 'give', effects: [{ type: 'subjectRaise', pct: 0.15 }, { type: 'subjectMotivation', amount: 12 }] },
      {
        id: 'promise',
        effects: [
          { type: 'chance', probability: 0.5, then: [{ type: 'subjectMotivation', amount: 5 }], otherwise: [{ type: 'subjectMotivation', amount: -15 }] },
        ],
      },
      { id: 'refuse', effects: [{ type: 'subjectMotivation', amount: -18 }] },
    ],
  },
  {
    id: 'poaching',
    weight: 7,
    cooldownDays: 200,
    condition: { minTeam: 1, minDay: 120, subject: { pick: 'highestSkill', minSkill: 0.9, minDaysHired: 45 } },
    choices: [
      {
        id: 'talk',
        effects: [{ type: 'chance', probability: 0.6, then: [{ type: 'subjectMotivation', amount: 6 }], otherwise: [{ type: 'subjectLeaves' }] }],
      },
      { id: 'counter', effects: [{ type: 'subjectRaise', pct: 0.25 }, { type: 'subjectMotivation', amount: 8 }] },
      { id: 'letGo', effects: [{ type: 'subjectLeaves' }] },
    ],
  },
  {
    id: 'teamConflict',
    weight: 8,
    cooldownDays: 150,
    condition: { minTeam: 2, subject: { pick: 'lowestMotivation' } },
    choices: [
      { id: 'mediate', effects: [{ type: 'teamMotivation', amount: 4 }] },
      { id: 'takeSide', effects: [{ type: 'teamMotivation', amount: -6 }, { type: 'subjectMotivation', amount: 14 }] },
      { id: 'ignore', effects: [{ type: 'teamMotivation', amount: -10 }] },
    ],
  },
  {
    id: 'employeeBurnout',
    weight: 10,
    cooldownDays: 120,
    condition: { minTeam: 1, rush: true, subject: { pick: 'lowestMotivation', maxMotivation: 60 } },
    choices: [
      { id: 'dayOff', effects: [{ type: 'subjectMotivation', amount: 20 }] },
      { id: 'bonus', effects: [{ type: 'cash', amount: -400 }, { type: 'subjectMotivation', amount: 12 }] },
      {
        id: 'ignore',
        effects: [{ type: 'chance', probability: 0.35, then: [{ type: 'subjectLeaves' }], otherwise: [{ type: 'subjectMotivation', amount: -10 }] }],
      },
    ],
  },
  {
    id: 'teamParty',
    weight: 6,
    cooldownDays: 200,
    condition: { minTeam: 2, minCash: 400 },
    choices: [
      { id: 'pizza', effects: [{ type: 'cash', amount: -50 }, { type: 'teamMotivation', amount: 3 }] },
      { id: 'party', effects: [{ type: 'cash', amount: -250 }, { type: 'teamMotivation', amount: 8 }] },
      { id: 'skip', effects: [{ type: 'teamMotivation', amount: -2 }] },
    ],
  },
  {
    id: 'brilliantIdea',
    weight: 6,
    cooldownDays: 200,
    condition: { minTeam: 1, launched: true, subject: { pick: 'highestSkill', role: 'developer' } },
    choices: [
      { id: 'letBuild', effects: [{ type: 'debt', amount: -8 }, { type: 'subjectMotivation', amount: 8 }] },
      { id: 'later', effects: [{ type: 'subjectMotivation', amount: -6 }] },
      {
        id: 'weekend',
        effects: [
          { type: 'chance', probability: 0.5, then: [{ type: 'debt', amount: -6 }, { type: 'subjectMotivation', amount: 10 }], otherwise: [{ type: 'bugs', amount: 3 }] },
        ],
      },
    ],
  },
  {
    id: 'prodMistake',
    weight: 8,
    cooldownDays: 150,
    condition: { minTeam: 1, launched: true, subject: { pick: 'newest', role: 'developer' } },
    choices: [
      { id: 'helpFix', effects: [{ type: 'bugs', amount: 2 }, { type: 'subjectMotivation', amount: 4 }] },
      { id: 'scold', effects: [{ type: 'bugs', amount: 5 }, { type: 'subjectMotivation', amount: -15 }, { type: 'teamMotivation', amount: -3 }] },
      { id: 'addReview', effects: [{ type: 'cash', amount: -100 }, { type: 'bugs', amount: 3 }, { type: 'debt', amount: -5 }] },
    ],
  },
  {
    id: 'courseRequest',
    weight: 6,
    cooldownDays: 200,
    condition: { minTeam: 1, minCash: 500, subject: { pick: 'newest', minDaysHired: 30 } },
    choices: [
      { id: 'half', effects: [{ type: 'cash', amount: -175 }, { type: 'subjectSkill', amount: 0.05 }, { type: 'subjectMotivation', amount: 2 }] },
      { id: 'pay', effects: [{ type: 'cash', amount: -350 }, { type: 'subjectSkill', amount: 0.1 }, { type: 'subjectMotivation', amount: 6 }] },
      { id: 'refuse', effects: [{ type: 'subjectMotivation', amount: -6 }] },
    ],
  },
  {
    id: 'remoteRequest',
    weight: 6,
    cooldownDays: 250,
    condition: { minTeam: 1, subject: { pick: 'lowestMotivation', minDaysHired: 30 } },
    choices: [
      { id: 'trial', effects: [{ type: 'subjectMotivation', amount: 4 }] },
      {
        id: 'allow',
        effects: [{ type: 'subjectMotivation', amount: 10 }, { type: 'chance', probability: 0.3, then: [{ type: 'bugs', amount: 2 }], otherwise: [] }],
      },
      { id: 'refuse', effects: [{ type: 'subjectMotivation', amount: -8 }] },
    ],
  },
  {
    id: 'salaryDelay',
    weight: 12,
    cooldownDays: 90,
    condition: { minTeam: 1, cashNegative: true },
    choices: [
      { id: 'honest', effects: [{ type: 'teamMotivation', amount: -8 }] },
      { id: 'hide', effects: [{ type: 'chance', probability: 0.5, then: [], otherwise: [{ type: 'teamMotivation', amount: -25 }] }] },
      { id: 'ownMoney', effects: [{ type: 'loan', amount: 2000, repayFactor: 1.2, days: 180 }, { type: 'teamMotivation', amount: 3 }] },
    ],
  },
];
