/** 廣場蚵仔機關槍：座架模型、子彈、槍口火花、彈殼 */
import * as THREE from 'three';
import { MG_SEATS, MG_SEAT_COUNT, MG_PILE_ID, MG_STAND_BACK, MG_PLATFORM, MG_STAIRS, MG_DECK_Y } from './layout';
import { rboxEnv, rcyl } from '../core/geo';

const BULLET_SPEED = 38;
const BULLET_LIFE = 1.2;
/** 死鬥殼彈：直線飛行、無重力 */
const BULLET_GRAV = 0;
const CASING_LIFE = 0.7;
const HIT_RADIUS = 0.55;
const MARK_LIFE = 3.6;
const MARK_MAX = 48;
const MARK_SIZE = 0.038;
const FLASH_LIFE = 0.055;
/** 彈痕最高高度；超過視為天空／飛空，不貼 */
const MARK_MAX_Y = 0.08;

export type MgBullet = {
  id: number;
  mesh: THREE.Mesh;
  vx: number; vy: number; vz: number;
  life: number;
  fromConn: string;
  local: boolean;
};

export type MgHitTarget = {
  connId: string;
  x: number;
  y: number;
  z: number;
  seated: boolean;
};

export function makeMgMount(lo = false): THREE.Group {
  const g = new THREE.Group();
  g.name = 'mgMount';
  g.userData.noMerge = true;
  const steel = lo
    ? new THREE.MeshLambertMaterial({ color: 0x4a5560 })
    : new THREE.MeshStandardMaterial({ color: 0x4a5560, metalness: 0.55, roughness: 0.4 });
  const dark = lo
    ? new THREE.MeshLambertMaterial({ color: 0x2a3038 })
    : new THREE.MeshStandardMaterial({ color: 0x2a3038, metalness: 0.4, roughness: 0.55 });
  const wood = lo
    ? new THREE.MeshLambertMaterial({ color: 0x6a4a28 })
    : new THREE.MeshStandardMaterial({ color: 0x6a4a28, roughness: 0.85 });
  // 底座
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.5, 0.18, lo ? 8 : 12), wood);
  base.position.y = 0.09;
  g.add(base);
  // 立柱
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.85, lo ? 6 : 8), steel);
  pole.position.y = 0.55;
  g.add(pole);
  // 槍架
  const cradle = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.12, 0.55), dark);
  cradle.position.set(0, 1.02, -0.05);
  g.add(cradle);
  // 槍管組（yaw／pitch 會掛在這）
  const gun = new THREE.Group();
  gun.name = 'mgBarrel';
  gun.position.set(0, 1.08, -0.05);
  g.add(gun);
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.55), steel);
  body.position.z = -0.1;
  gun.add(body);
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.04, 0.7, lo ? 6 : 8), dark);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.z = -0.55;
  gun.add(barrel);
  const muzzle = new THREE.Object3D();
  muzzle.name = 'mgMuzzle';
  muzzle.position.set(0, 0, -0.92);
  gun.add(muzzle);
  const eject = new THREE.Object3D();
  eject.name = 'mgEject';
  eject.position.set(0.12, 0.02, -0.15);
  gun.add(eject);
  // 彈藥箱
  const box = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.2, 0.22), dark);
  box.position.set(0.28, 0.85, 0.05);
  g.add(box);
  // 站位標記（槍後方；須高於甲板頂 p.y+0.12，否則埋進木板）
  const pad = new THREE.Mesh(
    new THREE.CircleGeometry(0.45, lo ? 10 : 16),
    new THREE.MeshBasicMaterial({ color: 0xc0392b, transparent: true, opacity: 0.22, depthWrite: false }),
  );
  pad.rotation.x = -Math.PI / 2;
  pad.position.set(0, 0.145, MG_STAND_BACK);
  pad.renderOrder = 2;
  g.add(pad);
  return g;
}

