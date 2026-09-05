/**
 * Keplerian orbit solver.
 *
 * Every orbiting body (planet, moon, comet) is described by a set of
 * classical orbital elements. Given a Julian Date we solve Kepler's
 * equation for the eccentric anomaly, derive the true anomaly and radius,
 * then rotate the orbital-plane position into the parent body's reference
 * frame (ecliptic-aligned x/y, with z dropped for the 2D top-down view).
 */

const DEG2RAD = Math.PI / 180;
const TWO_PI = Math.PI * 2;

/** Wrap an angle in radians to the range [0, 2*PI). */
function wrapRad(angle) {
  const a = angle % TWO_PI;
  return a < 0 ? a + TWO_PI : a;
}

/**
 * Solve Kepler's equation M = E - e*sin(E) for the eccentric anomaly E,
 * using Newton-Raphson iteration.
 * @param {number} meanAnomaly - mean anomaly in radians
 * @param {number} eccentricity - orbital eccentricity (0 <= e < 1)
 * @returns {number} eccentric anomaly in radians
 */
export function solveKepler(meanAnomaly, eccentricity) {
  const M = wrapRad(meanAnomaly);
  let E = eccentricity < 0.8 ? M : Math.PI;
  for (let i = 0; i < 30; i++) {
    const dE = (E - eccentricity * Math.sin(E) - M) / (1 - eccentricity * Math.cos(E));
    E -= dE;
    if (Math.abs(dE) < 1e-10) break;
  }
  return E;
}

/**
 * Compute a body's position at a given time from its Keplerian elements.
 *
 * @param {object} elements
 * @param {number} elements.a - semi-major axis (AU for heliocentric bodies, km for moons)
 * @param {number} elements.e - eccentricity
 * @param {number} elements.i - inclination, degrees
 * @param {number} elements.node - longitude of ascending node (Omega), degrees
 * @param {number} elements.peri - argument of periapsis (omega), degrees
 * @param {number} elements.meanAnomalyAtEpoch - mean anomaly at epochJd, degrees
 * @param {number} elements.epochJd - Julian Date of the reference epoch
 * @param {number} elements.periodDays - orbital period, days
 * @param {number} jd - Julian Date at which to evaluate the position
 * @returns {{x:number,y:number,z:number,r:number,trueAnomaly:number}} position
 *   in the same length unit as `a`, in the parent's reference plane.
 */
export function positionAt(elements, jd) {
  const { a, e, i, node, peri, meanAnomalyAtEpoch, epochJd, periodDays } = elements;

  const n = TWO_PI / periodDays; // mean motion, rad/day
  const M = meanAnomalyAtEpoch * DEG2RAD + n * (jd - epochJd);

  const E = solveKepler(M, e);
  const trueAnomaly = 2 * Math.atan2(Math.sqrt(1 + e) * Math.sin(E / 2), Math.sqrt(1 - e) * Math.cos(E / 2));
  const r = a * (1 - e * Math.cos(E));

  const iRad = i * DEG2RAD;
  const nodeRad = node * DEG2RAD;
  const argRad = peri * DEG2RAD;
  const u = argRad + trueAnomaly; // argument of latitude

  const cosNode = Math.cos(nodeRad);
  const sinNode = Math.sin(nodeRad);
  const cosU = Math.cos(u);
  const sinU = Math.sin(u);
  const cosI = Math.cos(iRad);
  const sinI = Math.sin(iRad);

  const x = r * (cosNode * cosU - sinNode * sinU * cosI);
  const y = r * (sinNode * cosU + cosNode * sinU * cosI);
  const z = r * (sinU * sinI);

  return { x, y, z, r, trueAnomaly };
}

/**
 * Sample a full orbit ellipse as an array of {x,y,z} points, for drawing
 * the orbit path. Elements are evaluated as given (no time dependence),
 * so this traces the instantaneous osculating ellipse.
 * @param {object} elements - same shape as positionAt, minus time fields
 * @param {number} [steps=180] - number of points to sample
 * @returns {{x:number,y:number,z:number}[]}
 */
export function sampleOrbitPath(elements, steps = 180) {
  const { a, e, i, node, peri } = elements;
  const iRad = i * DEG2RAD;
  const nodeRad = node * DEG2RAD;
  const argRad = peri * DEG2RAD;
  const cosNode = Math.cos(nodeRad);
  const sinNode = Math.sin(nodeRad);
  const cosI = Math.cos(iRad);
  const sinI = Math.sin(iRad);

  const points = [];
  for (let s = 0; s <= steps; s++) {
    const E = (s / steps) * TWO_PI;
    const trueAnomaly = 2 * Math.atan2(Math.sqrt(1 + e) * Math.sin(E / 2), Math.sqrt(1 - e) * Math.cos(E / 2));
    const r = a * (1 - e * Math.cos(E));
    const u = argRad + trueAnomaly;
    const cosU = Math.cos(u);
    const sinU = Math.sin(u);
    const x = r * (cosNode * cosU - sinNode * sinU * cosI);
    const y = r * (sinNode * cosU + cosNode * sinU * cosI);
    const z = r * (sinU * sinI);
    points.push({ x, y, z });
  }
  return points;
}

export const SIDEREAL_YEAR_DAYS = 365.25636;

/**
 * Resolve a JPL-style planetary element set (a, e, i, L, long.peri, long.node
 * plus their `*Dot` per-century rates) into ready-to-use orbital elements
 * for `positionAt`, evaluated exactly at `jd`. Because the mean anomaly is
 * computed directly from the linear-in-time mean longitude formula, the
 * returned epoch is `jd` itself (zero further propagation needed).
 * @param {object} base - JPL low-precision element set (angles in degrees)
 * @param {number} jd - Julian Date to evaluate at
 * @returns {object} elements ready for positionAt/sampleOrbitPath
 */
export function resolvePlanetElements(base, jd) {
  const T = (jd - 2451545.0) / 36525;
  const a = base.a + (base.aDot || 0) * T;
  const e = base.e + (base.eDot || 0) * T;
  const i = base.i + (base.iDot || 0) * T;
  const node = base.node + (base.nodeDot || 0) * T;
  const longPeri = base.longPeri + (base.longPeriDot || 0) * T;
  const L = base.L + (base.LDot || 0) * T;
  const peri = longPeri - node;
  const meanAnomalyAtEpoch = L - longPeri;
  const periodDays = SIDEREAL_YEAR_DAYS * Math.pow(a, 1.5);
  return { a, e, i, node, peri, meanAnomalyAtEpoch, epochJd: jd, periodDays };
}
