import * as THREE from 'three';
import { HALF } from './constants';

export type BKind = 'fly' | 'solid';
export type Breakable = {
  root: THREE.Object3D; kind: BKind; hp: number; maxHp: number; alive: boolean; flying: boolean;
  vel: THREE.Vector3; angVel: THREE.Vector3; coverIdx: number; halfH: number; rad: number; mass: number; box: THREE.Box3;
};

export type CrackSfx = { crack: (at: THREE.Vector3, heavy?: boolean) => void };

/** solid＝大型／掩體只留彈痕；fly＝桶椅臉盆可打飛 */
export function createBreakables(opts: {
  scene: THREE.Scene;
  LO: boolean;
  covers: THREE.Box3[];
  sfx: CrackSfx;
}) {
  const { scene, LO, covers, sfx } = opts;
  const breakables: Breakable[] = [];

  function syncBox(b: Breakable) {
    if (b.coverIdx >= 0) return;
    b.box.setFromObject(b.root); b.box.min.addScalar(-0.06); b.box.max.addScalar(0.06);
  }
  function regBreak(root: THREE.Object3D, kind: BKind, hp: number, halfH: number, rad: number, coverIdx = -1, mass = 1) {
    const b: Breakable = { root, kind, hp, maxHp: hp, alive: true, flying: false, vel: new THREE.Vector3(), angVel: new THREE.Vector3(), coverIdx, halfH, rad, mass, box: new THREE.Box3() };
    breakables.push(b); syncBox(b); return b;
  }

  const SN = LO ? 48 : 100;
  const scrap = new THREE.InstancedMesh(
    new THREE.PlaneGeometry(0.06, 0.035),
    new THREE.MeshBasicMaterial({ color: 0x8a6440, transparent: true, opacity: 0.7, depthWrite: false, side: THREE.DoubleSide }),
    SN,
  );
  scrap.frustumCulled = false; scrap.renderOrder = 2; scene.add(scrap);
  const sp = new Float32Array(SN * 3), sv = new Float32Array(SN * 3), sl = new Float32Array(SN); let si = 0;
  const _sm = new THREE.Matrix4(), _sz = new THREE.Matrix4().makeScale(0, 0, 0), _sc = new THREE.Color();
  for (let i = 0; i < SN; i++) scrap.setMatrixAt(i, _sz);
  const scrapCols = [0x8a6440, 0x5e4128, 0x2a6ad0, 0xd04040, 0xe8e4d8, 0x707070, 0xc84030];

  // 彈痕：固定池環形覆寫，逾時縮小消失，不 new mesh（防記憶體堆積）
  const SCN = LO ? 40 : 80;
  const scar = new THREE.InstancedMesh(
    new THREE.CircleGeometry(0.07, LO ? 6 : 10),
    new THREE.MeshBasicMaterial({ color: 0x1c1612, transparent: true, opacity: 0.82, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
    SCN,
  );
  scar.frustumCulled = false; scar.renderOrder = 1; scene.add(scar);
  const scarLife = new Float32Array(SCN), scarScale = new Float32Array(SCN);
  const scarPos = new Float32Array(SCN * 3), scarNrm = new Float32Array(SCN * 3);
  let scarI = 0;
  const _scarP = new THREE.Vector3(), _scarN = new THREE.Vector3(), _scarQ = new THREE.Quaternion(), _scarS = new THREE.Vector3();
  const _zAxis = new THREE.Vector3(0, 0, 1);
  for (let i = 0; i < SCN; i++) { scar.setMatrixAt(i, _sz); scarLife[i] = 0; }
  const scarCols = [0x1a1410, 0x2a2218, 0x12100c, 0x3a2e22];

  function placeScar(at: THREE.Vector3, normal: THREE.Vector3) {
    const i = scarI; scarI = (scarI + 1) % SCN;
    const nlen = Math.hypot(normal.x, normal.y, normal.z) || 1;
    const nx = normal.x / nlen, ny = normal.y / nlen, nz = normal.z / nlen;
    // 略抬離表面，避免 z-fight
    scarPos[i * 3] = at.x + nx * 0.02;
    scarPos[i * 3 + 1] = at.y + ny * 0.02;
    scarPos[i * 3 + 2] = at.z + nz * 0.02;
    scarNrm[i * 3] = nx; scarNrm[i * 3 + 1] = ny; scarNrm[i * 3 + 2] = nz;
    scarLife[i] = 4.5 + Math.random() * 3.5;
    scarScale[i] = 0.55 + Math.random() * 0.9;
    scar.setColorAt(i, _sc.setHex(scarCols[i % scarCols.length]));
    if (scar.instanceColor) scar.instanceColor.needsUpdate = true;
    writeScar(i, 1);
  }
  function writeScar(i: number, fade: number) {
    _scarP.set(scarPos[i * 3], scarPos[i * 3 + 1], scarPos[i * 3 + 2]);
    _scarN.set(scarNrm[i * 3], scarNrm[i * 3 + 1], scarNrm[i * 3 + 2]);
    _scarQ.setFromUnitVectors(_zAxis, _scarN);
    const sc = scarScale[i] * fade;
    _scarS.set(sc, sc * 0.72, 1);
    _sm.compose(_scarP, _scarQ, _scarS);
    scar.setMatrixAt(i, _sm);
  }
  function stepScars(dt: number) {
    let any = false;
    for (let i = 0; i < SCN; i++) {
      if (scarLife[i] <= 0) continue;
      any = true;
      scarLife[i] -= dt;
      if (scarLife[i] <= 0) { scarLife[i] = 0; scar.setMatrixAt(i, _sz); continue; }
      const fade = Math.min(1, scarLife[i] / 1.2); // 最後 1.2s 縮小消失
      if (fade < 1) writeScar(i, fade);
    }
    if (any) scar.instanceMatrix.needsUpdate = true;
  }

  function sprayScrap(at: THREE.Vector3, dir: THREE.Vector3, n: number, col = 0x8a6440) {
    const nn = LO ? Math.min(n, 3) : Math.min(n, 5);
    for (let k = 0; k < nn; k++) {
      const i = si; si = (si + 1) % SN; const spd = 1.6 + Math.random() * 3.5;
      sp[i * 3] = at.x; sp[i * 3 + 1] = at.y; sp[i * 3 + 2] = at.z;
      sv[i * 3] = dir.x * spd + (Math.random() - .5) * 2; sv[i * 3 + 1] = Math.abs(dir.y) * spd + 1.2 + Math.random() * 2; sv[i * 3 + 2] = dir.z * spd + (Math.random() - .5) * 2;
      sl[i] = 0.35 + Math.random() * 0.45; scrap.setColorAt(i, _sc.setHex(col));
    }
    if (scrap.instanceColor) scrap.instanceColor.needsUpdate = true;
  }
  const _sq = new THREE.Quaternion(), _spv = new THREE.Vector3(), _ss = new THREE.Vector3();
  function stepScrap(dt: number) {
    let any = false;
    for (let i = 0; i < SN; i++) {
      if (sl[i] <= 0) continue; any = true; sl[i] -= dt;
      if (sl[i] <= 0 || sp[i * 3 + 1] < 0.02) { sl[i] = 0; scrap.setMatrixAt(i, _sz); continue; }
      sv[i * 3 + 1] -= 14 * dt; sp[i * 3] += sv[i * 3] * dt; sp[i * 3 + 1] += sv[i * 3 + 1] * dt; sp[i * 3 + 2] += sv[i * 3 + 2] * dt;
      if (sp[i * 3 + 1] < 0.02) { sp[i * 3 + 1] = 0.02; sv[i * 3 + 1] *= -0.25; sv[i * 3] *= 0.6; sv[i * 3 + 2] *= 0.6; }
      const sc = Math.min(1, sl[i] * 2.2) * 0.85;
      _spv.set(sp[i * 3], sp[i * 3 + 1], sp[i * 3 + 2]); _ss.set(sc, sc * 0.7, 1); _sq.identity();
      _sm.compose(_spv, _sq, _ss); scrap.setMatrixAt(i, _sm);
    }
    if (any) scrap.instanceMatrix.needsUpdate = true;
  }
  function dentVisual(root: THREE.Object3D, amount = 0.12) {
    root.traverse(o => {
      const m = o as THREE.Mesh; if (!m.isMesh) return;
      if (!m.userData._dentOwn) {
        m.material = Array.isArray(m.material) ? m.material.map(x => x.clone()) : (m.material as THREE.Material).clone();
        m.userData._dentOwn = true;
      }
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      for (const mat of mats) {
        const sm = mat as THREE.MeshStandardMaterial;
        if (sm.color) sm.color.offsetHSL(0, -0.05, -amount);
        if (sm.emissive) sm.emissive.offsetHSL(0, 0, -amount * 0.5);
      }
      m.scale.multiplyScalar(0.97 + Math.random() * 0.02);
    });
    root.rotation.z += (Math.random() - .5) * 0.08; root.rotation.x += (Math.random() - .5) * 0.05;
  }
  function launchFly(b: Breakable, dir: THREE.Vector3, force: number) {
    b.flying = true; const inv = 1 / Math.max(0.35, b.mass);
    b.vel.copy(dir).multiplyScalar(force * inv); b.vel.y = Math.max(3.5, Math.abs(dir.y) * force * 0.4 + 4 * inv);
    b.angVel.set((Math.random() - .5) * 10, (Math.random() - .5) * 14, (Math.random() - .5) * 10).multiplyScalar(inv);
  }
  function hitBreakable(b: Breakable, at: THREE.Vector3, dir: THREE.Vector3) {
    if (!b.alive || b.flying) return;
    const nd = dir.clone().normalize();
    placeScar(at, _scarN.copy(nd).multiplyScalar(-1));
    if (b.kind === 'fly') {
      dentVisual(b.root, 0.1);
      sprayScrap(at, nd, 3, scrapCols[Math.floor(Math.random() * scrapCols.length)]);
      b.hp -= 1; sfx.crack(at, false);
      if (b.hp > 0) { b.root.position.addScaledVector(nd, 0.08); syncBox(b); return; }
      launchFly(b, nd, 9 + Math.random() * 4);
      return;
    }
    // solid：只留彈痕／碎屑，不壓暗材質（避免越打越黑）
    sprayScrap(at, nd, b.hp <= 1 ? 2 : 3, scrapCols[Math.floor(Math.random() * scrapCols.length)]);
    if (b.hp > 1) b.hp -= 1;
    sfx.crack(at, false);
  }
  function propContains(b: Breakable, p: THREE.Vector3) {
    if (!b.alive || b.flying) return false;
    if (b.coverIdx >= 0) {
      const c = covers[b.coverIdx]; if (c.max.y < 0) return false;
      return p.x >= c.min.x - 0.05 && p.x <= c.max.x + 0.05 && p.y >= c.min.y - 0.02 && p.y <= c.max.y + 0.08 && p.z >= c.min.z - 0.05 && p.z <= c.max.z + 0.05;
    }
    if (b.kind === 'fly' || b.rad <= 0.55) {
      const dx = p.x - b.root.position.x, dz = p.z - b.root.position.z, dy = p.y - (b.root.position.y || 0);
      return dx * dx + dz * dz <= (b.rad + 0.1) * (b.rad + 0.1) && dy >= -0.05 && dy <= b.halfH * 2 + 0.2;
    }
    return b.box.containsPoint(p);
  }
  function stepBreakables(dt: number) {
    for (const b of breakables) {
      if (!b.alive || !b.flying) continue;
      b.vel.y -= 18 * dt;
      b.root.position.addScaledVector(b.vel, dt);
      b.root.rotation.x += b.angVel.x * dt; b.root.rotation.y += b.angVel.y * dt; b.root.rotation.z += b.angVel.z * dt;
      if (Math.abs(b.root.position.x) > HALF - 0.3) { b.root.position.x = Math.sign(b.root.position.x) * (HALF - 0.3); b.vel.x *= -0.4; }
      if (Math.abs(b.root.position.z) > HALF - 0.3) { b.root.position.z = Math.sign(b.root.position.z) * (HALF - 0.3); b.vel.z *= -0.4; }
      const floorY = b.halfH;
      if (b.root.position.y < floorY) {
        b.root.position.y = floorY; b.vel.y *= -0.35; b.vel.x *= 0.72; b.vel.z *= 0.72; b.angVel.multiplyScalar(0.7);
        if (b.vel.lengthSq() < 0.8 && Math.abs(b.vel.y) < 1.2) { b.flying = false; b.vel.set(0, 0, 0); b.angVel.set(0, 0, 0); b.alive = true; syncBox(b); }
      }
    }
  }

  return { breakables, regBreak, hitBreakable, propContains, stepBreakables, stepScrap, placeScar, stepScars };
}
