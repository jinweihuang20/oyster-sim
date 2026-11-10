import * as THREE from 'three';

export const BRIGHT_MIN = 0.7;
export const BRIGHT_MAX = 1.4;
export const BRIGHT_STEP = 0.05;
export const BRIGHT_DEF = 1;

const renderers = new Set<THREE.WebGLRenderer>();
let current = BRIGHT_DEF;

/** 把亮度限制在 70%–140%，並對齊 5% 刻度 */
export function clampBright(n: number) {
  if (!Number.isFinite(n)) return BRIGHT_DEF;
  const x = Math.round(n / BRIGHT_STEP) * BRIGHT_STEP;
  return Math.min(BRIGHT_MAX, Math.max(BRIGHT_MIN, Math.round(x * 100) / 100));
}

export function getSceneBrightness() { return current; }

function applyOne(r: THREE.WebGLRenderer) {
  r.toneMapping = THREE.LinearToneMapping;
  r.toneMappingExposure = current;
}

/** 登記一個 3D 渲染器（工寮／廣場／死鬥），離開時請 unregister */
export function registerBrightRenderer(r: THREE.WebGLRenderer) {
  renderers.add(r);
  applyOne(r);
  return () => { renderers.delete(r); };
}

export function setSceneBrightness(v: number) {
  current = clampBright(v);
  for (const r of renderers) applyOne(r);
  return current;
}
