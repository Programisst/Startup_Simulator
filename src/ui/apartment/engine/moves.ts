// Переходы героя между «стоит», «сидит за столом» и «спит» — плавно, по пикселю, а не скачком.
// Чистые данные и расчёт без браузера — проверяются тестами (tests/ui-hero-moves.test.ts).
import { SEAT, SPOTS, type Dir } from './scene';

export type MoveKind = 'sit' | 'stand' | 'lie' | 'rise';

/**
 * Какой кадр рисовать:
 * stand — стоит (кадр стойки своего направления), walk — идёт,
 * lower — спиной к нам опускается в кресло (кадр стойки, ниже на lift),
 * sit — сидит в кресле, edge — сидит на краю кровати в профиль,
 * bed — лежит (голова на подушке, одеяло ниже на blanket).
 */
export type MovePose = 'stand' | 'walk' | 'lower' | 'sit' | 'edge' | 'bed';

export interface MoveStep {
  pose: MovePose;
  /** Где ступни героя (как hero.x/hero.y). Для sit — место в кресле без сдвига кресла. */
  x: number;
  y: number;
  dir: Dir;
  /** На сколько пикселей герой ниже обычного (опускается в кресло). */
  lift: number;
  /** На сколько пикселей кресло отъехало от стола (к нам). */
  chair: number;
  /** На сколько пикселей одеяло ниже подбородка (у спящего — SLEEP_BLANKET, по грудь). */
  blanket: number;
}

type P = { x: number; y: number };

interface Seg {
  dur: number;
  pose: MovePose;
  dir: Dir;
  from: P;
  to?: P;
  lift?: [number, number];
  chair?: [number, number];
  blanket?: [number, number];
}

/** Место у стола — слева от кресла; отсюда герой заходит к столу. */
const DESK_AT = SPOTS.find((s) => s.id === 'computer')!.at;
/** Между столом и отъехавшим креслом: тут герой стоит, прежде чем сесть. */
const GAP: P = { x: SEAT.x, y: SEAT.y - 3 };
/** Насколько кресло отъезжает от стола. */
export const CHAIR_OUT = 5;
/** Насколько герой опускается, садясь (потом рисуется кадр «сидит»). */
const SINK = 4;

/** Край кровати у подушек, куда герой садится перед сном. */
export const BED_EDGE: P = { x: 60, y: 84 };
/** Спит укрытым по грудь: видны голова, плечи и начало рук. */
export const SLEEP_BLANKET = 5;
/** Одеяло у только что лёгшего героя — по пояс. */
const BLANKET_LOW = 10;

const SIT: Seg[] = [
  { dur: 0.2, pose: 'stand', dir: 0, from: DESK_AT, chair: [0, CHAIR_OUT] },
  { dur: 0.26, pose: 'walk', dir: 0, from: DESK_AT, to: GAP, chair: [CHAIR_OUT, CHAIR_OUT] },
  { dur: 0.08, pose: 'stand', dir: 1, from: GAP, chair: [CHAIR_OUT, CHAIR_OUT] },
  { dur: 0.18, pose: 'lower', dir: 1, from: GAP, lift: [0, SINK], chair: [CHAIR_OUT, CHAIR_OUT] },
  { dur: 0.24, pose: 'sit', dir: 1, from: SEAT, chair: [CHAIR_OUT, 0] },
];

const STAND: Seg[] = [
  { dur: 0.2, pose: 'sit', dir: 1, from: SEAT, chair: [0, CHAIR_OUT] },
  { dur: 0.18, pose: 'lower', dir: 1, from: GAP, lift: [SINK, 0], chair: [CHAIR_OUT, CHAIR_OUT] },
  { dur: 0.06, pose: 'stand', dir: 2, from: GAP, chair: [CHAIR_OUT, CHAIR_OUT] },
  { dur: 0.26, pose: 'walk', dir: 2, from: GAP, to: DESK_AT, chair: [CHAIR_OUT, CHAIR_OUT] },
];

const LIE: Seg[] = [
  { dur: 0.34, pose: 'edge', dir: 0, from: BED_EDGE },
  { dur: 0.12, pose: 'bed', dir: 3, from: BED_EDGE, blanket: [BLANKET_LOW, BLANKET_LOW] },
  { dur: 0.3, pose: 'bed', dir: 3, from: BED_EDGE, blanket: [BLANKET_LOW, SLEEP_BLANKET] },
];

const RISE: Seg[] = [
  // пока экран светлеет после сна, ещё лежит — чтобы пробуждение было видно
  { dur: 0.32, pose: 'bed', dir: 3, from: BED_EDGE, blanket: [SLEEP_BLANKET, SLEEP_BLANKET] },
  { dur: 0.26, pose: 'bed', dir: 3, from: BED_EDGE, blanket: [SLEEP_BLANKET, BLANKET_LOW] },
  { dur: 0.06, pose: 'bed', dir: 3, from: BED_EDGE, blanket: [BLANKET_LOW, BLANKET_LOW] },
  { dur: 0.3, pose: 'edge', dir: 0, from: BED_EDGE },
];

const SEGS: Record<MoveKind, Seg[]> = { sit: SIT, stand: STAND, lie: LIE, rise: RISE };

const total = (segs: Seg[]) => segs.reduce((s, g) => s + g.dur, 0);

export const MOVE_SECONDS: Record<MoveKind, number> = {
  sit: total(SIT),
  stand: total(STAND),
  lie: total(LIE),
  rise: total(RISE),
};

/** Ровно по пикселю: от a к b за долю k (0…1). */
const lerp = (a: number, b: number, k: number) => Math.round(a + (b - a) * k);
const pair = (v: [number, number] | undefined, k: number) => (v ? lerp(v[0], v[1], k) : 0);

/** Кадр движения через `t` секунд от начала; null — движение кончилось. */
export function moveStep(kind: MoveKind, t: number): MoveStep | null {
  let start = 0;
  for (const g of SEGS[kind]) {
    if (t < start + g.dur) {
      const k = (t - start) / g.dur;
      const to = g.to ?? g.from;
      return {
        pose: g.pose,
        dir: g.dir,
        x: lerp(g.from.x, to.x, k),
        y: lerp(g.from.y, to.y, k),
        lift: pair(g.lift, k),
        chair: pair(g.chair, k),
        blanket: pair(g.blanket, k),
      };
    }
    start += g.dur;
  }
  return null;
}