/** 烤區旁機關槍高台＋北向樓梯（可走上去） */
export function buildMgPlatform(lo = false): THREE.Group {
  const g = new THREE.Group();
  g.name = 'mgPlatform';
  g.userData.noMerge = true;
  const wood = lo
    ? new THREE.MeshLambertMaterial({ color: 0x6a5238 })
    : new THREE.MeshStandardMaterial({ color: 0x6a5238, roughness: 0.88 });
  const plank = lo
    ? new THREE.MeshLambertMaterial({ color: 0x7a6340 })
    : new THREE.MeshStandardMaterial({ color: 0x7a6340, roughness: 0.82 });
  const steel = lo
    ? new THREE.MeshLambertMaterial({ color: 0x4a5560 })
    : new THREE.MeshStandardMaterial({ color: 0x4a5560, metalness: 0.45, roughness: 0.5 });
  const p = MG_PLATFORM;
  const segs = lo ? 5 : 8;
  // 四腳
  for (const [lx, lz] of [[-1, -1], [-1, 1], [1, -1], [1, 1]] as const) {
    const leg = new THREE.Mesh(rcyl(0.1, 0.12, p.y, segs), wood);
    leg.position.set(p.cx + lx * (p.w * 0.42), p.y * 0.5, p.cz + lz * (p.d * 0.42));
    g.add(leg);
  }
  // 甲板
  const deck = new THREE.Mesh(rboxEnv(p.w, 0.12, p.d), plank);
  deck.position.set(p.cx, p.y + 0.06, p.cz);
  g.add(deck);
  // 簡易欄杆（北面留樓梯口）
  const railH = 0.72;
  for (const side of [-1, 1] as const) {
    const rail = new THREE.Mesh(rboxEnv(0.06, railH, p.d * 0.92), steel);
    rail.position.set(p.cx + side * (p.w * 0.5 - 0.04), p.y + 0.12 + railH * 0.5, p.cz);
    g.add(rail);
  }
  {
    const back = new THREE.Mesh(rboxEnv(p.w * 0.92, railH, 0.06), steel);
    back.position.set(p.cx, p.y + 0.12 + railH * 0.5, p.cz + p.d * 0.5 - 0.04);
    g.add(back);
  }
  // 北向樓梯
  const st = MG_STAIRS;
  const n = st.steps;
  const stepD = (st.z1 - st.z0) / n;
  const stepH = MG_DECK_Y / n;
  const stepW = st.x1 - st.x0;
  for (let i = 0; i < n; i++) {
    const y0 = i * stepH;
    const zMid = st.z0 + (i + 0.5) * stepD;
    const step = new THREE.Mesh(rboxEnv(stepW, Math.max(0.06, stepH * 0.85), stepD * 0.92), plank);
    step.position.set((st.x0 + st.x1) * 0.5, y0 + stepH * 0.45, zMid);
    g.add(step);
  }
  // 樓梯兩側扶手
  for (const side of [-1, 1] as const) {
    const x = side < 0 ? st.x0 - 0.04 : st.x1 + 0.04;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const post = new THREE.Mesh(rcyl(0.035, 0.035, 0.55 + t * 0.15, 5), wood);
      post.position.set(x, t * MG_DECK_Y + 0.4, st.z0 + t * (st.z1 - st.z0));
      g.add(post);
    }
  }
  return g;
}

export function buildMgMounts(root: THREE.Object3D, lo = false): THREE.Group[] {
  root.add(buildMgPlatform(lo));
  const out: THREE.Group[] = [];
  for (let i = 0; i < MG_SEAT_COUNT; i++) {
    const s = MG_SEATS[i];
    const m = makeMgMount(lo);
    m.position.set(s.x, MG_DECK_Y, s.z);
    m.rotation.y = s.yaw;
    m.userData.mgSlot = i;
    m.userData.pileId = MG_PILE_ID;
    root.add(m);
    out.push(m);
  }
  return out;
}

export function mgMuzzleWorld(mount: THREE.Object3D, out = new THREE.Vector3()) {
  const m = mount.getObjectByName('mgMuzzle');
  if (m) m.getWorldPosition(out);
  else mount.getWorldPosition(out);
  return out;
}

export function mgEjectWorld(mount: THREE.Object3D, out = new THREE.Vector3()) {
  const m = mount.getObjectByName('mgEject');
  if (m) m.getWorldPosition(out);
  else {
    mgMuzzleWorld(mount, out);
    out.y += 0.05;
  }
  return out;
}

const _mgQ = new THREE.Quaternion();
export function mgMountRight(mount: THREE.Object3D, out = new THREE.Vector3()) {
  mount.getWorldQuaternion(_mgQ);
  out.set(1, 0, 0).applyQuaternion(_mgQ).normalize();
  return out;
}

export function aimMgMount(mount: THREE.Object3D, yaw: number, pitch: number) {
  const gun = mount.getObjectByName('mgBarrel');
  if (!gun) return;
  // mount 已有 base yaw；槍管相對 base 再轉 lookYaw／pitch（勿過度夾 pitch，否則大角度槍管跟不上準心）
  gun.rotation.order = 'YXZ';
  gun.rotation.y = yaw;
  gun.rotation.x = Math.max(-1.2, Math.min(0.85, pitch));
}

