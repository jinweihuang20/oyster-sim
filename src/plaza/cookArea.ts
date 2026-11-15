/** 廣場烹煮區 3D：兩條煎台、10 個站位圓圈、鍋上正在煎的那盤、展示盤與名牌。 */
import * as THREE from 'three';
import { COOK_GRIDDLE, COOK_RING_R, COOK_SEATS, cookSeatPos, cookPanPos, cookPlatePos } from './layout';
import { buildDish, buildPlate, disposeDish } from '../cook/dish3d';
import { comboName } from '../cook/combo';
import type { PlazaCookState } from './types';

const ACCENT = 0x2a5a86;
const DISH_SCALE = 0.115;

/**
 * 名牌：高解析畫布（2–3× 裝置像素比）、不透明底、粗字深色；關掉 mipmap 用 LinearFilter，避免遠看糊成一片。
 * 第一行深色（料理名／玩家名），第二行 #2a5a86。
 */
function tagSprite(lines: string[]) {
  const S = Math.min(3, Math.max(2, Math.ceil(window.devicePixelRatio || 1)));
  const W = 512, H = lines.length > 1 ? 150 : 90;
  const cv = document.createElement('canvas'); cv.width = W * S; cv.height = H * S;
  const c = cv.getContext('2d')!;
  c.scale(S, S);
  c.fillStyle = '#ffffff'; c.strokeStyle = '#2a5a86'; c.lineWidth = 3;
  c.beginPath(); c.roundRect(3, 3, W - 6, H - 6, 20); c.fill(); c.stroke();
  c.textAlign = 'center'; c.textBaseline = 'middle';
  const font = '"Noto Sans TC", "PingFang TC", "Microsoft JhengHei", system-ui, sans-serif';
  c.fillStyle = '#1f2d3a'; c.font = `800 44px ${font}`;
  c.fillText(lines[0], W / 2, lines.length > 1 ? 52 : H / 2 + 1, W - 36);
  if (lines[1]) { c.fillStyle = '#2a5a86'; c.font = `700 34px ${font}`; c.fillText(lines[1], W / 2, 109, W - 36); }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.generateMipmaps = false;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthWrite: false, transparent: true, alphaTest: 0.5, fog: false, toneMapped: false }));
  const k = 0.0016; sp.scale.set(W * k, H * k, 1);
  sp.renderOrder = 5;
  return sp;
}
function disposeSprite(sp: THREE.Sprite) { sp.material.map?.dispose(); sp.material.dispose(); }

