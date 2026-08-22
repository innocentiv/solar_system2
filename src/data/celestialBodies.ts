/**
 * Celestial body data.
 *
 * Orbital elements are the JPL Keplerian elements for the approximate
 * positions of the major planets (E. M. Standish, 2022), evaluated at the
 * J2000.0 epoch (2000-01-01 12:00 TT) with linear rates of change per
 * century. Accurate to within ~0.01 AU for all outer planets over
 * several centuries — more than sufficient for visualization.
 */

export interface OrbitalElements {
  /** Semi-major axis (AU) at J2000 */
  a: number;
  /** Eccentricity at J2000 */
  e: number;
  /** Inclination to ecliptic (deg) */
  i: number;
  /** Mean longitude (deg) */
  L: number;
  /** Longitude of perihelion (deg) */
  varpi: number;
  /** Longitude of ascending node (deg) */
  Omega: number;
  /** Secular rates per century: da/dt (AU/century), dL/dt, dvarpi/dt, dOmega/dt (deg/century) */
  rates: { da: number; dL: number; dvarpi: number; dOmega: number };
}

export interface BodyFacts {
  diameterKm: number;
  massKg: string;
  orbitalPeriod: string;
  dayLength: string;
  distanceFromSun: string;
  temperature: string;
  moons: number;
  axialTiltDeg: number;
  description: string;
}

export type BodyKind = "star" | "planet" | "moon";

export interface CelestialBodyDef {
  id: string;
  name: string;
  kind: BodyKind;
  /** Parent body id for moons; null for heliocentric bodies */
  parent: string | null;
  /** True mean radius (km) — scene radius is derived at true scale */
  radiusKm: number;
  elements: OrbitalElements | null;
  /** Sidereal rotation period (days, negative = retrograde) */
  rotationPeriodDays: number;
  /** Axial tilt (deg) */
  axialTiltDeg: number;
  facts: BodyFacts;
}

const AU = 60; // scene units per AU

/** Sun (fixed at origin) */
export const SUN: CelestialBodyDef = {
  id: "sun",
  name: "Sun",
  kind: "star",
  parent: null,
  radiusKm: 696340,
  elements: null,
  rotationPeriodDays: 25.38,
  axialTiltDeg: 7.25,
  facts: {
    diameterKm: 1392700,
    massKg: "1.989 × 10³⁰ kg",
    orbitalPeriod: "— (center of mass)",
    dayLength: "25.4 Earth days (equatorial)",
    distanceFromSun: "—",
    temperature: "5,505 °C (surface)",
    moons: 0,
    axialTiltDeg: 7.25,
    description:
      "The Sun is a G2V main-sequence star containing 99.86% of the mass of the solar system. " +
      "Its core fuses ~600 million tons of hydrogen into helium every second, releasing the light " +
      "and energy that sustain life on Earth.",
  },
};

