import { test } from 'vitest';
import assert from 'node:assert/strict';
import { SEA, mulberry32, makeLayout, newBoat, stepBoat, groundLim, finishHaul, strContent, shoalR, nearestStr, newRival, stepRival, bumpBoats, aimShell, shellHits } from './seaLogic.ts';

test('每趟蚵棚／淺灘／退潮時間都不一樣，但都在範圍內', () => {
  const a = makeLayout(mulberry32(1)), b = makeLayout(mulberry32(2));
  for (const L of [a, b]) {
    assert.ok(L.len >= SEA.lenMin && L.len <= SEA.lenMax);
    assert.ok(L.rows.length >= 5 && L.strs.length >= 15);
    assert.ok(L.rows.filter(r => !r.owned).length >= 2, '自己的蚵棚至少兩排');
    for (const s of L.shoals) assert.ok(Math.hypot(s.x - SEA.dock.x, s.z - SEA.dock.z) > shoalR(s, 1), '淺灘不壓碼頭');
  }
  assert.notDeepEqual(a.rows.map(r => r.az), b.rows.map(r => r.az));
});

test('越重越慢：滿載的極速比空船低', () => {
  const L = { len: 150, shoals: [], rows: [], strs: [] };
  const run = (load: number) => { const bt = newBoat(); bt.load = load; for (let i = 0; i < 200; i++) stepBoat(bt, L, 0, 1, 0, 0.05); return bt.v; };
  assert.ok(run(SEA.cap) < run(0) * 0.6);
});

test('太重開上淺灘會擱淺；丟到紅線以下就能走', () => {
  const L = { len: 150, shoals: [{ x: 0, z: -10, r0: 5 }], rows: [], strs: [] };
  const bt = newBoat(); bt.x = 0; bt.z = -10; bt.load = SEA.cap;
  assert.equal(stepBoat(bt, L, 0, 1, 0, 0.05).justGrounded, true);
  assert.ok(bt.grounded);
  bt.load = Math.floor(groundLim(0) * SEA.cap);
  stepBoat(bt, L, 0, 1, 0, 0.05);
  assert.equal(bt.grounded, false);
  // 退潮後紅線變低，同樣的載重又會卡住
  stepBoat(bt, L, 1, 1, 0, 0.05);
  assert.equal(bt.grounded, true);
});

test('重串蚵比較多、大蚵比較多；擱淺只救回一半；空手也有最少一小堆', () => {
  const r = mulberry32(7);
  let o1 = 0, o3 = 0, b1 = 0, b3 = 0;
  for (let i = 0; i < 200; i++) { const a = strContent(1, r), c = strContent(3, r); o1 += a.oy; o3 += c.oy; b1 += a.big; b3 += c.big; }
  assert.ok(o3 > o1 * 2 && b3 / o3 > b1 / o1);
  const loads = [{ w: 3, oy: 17, big: 9, owned: false }, { w: 2, oy: 11, big: 4, owned: false }];
  const ok = finishHaul(loads, { fine: 0, stolen: 0, lost: 0, stranded: false, secs: 100 });
  const bad = finishHaul(loads, { fine: 0, stolen: 0, lost: 0, stranded: true, secs: 100 });
  assert.equal(ok.oy, 28); assert.equal(bad.oy, 14); assert.ok(bad.big <= bad.oy);
  assert.equal(finishHaul([], { fine: 0, stolen: 0, lost: 0, stranded: false, secs: 5 }).oy, SEA.minPile);
});

test('船邊才拉得到蚵串', () => {
  const L = makeLayout(mulberry32(3)), bt = newBoat();
  assert.equal(nearestStr(L, bt), null);
  const s = L.strs[0]; bt.x = s.x; bt.z = s.z + 1.5;
  assert.ok(nearestStr(L, bt));
});

test('阿伯會去拉自己挑的蚵串，拉走就沒了（先搶先贏），不碰私人蚵棚', () => {
  const rng = mulberry32(11), L = makeLayout(rng), me = newBoat(), r = newRival(rng);
  let took = 0;
  for (let i = 0; i < 20 * 120; i++) { const s = stepRival(r, L, me, 150, 0.05, rng); if (s) { took++; assert.equal(s.taken, true); assert.equal(s.by, 'rival'); assert.equal(L.rows[s.row].owned, false); } }
  assert.ok(took >= 2, `兩分鐘至少拉走兩串（實際 ${took}）`);
  assert.equal(r.got, took);
});

test('快退潮時阿伯回港', () => {
  const rng = mulberry32(5), L = makeLayout(rng), me = newBoat(), r = newRival(rng);
  for (let i = 0; i < 100; i++) stepRival(r, L, me, 150, 0.05, rng);
  stepRival(r, L, me, SEA.rivalHomeAt - 1, 0.05, rng);
  assert.equal(r.mode, 'home');
});

test('兩船相撞會推開、都減速', () => {
  const a = { x: 0, z: 0, v: 6, h: 0 }, b = { x: 1, z: 2, v: 5, h: 0 };
  assert.ok(bumpBoats(a, b));
  assert.ok(a.x < 0 && b.x > 1);
  assert.ok(a.v < 6 && b.v < 5);
});

test('迫擊砲：射程外不射；預告時間在範圍內；停著不動會被打中，看到預告就開走能閃掉', () => {
  const rng = mulberry32(9);
  const me = newBoat(); me.x = 0; me.z = -40; me.v = 0;
  assert.equal(aimShell({ x: 0, z: -40 - SEA.mortarMax - 5 }, me, rng), null);
  assert.equal(aimShell({ x: 0, z: -41 }, me, rng), null);
  const L = { len: 150, shoals: [], rows: [], strs: [] };
  let hitStill = 0, hitDodge = 0;
  for (let k = 0; k < 40; k++) {
    for (const dodge of [false, true]) {
      const b = newBoat(); b.x = 0; b.z = -40; b.v = 0; b.load = SEA.cap * 0.6;
      const sh = aimShell({ x: 20, z: -40 }, b, rng)!;
      assert.ok(sh.dur >= SEA.mortarT0 && sh.dur <= SEA.mortarT0 + SEA.mortarMax * SEA.mortarTk + 1e-9);
      // 反應 0.3 秒後全速往前開（載六成重）
      for (let t = 0; t < sh.dur; t += 0.05) stepBoat(b, L, 0, dodge && t > 0.3 ? 1 : 0, 0, 0.05);
      if (shellHits(sh, b)) { if (dodge) hitDodge++; else hitStill++; }
    }
  }
  assert.ok(hitStill >= 30, `停著大多會中（${hitStill}/40）`);
  assert.ok(hitDodge <= 8, `開走大多閃得掉（${hitDodge}/40）`);
});

test('被打中會減速一段時間', () => {
  const L = { len: 150, shoals: [], rows: [], strs: [] };
  const run = (slow: boolean) => { const b = newBoat(); b.slowT = slow ? 99 : 0; for (let i = 0; i < 100; i++) stepBoat(b, L, 0, 1, 0, 0.05); return b.v; };
  assert.ok(run(true) <= run(false) * SEA.hitSlow + 1e-6);
});