export function makeCookArea() {
  const root = new THREE.Group(); root.name = 'cookArea';
  const steel = new THREE.MeshStandardMaterial({ color: 0xa4acb4, roughness: 0.45, metalness: 0.35 });
  const plateTop = new THREE.MeshStandardMaterial({ color: 0x33373b, roughness: 0.55, metalness: 0.4 });
  const knobM = new THREE.MeshStandardMaterial({ color: 0x1f2a35, roughness: 0.6 });
  const L = COOK_GRIDDLE.x1 - COOK_GRIDDLE.x0, cx = (COOK_GRIDDLE.x0 + COOK_GRIDDLE.x1) / 2, h = COOK_GRIDDLE.h;
  for (const [zc, front] of [[COOK_GRIDDLE.zA, 1], [COOK_GRIDDLE.zB, -1]] as const) {
    const body = new THREE.Mesh(new THREE.BoxGeometry(L, h - 0.05, COOK_GRIDDLE.depth), steel);
    body.position.set(cx, (h - 0.05) / 2, zc); root.add(body);
    const top = new THREE.Mesh(new THREE.BoxGeometry(L - 0.06, 0.05, COOK_GRIDDLE.depth - 0.08), plateTop);
    top.position.set(cx, h - 0.025, zc); root.add(top);
    // 前緣擋油條＋旋鈕
    const lip = new THREE.Mesh(new THREE.BoxGeometry(L, 0.06, 0.03), steel);
    lip.position.set(cx, h + 0.01, zc + front * (COOK_GRIDDLE.depth / 2 - 0.015)); root.add(lip);
    for (let i = 0; i < 5; i++) {
      const p = cookSeatPos(front > 0 ? i : 5 + i);
      const k = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.03, 10), knobM);
      k.rotation.x = Math.PI / 2; k.position.set(p.x, h - 0.2, zc + front * (COOK_GRIDDLE.depth / 2 + 0.01)); root.add(k);
    }
  }
  // 站位圓圈
  const rings: { g: THREE.Group; ring: THREE.MeshBasicMaterial; fill: THREE.MeshBasicMaterial }[] = [];
  const ringGeo = new THREE.RingGeometry(COOK_RING_R - 0.05, COOK_RING_R, 40);
  const fillGeo = new THREE.CircleGeometry(COOK_RING_R - 0.05, 32);
  for (let s = 0; s < COOK_SEATS; s++) {
    const p = cookSeatPos(s);
    const g = new THREE.Group(); g.name = 'shedRing'; g.position.set(p.x, 0.014, p.z);
    const ring = new THREE.MeshBasicMaterial({ color: ACCENT, transparent: true, opacity: 0.85, depthWrite: false });
    const fill = new THREE.MeshBasicMaterial({ color: ACCENT, transparent: true, opacity: 0.12, depthWrite: false });
    const a = new THREE.Mesh(ringGeo, ring); a.rotation.x = -Math.PI / 2; g.add(a);
    const b = new THREE.Mesh(fillGeo, fill); b.rotation.x = -Math.PI / 2; b.position.y = -0.002; g.add(b);
    g.renderOrder = 2; root.add(g);
    rings.push({ g, ring, fill });
  }

  const pans = new Map<number, { combo: number; g: THREE.Group }>();
  const plates = new Map<string, { combo: number; nick: string; g: THREE.Group; tag: THREE.Sprite }>();
  const occTags = new Map<number, { nick: string; sp: THREE.Sprite }>();
  let active: number | null = null;
  const occupied = new Set<number>();

  function setPan(seat: number, combo: number) {
    const cur = pans.get(seat);
    if (cur && cur.combo === combo) return;
    if (cur) { root.remove(cur.g); disposeDish(cur.g); pans.delete(seat); }
    if (combo < 0) return;
    const g = new THREE.Group(); const d = buildDish(combo); d.scale.setScalar(DISH_SCALE); g.add(d);
    const p = cookPanPos(seat); g.position.set(p.x, p.y, p.z); g.rotation.y = seat * 1.3;
    root.add(g); pans.set(seat, { combo, g });
  }

  function setState(st: PlazaCookState | null, myConn: string) {
    occupied.clear();
    const seen = new Set<number>();
    for (const s of st?.seats ?? []) {
      occupied.add(s.seat); seen.add(s.seat);
      if (s.connId !== myConn) setPan(s.seat, s.stage >= 1 ? s.combo : -1);
      const t = occTags.get(s.seat);
      if (!t || t.nick !== s.nick) {
        if (t) { root.remove(t.sp); disposeSprite(t.sp); }
        const sp = tagSprite([s.nick || '玩家', '正在煎']);
        const p = cookSeatPos(s.seat); sp.position.set(p.x, 2.15, p.z);
        root.add(sp); occTags.set(s.seat, { nick: s.nick, sp });
      }
    }
    for (const [seat, t] of occTags) if (!seen.has(seat)) { root.remove(t.sp); disposeSprite(t.sp); occTags.delete(seat); }
    for (const seat of [...pans.keys()]) if (!seen.has(seat)) setPan(seat, -1);
    const want = new Set<string>();
    for (const d of st?.displays ?? []) {
      const k = `${d.seat}:${d.slot}`; want.add(k);
      const cur = plates.get(k);
      if (cur && cur.combo === d.combo && cur.nick === d.nick) continue;
      if (cur) { root.remove(cur.g); disposeDish(cur.g); disposeSprite(cur.tag); }
      const g = new THREE.Group();
      const holder = new THREE.Group(); holder.scale.setScalar(DISH_SCALE * 1.05);
      holder.add(buildPlate()); const dish = buildDish(d.combo); dish.position.y = 0.04; holder.add(dish); g.add(holder);
      const tag = tagSprite([comboName(d.combo), d.nick || '玩家']); tag.position.set(0, 0.42, 0); g.add(tag);
      const p = cookPlatePos(d.seat, d.slot); g.position.set(p.x, p.y + 0.01, p.z);
      g.userData.cook = { combo: d.combo, nick: d.nick };
      root.add(g); plates.set(k, { combo: d.combo, nick: d.nick, g, tag });
    }
    for (const [k, v] of plates) if (!want.has(k)) { root.remove(v.g); disposeDish(v.g); disposeSprite(v.tag); plates.delete(k); }
    paintRings();
  }

  function paintRings() {
    for (let s = 0; s < COOK_SEATS; s++) {
      const r = rings[s], occ = occupied.has(s), on = active === s;
      r.ring.color.setHex(occ && !on ? 0x8a96a3 : ACCENT);
      r.ring.opacity = on ? 1 : occ ? 0.5 : 0.85;
      r.fill.opacity = on ? 0.22 : 0.12;
      if (!on) r.g.scale.setScalar(1);
    }
  }

  return {
    group: root,
    setState,
    /** 自己鍋上的那盤（本機即時，不等伺服器） */
    setMyPan: (seat: number | null, combo: number) => { for (const s of [...pans.keys()]) if (s === seat) setPan(s, combo); if (seat != null) setPan(seat, combo); },
    clearPan: (seat: number) => setPan(seat, -1),
    setActive: (seat: number | null) => { if (active === seat) return; active = seat; paintRings(); },
    tick: (t: number) => { if (active != null) rings[active].g.scale.setScalar(1 + Math.sin(t * 4) * 0.03); },
    dispose: () => {
      for (const v of pans.values()) disposeDish(v.g);
      for (const v of plates.values()) { disposeDish(v.g); disposeSprite(v.tag); }
      for (const v of occTags.values()) disposeSprite(v.sp);
      root.parent?.remove(root);
    },
  };
}
export type CookArea = ReturnType<typeof makeCookArea>;
