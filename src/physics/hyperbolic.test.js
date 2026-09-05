import { describe, it, expect } from 'vitest';
import { hyperbolicStateAt, elementsFromStateVector, GM_SUN } from './orbitalMechanics.js';

const REFERENCE_JD = 2461000.5;

const HYPERBOLIC_FIXTURES = [
  { label: 'prograde, moderate e', a: -2.0, e: 1.5, i: 0, node: 0, peri: 30, meanAnomalyAtEpoch: 20, epochJd: REFERENCE_JD, gm: GM_SUN },
  { label: 'prograde, high e', a: -0.6, e: 3.0, i: 0, node: 0, peri: 200, meanAnomalyAtEpoch: -15, epochJd: REFERENCE_JD, gm: GM_SUN },
  { label: 'retrograde', a: -1.4, e: 1.8, i: 180, node: 0, peri: 90, meanAnomalyAtEpoch: 5, epochJd: REFERENCE_JD, gm: GM_SUN },
];

describe('hyperbolicStateAt + elementsFromStateVector round-trip', () => {
  for (const fixture of HYPERBOLIC_FIXTURES) {
    it(fixture.label, () => {
      const state = hyperbolicStateAt(fixture, REFERENCE_JD);
      expect(state.r).toBeGreaterThan(0);

      const recovered = elementsFromStateVector(
        { x: state.x, y: state.y },
        { vx: state.vx, vy: state.vy },
        GM_SUN,
        REFERENCE_JD
      );

      expect(recovered.type).toBe('hyperbolic');
      expect(recovered.a).toBeCloseTo(fixture.a, 6);
      expect(recovered.e).toBeCloseTo(fixture.e, 6);
      expect(recovered.i).toBe(fixture.i);

      const state2 = hyperbolicStateAt(recovered, REFERENCE_JD);
      expect(state2.x).toBeCloseTo(state.x, 6);
      expect(state2.y).toBeCloseTo(state.y, 6);
      expect(state2.vx).toBeCloseTo(state.vx, 6);
      expect(state2.vy).toBeCloseTo(state.vy, 6);
    });
  }
});

describe('hyperbolicStateAt conserves specific orbital energy over time', () => {
  for (const fixture of HYPERBOLIC_FIXTURES) {
    it(fixture.label, () => {
      const energies = [-800, -100, 0, 250, 900].map((dtDays) => {
        const s = hyperbolicStateAt(fixture, REFERENCE_JD + dtDays);
        const speedSq = s.vx * s.vx + s.vy * s.vy + s.vz * s.vz;
        return speedSq / 2 - GM_SUN / s.r;
      });
      const [first, ...rest] = energies;
      for (const e of rest) {
        expect(e).toBeCloseTo(first, 8);
      }
      // A hyperbolic orbit is, by definition, unbound: positive energy.
      expect(first).toBeGreaterThan(0);
    });
  }
});
