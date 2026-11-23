// Герой садится за стол и встаёт, ложится спать и встаёт — плавно, по пикселю, а не скачком.
import { describe, expect, it } from 'vitest';
import { HERO_FRAME_H, HERO_FRAME_W, HERO_PALETTE, heroFrames } from '../src/ui/apartment/engine/heroPixels';
import { MOVE_SECONDS, SLEEP_BLANKET, moveStep, type MoveKind, type MoveStep } from '../src/ui/apartment/engine/moves';
import { PROPS, SEAT, SPOTS } from '../src/ui/apartment/engine/scene';

const DESK = SPOTS.find((s) => s.id === 'computer')!;
const BED = SPOTS.find((s) => s.id === 'bed')!;
const CHAIR = PROPS.find((p) => p.key === 'chair')!;

/** Кадры движения через каждые 10 мс, пока оно не кончится. */
function run(kind: MoveKind): MoveStep[] {
  const out: MoveStep[] = [];
  for (let t = 0; ; t += 0.01) {
    const s = moveStep(kind, t);
    if (!s) return out;
    out.push(s);
    if (out.length > 1000) throw new Error('движение не кончается');
  }
}

/** Последовательность поз без повторов подряд. */
const poses = (steps: MoveStep[]) => steps.map((s) => s.pose).filter((p, i, a) => i === 0 || a[i - 1] !== p);

/** Плавно: за 10 мс ничто не сдвигается больше чем на пиксель (место — в пределах одной позы). */
function expectSmooth(steps: MoveStep[]) {
  for (let i = 1; i < steps.length; i++) {
    const a = steps[i - 1]!;
    const b = steps[i]!;
    const keys = a.pose === b.pose ? (['x', 'y', 'lift', 'chair', 'blanket'] as const) : (['chair', 'blanket'] as const);
    for (const k of keys) expect(Math.abs(b[k] - a[k]), `${k} на шаге ${i}`).toBeLessThanOrEqual(1);
  }
}

/** Верх головы на экране: так видно, что герой не прыгает, когда кадр «опускается» сменяется на «сидит». */
const headTop = (s: MoveStep) => (s.pose === 'sit' ? s.y + s.chair - 4 : s.y + s.lift);

