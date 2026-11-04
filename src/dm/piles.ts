import * as THREE from 'three';
import { PILES, PICK_R } from './constants';

/** 同一堆填完／離開後進入冷卻，逼換堆 */
export const PILE_COOL_SEC = 5;

export type PileRuntime = {
  pos: THREE.Vector3;
  /** 剩餘冷卻秒數；>0 不可填彈 */
  cool: number;
  /** 本輪是否已從這堆拿過殼 */
  dirty: boolean;
  ring: THREE.Mesh;
  mat: THREE.MeshBasicMaterial;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
};

export function createPileRuntimes(scene: THREE.Scene): PileRuntime[] {
  return PILES.map(pos => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 128;
    const ctx = canvas.getContext('2d')!;
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.MeshBasicMaterial({
      map: tex, transparent: true, depthWrite: false, side: THREE.DoubleSide,
    });
    const ring = new THREE.Mesh(new THREE.PlaneGeometry(1.35, 1.35), mat);
    ring.position.set(pos.x, 1.15, pos.z);
    ring.visible = false;
    ring.renderOrder = 6;
    scene.add(ring);
    return { pos, cool: 0, dirty: false, ring, mat, canvas, ctx };
  });
}

function drawCoolRing(p: PileRuntime) {
  const { ctx, canvas } = p;
  const t = Math.max(0, Math.min(1, p.cool / PILE_COOL_SEC));
  const cx = 64, cy = 64, R = 52, r = 38;
  ctx.clearRect(0, 0, 128, 128);
  // 底環
  ctx.beginPath(); ctx.arc(cx, cy, (R + r) / 2, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(20,10,0,.55)'; ctx.lineWidth = R - r; ctx.stroke();
  // 進度（剩餘冷卻）
  if (t > 0.001) {
    ctx.beginPath();
    ctx.arc(cx, cy, (R + r) / 2, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * t);
    ctx.strokeStyle = t > 0.35 ? '#ffd23f' : '#ff6a3a';
    ctx.lineWidth = R - r; ctx.lineCap = 'round'; ctx.stroke();
  }
  (p.mat.map as THREE.CanvasTexture).needsUpdate = true;
}

export function nearestPileIndex(p: THREE.Vector3, piles: PileRuntime[]): number {
  let best = 0, d0 = 1e9;
  for (let i = 0; i < piles.length; i++) {
    const d = Math.hypot(piles[i].pos.x - p.x, piles[i].pos.z - p.z);
    if (d < d0) { d0 = d; best = i; }
  }
  return best;
}

export function pileDistTo(p: THREE.Vector3, pile: PileRuntime) {
  return Math.hypot(pile.pos.x - p.x, pile.pos.z - p.z);
}

/** 這堆能不能填彈 */
export function pileCanPick(pile: PileRuntime) {
  return pile.cool <= 0;
}

export function markPileUsed(pile: PileRuntime) {
  pile.dirty = true;
}

export function startPileCool(pile: PileRuntime) {
  if (pile.cool > 0) return;
  pile.cool = PILE_COOL_SEC;
  pile.dirty = false;
  pile.ring.visible = true;
  drawCoolRing(pile);
}

/** 離開堆或匣滿時，若本輪用過就開冷卻 */
export function sealPileIfNeeded(pile: PileRuntime, stillInRange: boolean, magFull: boolean) {
  if (!pile.dirty || pile.cool > 0) return;
  if (!stillInRange || magFull) startPileCool(pile);
}

export function stepPileCools(dt: number, piles: PileRuntime[], cam: THREE.Camera) {
  for (const p of piles) {
    if (p.cool > 0) {
      p.cool = Math.max(0, p.cool - dt);
      drawCoolRing(p);
      p.ring.visible = true;
      p.ring.quaternion.copy(cam.quaternion);
      if (p.cool <= 0) p.ring.visible = false;
    } else if (!p.dirty) {
      p.ring.visible = false;
    }
  }
}

export function findPickPile(at: THREE.Vector3, piles: PileRuntime[]): PileRuntime | null {
  let best: PileRuntime | null = null, d0 = PICK_R;
  for (const p of piles) {
    const d = pileDistTo(at, p);
    if (d <= d0 && pileCanPick(p)) { d0 = d; best = p; }
  }
  return best;
}
