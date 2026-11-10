import * as THREE from 'three';
import type { MatFn, MeshAdd } from './weapons';

const LO_STRIP = [
  'roughness', 'metalness', 'flatShading', 'normalMap', 'roughnessMap', 'metalnessMap',
  'aoMap', 'bumpMap', 'displacementMap', 'envMap', 'envMapIntensity',
] as const;

/**
 * 死鬥／廣場共用材質 helper。
 * LO：Lambert＋關陰影（對齊工寮 mat）；角色貼圖請自行用 Standard（見 makePlayerAvatar）。
 */
export function makeMeshHelpers(scene: THREE.Scene, LO: boolean): { M: MatFn; add: MeshAdd } {
  const M: MatFn = (c, o = {}) => {
    if (LO) {
      const rest = { ...o } as Record<string, unknown>;
      for (const k of LO_STRIP) delete rest[k];
      return new THREE.MeshLambertMaterial({ color: c, ...rest });
    }
    return new THREE.MeshStandardMaterial({
      color: c,
      roughness: 0.8,
      metalness: o.metalness ?? 0,
      flatShading: false,
      ...o,
    });
  };
  const add: MeshAdd = (g, m, p, parent = scene, shadow = true) => {
    const x = new THREE.Mesh(g, m);
    x.position.set(...p);
    x.castShadow = !LO && shadow;
    x.receiveShadow = !LO;
    parent.add(x);
    return x;
  };
  return { M, add };
}