describe('садится за стол и встаёт', () => {
  it('садится: кресло отъезжает → заходит к столу → поворачивается → опускается → подъезжает с креслом', () => {
    expect(poses(run('sit'))).toEqual(['stand', 'walk', 'stand', 'lower', 'sit']);
  });

  it('встаёт: отъезжает с креслом → поднимается → выходит к месту у стола', () => {
    expect(poses(run('stand'))).toEqual(['sit', 'lower', 'stand', 'walk']);
  });

  it('начинает и заканчивает там, где стоит у стола и где сидит', () => {
    const sit = run('sit');
    expect(sit[0]).toMatchObject({ x: DESK.at.x, y: DESK.at.y, chair: 0 });
    expect(sit[sit.length - 1]).toMatchObject({ x: SEAT.x, y: SEAT.y, pose: 'sit' });
    const stand = run('stand');
    expect(stand[0]).toMatchObject({ x: SEAT.x, y: SEAT.y, chair: 0 });
    const last = stand[stand.length - 1]!;
    expect(last.pose).toBe('walk');
    expect(Math.abs(last.x - DESK.at.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(last.y - DESK.at.y)).toBeLessThanOrEqual(1);
  });

  it('кресло отъезжает недалеко и к концу посадки стоит на месте', () => {
    const sit = run('sit');
    expect(Math.max(...sit.map((s) => s.chair))).toBeGreaterThanOrEqual(4);
    expect(Math.max(...sit.map((s) => s.chair))).toBeLessThanOrEqual(6);
    expect(sit[sit.length - 1]!.chair).toBeLessThanOrEqual(1);
  });

  it('плавно: ни герой, ни кресло не прыгают', () => {
    expectSmooth(run('sit'));
    expectSmooth(run('stand'));
  });

  it('голова не прыгает, когда герой опустился и кадр сменился на «сидит»', () => {
    for (const kind of ['sit', 'stand'] as const) {
      const steps = run(kind);
      for (let i = 1; i < steps.length; i++) {
        const a = steps[i - 1]!;
        const b = steps[i]!;
        if (new Set([a.pose, b.pose]).has('sit') && new Set([a.pose, b.pose]).has('lower'))
          expect(Math.abs(headTop(b) - headTop(a)), kind).toBeLessThanOrEqual(1);
      }
    }
  });

  it('место у стола — сбоку от кресла, не внутри мебели', () => {
    expect(DESK.at.x + 8).toBeLessThanOrEqual(CHAIR.x);
    for (const p of PROPS) {
      const r = p.solid;
      if (!r) continue;
      const inside = DESK.at.x > r.x - 4 && DESK.at.x < r.x + r.w + 4 && DESK.at.y > r.y - 2 && DESK.at.y < r.y + r.h + 2;
      expect(inside, p.key).toBe(false);
    }
  });

  it('не дольше секунды', () => {
    expect(MOVE_SECONDS.sit).toBeLessThan(1.1);
    expect(MOVE_SECONDS.stand).toBeLessThan(0.9);
  });
});

describe('ложится спать и встаёт', () => {
  it('спит укрытым по грудь: видны голова и плечи, а не одна голова', () => {
    expect(SLEEP_BLANKET).toBeGreaterThanOrEqual(4);
    expect(SLEEP_BLANKET).toBeLessThan(heroFrames().sleepBody.length);
  });

  it('ложится: садится на край кровати → лёг, одеяло плавно натягивается от пояса до груди', () => {
    const steps = run('lie');
    expect(poses(steps)).toEqual(['edge', 'bed']);
    const blanket = steps.filter((s) => s.pose === 'bed').map((s) => s.blanket);
    expect(blanket[0]).toBeGreaterThanOrEqual(SLEEP_BLANKET + 4);
    expect(Math.abs(blanket[blanket.length - 1]! - SLEEP_BLANKET)).toBeLessThanOrEqual(1);
    for (let i = 1; i < blanket.length; i++) expect(blanket[i]).toBeLessThanOrEqual(blanket[i - 1]!);
    expectSmooth(steps.filter((s) => s.pose === 'bed'));
  });

  it('встаёт: откидывает одеяло → садится на край; потом стоит у кровати', () => {
    const steps = run('rise');
    expect(poses(steps)).toEqual(['bed', 'edge']);
    const blanket = steps.filter((s) => s.pose === 'bed').map((s) => s.blanket);
    expect(blanket[0]).toBe(SLEEP_BLANKET);
    for (let i = 1; i < blanket.length; i++) expect(blanket[i]).toBeGreaterThanOrEqual(blanket[i - 1]!);
    expectSmooth(steps.filter((s) => s.pose === 'bed'));
  });

  it('край кровати — между кроватью и местом, где герой стоит', () => {
    const edge = run('lie').find((s) => s.pose === 'edge')!;
    expect(edge.x).toBeLessThan(BED.at.x);
    expect(edge.x).toBeGreaterThan(BED.pick.x + BED.pick.w / 2);
  });

  it('успевает лечь до затемнения (1,1 с)', () => {
    expect(MOVE_SECONDS.lie).toBeLessThan(1.1);
  });

  it('встаёт, когда уже посветлело: первые 0,3 с лежит неподвижно, всё — меньше чем за 1,2 с', () => {
    const still = run('rise').slice(0, 30);
    for (const s of still) expect(s).toMatchObject({ pose: 'bed', blanket: SLEEP_BLANKET });
    expect(MOVE_SECONDS.rise).toBeLessThan(1.2);
  });
});

describe('новые кадры героя', () => {
  const f = heroFrames();
  const valid = (frame: string[]) => {
    expect(frame).toHaveLength(HERO_FRAME_H);
    for (const row of frame) {
      expect(row).toHaveLength(HERO_FRAME_W);
      for (const ch of row) if (ch !== '.') expect(HERO_PALETTE[ch], `буква «${ch}»`).toBeDefined();
    }
  };
  const top = (frame: string[]) => frame.findIndex((row) => /[^.]/.test(row));

  it('сидит на краю кровати — кадр 16×32 из палитры', () => {
    valid(f.edge);
  });

  it('на краю кровати сидит в профиль: один глаз, ступни на нижней строке, кисть на колене', () => {
    expect(f.edge.join('').split('').filter((ch) => ch === 'e')).toHaveLength(2);
    expect(f.edge[HERO_FRAME_H - 1]!.replace(/\./g, '').length).toBeGreaterThan(0);
    expect(top(f.edge)).toBeGreaterThan(top(f.idle[0]![0]!));
    expect(f.edge.slice(24).join('')).toMatch(/s/);
  });

  it('лёжа: туловище в джемпере с руками по бокам, без тёмных палок внутри', () => {
    const body = f.sleepBody;
    for (const row of body) for (const ch of row) if (ch !== '.') expect(HERO_PALETTE[ch]).toBeDefined();
    expect(body.join('')).toMatch(/w/);
    // плечи скруглены, а ниже тёмный контур только снаружи: в строке не больше двух тёмных точек
    for (const row of body.slice(3)) expect(row.split('').filter((ch) => ch === 'o').length).toBeLessThanOrEqual(2);
  });
});
