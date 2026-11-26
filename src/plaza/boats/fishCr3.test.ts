import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { FISH, castRange, castDist, castPoint, DECK, deckClamp, deckStart, stepDeck, yawOf, standCam, standWantYaw } from './fishLogic';
import { SEATS } from './boatLogic';
import { ROD_LEN, ROD_GRIP, ROD_RIGID, ROD_MAX_ARC, rodBend, rodBendAngle, makeRod, makeFishLineMat } from './fishRod';
import { newFishPose, stepFishPose, applyFishPose, rodTipWorld, dropOtherRods, fishPoseCode, fishPoseDecode, fishPoseTarget, CAST_FLICK, HOOK_SET, type FishPoseIn } from './fishPose';
import { makePlayerAvatar } from '../../dm/character';
import { makeMeshHelpers } from '../../dm/mesh';
import { FISH_SPECIES, FISH_DESC, FISH_SEG, buildFishGeometry, fishModelIds } from './fishModel';

describe('路亞拋竿距離（依假魚重量）', () => {
  it('鐵板最遠、軟蟲最近；垂釣竿維持 4～16 m', () => {
    expect(castRange('oyster')).toEqual({ min: FISH.castMin, max: FISH.castMax });
    expect(castDist(1, 'jig')).toBe(26);
    expect(castDist(1, 'popper')).toBe(20);
    expect(castDist(1, 'minnow')).toBe(17);
    expect(castDist(1, 'soft')).toBe(15);
    expect(castDist(0, 'jig')).toBe(5);
    expect(castDist(1, 'jig')).toBeGreaterThan(castDist(1, 'minnow'));
    expect(castDist(1, 'minnow')).toBeGreaterThan(castDist(1, 'soft'));
    expect(castDist(1)).toBe(16);
    const p = castPoint(-40, 0, Math.PI / 2, 1, 'jig');
    expect(p.x).toBeCloseTo(-66); expect(p.z).toBeCloseTo(0);
  });
});

describe('船上站著走（甲板範圍）', () => {
  it('夾在甲板內、推出冰桶和駕駛座', () => {
    expect(deckClamp(5, 9)).toEqual({ x: DECK.x1, z: DECK.z1 });
    expect(deckClamp(-5, -9)).toEqual({ x: DECK.x0, z: DECK.z0 });
    for (const b of DECK.boxes) {
      const c = deckClamp((b.x0 + b.x1) / 2, (b.z0 + b.z1) / 2);
      expect(c.x > b.x0 && c.x < b.x1 && c.z > b.z0 && c.z < b.z1).toBe(false);
    }
    // 不配置新物件：寫進 out
    const out = { x: 0, z: 0 }; expect(deckClamp(0.1, 0.1, out)).toBe(out);
  });
  it('每個座位旁邊都站得起來（在甲板內、不在障礙裡）', () => {
    for (const s of SEATS) {
      const p = deckStart(s.x, s.z);
      expect(p.x).toBeGreaterThanOrEqual(DECK.x0); expect(p.x).toBeLessThanOrEqual(DECK.x1);
      expect(p.z).toBeGreaterThanOrEqual(DECK.z0); expect(p.z).toBeLessThanOrEqual(DECK.z1);
      for (const b of DECK.boxes) expect(p.x > b.x0 && p.x < b.x1 && p.z > b.z0 && p.z < b.z1).toBe(false);
    }
  });
  it('搖桿往前＝鏡頭前方；換算成船身座標；一直走也走不出甲板', () => {
    // 鏡頭和船頭同向（都朝 -z）：往前推＝船身 -z
    const p = { x: 0, z: 0, yaw: 0 };
    expect(stepDeck(p, 0, 1, 0, 0, 0.1)).toBe(true);
    expect(p.z).toBeCloseTo(-DECK.walkSpd * 0.1); expect(p.x).toBeCloseTo(0); expect(p.yaw).toBeCloseTo(0);
    // 船頭朝 +x 世界（h＝-π/2）、鏡頭朝 -z 世界：往前推＝世界 -z ＝ 船身的左邊（-x）
    const q = { x: 0, z: 0, yaw: 0 };
    stepDeck(q, 0, 1, 0, -Math.PI / 2, 0.1);
    expect(q.x).toBeCloseTo(-0.11); expect(q.z).toBeCloseTo(0);
    // 沒推搖桿：不動
    const r = { x: 0.2, z: 0.3, yaw: 1 };
    expect(stepDeck(r, 0.05, 0.05, 0, 0, 0.1)).toBe(false); expect(r).toEqual({ x: 0.2, z: 0.3, yaw: 1 });
    // 一直走
    const w = { x: 0, z: 0, yaw: 0 };
    for (let i = 0; i < 300; i++) stepDeck(w, 0.7, 1, 0.3, 1.1, 0.05);
    expect(w.x).toBeGreaterThanOrEqual(DECK.x0); expect(w.x).toBeLessThanOrEqual(DECK.x1);
    expect(w.z).toBeGreaterThanOrEqual(DECK.z0); expect(w.z).toBeLessThanOrEqual(DECK.z1);
  });
});

