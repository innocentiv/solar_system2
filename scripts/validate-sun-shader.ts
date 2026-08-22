// Extracts the exact GLSL three.js r185 generates for the sun's ShaderMaterial
// (prefixes + chunk expansion, identical to what the browser compiles).
// Run: npx -y tsx scripts/validate-sun-shader.ts
import * as fs from "node:fs";
import * as THREE from "three";
import { WebGLProgram } from "three/src/renderers/webgl/WebGLProgram.js";

const sceneSrc = fs.readFileSync("src/sim/scene.ts", "utf8");
// The sun material is the one whose shader mentions uTint (the asteroid
// belt shader comes first in the file and would match otherwise)
const sunBlock = sceneSrc.slice(sceneSrc.indexOf("uTint"));
const vsMatch = sunBlock.match(/vertexShader: \/\* glsl \*\/ `([\s\S]*?)`/);
const fsMatch = sunBlock.match(/fragmentShader: \/\* glsl \*\/ `([\s\S]*?)`/);
if (!vsMatch || !fsMatch) {
  console.error("could not extract shaders from scene.ts");
  process.exit(1);
}
const material: any = new THREE.ShaderMaterial({
  uniforms: {
    map: { value: new THREE.Texture() },
    uTint: { value: new THREE.Color(2.6, 2.2, 1.6) },
  },
  vertexShader: vsMatch[1],
  fragmentShader: fsMatch[1],
});

// Record the final sources as gl.shaderSource is called
const sources: Record<number, string> = {};
const GL_CONSTS: Record<string, number> = {
  VERTEX_SHADER: 35633,
  FRAGMENT_SHADER: 35632,
  COMPILE_STATUS: 35713,
  LINK_STATUS: 35714,
  ACTIVE_UNIFORM: 35718,
  ACTIVE_ATTRIBUTES: 37660,
  MAX_VERTEX_UNIFORM_VECTORS: 36347,
  MAX_VARYING_VECTORS: 37338,
  MAX_VERTEX_TEXTURE_IMAGE_UNITS: 35660,
  MAX_TEXTURE_IMAGE_UNITS: 34964,
  MAX_VERTEX_ATTRIBS: 34921,
  MAX_COMBINED_TEXTURE_IMAGE_UNITS: 35657,
  MAX_FRAGMENT_UNIFORM_BLOCKS: 36557,
  MAX_VERTEX_UNIFORM_BLOCKS: 36556,
};
const calls: string[] = [];
const glStub = new Proxy(
  {},
  {
    get: (_t, prop: string) => {
      calls.push(prop);
      if (prop in GL_CONSTS) return GL_CONSTS[prop];
      if (prop === "createProgram") return () => ({});
      if (prop === "createShader") return (type: number) => ({ type });
      if (prop === "shaderSource")
        return (shader: { type: number }, src: string) => {
          console.error(
            "[stub] shaderSource called: type=",
            shader.type,
            "len=",
            src.length,
          );
          sources[shader.type] = src;
        };
      if (prop === "getParameter") return () => 128;
      if (prop === "getExtension") return () => null;
      if (
        prop === "getShaderInfoLog" ||
        prop === "getProgramInfoLog" ||
        prop === "getExtensionInfoLog"
      )
        return () => "";
      if (prop === "getActiveUniform" || prop === "getActiveAttrib")
        return () => ({ name: "x", type: 5126, size: 1 });
      return () => {};
    },
  },
);

const rendererStub: any = {
  getContext: () => glStub,
  debug: { checkShaderErrors: false },
  capabilities: {
    isWebGL2: true,
    isWebGL: true,
    logarithmicDepthBuffer: true,
    maxTextures: 16,
    maxVertexUniforms: 1024,
    maxVertexTextureUnits: 16,
    maxCombinedTextureUnits: 32,
    maxFragmentUniformBlocks: 16,
    maxVertexUniformBlocks: 16,
  },
  extensions: { get: () => null, has: () => false },
  properties: { get: () => ({}), remove: () => {} },
  state: { enable: () => {}, disable: () => {} },
};

// Parameters object: explicit fields + Proxy defaults for everything else
const explicit: Record<string, unknown> = {
  isRawShaderMaterial: false,
  defines: material.defines ?? {},
  vertexShader: material.vertexShader,
  fragmentShader: material.fragmentShader,
  glslVersion: null,
  shaderType: "ShaderMaterial",
  shaderName: "",
  logarithmicDepthBuffer: true,
  map: false,
  useFog: false,
  fog: false,
  fogExp2: false,
  shadowMapEnabled: false,
  shadowMapType: 0,
  numClippingPlanes: 0,
  numClipIntersection: 0,
  outputColorSpace: "srgb",
  toneMapping: 4,
  precision: "highp",
  dithering: false,
  isMeshBasicMaterial: false,
  instancing: false,
  instancingColor: false,
  instancingMorph: false,
  batching: false,
  batchingColor: false,
  morphTargets: false,
  morphNormals: false,
  morphColors: false,
  morphTargetsCount: 0,
  morphTextureStride: 0,
  skinned: false,
  vertexAlphas: false,
  vertexColors: false,
  vertexTangents: false,
  vertexNormals: true,
  vertexUv1s: false,
  vertexUv2s: false,
  vertexUv3s: false,
  hasPositionAttribute: true,
  index0AttributeName: "position",
  numDirLights: 0,
  numPointLights: 0,
  numHemiLights: 0,
  numSpotLights: 0,
  numSpotLightShadows: 0,
  numSpotLightShadowsWithMaps: 0,
  numRectAreaLights: 0,
  numLightProbes: 0,
  numLightProbeGrids: 0,
  numDirLightShadows: 0,
  numPointLightShadows: 0,
  numSpotLightMaps: 0,
  envMap: false,
  dispersion: false,
  sceneType: "opaque",
  premultipliedAlpha: false,
  alphaHash: false,
  contextLost: false,
  reverseDepthBuffer: false,
};
const parameters: any = new Proxy(explicit, {
  get: (t, prop: string) =>
    prop in t ? t[prop] : typeof prop === "string" ? false : undefined,
});

try {
  // @ts-expect-error internal constructor
  new WebGLProgram(rendererStub, "test", parameters, {
    bind: () => {},
    get: () => null,
  });
} catch (e) {
  console.error("WebGLProgram threw:", e);
}

const vert = sources[35633];
const frag = sources[35632];
console.error("[stub] captured sources:", Object.keys(sources));
if (!vert || !frag) {
  console.error(
    "shaderSource was not called. GL methods touched:\n" +
      [...new Set(calls)].join("\n"),
  );
  process.exit(1);
}
fs.writeFileSync("/tmp/sun.vert", vert);
fs.writeFileSync("/tmp/sun.frag", frag);
console.log("vertex source:", vert.length, "chars -> /tmp/sun.vert");
console.log("fragment source:", frag.length, "chars -> /tmp/sun.frag");
