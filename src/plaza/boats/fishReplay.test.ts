import { describe, it, expect } from 'vitest';
import { RF, RF_STRIDE, REPLAY_WIN, newReplayRec, recStart, recStop, recReset, recTick, recPush, recSpan, recSplash, recClip, clipSample, clipSplashes, newReplayPlay, playStep, playSeek, playToggle, playRestart, playSpeed, orbitStart, orbitDist, orbitDrag, orbitZoom, orbitPos, orbitClamp, ORBIT, lerpAngle, fmtReplayT } from './fishReplay';

const meta = { sp: 'x', name: '測試魚', kg: 1.2, tier: 0, player: 'A' };
/** 錄 sec 秒（每幀 1/60）：fx＝經過時間、fyaw 繞圈 */
function record(sec: number, splashAt: number[] = []) {
  const r = recStart(newReplayRec());
  const dt = 1 / 60;
  const steps = Math.round(sec / dt);
  const sp = [...splashAt];
  for (let i = 0; i < steps; i++) {
    const s = recTick(r, dt);
    if (sp.length && r.t >= sp[0]) { recSplash(r, 0.5); sp.shift(); }
    if (s) recPush(r, (b, o) => { b[o + RF.fx] = r.t; b[o + RF.fyaw] = 3.1 + r.t * 0; b[o + RF.phase] = r.t > sec - 2 ? 3 : 2; });
  }
  return r;
}

describe('精彩回放：環形緩衝', () => {
  it('錄 18 秒只留最後 10 秒（[8s..18s]）', () => {
    const r = record(18);
    const { t0, t1 } = recSpan(r);
    expect(t1).toBeCloseTo(18, 1);
    expect(t1 - t0).toBeLessThanOrEqual(REPLAY_WIN + 1e-3);
    expect(t0).toBeGreaterThanOrEqual(t1 - REPLAY_WIN - 1e-3);
    expect(t0).toBeGreaterThan(7.9);
    expect(t0).toBeLessThan(8.1);
    expect(r.n).toBeLessThanOrEqual(r.cap);
  });
  it('記憶體固定：緩衝不會長大（~幾十 KB）', () => {
    const r = record(40);
    expect(r.buf.length).toBe(r.cap * RF_STRIDE);
    expect(r.buf.byteLength).toBeLessThan(64 * 1024);
  });
  it('短於 10 秒就全部保留，片段時間從 0 開始', () => {
    const r = record(4);
    const c = recClip(r, meta)!;
    expect(c.f[RF.t]).toBe(0);
    expect(c.dur).toBeCloseTo(4, 1);
    expect(c.meta.name).toBe('測試魚');
  });
  it('水花寫進下一格，片段播放經過時觸發一次', () => {
    const r = record(6, [2, 4.5]);
    const c = recClip(r, meta)!;
    const hit: number[] = [];
    clipSplashes(c, 0, c.dur, (o, k) => { hit.push(c.f[o + RF.t]); expect(k).toBe(0.5); });
    expect(hit.length).toBe(2);
    expect(hit[0]).toBeCloseTo(2, 1);
    // 分段播放總數一樣、不重複
    let n = 0; for (let t = 0; t < c.dur; t += 0.37) n += clipSplashes(c, t, Math.min(c.dur, t + 0.37), () => { });
    expect(n).toBe(2);
  });
});

describe('精彩回放：內插', () => {
  const c = recClip(record(12), meta)!;
  const out = new Float32Array(RF_STRIDE);
  it('任意時間線性內插（含頭尾夾住）', () => {
    for (const t of [0, 0.013, 3.3333, 7.77, c.dur]) {
      clipSample(c, t, out);
      expect(out[RF.t]).toBeCloseTo(t, 4);
      // fx 記的是錄影時間（片段從約 2s 開始）
      expect(out[RF.fx]).toBeCloseTo(t + c.f[RF.fx], 2);
    }
    clipSample(c, -5, out); expect(out[RF.t]).toBe(0);
    clipSample(c, 99, out); expect(out[RF.t]).toBeCloseTo(c.dur, 5);
    clipSample(c, NaN, out); expect(Number.isFinite(out[RF.fx])).toBe(true);
  });
  it('狀態欄位不內插、水花不帶', () => {
    clipSample(c, c.dur - 0.5, out); expect(out[RF.phase]).toBe(3);
    clipSample(c, 1, out); expect(out[RF.phase]).toBe(2);
    expect(out[RF.splash]).toBe(0);
  });
  it('角度走最短路徑', () => {
    expect(lerpAngle(3.0, -3.0, 0.5)).toBeCloseTo(Math.PI, 2);
    expect(lerpAngle(0.1, 0.3, 0.5)).toBeCloseTo(0.2, 5);
  });
  it('0.5× 慢動作走一半時間、拖拉時間軸夾在 0～dur', () => {
    const p = newReplayPlay(c.dur);
    for (let i = 0; i < 4; i++) playStep(p, 0.25); expect(p.t).toBeCloseTo(1, 5);
    expect(playSpeed(p)).toBe(0.5);
    for (let i = 0; i < 4; i++) playStep(p, 0.25); expect(p.t).toBeCloseTo(1.5, 5);
    expect(playSeek(p, 6.25)).toBe(6.25);
    expect(playSeek(p, -1)).toBe(0);
    expect(playSeek(p, 1e9)).toBe(c.dur);
    expect(playSeek(p, NaN)).toBe(c.dur);
  });
  it('播到尾巴自動停；再按播放從頭；重播回 0', () => {
    const p = newReplayPlay(2);
    for (let i = 0; i < 20; i++) playStep(p, 0.2);
    expect(p.t).toBe(2); expect(p.playing).toBe(false);
    expect(playToggle(p)).toBe(true); expect(p.t).toBe(0);
    playStep(p, 0.5); expect(playToggle(p)).toBe(false); expect(playStep(p, 1)).toBe(0);
    playRestart(p); expect(p.t).toBe(0); expect(p.playing).toBe(true);
    expect(fmtReplayT(3.04)).toBe('3.0s');
  });
});

