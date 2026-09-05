import { PLANETS } from '../data/planets.js';
import { MOONS } from '../data/moons.js';
import { COMETS } from '../data/comets.js';
import { positionAt, sampleOrbitPath, resolvePlanetElements } from './kepler.js';
import { velocityAt, GM_SUN, gmToAuDay } from './orbitalMechanics.js';

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

/**
 * Look up any named body's full state (position + velocity, heliocentric
 * AU / AU-day) at a given date - the piece `computeSystem` doesn't need
 * for the passive orrery view, but the mission planner does, for
 * computing departure/arrival delta-v and gravity-assist geometry.
 * @param {string} name - 'Sun', a planet, a moon, or a comet name
 * @param {number} jd - Julian Date
 * @returns {{x:number,y:number,vx:number,vy:number,gm:(number|undefined)}}
 *   `gm` (AU^3/day^2) is only meaningful for the Sun and planets - moons
 *   and comets are treated as massless for mission purposes.
 */
export function getBodyState(name, jd) {
  if (name === 'Sun') {
    return { x: 0, y: 0, vx: 0, vy: 0, gm: GM_SUN };
  }

  const planet = PLANETS.find((p) => p.name === name);
  if (planet) {
    const elements = resolvePlanetElements(planet, jd);
    const pos = positionAt(elements, jd);
    const vel = velocityAt(elements, jd);
    return { x: pos.x, y: pos.y, vx: vel.vx, vy: vel.vy, gm: gmToAuDay(planet.gmKm3PerS2) };
  }

  for (const parentName of Object.keys(MOONS)) {
    const moon = MOONS[parentName].find((m) => m.name === name);
    if (moon) {
      const parentState = getBodyState(parentName, jd);
      const relPos = positionAt(moon, jd);
      const relVel = velocityAt(moon, jd);
      return {
        x: parentState.x + relPos.x,
        y: parentState.y + relPos.y,
        vx: parentState.vx + relVel.vx,
        vy: parentState.vy + relVel.vy,
        gm: undefined,
      };
    }
  }

  const comet = COMETS.find((c) => c.name === name);
  if (comet) {
    const pos = positionAt(comet, jd);
    const vel = velocityAt(comet, jd);
    return { x: pos.x, y: pos.y, vx: vel.vx, vy: vel.vy, gm: undefined };
  }

  throw new Error(`getBodyState: unknown body "${name}"`);
}
