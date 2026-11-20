// Охота за звёздами: сильного человека из чужой компании можно переманить — с шансом и с риском ответного удара.
import { describe, expect, it } from 'vitest';
import {
  applyCommand,
  headhuntChance,
  headhuntView,
  marketingBoost,
  starAura,
  starNow,
  starOfWindow,
  teamOf,
  teamView,
  teamWorkPerDay,
  tick,
  type Employee,
  type GameContent,
  type GameState,
  type HeadhuntOfferId,
  type StarDef,
} from '../src/core';
import { content } from '../src/content';
import { deepFreeze, launchedGame, newGame, run } from './helpers';

const cfg = content.config;
const h = cfg.headhunt;
/** Без случайных событий: остаётся только то, что вызывает сама охота. */
const quiet: GameContent = { ...content, events: content.events.filter((e) => e.id === h.retaliationEvent).map((e) => ({ ...e, weight: 0 })), milestones: [] };
const offerDef = (id: HeadhuntOfferId) => h.offers.find((o) => o.id === id)!;

/** Доход за 30 дней, которого хватает, чтобы компанию заметили. */
const noticed = (s: GameState): GameState => ({
  ...s,
  recentDays: Array.from({ length: 30 }, (_, i) => ({ day: s.day - 30 + i, cash: s.cash, users: s.users, paying: s.paying, revenue: 1000, expenses: 0 })),
});

/** Запущенная компания с деньгами и офисом, в первый день периода: звезда на месте. */
const live = (over: Partial<GameState> = {}): GameState => {
  const base = launchedGame();
  const day = Math.ceil(base.day / h.periodDays) * h.periodDays;
  return noticed({ ...base, day, cash: 1e6, office: 'office', energy: 100, reputation: 50, rush: false, modifiers: [], ...over });
};

const mate = (id: number, over: Partial<Employee> = {}): Employee => ({
  id,
  role: 'developer',
  skill: 1,
  trait: 'calm',
  salaryAsk: 2400,
  nameSeed: id,
  driver: 'money',
  salary: 2400,
  hiredDay: 0,
  motivation: 70,
  seat: id,
  ...over,
});
const withTeam = (s: GameState, employees: Employee[]): GameState => ({ ...s, team: { ...teamOf(s, content), employees, nextId: 100 } });

const offer = (s: GameState, id: HeadhuntOfferId): GameState => run(s, { type: 'headhunt', offer: id });
/** Подменяет шанс уже сделанного предложения: так исход не зависит от удачи. */
const sure = (s: GameState, chance: number): GameState => ({ ...s, headhunt: { ...s.headhunt!, pending: { ...s.headhunt!.pending!, chance } } });
const days = (s: GameState, n: number, c: GameContent = quiet): GameState => {
  let x = s;
  for (let i = 0; i < n; i++) x = tick(noticed(x), c);
  return x;
};
const star = (s: GameState): StarDef => starNow(s, cfg)!;

describe('звезда', () => {
  it('зависит только от партии и периода; заметно сильнее обычных кандидатов и не бывает небрежной', () => {
    for (let w = 0; w < 40; w++) {
      const a = starOfWindow(7, w, cfg);
      expect(starOfWindow(7, w, cfg)).toEqual(a);
      expect(a.skill).toBeGreaterThanOrEqual(h.skillMin);
      expect(a.skill).toBeLessThanOrEqual(h.skillMax);
      expect(a.skill).toBeGreaterThan(cfg.team.skillMax);
      expect(a.trait).not.toBe('sloppy');
      expect(a.companySeed).toBeLessThan(h.companies);
    }
    const roles = new Set(Array.from({ length: 40 }, (_, w) => starOfWindow(7, w, cfg).role));
    expect(roles.size).toBe(2);
    expect(starOfWindow(7, 3, cfg)).not.toEqual(starOfWindow(8, 3, cfg));
  });

  it('появляется в начале периода и ждёт предложения ограниченное время', () => {
    const s = live();
    expect(headhuntView(s, content).star).toMatchObject({ daysLeft: h.visibleDays, auraPct: Math.round(h.aura * 100) });
    expect(headhuntView({ ...s, day: s.day + h.visibleDays - 1 }, content).star).not.toBeNull();
    const gone = headhuntView({ ...s, day: s.day + h.visibleDays }, content);
    expect(gone).toMatchObject({ star: null, blocked: 'waiting', nextInDays: h.periodDays - h.visibleDays });
    expect(starNow({ ...s, day: s.day + h.periodDays }, cfg)).not.toEqual(star(s));
  });

  it('пока компания никому не известна, звёзд нет', () => {
    const unknown = { ...live(), recentDays: [] };
    expect(headhuntView(unknown, content)).toMatchObject({ unlocked: false, star: null, blocked: 'locked', nextInDays: null });
    expect(headhuntView({ ...newGame(), cash: 1e6 }, content).unlocked).toBe(false);
    expect(applyCommand(unknown, { type: 'headhunt', offer: 'lavish' }, content)).toEqual({ ok: false, error: 'headhuntUnavailable' });
  });
});

