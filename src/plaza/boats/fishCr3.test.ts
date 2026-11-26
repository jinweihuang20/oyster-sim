import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { FISH, castRange, castDist, castPoint, DECK, deckClamp, deckStart, stepDeck } from './fishLogic';
import { SEATS } from './boatLogic';
import { ROD_LEN, ROD_GRIP, ROD_MAX_ARC, rodBend, rodBendAngle, makeRod, makeFishLineMat } from './fishRod';
import { newFishPose, stepFishPose, fishPoseCode, fishPoseDecode, fishPoseTarget, CAST_FLICK, HOOK_SET, type FishPoseIn } from './fishPose';
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
      const L = ROD_LEN[k], g = ROD_GRIP[k];
      // 中心線長度≈竿長
      let len = 0, py = g, pz = 0;
      for (let i = 1; i <= 60; i++) { const y = g + ((L - g) * i) / 60, d = rodBend(y, L, 0.9, g); const ny = y + d.dy, nz = d.dz; len += Math.hypot(ny - py, nz - pz); py = ny; pz = nz; }
      expect(len).toBeCloseTo(L - g, 1);
      expect(rodBendAngle(L, L, 1, g)).toBeCloseTo(ROD_MAX_ARC[k]);
      expect(rodBendAngle(L, L, 1, g)).toBeGreaterThan(Math.PI * 0.45);
      // 彎很多：竿尖往旁邊偏超過竿長的 4 成
      expect(-rodBend(L, L, 0.9, g).dz).toBeGreaterThan((L - g) * 0.4);
      // 模型竿尖跟中心線一致（線掛在彎下去的竿尖上）
      const r = makeRod(k); r.setBend(0.9);
      const tip = r.tipLocal(new THREE.Vector3()), d = rodBend(L, L, 0.9, g);
      expect(tip.y).toBeCloseTo(L + d.dy, 1); expect(tip.z).toBeCloseTo(d.dz, 1);
      // 頂點：最高點跟著竿尖下來
      const pos = (r.g.children[0] as THREE.Mesh).geometry.getAttribute('position');
      let maxY = 0; for (let i = 0; i < pos.count; i++) maxY = Math.max(maxY, pos.getY(i));
      expect(maxY).toBeLessThan(L - 0.2);
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
