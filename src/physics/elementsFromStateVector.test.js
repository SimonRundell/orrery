import { describe, it, expect } from 'vitest';
import { positionAt, SIDEREAL_YEAR_DAYS } from './kepler.js';
import { velocityAt, elementsFromStateVector, GM_SUN } from './orbitalMechanics.js';

// Synthetic planar (i=0) fixtures, not real planet data: a real planet's
// positionAt/velocityAt state is a *projection* of its true (inclined)
// 3D orbit, and projecting a tilted ellipse onto a plane does not, in
// general, give back an ellipse with the same a/e - that's a foreshortening
// effect, not a bug in elementsFromStateVector. To test the conversion
// formulas themselves we need genuinely planar orbits as input.
//
// periodDays must be *exactly* consistent with GM_SUN via Kepler's third
// law (period = SIDEREAL_YEAR_DAYS * a^1.5) - any rounding there would
// make velocityAt's speed inconsistent with GM_SUN and throw off the
// recovered semi-major axis by more than floating-point noise.
const periodFor = (a) => SIDEREAL_YEAR_DAYS * Math.pow(a, 1.5);
const REFERENCE_JD = 2461000.5;

const PROGRADE_FIXTURES = [
  { a: 1.0, e: 0.0, i: 0, node: 0, peri: 0, meanAnomalyAtEpoch: 30, epochJd: REFERENCE_JD, periodDays: periodFor(1.0) },
  { a: 1.5, e: 0.3, i: 0, node: 0, peri: 45, meanAnomalyAtEpoch: 200, epochJd: REFERENCE_JD, periodDays: periodFor(1.5) },
  { a: 17.8, e: 0.9, i: 0, node: 0, peri: 111, meanAnomalyAtEpoch: 10, epochJd: REFERENCE_JD, periodDays: periodFor(17.8) },
];

describe('elementsFromStateVector round-trips a planar prograde state', () => {
  for (const fixture of PROGRADE_FIXTURES) {
    it(`a=${fixture.a} e=${fixture.e}`, () => {
      const pos = positionAt(fixture, REFERENCE_JD);
      const vel = velocityAt(fixture, REFERENCE_JD);
      const recovered = elementsFromStateVector(pos, vel, GM_SUN, REFERENCE_JD);

      expect(recovered.a).toBeCloseTo(fixture.a, 6);
      expect(recovered.e).toBeCloseTo(fixture.e, 6);
      expect(recovered.i).toBe(0);

      // Confirm the recovered elements reproduce the same position/velocity.
      const pos2 = positionAt(recovered, REFERENCE_JD);
      const vel2 = velocityAt(recovered, REFERENCE_JD);
      expect(pos2.x).toBeCloseTo(pos.x, 6);
      expect(pos2.y).toBeCloseTo(pos.y, 6);
      expect(vel2.vx).toBeCloseTo(vel.vx, 6);
      expect(vel2.vy).toBeCloseTo(vel.vy, 6);
    });
  }
});

describe('elementsFromStateVector detects and round-trips a retrograde state', () => {
  it('a=1.2 e=0.4, i=180 (clockwise in x/y)', () => {
    const fixture = { a: 1.2, e: 0.4, i: 180, node: 0, peri: 60, meanAnomalyAtEpoch: 80, epochJd: REFERENCE_JD, periodDays: periodFor(1.2) };
    const pos = positionAt(fixture, REFERENCE_JD);
    const vel = velocityAt(fixture, REFERENCE_JD);

    // Sanity: this fixture really is retrograde (negative z-component of
    // angular momentum in the x/y plane).
    const hz = pos.x * vel.vy - pos.y * vel.vx;
    expect(hz).toBeLessThan(0);

    const recovered = elementsFromStateVector(pos, vel, GM_SUN, REFERENCE_JD);
    expect(recovered.a).toBeCloseTo(fixture.a, 6);
    expect(recovered.e).toBeCloseTo(fixture.e, 6);
    expect(recovered.i).toBe(180);

    const pos2 = positionAt(recovered, REFERENCE_JD);
    const vel2 = velocityAt(recovered, REFERENCE_JD);
    expect(pos2.x).toBeCloseTo(pos.x, 6);
    expect(pos2.y).toBeCloseTo(pos.y, 6);
    expect(vel2.vx).toBeCloseTo(vel.vx, 6);
    expect(vel2.vy).toBeCloseTo(vel.vy, 6);
  });
});
