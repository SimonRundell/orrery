/**
 * Mission-planner orbital mechanics: state vectors, hyperbolic orbits and
 * Lambert transfers, built on top of (but kept separate from) kepler.js so
 * the existing, already-correct orrery solver is never touched.
 *
 * Unit system throughout this module matches the rest of the app: AU for
 * distance, days for time, degrees for stored angles / radians internally.
 * Gravitational parameters (GM) are derived in AU^3/day^2 so a probe's
 * transfer ellipse animates at the same simulated-time pace as the
 * planets, which are propagated from `periodDays = 365.25636 * a^1.5`.
 */

import { SIDEREAL_YEAR_DAYS, solveKepler, positionAt } from './kepler.js';

const DEG2RAD = Math.PI / 180;
const TWO_PI = Math.PI * 2;

export const AU_KM = 149597870.7;
export const SECONDS_PER_DAY = 86400;

/** The Sun's GM in AU^3/day^2, consistent with kepler.js's period formula. */
export const GM_SUN = (4 * Math.PI ** 2) / SIDEREAL_YEAR_DAYS ** 2;

/** Convert a standard gravitational parameter from km^3/s^2 (the usual
 * published form for planets) into this app's AU^3/day^2 units. */
export function gmToAuDay(gmKm3PerS2) {
  return (gmKm3PerS2 * SECONDS_PER_DAY ** 2) / AU_KM ** 3;
}

/** Convert a speed in AU/day (this app's internal unit) to km/s, for display. */
export function auPerDayToKmPerSecond(speedAuPerDay) {
  return (speedAuPerDay * AU_KM) / SECONDS_PER_DAY;
}

/** Convert a speed in km/s (the usual human-facing unit) to AU/day. */
export function kmPerSecondToAuPerDay(speedKmPerSecond) {
  return (speedKmPerSecond * SECONDS_PER_DAY) / AU_KM;
}

/**
 * Sphere-of-influence radius (AU) for a planet, used only for drawing a
 * "here's where the gravity-assist kink comes from" circle - it does not
 * feed into the turning-angle physics itself, which uses GM and periapsis
 * distance directly.
 * @param {number} planetAAu - planet's semi-major axis, AU
 * @param {number} planetGmKm3PerS2 - planet's GM, km^3/s^2
 */
export function sphereOfInfluenceAu(planetAAu, planetGmKm3PerS2) {
  const massRatio = gmToAuDay(planetGmKm3PerS2) / GM_SUN;
  return planetAAu * massRatio ** 0.4;
}

/**
 * Unit vector for a direction at argument of latitude `u` within an
 * orbital plane of inclination `iRad` and ascending node `nodeRad`,
 * expressed in the shared ecliptic frame. This is the same rotation
 * kepler.js's `positionAt` applies to a position of magnitude `r` at
 * angle `u`; factored out here (duplicated rather than imported, to keep
 * kepler.js untouched) so it can also rotate a velocity direction.
 */
function orbitalPlaneDirection(u, iRad, nodeRad) {
  const cosNode = Math.cos(nodeRad);
  const sinNode = Math.sin(nodeRad);
  const cosU = Math.cos(u);
  const sinU = Math.sin(u);
  const cosI = Math.cos(iRad);
  const sinI = Math.sin(iRad);
  return {
    x: cosNode * cosU - sinNode * sinU * cosI,
    y: sinNode * cosU + cosNode * sinU * cosI,
    z: sinU * sinI,
  };
}

/**
 * Velocity vector for an elliptical orbit (e < 1), the counterpart to
 * kepler.js's `positionAt` for the same element set and date. Returns
 * AU/day components in the shared ecliptic frame.
 * @param {object} elements - same shape as positionAt's (a, e, i, node,
 *   peri, meanAnomalyAtEpoch, epochJd, periodDays)
 * @param {number} jd - Julian Date
 * @returns {{vx:number,vy:number,vz:number}}
 */
