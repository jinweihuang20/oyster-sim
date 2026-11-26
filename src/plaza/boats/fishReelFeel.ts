/**
 * 收線鈕的按壓手感：多指互不搶、明確 pressed 狀態、張力外圈、震動、棘輪音。
 * 左邊搖桿／方向鍵按著時，收線鈕自己的 pointerId 仍能按下去並立刻有回饋。
 */
export const REEL_PRESSED = 'pressed';
const SPACE_PTR = -2;

export type ReelSfxOut = { ac: AudioContext; dest: AudioNode };
export type ReelClickSfx = {
  start: () => void;
  stop: () => void;
  setTension: (ten: number) => void;
  ticking: () => boolean;
};

function hexLerp(a: string, b: string, t: number): string {
  const p = (h: string) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const A = p(a), B = p(b), u = Math.max(0, Math.min(1, t));
  return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * u).toString(16).padStart(2, '0')).join('');
}

/** 張力 0～1：安全藍／青 → 警告橙 → 危險紅（給按鈕外圈） */
export function reelTensionColor(ten: number): string {
  const t = Math.max(0, Math.min(1, ten));
  if (t < 0.55) return hexLerp('#2a5a86', '#5ad4e8', t / 0.55);
  if (t < 0.8) return hexLerp('#5ad4e8', '#f0a020', (t - 0.55) / 0.25);
  return hexLerp('#f0a020', '#e0392b', (t - 0.8) / 0.2);
}

/** 按住時的標籤：收線→收線中、收竿／收竿！→收竿中 */
export function reelPressLabel(base: string): string {
  if (base.startsWith('收線')) return '收線中';
  if (base.startsWith('收竿')) return '收竿中';
  return base;
}

/** 搖桿／WASD／方向鍵合成左右（-1～1）。joy 超過死區時以搖桿為準。 */
export function steerDirFromPad(hasKey: (code: string) => boolean, joyX: number, dead = 0.15): number {
  let dir = 0;
  if (hasKey('KeyA') || hasKey('ArrowLeft')) dir -= 1;
  if (hasKey('KeyD') || hasKey('ArrowRight')) dir += 1;
  if (Math.abs(joyX) > dead) dir = joyX;
  return Math.max(-1, Math.min(1, dir));
}

/** 輕量循環棘輪音：接到現有 sfx 總線，音量／靜音跟遊戲設定走；放開立刻停。 */
export function makeReelClickSfx(getOut: () => ReelSfxOut | null): ReelClickSfx {
  let src: AudioBufferSourceNode | null = null;
  let gain: GainNode | null = null;
  let buf: AudioBuffer | null = null;
  let running = false;

  function build(ac: AudioContext) {
    const dur = 0.48, n = Math.max(1, Math.floor(ac.sampleRate * dur));
    const b = ac.createBuffer(1, n, ac.sampleRate);
    const d = b.getChannelData(0);
    const clicks = 5, len = Math.max(1, Math.floor(ac.sampleRate * 0.012));
    for (let c = 0; c < clicks; c++) {
      const at = Math.floor((c + 0.08) * (n / clicks));
      for (let i = 0; i < len && at + i < n; i++) {
        const env = Math.pow(1 - i / len, 3);
        d[at + i] += (Math.random() * 2 - 1) * 0.45 * env + Math.sin(i * 0.9) * 0.15 * env;
      }
    }
    return b;
  }

  return {
    start() {
      if (running) return;
      const out = getOut(); if (!out) return;
      try {
        if (out.ac.state === 'suspended') void out.ac.resume();
        if (!buf || buf.sampleRate !== out.ac.sampleRate) buf = build(out.ac);
        gain = out.ac.createGain();
        gain.gain.value = 0.16;
        src = out.ac.createBufferSource();
        src.buffer = buf;
        src.loop = true;
        src.connect(gain).connect(out.dest);
        src.start();
        running = true;
      } catch {
        try { src?.disconnect(); gain?.disconnect(); } catch { /* 建立失敗就當沒聲音 */ }
        src = null; gain = null; running = false;
      }
    },
    stop() {
      if (!running && !src && !gain) return;
      running = false;
      const g = gain, s = src;
      src = null; gain = null;
      try {
        const ac = g?.context;
        if (g && ac) {
          const t = ac.currentTime;
          g.gain.cancelScheduledValues(t);
          g.gain.setValueAtTime(g.gain.value, t);
          g.gain.linearRampToValueAtTime(0, t + 0.03);
          s?.stop(t + 0.04);
        } else s?.stop();
      } catch { /* 已停 */ }
      try { s?.disconnect(); g?.disconnect(); } catch { /* */ }
    },
    setTension(ten: number) {
      if (src && running) src.playbackRate.value = 0.92 + Math.max(0, Math.min(1, ten)) * 0.28;
    },
    ticking() { return running; },
  };
}

