import { PLANETS } from '../data/planets.js';
import { MOONS } from '../data/moons.js';
import { COMETS } from '../data/comets.js';
import { positionAt, sampleOrbitPath, resolvePlanetElements } from './kepler.js';

/**
 * Compute the full state of the solar system (planet, moon and comet
 * positions plus their orbit paths) at a given Julian Date. All
 * coordinates are heliocentric ecliptic (x,y) in AU, with z dropped for
 * the 2D top-down view.
 * @param {number} jd - Julian Date
 * @returns {{planets: object[], comets: object[]}}
 */
export function computeSystem(jd) {
  const planets = PLANETS.map((p) => {
    const elements = resolvePlanetElements(p, jd);
    const pos = positionAt(elements, jd);
    const orbitPoints = sampleOrbitPath(elements, 240);

    const moons = (MOONS[p.name] || []).map((m) => {
      const mpos = positionAt(m, jd);
      const moonOrbit = sampleOrbitPath(m, 90).map((pt) => ({
        x: pt.x + pos.x,
        y: pt.y + pos.y,
      }));
      return {
        ...m,
        x: pos.x + mpos.x,
        y: pos.y + mpos.y,
        r: mpos.r,
        orbitPoints: moonOrbit,
        parent: p.name,
      };
    });

    return { ...p, x: pos.x, y: pos.y, r: pos.r, orbitPoints, moons, periodDays: elements.periodDays };
  });

  const comets = COMETS.map((c) => {
    const pos = positionAt(c, jd);
    const orbitPoints = sampleOrbitPath(c, 360);
    return { ...c, x: pos.x, y: pos.y, r: pos.r, orbitPoints };
  });

  return { planets, comets };
}
