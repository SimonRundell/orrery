import { describe, it, expect } from 'vitest';
import { solveKepler } from './kepler.js';

describe('solveKepler', () => {
  it('solves Kepler equation for a circular orbit (e=0): E equals M', () => {
    const M = 1.2345;
    expect(solveKepler(M, 0)).toBeCloseTo(M, 10);
  });

  it('satisfies M = E - e*sin(E) for an eccentric orbit', () => {
    const M = 2.1;
    const e = 0.7;
    const E = solveKepler(M, e);
    expect(E - e * Math.sin(E)).toBeCloseTo(M, 8);
  });
});
