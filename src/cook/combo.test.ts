import { test } from 'vitest';
import assert from 'node:assert/strict';
import { BASE_TOTAL, COMBO_TOTAL, comboId, comboOf, comboName, specialOf, validCombo } from './combo.ts';
import { feedBaseScore } from './feedScore.ts';

test('圖鑑擴充：舊的 2,304 種編號不變，大蚵／石蚵各多 1,152 種', () => {
  assert.equal(BASE_TOTAL, 2304);
  assert.equal(COMBO_TOTAL, 4608);
  for (let i = 0; i < COMBO_TOTAL; i++) assert.equal(comboId(comboOf(i)), i);
  for (let i = 0; i < BASE_TOTAL; i++) assert.equal(comboOf(i).oy, 0);
  for (let i = BASE_TOTAL; i < COMBO_TOTAL; i++) { const c = comboOf(i); assert.ok(c.top & 1); assert.ok(c.oy === 1 || c.oy === 2); }
  assert.ok(!validCombo(COMBO_TOTAL));
});

test('沒放蚵仔時蚵種不影響編號', () => {
  const c = { top: 2, batter: 2, egg: 1, done: 1, sauce: 1 };
  assert.equal(comboId({ ...c, oy: 1 }), comboId(c));
  assert.ok(comboId({ ...c, top: 3, oy: 1 }) >= BASE_TOTAL);
});

test('大蚵版有自己的名字與隱藏款，分數和一般蚵仔版一樣', () => {
  const old = comboId({ top: 1, batter: 2, egg: 1, done: 1, sauce: 5 });
  const big = comboId({ top: 1, batter: 2, egg: 1, done: 1, sauce: 5, oy: 1 });
  assert.notEqual(comboName(old), comboName(big));
  assert.equal(specialOf(old)?.n, '阿婆的味道');
  assert.equal(specialOf(big), null);
  assert.equal(feedBaseScore(big), feedBaseScore(old));
  assert.equal(specialOf(comboId({ top: 1, batter: 2, egg: 1, done: 1, sauce: 2, oy: 1 }))?.n, '洲頂大蚵煎');
});
