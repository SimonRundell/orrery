/**
 * Low-precision Keplerian elements for the planets (and Pluto), valid for
 * roughly 1800-2050 AD. Source: JPL Solar System Dynamics "Keplerian
 * Elements for Approximate Positions of the Major Planets".
 *
 * Fields (angles in degrees, a in AU):
 *  a, aDot        - semi-major axis and its rate per Julian century
 *  e, eDot        - eccentricity and its rate
 *  i, iDot        - inclination to the ecliptic and its rate
 *  L, LDot        - mean longitude and its rate
 *  longPeri, longPeriDot - longitude of periapsis (varpi) and its rate
 *  node, nodeDot  - longitude of ascending node (Omega) and its rate
 *
 * `visualRadiusPx` is a display-only marker size (true diameters are far
 * too small to see at solar-system scale) and `color` is used for both the
 * marker and its orbit path.
 *
 * `gmKm3PerS2` (standard gravitational parameter, GM) and `radiusKm` (mean
 * equatorial radius) are real physical values, used by the mission-planner
 * physics (gravity-assist turning angle, sphere-of-influence radius,
 * minimum safe flyby altitude). Source: NASA/JPL planetary fact sheets.
 */

export const PLANETS = [
  {
    name: 'Mercury',
    color: '#b1adad',
    visualRadiusPx: 3.2,
    gmKm3PerS2: 22032,
    radiusKm: 2440.5,
    a: 0.38709927, aDot: 0.00000037,
    e: 0.20563593, eDot: 0.00001906,
    i: 7.00497902, iDot: -0.00594749,
    L: 252.25032350, LDot: 149472.67411175,
    longPeri: 77.45779628, longPeriDot: 0.16047689,
    node: 48.33076593, nodeDot: -0.12534081,
  },
  {
    name: 'Venus',
    color: '#e8cda2',
    visualRadiusPx: 5.6,
    gmKm3PerS2: 324859,
    radiusKm: 6051.8,
    a: 0.72333566, aDot: 0.00000390,
    e: 0.00677672, eDot: -0.00004107,
    i: 3.39467605, iDot: -0.00078890,
    L: 181.97909950, LDot: 58517.81538729,
    longPeri: 131.60246718, longPeriDot: 0.00268329,
    node: 76.67984255, nodeDot: -0.27769418,
  },
  {
    name: 'Earth',
    color: '#4d97ff',
    visualRadiusPx: 6,
    gmKm3PerS2: 398600.4418,
    radiusKm: 6378.137,
    a: 1.00000261, aDot: 0.00000562,
    e: 0.01671123, eDot: -0.00004392,
    i: -0.00001531, iDot: -0.01294668,
    L: 100.46457166, LDot: 35999.37244981,
    longPeri: 102.93768193, longPeriDot: 0.32327364,
    node: 0.0, nodeDot: 0.0,
  },
  {
    name: 'Mars',
    color: '#c1440e',
    visualRadiusPx: 4,
    gmKm3PerS2: 42828.37,
    radiusKm: 3396.2,
    a: 1.52371034, aDot: 0.00001847,
    e: 0.09339410, eDot: 0.00007882,
    i: 1.84969142, iDot: -0.00813131,
    L: -4.55343205, LDot: 19140.30268499,
    longPeri: -23.94362959, longPeriDot: 0.44441088,
    node: 49.55953891, nodeDot: -0.29257343,
  },
  {
    name: 'Jupiter',
    color: '#d8ae82',
    visualRadiusPx: 13,
    gmKm3PerS2: 126686534,
    radiusKm: 71492,
    a: 5.20288700, aDot: -0.00011607,
    e: 0.04838624, eDot: -0.00013253,
    i: 1.30439695, iDot: -0.00183714,
    L: 34.39644051, LDot: 3034.74612775,
    longPeri: 14.72847983, longPeriDot: 0.21252668,
    node: 100.47390909, nodeDot: 0.20469106,
  },
  {
    name: 'Saturn',
    color: '#e3c88f',
    visualRadiusPx: 11,
    gmKm3PerS2: 37931187,
    radiusKm: 60268,
    a: 9.53667594, aDot: -0.00125060,
    e: 0.05386179, eDot: -0.00050991,
    i: 2.48599187, iDot: 0.00193609,
    L: 49.95424423, LDot: 1222.49362201,
    longPeri: 92.59887831, longPeriDot: -0.41897216,
    node: 113.66242448, nodeDot: -0.28867794,
  },
  {
    name: 'Uranus',
    color: '#9fe3e3',
    visualRadiusPx: 8,
    gmKm3PerS2: 5793939,
    radiusKm: 25559,
    a: 19.18916464, aDot: -0.00196176,
    e: 0.04725744, eDot: -0.00004397,
    i: 0.77263783, iDot: -0.00242939,
    L: 313.23810451, LDot: 428.48202785,
    longPeri: 170.95427630, longPeriDot: 0.40805281,
    node: 74.01692503, nodeDot: 0.04240589,
  },
  {
    name: 'Neptune',
    color: '#5b7fe8',
    visualRadiusPx: 7.8,
    gmKm3PerS2: 6836529,
    radiusKm: 24764,
    a: 30.06992276, aDot: 0.00026291,
    e: 0.00859048, eDot: 0.00005105,
    i: 1.77004347, iDot: 0.00035372,
    L: -55.12002969, LDot: 218.45945325,
    longPeri: 44.96476227, longPeriDot: -0.32241464,
    node: 131.78422574, nodeDot: -0.00508664,
  },
  {
    name: 'Pluto',
    color: '#cbb8a6',
    visualRadiusPx: 2.6,
    dwarf: true,
    gmKm3PerS2: 869.6,
    radiusKm: 1188.3,
    a: 39.48211675, aDot: -0.00031596,
    e: 0.24882730, eDot: 0.00005170,
    i: 17.14001206, iDot: 0.00004818,
    L: 238.92903833, LDot: 145.20780515,
    longPeri: 224.06891629, longPeriDot: -0.04062942,
    node: 110.30393684, nodeDot: -0.01183482,
  },
];
