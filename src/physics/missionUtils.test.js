import { describe, it, expect } from 'vitest';
import { positionAt, SIDEREAL_YEAR_DAYS } from './kepler.js';
import { sampleHyperbolicArc, timeOfPeriapsisPassage } from './orbitalMechanics.js';

const REFERENCE_JD = 2461000.5;
const periodFor = (a) => SIDEREAL_YEAR_DAYS * Math.pow(a, 1.5);

describe('timeOfPeriapsisPassage', () => {
  const elements = {
    a: 1.3, e: 0.25, i: 0, node: 0, peri: 50,
    meanAnomalyAtEpoch: 140, epochJd: REFERENCE_JD, periodDays: periodFor(1.3),
  };

  it('lands exactly on periapsis (r = a(1-e), mean anomaly = 0)', () => {
    const tPeri = timeOfPeriapsisPassage(elements, REFERENCE_JD);
    const pos = positionAt(elements, tPeri);
    expect(pos.r).toBeCloseTo(elements.a * (1 - elements.e), 8);
  });

  it('returns the next occurrence at or after the given date, not a past one', () => {
    const afterJd = REFERENCE_JD + 10;
    const tPeri = timeOfPeriapsisPassage(elements, afterJd);
    expect(tPeri).toBeGreaterThanOrEqual(afterJd);
    expect(tPeri - afterJd).toBeLessThan(elements.periodDays);
  });
});

describe('sampleHyperbolicArc', () => {
  const elements = { a: -1.5, e: 2.0, i: 0, node: 0, peri: 0 };
  const maxRadius = 40; // AU, comfortably beyond Neptune

  it('every sampled point is within the requested radius cutoff', () => {
    const points = sampleHyperbolicArc(elements, maxRadius, 60);
    for (const p of points) {
      const r = Math.hypot(p.x, p.y);
      expect(r).toBeLessThanOrEqual(maxRadius * 1.001);
    }
  });

  it('the arc reaches out to close to the cutoff radius at its ends', () => {
    const points = sampleHyperbolicArc(elements, maxRadius, 60);
    const rStart = Math.hypot(points[0].x, points[0].y);
    const rEnd = Math.hypot(points[points.length - 1].x, points[points.length - 1].y);
    expect(rStart).toBeGreaterThan(maxRadius * 0.9);
    expect(rEnd).toBeGreaterThan(maxRadius * 0.9);
  });

  it('the midpoint (periapsis) is the closest approach', () => {
    const points = sampleHyperbolicArc(elements, maxRadius, 60);
    const mid = points[Math.floor(points.length / 2)];
    const rMid = Math.hypot(mid.x, mid.y);
    const rp = -elements.a * (elements.e - 1); // periapsis distance for a hyperbola
    expect(rMid).toBeCloseTo(rp, 2);
  });
});
