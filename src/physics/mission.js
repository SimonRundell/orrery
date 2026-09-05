/**
 * The mission planner's leg model: an ordered list of legs (transfer,
 * burn, gravity-assist) chained together into a probe trajectory, built
 * entirely on top of orbitalMechanics.js and solarSystem.js. Pure
 * calculation - no rendering here.
 *
 * Delta-v accounting throughout is heliocentric only (patched-conic
 * departure/arrival cost), not a full launch-from-surface budget - see
 * the README for why that's the right simplification for this tool.
 */

import { PLANETS } from '../data/planets.js';
import { getBodyState } from './solarSystem.js';
import {
  GM_SUN,
  AU_KM,
  solveLambert,
  elementsFromStateVector,
  stateAt,
  gmToAuDay,
  auPerDayToKmPerSecond,
  kmPerSecondToAuPerDay,
} from './orbitalMechanics.js';

const DISPLAY_CUTOFF_AU = 60; // comfortably beyond Pluto's aphelion, for drawing an escape tail

function magnitude(x, y) {
  return Math.hypot(x, y);
}

/** Resolve a single `transfer` leg via Lambert's problem. */
function computeTransferLeg(leg) {
  const fromState = getBodyState(leg.fromBody, leg.fromJd);
  const toState = getBodyState(leg.toBody, leg.toJd);
  const tofDays = leg.toJd - leg.fromJd;
  if (tofDays <= 0) {
    throw new Error('mission: a transfer leg\'s arrival date must be after its departure date');
  }

  const { v1, v2 } = solveLambert(fromState, toState, tofDays, GM_SUN, { prograde: leg.prograde !== false });

  const departureDeltaVAuDay = magnitude(v1.vx - fromState.vx, v1.vy - fromState.vy);
  const travelElements = elementsFromStateVector(fromState, v1, GM_SUN, leg.fromJd);

  let endVx = v2.vx;
  let endVy = v2.vy;
  let arrivalDeltaVAuDay = 0;
  if (leg.matchVelocityAtArrival) {
    arrivalDeltaVAuDay = magnitude(v2.vx - toState.vx, v2.vy - toState.vy);
    endVx = toState.vx;
    endVy = toState.vy;
  }

  const departureDeltaVKmPerS = auPerDayToKmPerSecond(departureDeltaVAuDay);
  const arrivalDeltaVKmPerS = auPerDayToKmPerSecond(arrivalDeltaVAuDay);

  return {
    ...leg,
    startJd: leg.fromJd,
    endJd: leg.toJd,
    travelElements,
    endState: { x: toState.x, y: toState.y, vx: endVx, vy: endVy },
    departureDeltaVKmPerS,
    arrivalDeltaVKmPerS,
    deltaVKmPerS: departureDeltaVKmPerS + arrivalDeltaVKmPerS,
  };
}

/** Resolve a single `burn` leg: an instantaneous velocity change. */
function computeBurnLeg(leg, isFirstLeg, currentElements) {
  const stateBefore = isFirstLeg ? getBodyState(leg.fromBody, leg.atJd) : stateAt(currentElements, leg.atJd);

  const speed = magnitude(stateBefore.vx, stateBefore.vy);
  const sign = leg.direction === 'retrograde' ? -1 : 1;
  const deltaVAuDay = kmPerSecondToAuPerDay(leg.deltaVKmPerS) * sign;

  const newVx = stateBefore.vx + (deltaVAuDay * stateBefore.vx) / speed;
  const newVy = stateBefore.vy + (deltaVAuDay * stateBefore.vy) / speed;

  const travelElements = elementsFromStateVector(
    { x: stateBefore.x, y: stateBefore.y },
    { vx: newVx, vy: newVy },
    GM_SUN,
    leg.atJd
  );

  return {
    ...leg,
    startJd: leg.atJd,
    endJd: leg.atJd,
    travelElements,
    endState: { x: stateBefore.x, y: stateBefore.y, vx: newVx, vy: newVy },
    deltaVKmPerS: Math.abs(leg.deltaVKmPerS),
  };
}

/** Rotate a 2D vector by `angleRad`. */
function rotate2d(v, angleRad) {
  const cos = Math.cos(angleRad);
  const sin = Math.sin(angleRad);
  return { x: v.x * cos - v.y * sin, y: v.x * sin + v.y * cos };
}

/**
 * Resolve a single `gravityAssist` leg: real momentum exchange with a
 * moving planet, at zero propellant cost. The planet's own position at
 * `atJd` is treated as the patch point (the standard, point-mass
 * simplification of a sphere-of-influence transit).
 */
