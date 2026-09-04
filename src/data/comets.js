/**
 * Irregular visitors (comets), described with the same Keplerian element
 * shape as planets and moons so they can be fed straight into
 * physics/kepler.js. To add another periodic comet, add an entry with its
 * semi-major axis (AU), eccentricity, inclination/node/argument of
 * perihelion (degrees), the Julian Date of a known perihelion passage
 * (mean anomaly is 0 at perihelion), and the orbital period in days.
 *
 * Note: the shared solver (solveKepler) handles elliptical orbits
 * (e < 1) only, which covers all known periodic comets such as Halley.
 * A near-parabolic one-time visitor would need a dedicated parabolic
 * solver, which is out of scope here.
 */

export const COMETS = [
  {
    name: "Halley's Comet",
    color: '#9fd6ff',
    visualRadiusPx: 2.2,
    a: 17.8341,
    e: 0.96714,
    i: 162.262,
    node: 58.42,
    peri: 111.33,
    meanAnomalyAtEpoch: 0,
    epochJd: 2446470.96, // 1986-02-09.46 UTC perihelion passage
    periodDays: 75.32 * 365.25636,
  },
];
