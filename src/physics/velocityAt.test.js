import { describe, it, expect } from 'vitest';
import { PLANETS } from '../data/planets.js';
import { resolvePlanetElements, positionAt } from './kepler.js';
import { velocityAt } from './orbitalMechanics.js';

const REFERENCE_JD = 2461000.5; // an arbitrary but fixed test date

describe('velocityAt matches a finite-difference derivative of positionAt', () => {
  for (const planet of PLANETS) {
    it(`${planet.name}`, () => {
      // Resolve elements once, exactly as solarSystem.js does, then hold
      // them fixed while evaluating positionAt at nearby dates - this is
      // the correct way to differentiate the same osculating ellipse.
      const elements = resolvePlanetElements(planet, REFERENCE_JD);

      const dt = 0.01; // days
      const before = positionAt(elements, REFERENCE_JD - dt);
      const after = positionAt(elements, REFERENCE_JD + dt);
      const numericVx = (after.x - before.x) / (2 * dt);
      const numericVy = (after.y - before.y) / (2 * dt);

      const { vx, vy } = velocityAt(elements, REFERENCE_JD);

      const speed = Math.hypot(vx, vy);
      expect(Math.abs(vx - numericVx) / speed).toBeLessThan(1e-4);
      expect(Math.abs(vy - numericVy) / speed).toBeLessThan(1e-4);
    });
  }
});