const planets: CelestialBodyDef[] = [
  {
    id: "mercury",
    name: "Mercury",
    kind: "planet",
    parent: null,
    radiusKm: 2439.7,
    elements: {
      a: 0.38709893,
      e: 0.20563069,
      i: 7.00487,
      L: 252.25084,
      varpi: 77.457796,
      Omega: 48.330765,
      rates: {
        da: -0.0000003,
        dL: 149472.67411,
        dvarpi: 0.1604768,
        dOmega: -0.1253408,
      },
    },
    rotationPeriodDays: 58.646,
    axialTiltDeg: 0.034,
    facts: {
      diameterKm: 4879,
      massKg: "3.301 × 10²³ kg",
      orbitalPeriod: "87.97 days",
      dayLength: "58.65 Earth days (rotation)",
      distanceFromSun: "0.387 AU (57.9 million km)",
      temperature: "-173 to 427 °C",
      moons: 0,
      axialTiltDeg: 0.034,
      description:
        "The smallest planet and closest to the Sun. Mercury's highly eccentric orbit and slow " +
        "3:2 spin-orbit resonance give surface temperatures that swing by over 600 °C between day " +
        "and night. Its heavily cratered surface resembles Earth's Moon.",
    },
  },
  {
    id: "moon",
    name: "Moon",
    kind: "moon",
    parent: "earth",
    radiusKm: 1737.4,
    elements: {
      // Mean elements for the Moon's orbit about Earth (approximate)
      a: 0.00257,
      e: 0.0549,
      i: 5.145,
      L: 215.315,
      varpi: 318.15,
      Omega: 125.08,
      rates: { da: 0, dL: 390620.1, dvarpi: 4069.0, dOmega: -200.7 },
    },
    rotationPeriodDays: 27.3217, // tidally locked
    axialTiltDeg: 6.68,
    facts: {
      diameterKm: 3474.8,
      massKg: "7.346 × 10²² kg",
      orbitalPeriod: "27.32 days (sidereal)",
      dayLength: "29.5 Earth days (synchronous rotation)",
      distanceFromSun: "~1 AU (orbits Earth)",
      temperature: "-173 to 127 °C",
      moons: 0,
      axialTiltDeg: 6.68,
      description:
        "Earth's only natural satellite, formed ~4.5 billion years ago in a giant impact. It is " +
        "tidally locked, always showing the same face to Earth. Its gravity drives the ocean tides " +
        "and stabilizes Earth's axial tilt.",
    },
  },
  {
    id: "venus",
    name: "Venus",
    kind: "planet",
    parent: null,
    radiusKm: 6051.8,
    elements: {
      a: 0.72333199,
      e: 0.00677323,
      i: 3.394626,
      L: 181.97909,
      varpi: 131.53298,
      Omega: 76.679842,
      rates: {
        da: 0.0000025,
        dL: 58517.81538,
        dvarpi: 0.0026832,
        dOmega: -0.2776941,
      },
    },
    rotationPeriodDays: -243.025, // retrograde
    axialTiltDeg: 177.36,
    facts: {
      diameterKm: 12104,
      massKg: "4.867 × 10²⁴ kg",
      orbitalPeriod: "224.7 days",
      dayLength: "243 Earth days (retrograde)",
      distanceFromSun: "0.723 AU (108.2 million km)",
      temperature: "464 °C (mean surface)",
      moons: 0,
      axialTiltDeg: 177.36,
      description:
        "Venus is the hottest planet: a runaway greenhouse effect under thick CO₂ clouds traps " +
        "enough heat to melt lead. It spins backwards, and one Venusian day is longer than its " +
        "year. Its surface pressure is 92× that of Earth.",
    },
  },
  {
    id: "earth",
    name: "Earth",
    kind: "planet",
    parent: null,
    radiusKm: 6371,
    elements: {
      a: 1.00000011,
      e: 0.01671022,
      i: 0.00005,
      L: 100.46435,
      varpi: 102.93735,
      Omega: 0.0,
      rates: {
        da: 0.0000057,
        dL: 35999.37245,
        dvarpi: 0.3232736,
        dOmega: -0.2110559,
      },
    },
    rotationPeriodDays: 0.99727,
    axialTiltDeg: 23.44,
    facts: {
      diameterKm: 12742,
      massKg: "5.972 × 10²⁴ kg",
      orbitalPeriod: "365.26 days",
      dayLength: "23.93 hours",
      distanceFromSun: "1.000 AU (149.6 million km)",
      temperature: "15 °C (mean surface)",
      moons: 1,
      axialTiltDeg: 23.44,
      description:
        "The only known world with life. Liquid-water oceans cover 71% of the surface, and an " +
        "oxygen-rich atmosphere — a product of billions of years of biology — shields the " +
        "surface from harmful ultraviolet radiation.",
    },
  },
  {
    id: "mars",
    name: "Mars",
    kind: "planet",
    parent: null,
    radiusKm: 3389.5,
    elements: {
      a: 1.52366231,
      e: 0.09341233,
      i: 1.85061,
      L: 355.44719,
      varpi: 336.04084,
      Omega: 49.578536,
      rates: {
        da: 0.0000162,
        dL: 19140.30268,
        dvarpi: 0.4444108,
        dOmega: -0.2925734,
      },
    },
    rotationPeriodDays: 1.02596,
    axialTiltDeg: 25.19,
    facts: {
      diameterKm: 6779,
      massKg: "6.417 × 10²³ kg",
      orbitalPeriod: "686.98 days",
      dayLength: "24.62 hours",
      distanceFromSun: "1.524 AU (227.9 million km)",
      temperature: "-63 °C (mean surface)",
      moons: 2,
      axialTiltDeg: 25.19,
      description:
        "The Red Planet owes its color to iron-oxide dust. It hosts the tallest volcano in the " +
        "solar system (Olympus Mons, ~21 km) and a canyon system (Valles Marineris) that would " +
        "stretch across the United States. Evidence shows liquid water once flowed on its surface.",
    },
  },
  {
    id: "phobos",
    name: "Phobos",
    kind: "moon",
    parent: "mars",
    radiusKm: 11.2,
    elements: {
      a: 6.267e-5,
      e: 0.0151,
      i: 1.08,
      L: 200,
      varpi: 300,
      Omega: 90,
      rates: { da: 0, dL: 4.124e7, dvarpi: 0, dOmega: 0 },
    },
    rotationPeriodDays: 0.31888, // tidally locked
    axialTiltDeg: 0,
    facts: {
      diameterKm: 22.5,
      massKg: "1.07 × 10¹⁶ kg",
      orbitalPeriod: "0.319 days (7.7 hours)",
      dayLength: "7.7 hours (synchronous rotation)",
      distanceFromSun: "~1.5 AU (orbits Mars)",
      temperature: "-180 to -80 °C",
      moons: 0,
      axialTiltDeg: 0,
      description:
        "Mars's inner moon, only ~22 km across. It orbits so close and so fast that it circles " +
        "Mars in under 8 hours — faster than Mars rotates, so it rises in the west and sets in " +
        "the east. Tidal forces are slowly pulling it in: it will spiral into Mars in ~50 million years.",
    },
  },
  {
    id: "deimos",
    name: "Deimos",
    kind: "moon",
    parent: "mars",
    radiusKm: 6.2,
    elements: {
      a: 1.5684e-4,
      e: 0.0006,
      i: 1.79,
      L: 310,
      varpi: 50,
      Omega: 120,
      rates: { da: 0, dL: 1.042e7, dvarpi: 0, dOmega: 0 },
    },
    rotationPeriodDays: 1.2624, // tidally locked
    axialTiltDeg: 0,
    facts: {
      diameterKm: 12.4,
      massKg: "1.51 × 10¹⁵ kg",
      orbitalPeriod: "1.26 days (30.3 hours)",
      dayLength: "30.3 hours (synchronous rotation)",
      distanceFromSun: "~1.5 AU (orbits Mars)",
      temperature: "-180 to -80 °C",
      moons: 0,
      axialTiltDeg: 0,
      description:
        "Mars's outer moon, ~12 km across — small enough to fit inside most cities. Like Phobos " +
        "it is irregularly shaped and dark, and it is probably a captured asteroid from the main belt. " +
        "It is slowly drifting away from Mars.",
    },
  },
  {
    id: "jupiter",
    name: "Jupiter",
    kind: "planet",
    parent: null,
    radiusKm: 69911,
    elements: {
      a: 5.20336301,
      e: 0.04849844,
      i: 1.305308,
      L: 34.39644,
      varpi: 14.75385,
      Omega: 100.473909,
      rates: {
        da: -0.000116,
        dL: 3034.74613,
        dvarpi: 0.2125266,
        dOmega: 0.204691,
      },
    },
    rotationPeriodDays: 0.41354,
    axialTiltDeg: 3.13,
    facts: {
      diameterKm: 139820,
      massKg: "1.898 × 10²⁷ kg",
      orbitalPeriod: "11.86 years",
      dayLength: "9.93 hours (fastest of all planets)",
      distanceFromSun: "5.203 AU (778.5 million km)",
      temperature: "-108 °C (cloud tops)",
      moons: 95,
      axialTiltDeg: 3.13,
      description:
        "A gas giant more massive than all other planets combined. The Great Red Spot is a " +
        "storm larger than Earth that has raged for at least 190 years. Jupiter's strong " +
        "magnetosphere and radiation belts are the largest magnetic structure in the solar system.",
    },
  },
  {
    id: "io",
    name: "Io",
    kind: "moon",
    parent: "jupiter",
    radiusKm: 1821.6,
    elements: {
      a: 0.0028187,
      e: 0.0041,
      i: 0.04,
      L: 120,
      varpi: 120,
      Omega: 0,
      rates: { da: 0, dL: 7.432e6, dvarpi: 0, dOmega: 0 },
    },
    rotationPeriodDays: 1.76914, // tidally locked
    axialTiltDeg: 0,
    facts: {
      diameterKm: 3643.2,
      massKg: "8.932 × 10²² kg",
      orbitalPeriod: "1.77 days",
      dayLength: "42.5 hours (synchronous rotation)",
      distanceFromSun: "~5.2 AU (orbits Jupiter)",
      temperature: "-143 °C (surface)",
      moons: 0,
      axialTiltDeg: 0,
      description:
        "The most volcanic world in the solar system. Jupiter's tidal flexing heats Io's interior, " +
        "driving ~400 active volcanoes that blanketed the surface in sulfur and sulfur dioxide — " +
        "no craters, no water. Its plumes rise 300+ km into space.",
    },
  },
  {
    id: "europa",
    name: "Europa",
    kind: "moon",
    parent: "jupiter",
    radiusKm: 1560.8,
    elements: {
      a: 0.0044857,
      e: 0.009,
      i: 0.47,
      L: 200,
      varpi: 200,
      Omega: 0,
      rates: { da: 0, dL: 3.703e6, dvarpi: 0, dOmega: 0 },
    },
    rotationPeriodDays: 3.55118, // tidally locked
    axialTiltDeg: 0,
    facts: {
      diameterKm: 3121.6,
      massKg: "4.800 × 10²² kg",
      orbitalPeriod: "3.55 days",
      dayLength: "85.3 hours (synchronous rotation)",
      distanceFromSun: "~5.2 AU (orbits Jupiter)",
      temperature: "-160 °C (surface)",
      moons: 0,
      axialTiltDeg: 0,
      description:
        "A cracked shell of water ice over a global saltwater ocean — likely holding twice the " +
        "water of Earth's seas. The red-brown streaks on its otherwise blank surface are fissures " +
        "where salty ice has welled up. A top candidate in the search for life beyond Earth.",
    },
  },
  {
    id: "ganymede",
    name: "Ganymede",
    kind: "moon",
    parent: "jupiter",
    radiusKm: 2634.1,
    elements: {
      a: 0.0071552,
      e: 0.0013,
      i: 0.2,
      L: 300,
      varpi: 300,
      Omega: 0,
      rates: { da: 0, dL: 1.838e6, dvarpi: 0, dOmega: 0 },
    },
    rotationPeriodDays: 7.15456, // tidally locked
    axialTiltDeg: 0,
    facts: {
      diameterKm: 5268.2,
      massKg: "1.4819 × 10²³ kg",
      orbitalPeriod: "7.15 days",
      dayLength: "171.7 hours (synchronous rotation)",
      distanceFromSun: "~5.2 AU (orbits Jupiter)",
      temperature: "-163 °C (surface)",
      moons: 0,
      axialTiltDeg: 0,
      description:
        "The largest moon in the solar system — bigger than the planet Mercury, and the only " +
        "moon with its own intrinsic magnetic field. Its surface mixes dark, ancient terrain with " +
        "bright, grooved ice. It likely hides a deep saline ocean beneath its crust.",
    },
  },
  {
    id: "callisto",
    name: "Callisto",
    kind: "moon",
    parent: "jupiter",
    radiusKm: 2410.3,
    elements: {
      a: 0.0125848,
      e: 0.0074,
      i: 0.19,
      L: 60,
      varpi: 60,
      Omega: 0,
      rates: { da: 0, dL: 7.879e5, dvarpi: 0, dOmega: 0 },
    },
    rotationPeriodDays: 16.689, // tidally locked
    axialTiltDeg: 0,
    facts: {
      diameterKm: 4820.6,
      massKg: "1.0759 × 10²³ kg",
      orbitalPeriod: "16.69 days",
      dayLength: "400.5 hours (synchronous rotation)",
      distanceFromSun: "~5.2 AU (orbits Jupiter)",
      temperature: "-155 °C (surface)",
      moons: 0,
      axialTiltDeg: 0,
      description:
        "The most heavily cratered body in the solar system — its surface is so ancient and " +
        "saturated that new impacts erase as many craters as they create. Bright starburst marks " +
        "like Valhalla are giant impact scars. Like Europa, it may harbor a subsurface ocean.",
    },
  },
  {
    id: "saturn",
    name: "Saturn",
    kind: "planet",
    parent: null,
    radiusKm: 58232,
    elements: {
      a: 9.53707032,
      e: 0.05554629,
      i: 2.484464,
      L: 49.95424,
      varpi: 92.431944,
      Omega: 113.662424,
      rates: {
        da: -0.00125,
        dL: 1222.49362,
        dvarpi: -0.4189721,
        dOmega: -0.2886779,
      },
    },
    rotationPeriodDays: 0.44401,
    axialTiltDeg: 26.73,
    facts: {
      diameterKm: 116460,
      massKg: "5.683 × 10²⁶ kg",
      orbitalPeriod: "29.45 years",
      dayLength: "10.7 hours",
      distanceFromSun: "9.537 AU (1.43 billion km)",
      temperature: "-138 °C (cloud tops)",
      moons: 146,
      axialTiltDeg: 26.73,
      description:
        "Famous for its spectacular ring system, made of billions of ice and rock fragments from " +
        "dust-sized grains to ~1 km boulders. Saturn is the least dense planet — it would float in " +
        "a bathtub large enough to hold it. Its moon Titan has a thick nitrogen atmosphere.",
    },
  },
  {
    id: "titan",
    name: "Titan",
    kind: "moon",
    parent: "saturn",
    radiusKm: 2574.7,
    elements: {
      a: 0.0081675,
      e: 0.0288,
      i: 0.35,
      L: 150,
      varpi: 150,
      Omega: 0,
      rates: { da: 0, dL: 8.246e5, dvarpi: 0, dOmega: 0 },
    },
    rotationPeriodDays: 15.9454, // tidally locked
    axialTiltDeg: 0,
    facts: {
      diameterKm: 5149.4,
      massKg: "1.3452 × 10²³ kg",
      orbitalPeriod: "15.95 days",
      dayLength: "382.7 hours (synchronous rotation)",
      distanceFromSun: "~9.5 AU (orbits Saturn)",
      temperature: "-179 °C (surface)",
      moons: 0,
      axialTiltDeg: 0,
      description:
        "The second-largest moon and the only one with a substantial atmosphere — thick nitrogen " +
        "air at 1.5× Earth's surface pressure, wrapped in a deep orange photochemical haze. It has " +
        "rivers, seas and lakes of liquid methane and ethane, completing a water-methane cycle in " +
        "the cold.",
    },
  },
  {
    id: "rhea",
    name: "Rhea",
    kind: "moon",
    parent: "saturn",
    radiusKm: 763.8,
    elements: {
      a: 0.0035237,
      e: 0.0011,
      i: 0.35,
      L: 250,
      varpi: 250,
      Omega: 0,
      rates: { da: 0, dL: 2.910e6, dvarpi: 0, dOmega: 0 },
    },
    rotationPeriodDays: 4.5182, // tidally locked
    axialTiltDeg: 0,
    facts: {
      diameterKm: 1527.6,
      massKg: "2.3065 × 10²¹ kg",
      orbitalPeriod: "4.52 days",
      dayLength: "108.4 hours (synchronous rotation)",
      distanceFromSun: "~9.5 AU (orbits Saturn)",
      temperature: "-187 °C (surface)",
      moons: 0,
      axialTiltDeg: 0,
      description:
        "Saturn's second-largest moon, a cratered water-ice world nearly 1,500 km across. Its " +
        "bright equatorial band is thought to be fine icy grains pulled in by Saturn's gravity. " +
        "A faint tenuous atmosphere of molecular oxygen was detected around it.",
    },
  },
  {
    id: "uranus",
    name: "Uranus",
    kind: "planet",
    parent: null,
    radiusKm: 25362,
    elements: {
      a: 19.19126393,
      e: 0.04638129,
      i: 0.769862,
      L: 313.23219,
      varpi: 170.96424,
      Omega: 74.016925,
      rates: {
        da: -0.0019617,
        dL: 428.48203,
        dvarpi: 0.4080528,
        dOmega: 0.0424058,
      },
    },
    rotationPeriodDays: -0.71833, // retrograde
    axialTiltDeg: 97.77,
    facts: {
      diameterKm: 50724,
      massKg: "8.681 × 10²⁵ kg",
      orbitalPeriod: "84.02 years",
      dayLength: "17.24 hours (retrograde)",
      distanceFromSun: "19.191 AU (2.87 billion km)",
      temperature: "-195 °C (coldest planetary atmosphere)",
      moons: 28,
      axialTiltDeg: 97.77,
      description:
        "An ice giant tipped on its side — its 98° axial tilt means its poles take turns facing " +
        "the Sun for 42 years at a time, likely from an ancient giant impact. Methane in its " +
        "atmosphere gives it a pale cyan color.",
    },
  },
  {
    id: "titania",
    name: "Titania",
    kind: "moon",
    parent: "uranus",
    radiusKm: 788.4,
    elements: {
      a: 0.0029137,
      e: 0.0011,
      i: 0.33,
      L: 80,
      varpi: 80,
      Omega: 0,
      rates: { da: 0, dL: 1.510e6, dvarpi: 0, dOmega: 0 },
    },
    rotationPeriodDays: 8.7061, // tidally locked
    axialTiltDeg: 0,
    facts: {
      diameterKm: 1576.8,
      massKg: "3.527 × 10²⁰ kg",
      orbitalPeriod: "8.71 days",
      dayLength: "209 hours (synchronous rotation)",
      distanceFromSun: "~19.2 AU (orbits Uranus)",
      temperature: "-190 °C (surface)",
      moons: 0,
      axialTiltDeg: 0,
      description:
        "Uranus's largest moon, a water-ice world cut by enormous canyons and cliff systems over " +
        "200 km long. It orbits in Uranus's equatorial plane — which, thanks to the planet's 98° " +
        "tilt, means it circles the planet on its side.",
    },
  },
  {
    id: "neptune",
    name: "Neptune",
    kind: "planet",
    parent: null,
    radiusKm: 24622,
    elements: {
      a: 30.06896348,
      e: 0.00899665,
      i: 1.770044,
      L: 304.88003,
      varpi: 44.97135,
      Omega: 131.784225,
      rates: {
        da: 0.0002629,
        dL: 218.45945,
        dvarpi: -0.3995255,
        dOmega: 0.0001908,
      },
    },
    rotationPeriodDays: 0.67125,
    axialTiltDeg: 28.32,
    facts: {
      diameterKm: 49244,
      massKg: "1.024 × 10²⁶ kg",
      orbitalPeriod: "164.8 years",
      dayLength: "16.11 hours",
      distanceFromSun: "30.069 AU (4.50 billion km)",
      temperature: "-201 °C (cloud tops)",
      moons: 16,
      axialTiltDeg: 28.32,
      description:
        "The most distant planet, the first to be predicted by mathematical calculations before " +
        "it was observed. Home to the fastest winds in the solar system — supersonic gusts up to " +
        "2,100 km/h. Its large moon Triton orbits backwards and is likely a captured Kuiper Belt " +
        "object.",
    },
  },
  {
    id: "triton",
    name: "Triton",
    kind: "moon",
    parent: "neptune",
    radiusKm: 1353.4,
    elements: {
      // Retrograde orbit: inclination > 90° encodes the backward motion
      a: 0.0023713,
      e: 0.0001,
      i: 156.8,
      L: 270,
      varpi: 270,
      Omega: 0,
      rates: { da: 0, dL: 2.237e6, dvarpi: 0, dOmega: 0 },
    },
    rotationPeriodDays: 5.8769, // tidally locked
    axialTiltDeg: 0,
    facts: {
      diameterKm: 2706.8,
      massKg: "2.139 × 10²² kg",
      orbitalPeriod: "5.88 days",
      dayLength: "141.1 hours (synchronous rotation)",
      distanceFromSun: "~30 AU (orbits Neptune)",
      temperature: "-235 °C (surface)",
      moons: 0,
      axialTiltDeg: 0,
      description:
        "Neptune's large moon orbits backwards — a giveaway that it is a captured Kuiper Belt " +
        "object. It is the coldest known surface in the solar system. Nitrogen geysers vent over " +
        "10 km from its south polar region, and its thin nitrogen atmosphere is the coldest ever measured.",
    },
  },
];

export const BODIES: CelestialBodyDef[] = [SUN, ...planets];

export function getBody(id: string): CelestialBodyDef {
  const body = BODIES.find((b) => b.id === id);
  if (!body) throw new Error(`Unknown body: ${id}`);
  return body;
}

export const AU_IN_SCENE_UNITS = AU;

/** Scene units per kilometre (true scale: 149,597,870.7 km per AU). */
export const KM_TO_SCENE_UNITS = AU / 149597870.7;
