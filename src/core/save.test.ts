import { test, describe } from 'vitest';
import assert from 'node:assert/strict';
import { COMBO_TOTAL, comboHasFood } from '../cook/combo.ts';
import { defaultSave, loadSave, writeSave, dayNum, dayNumToTs, packCookDex, packCookDish, type SaveStorage } from './save.ts';

function mem(init: Record<string, string> = {}): SaveStorage & { raw: Record<string, string> } {
  const raw = { ...init };
  return {
    raw,
    getItem: (k: string) => (k in raw ? raw[k] : null),
    setItem: (k: string, v: string) => { raw[k] = v; },
  };
}

const fmtDate = (t: number) => {
  const d = new Date(t);
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
};

describe('cookDex / cookDish 壓縮存檔', () => {
  test('舊物件格式載入後改寫成陣列，再載入日期與盤數不變', () => {
    const ts = new Date(2025, 2, 15, 23, 45, 0).getTime();
    const ls = mem({
      'oyster-sim': JSON.stringify({
        v: 3,
        cookDex: { '7': ts, '100': ts },
        cookDish: { '7': 3, '100': 12 },
      }),
    });
    const first = loadSave(ls);
    assert.equal(fmtDate(first.cookDex!['7']), '2025/3/15');
    assert.equal(fmtDate(first.cookDex!['100']), '2025/3/15');
    assert.equal(first.cookDish!['7'], 3);
    assert.equal(first.cookDish!['100'], 12);

    writeSave(ls, first);
    const stored = JSON.parse(ls.raw['oyster-sim']);
    assert.ok(Array.isArray(stored.cookDex), 'cookDex 應寫成陣列');
    assert.ok(Array.isArray(stored.cookDish), 'cookDish 應寫成陣列');
    assert.deepEqual(stored.cookDex, [7, 20250315, 100, 20250315]);
    assert.deepEqual(stored.cookDish, [7, 3, 100, 12]);

    const second = loadSave(ls);
    assert.equal(fmtDate(second.cookDex!['7']), '2025/3/15');
    assert.equal(fmtDate(second.cookDex!['100']), '2025/3/15');
    assert.equal(second.cookDish!['7'], 3);
    assert.equal(second.cookDish!['100'], 12);
  });

  test('dayNum 與 fmtDate 使用同一套本機日曆', () => {
    const ts = new Date(2024, 11, 1, 0, 5, 0).getTime();
    const n = dayNum(ts);
    assert.equal(n, 20241201);
    assert.equal(fmtDate(dayNumToTs(n)), '2024/12/1');
  });

  test('4,608 種全滿壓縮後遠低於 200 KB 與 512 KB', () => {
    const ts = new Date(2026, 0, 2, 18, 0, 0).getTime();
    const save = defaultSave();
    save.cookDex = {};
    save.cookDish = {};
    for (let i = 0; i < COMBO_TOTAL; i++) {
      save.cookDex[String(i)] = ts;
      if (comboHasFood(i)) save.cookDish[String(i)] = 12;
    }
    const legacyDex = JSON.stringify(save.cookDex);
    const legacyDish = JSON.stringify(save.cookDish);
    const legacySave = JSON.stringify({ ...save, cookDex: save.cookDex, cookDish: save.cookDish });
    const packedDex = JSON.stringify(packCookDex(save.cookDex));
    const packedDish = JSON.stringify(packCookDish(save.cookDish));

    const ls = mem();
    writeSave(ls, save);
    const compactSave = ls.raw['oyster-sim'];
    const loaded = loadSave(ls);
    assert.equal(Object.keys(loaded.cookDex!).length, COMBO_TOTAL);
    assert.equal(fmtDate(loaded.cookDex!['0']), '2026/1/2');
    assert.equal(fmtDate(loaded.cookDex![String(COMBO_TOTAL - 1)]), '2026/1/2');
    for (let i = 0; i < COMBO_TOTAL; i++) {
      if (comboHasFood(i)) assert.equal(loaded.cookDish![String(i)], 12);
    }

    // 舊格式（物件 + 毫秒）對照
    const before = legacySave.length;
    const after = compactSave.length;
    assert.ok(after < 200 * 1024, `壓縮後存檔 ${after} bytes 應小於 200 KB`);
    assert.ok(after < 512 * 1024, `壓縮後存檔 ${after} bytes 應小於 512 KB`);
    assert.ok(after < before, `應比舊格式小（前 ${before}、後 ${after}）`);
    // 讓跑測試時能在報告看到數字
    // eslint-disable-next-line no-console
    console.log(JSON.stringify({
      comboTotal: COMBO_TOTAL,
      legacyDex: legacyDex.length,
      legacyDish: legacyDish.length,
      legacySave: before,
      packedDex: packedDex.length,
      packedDish: packedDish.length,
      compactSave: after,
    }));
  });
});
