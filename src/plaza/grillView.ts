import * as THREE from 'three';
import { HALF_GEOS, shellM } from '../world/shells';
import { makeWorldLabel, type WorldLabel } from '../world/worldLabel';
import { pileCenter } from './layout';
import { GRILL_GRATE_Y } from './props';
import type { PlazaGrillOyster } from './types';

/** 可掀：只微微開縫（仍看得出上殼在），勿開到像已掀掉 */
const OPEN_READY = (18 * Math.PI) / 180;
/** 烹烤過程最大掀角＝可掀角 */
const OPEN_MAX = OPEN_READY;
const HINGE_Z = 0.055;

type GrillMesh = {
  root: THREE.Group;
  hinge: THREE.Group;
  top: THREE.Mesh;
  hint: WorldLabel;
  data: PlazaGrillOyster;
  /** performance.now 期限：用剩餘秒對齊，避開本機／伺服器時鐘偏差 */
  localOpenAt: number;
};

function hintText(state: string) {
  if (state === 'open') return '掀殼！';
  if (state === 'flipped') return '拿肉！';
  return '';
}

/**
 * 共烤網上的共享蚵仔（全場同步）；開殼鉸鏈最大 40°。
 */
export function createGrillView(parent: THREE.Object3D) {
  const root = new THREE.Group();
  root.name = 'plazaGrillOysters';
  parent.add(root);
  const byId = new Map<string, GrillMesh>();
  const botMat = shellM(0xe0dcd8);
  const topMat = shellM(0xf0ecea);
  const meatMat = new THREE.MeshStandardMaterial({ color: 0xd8cbb0, roughness: 0.35, metalness: 0.08 });
  const meatGeo = new THREE.SphereGeometry(0.04, 8, 6);

  function syncHint(g: GrillMesh) {
    const txt = hintText(g.data.state);
    if (!txt) {
      g.hint.sprite.visible = false;
      return;
    }
    g.hint.setText(txt, true);
    g.hint.sprite.visible = true;
  }

  /** 依伺服器 openAt 剩餘時間對齊本機 performance 時鐘 */
  function armLocalOpen(g: GrillMesh, o: PlazaGrillOyster, fresh: boolean) {
    if (o.state !== 'cooking') {
      g.localOpenAt = 0;
      return;
    }
    // 已在倒數就不重算（重複廣播不可讓時間跳）
    if (g.localOpenAt > 0) return;
    const dur = Math.max(0, o.openAt - o.placedAt);
    // 剛放上（即時事件）：直接用烤製時長倒數，不拿手機時鐘比伺服器時間（時鐘偏差會讓它秒開）
    // 進場同步舊蚵：才用時鐘估剩餘，但不超過烤製時長
    const remain = fresh ? dur : Math.min(dur, Math.max(0, o.openAt - Date.now()));
    g.localOpenAt = performance.now() + remain;
  }

  function upsert(o: PlazaGrillOyster, fresh = true) {
    if (o.state === 'taken') { remove(o.id); return; }
    let g = byId.get(o.id);
    if (!g) {
      const grp = new THREE.Group();
      grp.userData.grillOysterId = o.id;
      const c = pileCenter(o.pileId);
      grp.position.set(c.x + o.lx, GRILL_GRATE_Y + 0.04, c.z + o.lz);
      const gi = Math.abs(o.diff) % HALF_GEOS.length;
      const bot = new THREE.Mesh(HALF_GEOS[gi], botMat);
      bot.position.set(0, -0.01, 0);
      bot.userData.grillOysterId = o.id;
      grp.add(bot);
      const meat = new THREE.Mesh(meatGeo, meatMat);
      meat.position.set(0, 0.012, 0);
      meat.scale.set(1, 0.55, 0.85);
      meat.userData.grillOysterId = o.id;
      grp.add(meat);
      const hinge = new THREE.Group();
      hinge.position.set(0, 0.012, HINGE_Z);
      grp.add(hinge);
      const top = new THREE.Mesh(HALF_GEOS[(gi + 3) % HALF_GEOS.length], topMat);
      top.position.set(0, 0.012, -HINGE_Z);
      top.userData.grillOysterId = o.id;
      hinge.add(top);
      const hint = makeWorldLabel('', 'bubble', { worldH: 0.15, depthTest: false, bubbleTint: s => s.startsWith('掀殼') ? { fill: 'rgba(196,112,40,0.62)', line: 'rgba(255,255,255,0.7)', text: '#ffffff' } : s.startsWith('拿肉') ? { fill: 'rgba(52,138,84,0.62)', line: 'rgba(255,255,255,0.7)', text: '#ffffff' } : null });
      hint.sprite.position.set(0, 0.2, 0);
      hint.sprite.center.set(0.5, 0);
      hint.sprite.visible = false;
      hint.sprite.renderOrder = 10;
      hint.sprite.userData.grillOysterId = o.id;
      grp.add(hint.sprite);
      root.add(grp);
      g = { root: grp, hinge, top, hint, data: o, localOpenAt: 0 };
      byId.set(o.id, g);
    } else {
      // 本機樂觀已掀／已拿時，勿被遲到的 cooking／open 廣播蓋掉
      const cur = g.data.state;
      if ((cur === 'flipped' || cur === 'taken') && (o.state === 'cooking' || o.state === 'open')) {
        return;
      }
      g.data = o;
      const c = pileCenter(o.pileId);
      g.root.position.set(c.x + o.lx, GRILL_GRATE_Y + 0.04, c.z + o.lz);
    }
    armLocalOpen(g, o, fresh);
    // 進場時若已過期，立刻當 open（不必等漏掉的廣播）
    if (o.state === 'cooking' && performance.now() >= g.localOpenAt) {
      g.data = { ...o, state: 'open' };
    }
    g.top.visible = g.data.state !== 'flipped';
    syncHint(g);
    applyOpen(g, performance.now());
  }

  function applyOpen(g: GrillMesh, now: number) {
    const o = g.data;
    if (o.state === 'flipped') {
      // 已掀：上殼移走，只留下殼＋肉
      g.hinge.rotation.x = 0;
      g.top.visible = false;
      return;
    }
    if (o.state === 'open') {
      // 可掀：上殼仍在，只開一小縫（與「已掀掉」明顯不同）
      g.hinge.rotation.x = -OPEN_READY;
      g.top.visible = true;
      return;
    }
    // cooking：用 localOpenAt 剩餘比例開縫（勿拿 performance.now 減 Unix ms）
    const dur = Math.max(1, o.openAt - o.placedAt);
    const remain = Math.max(0, g.localOpenAt - now);
    const t = Math.min(1, Math.max(0, 1 - remain / dur));
    g.hinge.rotation.x = -t * OPEN_READY;
    g.top.visible = true;
  }

  function remove(id: string) {
    const g = byId.get(id);
    if (!g) return;
    g.hint.dispose();
    root.remove(g.root);
    byId.delete(id);
  }

  function syncAll(list: PlazaGrillOyster[]) {
    const keep = new Set(list.map(o => o.id));
    for (const id of [...byId.keys()]) if (!keep.has(id)) remove(id);
    for (const o of list) upsert(o, false);
  }

  function tick(now = performance.now()) {
    for (const g of byId.values()) {
      // 漏收伺服器 open 廣播時，本機到期仍升成可掀並顯示提示
      if (g.data.state === 'cooking' && g.localOpenAt > 0 && now >= g.localOpenAt) {
        g.data = { ...g.data, state: 'open' };
        syncHint(g);
      }
      applyOpen(g, now);
      // 可互動提示輕微上下晃，較好發現
      if (g.hint.sprite.visible) {
        g.hint.sprite.position.y = 0.2 + Math.sin(now * 0.006) * 0.025;
      }
    }
  }

  function hit(raycaster: THREE.Raycaster): PlazaGrillOyster | null {
    const hits = raycaster.intersectObject(root, true);
    for (const h of hits) {
      let o: THREE.Object3D | null = h.object;
      while (o) {
        const id = o.userData.grillOysterId as string | undefined;
        if (id && byId.has(id)) return byId.get(id)!.data;
        o = o.parent;
      }
    }
    return null;
  }

  /** 同堆、距離點擊螢幕最近的可互動蚵 */
  function nearestAtPile(pileId: number, cam: THREE.Camera, cx: number, cy: number, maxPx = 90): PlazaGrillOyster | null {
    const _p = new THREE.Vector3();
    let best: PlazaGrillOyster | null = null, bestD = maxPx;
    for (const g of byId.values()) {
      if (g.data.pileId !== pileId) continue;
      if (g.data.state !== 'open' && g.data.state !== 'flipped') continue;
      g.root.getWorldPosition(_p).project(cam);
      if (!(_p.z < 1) || !Number.isFinite(_p.x + _p.y)) continue;
      const d = Math.hypot((_p.x + 1) / 2 * innerWidth - cx, (1 - _p.y) / 2 * innerHeight - cy);
      if (d < bestD) { bestD = d; best = g.data; }
    }
    return best;
  }

  function get(id: string) { return byId.get(id)?.data ?? null; }
  /** 放置位置是否與同堆其他蚵仔太近（避免重疊） */
  function tooClose(pileId: number, lx: number, lz: number, minD = 0.17) { for (const g of byId.values()) { const d = g.data; if (d.pileId === pileId && Math.hypot(d.lx - lx, d.lz - lz) < minD) return true; } return false; }

  function dispose() {
    for (const id of [...byId.keys()]) remove(id);
    parent.remove(root);
  }

  return { upsert, remove, syncAll, tick, hit, nearestAtPile, get, tooClose, dispose, root };
}

export type PlazaGrillView = ReturnType<typeof createGrillView>;