export function velocityAt(elements, jd) {
  const { a, e, i, node, peri, meanAnomalyAtEpoch, epochJd, periodDays } = elements;

  const n = TWO_PI / periodDays; // rad/day
  const M = meanAnomalyAtEpoch * DEG2RAD + n * (jd - epochJd);
  const E = solveKepler(M, e);
  const trueAnomaly = 2 * Math.atan2(Math.sqrt(1 + e) * Math.sin(E / 2), Math.sqrt(1 - e) * Math.cos(E / 2));

  const iRad = i * DEG2RAD;
  const nodeRad = node * DEG2RAD;
  const u = peri * DEG2RAD + trueAnomaly;

  // Standard polar-form orbital velocity: radial component v_r along the
  // position direction, transverse component v_t perpendicular to it in
  // the direction of motion.
  const factor = (n * a) / Math.sqrt(1 - e * e);
  const vr = factor * e * Math.sin(trueAnomaly);
  const vt = factor * (1 + e * Math.cos(trueAnomaly));

  const rHat = orbitalPlaneDirection(u, iRad, nodeRad);
  const thetaHat = orbitalPlaneDirection(u + Math.PI / 2, iRad, nodeRad);

  return {
    vx: vr * rHat.x + vt * thetaHat.x,
    vy: vr * rHat.y + vt * thetaHat.y,
    vz: vr * rHat.z + vt * thetaHat.z,
  };
}

/**
 * Convert an instantaneous planar state vector (position, velocity) into
 * classical orbital elements compatible with positionAt/velocityAt - the
 * inverse operation, needed after every burn and gravity-assist to find
 * the resulting orbit.
 *
 * This app is a 2D (z=0) model, so inclination collapses to exactly 0
 * degrees (prograde, counterclockwise in x/y) or 180 degrees (retrograde,
 * clockwise) with node fixed at 0 - there is no "which way is up" choice
 * to make in a flat model, only "which way around". Everything else
 * (periapsis orientation) folds into `peri`.
 *
 * @param {{x:number,y:number}} r - position, AU
 * @param {{vx:number,vy:number}} v - velocity, AU/day
 * @param {number} gm - central body's GM, AU^3/day^2
 * @param {number} jd - Julian Date this state is valid at (becomes epochJd)
 * @returns {object} elements usable with positionAt/velocityAt (elliptical
 *   orbits only in this function; e >= 1 is handled by the hyperbolic
 *   counterpart added alongside the hyperbolic solver)
 */
export function elementsFromStateVector(r, v, gm, jd) {
  const rMag = Math.hypot(r.x, r.y);
  const vMag = Math.hypot(v.vx, v.vy);
  const rDotV = r.x * v.vx + r.y * v.vy;
  const hz = r.x * v.vy - r.y * v.vx; // z-component of specific angular momentum

  const energy = (vMag * vMag) / 2 - gm / rMag;
  const a = -gm / (2 * energy);

  const exVec = ((vMag * vMag - gm / rMag) * r.x - rDotV * v.vx) / gm;
  const eyVec = ((vMag * vMag - gm / rMag) * r.y - rDotV * v.vy) / gm;
  const e = Math.hypot(exVec, eyVec);
  const retrograde = hz < 0;
  const i = retrograde ? 180 : 0;

  // theta is the absolute angle of r from the x-axis. positionAt
  // reconstructs it as (peri + trueAnomaly) when prograde, or
  // -(peri + trueAnomaly) when retrograde (i=180 flips the y formula's
  // sign) - so peri and trueAnomaly must be picked consistently with
  // whichever of those two relations applies.
  const theta = Math.atan2(r.y, r.x);
  let peri;
  let trueAnomaly;
  if (e > 1e-8) {
    const periDirection = Math.atan2(eyVec, exVec); // angle of periapsis direction from x-axis
    const cosNu = Math.min(1, Math.max(-1, (exVec * r.x + eyVec * r.y) / (e * rMag)));
    trueAnomaly = Math.acos(cosNu);
    if (rDotV < 0) trueAnomaly = TWO_PI - trueAnomaly; // approaching periapsis, not receding
    peri = retrograde ? -periDirection : periDirection;
  } else {
    // Circular: periapsis is undefined, so fix peri=0 and fold the whole
    // angle into trueAnomaly, consistently with the same theta relation.
    peri = 0;
    trueAnomaly = retrograde ? -theta : theta;
  }
  peri = (peri * 180) / Math.PI;

  if (e >= 1) {
    // Inverse of the ν(H) relation tan(ν/2) = sqrt((e+1)/(e-1))·tanh(H/2).
    // trueAnomaly above was derived purely from the geometric relation
    // between r and the eccentricity vector, so it's valid unchanged for
    // e >= 1 too - only its conversion to an anomaly/mean-anomaly differs.
    const tanhArg = Math.min(0.999999999, Math.max(-0.999999999, Math.sqrt((e - 1) / (e + 1)) * Math.tan(trueAnomaly / 2)));
    const H = 2 * Math.atanh(tanhArg);
    const M = e * Math.sinh(H) - H;
    return {
      a, // negative, by convention, for a hyperbolic orbit
      e,
      i,
      node: 0,
      peri,
      meanAnomalyAtEpoch: (M * 180) / Math.PI,
      epochJd: jd,
      gm,
      type: 'hyperbolic',
    };
  }

  const E = 2 * Math.atan2(Math.sqrt(1 - e) * Math.sin(trueAnomaly / 2), Math.sqrt(1 + e) * Math.cos(trueAnomaly / 2));
  const M = E - e * Math.sin(E);
  const n = Math.sqrt(gm / (a * a * a));
  const periodDays = TWO_PI / n;

  return {
    a,
    e,
    i,
    node: 0,
    peri,
    meanAnomalyAtEpoch: (M * 180) / Math.PI,
    epochJd: jd,
    periodDays,
    type: 'elliptical',
  };
}

