/**
 * Procedural texture generation.
 *
 * All surfaces are synthesized at load time with 3D value noise (fBm) sampled
 * on a cylinder so every texture is horizontally seamless. No external image
 * assets are needed — the app is fully self-contained.
 */
import * as THREE from "three";

const W = 1024;
const H = 512;

// ---------------------------------------------------------------------------
// Noise
// ---------------------------------------------------------------------------

function hash3(x: number, y: number, z: number, seed: number): number {
  let h =
    Math.imul(x, 374761393) ^
    Math.imul(y, 668265263) ^
    Math.imul(z, 1274126177) ^
    Math.imul(seed, 974634211);
  h = Math.imul(h ^ (h >>> 13), 1103515245);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

const fade = (t: number) => t * t * (3 - 2 * t);

function valueNoise3(x: number, y: number, z: number, seed: number): number {
  const xi = Math.floor(x),
    yi = Math.floor(y),
    zi = Math.floor(z);
  const xf = fade(x - xi),
    yf = fade(y - yi),
    zf = fade(z - zi);

  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

  const c000 = hash3(xi, yi, zi, seed);
  const c100 = hash3(xi + 1, yi, zi, seed);
  const c010 = hash3(xi, yi + 1, zi, seed);
  const c110 = hash3(xi + 1, yi + 1, zi, seed);
  const c001 = hash3(xi, yi, zi + 1, seed);
  const c101 = hash3(xi + 1, yi, zi + 1, seed);
  const c011 = hash3(xi, yi + 1, zi + 1, seed);
  const c111 = hash3(xi + 1, yi + 1, zi + 1, seed);

  return lerp(
    lerp(lerp(c000, c100, xf), lerp(c010, c110, xf), yf),
    lerp(lerp(c001, c101, xf), lerp(c011, c111, xf), yf),
    zf,
  );
}

/** Fractal Brownian motion on a cylinder: seamless in u, periodic-ish in v via the z axis. */
function fbmCyl(
  u: number,
  v: number,
  seed: number,
  octaves = 5,
  freq = 3,
  gain = 0.55,
): number {
  const theta = u * Math.PI * 2;
  const cx = Math.cos(theta);
  const cy = Math.sin(theta);
  let amp = 1;
  let sum = 0;
  let norm = 0;
  let f = freq;
  for (let o = 0; o < octaves; o++) {
    sum +=
      amp *
      valueNoise3(cx * f + 7.3, cy * f + 3.1, v * f + 11.7, seed + o * 101);
    norm += amp;
    amp *= gain;
    f *= 2;
  }
  return sum / norm;
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const smooth = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

type PixelFn = (
  u: number,
  v: number,
  seed: number,
) => [number, number, number, number?];

function getCtx(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");
  return ctx;
}

function renderTexture(
  name: string,
  fn: PixelFn,
  seed: number,
  srgb = true,
  w = W,
  h = H,
): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = getCtx(canvas);
  const img = ctx.createImageData(W, H);
  const d = img.data;

  for (let y = 0; y < H; y++) {
    const v = y / (H - 1);
    for (let x = 0; x < W; x++) {
      const u = x / W;
      const [r, g, b, a = 255] = fn(u, v, seed);
      const idx = (y * W + x) * 4;
      d[idx] = r;
      d[idx + 1] = g;
      d[idx + 2] = b;
      d[idx + 3] = a;
    }
  }
  ctx.putImageData(img, 0, 0);

  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = 8;
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.name = name;
  return tex;
}

function craterize(
  base: ImageData,
  ctx: CanvasRenderingContext2D,
  count: number,
  seed: number,
): void {
  for (let c = 0; c < count; c++) {
    const cx = hash3(c, 17, 5, seed) * base.width;
    const cy = (0.06 + hash3(c, 31, 9, seed) * 0.88) * base.height;
    const r = 1.5 + hash3(c, 43, 23, seed) ** 2.2 * base.width * 0.035;
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    const shade = hash3(c, 59, 71, seed) > 0.5 ? "0,0,0" : "255,255,255";
    g.addColorStop(0, `rgba(${shade},0.28)`);
    g.addColorStop(0.55, `rgba(${shade},0.10)`);
    g.addColorStop(0.8, `rgba(${shade},0.0)`);
    g.addColorStop(1, `rgba(${shade},0.18)`); // bright rim
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

function withCraters(
  name: string,
  fn: PixelFn,
  seed: number,
  craters: number,
  w = W,
  h = H,
): THREE.CanvasTexture {
  const tex = renderTexture(name, fn, seed, true, w, h);
  const canvas = tex.image as HTMLCanvasElement;
  const ctx = getCtx(canvas);
  craterize(
    ctx.getImageData(0, 0, canvas.width, canvas.height),
    ctx,
    craters,
    seed,
  );
  tex.needsUpdate = true;
  return tex;
}

// ---------------------------------------------------------------------------
// Body textures
// ---------------------------------------------------------------------------

export function sunTexture(): THREE.CanvasTexture {
  return renderTexture(
    "sun",
    (u, v, seed) => {
      const n = fbmCyl(u, v, seed, 6, 5, 0.6);
      const n2 = fbmCyl(u, v, seed + 500, 4, 14, 0.5);
      const t = clamp01(n * 0.7 + n2 * 0.45 - 0.12);
      return [255, 175 + 60 * t, 40 + 120 * t * t];
    },
    101,
  );
}

export function mercuryTexture(): THREE.CanvasTexture {
  return withCraters(
    "mercury",
    (u, v, seed) => {
      const n = fbmCyl(u, v, seed, 5, 4);
      const t = 0.55 + 0.45 * n;
      const r = 128 * t,
        g = 118 * t,
        b = 110 * t;
      return [r, g, b];
    },
    202,
    260,
  );
}

export function venusTexture(): THREE.CanvasTexture {
  return renderTexture(
    "venus",
    (u, v, seed) => {
      // Swirling sulfuric-acid cloud bands
      const warp = fbmCyl(u, v, seed, 4, 3) * 0.35;
      const band = fbmCyl(u + warp, v * 1.4, seed + 90, 5, 6, 0.6);
      const t = clamp01(band * 0.8 + 0.25);
      return [210 + 40 * t, 175 + 55 * t, 115 + 70 * t];
    },
    303,
  );
}

export function earthTexture(): {
  map: THREE.CanvasTexture;
  clouds: THREE.CanvasTexture;
  specular: THREE.CanvasTexture;
} {
  const oceanMask = new Float32Array(W * H);

  const map = renderTexture(
    "earth",
    (u, v, seed) => {
      const warp = fbmCyl(u, v, seed + 4000, 3, 2.5) * 0.18;
      const cont = fbmCyl(u + warp, v + warp * 0.6, seed, 6, 3.2, 0.55);
      const detail = fbmCyl(u, v, seed + 77, 4, 12, 0.5);
      const lat = Math.abs(v - 0.5) * 2; // 0 equator .. 1 pole
      const idx = Math.floor(v * (H - 1)) * W + Math.floor(u * W);
      let r: number, g: number, b: number;

      if (cont > 0.52) {
        // Land
        const h = clamp01((cont - 0.52) / 0.25);
        const veg = smooth(0, 0.4, detail);
        r = 45 + 90 * h + 30 * (1 - veg);
        g = 92 + 40 * h + 25 * veg;
        b = 38 + 55 * h;
        if (h > 0.55) {
          r = 150 + 60 * h;
          g = 140 + 60 * h;
          b = 130 + 55 * h;
        } // highlands
      } else {
        // Ocean — deep blue near coasts fades to darker blue
        const depth = clamp01((0.52 - cont) / 0.2);
        r = 12 + 20 * (1 - depth);
        g = 45 + 55 * (1 - depth);
        b = 105 + 60 * (1 - depth);
      }
      oceanMask[idx] = cont > 0.52 ? 0 : 1;

      // Polar ice caps
      const iceEdge = 0.82 + 0.1 * detail;
      const ice = smooth(iceEdge - 0.06, iceEdge + 0.02, lat);
      r = r + (238 - r) * ice;
      g = g + (242 - g) * ice;
      b = b + (248 - b) * ice;

      return [r, g, b];
    },
    404,
  );

  const specular = renderTexture(
    "earth-spec",
    (u, v) => {
      const idx = Math.floor(v * (H - 1)) * W + Math.floor(u * W);
      const s = oceanMask[idx] * 200;
      return [s, s, s];
    },
    404,
    false,
  );

  const clouds = renderTexture(
    "earth-clouds",
    (u, v, seed) => {
      const c = fbmCyl(u, v, seed + 900, 5, 4, 0.62);
      const alpha = smooth(0.52, 0.72, c) * 235;
      return [255, 255, 255, alpha];
    },
    404,
    false,
  );
  clouds.wrapT = THREE.ClampToEdgeWrapping;

  return { map, clouds, specular };
}

export function marsTexture(): THREE.CanvasTexture {
  return renderTexture(
    "mars",
    (u, v, seed) => {
      const n = fbmCyl(u, v, seed, 6, 4, 0.55);
      const dark = fbmCyl(u, v, seed + 33, 4, 3, 0.5);
      const lat = Math.abs(v - 0.5) * 2;
      let r = 178 + 55 * n;
      let g = 92 + 40 * n;
      let b = 52 + 30 * n;
      // Dark basaltic maria
      const maria = smooth(0.62, 0.75, dark);
      r -= 55 * maria;
      g -= 35 * maria;
      b -= 22 * maria;
      // Polar caps
      const cap = smooth(0.9, 0.985, lat + 0.03 * n);
      r = r + (235 - r) * cap;
      g = g + (225 - g) * cap;
      b = b + (215 - b) * cap;
      return [
        clamp01(r / 255) * 255,
        clamp01(g / 255) * 255,
        clamp01(b / 255) * 255,
      ];
    },
    505,
  );
}

// Jupiter's latitude palette (south pole → north pole): pale blue-gray
// polar caps with vortex mottling, then alternating cream/tan/rust zones
// and belts converging on the pale Equatorial Zone.
const JUPITER_STOPS: [number, [number, number, number]][] = [
  [0.0, [124, 135, 149]],
  [0.12, [133, 135, 140]],
  [0.155, [157, 149, 131]],
  [0.2, [146, 116, 90]],
  [0.26, [212, 193, 157]],
  [0.32, [168, 126, 88]],
  [0.38, [229, 217, 191]],
  [0.44, [185, 140, 96]],
  [0.5, [218, 198, 167]],
  [0.56, [185, 140, 96]],
  [0.62, [229, 217, 191]],
  [0.68, [168, 126, 88]],
  [0.74, [212, 193, 157]],
  [0.8, [146, 116, 90]],
  [0.845, [157, 149, 131]],
  [0.88, [133, 135, 140]],
  [1.0, [124, 135, 149]],
];

function jupiterBandColor(t: number): [number, number, number] {
  const x = clamp01(t);
  for (let i = 1; i < JUPITER_STOPS.length; i++) {
    const [t1, c1] = JUPITER_STOPS[i];
    if (x <= t1) {
      const [t0, c0] = JUPITER_STOPS[i - 1];
      const k = (x - t0) / (t1 - t0);
      const s = k * k * (3 - 2 * k);
      return [
        c0[0] + (c1[0] - c0[0]) * s,
        c0[1] + (c1[1] - c0[1]) * s,
        c0[2] + (c1[2] - c0[2]) * s,
      ];
    }
  }
  return JUPITER_STOPS[JUPITER_STOPS.length - 1][1];
}

export function jupiterTexture(): THREE.CanvasTexture {
  return renderTexture(
    "jupiter",
    (u, v, seed) => {
      // Band edges undulate gently: low-frequency noise only. High v-
      // frequency here is what made the previous version look sawtoothed.
      const warp = (fbmCyl(u, v, seed, 3, 2.2, 0.5) - 0.5) * 0.03;
      const [r0, g0, b0] = jupiterBandColor(v + warp);

      // Fine cloud texture within the bands (brightness only, no band shift)
      const detail = fbmCyl(u, v, seed + 20, 4, 10, 0.5);
      const mod = 1 + (detail - 0.5) * 0.2;
      let r = r0 * mod;
      let g = g0 * mod;
      let b = b0 * mod;

      // Polar vortex mottling — kept subtle so the caps stay uniform
      const polar = 1 - smooth(0.0, 0.12, Math.abs(v - 0.5) * 2);
      const mottle = fbmCyl(u, v, seed + 90, 4, 6, 0.5);
      const pm = polar * (mottle - 0.5) * 0.12;
      r *= 1 + pm;
      g *= 1 + pm;
      b *= 1 + pm;

      // Great Red Spot: compact, sharp, with a pale collar. An oval
      // elongated along the rotation direction (east-west ~1.8x its height).
      let du = Math.abs(u - 0.7);
      if (du > 0.5) du = 1 - du;
      const q = Math.sqrt((du / 0.023) ** 2 + ((v - 0.62) / 0.025) ** 2);
      const core = 1 - smooth(0.6, 1.0, q);
      const collar = smooth(0.7, 0.95, q) * (1 - smooth(1.25, 1.8, q));
      if (core > 0) {
        // Internal swirl so the spot reads as a rotating vortex, not a blob
        const swirl = fbmCyl(u, v, seed + 500, 4, 22, 0.5);
        const sr = 186 + (swirl - 0.5) * 55;
        const sg = 78 + (swirl - 0.5) * 40;
        const sb = 54 + (swirl - 0.5) * 30;
        r = r + (sr - r) * core;
        g = g + (sg - g) * core;
        b = b + (sb - b) * core;
      }
      if (collar > 0) {
        r = r + (236 - r) * collar * 0.75;
        g = g + (216 - g) * collar * 0.75;
        b = b + (188 - b) * collar * 0.75;
      }

      // Small white oval storms in the south temperate zone
      // Wide in the rotation direction, narrow in latitude
      const ovals: [number, number, number, number][] = [
        [0.35, 0.58, 0.028, 0.0155],
        [0.55, 0.665, 0.022, 0.012],
        [0.15, 0.55, 0.025, 0.014],
        [0.84, 0.575, 0.021, 0.0117],
      ];
      for (const [ou, ov, su, sv] of ovals) {
        let ouw = Math.abs(u - ou);
        if (ouw > 0.5) ouw = 1 - ouw;
        const qq = Math.sqrt((ouw / su) ** 2 + ((v - ov) / sv) ** 2);
        const om = (1 - smooth(0.5, 1.0, qq)) * 0.85;
        r = r + (240 - r) * om;
        g = g + (234 - g) * om;
        b = b + (222 - b) * om;
      }

      return [r, g, b];
    },
    606,
  );
}

export function saturnTexture(): THREE.CanvasTexture {
  return renderTexture(
    "saturn",
    (u, v, seed) => {
      const warp = (fbmCyl(u, v, seed, 4, 5, 0.5) - 0.5) * 0.05;
      const lat = v + warp;
      const band = Math.sin(lat * Math.PI * 11) * 0.5 + 0.5;
      const soft = fbmCyl(u, lat, seed + 40, 4, 7, 0.5);
      const t = clamp01(band * 0.45 + soft * 0.4);
      return [214 + 34 * t, 188 + 40 * t, 142 + 50 * t];
    },
    707,
  );
}

export function uranusTexture(): THREE.CanvasTexture {
  return renderTexture(
    "uranus",
    (u, v, seed) => {
      const lat = v + (fbmCyl(u, v, seed, 3, 3, 0.5) - 0.5) * 0.03;
      const band = Math.sin(lat * Math.PI * 6) * 0.5 + 0.5;
      const t = clamp01(0.6 + 0.25 * band);
      return [150 + 30 * t, 210 + 25 * t, 228 + 20 * t];
    },
    808,
  );
}

export function neptuneTexture(): THREE.CanvasTexture {
  return renderTexture(
    "neptune",
    (u, v, seed) => {
      const warp = (fbmCyl(u, v, seed, 4, 4, 0.5) - 0.5) * 0.07;
      const band = Math.sin((v + warp) * Math.PI * 9) * 0.5 + 0.5;
      const storm = fbmCyl(u, v, seed + 15, 4, 6, 0.55);
      const t = clamp01(band * 0.4 + storm * 0.5);
      let r = 48 + 40 * t;
      let g = 78 + 55 * t;
      let b = 165 + 60 * t;
      // Great Dark Spot
      let du = Math.abs(u - 0.3);
      if (du > 0.5) du = 1 - du;
      const dv = (v - 0.42) / 0.5;
      const spot = clamp01(1 - Math.sqrt(du * du * 34 + dv * dv));
      if (spot > 0) {
        const s2 = smooth(0.2, 0.9, spot);
        r = r * (1 - 0.55 * s2);
        g = g * (1 - 0.5 * s2);
        b = b * (1 - 0.35 * s2);
      }
      return [r, g, b];
    },
    909,
  );
}

export function moonTexture(): THREE.CanvasTexture {
  return withCraters(
    "moon",
    (u, v, seed) => {
      const n = fbmCyl(u, v, seed, 5, 4);
      const mare = fbmCyl(u, v, seed + 61, 4, 2.2, 0.5);
      let t = 118 + 72 * n;
      t -= 45 * smooth(0.6, 0.78, mare); // dark maria
      return [t, t, t + 4];
    },
    1010,
    320,
  );
}

const MW = 512; // moon texture width (small moons rarely get closer than a few px)
const MH = 256;

export function phobosTexture(): THREE.CanvasTexture {
  return withCraters(
    "phobos",
    (u, v, seed) => {
      const n = fbmCyl(u, v, seed, 4, 5);
      const t = 62 + 42 * n;
      return [t + 8, t, t - 6];
    },
    2001,
    120,
    MW,
    MH,
  );
}

export function deimosTexture(): THREE.CanvasTexture {
  return withCraters(
    "deimos",
    (u, v, seed) => {
      const n = fbmCyl(u, v, seed, 4, 5);
      const t = 92 + 40 * n;
      return [t + 6, t, t - 4];
    },
    2002,
    90,
    MW,
    MH,
  );
}

export function ioTexture(): THREE.CanvasTexture {
  return renderTexture(
    "io",
    (u, v, seed) => {
      // Sulfur plains with darker volcanic patches
      const n = fbmCyl(u, v, seed, 5, 4, 0.55);
      const m = fbmCyl(u, v, seed + 7, 4, 7, 0.5);
      let r = 205 + 40 * n;
      let g = 185 + 45 * n;
      let b = 95 + 60 * n;
      const volc = smooth(0.62, 0.78, m);
      r = r - 120 * volc;
      g = g - 100 * volc;
      b = b - 60 * volc;
      // Bright SO2 frost caps
      const lat = Math.abs(v - 0.5) * 2;
      const frost = smooth(0.88, 0.99, lat);
      r = r + (250 - r) * frost;
      g = g + (245 - g) * frost;
      b = b + (200 - b) * frost;
      return [r, g, b];
    },
    2003,
    true,
    MW,
    MH,
  );
}

export function europaTexture(): THREE.CanvasTexture {
  return renderTexture(
    "europa",
    (u, v, seed) => {
      // Pale ice with dark lineae (ridged fracture bands)
      const n = fbmCyl(u, v, seed, 4, 3, 0.5);
      let r = 218 + 22 * n;
      let g = 205 + 24 * n;
      let b = 185 + 28 * n;
      const ridges = fbmCyl(u * 3.0, v * 1.2, seed + 31, 4, 9, 0.6);
      const lineae = 1 - smooth(0.42, 0.5, ridges);
      r = r - 90 * lineae;
      g = g - 95 * lineae;
      b = b - 105 * lineae;
      // Reddish sulfur streaks
      const stain = smooth(0.68, 0.82, fbmCyl(u, v, seed + 61, 3, 5, 0.5));
      r = r + 20 * stain;
      g = g - 8 * stain;
      b = b - 25 * stain;
      return [r, g, b];
    },
    2004,
    true,
    MW,
    MH,
  );
}

export function ganymedeTexture(): THREE.CanvasTexture {
  return withCraters(
    "ganymede",
    (u, v, seed) => {
      // Two distinct terrains: dark terrae vs bright grooved ice
      const patch = fbmCyl(u, v, seed, 4, 2.2, 0.5);
      const bright = smooth(0.52, 0.6, patch);
      const n = fbmCyl(u, v, seed + 13, 4, 6, 0.5);
      const r = 95 + 105 * bright + 18 * n;
      const g = 95 + 100 * bright + 16 * n;
      const b = 100 + 95 * bright + 14 * n;
      return [r, g, b];
    },
    2005,
    70,
    MW,
    MH,
  );
}

export function callistoTexture(): THREE.CanvasTexture {
  return withCraters(
    "callisto",
    (u, v, seed) => {
      const n = fbmCyl(u, v, seed, 4, 4, 0.5);
      const t = 78 + 42 * n;
      return [t + 6, t, t - 8];
    },
    2006,
    260,
    MW,
    MH,
  );
}

export function titanTexture(): THREE.CanvasTexture {
  // Titan is hidden under a thick orange haze — nearly featureless
  return renderTexture(
    "titan",
    (u, v, seed) => {
      const n = fbmCyl(u, v, seed, 3, 3, 0.5);
      const lat = Math.abs(v - 0.5) * 2;
      const r = 188 + 14 * n;
      const g = 112 + 16 * n;
      const b = 48 + 12 * n;
      // Slightly darker polar region
      const pole = smooth(0.85, 0.99, lat);
      return [r - 25 * pole, g - 22 * pole, b - 8 * pole];
    },
    2007,
    true,
    MW,
    MH,
  );
}

export function rheaTexture(): THREE.CanvasTexture {
  return withCraters(
    "rhea",
    (u, v, seed) => {
      const n = fbmCyl(u, v, seed, 4, 4, 0.5);
      let t = 168 + 46 * n;
      // Bright equatorial band of fine dust
      const eq = 1 - smooth(0, 0.12, Math.abs(v - 0.5) * 2);
      t += 26 * eq;
      return [t, t + 2, t + 6];
    },
    2008,
    160,
    MW,
    MH,
  );
}

export function titaniaTexture(): THREE.CanvasTexture {
  return withCraters(
    "titania",
    (u, v, seed) => {
      const n = fbmCyl(u, v, seed, 4, 4, 0.5);
      const t = 152 + 42 * n;
      return [t, t + 3, t + 10];
    },
    2009,
    130,
    MW,
    MH,
  );
}

export function tritonTexture(): THREE.CanvasTexture {
  return withCraters(
    "triton",
    (u, v, seed) => {
      const n = fbmCyl(u, v, seed, 4, 4, 0.5);
      let r = 214 + 26 * n;
      let g = 210 + 26 * n;
      let b = 198 + 28 * n;
      // Dark red cantaloupe-terrain patch (cantaloupe = south pole, v≈0.85)
      const du = Math.abs(u - 0.3);
      const duw = Math.min(du, 1 - du);
      const spot = clamp01(
        1 - Math.sqrt(duw * duw * 10 + ((v - 0.85) / 0.35) ** 2),
      );
      const s2 = smooth(0.1, 0.85, spot);
      r = r - 95 * s2;
      g = g - 100 * s2;
      b = b - 95 * s2;
      return [r, g, b];
    },
    2010,
    60,
    MW,
    MH,
  );
}

/** Radial-stripe ring texture: u maps to radius. */
export function saturnRingTexture(): THREE.CanvasTexture {
  const w = 1024;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = 8;
  const ctx = getCtx(canvas);
  const img = ctx.createImageData(w, 8);
  const d = img.data;

  for (let x = 0; x < w; x++) {
    const t = x / w; // 0 inner .. 1 outer
    const n = valueNoise3(Math.floor(t * 220), 0, 0, 1111);
    let alpha = 0.55 + 0.45 * n;
    // Ring structure: gaps and density waves
    alpha *= 0.75 + 0.25 * Math.sin(t * 90 + n * 4);
    // Cassini division
    alpha *= 1 - 0.92 * smooth(0.615, 0.63, t) * (1 - smooth(0.665, 0.68, t));
    // Encke gap
    alpha *= 1 - 0.7 * smooth(0.855, 0.862, t) * (1 - smooth(0.868, 0.875, t));
    // Faint inner C ring, dense B ring
    if (t < 0.18) alpha *= smooth(0.0, 0.1, t) * 0.35;
    if (t > 0.72 && t < 0.78) alpha *= 0.5;
    alpha *= smooth(0.0, 0.02, t) * (1 - smooth(0.97, 1.0, t));

    const brightness = 195 + 50 * n;
    for (let y = 0; y < 8; y++) {
      const idx = (y * w + x) * 4;
      d[idx] = brightness;
      d[idx + 1] = brightness * 0.93;
      d[idx + 2] = brightness * 0.78;
      d[idx + 3] = clamp01(alpha) * 255;
    }
  }
  ctx.putImageData(img, 0, 0);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.name = "saturn-rings";
  return tex;
}

/** Radial glow sprite (used for the Sun corona). */
export function glowSprite(): THREE.CanvasTexture {
  const s = 256;
  const canvas = document.createElement("canvas");
  canvas.width = s;
  canvas.height = s;
  const ctx = getCtx(canvas);
  // Sprite half-width is 1.7 sun-radii (scale 3.4r), so the disk limb sits
  // at t ≈ 0.59. The corona must fade fast just outside that — in space the
  // corona is a tight, faint, whitish halo, not a large orange glow (the
  // orange in ground photos is atmospheric scattering).
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0, "rgba(255, 250, 235, 0.9)");
  g.addColorStop(0.59, "rgba(255, 250, 235, 0.5)");
  g.addColorStop(0.7, "rgba(255, 240, 205, 0.2)");
  g.addColorStop(0.85, "rgba(255, 225, 175, 0.05)");
  g.addColorStop(1, "rgba(255, 215, 160, 0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
