import * as THREE from 'three';

const FADE_SEC = 45;

const DAY = {
  bg: 0x88c0e4,
  fog: 0xc8dce8,
  hemi: 0xfff4ea,
  hemiI: 1.05,
  sunI: 1.15,
  zenith: 0x3a90c8,
  horizon: 0xe4f0f8,
  clouds: 0.56,
  fogNear: 18,
  fogFar: 52,
};

const NIGHT = {
  bg: 0x1a1440,
  fog: 0x161a32,
  hemi: 0xb8b0d8,
  hemiI: 0.42,
  sunI: 0.08,
  zenith: 0x120c28,
  horizon: 0x2a2450,
  clouds: 0.08,
  fogNear: 14,
  fogFar: 44,
};

const _bg = new THREE.Color();
const _fog = new THREE.Color();
const _hemi = new THREE.Color();
const _zen = new THREE.Color();
const _hor = new THREE.Color();
const _sunDir = new THREE.Vector3();

/** URL `?night=1`／`?night=0` 開發覆寫；沒有則為 null */
export function plazaNightOverride(): 0 | 1 | null {
  try {
    const v = new URLSearchParams(location.search).get('night');
    if (v === '1' || v === 'true') return 1;
    if (v === '0' || v === 'false') return 0;
  } catch { /* 非瀏覽器 */ }
  return null;
}

/** 台灣時間（Asia/Taipei）當日小時，不受裝置時區影響 */
export function taipeiHourFloat(): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Taipei',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hourCycle: 'h23',
  }).formatToParts(new Date());
  const n = (t: Intl.DateTimeFormatPartTypes) => Number(parts.find(p => p.type === t)?.value ?? 0);
  return n('hour') + n('minute') / 60 + n('second') / 3600;
}

function smooth01(t: number) {
  const x = Math.max(0, Math.min(1, t));
  return x * x * (3 - 2 * x);
}

/**
 * 目標夜晚強度：0 白天、1 夜晚。
 * 夜晚 18:00–06:00；黃昏 17:30–18:30、黎明 05:30–06:30 平滑過渡。
 */
export function plazaNightTarget(hour = taipeiHourFloat()): number {
  const ov = plazaNightOverride();
  if (ov != null) return ov;
  if (hour >= 5.5 && hour < 6.5) return smooth01(1 - (hour - 5.5));
  if (hour >= 6.5 && hour < 17.5) return 0;
  if (hour >= 17.5 && hour < 18.5) return smooth01(hour - 17.5);
  return 1;
}

let nightT = 0;
let inited = false;

export function peekPlazaNightT() { return nightT; }

/** 往目標值靠近；snap 則立刻對齊（進場／首幀）。淡入淡出約 45 秒。 */
export function tickPlazaNight(dt: number, snap = false): number {
  const target = plazaNightTarget();
  if (!inited || snap) {
    nightT = target;
    inited = true;
    return nightT;
  }
  const step = (1 / FADE_SEC) * Math.max(0, dt);
  if (target > nightT) nightT = Math.min(target, nightT + step);
  else if (target < nightT) nightT = Math.max(target, nightT - step);
  return nightT;
}

export type PlazaSkyHandles = {
  scene: THREE.Scene;
  hemi: THREE.HemisphereLight;
  sun: THREE.DirectionalLight;
  skyDome: {
    setColors: (zenith: number, horizon: number, nadir?: number) => void;
    setSun: (dir: THREE.Vector3, strength?: number) => void;
    setClouds: (amount: number) => void;
  };
  nightT: number;
  eco?: boolean;
};

/** 廣場專用日夜氣氛（絕對值），不疊加工寮 updSky，離開廣場後請再呼叫 updSky。 */
export function applyPlazaNightSky(h: PlazaSkyHandles) {
  const t = Math.max(0, Math.min(1, h.nightT));
  const s = 1 - t;
  _bg.setHex(DAY.bg).lerp(_fog.setHex(NIGHT.bg), t);
  if (h.scene.background instanceof THREE.Color) h.scene.background.copy(_bg);
  else h.scene.background = _bg.clone();
  const fog = h.scene.fog;
  if (fog && 'color' in fog) {
    (fog as THREE.Fog).color.setHex(DAY.fog).lerp(_fog.setHex(NIGHT.fog), t);
    if ('near' in fog && 'far' in fog) {
      (fog as THREE.Fog).near = DAY.fogNear * s + NIGHT.fogNear * t;
      (fog as THREE.Fog).far = DAY.fogFar * s + NIGHT.fogFar * t;
    }
  }
  h.hemi.color.setHex(DAY.hemi).lerp(_hemi.setHex(NIGHT.hemi), t);
  h.hemi.intensity = DAY.hemiI * s + NIGHT.hemiI * t;
  h.sun.intensity = DAY.sunI * s + NIGHT.sunI * t;
  _zen.setHex(DAY.zenith).lerp(_hor.setHex(NIGHT.zenith), t);
  const zenHex = _zen.getHex();
  _hor.setHex(DAY.horizon).lerp(_zen.setHex(NIGHT.horizon), t);
  const fogHex = (fog && 'color' in fog) ? (fog as THREE.Fog).color.getHex() : _bg.getHex();
  h.skyDome.setColors(zenHex, _hor.getHex(), fogHex);
  h.skyDome.setSun(_sunDir.copy(h.sun.position).normalize(), Math.min(1.15, h.sun.intensity / 1.15));
  h.skyDome.setClouds(h.eco ? 0 : DAY.clouds * s + NIGHT.clouds * t);
}
