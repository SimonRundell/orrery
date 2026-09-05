import { describe, it, expect } from 'vitest';
import { computeMission, sampleMissionAt } from './mission.js';
import { getBodyState } from './solarSystem.js';
import {
  GM_SUN,
  stateAt,
  timeOfPeriapsisPassage,
  auPerDayToKmPerSecond,
  kmPerSecondToAuPerDay,
} from './orbitalMechanics.js';
import { dateToJd } from './time.js';

const magnitude = (x, y) => Math.hypot(x, y);

describe('Halley rendezvous scenario', () => {
  it('a single transfer leg to Halley near its post-1986 aphelion produces a finite, plausible delta-v', () => {
    // Earth (1 AU) to Halley near its ~35 AU aphelion needs a long time
    // of flight - a direct transfer across that much distance has a
    // minimum (parabolic) time of flight of roughly 14-15 years, so the
    // launch date needs to be well before the arrival date.
    const launchJd = dateToJd(new Date(Date.UTC(1995, 0, 1)));
    const arrivalJd = dateToJd(new Date(Date.UTC(2023, 7, 1))); // Halley is slow and far out here

    const mission = computeMission([
      {
        type: 'transfer',
        fromBody: 'Earth',
        fromJd: launchJd,
        toBody: "Halley's Comet",
        toJd: arrivalJd,
        matchVelocityAtArrival: true,
        prograde: false, // Halley's real motion is retrograde; see README caveat on the 2D projection
      },
    ]);

    expect(Number.isFinite(mission.totalDeltaVKmPerS)).toBe(true);
    expect(mission.totalDeltaVKmPerS).toBeGreaterThan(0);
    // Generous ceiling: this is a sanity bound on the pipeline (catches
    // unit/sign bugs that would blow this up by orders of magnitude), not
    // a claim about mission-optimal delta-v - Halley's real ~18 degree
    // inclination is discarded by this app's 2D model, which can inflate
    // the numbers for this specific body (documented in the README).
    expect(mission.totalDeltaVKmPerS).toBeLessThan(150);

    const leg = mission.legs[0];
    expect(leg.travelElements.e).toBeGreaterThan(0);
    expect(leg.pathPoints.length).toBeGreaterThan(10);
  });
});

describe('Solar Oberth ("sundiver") scenario', () => {
  /**
   * Build a two-burn escape mission: burn 1 (retrograde, at Earth) drops
   * perihelion to `perihelionAu` while leaving aphelion at Earth's orbit;
   * burn 2 (prograde, at that new perihelion) is sized via vis-viva to
   * reach exactly `targetVInfinityKmPerS` of hyperbolic excess speed.
   * Returns the resolved mission so both burns' actual cost (as computed
   * by mission.js itself) can be inspected.
   */
  function buildSundiverMission(perihelionAu, targetVInfinityKmPerS) {
    const launchJd = dateToJd(new Date(Date.UTC(2026, 0, 1)));
    const earthState = getBodyState('Earth', launchJd);
    const earthR = magnitude(earthState.x, earthState.y);
    const earthSpeed = magnitude(earthState.vx, earthState.vy);

    const aDive = (earthR + perihelionAu) / 2;
    const speedNeededAtAphelion = Math.sqrt(GM_SUN * (2 / earthR - 1 / aDive));
    const burn1KmPerS = auPerDayToKmPerSecond(earthSpeed - speedNeededAtAphelion);

    const leg1 = { type: 'burn', fromBody: 'Earth', atJd: launchJd, deltaVKmPerS: burn1KmPerS, direction: 'retrograde' };
    const afterLeg1 = computeMission([leg1]);

    const periapsisJd = timeOfPeriapsisPassage(afterLeg1.legs[0].travelElements, launchJd);
    const atPeriapsis = stateAt(afterLeg1.legs[0].travelElements, periapsisJd);
    const speedBeforeBurn2 = magnitude(atPeriapsis.vx, atPeriapsis.vy);
    const rPeriapsis = magnitude(atPeriapsis.x, atPeriapsis.y);

    const targetVInfinityAuDay = kmPerSecondToAuPerDay(targetVInfinityKmPerS);
    const speedNeededAfterBurn2 = Math.sqrt(targetVInfinityAuDay ** 2 + (2 * GM_SUN) / rPeriapsis);
    const burn2KmPerS = auPerDayToKmPerSecond(speedNeededAfterBurn2 - speedBeforeBurn2);

    const leg2 = { type: 'burn', atJd: periapsisJd, deltaVKmPerS: burn2KmPerS, direction: 'prograde' };
    return computeMission([leg1, leg2]);
  }

  it('reaches the intended escape speed regardless of dive depth', () => {
    const targetVInfinity = 12; // km/s
    for (const perihelionAu of [0.8, 0.3]) {
      const mission = buildSundiverMission(perihelionAu, targetVInfinity);
      const finalLeg = mission.legs[mission.legs.length - 1];
      expect(finalLeg.travelElements.type).toBe('hyperbolic');

      // v-infinity is a property of the orbit's specific energy, which is
      // conserved - it can be read off exactly at the burn point itself,
      // rather than by propagating outward and measuring residual speed
      // (which always overstates v-infinity at any finite distance, per
      // vis-viva: v^2 = v_infinity^2 + 2*GM/r).
      const stateAtBurn = stateAt(finalLeg.travelElements, finalLeg.startJd);
      const speedAtBurn = magnitude(stateAtBurn.vx, stateAtBurn.vy);
      const rAtBurn = magnitude(stateAtBurn.x, stateAtBurn.y);
      const specificEnergy = speedAtBurn ** 2 / 2 - GM_SUN / rAtBurn;
      const vInfinityKmPerS = auPerDayToKmPerSecond(Math.sqrt(2 * specificEnergy));
      expect(vInfinityKmPerS).toBeCloseTo(targetVInfinity, 6);
    }
  });

  it('demonstrates the Oberth effect: a deeper dive costs less delta-v for the same escape speed', () => {
    const targetVInfinity = 12; // km/s
    const shallow = buildSundiverMission(0.8, targetVInfinity);
    const deep = buildSundiverMission(0.3, targetVInfinity);

    const shallowBurn2 = shallow.legs[1].deltaVKmPerS;
    const deepBurn2 = deep.legs[1].deltaVKmPerS;

    expect(deepBurn2).toBeLessThan(shallowBurn2);
  });
});

describe('gravityAssist leg', () => {
  it('bends the trajectory (turning angle > 0) at zero propellant cost', () => {
    const launchJd = dateToJd(new Date(Date.UTC(2026, 0, 1)));
    const arrivalJd = dateToJd(new Date(Date.UTC(2027, 6, 1)));

    const mission = computeMission([
      {
        type: 'transfer',
        fromBody: 'Earth',
        fromJd: launchJd,
        toBody: 'Jupiter',
        toJd: arrivalJd,
        matchVelocityAtArrival: false,
      },
      {
        type: 'gravityAssist',
        atBody: 'Jupiter',
        atJd: arrivalJd,
        periapsisAltitudeKm: 500000,
        side: 'leading',
      },
    ]);

    const assistLeg = mission.legs[1];
    expect(assistLeg.deltaVKmPerS).toBe(0);
    expect(assistLeg.turningAngleDeg).toBeGreaterThan(0);

    // Sanity: sampleMissionAt tracks continuously across the leg boundary.
    const justBefore = sampleMissionAt(mission, arrivalJd - 0.001);
    const justAfter = sampleMissionAt(mission, arrivalJd + 0.001);
    expect(magnitude(justAfter.x - justBefore.x, justAfter.y - justBefore.y)).toBeLessThan(0.01);
  });
});
