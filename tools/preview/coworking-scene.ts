import { content } from '../../src/content';
import { createGame, sceneTeam, teamOf, type Employee, type SceneTeam } from '../../src/core';

// Одна партия для всех вариантов. Пропуски в seat показывают свободные места в обоих рядах.
const game = createGame({
  seed: 42,
  companyName: 'Pulse',
  productType: 'saas',
  audienceId: 'smallBusiness',
  businessModel: 'subscription',
  goal: 'sandbox',
  difficulty: 'normal',
}, content);

const worker = (id: number, seat: number, details: Partial<Employee>): Employee => ({
  id,
  seat,
  nameSeed: id - 1,
  role: 'developer',
  skill: 1,
  trait: 'calm',
  driver: 'money',
  salary: 2400,
  salaryAsk: 2400,
  motivation: 65,
  hiredDay: 35,
  ...details,
});

const team: SceneTeam = sceneTeam({
  ...game,
  day: 70,
  office: 'coworking',
  launched: true,
  launchDay: 45,
  doneFeatures: ['core'],
  tasks: [{ kind: 'polish', progress: 0 }],
  cash: 5600,
  rush: true,
  team: {
    ...teamOf(game, content),
    employees: [
      worker(1, 0, { motivation: 88, star: true }),
      worker(2, 2, {}),
      worker(3, 3, { motivation: 28, salary: 1250, trait: 'diligent' }),
      worker(4, 5, { role: 'marketer', motivation: 78 }),
    ],
  },
}, content);

process.stdout.write(JSON.stringify(team));
