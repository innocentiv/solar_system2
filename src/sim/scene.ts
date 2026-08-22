/**
 * Three.js scene construction: renderer, camera, starfield, Sun, planets,
 * moons, orbit lines, and CSS2D labels.
 */
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { CSS2DRenderer, CSS2DObject } from "three/addons/renderers/CSS2DRenderer.js";

import { AU_IN_SCENE_UNITS, BODIES, type CelestialBodyDef } from "../data/celestialBodies";
import { orbitEllipsePoints, toScene } from "./kepler";
import * as T from "./textures";

export interface BodyScene {
  def: CelestialBodyDef;
  /** Pivot at the body's orbital position; the mesh spins inside it */
  group: THREE.Group;
  mesh: THREE.Mesh;
  label: CSS2DObject;
  cloudMesh?: THREE.Mesh;
  ringMesh?: THREE.Mesh;
  orbitLine?: THREE.LineLoop;
}

export interface SceneRefs {
  renderer: THREE.WebGLRenderer;
  labelRenderer: CSS2DRenderer;
  composer: EffectComposer;
  controls: OrbitControls;
  camera: THREE.PerspectiveCamera;
  scene: THREE.Scene;
  bodies: Map<string, BodyScene>;
}

export function buildScene(container: HTMLElement): SceneRefs {
  const scene = new THREE.Scene();

  // --- Camera & renderer -------------------------------------------------
  const camera = new THREE.PerspectiveCamera(
    50,
    container.clientWidth / container.clientHeight,
    0.1,
    60000,
  );
  camera.position.set(-140, 95, 210);

  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  container.appendChild(renderer.domElement);

  const labelRenderer = new CSS2DRenderer();
  labelRenderer.setSize(container.clientWidth, container.clientHeight);
  labelRenderer.domElement.style.position = "absolute";
  labelRenderer.domElement.style.inset = "0";
  labelRenderer.domElement.style.pointerEvents = "none";
  container.appendChild(labelRenderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.minDistance = 4;
  controls.maxDistance = 9000;

  // --- Post-processing: bloom for the Sun --------------------------------
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(
    new THREE.Vector2(container.clientWidth, container.clientHeight),
    0.85, // strength
    0.55, // radius
    0.78, // threshold
  );
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  // --- Lighting ----------------------------------------------------------
  const sunLight = new THREE.PointLight(0xfff2dd, 3.2, 0, 0); // no decay: reaches Neptune
  scene.add(sunLight);
  scene.add(new THREE.AmbientLight(0x334466, 0.16)); // faint fill so night sides are legible

  // --- Starfield ---------------------------------------------------------
  scene.add(makeStarfield());

  // --- Bodies ------------------------------------------------------------
  const bodies = new Map<string, BodyScene>();
  for (const def of BODIES) {
    const bs = buildBody(def);
    bodies.set(def.id, bs);
    scene.add(bs.group);
    if (def.parent === null && bs.orbitLine) scene.add(bs.orbitLine);
  }

  return { renderer, labelRenderer, composer, controls, camera, scene, bodies };
}

function makeStarfield(): THREE.Group {
  const group = new THREE.Group();
  const layers: { count: number; size: number; tint: [number, number, number] }[] = [
    { count: 9000, size: 1.6, tint: [1, 1, 1] },
    { count: 4500, size: 2.6, tint: [0.75, 0.85, 1] },
    { count: 3000, size: 3.4, tint: [1, 0.9, 0.75] },
  ];

  for (const layer of layers) {
    const positions = new Float32Array(layer.count * 3);
    const colors = new Float32Array(layer.count * 3);
    for (let i = 0; i < layer.count; i++) {
      // Uniform on a sphere shell
      const u = Math.random() * 2 - 1;
      const phi = Math.random() * Math.PI * 2;
      const s = Math.sqrt(1 - u * u);
      const R = 12000 + Math.random() * 8000;
      positions[i * 3] = s * Math.cos(phi) * R;
      positions[i * 3 + 1] = u * R;
      positions[i * 3 + 2] = s * Math.sin(phi) * R;

      const b = 0.45 + Math.random() * 0.55; // brightness
      colors[i * 3] = layer.tint[0] * b;
      colors[i * 3 + 1] = layer.tint[1] * b;
      colors[i * 3 + 2] = layer.tint[2] * b;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    const mat = new THREE.PointsMaterial({
      size: layer.size,
      vertexColors: true,
      sizeAttenuation: false,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
    });
    group.add(new THREE.Points(geo, mat));
  }

  // Milky Way band: dense dim stars concentrated near a tilted plane
  const bandCount = 14000;
  const bandPos = new Float32Array(bandCount * 3);
  const bandCol = new Float32Array(bandCount * 3);
  for (let i = 0; i < bandCount; i++) {
    const angle = Math.random() * Math.PI * 2;
    const R = 13000 + Math.random() * 7000;
    const spread = (Math.random() + Math.random() + Math.random() - 1.5) * 2600; // gaussian-ish
    const x = Math.cos(angle) * R;
    const y = Math.sin(angle) * R;
    const z = spread;
    // Tilt the band ~62° and rotate it
    const tilt = 1.08;
    const y2 = y * Math.cos(tilt) - z * Math.sin(tilt);
    const z2 = y * Math.sin(tilt) + z * Math.cos(tilt);
    bandPos[i * 3] = x;
    bandPos[i * 3 + 1] = y2;
    bandPos[i * 3 + 2] = z2;
    const b = 0.12 + Math.random() * 0.3;
    bandCol[i * 3] = b * 0.95;
    bandCol[i * 3 + 1] = b * 0.9;
    bandCol[i * 3 + 2] = b;
  }
  const bandGeo = new THREE.BufferGeometry();
  bandGeo.setAttribute("position", new THREE.BufferAttribute(bandPos, 3));
  bandGeo.setAttribute("color", new THREE.BufferAttribute(bandCol, 3));
  group.add(
    new THREE.Points(
      bandGeo,
      new THREE.PointsMaterial({
        size: 1.2,
        vertexColors: true,
        sizeAttenuation: false,
        transparent: true,
        opacity: 0.75,
        depthWrite: false,
      }),
    ),
  );
  return group;
}

function makeLabel(text: string): CSS2DObject {
  const el = document.createElement("div");
  el.className = "body-label";
  el.textContent = text;
  return new CSS2DObject(el);
}

function buildBody(def: CelestialBodyDef): BodyScene {
  const group = new THREE.Group();
  const radius = def.displayRadius;

  let mesh: THREE.Mesh;
  let cloudMesh: THREE.Mesh | undefined;
  let ringMesh: THREE.Mesh | undefined;
  let orbitLine: THREE.LineLoop | undefined;

  if (def.id === "sun") {
    mesh = new THREE.Mesh(
      new THREE.SphereGeometry(radius, 64, 48),
      new THREE.MeshBasicMaterial({ map: T.sunTexture(), color: 0xffffff }),
    );
    // Corona glow sprite
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: T.glowSprite(),
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    sprite.scale.setScalar(radius * 6.5);
    group.add(sprite);
  } else {
    const isGasGiant = ["jupiter", "saturn", "uranus", "neptune"].includes(def.id);
    const segments = isGasGiant ? 64 : 48;
    const texture =
      def.id === "mercury" ? T.mercuryTexture()
      : def.id === "venus" ? T.venusTexture()
      : def.id === "mars" ? T.marsTexture()
      : def.id === "jupiter" ? T.jupiterTexture()
      : def.id === "saturn" ? T.saturnTexture()
      : def.id === "uranus" ? T.uranusTexture()
      : def.id === "neptune" ? T.neptuneTexture()
      : T.moonTexture();

    // Earth: Phong material for a sun-glint on the oceans, plus a
    // separate drifting cloud layer.
    if (def.id === "earth") {
      const et = T.earthTexture();
      mesh = new THREE.Mesh(
        new THREE.SphereGeometry(radius, segments, segments / 2),
        new THREE.MeshPhongMaterial({
          map: et.map,
          specularMap: et.specular,
          specular: new THREE.Color(0x557799),
          shininess: 18,
        }),
      );
      cloudMesh = new THREE.Mesh(
        new THREE.SphereGeometry(radius * 1.012, segments, segments / 2),
        new THREE.MeshStandardMaterial({
          map: et.clouds,
          transparent: true,
          depthWrite: false,
          roughness: 1,
        }),
      );
    } else {
      mesh = new THREE.Mesh(
        new THREE.SphereGeometry(radius, segments, segments / 2),
        new THREE.MeshStandardMaterial({ map: texture, roughness: 0.92, metalness: 0.0 }),
      );
    }

    if (cloudMesh) group.add(cloudMesh);

    // Tilt the spin axis
    const tiltGroup = new THREE.Group();
    tiltGroup.rotation.z = THREE.MathUtils.degToRad(def.axialTiltDeg);
    tiltGroup.add(mesh);
    if (cloudMesh) {
      tiltGroup.remove(cloudMesh);
      tiltGroup.add(cloudMesh);
    }
    group.add(tiltGroup);
    mesh.userData.tiltGroup = tiltGroup;

    // Saturn's rings (radial UV mapping)
    if (def.id === "saturn") {
      const inner = radius * 1.24;
      const outer = radius * 2.27;
      const ringGeo = new THREE.RingGeometry(inner, outer, 180, 1);
      // Remap UVs so texture u = radial fraction
      const pos = ringGeo.attributes.position;
      const uv = ringGeo.attributes.uv;
      const v3 = new THREE.Vector3();
      for (let i = 0; i < pos.count; i++) {
        v3.fromBufferAttribute(pos, i);
        const t = (v3.length() - inner) / (outer - inner);
        uv.setXY(i, t, 0.5);
      }
      ringMesh = new THREE.Mesh(
        ringGeo,
        new THREE.MeshBasicMaterial({
          map: T.saturnRingTexture(),
          side: THREE.DoubleSide,
          transparent: true,
          depthWrite: false,
        }),
      );
      ringMesh.rotation.x = -Math.PI / 2;
      tiltGroup.add(ringMesh);
    }

    // Orbit line. Heliocentric lines are added to the scene root by
    // buildScene; the Moon's orbit line is attached to its own group.
    if (def.elements) {
      if (def.parent === null) {
        const pts = orbitEllipsePoints(def.elements).map((p) => {
          const s = toScene(p, AU_IN_SCENE_UNITS);
          return new THREE.Vector3(s.x, s.y, s.z);
        });
        orbitLine = new THREE.LineLoop(
          new THREE.BufferGeometry().setFromPoints(pts),
          new THREE.LineBasicMaterial({ color: 0x3a5f8a, transparent: true, opacity: 0.35 }),
        );
      } else if (def.parent === "earth") {
        // Moon orbit: circle of radius displaySemiMajorAxis, inclined 5.145°
        const a = def.displaySemiMajorAxis ?? 8.5;
        const pts: THREE.Vector3[] = [];
        const inc = THREE.MathUtils.degToRad(5.145);
        for (let s = 0; s <= 256; s++) {
          const t = (s / 256) * Math.PI * 2;
          const x = a * Math.cos(t);
          const z = a * Math.sin(t) * Math.cos(inc);
          const y = a * Math.sin(t) * Math.sin(inc);
          pts.push(new THREE.Vector3(x, y, z));
        }
        orbitLine = new THREE.LineLoop(
          new THREE.BufferGeometry().setFromPoints(pts),
          new THREE.LineBasicMaterial({ color: 0x555f70, transparent: true, opacity: 0.3 }),
        );
        group.add(orbitLine);
      }
    }
  }

  const label = makeLabel(def.name);
  label.position.set(0, radius * 1.55 + 1.2, 0);
  group.add(label);

  return { def, group, mesh, label, cloudMesh, ringMesh, orbitLine };
}