describe('釣竿模型', () => {
  it('垂釣竿比路亞竿長；握把以下不彎、越往竿尖彎越多', () => {
    expect(ROD_LEN.float).toBeGreaterThan(ROD_LEN.lure);
    expect(rodBend(ROD_GRIP.lure * 0.5, ROD_LEN.lure, 1, ROD_GRIP.lure).dz).toBeCloseTo(0);
    const mid = rodBend(1.0, ROD_LEN.lure, 0.8, ROD_GRIP.lure), tip = rodBend(ROD_LEN.lure, ROD_LEN.lure, 0.8, ROD_GRIP.lure);
    expect(tip.dz).toBeLessThan(mid.dz); expect(mid.dz).toBeLessThan(0);
    expect(rodBend(ROD_LEN.lure, ROD_LEN.lure, -0.5, ROD_GRIP.lure).dz).toBeGreaterThan(0);
  });
  it('竿尖跟著彎度移動；路亞竿有搖把，左手位置跟著轉', () => {
    for (const k of ['float', 'lure'] as const) {
      const r = makeRod(k);
      const t0 = r.tipLocal(new THREE.Vector3());
      expect(t0.y).toBeCloseTo(ROD_LEN[k]); expect(t0.z).toBeCloseTo(0);
      r.setBend(0.9);
      const t1 = r.tipLocal(new THREE.Vector3());
      expect(t1.z).toBeLessThan(-0.3); expect(t1.y).toBeLessThan(t0.y);
      // 頂點真的有彎（竿尖附近的頂點往 -z）
      const pos = (r.g.children[0] as THREE.Mesh).geometry.getAttribute('position');
      let minZ = 0; for (let i = 0; i < pos.count; i++) minZ = Math.min(minZ, pos.getZ(i));
      expect(minZ).toBeLessThan(-0.3);
      if (k === 'lure') {
        expect(r.g.children.length).toBe(2);
        const a = r.handLLocal(new THREE.Vector3()); r.setCrank(Math.PI); const b = r.handLLocal(new THREE.Vector3());
        expect(a.distanceTo(b)).toBeGreaterThan(0.1);
      } else expect(r.g.children.length).toBe(1);
      r.dispose();
    }
  });
});