describe('предложение', () => {
  it('три предложения: щедрее — выше шанс, дороже и обиднее коллегам', () => {
    const s = withTeam(live(), [mate(1), mate(2), mate(3, { role: 'marketer' })]);
    const [modest, generous, lavish] = headhuntView(s, content).star!.offers;
    expect(modest!.chancePct).toBeLessThan(generous!.chancePct);
    expect(generous!.chancePct).toBeLessThan(lavish!.chancePct);
    expect(modest!.salary).toBeLessThan(generous!.salary);
    expect(generous!.salary).toBeLessThan(lavish!.salary);
    expect(modest).toMatchObject({ bonus: 0, jealousCount: 0, underpaid: true });
    expect(lavish).toMatchObject({ bonus: lavish!.salary * offerDef('lavish').bonusMonths, underpaid: false });
    // Обидно только коллегам той же роли.
    const sameRole = s.team!.employees.filter((e) => e.role === star(s).role).length;
    expect(lavish!.jealousCount).toBe(sameRole);
  });

  it('шанс зависит от того, что человеком движет', () => {
    const s = live();
    const of = (driver: StarDef['driver'], state: GameState, id: HeadhuntOfferId = 'generous') => headhuntChance(state, { ...star(s), driver }, offerDef(id), content);
    const base = offerDef('generous').chance;
    // Спокойному не нравится спешка.
    expect(of('peace', s)).toBeCloseTo(base + h.fitGood, 6);
    expect(of('peace', { ...s, rush: true })).toBeCloseTo(base - h.fitBad, 6);
    // Идейный смотрит на репутацию; она же немного помогает со всеми.
    expect(of('mission', { ...s, reputation: 90 })).toBeGreaterThan(of('mission', { ...s, reputation: 20 }) + 0.3);
    expect(of('peace', { ...s, reputation: 90 })).toBeGreaterThan(of('peace', s));
    // Тому, кто за деньги, важен размер предложения.
    expect(of('money', s, 'lavish')).toBeCloseTo(offerDef('lavish').chance + h.fitGood, 6);
    expect(of('money', s, 'modest')).toBeCloseTo(Math.max(h.chanceMin, offerDef('modest').chance - h.fitBad), 6);
    // Тому, кому важны люди, — настроение команды.
    const happy = withTeam(s, [mate(1, { motivation: 90 }), mate(2, { motivation: 90 })]);
    const gloomy = withTeam(s, [mate(1, { motivation: 30 }), mate(2, { motivation: 30 })]);
    expect(of('people', happy)).toBeGreaterThan(of('people', gloomy));
    // Тому, кому важен рост, — растёт ли число пользователей.
    const month = (users: number) => ({ month: 0, revenue: 0, expenses: 0, profit: 0, sideIncome: 0, users, paying: 0, cash: 0 });
    expect(of('growth', { ...s, months: [month(100), month(200)] })).toBeGreaterThan(of('growth', { ...s, months: [month(200), month(200)] }));
    // Шанс никогда не бывает ни нулевым, ни верным.
    expect(of('mission', { ...s, reputation: 100 }, 'lavish')).toBeLessThanOrEqual(h.chanceMax);
    expect(of('mission', { ...s, reputation: 0 }, 'modest')).toBeGreaterThanOrEqual(h.chanceMin);
  });

  it('стоит сил; одной звезде — одно предложение; шанс фиксируется в день предложения', () => {
    const s = live();
    const shown = headhuntView(s, content).star!.offers.find((o) => o.id === 'generous')!;
    const after = offer(s, 'generous');
    expect(after.energy).toBe(100 - h.energyCost);
    expect(after.cash).toBe(s.cash);
    expect(headhuntView(after, content)).toMatchObject({ star: null, blocked: 'pending', pending: { offer: 'generous', chancePct: shown.chancePct, daysLeft: h.answerDays, salary: shown.salary } });
    expect(applyCommand(after, { type: 'headhunt', offer: 'lavish' }, content).ok).toBe(false);
    // Спешка после предложения шанс уже не меняет.
    expect(headhuntView({ ...after, rush: true, reputation: 0 }, content).pending!.chancePct).toBe(shown.chancePct);
  });

  it('нельзя без места, без сил, без денег на разовую выплату и с выдуманным предложением', () => {
    const full = withTeam(live({ office: 'home' }), [mate(1), mate(2), mate(3)]);
    expect(headhuntView(full, content).blocked).toBe('teamFull');
    expect(applyCommand(full, { type: 'headhunt', offer: 'modest' }, content).ok).toBe(false);
    expect(headhuntView(live({ energy: h.energyCost - 1 }), content).blocked).toBe('energy');
    // Доход скромный: компанию уже заметили, но зарплату звезды он не покрывает.
    const base = live({ cash: 10 });
    const poor = { ...base, recentDays: base.recentDays.map((d) => ({ ...d, revenue: 100 })) };
    const offers = headhuntView(poor, content).star!.offers;
    expect(offers.map((o) => o.blocked)).toEqual([null, 'cash', 'cash']);
    expect(offers[0]!.risky).toBe(true);
    expect(applyCommand(poor, { type: 'headhunt', offer: 'lavish' }, content).ok).toBe(false);
    expect(applyCommand(live(), { type: 'headhunt', offer: 'царское' as HeadhuntOfferId }, content).ok).toBe(false);
  });
});

