import * as THREE from 'three';
import { rboxEnv, rcyl } from '../core/geo';
import type { MatFn } from '../dm/weapons';
import { CHAIR_SEAT_Y } from './props';

export type ChairPose = { x: number; z: number; yaw: number; key: string; /** 預設地面；機關槍高台等要抬高 */ y?: number };

const _d = new THREE.Object3D();
const _c = new THREE.Color();

function instMat(src: THREE.Material) {
  const m = src.clone();
  m.userData.sharedMat = true;
  return m;
}

/** 選位墊：一個 InstancedMesh，用 instanceColor／instanceOpacity 對應佔用與高亮 */
export function makeInstancedPads(poses: ChairPose[], M: MatFn, lo: boolean) {
  const geo = new THREE.CylinderGeometry(0.28, 0.28, 0.025, 16);
  const mat = lo
    ? new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 1, depthWrite: false })
    : new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 1, roughness: 0.2, depthWrite: false });
  mat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float instanceOpacity;\nvarying float vInstOp;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvInstOp = instanceOpacity;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vInstOp;')
      .replace('#include <dithering_fragment>', 'gl_FragColor.a *= vInstOp;\n#include <dithering_fragment>');
  };
  const im = new THREE.InstancedMesh(geo, mat, Math.max(1, poses.length));
  im.name = 'seatPadsIM';
  im.count = poses.length;
  im.frustumCulled = false;
  im.castShadow = false;
  im.receiveShadow = false;
  im.renderOrder = 2;
  const opacity = new Float32Array(Math.max(1, poses.length));
  im.geometry.setAttribute('instanceOpacity', new THREE.InstancedBufferAttribute(opacity, 1));
  const index = new Map<string, number>();
  const busy = new Uint8Array(poses.length);
  const hi = new Uint8Array(poses.length);
  const dummy = _d;
  for (let i = 0; i < poses.length; i++) {
    const p = poses[i];
    index.set(p.key, i);
    dummy.position.set(p.x, p.y ?? 0.015, p.z);
    dummy.rotation.set(0, p.yaw, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    im.setMatrixAt(i, dummy.matrix);
    opacity[i] = 0.28;
    _c.setHex(0x5a9ad0);
    im.setColorAt(i, _c);
  }
  im.instanceMatrix.needsUpdate = true;
  if (im.instanceColor) im.instanceColor.needsUpdate = true;
  (im.geometry.getAttribute('instanceOpacity') as THREE.InstancedBufferAttribute).needsUpdate = true;

  function flush(i: number) {
    if (hi[i]) {
      _c.setHex(0x7ec85a);
      opacity[i] = 0.75;
    } else if (busy[i]) {
      _c.setHex(0xc45c26);
      opacity[i] = 0.55;
    } else {
      _c.setHex(0x5a9ad0);
      opacity[i] = 0.28;
    }
    im.setColorAt(i, _c);
  }

  function setPad(key: string, state: { busy?: boolean; highlight?: boolean }) {
    const i = index.get(key);
    if (i == null) return;
    if (state.busy != null) busy[i] = state.busy ? 1 : 0;
    if (state.highlight != null) hi[i] = state.highlight ? 1 : 0;
    flush(i);
  }

  function apply() {
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
    (im.geometry.getAttribute('instanceOpacity') as THREE.InstancedBufferAttribute).needsUpdate = true;
  }

  return { mesh: im, index, setPad, apply, keys: () => index.keys() };
}

type Part = {
  geo: THREE.BufferGeometry;
  mat: THREE.Material;
  /** 每椅一個；或提供 offsets 變成每椅多個（椅腳） */
  offsets: [number, number, number][];
  rotX?: number;
  cast?: boolean;
};

/** 塑膠圓椅：每種零件一個 InstancedMesh，坐墊高亮墊另見 makeInstancedPads */
export function makeInstancedPlazaChairs(poses: ChairPose[], M: MatFn, lo: boolean) {
  const group = new THREE.Group();
  group.name = 'plazaChairsIM';
  const seatMat = instMat(M(0x3a7ac0, { roughness: 0.55 }));
  const ringMat = instMat(M(0x2f6aaf));
  const legMat = instMat(M(0x2a5a90, { roughness: 0.7 }));
  const backMat = instMat(M(0x3480c8, { roughness: 0.55 }));
  const parts: Part[] = [
    { geo: rcyl(0.2, 0.21, 0.05, 14), mat: seatMat, offsets: [[0, CHAIR_SEAT_Y, 0]], cast: !lo },
    { geo: rcyl(0.18, 0.19, 0.03, 12), mat: ringMat, offsets: [[0, CHAIR_SEAT_Y - 0.04, 0]] },
    { geo: rcyl(0.022, 0.028, CHAIR_SEAT_Y - 0.02, 6), mat: legMat, offsets: [[0.12, (CHAIR_SEAT_Y - 0.02) / 2, 0.12], [-0.12, (CHAIR_SEAT_Y - 0.02) / 2, 0.12], [0.12, (CHAIR_SEAT_Y - 0.02) / 2, -0.12], [-0.12, (CHAIR_SEAT_Y - 0.02) / 2, -0.12]] },
    { geo: new THREE.TorusGeometry(0.13, 0.012, 6, 16), mat: legMat, offsets: [[0, 0.14, 0]], rotX: Math.PI / 2 },
    { geo: rboxEnv(0.34, 0.08, 0.04), mat: backMat, offsets: [[0, CHAIR_SEAT_Y + 0.22, 0.16]], cast: !lo },
    { geo: rboxEnv(0.04, 0.28, 0.04), mat: backMat, offsets: [[-0.12, CHAIR_SEAT_Y + 0.12, 0.16], [0.12, CHAIR_SEAT_Y + 0.12, 0.16]] },
  ];
  const dummy = _d;
  const local = new THREE.Object3D();
  for (const part of parts) {
    const count = Math.max(1, poses.length * part.offsets.length);
    const im = new THREE.InstancedMesh(part.geo, part.mat, count);
    im.count = poses.length * part.offsets.length;
    im.castShadow = !!part.cast;
    im.receiveShadow = !lo;
    im.frustumCulled = false;
    im.userData.sharedGeo = true;
    let k = 0;
    for (const p of poses) {
      dummy.position.set(p.x, 0, p.z);
      dummy.rotation.set(0, p.yaw, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      for (const off of part.offsets) {
        local.position.set(off[0], off[1], off[2]);
        local.rotation.set(part.rotX ?? 0, 0, 0);
        local.scale.set(1, 1, 1);
        local.updateMatrix();
        dummy.updateMatrix();
        const mx = dummy.matrix.clone().multiply(local.matrix);
        im.setMatrixAt(k++, mx);
      }
    }
    im.instanceMatrix.needsUpdate = true;
    group.add(im);
  }
  const pads = makeInstancedPads(poses, M, lo);
  group.add(pads.mesh);
  return { group, pads };
}
