import * as THREE from "three";
import { ODD, rollOddIndex } from "../oddities";

/** 擊殺掉落奇物：噴出 → 落地 → 走近自動撿 */
export type OddLoot = {
  i: number;
  mesh: THREE.Group;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  life: number;
  bob: number;
};

export const ODD_PICK_R = 1.4;
/** 玩家擊殺才有機會掉；種類依權重隨機（不含活動限定） */
export const ODD_DROP_CHANCE = 0.15;

export function makeOddLootMesh(i: number, LO: boolean): THREE.Group {
  const o = ODD[i];
  const col = new THREE.Color(o.color);
  const g = new THREE.Group();
  const ball = new THREE.Mesh(
    new THREE.SphereGeometry(0.2, LO ? 6 : 12, LO ? 5 : 10),
    new THREE.MeshStandardMaterial({
      color: col,
      emissive: col,
      emissiveIntensity: 0.55,
      roughness: 0.35,
      metalness: 0.2,
    }),
  );
  ball.castShadow = !LO;
  g.add(ball);
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.26, 0.38, LO ? 8 : 20),
    new THREE.MeshBasicMaterial({
      color: col,
      transparent: true,
      opacity: 0.5,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.02;
  g.add(ring);
  return g;
}

export function spawnOddLoot(
  at: THREE.Vector3,
  scene: THREE.Scene,
  LO: boolean,
  list: OddLoot[],
): OddLoot | null {
  if (Math.random() > ODD_DROP_CHANCE) return null;
  const i = rollOddIndex();
  const mesh = makeOddLootMesh(i, LO);
  const pos = at.clone();
  pos.y = Math.max(0.4, at.y);
  const a = Math.random() * Math.PI * 2;
  const sp = 3.5 + Math.random() * 4;
  const vel = new THREE.Vector3(
    Math.cos(a) * sp,
    4.5 + Math.random() * 3.5,
    Math.sin(a) * sp,
  );
  mesh.position.copy(pos);
  scene.add(mesh);
  const drop: OddLoot = {
    i,
    mesh,
    pos,
    vel,
    life: 45,
    bob: Math.random() * Math.PI * 2,
  };
  list.push(drop);
  return drop;
}

export function stepOddLoot(
  dt: number,
  list: OddLoot[],
  scene: THREE.Scene,
  half: number,
): void {
  for (let i = list.length - 1; i >= 0; i--) {
    const d = list[i];
    d.life -= dt;
    if (d.life <= 0) {
      scene.remove(d.mesh);
      list.splice(i, 1);
      continue;
    }
    d.vel.y -= 18 * dt;
    d.pos.addScaledVector(d.vel, dt);
    if (d.pos.y <= 0.22) {
      d.pos.y = 0.22;
      d.vel.y = 0;
      d.vel.x *= Math.exp(-8 * dt);
      d.vel.z *= Math.exp(-8 * dt);
      if (d.vel.lengthSq() < 0.04) d.vel.set(0, 0, 0);
    }
    d.pos.x = Math.max(-half + 0.4, Math.min(half - 0.4, d.pos.x));
    d.pos.z = Math.max(-half + 0.4, Math.min(half - 0.4, d.pos.z));
    d.bob += dt * 3.2;
    const hover = d.vel.lengthSq() < 0.05 ? Math.sin(d.bob) * 0.06 : 0;
    d.mesh.position.set(d.pos.x, d.pos.y + hover, d.pos.z);
    d.mesh.rotation.y += dt * 1.6;
    const fade = d.life < 4 ? d.life / 4 : 1;
    d.mesh.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.Material | undefined;
      if (m && "opacity" in m) {
        (m as THREE.MeshBasicMaterial).transparent = true;
        (m as THREE.MeshBasicMaterial).opacity =
          fade * ("emissive" in m ? 1 : 0.5);
      }
    });
  }
}

export function tryPickOddLoot(
  playerPos: THREE.Vector3,
  list: OddLoot[],
  scene: THREE.Scene,
  grant: (
    i: number,
  ) => { name: string; line: string; n: number; color: string } | null,
): {
  name: string;
  line: string;
  n: number;
  color: string;
  pos: THREE.Vector3;
} | null {
  let best = -1,
    bestD = ODD_PICK_R;
  for (let i = 0; i < list.length; i++) {
    const d = list[i];
    if (d.pos.y > 0.6) continue; // 還在飛不撿
    const dist = Math.hypot(d.pos.x - playerPos.x, d.pos.z - playerPos.z);
    if (dist < bestD) {
      bestD = dist;
      best = i;
    }
  }
  if (best < 0) return null;
  const d = list[best];
  const got = grant(d.i);
  scene.remove(d.mesh);
  list.splice(best, 1);
  if (!got) return null;
  return { ...got, pos: d.pos.clone() };
}
