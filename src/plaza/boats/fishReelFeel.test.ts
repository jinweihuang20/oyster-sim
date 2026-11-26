import { describe, it, expect, vi } from 'vitest';
import { newFight, stepFight } from './fishLogic';
import {
  REEL_PRESSED, bindReelFeel, makeReelClickSfx, reelPressLabel, reelTensionColor, steerDirFromPad,
  type ReelBtnEl, type ReelClickSfx, type ReelFeel,
} from './fishReelFeel';

function fakeBtn(label = '收線') {
  const listeners = new Map<string, Array<(e: PointerEvent) => void>>();
  const cls = new Set<string>();
  const props = new Map<string, string>();
  const lbl = { textContent: label };
  const captured: number[] = [];
  const btn: ReelBtnEl & { lbl: { textContent: string }; captured: number[]; props: Map<string, string>; cls: Set<string> } = {
    lbl, captured, props, cls,
    classList: {
      toggle(name, force) {
        const on = force === undefined ? !cls.has(name) : !!force;
        if (on) cls.add(name); else cls.delete(name);
      },
      contains: (name) => cls.has(name),
      add: (...names) => { for (const n of names) cls.add(n); },
      remove: (...names) => { for (const n of names) cls.delete(n); },
    },
    style: {
      setProperty(k, v) { props.set(k, v); },
      removeProperty(k) { props.delete(k); },
    },
    querySelector: (sel) => sel === '.lbl' ? lbl : null,
    addEventListener(type, fn) { const a = listeners.get(type) ?? []; a.push(fn); listeners.set(type, a); },
    removeEventListener(type, fn) { listeners.set(type, (listeners.get(type) ?? []).filter(f => f !== fn)); },
    setPointerCapture(id) { captured.push(id); },
    releasePointerCapture() {},
  };
  const fire = (type: string, pointerId: number) => {
    const e = {
      pointerId,
      preventDefault() { (e as { pd?: boolean }).pd = true; },
      stopPropagation() {},
    } as unknown as PointerEvent;
    for (const fn of listeners.get(type) ?? []) fn(e);
    return e;
  };
  return { btn, fire, listeners };
}

const bind = (opts: Partial<Parameters<typeof bindReelFeel>[1]> & { btn?: ReelBtnEl } = {}) => {
  const f = fakeBtn();
  const held: boolean[] = [];
  const haptic = vi.fn();
  let ticking = false;
  const sfx: ReelClickSfx = {
    start() { ticking = true; },
    stop() { ticking = false; },
    setTension() {},
    ticking: () => ticking,
  };
  const feel = bindReelFeel(opts.btn ?? f.btn, {
    onDown: () => { held.push(true); opts.onDown?.(); },
    onUp: () => { held.push(false); opts.onUp?.(); },
    haptic: opts.haptic ?? haptic,
    sfx: opts.sfx ?? sfx,
    shouldSpin: opts.shouldSpin ?? (() => true),
    getTension: opts.getTension,
  });
  return { ...f, feel, held, haptic, sfx };
};

describe('收線鈕：左邊方向有輸入時仍能按、有回饋', () => {
  it('左邊搖桿／方向鍵的 pointer 跟收線鈕用不同 pointerId，互不放開', () => {
    const { feel, fire, btn, haptic } = bind();
    // 左搖桿先按著（pointer 1），不經過收線鈕
    expect(feel.held()).toBe(false);
    // 再按收線（pointer 2）
    fire('pointerdown', 2);
    expect(feel.held()).toBe(true);
    expect(feel.heldId()).toBe(2);
    expect(btn.cls.has(REEL_PRESSED)).toBe(true);
    expect(btn.lbl.textContent).toBe('收線中');
    expect(haptic).toHaveBeenCalledTimes(1);
    expect(btn.captured).toContain(2);
    // 搖桿那根手指移動／離開／放開，即使事件誤打到收線鈕，也不能把收線放開
    fire('pointerup', 1);
    feel.up(1);
    expect(feel.held()).toBe(true);
    expect(btn.cls.has(REEL_PRESSED)).toBe(true);
    // 真正放開收線那根手指才停
    fire('pointerup', 2);
    expect(feel.held()).toBe(false);
    expect(btn.cls.has(REEL_PRESSED)).toBe(false);
    expect(btn.lbl.textContent).toBe('收線');
  });

  it('不聽 pointerleave：別根手指或滑出都不該清掉按住', () => {
    const { feel, fire, listeners } = bind();
    fire('pointerdown', 7);
    expect(feel.held()).toBe(true);
    expect(listeners.has('pointerleave')).toBe(false);
    feel.up(99);
    expect(feel.held()).toBe(true);
    fire('pointercancel', 7);
    expect(feel.held()).toBe(false);
  });

  it('方向鍵／搖桿往左拉的同時，收線按住：遊戲邏輯兩邊都生效', () => {
    const keys = new Set(['ArrowLeft']);
    const dir = steerDirFromPad(c => keys.has(c), -0.8);
    expect(dir).toBeCloseTo(-0.8, 5);
    const { feel, fire } = bind();
    fire('pointerdown', 3);
    expect(feel.held()).toBe(true);
    const f = newFight(0.9, 8000, true);
    f.run = 1; f.runT = 9; // 魚往右衝，往左拉＝反方向（good）
    const evs: Array<string | null> = [];
    for (let i = 0; i < 60; i++) evs.push(stepFight(f, feel.held(), dir, 1 / 60, () => 0.5));
    expect(feel.held()).toBe(true);
    expect(f.prog).toBeGreaterThan(0.2);
    expect(evs.every(e => e === null || e === 'landed')).toBe(true);
  });

  it('空白鍵按住／放開也走同一套 pressed，而且跟滑鼠／觸控不互搶', () => {
    const { feel, btn, fire } = bind();
    expect(feel.keyDown()).toBe(true);
    expect(btn.cls.has(REEL_PRESSED)).toBe(true);
    // 已經用鍵盤按住時，另一根手指的 pointerup 不該放開
    fire('pointerup', 4);
    expect(feel.held()).toBe(true);
    expect(feel.keyUp()).toBe(true);
    expect(feel.held()).toBe(false);
  });
});