/**
 * Solve the hyperbolic Kepler equation M = e·sinh(H) - H for the
 * hyperbolic anomaly H, by Newton-Raphson. Mirrors kepler.js's
 * `solveKepler` for the e >= 1 case that solver doesn't handle.
 * @param {number} meanAnomaly - radians (unbounded, not wrapped - a
 *   hyperbolic trajectory is not periodic)
 * @param {number} e - eccentricity (>= 1)
 * @returns {number} hyperbolic anomaly, radians
 */
export function solveKeplerHyperbolic(meanAnomaly, e) {
  const M = meanAnomaly;
  let H = M === 0 ? 0 : Math.sign(M) * Math.log((2 * Math.abs(M)) / e + 1.8); // Vallado's initial guess
  for (let iter = 0; iter < 50; iter++) {
    const f = e * Math.sinh(H) - H - M;
    const fPrime = e * Math.cosh(H) - 1;
    const dH = f / fPrime;
    H -= dH;
    if (Math.abs(dH) < 1e-12) break;
  }
  return H;
}

/**
 * Position and velocity for a hyperbolic orbit (e >= 1), the counterpart
 * to kepler.js's positionAt/velocityAt for unbound trajectories (the
 * result of an Oberth escape burn or a gravity-assist that boosts a probe
 * past local escape velocity). Uses the semi-latus-rectum/specific
 * angular momentum form, which is valid for any conic without needing a
 * separate mean-motion formula per case.
 * @param {object} elements - {a (negative), e (>=1), i, node, peri,
 *   meanAnomalyAtEpoch, epochJd, gm}
 * @param {number} jd - Julian Date
 * @returns {{x:number,y:number,z:number,vx:number,vy:number,vz:number,r:number,trueAnomaly:number}}
 */
export function hyperbolicStateAt(elements, jd) {
  const { a, e, i, node, peri, meanAnomalyAtEpoch, epochJd, gm } = elements;

  const n = Math.sqrt(gm / (-a) ** 3); // hyperbolic mean motion, rad/day
  const M = meanAnomalyAtEpoch * DEG2RAD + n * (jd - epochJd);
  const H = solveKeplerHyperbolic(M, e);
  const trueAnomaly = 2 * Math.atan2(Math.sqrt(e + 1) * Math.sinh(H / 2), Math.sqrt(e - 1) * Math.cosh(H / 2));

  const p = a * (1 - e * e); // semi-latus rectum - positive for a<0,e>1 too
  const r = p / (1 + e * Math.cos(trueAnomaly));
  const h = Math.sqrt(gm * p);

  const iRad = i * DEG2RAD;
  const nodeRad = node * DEG2RAD;
  const u = peri * DEG2RAD + trueAnomaly;

  const rHat = orbitalPlaneDirection(u, iRad, nodeRad);
  const thetaHat = orbitalPlaneDirection(u + Math.PI / 2, iRad, nodeRad);

  const vr = (gm / h) * e * Math.sin(trueAnomaly);
  const vt = h / r;

  return {
    x: r * rHat.x,
    y: r * rHat.y,
    z: r * rHat.z,
    vx: vr * rHat.x + vt * thetaHat.x,
    vy: vr * rHat.y + vt * thetaHat.y,
    vz: vr * rHat.z + vt * thetaHat.z,
    r,
    trueAnomaly,
  };
}