describe('釣魚動作', () => {
  const inp = (o: Partial<FishPoseIn>): FishPoseIn => ({ phase: 'hold', power: 0, reel: false, tension: 0, lure: true, twitch: 0, ...o });
  it('蓄力：竿子往後（仰角越來越大）；放開：往前甩到前方', () => {
    const st = newFishPose();
    for (let i = 0; i < 60; i++) stepFishPose(st, inp({ phase: 'hold' }), 1 / 60);
    const hold = st.pitch;
    for (let i = 0; i < 90; i++) stepFishPose(st, inp({ phase: 'charge', power: i / 90 }), 1 / 60);
    expect(st.pitch).toBeGreaterThan(Math.PI / 2); expect(st.pitch).toBeGreaterThan(hold);
    stepFishPose(st, inp({ phase: 'cast' }), 1 / 60);
    expect(st.castT).toBe(0);
    for (let i = 0; i < Math.ceil(CAST_FLICK * 60) + 2; i++) stepFishPose(st, inp({ phase: 'cast' }), 1 / 60);
    expect(st.pitch).toBeLessThan(0.6);
  });
  it('甩竿竿尖會彎（彈簧），拉魚張力越大越彎、身體後仰', () => {
    const st = newFishPose();
    let maxB = 0;
    for (let i = 0; i < 30; i++) { stepFishPose(st, inp({ phase: 'cast' }), 1 / 60); maxB = Math.max(maxB, st.bend); }
    expect(maxB).toBeGreaterThan(0.2);
    for (let i = 0; i < 120; i++) stepFishPose(st, inp({ phase: 'fight', tension: 0.2 }), 1 / 60);
    const low = st.bend;
    for (let i = 0; i < 120; i++) stepFishPose(st, inp({ phase: 'fight', tension: 0.95 }), 1 / 60);
    expect(st.bend).toBeGreaterThan(low);
    expect(st.lean).toBeGreaterThan(0.15);
  });
  it('捲線：只有按住收線才轉搖把', () => {
    const st = newFishPose();
    stepFishPose(st, inp({ phase: 'wait', reel: false }), 0.1);
    expect(st.crank).toBe(0);
    stepFishPose(st, inp({ phase: 'wait', reel: true }), 0.1);
    expect(st.crank).toBeGreaterThan(1);
  });
  it('離開釣魚：回到收竿姿勢（不殘留甩竿計時）', () => {
    const st = newFishPose();
    stepFishPose(st, inp({ phase: 'cast' }), 0.05);
    for (let i = 0; i < 120; i++) stepFishPose(st, inp({ phase: 'off' }), 1 / 60);
    expect(st.castT).toBe(-1);
    expect(st.pitch).toBeCloseTo(fishPoseTarget(inp({ phase: 'off' }), -1, 0).pitch, 1);
  });
  it('同步代碼來回一致', () => {
    expect(fishPoseCode('off', false, true)).toBe(0);
    for (const ph of ['hold', 'charge', 'cast', 'wait', 'fight'] as const) for (const lure of [false, true]) {
      const d = fishPoseDecode(fishPoseCode(ph, false, lure));
      expect(d.phase).toBe(ph); expect(d.lure).toBe(lure);
    }
    expect(fishPoseDecode(fishPoseCode('wait', true, true)).reel).toBe(true);
    expect(fishPoseCode('fight', true, true)).toBeLessThan(32);
  });
});

