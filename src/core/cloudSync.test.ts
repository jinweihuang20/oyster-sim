import { describe, test, beforeEach, afterEach } from 'vitest';
import assert from 'node:assert/strict';
import { COMBO_TOTAL, comboHasFood } from '../cook/combo.ts';
import { defaultSave, writeSave, type SaveStorage } from './save.ts';
import {
  applyCloudData, collectCloudData, cloudInit, cloudFlush, cloudStatus,
  isCloudSkipKey, packCloudValue, unpackCloudValue,
} from './cloudSync.ts';

type LS = {
  raw: Record<string, string>;
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
  removeItem(k: string): void;
  length: number;
  key(i: number): string | null;
};

function makeLS(init: Record<string, string> = {}): LS {
  const raw: Record<string, string> = { ...init };
  const ls: LS = {
    raw,
    getItem: (k) => (k in raw ? raw[k] : null),
    setItem: (k, v) => { raw[k] = String(v); },
    removeItem: (k) => { delete raw[k]; },
    get length() { return Object.keys(raw).length; },
    key: (i) => Object.keys(raw)[i] ?? null,
  };
  return ls;
}

const origLS = globalThis.localStorage;
const origFetch = globalThis.fetch;
let mem: LS;

beforeEach(() => {
  mem = makeLS();
  Object.defineProperty(globalThis, 'localStorage', { value: mem, configurable: true });
  cloudInit('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', mem);
});
afterEach(() => {
  Object.defineProperty(globalThis, 'localStorage', { value: origLS, configurable: true });
  globalThis.fetch = origFetch;
});

describe('雲端 payload 不再雙重編碼，並能讀舊字串格式', () => {
  test('collectCloudData 把 oyster-sim 等 JSON 值收成物件', () => {
    const save = defaultSave();
    save.name = '測試';
    writeSave(mem as SaveStorage, save);
    mem.setItem('oyster-mix', JSON.stringify({ mute: false, master: 0.8 }));
    mem.setItem('oyster-lb-day', JSON.stringify({ d: '2026-01-01', v: 3 }));
    mem.setItem('oyster-homeguide', '1');
    mem.setItem('oyster-dm-set', JSON.stringify({ v: 1 }));
    mem.setItem('oyster-fr-watch:abc', '["k1"]');
    mem.setItem('oyster-ck-seen-up', '1');
    mem.setItem('oyster-sim-plain', 'not-json');

    const data = collectCloudData();
    assert.equal(typeof data['oyster-sim'], 'object');
    assert.equal((data['oyster-sim'] as { name: string }).name, '測試');
    assert.equal(typeof data['oyster-mix'], 'object');
    assert.equal(data['oyster-lb-day'], undefined);
    assert.equal(data['oyster-homeguide'], undefined);
    assert.equal(data['oyster-dm-set'], undefined);
    assert.equal(data['oyster-fr-watch:abc'], undefined);
    assert.equal(data['oyster-ck-seen-up'], undefined);
    assert.equal(isCloudSkipKey('oyster-mix'), false);
  });

  test('applyCloudData 可吃舊字串和新物件，來回一致', () => {
    const save = defaultSave();
    save.money = 5555;
    save.days = 4;
    writeSave(mem as SaveStorage, save);
    const collected = collectCloudData();
    assert.equal(typeof collected['oyster-sim'], 'object');

    const other = makeLS();
    Object.defineProperty(globalThis, 'localStorage', { value: other, configurable: true });
    cloudInit('bbbbbbbb-cccc-dddd-eeee-ffffffffffff', other);
    applyCloudData(collected, 99, 'bbbbbbbb-cccc-dddd-eeee-ffffffffffff');
    const again = loadVia(other);
    assert.equal(again.money, 5555);
    assert.equal(again.days, 4);

    // 舊格式：data 裡的 oyster-sim 是字串
    const legacy = makeLS();
    Object.defineProperty(globalThis, 'localStorage', { value: legacy, configurable: true });
    cloudInit('cccccccc-dddd-eeee-ffff-000000000000', legacy);
    applyCloudData({
      'oyster-sim': JSON.stringify({ v: 3, money: 42, days: 1, name: '舊檔' }),
      'oyster-mix': JSON.stringify({ mute: true }),
    }, 7, 'cccccccc-dddd-eeee-ffff-000000000000');
    assert.equal(JSON.parse(legacy.getItem('oyster-sim')!).money, 42);
    assert.equal(JSON.parse(legacy.getItem('oyster-mix')!).mute, true);
    assert.equal(legacy.getItem('oyster-stats-id'), 'cccccccc-dddd-eeee-ffff-000000000000');
  });

  test('pack / unpack 對字串與物件對稱', () => {
    const obj = { v: 3, cookDex: [1, 20260101] };
    const packed = packCloudValue(JSON.stringify(obj));
    assert.deepEqual(packed, obj);
    assert.deepEqual(JSON.parse(unpackCloudValue(packed)!), obj);
    assert.equal(unpackCloudValue('plain'), 'plain');
  });

  test('POST 413 顯示存檔過大，無法同步到雲端', async () => {
    writeSave(mem as SaveStorage, defaultSave());
    globalThis.fetch = (async () => new Response('too large', { status: 413 })) as typeof fetch;
    await cloudFlush();
    assert.equal(cloudStatus().err, '存檔過大，無法同步到雲端');
    assert.equal(cloudStatus().status, 'err');
  });

  test('全滿圖鑑雲端 payload（物件、無雙重編碼）遠低於 200 KB 與 512 KB', () => {
    const save = defaultSave();
    save.cookDex = {};
    save.cookDish = {};
    const ts = new Date(2026, 0, 2, 18, 0, 0).getTime();
    for (let i = 0; i < COMBO_TOTAL; i++) {
      save.cookDex[String(i)] = ts;
      if (comboHasFood(i)) save.cookDish[String(i)] = 12;
    }
    writeSave(mem as SaveStorage, save);
    const data = collectCloudData();
    const body = JSON.stringify({ pid: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', data, rev: 1 });
    const simStr = mem.getItem('oyster-sim')!;
    const doubled = JSON.stringify({ pid: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', data: { 'oyster-sim': simStr }, rev: 1 });
    assert.ok(body.length < 200 * 1024, `雲端 body ${body.length} 應小於 200 KB`);
    assert.ok(body.length < 512 * 1024, `雲端 body ${body.length} 應小於 512 KB`);
    assert.ok(body.length < doubled.length, '物件 payload 應比雙重編碼的舊 payload 小');
    // eslint-disable-next-line no-console
    console.log(JSON.stringify({ cloudBody: body.length, doubledBody: doubled.length, oysterSim: simStr.length }));
  });
});

function loadVia(ls: LS) {
  return JSON.parse(ls.getItem('oyster-sim') || 'null');
}
