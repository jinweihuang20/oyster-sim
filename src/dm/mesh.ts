import * as THREE from 'three';
import type { MatFn, MeshAdd } from './weapons';

/** 死鬥場景共用的材質／加 mesh helper */
export function makeMeshHelpers(scene: THREE.Scene, LO: boolean): { M: MatFn; add: MeshAdd } {
  const M: MatFn = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.8, flatShading: false, ...o });
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