describe('魚的 3D 模型', () => {
  it('16 種都有模型、說明（只寫外觀）', () => {
    expect(FISH_SPECIES.length).toBe(16);
    expect(fishModelIds().sort()).toEqual(FISH_SPECIES.map(s => s.id).sort());
    for (const s of FISH_SPECIES) {
      expect(FISH_DESC[s.id]?.length).toBeGreaterThan(10);
      expect(FISH_DESC[s.id]).not.toMatch(/餌|碼頭|拖釣|深海|晚上|白天|機率/);
    }
    expect(buildFishGeometry('nope')).toBeNull();
  });
  it('每條魚：長度正規化成 1、頭朝 +x、有頂點色、面數不爆', () => {
    for (const s of FISH_SPECIES) {
      const g = buildFishGeometry(s.id)!;
      g.computeBoundingBox();
      const bb = g.boundingBox!;
      expect(bb.max.x - bb.min.x).toBeCloseTo(1, 1);
      const pos = g.getAttribute('position'), col = g.getAttribute('color');
      expect(col.count).toBe(pos.count);
      expect(pos.count / 3).toBeLessThan(FISH_SEG.along * FISH_SEG.around * 2 + 900);
      let bad = 0; for (let i = 0; i < pos.array.length; i++) if (!Number.isFinite(pos.array[i])) bad++;
      expect(bad).toBe(0);
      g.dispose();
    }
  });
  it('長相差很多：白帶魚最細長、旗魚有長嘴（比身體中心更往前）', () => {
    const ratio = (id: string) => { const g = buildFishGeometry(id)!; g.computeBoundingBox(); const b = g.boundingBox!; return (b.max.y - b.min.y) / (b.max.x - b.min.x); };
    expect(ratio('tachiuo')).toBeLessThan(ratio('kisu'));
    expect(ratio('kurodai')).toBeGreaterThan(ratio('kisu') * 1.8);
    // 旗魚最前面 8% 是細細的長嘴；鮪魚最前面已經是頭（比較厚）
    const front = (id: string) => { const g = buildFishGeometry(id)!; g.computeBoundingBox(); const mx = g.boundingBox!.max.x; const p = g.getAttribute('position'); let lo = 9, hi = -9; for (let i = 0; i < p.count; i++) if (p.getX(i) > mx - 0.08) { lo = Math.min(lo, p.getY(i)); hi = Math.max(hi, p.getY(i)); } return hi - lo; };
    expect(front('kajiki')).toBeLessThan(0.03);
    expect(front('maguro')).toBeGreaterThan(front('kajiki') * 2);
  });
});