type FxPool = { mesh: THREE.Object3D; life: number; maxLife: number }[];
type MarkFx = { mesh: THREE.Mesh; life: number };
type SparkFx = { mesh: THREE.Mesh; life: number; vx: number; vy: number; vz: number };

function makeMuzzleGlowTex() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const x = c.getContext('2d')!;
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,240,1)');
  g.addColorStop(0.18, 'rgba(255,230,120,0.95)');
  g.addColorStop(0.45, 'rgba(255,140,40,0.55)');
  g.addColorStop(1, 'rgba(255,60,0,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, 64, 64);
  // 十字星芒
  x.globalCompositeOperation = 'lighter';
  const ray = x.createLinearGradient(32, 0, 32, 64);
  ray.addColorStop(0, 'rgba(255,200,80,0)');
  ray.addColorStop(0.5, 'rgba(255,240,180,0.85)');
  ray.addColorStop(1, 'rgba(255,200,80,0)');
  x.fillStyle = ray;
  x.fillRect(28, 2, 8, 60);
  x.fillRect(2, 28, 60, 8);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeBulletMarkTex() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const x = c.getContext('2d')!;
  x.clearRect(0, 0, 64, 64);
  // 焦痕外圈
  const ring = x.createRadialGradient(32, 32, 4, 32, 32, 28);
  ring.addColorStop(0, 'rgba(20,16,12,0.95)');
  ring.addColorStop(0.35, 'rgba(40,32,24,0.75)');
  ring.addColorStop(0.7, 'rgba(55,42,30,0.35)');
  ring.addColorStop(1, 'rgba(40,30,20,0)');
  x.fillStyle = ring;
  x.beginPath(); x.arc(32, 32, 28, 0, Math.PI * 2); x.fill();
  // 中心彈孔
  x.fillStyle = 'rgba(8,6,5,0.95)';
  x.beginPath(); x.arc(32, 32, 5.5, 0, Math.PI * 2); x.fill();
  x.fillStyle = 'rgba(0,0,0,1)';
  x.beginPath(); x.arc(31, 31, 3.2, 0, Math.PI * 2); x.fill();
  // 細裂紋
  x.strokeStyle = 'rgba(15,12,10,0.55)';
  x.lineWidth = 1.2;
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + 0.3;
    x.beginPath();
    x.moveTo(32 + Math.cos(a) * 6, 32 + Math.sin(a) * 6);
    x.lineTo(32 + Math.cos(a) * (16 + (i % 2) * 6), 32 + Math.sin(a) * (16 + (i % 2) * 6));
    x.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export class MgFxSystem {
  readonly root = new THREE.Group();
  private bullets: MgBullet[] = [];
  private flashes: FxPool = [];
  private casings: FxPool = [];
  private marks: MarkFx[] = [];
  private sparks: SparkFx[] = [];
  private meatGeo: THREE.BufferGeometry;
  private meatMat: THREE.MeshStandardMaterial | THREE.MeshLambertMaterial;
  private flashTex: THREE.CanvasTexture;
  private flashMat: THREE.MeshBasicMaterial;
  private markTex: THREE.CanvasTexture;
  private markMat: THREE.MeshBasicMaterial;
  private markGeo: THREE.CircleGeometry;
  private casingMat: THREE.MeshStandardMaterial | THREE.MeshLambertMaterial;
  private sparkMat: THREE.MeshBasicMaterial;
  private sparkGeo: THREE.SphereGeometry;
  private _hit = new THREE.Vector3();
  private _tmp = new THREE.Vector3();
  private _n = new THREE.Vector3();
  private _q = new THREE.Quaternion();
  private _up = new THREE.Vector3(0, 1, 0);
  private _zAxis = new THREE.Vector3(0, 0, 1);

  constructor(_shellGeo: THREE.BufferGeometry, _shellMat: THREE.Material, lo = false) {
    this.root.name = 'mgFx';
    this.root.userData.noMerge = true;
    // 簡單版蚵仔肉：扁平橢球
    this.meatGeo = new THREE.SphereGeometry(0.04, lo ? 6 : 8, lo ? 5 : 6);
    this.meatGeo.scale(1.35, 0.55, 1.05);
    this.meatMat = lo
      ? new THREE.MeshLambertMaterial({ color: 0xd8cbb0 })
      : new THREE.MeshStandardMaterial({ color: 0xd8cbb0, roughness: 0.35, metalness: 0.05 });
    this.flashTex = makeMuzzleGlowTex();
    this.flashMat = new THREE.MeshBasicMaterial({
      map: this.flashTex, transparent: true, opacity: 1, depthWrite: false,
      side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthTest: true,
    });
    this.markTex = makeBulletMarkTex();
    this.markMat = new THREE.MeshBasicMaterial({
      map: this.markTex, transparent: true, opacity: 0.92, depthWrite: false,
      side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    });
    this.markGeo = new THREE.CircleGeometry(1, lo ? 10 : 16);
    this.casingMat = lo
      ? new THREE.MeshLambertMaterial({ color: 0xd4a84a })
      : new THREE.MeshStandardMaterial({ color: 0xd4a84a, metalness: 0.6, roughness: 0.35 });
    this.sparkMat = new THREE.MeshBasicMaterial({
      color: 0xffc060, transparent: true, opacity: 1, depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.sparkGeo = new THREE.SphereGeometry(0.018, 4, 3);
  }

  spawnBullet(opts: {
    id: number; from: THREE.Vector3; dir: THREE.Vector3; fromConn: string; local: boolean;
  }) {
    const mesh = new THREE.Mesh(this.meatGeo, this.meatMat);
    mesh.position.copy(opts.from);
    const d = opts.dir.clone().normalize();
    // 讓扁平肉塊長軸大致朝飛行方向
    mesh.quaternion.setFromUnitVectors(this._zAxis, d);
    mesh.rotateX(Math.PI * 0.5);
    this.root.add(mesh);
    this.bullets.push({
      id: opts.id,
      mesh,
      vx: d.x * BULLET_SPEED,
      vy: d.y * BULLET_SPEED,
      vz: d.z * BULLET_SPEED,
      life: BULLET_LIFE,
      fromConn: opts.fromConn,
      local: opts.local,
    });
  }

  /** 槍口火花：收斂版，一小片光暈＋1～2 顆微火星 */
  muzzleFlash(at: THREE.Vector3, dir?: THREE.Vector3) {
    const g = new THREE.Group();
    g.position.copy(at);
    if (dir && dir.lengthSq() > 1e-6) {
      this._tmp.copy(dir).normalize();
      this._q.setFromUnitVectors(new THREE.Vector3(0, 0, -1), this._tmp);
      g.quaternion.copy(this._q);
    }
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.16), this.flashMat.clone());
    glow.position.z = -0.01;
    g.add(glow);
    const core = new THREE.Mesh(
      new THREE.SphereGeometry(0.018, 5, 4),
      new THREE.MeshBasicMaterial({
        color: 0xffe8a8, transparent: true, opacity: 0.85, depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    g.add(core);
    this.root.add(g);
    this.flashes.push({ mesh: g, life: FLASH_LIFE, maxLife: FLASH_LIFE });
    const fwd = dir && dir.lengthSq() > 1e-6 ? dir.clone().normalize() : new THREE.Vector3(0, 0, -1);
    const nSpark = 1 + (Math.random() < 0.5 ? 1 : 0);
    for (let i = 0; i < nSpark; i++) {
      const m = new THREE.Mesh(this.sparkGeo, this.sparkMat.clone());
      m.scale.setScalar(0.55);
      m.position.copy(at);
      this.root.add(m);
      this.sparks.push({
        mesh: m,
        life: 0.04 + Math.random() * 0.04,
        vx: fwd.x * (1.2 + Math.random() * 1.5) + (Math.random() - 0.5) * 1.2,
        vy: fwd.y * (1 + Math.random()) + 0.6 + Math.random() * 1.2,
        vz: fwd.z * (1.2 + Math.random() * 1.5) + (Math.random() - 0.5) * 1.2,
      });
    }
  }

  ejectCasing(at: THREE.Vector3, right: THREE.Vector3) {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.08, 5), this.casingMat);
    mesh.position.copy(at);
    mesh.rotation.set(Math.random(), Math.random(), Math.random());
    this.root.add(mesh);
    (mesh as any)._vx = right.x * (2.2 + Math.random()) + (Math.random() - 0.5);
    (mesh as any)._vy = 2.5 + Math.random() * 1.5;
    (mesh as any)._vz = right.z * (2.2 + Math.random()) + (Math.random() - 0.5);
    this.casings.push({ mesh, life: CASING_LIFE, maxLife: CASING_LIFE });
  }

  /** 非人物命中：彈痕貼圖，數秒後淡出 */
  spawnMark(at: THREE.Vector3, normal: THREE.Vector3) {
    while (this.marks.length >= MARK_MAX) {
      const old = this.marks.shift();
      if (old) {
        this.root.remove(old.mesh);
        (old.mesh.material as THREE.Material).dispose();
      }
    }
    const mesh = new THREE.Mesh(this.markGeo, this.markMat.clone());
    const s = MARK_SIZE * (0.85 + Math.random() * 0.3);
    mesh.scale.setScalar(s);
    this._n.copy(normal).normalize();
    if (this._n.lengthSq() < 1e-6) this._n.set(0, 1, 0);
    mesh.quaternion.setFromUnitVectors(this._up, this._n);
    mesh.position.copy(at).addScaledVector(this._n, 0.012);
    mesh.rotateZ(Math.random() * Math.PI * 2);
    this.root.add(mesh);
    this.marks.push({ mesh, life: MARK_LIFE });
  }

  /**
   * 死鬥 hitWorld 同概念：只有地板（與可選牆面）算命中可留疤；
   * 飛空／逾時不算命中，呼叫端勿貼彈痕。
   */
  private hitEnv(
    prev: THREE.Vector3, cur: THREE.Vector3,
    obs: [number, number, number][],
  ): { at: THREE.Vector3; n: THREE.Vector3 } | null {
    // 地板（死鬥：p.y <= 0）
    if (prev.y > 0.02 && cur.y <= 0.02) {
      const t = (prev.y - 0.02) / Math.max(1e-6, prev.y - cur.y);
      this._hit.set(
        prev.x + (cur.x - prev.x) * t,
        0.02,
        prev.z + (cur.z - prev.z) * t,
      );
      return { at: this._hit.clone(), n: new THREE.Vector3(0, 1, 0) };
    }
    if (cur.y <= 0.02) {
      this._hit.set(cur.x, 0.02, cur.z);
      return { at: this._hit.clone(), n: new THREE.Vector3(0, 1, 0) };
    }
    // 牆／蚵堆等直立面（略過槍座）；貼圖只留在貼地附近，避免「打到天空」假彈痕
    for (const [ox, oz, r] of obs) {
      let skip = false;
      for (const s of MG_SEATS) {
        if (Math.hypot(ox - s.x, oz - s.z) < 0.2) { skip = true; break; }
      }
      if (skip) continue;
      const d0 = Math.hypot(prev.x - ox, prev.z - oz);
      const d1 = Math.hypot(cur.x - ox, cur.z - oz);
      if (d1 > r || d0 <= r) continue;
      if (cur.y < 0.05 || cur.y > 1.6) continue;
      const nx = (cur.x - ox) / Math.max(1e-6, d1);
      const nz = (cur.z - oz) / Math.max(1e-6, d1);
      this._hit.set(ox + nx * r, cur.y, oz + nz * r);
      return { at: this._hit.clone(), n: new THREE.Vector3(nx, 0, nz) };
    }
    return null;
  }

  /** 回傳本機子彈命中的目標（每人每幀最多一發）；obstacles = [x,z,r] */
  tick(
    dt: number,
    targets: MgHitTarget[],
    obstacles: [number, number, number][] = [],
  ): { bulletId: number; target: MgHitTarget; at: THREE.Vector3 } | null {
    let hit: { bulletId: number; target: MgHitTarget; at: THREE.Vector3 } | null = null;
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      this._tmp.copy(b.mesh.position);
      b.life -= dt;
      b.vy -= BULLET_GRAV * dt;
      b.mesh.position.x += b.vx * dt;
      b.mesh.position.y += b.vy * dt;
      b.mesh.position.z += b.vz * dt;
      // 飛行中微轉，看起來像肉塊
      b.mesh.rotateZ(dt * 8);
      const lifeOver = b.life <= 0;
      let dead = lifeOver;
      let personHit = false;
      if (!dead && b.local && !hit) {
        for (const t of targets) {
          if (t.seated || t.connId === b.fromConn) continue;
          const d = Math.hypot(
            b.mesh.position.x - t.x,
            b.mesh.position.y - t.y,
            b.mesh.position.z - t.z,
          );
          if (d <= HIT_RADIUS) {
            hit = { bulletId: b.id, target: t, at: b.mesh.position.clone() };
            dead = true;
            personHit = true;
            break;
          }
        }
      }
      // 死鬥同款：撞地／牆才留疤；飛空逾時只刪彈、不貼圖
      if (!dead && !personHit) {
        const env = this.hitEnv(this._tmp, b.mesh.position, obstacles);
        if (env) {
          const groundScar = env.n.y > 0.7 && env.at.y <= MARK_MAX_Y;
          const wallScar = env.n.y <= 0.7 && env.at.y >= 0.05 && env.at.y <= 1.6;
          if (groundScar || wallScar) this.spawnMark(env.at, env.n);
          dead = true;
        }
      }
      if (lifeOver || dead) {
        this.root.remove(b.mesh);
        this.bullets.splice(i, 1);
      }
    }
    for (let i = this.flashes.length - 1; i >= 0; i--) {
      const f = this.flashes[i];
      f.life -= dt;
      const k = Math.max(0, f.life / f.maxLife);
      f.mesh.scale.setScalar(0.9 + (1 - k) * 0.45);
      f.mesh.traverse(o => {
        const m = (o as THREE.Mesh).material as THREE.MeshBasicMaterial | undefined;
        if (m && m.opacity != null) m.opacity = k;
      });
      if (f.life <= 0) {
        f.mesh.traverse(o => {
          const mesh = o as THREE.Mesh;
          if (!mesh.isMesh) return;
          const mat = mesh.material as THREE.Material;
          if (mat && mat !== this.flashMat) mat.dispose();
          if (mesh.geometry) mesh.geometry.dispose();
        });
        this.root.remove(f.mesh);
        this.flashes.splice(i, 1);
      }
    }
    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const s = this.sparks[i];
      s.life -= dt;
      s.vy -= 28 * dt;
      s.mesh.position.x += s.vx * dt;
      s.mesh.position.y += s.vy * dt;
      s.mesh.position.z += s.vz * dt;
      const mat = s.mesh.material as THREE.MeshBasicMaterial;
      mat.opacity = Math.max(0, s.life * 8);
      if (s.life <= 0) {
        this.root.remove(s.mesh);
        mat.dispose();
        this.sparks.splice(i, 1);
      }
    }
    for (let i = this.casings.length - 1; i >= 0; i--) {
      const c = this.casings[i];
      c.life -= dt;
      const m = c.mesh as any;
      m._vy -= 18 * dt;
      c.mesh.position.x += m._vx * dt;
      c.mesh.position.y += m._vy * dt;
      c.mesh.position.z += m._vz * dt;
      c.mesh.rotation.x += dt * 10;
      if (c.mesh.position.y < 0.03) { c.mesh.position.y = 0.03; m._vy *= -0.2; }
      if (c.life <= 0) {
        this.root.remove(c.mesh);
        this.casings.splice(i, 1);
      }
    }
    for (let i = this.marks.length - 1; i >= 0; i--) {
      const mk = this.marks[i];
      mk.life -= dt;
      const mat = mk.mesh.material as THREE.MeshBasicMaterial;
      mat.opacity = mk.life > 1.2 ? 0.9 : Math.max(0, mk.life / 1.2) * 0.9;
      if (mk.life <= 0) {
        this.root.remove(mk.mesh);
        mat.dispose();
        this.marks.splice(i, 1);
      }
    }
    return hit;
  }

  clear() {
    for (const b of this.bullets) this.root.remove(b.mesh);
    this.bullets.length = 0;
    for (const f of this.flashes) {
      f.mesh.traverse(o => {
        const mesh = o as THREE.Mesh;
        if (!mesh.isMesh) return;
        const mat = mesh.material as THREE.Material;
        if (mat && mat !== this.flashMat) mat.dispose();
        if (mesh.geometry) mesh.geometry.dispose();
      });
      this.root.remove(f.mesh);
    }
    this.flashes.length = 0;
    for (const s of this.sparks) {
      this.root.remove(s.mesh);
      (s.mesh.material as THREE.Material).dispose();
    }
    this.sparks.length = 0;
    for (const c of this.casings) this.root.remove(c.mesh);
    this.casings.length = 0;
    for (const mk of this.marks) {
      this.root.remove(mk.mesh);
      (mk.mesh.material as THREE.Material).dispose();
    }
    this.marks.length = 0;
  }

  dispose() {
    this.clear();
    this.meatGeo.dispose();
    this.meatMat.dispose();
    this.flashMat.dispose();
    this.flashTex.dispose();
    this.markMat.dispose();
    this.markTex.dispose();
    this.markGeo.dispose();
    this.casingMat.dispose();
    this.sparkMat.dispose();
    this.sparkGeo.dispose();
    this.root.removeFromParent();
  }
}