describe('精彩回放：軌道鏡頭', () => {
  const out = { x: 0, y: 0, z: 0 };
  it('方位 360° 繞圈、仰角與距離夾住', () => {
    const o = orbitStart(0);
    orbitDrag(o, 100000, 0); expect(o.az).toBeGreaterThanOrEqual(0); expect(o.az).toBeLessThan(Math.PI * 2);
    orbitDrag(o, 0, 1e6); expect(o.el).toBe(ORBIT.elMax);
    orbitDrag(o, 0, -1e6); expect(o.el).toBe(ORBIT.elMin);
    orbitZoom(o, 100); expect(o.r).toBe(ORBIT.rMax);
    for (let i = 0; i < 30; i++) orbitZoom(o, 0.5); expect(o.r).toBe(ORBIT.rMin);
  });
  it('鏡頭不會鑽到水面以下，距離維持', () => {
    const o = orbitClamp({ az: 1, el: ORBIT.elMin, r: 10 });
    orbitPos(o, 0, 0.2, 0, 0, out);
    expect(out.y).toBeGreaterThanOrEqual(ORBIT.minAbove - 1e-6);
    // 焦點在水面下也一樣
    orbitPos(o, 3, -2, 4, 0, out);
    expect(out.y).toBeGreaterThanOrEqual(ORBIT.minAbove - 1e-6);
    const o2 = orbitClamp({ az: 2, el: 0.5, r: 6 });
    orbitPos(o2, 1, 2, 3, -10, out);
    expect(Math.hypot(out.x - 1, out.y - 2, out.z - 3)).toBeCloseTo(6, 4);
    // 給實際距離（自動框）也一樣不鑽水
    orbitPos(o, 0, 0.1, 0, 0, out, 25);
    expect(out.y).toBeGreaterThanOrEqual(ORBIT.minAbove - 1e-6);
  });
  it('自動框：人和魚隔越遠拉越遠、魚吊到身邊拉近；縮放照比例、有上下限', () => {
    const o = orbitStart(0);
    const near = orbitDist(o, 0.5), far = orbitDist(o, 15);
    expect(near).toBeLessThan(far);
    expect(near).toBeGreaterThanOrEqual(ORBIT.dMin);
    orbitZoom(o, 2); expect(orbitDist(o, 15)).toBeGreaterThan(far);
    orbitZoom(o, 1e-3); expect(orbitDist(o, 0)).toBeGreaterThanOrEqual(ORBIT.dMin);
    expect(Number.isFinite(orbitDist(o, NaN))).toBe(true);
  });
  it('壞輸入不會 NaN', () => {
    const o = orbitClamp({ az: NaN, el: NaN, r: NaN });
    orbitDrag(o, NaN, Infinity); orbitZoom(o, NaN);
    orbitPos(o, NaN, NaN, NaN, NaN, out);
    for (const v of [o.az, o.el, o.r, out.x, out.y, out.z]) expect(Number.isFinite(v)).toBe(true);
  });
  it('開場是側面四分之三（不是正後方也不是正前方）', () => {
    const o = orbitStart(0);
    orbitPos(o, 0, 1, 0, 0, out);
    expect(Math.abs(out.x)).toBeGreaterThan(1);
    expect(o.r).toBeGreaterThan(ORBIT.rMin);
  });
});

describe('精彩回放：生命週期', () => {
  it('開始／停止／重設不殘留、緩衝重用', () => {
    const r = record(5);
    const buf = r.buf;
    recStop(r); expect(recTick(r, 0.1)).toBe(false);
    recSplash(r, 1); expect(r.pendSplash).toBe(0);
    recStart(r); expect(r.n).toBe(0); expect(r.t).toBe(0); expect(r.buf).toBe(buf);
    expect(recClip(r, meta)).toBeNull();
    recTick(r, 0.04); recPush(r, () => { }); recTick(r, 0.04); recPush(r, () => { });
    recReset(r); expect(r.on).toBe(false); expect(r.n).toBe(0); expect(recSpan(r)).toEqual({ t0: 0, t1: 0 });
  });
  it('片段是拷貝：之後重錄不影響已存的片段', () => {
    const r = record(5);
    const c = recClip(r, meta)!;
    const v = c.f[RF.fx + RF_STRIDE * 3];
    recStart(r); for (let i = 0; i < 50; i++) { recTick(r, 0.05); recPush(r, (b, o) => { b[o + RF.fx] = -99; }); }
    expect(c.f[RF.fx + RF_STRIDE * 3]).toBe(v);
  });
});