describe('中魚拉竿：竿子明顯彎、動作大', () => {
  const inp = (o: Partial<FishPoseIn>): FishPoseIn => ({ phase: 'hold', power: 0, reel: false, tension: 0, lure: false, twitch: 0, ...o });
  it('竿子沿弧線彎（竿長不變）；拉滿時竿尖往下指', () => {
    for (const k of ['float', 'lure'] as const) {
      const L = ROD_LEN[k], g = ROD_RIGID[k];
      // 中心線長度≈竿長
      let len = 0, py = g, pz = 0;
      for (let i = 1; i <= 60; i++) { const y = g + ((L - g) * i) / 60, d = rodBend(y, L, 0.9, g); const ny = y + d.dy, nz = d.dz; len += Math.hypot(ny - py, nz - pz); py = ny; pz = nz; }
      expect(len).toBeCloseTo(L - g, 1);
      expect(rodBendAngle(L, L, 1, g)).toBeCloseTo(ROD_MAX_ARC[k]);
      expect(rodBendAngle(L, L, 1, g)).toBeGreaterThan(Math.PI * 0.45);
      // 彎很多：竿尖往旁邊偏超過會彎那段的 3 成
      expect(-rodBend(L, L, 0.9, g).dz).toBeGreaterThan((L - g) * 0.3);
      // 模型竿尖跟中心線一致（線掛在彎下去的竿尖上）
      const r = makeRod(k); r.setBend(0.9);
      const tip = r.tipLocal(new THREE.Vector3()), d = rodBend(L, L, 0.9, g);
      expect(tip.y).toBeCloseTo(L + d.dy, 1); expect(tip.z).toBeCloseTo(d.dz, 1);
      // 頂點：最高點跟著竿尖下來
      const pos = (r.g.children[0] as THREE.Mesh).geometry.getAttribute('position');
      let maxY = 0; for (let i = 0; i < pos.count; i++) maxY = Math.max(maxY, pos.getY(i));
      expect(maxY).toBeLessThan(L - 0.15);
      r.dispose();
    }
  });
  it('拉魚：竿彎跟張力走，加上魚掙扎的抖動；身體大幅後仰、手舉高、腳站穩', () => {
    const st = newFishPose();
    for (let i = 0; i < 30; i++) stepFishPose(st, inp({ phase: 'wait' }), 1 / 60);
    for (let i = 0; i < 180; i++) stepFishPose(st, inp({ phase: 'fight', tension: 0.15 }), 1 / 60);
    let lo = 0; for (let i = 0; i < 120; i++) { stepFishPose(st, inp({ phase: 'fight', tension: 0.15 }), 1 / 60); lo += st.bend / 120; }
    let hi = 0, minL = 9, maxL = -9, minB = 9, maxB = -9;
    for (let i = 0; i < 180; i++) stepFishPose(st, inp({ phase: 'fight', tension: 1 }), 1 / 60);
    for (let i = 0; i < 240; i++) {
      stepFishPose(st, inp({ phase: 'fight', tension: 1 }), 1 / 60); hi += st.bend / 240;
      minL = Math.min(minL, st.lean); maxL = Math.max(maxL, st.lean); minB = Math.min(minB, st.bend); maxB = Math.max(maxB, st.bend);
    }
    expect(lo).toBeGreaterThan(0.45); expect(hi).toBeGreaterThan(0.85); expect(hi).toBeGreaterThan(lo + 0.3);
    expect(maxB - minB).toBeGreaterThan(0.04);
    // 一拉一放（pump）：後仰角度有起伏、平均後仰很大
    expect(maxL).toBeGreaterThan(0.5); expect(maxL - minL).toBeGreaterThan(0.08); expect(minL).toBeGreaterThan(0.3);
    expect(st.hy).toBeGreaterThan(0.15);
    expect(st.brace).toBeGreaterThan(0.95);
    // 放下：站姿慢慢還原
    for (let i = 0; i < 120; i++) stepFishPose(st, inp({ phase: 'hold' }), 1 / 60);
    expect(st.brace).toBe(0);
  });
  it('中魚那一下：往上猛拉揚竿（竿子立更高、身體更後仰、竿彎一下子變大）', () => {
    const steady = newFishPose();
    for (let i = 0; i < 60; i++) stepFishPose(steady, inp({ phase: 'wait' }), 1 / 60);
    const st = newFishPose();
    for (let i = 0; i < 60; i++) stepFishPose(st, inp({ phase: 'wait' }), 1 / 60);
    let peakP = 0, peakL = 0, peakB = 0;
    stepFishPose(st, inp({ phase: 'fight', tension: 0.4 }), 1 / 60);
    expect(st.hookT).toBeGreaterThanOrEqual(0);
    for (let i = 0; i < Math.ceil(HOOK_SET * 60); i++) { stepFishPose(st, inp({ phase: 'fight', tension: 0.4 }), 1 / 60); peakP = Math.max(peakP, st.pitch); peakL = Math.max(peakL, st.lean); peakB = Math.max(peakB, st.bend); }
    expect(st.hookT).toBe(-1);
    const later = { p: 0, l: 0 };
    for (let i = 0; i < 240; i++) { stepFishPose(st, inp({ phase: 'fight', tension: 0.4 }), 1 / 60); later.p = Math.max(later.p, st.pitch); later.l = Math.max(later.l, st.lean); }
    expect(peakP).toBeGreaterThan(later.p + 0.1);
    expect(peakL).toBeGreaterThan(later.l);
    expect(peakB).toBeGreaterThan(0.8);
    // 一開始就是拉魚（例如別人進來看到的時候）不揚竿
    const fresh = newFishPose(); stepFishPose(fresh, inp({ phase: 'fight' }), 1 / 60); expect(fresh.hookT).toBe(-1);
  });
  it('每幀不配置：目標共用同一個物件；釣魚線是半透明細線', () => {
    expect(fishPoseTarget(inp({ phase: 'fight' }), -1, 0)).toBe(fishPoseTarget(inp({ phase: 'wait' }), -1, 0));
    const m = makeFishLineMat();
    expect(m.transparent).toBe(true); expect(m.opacity).toBeLessThan(0.7); expect(m.opacity).toBeGreaterThan(0.3);
    m.dispose();
  });
});