describe('ответ', () => {
  it('согласие: звезда в команде с обещанной зарплатой, разовая выплата списана, в ленте новость', () => {
    const s = live();
    const target = star(s);
    const pending = sure(offer(s, 'lavish'), 1);
    const before = days(pending, h.answerDays - 1);
    expect(before.headhunt!.pending).not.toBeNull();
    const done = days(pending, h.answerDays);
    const joined = done.team!.employees.find((e) => e.star)!;
    const terms = pending.headhunt!.pending!;
    expect(joined).toMatchObject({ role: target.role, skill: target.skill, nameSeed: target.nameSeed, salary: terms.salary, aura: h.aura, motivation: cfg.team.startMotivation });
    expect(joined.salaryAsk).toBeLessThan(joined.salary);
    expect(done.headhunt).toMatchObject({ pending: null, joined: 1, last: { outcome: 'joined', nameSeed: target.nameSeed } });
    expect((done.news ?? []).find((n) => n.kind === 'headhunt')).toMatchObject({ id: 'joined', tone: 'good', value: target.nameSeed });
    expect(done.team!.log.at(-1)).toMatchObject({ kind: 'hired', employeeId: joined.id });
    const noOffer = days(s, h.answerDays);
    expect(noOffer.cash - done.cash).toBeGreaterThan(terms.bonus - 1);
    expect(headhuntView(done, content)).toMatchObject({ stars: 1, star: null });
  });

  it('отказ: никто не пришёл, деньги целы, вторая попытка — только со следующей звездой', () => {
    const s = live();
    const done = days(sure(offer(s, 'modest'), 0), h.answerDays);
    expect(done.team!.employees).toHaveLength(0);
    expect(done.headhunt).toMatchObject({ pending: null, joined: 0, last: { outcome: 'declined' } });
    expect((done.news ?? []).find((n) => n.kind === 'headhunt')).toMatchObject({ id: 'declined', tone: 'bad' });
    expect(headhuntView(done, content)).toMatchObject({ star: null, blocked: 'waiting' });
    expect(headhuntView(days(done, h.periodDays - h.answerDays), content).star).not.toBeNull();
  });

  it('скромно оплаченная звезда недовольна, щедро оплаченная — довольна', () => {
    const mood = (id: HeadhuntOfferId) => teamView(days(sure(offer(live(), id), 1), h.answerDays), content).members.find((m) => m.star)!;
    expect(mood('modest').motivationTarget).toBeLessThan(mood('generous').motivationTarget);
    expect(mood('modest').salary).toBeLessThan(mood('modest').salaryAsk);
  });

  it('очень щедрое предложение обижает коллег той же роли; скромное — нет', () => {
    const base = live();
    const role = star(base).role;
    const s = withTeam(base, [mate(1, { role }), mate(2, { role: role === 'developer' ? 'marketer' : 'developer' })]);
    const quietDays = days(s, h.answerDays).team!.employees;
    const lavish = days(sure(offer(s, 'lavish'), 1), h.answerDays).team!.employees;
    const modest = days(sure(offer(s, 'modest'), 1), h.answerDays).team!.employees;
    expect(lavish[0]!.motivation).toBeCloseTo(quietDays[0]!.motivation - offerDef('lavish').jealousy, 6);
    expect(lavish[1]!.motivation).toBeCloseTo(quietDays[1]!.motivation, 6);
    expect(modest[0]!.motivation).toBeCloseTo(quietDays[0]!.motivation, 6);
  });

  it('согласие случается примерно с обещанной частотой', () => {
    let joined = 0;
    let chance = 0;
    const games = 300;
    for (let seed = 1; seed <= games; seed++) {
      const pending = offer({ ...live(), seed }, 'generous');
      chance += pending.headhunt!.pending!.chance;
      if (days(pending, h.answerDays).headhunt!.last!.outcome === 'joined') joined += 1;
    }
    expect(Math.abs(joined / games - chance / games)).toBeLessThan(0.08);
  });
});

