import { describe, it, expect } from 'vitest';
import { PLANETS } from '../data/planets.js';
import { MOONS } from '../data/moons.js';
import { gmToAuDay, GM_SUN } from './orbitalMechanics.js';

/** Assert two values agree to within a relative tolerance (values here
 * span many orders of magnitude, so an absolute toBeCloseTo isn't useful). */
function expectRelativeClose(actual, expected, relTolerance) {
  const relError = Math.abs(actual - expected) / Math.abs(expected);
  expect(relError).toBeLessThan(relTolerance);
}

// One well-known moon per planet that has one, used to cross-check the
// planet's tabulated GM via Kepler's third law (n^2 a^3 = GM). Mercury and
// Venus have no moons and are skipped.
const SAMPLE_MOON = {
  Earth: 'Moon',
  Mars: 'Phobos',
  Jupiter: 'Io',
  Saturn: 'Titan',
  Uranus: 'Titania',
  Neptune: 'Triton',
  Pluto: 'Charon',
};

describe('planet GM data sanity (cross-checked against moons.js)', () => {
  for (const planet of PLANETS) {
    const moonName = SAMPLE_MOON[planet.name];
    if (!moonName) continue;

    it(`${planet.name}: tabulated GM matches n^2 a^3 from ${moonName}'s real orbit`, () => {
      const moon = MOONS[planet.name].find((m) => m.name === moonName);
      const n = (2 * Math.PI) / moon.periodDays; // rad/day
      const gmFromMoonOrbit = n ** 2 * moon.a ** 3; // AU^3/day^2
      const gmTabulated = gmToAuDay(planet.gmKm3PerS2);

      // Pluto/Charon is a genuine binary system (Charon is ~12% of
      // Pluto's mass, unusually large for a "moon"), so Kepler's third
      // law there gives G(M_pluto + M_charon), not GM_pluto alone - a
      // real physical effect, not data error, so it gets a wider band.
      const relTolerance = planet.name === 'Pluto' ? 0.15 : 0.05;
      expectRelativeClose(gmFromMoonOrbit, gmTabulated, relTolerance);
    });
  }

  it('Earth GM is roughly 1/333000th of the Sun GM', () => {
    const earth = PLANETS.find((p) => p.name === 'Earth');
    const ratio = gmToAuDay(earth.gmKm3PerS2) / GM_SUN;
    expectRelativeClose(ratio, 1 / 332946, 0.01);
  });
});