describe('竿子彎的是上半段，握把完全不彎', () => {
  it('硬段（握把、線輪／捲線座、前手）佔竿長 25～30%，而且包住兩隻手握的地方', () => {
    for (const k of ['float', 'lure'] as const) {
      const f = ROD_RIGID[k] / ROD_LEN[k];
      expect(f).toBeGreaterThanOrEqual(0.25); expect(f).toBeLessThanOrEqual(0.3);
      expect(ROD_RIGID[k]).toBeGreaterThan(ROD_GRIP[k]);
    }
    // 垂釣竿前手（握把上方 0.38 m）也在硬段裡
    expect(ROD_GRIP.float + 0.38).toBeLessThan(ROD_RIGID.float);
  });
  it('bend＝1：硬段頂點一個都沒動，上半段大幅彎下去', () => {
    for (const k of ['float', 'lure'] as const) {
      const L = ROD_LEN[k], g = ROD_RIGID[k];
      const r = makeRod(k);
      const pos = (r.g.children[0] as THREE.Mesh).geometry.getAttribute('position');
      const base = Float32Array.from(pos.array as Float32Array);
      r.setBend(1);
      let moved = 0, rigidN = 0, flexMoved = 0;
      for (let i = 0; i < pos.count; i++) {
        const y0 = base[i * 3 + 1];
        const d = Math.hypot(pos.getX(i) - base[i * 3], pos.getY(i) - y0, pos.getZ(i) - base[i * 3 + 2]);
        if (y0 <= g) { rigidN++; if (d > 1e-6) moved++; }
        else if (y0 > g + (L - g) * 0.6 && d > 0.1) flexMoved++;
      }
      expect(rigidN).toBeGreaterThan(50);
      expect(moved).toBe(0);
      expect(flexMoved).toBeGreaterThan(10);
      // 中心線：硬段結束那點切線角 0、半途還很小、竿尖接近最大彎角（越往竿尖越彎）
      expect(rodBendAngle(g + 0.001, L, 1)).toBeLessThan(0.01);
      expect(rodBendAngle(g + (L - g) * 0.5, L, 1)).toBeLessThan(ROD_MAX_ARC[k] * 0.2);
      expect(rodBendAngle(L, L, 1)).toBeGreaterThan(1.4);
      expect(-rodBend(g + (L - g) * 0.5, L, 1).dz).toBeLessThan(-rodBend(L, L, 1).dz * 0.15);
      // 竿尖在模型上＝中心線算出來的位置（線從這裡出去）
      const tip = r.tipLocal(new THREE.Vector3()), d = rodBend(L, L, 1);
      expect(tip.y).toBeCloseTo(L + d.dy, 2); expect(tip.z).toBeCloseTo(d.dz, 2);
      r.dispose();
    }
  });
  it('會彎的那段切了很多圈（彎起來是平滑弧線，不會在幾個點折一段一段）', () => {
    for (const k of ['float', 'lure'] as const) {
      const L = ROD_LEN[k], g = ROD_RIGID[k];
      const r = makeRod(k);
      const pos = (r.g.children[0] as THREE.Mesh).geometry.getAttribute('position');
      const ys = new Set<number>(); for (let i = 0; i < pos.count; i++) { const y = pos.getY(i); if (y > g) ys.add(Math.round(y * 100)); }
      expect(ys.size).toBeGreaterThan(((L - g) / 0.07) * 0.9);
      r.dispose();
    }
  });
});