describe('收線鈕：按壓標籤、張力外圈、棘輪音', () => {
  it('標籤：收線／收竿（含驚嘆號）按住改成「中」', () => {
    expect(reelPressLabel('收線')).toBe('收線中');
    expect(reelPressLabel('收竿')).toBe('收竿中');
    expect(reelPressLabel('收竿！')).toBe('收竿中');
  });

  it('張力色：低張力藍／青，中段轉琥珀，高張力變紅', () => {
    expect(reelTensionColor(0)).toBe('#2a5a86');
    expect(reelTensionColor(1)).toBe('#e0392b');
    const mid = reelTensionColor(0.3);
    const warn = reelTensionColor(0.7);
    const hot = reelTensionColor(0.92);
    // 0.3：偏青（B 高、R 不太高）
    expect(parseInt(mid.slice(1, 3), 16)).toBeLessThan(0x80);
    expect(parseInt(mid.slice(5, 7), 16)).toBeGreaterThan(0x90);
    // 0.7：琥珀／橙（R 高、B 低）
    expect(parseInt(warn.slice(1, 3), 16)).toBeGreaterThan(0xb0);
    expect(parseInt(warn.slice(5, 7), 16)).toBeLessThan(0x80);
    // 0.92：偏紅
    expect(parseInt(hot.slice(1, 3), 16)).toBeGreaterThan(0xc0);
    expect(parseInt(hot.slice(5, 7), 16)).toBeLessThan(parseInt(warn.slice(5, 7), 16));
  });

  it('拉魚中按住：外圈跟著張力變色；放開立刻清掉並停棘輪音', () => {
    let ten = 0.2;
    const { feel, fire, btn, sfx } = bind({ getTension: () => ten });
    fire('pointerdown', 5);
    expect(sfx.ticking()).toBe(true);
    expect(btn.props.get('--reel-ten')).toBe(reelTensionColor(0.2));
    expect(btn.cls.has('ten-hot')).toBe(false);
    ten = 0.9;
    feel.tick();
    expect(btn.props.get('--reel-ten')).toBe(reelTensionColor(0.9));
    expect(btn.cls.has('ten-hot')).toBe(true);
    fire('pointerup', 5);
    expect(sfx.ticking()).toBe(false);
    expect(btn.props.has('--reel-ten')).toBe(false);
    expect(btn.cls.has('ten-hot')).toBe(false);
  });

  it('棘輪音：start 接到 sfx 總線、stop 立刻停（沒有輸出就安靜略過）', () => {
    const started: string[] = [];
    const dest = { connect() { return dest; } } as unknown as AudioNode;
    const ac = {
      state: 'running',
      sampleRate: 8000,
      currentTime: 0,
      resume: () => Promise.resolve(),
      createBuffer(ch: number, n: number, sr: number) {
        started.push('buf');
        return { sampleRate: sr, getChannelData: () => new Float32Array(n), numberOfChannels: ch };
      },
      createGain() {
        return { gain: { value: 0, cancelScheduledValues() {}, setValueAtTime() {}, linearRampToValueAtTime() {} }, connect(n: unknown) { if (n === dest) started.push('to-sfx'); return n; }, context: ac, disconnect() {} };
      },
      createBufferSource() {
        return { buffer: null as unknown, loop: false, playbackRate: { value: 1 }, connect(n: { connect?: unknown }) { return n; }, start() { started.push('start'); }, stop() { started.push('stop'); }, disconnect() {} };
      },
    } as unknown as AudioContext;
    const sfx = makeReelClickSfx(() => ({ ac, dest }));
    sfx.start();
    expect(sfx.ticking()).toBe(true);
    expect(started).toContain('start');
    expect(started).toContain('to-sfx');
    sfx.stop();
    expect(sfx.ticking()).toBe(false);
    expect(started).toContain('stop');
    sfx.start(); sfx.start();
    expect(started.filter(x => x === 'start').length).toBe(2);
    const silent = makeReelClickSfx(() => null);
    expect(() => { silent.start(); silent.stop(); }).not.toThrow();
    expect(silent.ticking()).toBe(false);
  });
});

// 型別佔位：避免未用警告在某些設定下出現
void (0 as unknown as ReelFeel);