describe('звезда в команде', () => {
  const starDev = mate(9, { skill: 2.4, star: true, aura: h.aura });

  it('разработчик-звезда ускоряет коллег, но не себя; в большой команде это заметно', () => {
    const crowd = Array.from({ length: 20 }, (_, i) => mate(i + 1));
    const plain = teamWorkPerDay({ ...teamOf(live(), content), employees: crowd }, cfg.team);
    const withStar = teamWorkPerDay({ ...teamOf(live(), content), employees: [...crowd, starDev] }, cfg.team);
    expect(withStar).toBeCloseTo(plain * (1 + h.aura) + 2.4, 6);
    expect(withStar / plain).toBeGreaterThan(1.25);
    expect(teamWorkPerDay({ ...teamOf(live(), content), employees: [starDev] }, cfg.team)).toBeCloseTo(2.4, 6);
  });

  it('прибавка от нескольких звёзд складывается до потолка', () => {
    const stars = Array.from({ length: 6 }, (_, i) => mate(50 + i, { skill: 2.4, star: true, aura: h.aura }));
    const team = { ...teamOf(live(), content), employees: stars };
    expect(starAura(team, 'developer', cfg.team)).toBe(cfg.team.starAuraCap);
    expect(starAura(team, 'marketer', cfg.team)).toBe(0);
  });

  it('маркетолог-звезда поднимает потолок притока от маркетинга', () => {
    const crowd = Array.from({ length: 20 }, (_, i) => mate(i + 1, { role: 'marketer' }));
    const plain = marketingBoost({ ...teamOf(live(), content), employees: crowd }, cfg.team);
    const withStar = marketingBoost({ ...teamOf(live(), content), employees: [...crowd, mate(9, { role: 'marketer', skill: 2.4, star: true, aura: h.aura })] }, cfg.team);
    expect(plain).toBeCloseTo(1 + cfg.team.marketingCap, 6);
    expect(withStar).toBeCloseTo(1 + cfg.team.marketingCap * (1 + h.aura), 6);
  });

  it('команда без звёзд работает точно как раньше', () => {
    const crowd = [mate(1, { skill: 0.7 }), mate(2, { skill: 1.3, trait: 'diligent' }), mate(3, { role: 'marketer' })];
    const team = { ...teamOf(live(), content), employees: crowd };
    expect(teamWorkPerDay(team, cfg.team)).toBe(0.7 + 1.3 * (1 + cfg.team.diligentBonus));
    expect(marketingBoost(team, cfg.team)).toBe(1 + cfg.team.marketingPerPoint);
  });
});