export type ReelBtnEl = {
  classList: { toggle(name: string, force?: boolean): unknown; contains(name: string): boolean; add(...name: string[]): unknown; remove(...name: string[]): unknown };
  style: { setProperty(k: string, v: string): void; removeProperty(k: string): void };
  querySelector(sel: string): { textContent: string | null } | null;
  addEventListener(type: string, fn: (e: PointerEvent) => void): void;
  removeEventListener(type: string, fn: (e: PointerEvent) => void): void;
  setPointerCapture?(id: number): void;
  releasePointerCapture?(id: number): void;
};

export type ReelFeelOpts = {
  onDown: () => void;
  onUp: () => void;
  haptic?: () => void;
  sfx?: ReelClickSfx;
  /** 這次按住要不要轉輪＋棘輪音（拉魚／路亞收線） */
  shouldSpin?: () => boolean;
  /** <0 或不給＝一般按壓亮邊；0～1＝張力色 */
  getTension?: () => number;
};

export type ReelFeel = {
  down: (pointerId: number) => boolean;
  up: (pointerId: number) => boolean;
  keyDown: () => boolean;
  keyUp: () => boolean;
  tick: () => void;
  release: () => void;
  held: () => boolean;
  heldId: () => number;
  dispose: () => void;
};

const DEF_RING = '#7ad7ff';

/** 綁收線鈕：用 pointerId 分開追蹤，不聽 pointerleave（別根手指一動就會誤放）。 */
export function bindReelFeel(btn: ReelBtnEl, opts: ReelFeelOpts): ReelFeel {
  let ptr = -1;
  let baseLabel = '';

  const lbl = () => btn.querySelector('.lbl');

  function applyRing() {
    const ten = opts.getTension?.();
    const fight = ten != null && ten >= 0;
    const col = fight ? reelTensionColor(ten) : DEF_RING;
    btn.style.setProperty('--reel-ten', col);
    btn.classList.toggle('ten-warn', !!(fight && ten >= 0.55 && ten < 0.8));
    btn.classList.toggle('ten-hot', !!(fight && ten >= 0.8));
    if (fight) opts.sfx?.setTension(ten);
  }

  function clearRing() {
    btn.style.removeProperty('--reel-ten');
    btn.classList.remove('ten-warn', 'ten-hot');
  }

  function paint(on: boolean) {
    btn.classList.toggle(REEL_PRESSED, on);
    const el = lbl();
    if (el) {
      if (on) {
        const cur = el.textContent ?? '';
        if (!cur.endsWith('中')) baseLabel = cur;
        const next = reelPressLabel(baseLabel || cur);
        if (el.textContent !== next) el.textContent = next;
      } else if (baseLabel) {
        el.textContent = baseLabel;
      }
    }
    if (on) {
      applyRing();
      if (opts.shouldSpin?.() !== false) opts.sfx?.start();
    } else {
      clearRing();
      opts.sfx?.stop();
    }
  }

  function down(id: number): boolean {
    if (ptr !== -1 && ptr !== id) return false;
    const first = ptr === -1;
    ptr = id;
    if (first) {
      opts.onDown();
      paint(true);
      try { opts.haptic?.(); } catch { /* 不支援震動 */ }
    }
    return true;
  }

  function up(id: number): boolean {
    if (ptr !== id) return false;
    ptr = -1;
    opts.onUp();
    paint(false);
    return true;
  }

  function release() { if (ptr !== -1) up(ptr); }

  const onDown = (e: PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    down(e.pointerId);
    try { btn.setPointerCapture?.(e.pointerId); } catch { /* 舊瀏覽器 */ }
  };
  const onUp = (e: PointerEvent) => {
    if (ptr !== e.pointerId) return;
    try { btn.releasePointerCapture?.(e.pointerId); } catch { /* */ }
    up(e.pointerId);
  };
  const onBlur = () => { release(); };

  btn.addEventListener('pointerdown', onDown);
  btn.addEventListener('pointerup', onUp);
  btn.addEventListener('pointercancel', onUp);
  btn.addEventListener('lostpointercapture', onUp);
  const win = typeof window !== 'undefined' ? window : undefined;
  win?.addEventListener('blur', onBlur);

  return {
    down, up,
    keyDown: () => down(SPACE_PTR),
    keyUp: () => up(SPACE_PTR),
    tick() { if (ptr !== -1) applyRing(); },
    release,
    held: () => ptr !== -1,
    heldId: () => ptr,
    dispose() {
      release();
      opts.sfx?.stop();
      btn.removeEventListener('pointerdown', onDown);
      btn.removeEventListener('pointerup', onUp);
      btn.removeEventListener('pointercancel', onUp);
      btn.removeEventListener('lostpointercapture', onUp);
      win?.removeEventListener('blur', onBlur);
    },
  };
}
