/**
 * Keplerian orbital propagation.
 *
 * Elements are evaluated from their J2000 values with linear secular rates
 * (JPL Standish approximation), the mean anomaly is advanced, Kepler's
 * equation is solved by Newton iteration, and the heliocentric position is
 * returned in ecliptic coordinates (AU).
 */
import type { OrbitalElements } from "../data/celestialBodies";

export const J2000_EPOCH_MS = Date.UTC(2000, 0, 1, 12, 0, 0);

const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;

/** Days elapsed since the J2000.0 epoch for a JS timestamp in ms. */
export function daysSinceJ2000(ms: number): number {
  return (ms - J2000_EPOCH_MS) / 86400000;
}

export function msFromDaysSinceJ2000(days: number): number {
  return J2000_EPOCH_MS + days * 86400000;
}

export interface EclipticPosition {
  x: number;
  y: number;
  z: number;
}

/**
 * Solve Kepler's equation M = E - e·sin(E) for the eccentric anomaly E
 * using Newton–Raphson iteration. Converges in <10 iterations for all
 * solar-system eccentricities (e < 0.21).
 */
export function solveKepler(M: number, e: number): number {
  // Normalize M to [-PI, PI] for fast convergence
  let m = M % (2 * Math.PI);
  if (m > Math.PI) m -= 2 * Math.PI;
  if (m < -Math.PI) m += 2 * Math.PI;

  let E = m + e * Math.sin(m) * (1 + e * Math.cos(m));
  for (let iter = 0; iter < 30; iter++) {
    const f = E - e * Math.sin(E) - m;
    const fp = 1 - e * Math.cos(E);
    const dE = f / fp;
    E -= dE;
    if (Math.abs(dE) < 1e-12) break;
  }
  return E;
}

/**
 * Evaluate orbital elements at a given time (days from J2000).
 */
interface ResolvedElements {
  a: number;
  e: number;
  i: number;
  L: number;
  varpi: number;
  Omega: number;
}

function elementsAt(el: OrbitalElements, days: number): ResolvedElements {
  const c = days / 36525; // centuries
  return {
    a: el.a + el.rates.da * c,
    e: el.e,
    i: el.i,
    L: el.L + el.rates.dL * c,
    varpi: el.varpi + el.rates.dvarpi * c,
    Omega: el.Omega + el.rates.dOmega * c,
  };
}

/**
 * Heliocentric position (AU, ecliptic frame) of a body at `days` since J2000.
 */
export function heliocentricPosition(el: OrbitalElements, days: number): EclipticPosition {
  const { a, e, i, L, varpi, Omega } = elementsAt(el, days);

  const w = (varpi - Omega) * DEG2RAD; // argument of perihelion
  const omega = Omega * DEG2RAD; // longitude of ascending node
  const inc = i * DEG2RAD;
  const M = ((L - varpi) % 360) * DEG2RAD; // mean anomaly

  const E = solveKepler(M, e);

  // Position in the orbital plane
  const xp = a * (Math.cos(E) - e);
  const yp = a * Math.sqrt(1 - e * e) * Math.sin(E);

  // Rotate: arg of perihelion -> inclination -> node
  const cw = Math.cos(w), sw = Math.sin(w);
  const ci = Math.cos(inc), si = Math.sin(inc);
  const co = Math.cos(omega), so = Math.sin(omega);

  const x1 = cw * xp - sw * yp;
  const y1 = sw * xp + cw * yp;
  const x2 = x1;
  const y2 = ci * y1;
  const z2 = si * y1;

  return {
    x: co * x2 - so * y2,
    y: si * x2 + so * y2,
    z: z2,
  };
}

/**
 * Sample the full orbital ellipse (one period) for rendering orbit lines.
 * Uses the same rotation pipeline as heliocentricPosition.
 */
export function orbitEllipsePoints(el: OrbitalElements, samples = 256): EclipticPosition[] {
  const { a, e, i, varpi, Omega } = elementsAt(el, 0);
  const w = (varpi - Omega) * DEG2RAD;
  const omega = Omega * DEG2RAD;
  const inc = i * DEG2RAD;

  const cw = Math.cos(w), sw = Math.sin(w);
  const ci = Math.cos(inc), si = Math.sin(inc);
  const co = Math.cos(omega), so = Math.sin(omega);
  const b = a * Math.sqrt(1 - e * e);

  const pts: EclipticPosition[] = [];
  for (let s = 0; s <= samples; s++) {
    const E = (s / samples) * 2 * Math.PI;
    const xp = a * (Math.cos(E) - e);
    const yp = b * Math.sin(E);

    const x1 = cw * xp - sw * yp;
    const y1 = sw * xp + cw * yp;
    const x2 = x1;
    const y2 = ci * y1;
    const z2 = si * y1;

    pts.push({
      x: co * x2 - so * y2,
      y: si * x2 + so * y2,
      z: z2,
    });
  }
  return pts;
}

/** Approximate sidereal orbital period in days (Kepler's third law, solar mass). */
export function orbitalPeriodDays(aAU: number): number {
  return 365.25 * Math.sqrt(aAU * aAU * aAU);
}

/** Convert an ecliptic position (AU) to scene coordinates (Y-up, 1 AU = `au` units). */
export function toScene(p: EclipticPosition, au: number): { x: number; y: number; z: number } {
  return { x: p.x * au, y: p.y * au, z: -p.z * au };
}

/** Heliocentric distance (AU) of a body at a given time — used for facts display. */
export function heliocentricDistance(el: OrbitalElements, days: number): number {
  const p = heliocentricPosition(el, days);
  return Math.sqrt(p.x * p.x + p.y * p.y + p.z * p.z);
}

export { RAD2DEG, DEG2RAD };