describe('拿竿：竿往魚那邊彎、一個人只有一支竿、線從竿尖出去', () => {
  const mk = () => { const { M, add } = makeMeshHelpers(new THREE.Scene(), true); return makePlayerAvatar({ shirt: 0x3a7ab8, hair: 0x222222, pants: 0x2a2a40 }, M, add, false) as any; };
  const inp = (o: Partial<FishPoseIn>): FishPoseIn => ({ phase: 'fight', power: 0, reel: true, tension: 0.9, lure: false, twitch: 0, ...o });
  it('揚竿把竿舉過頭也是往前（魚那邊）彎，不會反彎到人背後', () => {
    for (const lure of [false, true]) {
      const rig = mk(); const scene = new THREE.Scene(); scene.add(rig.outer);
      rig.outer.rotation.y = 0; // 面向 -z
      const st = newFishPose(); const rod = makeRod(lure ? 'lure' : 'float');
      for (const pitch of [0.6, 1.2, 1.7]) {
        st.pitch = pitch; st.bend = 0.9;
        applyFishPose(rig, st, rod, inp({ lure }));
        scene.updateMatrixWorld(true);
        // 竿子硬段頂端（彎的起點）和竿尖：竿尖要在起點前面（-z）
        const top = new THREE.Vector3(0, ROD_RIGID[rod.kind], 0).applyMatrix4(rod.g.matrixWorld);
        const straight = new THREE.Vector3(0, ROD_LEN[rod.kind], 0).applyMatrix4(rod.g.matrixWorld);
        const tip = rodTipWorld(rod, new THREE.Vector3());
        expect(tip.z).toBeLessThan(straight.z + 1e-3);
        expect(tip.z).toBeLessThan(top.z + 0.05);
      }
      rod.dispose();
    }
  });
  it('換竿種／別的竿留在身上：套姿勢時只留現在這支', () => {
    const rig = mk();
    const old = makeRod('float'), cur = makeRod('lure');
    rig.torso.add(old.g);
    const st = newFishPose(); st.pitch = 0.8;
    applyFishPose(rig, st, cur, inp({ lure: true }));
    const rods = rig.torso.children.filter((o: THREE.Object3D) => o.name === 'fishRod');
    expect(rods.length).toBe(1); expect(rods[0]).toBe(cur.g);
    rig.torso.add(old.g); dropOtherRods(rig.torso, null);
    expect(rig.torso.children.some((o: THREE.Object3D) => o.name === 'fishRod')).toBe(false);
  });
  it('竿尖世界座標＝畫出來的竿尖（不管人在哪、轉向、彎多少）', () => {
    const rig = mk(); const boat = new THREE.Group(); const scene = new THREE.Scene(); scene.add(boat); boat.add(rig.outer);
    const st = newFishPose(); const rod = makeRod('float');
    for (const [bx, bh, ry, b] of [[0, 0, 0, 0], [12, 1.1, 2.4, 0.5], [-30, -2, -1, 1]]) {
      boat.position.set(bx, 0.3, 4); boat.rotation.set(0.02, bh, -0.03); rig.outer.position.set(0.4, 0.2, -0.6); rig.outer.rotation.set(0, ry, 0);
      st.pitch = 1.1; st.bend = b;
      applyFishPose(rig, st, rod, inp({}));
      const tip = rodTipWorld(rod, new THREE.Vector3());
      // 跟真的頂點比：最靠竿尖的頂點（世界）離 tip 不到 3 cm
      scene.updateMatrixWorld(true);
      const pos = (rod.g.children[0] as THREE.Mesh).geometry.getAttribute('position'), m = (rod.g.children[0] as THREE.Mesh).matrixWorld;
      let best = 9; const v = new THREE.Vector3();
      for (let i = 0; i < pos.count; i++) { v.fromBufferAttribute(pos, i).applyMatrix4(m); best = Math.min(best, v.distanceTo(tip)); }
      expect(best).toBeLessThan(0.03);
    }
    rod.dispose();
  });
});

