import * as THREE from 'three';
import type { MatFn, MeshAdd } from './weapons';

const LO_STRIP = [
  'roughness', 'metalness', 'flatShading', 'normalMap', 'roughnessMap', 'metalnessMap',
  'aoMap', 'bumpMap', 'displacementMap', 'envMap', 'envMapIntensity',
] as const;

/**
 * 死鬥／廣場共用材質 helper。
 * 環境一律 Lambert（避開 Standard 的 PBR 光照）；角色貼圖請自行用 Standard（見 makePlayerAvatar）。
 */
export function makeMeshHelpers(scene: THREE.Scene, LO: boolean): { M: MatFn; add: MeshAdd } {
  const M: MatFn = (c, o = {}) => {
    const rest = { ...o } as Record<string, unknown>;
    for (const k of LO_STRIP) delete rest[k];
    return new THREE.MeshLambertMaterial({ color: c, ...rest });
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
