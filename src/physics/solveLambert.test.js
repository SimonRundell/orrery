import { describe, it, expect } from 'vitest';
import { positionAt, SIDEREAL_YEAR_DAYS } from './kepler.js';
import { velocityAt, solveLambert, GM_SUN } from './orbitalMechanics.js';

const REFERENCE_JD = 2461000.5;
const periodFor = (a) => SIDEREAL_YEAR_DAYS * Math.pow(a, 1.5);

/**
 * Build a Lambert test case from a known synthetic orbit: pick two dates
 * an exact mean-anomaly sweep apart (mean anomaly is exactly linear in
 * time, so the time of flight is known exactly, no approximation), read
 * off where the real orbit actually is and how fast it's actually moving
 * at each end, and confirm solveLambert recovers the same velocities
 * from nothing but the two positions and the time between them.
 */
function checkLambertAgainstKnownOrbit(elements, meanAnomalySweepDeg, prograde) {
  const tof = (meanAnomalySweepDeg / 360) * elements.periodDays;
  const jd2 = REFERENCE_JD + tof;

  const r1 = positionAt(elements, REFERENCE_JD);
  const r2 = positionAt(elements, jd2);
  const v1Expected = velocityAt(elements, REFERENCE_JD);
  const v2Expected = velocityAt(elements, jd2);

  const { v1, v2 } = solveLambert(r1, r2, tof, GM_SUN, { prograde });

  expect(v1.vx).toBeCloseTo(v1Expected.vx, 6);
  expect(v1.vy).toBeCloseTo(v1Expected.vy, 6);
  expect(v2.vx).toBeCloseTo(v2Expected.vx, 6);
  expect(v2.vy).toBeCloseTo(v2Expected.vy, 6);
}

describe('solveLambert recovers exact velocities from a known prograde orbit', () => {
  const elements = {
    a: 1.4, e: 0.35, i: 0, node: 0, peri: 20,
    meanAnomalyAtEpoch: 0, epochJd: REFERENCE_JD, periodDays: periodFor(1.4),
  };

  it('short way (60 degree sweep)', () => {
    checkLambertAgainstKnownOrbit(elements, 60, true);
  });

  it('long way (300 degree sweep)', () => {
    checkLambertAgainstKnownOrbit(elements, 300, true);
  });
});

describe('solveLambert recovers exact velocities from a known retrograde orbit', () => {
  const elements = {
    a: 2.1, e: 0.2, i: 180, node: 0, peri: 100,
    meanAnomalyAtEpoch: 10, epochJd: REFERENCE_JD, periodDays: periodFor(2.1),
  };

  it('short way (short way, retrograde)', () => {
    checkLambertAgainstKnownOrbit(elements, 70, false);
  });
});

describe('solveLambert rejects a time of flight shorter than any direct transfer', () => {
  it('throws rather than returning a hyperbolic transfer arc', () => {
    const r1 = { x: 1, y: 0 };
    const r2 = { x: -1, y: 0.01 };
    expect(() => solveLambert(r1, r2, 0.001, GM_SUN)).toThrow();
  });
});