describe('船上站著釣魚：鏡頭跟人、往面向的方向拋（不是船頭）', () => {
  const boatH = 0.7, ox = -60, oz = 20;
  const dirs = { 船頭: boatH, 船尾: boatH + Math.PI, 左舷: boatH + Math.PI / 2, 右舷: boatH - Math.PI / 2 } as const;
  const ang = (a: number, b: number) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
  for (const [nm, yaw] of Object.entries(dirs)) {
    it(`面向${nm}：鏡頭在人身後看同一邊，拋竿方向＝面向`, () => {
      const pos = { x: 0, y: 0, z: 0 }, look = { x: 0, y: 0, z: 0 };
      standCam(ox, 0.5, oz, yaw, pos, look);
      const camYaw = yawOf(look.x - pos.x, look.z - pos.z);
      expect(ang(camYaw, yaw)).toBeLessThan(1e-6);
      // 鏡頭在人身後（不是船尾固定位置）
      expect(ang(yawOf(ox - pos.x, oz - pos.z), yaw)).toBeLessThan(1e-6);
      // 站著不動：人轉去面向鏡頭方向（船身座標＝世界－船頭）
      expect(ang(standWantYaw(null, false, 0, camYaw, boatH) + boatH, yaw)).toBeLessThan(1e-6);
      // 蓄力／線在水裡：照拋竿方向
      expect(ang(standWantYaw(camYaw, true, 1.2, 0, boatH) + boatH, yaw)).toBeLessThan(1e-6);
      // 落點在面向那邊，不在船頭
      const cp = castPoint(ox, oz, camYaw, 0.6, 'worm');
      expect(ang(yawOf(cp.x - ox, cp.z - oz), yaw)).toBeLessThan(1e-4);
      if (nm !== '船頭') expect(ang(yawOf(cp.x - ox, cp.z - oz), boatH)).toBeGreaterThan(1);
    });
  }
});

describe('拋竿動作：自己看和別人看完全一樣', () => {
  it('蓄力條（來回擺盪）＋往前甩＋竿彎：用開始蓄力後的時間重算，每一幀都跟自己畫面相同', async () => {
    const { FishSM, chargePower } = await import('./fishLogic');
    const sm = new FishSM(); sm.phase = 'idle'; sm.gear = 'float'; sm.item = 'worm';
    const me = newFishPose(), other = newFishPose();
    const inpA: FishPoseIn = { phase: 'hold', power: 0, reel: false, tension: 0, lure: false, twitch: 0 };
    const inpB: FishPoseIn = { ...inpA };
    const dt = 1 / 60;
    for (let i = 0; i < 20; i++) { stepFishPose(me, inpA, dt); stepFishPose(other, inpB, dt); }
    sm.startCharge(); let el = 0;
    for (let i = 0; i < 80; i++) { // 蓄力 1.33 秒（超過半個週期，蓄力條已經往回掉）
      sm.tick(dt, { reel: false, jerk: false, dir: 0 }); el += dt;
      inpA.phase = 'charge'; inpA.power = sm.power;
      inpB.phase = 'charge'; inpB.power = chargePower(el);
      stepFishPose(me, inpA, dt); stepFishPose(other, inpB, dt);
      expect(other.pitch).toBeCloseTo(me.pitch, 6); expect(other.bend).toBeCloseTo(me.bend, 6);
    }
    sm.release();
    let maxDiff = 0, peakBend = 0;
    for (let i = 0; i < 50; i++) {
      inpA.phase = inpB.phase = 'cast';
      stepFishPose(me, inpA, dt); stepFishPose(other, inpB, dt);
      maxDiff = Math.max(maxDiff, Math.abs(me.pitch - other.pitch), Math.abs(me.bend - other.bend), Math.abs(me.hy - other.hy), Math.abs(me.lean - other.lean));
      peakBend = Math.max(peakBend, me.bend);
    }
    expect(maxDiff).toBeLessThan(1e-9);
    expect(peakBend).toBeGreaterThan(0.2);
  });
  it('線頭飛出去：同一條拋物線，從竿尖出發、flyS 後落在落點', async () => {
    const { castFlyPoint } = await import('./fishLogic');
    const o = { x: 0, y: 0, z: 0 };
    castFlyPoint(1, 3, 2, 11, 0.04, -6, 0, o); expect(o).toEqual({ x: 1, y: 3, z: 2 });
    castFlyPoint(1, 3, 2, 11, 0.04, -6, 1, o); expect(o.x).toBeCloseTo(11); expect(o.y).toBeCloseTo(0.04); expect(o.z).toBeCloseTo(-6);
    castFlyPoint(1, 3, 2, 11, 0.04, -6, 0.5, o); expect(o.y).toBeGreaterThan(3);
    castFlyPoint(1, 3, 2, 11, 0.04, -6, 2, o); expect(o.x).toBeCloseTo(11);
  });
});
