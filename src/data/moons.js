/**
 * Major moons, grouped by parent planet. Orbital elements (a in km, angles
 * in degrees, period in days) are approximate mean values, referenced to
 * J2000.0. To keep the dataset compact only the best-known major moons are
 * included, rather than every catalogued satellite.
 *
 * Caveat: semi-major axis, eccentricity and period are drawn from published
 * mean elements and are reliable. The starting orbital phase
 * (`meanAnomalyAtEpoch`) for anything other than Earth's Moon is not backed
 * by a precise ephemeris - it is spread out arbitrarily so the moons don't
 * all line up, so a moon's position on a given date is illustrative of the
 * orbit's shape, size and period (and of resonances between moons) rather
 * than its exact real-world position in the sky.
 */

export const AU_KM = 149597870.7;
export const J2000_JD = 2451545.0;

function moon(name, color, a, e, i, periodDays, phaseSeed) {
  return {
    name,
    color,
    a: a / AU_KM,
    e,
    i,
    node: 0,
    peri: 0,
    meanAnomalyAtEpoch: (phaseSeed * 47) % 360,
    epochJd: J2000_JD,
    periodDays,
    visualRadiusPx: 1.8,
  };
}

export const MOONS = {
  Earth: [
    moon('Moon', '#d6d6d6', 384400, 0.0549, 5.145, 27.321661, 3),
  ],
  Mars: [
    moon('Phobos', '#a99', 9376, 0.0151, 1.093, 0.31891, 1),
    moon('Deimos', '#a99', 23463, 0.0002, 0.93, 1.26244, 2),
  ],
  Jupiter: [
    moon('Io', '#e8d27a', 421800, 0.0041, 0.036, 1.769138, 1),
    moon('Europa', '#c9b98a', 671100, 0.0090, 0.466, 3.551181, 2),
    moon('Ganymede', '#9a8f7d', 1070400, 0.0013, 0.177, 7.154553, 3),
    moon('Callisto', '#6f6656', 1882700, 0.0074, 0.192, 16.68902, 4),
  ],
  Saturn: [
    moon('Mimas', '#cfcfcf', 185540, 0.0196, 1.574, 0.942, 1),
    moon('Enceladus', '#eaeaea', 238040, 0.0047, 0.009, 1.370, 2),
    moon('Tethys', '#d4d4d4', 294670, 0.0001, 1.091, 1.888, 3),
    moon('Dione', '#cacaca', 377420, 0.0022, 0.028, 2.737, 4),
    moon('Rhea', '#c2c2c2', 527070, 0.0013, 0.333, 4.518, 5),
    moon('Titan', '#e0b45c', 1221870, 0.0288, 0.306, 15.945, 6),
    moon('Iapetus', '#8a8272', 3560820, 0.0286, 15.47, 79.32, 7),
  ],
  Uranus: [
    moon('Miranda', '#b7c6cc', 129390, 0.0013, 4.338, 1.413, 1),
    moon('Ariel', '#c3d2d6', 190900, 0.0012, 0.041, 2.520, 2),
    moon('Umbriel', '#8d9a9e', 266000, 0.0039, 0.128, 4.144, 3),
    moon('Titania', '#a9b6ba', 436300, 0.0011, 0.079, 8.706, 4),
    moon('Oberon', '#9ea9ac', 583500, 0.0014, 0.068, 13.463, 5),
  ],
  Neptune: [
    moon('Triton', '#bcd7e0', 354759, 0.000016, 156.885, 5.876854, 1),
    moon('Nereid', '#9fb8c2', 5504000, 0.7507, 7.09, 360.13, 2),
  ],
  Pluto: [
    moon('Charon', '#a89f96', 19591, 0.0002, 0.08, 6.3872, 1),
  ],
};
