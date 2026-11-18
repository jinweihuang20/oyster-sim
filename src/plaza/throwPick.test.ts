import { test } from 'vitest';
import assert from 'node:assert/strict';
import { pickThrowTarget, raySegmentDist, type ThrowPickCand } from './throwPick.ts';

// 鏡頭在原點、坐著的眼高 1.0，往 -z 看
const eye = { x: 0, y: 1.0, z: 0 };
const dirTo = (p: { x: number; y: number; z: number }) => ({ x: p.x - eye.x, y: p.y - eye.y, z: p.z - eye.z });
const P = (name: string, x: number, y: number, z: number, isNpc = false): ThrowPickCand<string> => ({ item: name, head: { x, y, z }, isNpc });

test('射線與線段距離', () => {
  const r = raySegmentDist({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: -1 }, { x: 0.3, y: 1, z: -2 }, { x: 0.3, y: -1, z: -2 });
  assert.ok(Math.abs(r.dist - 0.3) < 1e-6);
  assert.ok(Math.abs(r.t - 2) < 1e-6);
});

test('瞄對面玩家身體，後面的阿婆不會被選走', () => {
  const player = P('對面', 0, 1.0, -2.0);
  const ama = P('阿婆', 0.1, 1.0, -4.5, true);
  // 瞄對面玩家胸口（頭下 25cm）：舊邏輯會因阿婆頭投影更靠近準心而選她
  const aim = dirTo({ x: 0, y: 0.75, z: -2.0 });
  assert.equal(pickThrowTarget(eye, aim, [ama, player]), '對面');
  // 瞄對面玩家頭部也一樣
  assert.equal(pickThrowTarget(eye, dirTo(player.head), [ama, player]), '對面');
});

test('對面玩家旁邊沒瞄準的阿婆不會被丟中', () => {
  const ama = P('阿婆', 0.6, 1.0, -2.2, true);
  // 準心朝正前方空位
  assert.equal(pickThrowTarget(eye, { x: 0, y: -0.05, z: -1 }, [ama]), null);
});

test('真的瞄阿婆就丟阿婆', () => {
  const player = P('對面', 0, 1.0, -2.0);
  const ama = P('阿婆', 0.8, 1.0, -2.2, true);
  assert.equal(pickThrowTarget(eye, dirTo(ama.head), [player, ama]), '阿婆');
});

test('阿婆真的擋在玩家前面時打到阿婆', () => {
  const player = P('對面', 0, 1.0, -3.0);
  const ama = P('阿婆', 0, 1.0, -1.5, true);
  assert.equal(pickThrowTarget(eye, dirTo(player.head), [player, ama]), '阿婆');
});

test('稍微偏一點仍能輔助瞄到玩家，且玩家優先於阿婆', () => {
  const player = P('對面', 0, 1.0, -2.0);
  const ama = P('阿婆', -0.62, 1.0, -2.0, true);
  // 偏右約 0.35m（超過身體半徑，但在輔助範圍內）
  assert.equal(pickThrowTarget(eye, dirTo({ x: 0.35, y: 0.9, z: -2.0 }), [ama, player]), '對面');
  // 夾在兩人中間偏阿婆一側：阿婆輔助較嚴，仍不選她
  assert.equal(pickThrowTarget(eye, dirTo({ x: -0.32, y: 0.9, z: -2.0 }), [ama, player]), '對面');
});

test('鏡頭後方的人不算', () => {
  const behind = P('背後', 0, 1.0, 2.0);
  assert.equal(pickThrowTarget(eye, { x: 0, y: 0, z: -1 }, [behind]), null);
});