/**
 * Evaluate a probe's full state (position + velocity) at a date, for
 * either conic type - the general-purpose entry point mission.js uses so
 * callers don't need to know whether a leg's resulting orbit is bound.
 * @param {object} elements - as returned by elementsFromStateVector
 * @param {number} jd - Julian Date
 */
export function stateAt(elements, jd) {
  if (elements.type === 'hyperbolic') {
    return hyperbolicStateAt(elements, jd);
  }
  const pos = positionAt(elements, jd);
  const vel = velocityAt(elements, jd);
  return { ...pos, ...vel };
}

/** Stumpff functions C(z), S(z), used by the universal-variable Lambert
 * solver below. Near z=0 both formulas are 0/0, so a short Taylor series
 * is used there instead for numerical stability. */
function stumpff(z) {
  if (z > 1e-6) {
    const sqrtZ = Math.sqrt(z);
    return { C: (1 - Math.cos(sqrtZ)) / z, S: (sqrtZ - Math.sin(sqrtZ)) / sqrtZ ** 3 };
  }
  if (z < -1e-6) {
    const sqrtNegZ = Math.sqrt(-z);
    return { C: (1 - Math.cosh(sqrtNegZ)) / z, S: (Math.sinh(sqrtNegZ) - sqrtNegZ) / sqrtNegZ ** 3 };
  }
  return { C: 1 / 2 - z / 24, S: 1 / 6 - z / 120 };
}

/**
 * Solve Lambert's problem: given two planar position vectors and a
 * desired time of flight, find the velocities at each end of the
 * connecting transfer orbit. Restricted to the elliptical/parabolic
 * branch (universal variable z >= 0) - see orbitalMechanics.js's module
 * docs for why: every transfer arc between two heliocentric bodies at a
 * sensible time of flight is itself elliptical in practice, so this
 * covers every case this app's UI would sensibly ask for, and fails with
 * a clear error instead of silently returning a hyperbolic transfer arc
 * nobody asked to see.
 *
 * Uses bisection rather than the textbook's analytic-derivative
 * Newton-Raphson: time of flight is monotonic in z across this whole
 * domain, so bisection converges just as reliably with far less
 * algebra to get wrong - a better trade for a codebase meant to be read
 * and trusted by someone teaching from it.
 *
 * @param {{x:number,y:number}} r1Vec - departure position, AU
 * @param {{x:number,y:number}} r2Vec - arrival position, AU
 * @param {number} tofDays - desired time of flight, days
 * @param {number} gm - central body's GM, AU^3/day^2
 * @param {{prograde?: boolean}} [options] - direction of motion around the
 *   central body; determines whether the "short way" or "long way" around
 *   satisfies that direction (default true - counterclockwise in x/y)
 * @returns {{v1:{vx:number,vy:number}, v2:{vx:number,vy:number}}}
 */
export function solveLambert(r1Vec, r2Vec, tofDays, gm, { prograde = true } = {}) {
  const r1 = Math.hypot(r1Vec.x, r1Vec.y);
  const r2 = Math.hypot(r2Vec.x, r2Vec.y);
  const crossZ = r1Vec.x * r2Vec.y - r1Vec.y * r2Vec.x;
  const cosDTheta = Math.min(1, Math.max(-1, (r1Vec.x * r2Vec.x + r1Vec.y * r2Vec.y) / (r1 * r2)));

  let dTheta = Math.acos(cosDTheta);
  const shortWaySatisfiesDirection = prograde ? crossZ >= 0 : crossZ < 0;
  if (!shortWaySatisfiesDirection) dTheta = TWO_PI - dTheta;

  const A = Math.sin(dTheta) * Math.sqrt((r1 * r2) / (1 - Math.cos(dTheta)));
  if (!Number.isFinite(A) || Math.abs(A) < 1e-10) {
    throw new Error('solveLambert: degenerate transfer geometry (departure and arrival points are colinear with the centre)');
  }

  const timeOfFlightForZ = (z) => {
    const { C, S } = stumpff(z);
    const y = r1 + r2 + (A * (z * S - 1)) / Math.sqrt(C);
    const chi = Math.sqrt(y / C);
    return (chi ** 3 * S + A * Math.sqrt(y)) / Math.sqrt(gm);
  };

  const zLo0 = 0;
  const zHi0 = TWO_PI ** 2 * (1 - 1e-9); // T(z) -> infinity as z -> (2*pi)^2
  const tAtZLo0 = timeOfFlightForZ(zLo0);
  if (tofDays < tAtZLo0) {
    throw new Error(
      `solveLambert: time of flight too short for a direct transfer along this path (minimum is about ${tAtZLo0.toFixed(1)} days)`
    );
  }

  let lo = zLo0;
  let hi = zHi0;
  for (let iter = 0; iter < 100; iter++) {
    const mid = (lo + hi) / 2;
    if (timeOfFlightForZ(mid) < tofDays) lo = mid;
    else hi = mid;
    if (hi - lo < 1e-9) break;
  }
  const z = (lo + hi) / 2;

  const { C, S } = stumpff(z);
  const y = r1 + r2 + (A * (z * S - 1)) / Math.sqrt(C);

  const f = 1 - y / r1;
  const g = (A * Math.sqrt(y)) / Math.sqrt(gm);
  const gDot = 1 - y / r2;

  return {
    v1: {
      vx: (r2Vec.x - f * r1Vec.x) / g,
      vy: (r2Vec.y - f * r1Vec.y) / g,
    },
    v2: {
      vx: (gDot * r2Vec.x - r1Vec.x) / g,
      vy: (gDot * r2Vec.y - r1Vec.y) / g,
    },
  };
}

