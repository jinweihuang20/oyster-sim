import { isDeathmatchActive } from './deathmatch';

export type MixAudio = { master: number; amb: number; sfx: number; mute: boolean; music: number };

export type AudioDeps = {
  getMix: () => MixAudio;
  persistMix: () => void;
  pickTrack: () => string;
  rnd: (a: number, b: number) => number;
};

let _deps: AudioDeps | null = null;
export function initAudio(d: AudioDeps) { _deps = d; }
const D = () => { if (!_deps) throw new Error('audio not init'); return _deps; };

export let ac: AudioContext | null = null;
let masterG: GainNode, ambG: GainNode, musG: GainNode;
export let sfxG: GainNode;
// 環境音（海浪、漁船引擎、海鷗、收音機都走 ambG）：死鬥模式中靜音，離開後照使用者設定恢復
const ambLevel = () => (isDeathmatchActive() ? 0 : D().getMix().amb);
export function duckAmb() { if (!ac) return; const t = ac.currentTime; ambG.gain.cancelScheduledValues(t); ambG.gain.setValueAtTime(ambG.gain.value, t); ambG.gain.linearRampToValueAtTime(ambLevel(), t + 0.4); }
export function applyMix() { const mix = D().getMix(); if (!ac) { D().persistMix(); return; } masterG.gain.value = mix.mute ? 0 : mix.master; ambG.gain.value = ambLevel(); sfxG.gain.value = mix.sfx; musG.gain.value = mix.music * 0.5; D().persistMix(); }
function noiseBuf(a: AudioContext, sec: number) { const n = a.sampleRate * sec, b = a.createBuffer(1, n, a.sampleRate), d = b.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1; return b; }
function lfo(a: AudioContext, rate: number, depth: number, target: AudioParam) { const o = a.createOscillator(), g = a.createGain(); o.frequency.value = rate; g.gain.value = depth; o.connect(g).connect(target); o.start(); }
function startAmbience(a: AudioContext) {
  const nb = noiseBuf(a, 4);
  const loopNoise = (type: BiquadFilterType, f: number, vol: number, lrate: number, ldepth: number) => {
    const s = a.createBufferSource(); s.buffer = nb; s.loop = true; const fl = a.createBiquadFilter(); fl.type = type; fl.frequency.value = f; const g = a.createGain(); g.gain.value = vol;
    s.connect(fl).connect(g).connect(ambG); s.start(); if (lrate) lfo(a, lrate, ldepth, g.gain); return fl;
  };
  loopNoise('lowpass', 500, 0.35, 0.12, 0.25);   // 海湧
  const wind = loopNoise('highpass', 3000, 0.03, 0.07, 0.02); lfo(a, 0.05, 800, wind.frequency); // 風
  const eng = a.createOscillator(); eng.type = 'sawtooth'; eng.frequency.value = 42; const ef = a.createBiquadFilter(); ef.type = 'lowpass'; ef.frequency.value = 160; const eg = a.createGain(); eg.gain.value = 0.05;
  eng.connect(ef).connect(eg).connect(ambG); eng.start(); lfo(a, 7, 0.02, eg.gain); // 遠遠的漁船引擎
  const gull = () => { if (document.hidden) { setTimeout(gull, 4000); return; } const t = a.currentTime; for (let k = 0; k < 2 + Math.floor(Math.random() * 3); k++) { const o = a.createOscillator(), g = a.createGain(), s0 = t + k * 0.28; o.type = 'triangle';
      o.frequency.setValueAtTime(1500, s0); o.frequency.exponentialRampToValueAtTime(900, s0 + 0.22); g.gain.setValueAtTime(0, s0); g.gain.linearRampToValueAtTime(0.04, s0 + 0.03); g.gain.linearRampToValueAtTime(0, s0 + 0.24);
      o.connect(g).connect(ambG); o.start(s0); o.stop(s0 + 0.3); } setTimeout(gull, 5000 + Math.random() * 9000); };
  setTimeout(gull, 2000);
  const radio = () => { if (document.hidden) { setTimeout(radio, 4000); return; } const t = a.currentTime, s = a.createBufferSource(); s.buffer = nb; const f = a.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1200; f.Q.value = 3; const g = a.createGain();
    g.gain.value = 0; for (let k = 0; k < 12; k++) g.gain.setValueAtTime(Math.random() < 0.6 ? 0.03 : 0, t + k * 0.12); g.gain.setValueAtTime(0, t + 1.5);
    s.connect(f).connect(g).connect(ambG); s.start(t); s.stop(t + 1.6); setTimeout(radio, 9000 + Math.random() * 12000); };
  setTimeout(radio, 6000);
}
// ===== 音樂引擎：每個場景一首 BGM、收音機三個台，全部 WebAudio 即時合成 =====
// 同一時間只排程正在播（或正在淡出）的曲子；切換時 0.8 秒交叉淡入淡出
type Player = (i: number, t: number, st: number) => void;
type Trk = { bpm: number; make: (a: AudioContext, out: AudioNode) => Player };
const MN = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
// 共用樂器
function vTone(a: AudioContext, out: AudioNode, ty: OscillatorType, f: number, t: number, d: number, v: number, att = 0.01, vib = 0, vibR = 5.5) {
  const o = a.createOscillator(), g = a.createGain(); o.type = ty; o.frequency.value = f;
  if (vib) { const lv = a.createOscillator(), lg = a.createGain(); lv.frequency.value = vibR; lg.gain.value = vib; lv.connect(lg).connect(o.detune); lv.start(t); lv.stop(t + d + 0.05); }
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + att); g.gain.setValueAtTime(v, t + Math.max(att, d * 0.75)); g.gain.linearRampToValueAtTime(0, t + d);
  o.connect(g).connect(out); o.start(t); o.stop(t + d + 0.05);
}
function vPluck(a: AudioContext, out: AudioNode, f: number, t: number, v: number, dec: number, ty: OscillatorType = 'triangle') {
  const o = a.createOscillator(), g = a.createGain(); o.type = ty; o.frequency.value = f; g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + dec); o.connect(g).connect(out); o.start(t); o.stop(t + dec + 0.02);
}
let mNoise: AudioBuffer | null = null;
function vHit(a: AudioContext, out: AudioNode, t: number, ft: BiquadFilterType, fq: number, v: number, d: number, q = 0.8) {
  if (!mNoise) mNoise = noiseBuf(a, 1);
  const s = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain(); s.buffer = mNoise; f.type = ft; f.frequency.value = fq; f.Q.value = q;
  g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + d); s.connect(f).connect(g).connect(out); s.start(t, Math.random() * 0.5); s.stop(t + d + 0.02);
}
function vKick(a: AudioContext, out: AudioNode, t: number, v = 0.7, f0 = 140, f1 = 45, d = 0.18) {
  const o = a.createOscillator(), g = a.createGain(); o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + d * 0.65); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + d); o.connect(g).connect(out); o.start(t); o.stop(t + d + 0.02);
}
// 鑼：非整數倍泛音、長尾音
function vGong(a: AudioContext, out: AudioNode, t: number, f: number, v: number, d: number) {
  for (const [mul, k] of [[1, 1], [1.48, 0.6], [2.03, 0.45], [2.74, 0.3], [3.9, 0.15]]) { const o = a.createOscillator(), g = a.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(f * mul * 1.02, t); o.frequency.exponentialRampToValueAtTime(f * mul, t + 0.3); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v * k, t + 0.008); g.gain.exponentialRampToValueAtTime(0.001, t + d * (1.2 - k * 0.3)); o.connect(g).connect(out); o.start(t); o.stop(t + d * 1.2); }
}
// 汽笛：兩支低頻鋸齒波微微走音、低通
function vHorn(a: AudioContext, out: AudioNode, t: number, d: number, v: number) {
  const lp = a.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 520; const g = a.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + 0.25); g.gain.setValueAtTime(v, t + d - 0.4); g.gain.linearRampToValueAtTime(0, t + d); lp.connect(g).connect(out);
  for (const f of [110, 111.3, 165.5]) { const o = a.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.connect(lp); o.start(t); o.stop(t + d + 0.05); }
}
const TRACKS: Record<string, Trk> = {
  // 死鬥：放克律動（約 110 BPM，16 分音符格），音量壓低、低通，不蓋過腳步和音效
  dm: { bpm: 220, make: (a, out) => {
    const bus = a.createGain(); bus.gain.value = 0.5; const lp = a.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3200; bus.connect(lp).connect(out);
    const nb = a.createBuffer(1, a.sampleRate * 0.3, a.sampleRate), nd = nb.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    const hz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
    const nz = (t: number, d: number, f: number, v: number, type: BiquadFilterType = 'bandpass') => { const s = a.createBufferSource(); s.buffer = nb; const fl = a.createBiquadFilter(); fl.type = type; fl.frequency.value = f; const g = a.createGain(); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + d); s.connect(fl).connect(g).connect(bus); s.start(t); s.stop(t + d + 0.02); };
    const kick = (t: number, v: number) => { const o = a.createOscillator(), g = a.createGain(); o.frequency.setValueAtTime(130, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.12); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.2); o.connect(g).connect(bus); o.start(t); o.stop(t + 0.22); };
    const bass = (t: number, m: number, d: number, v: number) => { const o = a.createOscillator(), f = a.createBiquadFilter(), g = a.createGain(); o.type = 'sawtooth'; o.frequency.value = hz(m); f.type = 'lowpass'; f.Q.value = 6; f.frequency.setValueAtTime(1400, t); f.frequency.exponentialRampToValueAtTime(260, t + d); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + d); o.connect(f).connect(g).connect(bus); o.start(t); o.stop(t + d + 0.02); };
    const clav = (t: number, ch: number[], v: number) => { const f = a.createBiquadFilter(), g = a.createGain(); f.type = 'bandpass'; f.Q.value = 4; f.frequency.setValueAtTime(700, t); f.frequency.exponentialRampToValueAtTime(2200, t + 0.06); f.frequency.exponentialRampToValueAtTime(900, t + 0.11); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.11); f.connect(g).connect(bus);
      for (const m of ch) { const o = a.createOscillator(); o.type = 'square'; o.frequency.value = hz(m); o.connect(f); o.start(t); o.stop(t + 0.13); } };
    // E 小調放克：bass 16 格（0＝休止），兩小節換和弦 Em7 → A7
    const BL = [40, 0, 0, 52, 0, 40, 0, 43, 0, 45, 0, 40, 52, 0, 50, 0], BL2 = [45, 0, 0, 57, 0, 45, 0, 48, 0, 50, 0, 45, 57, 0, 55, 52];
    const EM7 = [64, 67, 71, 74], A7 = [64, 67, 69, 73];
    return (step, t) => {
      const i = step % 16, bar = Math.floor(step / 16) % 4, sec = bar < 2 ? 0 : 1;
      if (i === 0 || i === 10 || (i === 7 && bar % 2)) kick(t, 0.5);
      if (i === 4 || i === 12) nz(t, 0.14, 1800, 0.32); else if (i === 7 || i === 15 || i === 9) nz(t, 0.05, 1600, 0.06); // 鼓邊鬼音
      if (i % 2 === 0) nz(t, 0.03, 8000, i % 4 === 2 ? 0.07 : 0.035, 'highpass');
      const bn = (sec ? BL2 : BL)[i]; if (bn) bass(t, bn, i % 4 === 3 ? 0.08 : 0.16, i === 0 ? 0.26 : 0.18);
      if (i === 2 || i === 6 || i === 11 || (i === 14 && bar % 2)) clav(t, sec ? A7 : EM7, 0.05);
    };
  } },
  // 主選單／教學／結算：台式電子琴（那卡西／廟口風），原本那首
  temple: { bpm: 128, make: (a, out) => {
    const mel = [76, 0, 79, 76, 74, 0, 72, 74, 76, 79, 81, 0, 79, 76, 74, 0, 72, 0, 74, 72, 69, 0, 67, 69, 72, 74, 76, 74, 72, 0, 0, 0,
                 81, 0, 79, 81, 84, 0, 81, 79, 76, 79, 81, 0, 79, 0, 76, 74, 72, 74, 76, 79, 76, 74, 72, 69, 67, 0, 69, 72, 72, 0, 0, 0];
    const chords = [[48, 52, 55], [45, 48, 52], [41, 45, 48], [43, 47, 50], [48, 52, 55], [45, 48, 52], [43, 47, 50], [48, 52, 55]];
    const lp = a.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3200; lp.connect(out);
    return (s, t, st) => { const i = s % 64, beat = i % 8, ch = chords[Math.floor(i / 8)], m = mel[i];
      if (m) { const d = st * (mel[(i + 1) % 64] ? 0.95 : 1.9); for (const [ty, det, mul] of [['square', 0, 1], ['sawtooth', 7, 1], ['triangle', 0, 2]] as [OscillatorType, number, number][]) vTone(a, lp, ty, MN(m) * mul * Math.pow(2, det / 1200), t, d, 0.06, 0.01, 9); }
      if (beat === 0 || beat === 4) { vPluck(a, out, MN(ch[0] - 12), t, 0.5, st * 1.6); vKick(a, out, t); }
      if (beat === 2 || beat === 6) { ch.forEach(n => vPluck(a, lp, MN(n + 12), t, 0.05, st * 0.8, 'square')); vHit(a, out, t, 'highpass', 1500, 0.25, 0.12); }
      vHit(a, out, t, 'highpass', 7000, beat % 2 ? 0.05 : 0.08, 0.04); };
  } },
  // 自家蚵寮：慢板、木吉他分解和弦 + 口琴，居家
  home: { bpm: 76, make: (a, out) => {
    const ch = [[48, 55, 60, 64], [45, 52, 57, 60], [41, 48, 53, 57], [43, 50, 55, 59]]; // C Am F G
    const mel = [72, 0, 0, 74, 76, 0, 0, 0, 72, 0, 69, 0, 72, 0, 0, 0, 69, 0, 0, 72, 74, 0, 72, 0, 67, 0, 0, 0, 0, 0, 0, 0,
                 76, 0, 0, 79, 81, 0, 79, 0, 76, 0, 74, 0, 72, 0, 0, 0, 74, 0, 0, 76, 74, 0, 72, 0, 71, 0, 0, 74, 72, 0, 0, 0];
    const hp = a.createBiquadFilter(); hp.type = 'bandpass'; hp.frequency.value = 1400; hp.Q.value = 0.7; hp.connect(out);
    const arp = [0, 1, 2, 3, 2, 1, 2, 3];
    return (s, t, st) => { const i = s % 64, c = ch[Math.floor(i / 8) % 4], b = i % 8;
      if (b === 0) vPluck(a, out, MN(c[0] - 12), t, 0.28, st * 3);
      vPluck(a, out, MN(c[arp[b]]), t + (b % 2 ? 0.012 : 0), 0.13, st * 2.4);
      const m = mel[i]; if (m) { let d = 1; while (d < 4 && !mel[(i + d) % 64]) d++; vTone(a, hp, 'square', MN(m), t, st * d * 0.92, 0.035, 0.05, 16, 4.5); vTone(a, hp, 'sawtooth', MN(m) * 1.003, t, st * d * 0.92, 0.02, 0.05, 16, 4.5); }
      if (b === 4) vHit(a, out, t, 'highpass', 5000, 0.025, 0.05); };
  } },
  // 王功漁港：中板、浪聲節奏 + 汽笛、木琴般的旋律（D 多利安）
  wanggong: { bpm: 104, make: (a, out) => {
    const mel = [62, 0, 65, 67, 69, 0, 67, 65, 64, 0, 62, 0, 60, 0, 62, 0, 69, 0, 72, 69, 67, 0, 65, 67, 69, 0, 0, 0, 0, 0, 0, 0];
    const roots = [38, 38, 36, 36, 34, 34, 36, 36];
    return (s, t, st) => { const i = s % 64, b = i % 8, r = roots[Math.floor(i / 8)];
      if (b === 0) { vHit(a, out, t, 'lowpass', 500, 0.22, st * 6, 0.5); vPluck(a, out, MN(r), t, 0.45, st * 3); }
      if (b === 3 || b === 6) { vHit(a, out, t, 'bandpass', 900, 0.07, st * 2, 0.6); vPluck(a, out, MN(r + 7), t, 0.2, st * 1.5); }
      if (b === 4) vKick(a, out, t, 0.35, 100, 40, 0.25);
      const m = mel[i % 32]; if (m && i < 56) { vPluck(a, out, MN(m + 12), t, 0.12, st * 2.2, 'sine'); vPluck(a, out, MN(m + 24), t, 0.03, st * 0.8, 'sine'); }
      if (s % 128 === 56) vHorn(a, out, t, 1.6, 0.12); if (s % 128 === 60) vHorn(a, out, t, 0.6, 0.1); };
  } },
  // 東石漁人碼頭：輕快觀光風、手風琴主旋律 + 碰恰伴奏
  dongshi: { bpm: 136, make: (a, out) => {
    const mel = [72, 74, 76, 0, 79, 0, 76, 74, 72, 0, 74, 76, 74, 0, 0, 0, 71, 72, 74, 0, 77, 0, 74, 72, 71, 0, 72, 74, 72, 0, 0, 0,
                 76, 77, 79, 0, 84, 0, 79, 77, 76, 0, 77, 79, 81, 0, 79, 0, 77, 76, 74, 0, 79, 0, 74, 71, 72, 0, 0, 0, 72, 0, 0, 0];
    const ch = [[48, 52, 55], [48, 52, 55], [43, 47, 50], [43, 47, 50], [48, 52, 55], [41, 45, 48], [43, 47, 50], [48, 52, 55]];
    const acc = a.createBiquadFilter(); acc.type = 'lowpass'; acc.frequency.value = 2400; const tg = a.createGain(); tg.gain.value = 0.8; lfo(a, 6, 0.2, tg.gain); acc.connect(tg).connect(out);
    return (s, t, st) => { const i = s % 64, b = i % 4, c = ch[Math.floor(i / 8)];
      if (b === 0) { vPluck(a, out, MN(c[0] - 12), t, 0.45, st * 1.4); vKick(a, out, t, 0.5); }
      if (b === 2) { c.forEach(n => vPluck(a, acc, MN(n + 12), t, 0.04, st * 0.9, 'sawtooth')); vHit(a, out, t, 'highpass', 6000, 0.06, 0.05); }
      const m = mel[i]; if (m) { const d = st * (mel[(i + 1) % 64] ? 0.9 : 1.8); vTone(a, acc, 'sawtooth', MN(m), t, d, 0.045, 0.015); vTone(a, acc, 'sawtooth', MN(m) * 1.006, t, d, 0.04, 0.015); vTone(a, acc, 'square', MN(m - 12), t, d, 0.02, 0.015); } };
  } },
  // 布袋蚵寮大廠：快、機械工廠節拍（金屬敲擊、蒸氣聲）、趕工感
  budai: { bpm: 152, make: (a, out) => {
    const riff = [45, 45, 57, 45, 48, 45, 55, 45, 45, 45, 57, 45, 50, 48, 47, 43];
    const lead = [69, 0, 72, 0, 71, 0, 69, 0, 76, 0, 74, 72, 71, 0, 0, 0];
    return (s, t, st) => { const i = s % 64, b = i % 4;
      if (b === 0) vKick(a, out, t, 0.65, 120, 40, 0.15);
      if (b === 2) { vHit(a, out, t, 'bandpass', 2400, 0.16, 0.07, 6); vPluck(a, out, 1870, t, 0.03, 0.06, 'square'); }
      if (i % 8 === 7) vPluck(a, out, 2630, t, 0.035, 0.1, 'square');
      vPluck(a, out, MN(riff[i % 16] - 12), t, 0.2, st * 0.7, 'sawtooth');
      vHit(a, out, t, 'highpass', 8000, i % 2 ? 0.03 : 0.05, 0.03);
      if (i % 32 === 30) vHit(a, out, t, 'highpass', 3000, 0.08, st * 3);
      if (s % 128 >= 64) { const m = lead[i % 16]; if (m) vTone(a, out, 'square', MN(m), t, st * 0.9, 0.03, 0.005); } };
  } },
  // 活動場景：鑼鼓陣頭（大鼓、鈸、鑼）+ 嗩吶般的主旋律，150 BPM 熱鬧緊湊
  event: { bpm: 150, make: (a, out) => {
    const sn = a.createBiquadFilter(); sn.type = 'bandpass'; sn.frequency.value = 1300; sn.Q.value = 1.4; const sg = a.createGain(); sg.gain.value = 2.2; sn.connect(sg).connect(out);
    const mel = [79, 81, 79, 76, 74, 76, 79, 0, 81, 84, 81, 79, 76, 0, 79, 0, 74, 76, 79, 76, 74, 72, 69, 0, 72, 74, 76, 74, 72, 0, 72, 0];
    const drum = [1, 0, 1, 1, 1, 0, 1, 0, 1, 0, 1, 1, 1, 1, 1, 0];
    return (s, t, st) => { const i = s % 64, b = i % 16;
      if (drum[b]) vKick(a, out, t, b % 4 === 0 ? 0.8 : 0.45, 110, 55, 0.22);
      if (b % 4 === 2) vHit(a, out, t, 'highpass', 4500, 0.2, st * 1.6);
      if (b === 0 && i % 32 === 0) vGong(a, out, t, 98, 0.35, 2.2);
      if (b === 8) vGong(a, out, t, 440, 0.12, 0.5);
      vPluck(a, out, 1250, t, 0.04, 0.03, 'square');
      if (s % 128 >= 16) { const m = mel[i % 32]; if (m) vTone(a, sn, 'sawtooth', MN(m), t, st * (mel[(i + 1) % 32] ? 0.92 : 1.8), 0.05, 0.01, 22, 6.5); } };
  } },
  // 收音機：懷舊歌謠台（原本的收音機曲，A 小調五聲三拍子）
  r_old: { bpm: 84, make: (a, out) => {
    const mel = [69, 0, 72, 74, 0, 76, 74, 0, 72, 69, 0, 0, 67, 0, 69, 72, 0, 74, 69, 0, 0, 0, 0, 0,
                 76, 0, 79, 76, 0, 74, 72, 0, 74, 76, 0, 0, 74, 0, 72, 69, 0, 67, 69, 0, 0, 0, 0, 0,
                 72, 0, 74, 76, 0, 79, 81, 0, 79, 76, 0, 0, 74, 0, 76, 74, 0, 72, 69, 0, 72, 74, 0, 0,
                 76, 0, 74, 72, 0, 69, 67, 0, 69, 72, 0, 0, 69, 0, 67, 64, 0, 67, 69, 0, 0, 0, 0, 0];
    const roots = [45, 43, 41, 40, 45, 48, 43, 45];
    return (s, t, st) => { const i = s % 96, b = i % 6, root = roots[Math.floor(i / 12) % 8], m = mel[i];
      if (m) { let d = 1; while (d < 4 && !mel[(i + d) % 96]) d++; vTone(a, out, 'triangle', MN(m), t, st * d * 0.95, 0.11, 0.04, 14, 5); vTone(a, out, 'sine', MN(m) * 2, t, st * d * 0.95, 0.04, 0.04, 14, 5); }
      if (b === 0) vPluck(a, out, MN(root), t, 0.32, st * 1.8); else if (b === 2 || b === 4) { vPluck(a, out, MN(root + 12 + (b === 2 ? 3 : 7)), t, 0.09, st * 1.8); vPluck(a, out, MN(root + 19), t, 0.06, st * 1.8); } };
  } },
  // 收音機：廣播電台（主持人講話般的高低起伏咕噥聲 + 每段開頭的台呼小鈴聲）
  r_talk: { bpm: 120, make: (a, out) => {
    const fm = a.createBiquadFilter(); fm.type = 'bandpass'; fm.frequency.value = 900; fm.Q.value = 2.5; fm.connect(out);
    let pitch = 150;
    return (s, t, st) => { const i = s % 128;
      if (i < 6) { const j = [79, 0, 76, 0, 72, 84][i]; if (j) { vPluck(a, out, MN(j), t, 0.12, 0.7, 'sine'); vPluck(a, out, MN(j + 12), t, 0.03, 0.4, 'sine'); } return; }
      if (i < 10 || (i % 32 > 27)) return; // 換氣停頓
      if (Math.random() < 0.18) return;
      pitch = Math.max(110, Math.min(220, pitch + (Math.random() - 0.5) * 40)); const d = st * (0.6 + Math.random() * 0.9);
      const o = a.createOscillator(), g = a.createGain(); o.type = 'sawtooth'; o.frequency.setValueAtTime(pitch, t); o.frequency.linearRampToValueAtTime(pitch * (0.85 + Math.random() * 0.3), t + d);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.09, t + 0.03); g.gain.linearRampToValueAtTime(0, t + d); o.connect(g).connect(fm); o.start(t); o.stop(t + d + 0.02);
      fm.frequency.setValueAtTime(600 + Math.random() * 900, t); };
  } },
  // 收音機：台語老歌（慢板 3/4 演歌風，寬顫音的主旋律 + 吉他）
  r_taigi: { bpm: 66, make: (a, out) => {
    const mel = [64, 0, 0, 69, 0, 71, 72, 0, 0, 0, 71, 69, 71, 0, 0, 72, 71, 69, 64, 0, 0, 0, 0, 0,
                 69, 0, 0, 72, 0, 74, 76, 0, 0, 77, 76, 74, 76, 0, 0, 72, 0, 71, 69, 0, 0, 0, 0, 0];
    const roots = [45, 45, 40, 40, 45, 41, 40, 45];
    return (s, t, st) => { const i = s % 48, b = i % 6, r = roots[Math.floor(i / 6) % 8], m = mel[i];
      if (m) { let d = 1; while (d < 6 && !mel[(i + d) % 48]) d++; vTone(a, out, 'triangle', MN(m), t, st * d * 0.96, 0.12, 0.06, 28, 5.5); vTone(a, out, 'square', MN(m), t, st * d * 0.96, 0.015, 0.06, 28, 5.5); }
      if (b === 0) vPluck(a, out, MN(r - 12), t, 0.3, st * 2.5); else if (b === 2 || b === 4) [r + 3, r + 7].forEach(n => vPluck(a, out, MN(n), t, 0.07, st * 1.5)); };
  } },
};
export const STATIONS = [{ id: 'r_old', n: '懷舊歌謠台' }, { id: 'r_talk', n: '廣播電台' }, { id: 'r_taigi', n: '台語老歌' }];
type Live = { key: string; g: GainNode; fn: Player; st: number; step: number; next: number; dead: number };
let live: Live[] = [], curTrack = '', radioBus: GainNode | null = null, radioNoise: GainNode | null = null;
function setupRadioBus(a: AudioContext) {
  // AM 收音機味：高通 + 輕微失真 + 低通 + 沙沙聲
  const hp = a.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 380;
  const lp = a.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2600; lp.Q.value = 1.2;
  const ws = a.createWaveShaper(); const cv = new Float32Array(256); for (let i = 0; i < 256; i++) { const x = i / 128 - 1; cv[i] = Math.tanh(x * 2.2) / Math.tanh(2.2); } ws.curve = cv;
  radioBus = a.createGain(); radioBus.gain.value = 0.9; radioBus.connect(hp).connect(ws).connect(lp).connect(musG);
  const sb = a.createBuffer(1, a.sampleRate * 2, a.sampleRate), sd = sb.getChannelData(0); for (let i = 0; i < sd.length; i++) sd[i] = (Math.random() * 2 - 1) * (Math.random() < 0.002 ? 1 : 0.35);
  const sn = a.createBufferSource(); sn.buffer = sb; sn.loop = true; const sf = a.createBiquadFilter(); sf.type = 'bandpass'; sf.frequency.value = 1800; sf.Q.value = 0.6;
  radioNoise = a.createGain(); radioNoise.gain.value = 0; const sg = a.createGain(); sg.gain.value = 0.035; lfo(a, 0.23, 0.015, sg.gain);
  sn.connect(sf).connect(sg).connect(radioNoise).connect(musG); sn.start();
}
function pickTrack(): string { return D().pickTrack(); }
function musicTick(a: AudioContext) {
  const k = pickTrack(), now = a.currentTime;
  if (k !== curTrack) {
    curTrack = k;
    for (const l of live) if (!l.dead) { l.g.gain.cancelScheduledValues(now); l.g.gain.setValueAtTime(l.g.gain.value, now); l.g.gain.linearRampToValueAtTime(0, now + 0.8); l.dead = now + 0.9; }
    const tr = TRACKS[k], g = a.createGain(), isR = k.startsWith('r_');
    g.gain.setValueAtTime(0, now); g.gain.linearRampToValueAtTime(1, now + 0.8); g.connect(isR ? radioBus! : musG);
    live.push({ key: k, g, fn: tr.make(a, g), st: 60 / tr.bpm / 2, step: 0, next: now + 0.05, dead: 0 });
    if (radioNoise) { radioNoise.gain.cancelScheduledValues(now); radioNoise.gain.setValueAtTime(radioNoise.gain.value, now); radioNoise.gain.linearRampToValueAtTime(isR ? 1 : 0, now + 0.5); }
  }
  live = live.filter(l => { if (l.dead && now > l.dead) { setTimeout(() => l.g.disconnect(), 3000); return false; } return true; });
  for (const l of live) {
    if (l.next < now - 0.5) l.next = now + 0.05; // 從背景回來／卡頓後不要一次補一大堆音
    while (l.next < now + 0.25) { if (!l.dead || l.next < l.dead) l.fn(l.step, l.next, l.st); l.next += l.st; l.step++; }
  }
}
function startMusic(a: AudioContext) {
  setupRadioBus(a); musicTick(a);
  setInterval(() => { if (!document.hidden && a.state === 'running') musicTick(a); }, 60);
}
document.addEventListener('visibilitychange', () => { if (!ac) return; if (document.hidden) ac.suspend().catch(() => {}); else ac.resume().catch(() => {}); });
export function audio() {
  if (!ac) { ac = new AudioContext(); masterG = ac.createGain(); ambG = ac.createGain(); sfxG = ac.createGain(); musG = ac.createGain(); musG.connect(masterG); ambG.connect(masterG); sfxG.connect(masterG); masterG.connect(ac.destination); applyMix(); startAmbience(ac); startMusic(ac); }
  if (ac.state === 'suspended') ac.resume();
  return ac;
}
export function noise(dur: number, freq: number, vol: number, sweepTo = 0) {
  const a = audio(), n = Math.floor(a.sampleRate * dur), b = a.createBuffer(1, n, a.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 4);
  const s = a.createBufferSource(); s.buffer = b; const f = a.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = 0.8;
  if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, a.currentTime + dur);
  const g = a.createGain(); g.gain.value = vol; s.connect(f).connect(g).connect(sfxG); s.start();
}
export function tone(freq: number, dur: number, vol: number, type: OscillatorType = 'sine', delay = 0, glideTo = 0) {
  const a = audio(), o = a.createOscillator(), g = a.createGain(), t = a.currentTime + delay;
  o.type = type; o.frequency.setValueAtTime(freq, t); if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, t + dur);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(sfxG); o.start(t); o.stop(t + dur + 0.05);
}
export const SFX = {
  creak: () => tone(D().rnd(140, 200), 0.18, 0.08, 'sawtooth', 0, D().rnd(90, 120)),
  whoosh: () => noise(0.3, 400, 0.35, 2500),
  plop: () => { tone(420, 0.1, 0.2, 'sine', 0, 180); tone(700, 0.06, 0.08, 'triangle', 0.04); },
  splat: () => { noise(0.22, 300, 0.5); tone(90, 0.12, 0.15, 'sine'); },
  aia: () => { tone(520, 0.12, 0.15, 'square', 0, 700); tone(700, 0.25, 0.15, 'square', 0.12, 380); noise(0.08, 200, 0.4); },
  pinch: () => { noise(0.05, 3500, 0.5); tone(1200, 0.1, 0.1, 'square', 0.02, 800); },
  jingle: (up = true) => [0, 1, 2, 3].forEach(k => tone(up ? 660 * Math.pow(1.26, k) : 400 / Math.pow(1.2, k), 0.18, 0.12, 'triangle', k * 0.09)),
  sneak: () => { tone(300, 0.08, 0.05, 'sine'); tone(240, 0.08, 0.05, 'sine', 0.12); },
  sting: () => { tone(220, 0.35, 0.2, 'square', 0, 110); tone(233, 0.35, 0.15, 'sawtooth', 0.02, 116); },
  hitNpc: () => { noise(0.08, 2500, 0.5); tone(160, 0.1, 0.2, 'sine'); },
  alert: () => { tone(880, 0.1, 0.12, 'square'); tone(660, 0.1, 0.12, 'square', 0.15); tone(880, 0.1, 0.12, 'square', 0.3); },
  boing: () => { tone(160, 0.45, 0.3, 'sine', 0, 420); tone(320, 0.3, 0.1, 'triangle', 0.05, 640); },
  pop: () => noise(0.05, 1500, 0.3),
  endJingle: (good: boolean) => (good ? [523, 659, 784, 1046] : [523, 494, 440, 392]).forEach((f, k) => tone(f, 0.3, 0.14, 'triangle', k * 0.16)),
  murmur: (pitch: number) => { const n = 3 + Math.floor(Math.random() * 4); for (let k = 0; k < n; k++) tone(pitch * D().rnd(0.85, 1.25), 0.07, 0.045, 'square', k * 0.09); },
};
export const crackSound = (big = true) => { noise(0.12, 2400, big ? 0.9 : 0.4); tone(180, 0.06, 0.3, 'triangle', 0.02); };
export const ding = (rare: number) => { const base = [1318, 1568, 1760, 2093][rare]; tone(base, 1.4, 0.25); tone(base * 1.5, 1.2, 0.12, 'sine', 0.12); if (rare >= 2) tone(base * 2, 1.5, 0.1, 'sine', 0.3); };
export const hasBgmTrack = (id: string) => !!TRACKS[id];
export const musDebug = () => ({ cur: curTrack, live: live.length, keys: live.map(l => l.key), ac: ac?.state ?? null });
