/**
 * Verification tests for the Keplerian orbital math.
 * Run: npx tsx test/kepler.test.ts
 *
 * Cross-checks against independently known J2000 positions and
 * Kepler's third law.
 */
import { BODIES, getBody } from "../src/data/celestialBodies";
import {
  daysSinceJ2000,
  heliocentricDistance,
  heliocentricPosition,
  orbitalPeriodDays,
  solveKepler,
} from "../src/sim/kepler";

let failures = 0;

function check(name: string, actual: number, expected: number, tol: number): void {
  const ok = Math.abs(actual - expected) <= tol;
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}: got ${actual.toFixed(6)}, expected ${expected} ± ${tol}`);
}

// --- Kepler equation solver -------------------------------------------------
{
  const e = 0.2, M = 1.0;
  const E = solveKepler(M, e);
  check("kepler.residual(e=0.2, M=1.0)", E - e * Math.sin(E) - M, 0, 1e-12);

  const e2 = 0.09341, M2 = -0.5;
  const E2 = solveKepler(M2, e2);
  check("kepler.residual(e=0.093, M=-0.5)", E2 - e2 * Math.sin(E2) - M2, 0, 1e-12);
}

// --- Earth at J2000 ---------------------------------------------------------
// J2000 = 2000-01-01 12:00. Earth is near perihelion (Jan 3) → r ≈ 0.983 AU,
// heliocentric ecliptic longitude ≈ mean longitude 100.46°.
{
  const earth = getBody("earth").elements!;
  check("j2000.epoch.days", daysSinceJ2000(Date.UTC(2000, 0, 1, 12)), 0, 1e-9);
  check("earth.j2000.distance_AU", heliocentricDistance(earth, 0), 0.9833, 0.002);

  const p = heliocentricPosition(earth, 0);
  // Ecliptic frame: (x, y) in-plane → longitude = atan2(y, x)
  const lon = (Math.atan2(p.y, p.x) * 180) / Math.PI;
  const lonNorm = ((lon % 360) + 360) % 360;
  check("earth.j2000.ecliptic_lon_deg", lonNorm, 100.2, 0.4);
  // Out-of-plane ecliptic coordinate (z) is ~0 for Earth
  check("earth.j2000.out_of_plane_z", Math.abs(p.z), 0, 0.001);
}

// --- One sidereal year later: Earth back to the same spot -------------------
{
  const earth = getBody("earth").elements!;
  const p0 = heliocentricPosition(earth, 0);
  const p1 = heliocentricPosition(earth, 365.256);
  const d0 = Math.hypot(p0.x, p0.y, p0.z);
  const d1 = Math.hypot(p1.x, p1.y, p1.z);
  check("earth.one_year.distance_drift", d1 - d0, 0, 0.001);
  const l0 = Math.atan2(p0.y, p0.x);
  const l1 = Math.atan2(p1.y, p1.x);
  let dlon = (l1 - l0) * (180 / Math.PI);
  dlon = ((dlon % 360) + 360) % 360;
  if (dlon > 180) dlon -= 360; // signed, near-zero expected
  check("earth.one_year.lon_return_deg", dlon, 0, 0.05);
}

// --- Kepler's third law for all planets --------------------------------------
{
  const expected: Record<string, number> = {
    mercury: 87.97, venus: 224.7, earth: 365.25, mars: 686.98,
    jupiter: 4332.6, saturn: 10759, uranus: 30687, neptune: 60190,
  };
  for (const id of Object.keys(expected)) {
    const el = getBody(id).elements!;
    check(`period.${id}_days`, orbitalPeriodDays(el.a), expected[id], expected[id] * 0.01);
  }
}

// --- Position sanity for all bodies at J2000 ---------------------------------
{
  for (const b of BODIES) {
    if (!b.elements || b.parent !== null) continue;
    const p = heliocentricPosition(b.elements, 0);
    const r = Math.hypot(p.x, p.y, p.z);
    const a = b.elements.a;
    const ok = r >= a * (1 - b.elements.e) * 0.999 && r <= a * (1 + b.elements.e) * 1.001;
    if (!ok) failures++;
    console.log(`${ok ? "PASS" : "FAIL"}  range.${b.id}: r=${r.toFixed(4)} AU within [a(1-e), a(1+e)]`);
  }
}

// --- Long-term drift: 500 years ----------------------------------------------
{
  const neptune = getBody("neptune").elements!;
  const p = heliocentricPosition(neptune, 500 * 365.25);
  const r = Math.hypot(p.x, p.y, p.z);
  check("neptune.year500.distance_AU", r, 30.07, 0.6); // a drifts by ~0.00026 AU/century
}

console.log(failures === 0 ? "\nALL TESTS PASSED" : `\n${failures} TEST(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
