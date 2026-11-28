/**
 * 即時陰影政策（mobile.txt §2）：
 * - 能烘焙就烘焙（plaza bakeStaticLighting／vertexColors）
 * - 必須即時時：只允許 1 盞主光 castShadow；map ≤1024；不用 PCFSoft
 */
import * as THREE from 'three';

export const SHADOW_MAP_MAX = 1024;
export const SHADOW_MAP_MOBILE = 512;

export type ShadowPolicyOpts = {
  coarse?: boolean;
  eco?: boolean;
  /** 廣場等已烘焙場景：強制關即時陰影 */
  bakedScene?: boolean;
};

/** 是否開啟 renderer.shadowMap */
export function shadowMapEnabled(opts: ShadowPolicyOpts): boolean {
  if (opts.bakedScene || opts.eco || opts.coarse) return false;
  return true;
}

/** 陰影演算法：手機／省電 Basic；桌機 PCF（避免 PCFSoft 的額外採樣） */
export function shadowMapType(opts: ShadowPolicyOpts): THREE.ShadowMapType {
  if (opts.coarse || opts.eco) return THREE.BasicShadowMap;
  return THREE.PCFShadowMap;
}

/** 陰影貼圖邊長：≤1024，手機／省電 512 */
export function shadowMapSize(opts: ShadowPolicyOpts): number {
  if (opts.coarse || opts.eco) return SHADOW_MAP_MOBILE;
  return SHADOW_MAP_MAX;
}

/**
 * 套到 renderer + 指定唯一投影主光（其餘燈 castShadow 強制 false）。
 * mainLight 建議 DirectionalLight（PointLight 陰影是六面，行動 GPU 極燒）。
 */
export function applyShadowPolicy(
  renderer: THREE.WebGLRenderer,
  opts: ShadowPolicyOpts,
  mainLight?: THREE.Light | null,
  otherLights: THREE.Light[] = [],
): void {
  const on = shadowMapEnabled(opts);
  renderer.shadowMap.enabled = on;
  renderer.shadowMap.type = shadowMapType(opts);
  const size = shadowMapSize(opts);

  for (const L of otherLights) L.castShadow = false;

  if (!mainLight) return;
  mainLight.castShadow = on;
  if (!on || !('shadow' in mainLight) || !mainLight.shadow) return;
  const sh = mainLight.shadow as THREE.LightShadow;
  if (sh.mapSize.x !== size || sh.mapSize.y !== size) {
    sh.mapSize.set(size, size);
    sh.map?.dispose();
    sh.map = null;
  }
}