function computeGravityAssistLeg(leg, currentElements) {
  const planet = PLANETS.find((p) => p.name === leg.atBody);
  if (!planet) throw new Error(`mission: unknown gravity-assist body "${leg.atBody}"`);

  const planetState = getBodyState(leg.atBody, leg.atJd);
  const probeStateBefore = stateAt(currentElements, leg.atJd);

  const vInfIn = { x: probeStateBefore.vx - planetState.vx, y: probeStateBefore.vy - planetState.vy };
  const vInfMag = magnitude(vInfIn.x, vInfIn.y);

  const planetGm = gmToAuDay(planet.gmKm3PerS2);
  const minSafeAltitudeKm = 200; // arbitrary but reasonable "don't hit the atmosphere/surface" floor
  const periapsisAltitudeKm = Math.max(leg.periapsisAltitudeKm, minSafeAltitudeKm);
  const rpAu = (planet.radiusKm + periapsisAltitudeKm) / AU_KM;

  const eHyperbolic = 1 + (rpAu * vInfMag ** 2) / planetGm;
  const turningAngle = 2 * Math.asin(1 / eHyperbolic);
  const signedAngle = leg.side === 'trailing' ? -turningAngle : turningAngle;

  const vInfOut = rotate2d(vInfIn, signedAngle);
  const vOut = { vx: planetState.vx + vInfOut.x, vy: planetState.vy + vInfOut.y };

  const travelElements = elementsFromStateVector(
    { x: planetState.x, y: planetState.y },
    vOut,
    GM_SUN,
    leg.atJd
  );

  return {
    ...leg,
    startJd: leg.atJd,
    endJd: leg.atJd,
    travelElements,
    endState: { x: planetState.x, y: planetState.y, vx: vOut.vx, vy: vOut.vy },
    deltaVKmPerS: 0,
    turningAngleDeg: (turningAngle * 180) / Math.PI,
  };
}

/** Sample an elliptical or hyperbolic orbit's path between two dates. */
function sampleArcByDate(elements, jd1, jd2, steps = 150) {
  const points = [];
  for (let s = 0; s <= steps; s++) {
    const jd = jd1 + ((jd2 - jd1) * s) / steps;
    const state = stateAt(elements, jd);
    points.push({ x: state.x, y: state.y });
  }
  return points;
}

/** Pick a sensible "draw until" date for a leg with no natural end (a
 * burn/gravity-assist result, rather than a bounded transfer arc). */
function defaultTailEndJd(leg) {
  if (leg.travelElements.type === 'hyperbolic') {
    let jd = leg.startJd;
    for (let i = 0; i < 3000; i++) {
      jd += 20;
      const state = stateAt(leg.travelElements, jd);
      if (magnitude(state.x, state.y) > DISPLAY_CUTOFF_AU) break;
    }
    return jd;
  }
  return leg.startJd + leg.travelElements.periodDays;
}

/**
 * Resolve an ordered list of legs into a full mission: each leg's
 * resulting orbit, end state, delta-v cost, running total, and a drawable
 * path per leg.
 * @param {object[]} legs - transfer/burn/gravityAssist leg descriptors
 * @returns {{legs: object[], totalDeltaVKmPerS: number}}
 */
export function computeMission(legs) {
  let currentElements = null;
  let totalDeltaVKmPerS = 0;
  const resolved = [];

  legs.forEach((leg, idx) => {
    let result;
    if (leg.type === 'transfer') {
      result = computeTransferLeg(leg);
    } else if (leg.type === 'burn') {
      if (idx === 0 && !leg.fromBody) {
        throw new Error('mission: the first leg must be a transfer, or a burn with fromBody set');
      }
      result = computeBurnLeg(leg, idx === 0, currentElements);
    } else if (leg.type === 'gravityAssist') {
      if (idx === 0) {
        throw new Error('mission: a gravity-assist cannot be the first leg (there is no prior trajectory to bend)');
      }
      result = computeGravityAssistLeg(leg, currentElements);
    } else {
      throw new Error(`mission: unknown leg type "${leg.type}"`);
    }

    totalDeltaVKmPerS += result.deltaVKmPerS;
    currentElements = result.travelElements;
    resolved.push(result);
  });

  // sampleArcByDate dispatches on conic type via stateAt, and
  // defaultTailEndJd already resolves a sensible cutoff date for an
  // unbounded hyperbolic tail, so a single date-based sampler covers
  // every leg/conic combination without needing a true-anomaly-range
  // special case for hyperbolic legs.
  resolved.forEach((leg, idx) => {
    const nextLeg = resolved[idx + 1];
    const drawEndJd = nextLeg ? nextLeg.startJd : defaultTailEndJd(leg);
    leg.pathPoints = sampleArcByDate(leg.travelElements, leg.startJd, drawEndJd);
  });

  return { legs: resolved, totalDeltaVKmPerS };
}

/**
 * The mission-mode analogue of solarSystem.js's `computeSystem(jd)`:
 * find where the probe is at an arbitrary date, for TimeControls
 * scrubbing/animation. Returns null before the mission's first leg
 * starts.
 * @param {{legs: object[]}} resolvedMission - as returned by computeMission
 * @param {number} jd - Julian Date
 */
export function sampleMissionAt(resolvedMission, jd) {
  const { legs } = resolvedMission;
  if (legs.length === 0 || jd < legs[0].startJd) return null;

  for (let idx = 0; idx < legs.length; idx++) {
    const leg = legs[idx];
    const nextLeg = legs[idx + 1];
    const segmentEnd = nextLeg ? nextLeg.startJd : Infinity;
    if (jd >= leg.startJd && jd < segmentEnd) {
      return stateAt(leg.travelElements, jd);
    }
  }
  const lastLeg = legs[legs.length - 1];
  return stateAt(lastLeg.travelElements, jd);
}