/**
 * Sample a hyperbolic trajectory for drawing. Unlike an ellipse, a
 * hyperbola is unbounded, so this truncates the sampled true-anomaly
 * range to wherever the orbit reaches `maxRadiusAu`, rather than looping
 * a full revolution the way `sampleOrbitPath` does. Samples the full
 * symmetric arc (both the inbound and outbound halves); a caller that
 * only wants the outbound half after a burn at periapsis can slice the
 * returned array at its midpoint.
 * @param {object} elements - {a (negative), e (>=1), i, node, peri}
 * @param {number} maxRadiusAu - display cutoff radius, AU
 * @param {number} [steps=120] - number of points to sample
 * @returns {{x:number,y:number,z:number}[]}
 */
export function sampleHyperbolicArc(elements, maxRadiusAu, steps = 120) {
  const { a, e, i, node, peri } = elements;
  const p = a * (1 - e * e); // positive, as in hyperbolicStateAt

  // r(nu) = p / (1 + e*cos(nu)) <= maxRadiusAu  =>  cos(nu) >= (p/maxRadiusAu - 1) / e
  const cosNuCutoff = Math.min(1, Math.max(-1, (p / maxRadiusAu - 1) / e));
  const nuAtCutoff = Math.acos(cosNuCutoff);
  const nuAsymptote = Math.acos(-1 / e); // r -> infinity here; never quite reached
  const nuLimit = Math.min(nuAtCutoff, nuAsymptote * 0.999);

  const iRad = i * DEG2RAD;
  const nodeRad = node * DEG2RAD;
  const periRad = peri * DEG2RAD;

  const points = [];
  for (let s = 0; s <= steps; s++) {
    const nu = -nuLimit + ((2 * nuLimit) * s) / steps;
    const r = p / (1 + e * Math.cos(nu));
    const u = periRad + nu;
    const dir = orbitalPlaneDirection(u, iRad, nodeRad);
    points.push({ x: r * dir.x, y: r * dir.y, z: r * dir.z });
  }
  return points;
}

/**
 * Julian Date of the next periapsis passage at or after `afterJd`, for an
 * elliptical (periodic) orbit. Elliptical orbits only - a hyperbolic
 * trajectory passes periapsis exactly once, at a time already implied by
 * its own elements, and this app never needs to look that up separately.
 * @param {object} elements - elliptical elements (periodDays required)
 * @param {number} [afterJd=elements.epochJd]
 * @returns {number} Julian Date
 */
export function timeOfPeriapsisPassage(elements, afterJd = elements.epochJd) {
  const { meanAnomalyAtEpoch, epochJd, periodDays } = elements;
  const n = TWO_PI / periodDays;
  const M0 = meanAnomalyAtEpoch * DEG2RAD;

  let t = epochJd - M0 / n; // *a* periapsis time, possibly before afterJd
  if (t < afterJd) {
    t += Math.ceil((afterJd - t) / periodDays) * periodDays;
  }
  return t;
}