describe('ответный удар', () => {
  /** Перебирает партии, пока не найдёт ту, где после перехода чужая компания обиделась (или не обиделась). */
  const find = (retaliation: boolean): GameState => {
    for (let seed = 1; seed < 200; seed++) {
      const s = withTeam({ ...live(), seed }, [mate(1, { skill: 1.5 }), mate(2, { skill: 0.8 })]);
      const done = days(sure(offer(s, 'generous'), 1), h.answerDays);
      if (done.headhunt!.last!.retaliation === retaliation) return done;
    }
    throw new Error('не нашлось подходящей партии');
  };

  it('чужая компания зовёт к себе самого сильного из ваших — приходит событие с выбором', () => {
    const done = find(true);
    expect(done.pendingEvent).toBe(h.retaliationEvent);
    expect(done.pendingSubject).toBe(1);
    expect(done.eventLog.at(-1)).toMatchObject({ eventId: h.retaliationEvent, choiceId: null, subjectNameSeed: 1 });
    expect(done.headhunt!.raid).toBeUndefined();
    // Встречное предложение удерживает человека, но стоит прибавки.
    const kept = run(done, { type: 'chooseEvent', choiceId: 'counter' });
    expect(kept.team!.employees.find((e) => e.id === 1)!.salary).toBeGreaterThan(2400);
    const lost = run(done, { type: 'chooseEvent', choiceId: 'letGo' });
    expect(lost.team!.employees.some((e) => e.id === 1)).toBe(false);
    expect(lost.team!.employees.some((e) => e.star)).toBe(true);
  });

  it('без обиды событие не приходит', () => {
    const done = find(false);
    expect(done.pendingEvent).toBeNull();
  });

  it('случается примерно с обещанной частотой: после перехода чаще, чем после отказа', () => {
    const rate = (chance: number) => {
      let hits = 0;
      for (let seed = 1; seed <= 300; seed++) {
        const s = withTeam({ ...live(), seed }, [mate(1)]);
        if (days(sure(offer(s, 'generous'), chance), h.answerDays).headhunt!.last!.retaliation) hits += 1;
      }
      return hits / 300;
    };
    expect(Math.abs(rate(1) - h.retaliationOnJoin)).toBeLessThan(0.08);
    expect(Math.abs(rate(0) - h.retaliationOnDecline)).toBeLessThan(0.08);
  });

  it('если прийти не за кем, удара нет', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const done = days(sure(offer({ ...live(), seed }, 'generous'), 1), h.answerDays);
      expect(done.pendingEvent).toBeNull();
      expect(done.headhunt!.last!.retaliation).toBe(false);
      expect(done.headhunt!.raid).toBeUndefined();
    }
  });
});

describe('надёжность', () => {
  it('партия без предложений идёт точно как раньше, поле в сохранении не появляется', () => {
    const s = days(live(), 60);
    expect(s.headhunt).toBeUndefined();
    expect('headhunt' in tick(live(), quiet)).toBe(false);
  });

  it('отказ не сдвигает случайность партии', () => {
    const s = withTeam(live(), [mate(1)]);
    const plain = days(s, 10);
    for (let seed = 1; seed <= 40; seed++) {
      const declined = days(sure(offer({ ...s, seed }, 'modest'), 0), 10);
      if (declined.headhunt!.last!.retaliation) continue;
      expect(declined.rng).toBe(days({ ...s, seed }, 10).rng);
    }
    expect(plain.headhunt).toBeUndefined();
  });

  it('старое сохранение открывается; сводка и предложение не меняют исходное состояние', () => {
    const old = live();
    delete old.headhunt;
    expect(headhuntView(old, content)).toMatchObject({ pending: null, last: null, joined: 0, stars: 0 });
    const frozen = deepFreeze(live());
    headhuntView(frozen, content);
    offer(frozen, 'generous');
    // Человек из старого сохранения — без отметки звезды: сцена получает false, а не пустоту.
    expect(mate(1).star).toBeUndefined();
  });
});
