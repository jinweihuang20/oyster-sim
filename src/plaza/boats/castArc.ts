/**
 * 拋竿弧線（純數學、不配置）：
 * - 線頭（浮標／假魚）從竿尖放手點用「真的拋體」飛到落點：垂直＝等重力拋物線（頂點高度跟拋多遠成比例），
 *   水平＝有一點空氣阻力（出手快、後段慢下來），所以弧頂偏後、落水比較陡，像真的甩出去。
 * - 釣線：從竿尖到線頭用多段平滑曲線，飛行中沿著線頭剛飛過的路徑拖出一道弧（加一點自然下垂），
 *   落水後慢慢鬆成靜止時的懸垂弧（中段不沉進水裡）。
 */
export type V3 = { x: number; y: number; z: number };

/** 竿子往前甩（CAST_FLICK 0.32 秒）甩到這裡才放手：竿尖剛好往前彈、線頭跟著出去 */
export const CAST_RELEASE_S = 0.19;
/** 落水後線從飛行弧鬆成靜止懸垂的時間 */
export const CAST_SETTLE_S = 0.65;
/** 釣線分幾段（自己畫面；一條 Line、不多 draw call） */
export const CAST_LINE_SEGS = 20;
/** 水平空氣阻力（越大出手越快、後段越慢） */
const DRAG = 1.2;
const DRAG_N = 1 - Math.exp(-DRAG);

const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const fin = (v: number, d = 0) => (Number.isFinite(v) ? v : d);

/** 飛行時間（秒）：近拋快、遠拋飄久一點（4 m≈0.64 秒、24 m≈1.1 秒、上限 1.45 秒） */
export function castFlyDur(dist: number) { return clamp(0.52 + 0.025 * Math.max(0, fin(dist)), 0.55, 1.45); }
/** 弧頂比竿尖／落點中較高的那個再高多少（m） */
export function castApex(dist: number) { return clamp(0.8 + 0.14 * Math.max(0, fin(dist)), 1.1, 4.8); }
/** 有阻力的水平進度：0→0、1→1，出手快、後段慢（單調） */
export function castDragS(u: number) { u = clamp(u, 0, 1); return (1 - Math.exp(-DRAG * u)) / DRAG_N; }

/**
 * 線頭在 k（0～1，放手→落水）時的位置：k＝0 在放手點、k＝1 剛好在落點水面 wy。
 * y(k)＝y0＋b·k−g·k²（等重力），頂點＝較高端點＋castApex(水平距離)。直接改 out。
 */
export function castFlyPoint(tx: number, ty: number, tz: number, ex: number, wy: number, ez: number, k: number, out: V3) {
  k = clamp(fin(k), 0, 1);
  const d = Math.hypot(ex - tx, ez - tz);
  const D = wy - ty, P = Math.max(ty, wy) + castApex(d) - ty; // P > max(0, D)
  const g = 2 * P - D + 2 * Math.sqrt(Math.max(0, P * (P - D)));
  const b = g + D;
  const s = castDragS(k);
  out.x = tx + (ex - tx) * s; out.y = ty + b * k - g * k * k; out.z = tz + (ez - tz) * s;
  if (k >= 1) { out.x = ex; out.y = wy; out.z = ez; }
  return out;
}

export type CastLineOpt = {
  /** 線頭飛行進度 0～1（castFlyPoint 的 k） */
  k: number;
  /** 落水後鬆線進度 0～1（0＝還是飛行弧、1＝靜止懸垂） */
  settle: number;
  /** 靜止時中段往下垂多少 m（拉緊＝小） */
  sag: number;
  /** 水面高度：靜止懸垂的中段不會沉到這以下 */
  wy: number;
};
const _p = { x: 0, y: 0, z: 0 }, _fe = { x: 0, y: 0, z: 0 };
const smooth = (v: number) => { v = clamp(v, 0, 1); return v * v * (3 - 2 * v); };

/**
 * 寫釣線的 segs+1 個點到 out（xyz 連續）：第 0 點＝竿尖 tip、最後一點＝線頭。
 * 飛行中（settle＜1）線頭＝castFlyPoint(rel→land, k)；靜止（settle≥1）線頭＝end。
 * rel＝放手點（竿尖放手那一刻的位置）、land＝落點（水面）。
 */
export function castLine(out: Float32Array, segs: number, tip: V3, rel: V3, land: V3, end: V3, o: CastLineOpt) {
  const st = smooth(fin(o.settle, 1));
  const k = clamp(fin(o.k, 1), 0, 1);
  const wy = fin(o.wy), sag = Math.max(0, fin(o.sag));
  const ax = tip.x - rel.x, ay = tip.y - rel.y, az = tip.z - rel.z;
  let flen = 0;
  if (st < 1) {
    castFlyPoint(rel.x, rel.y, rel.z, land.x, wy, land.z, k, _fe);
    flen = Math.hypot(_fe.x - tip.x, _fe.y - tip.y, _fe.z - tip.z);
  }
  const fSag = 0.05 * flen * k; // 飛行中線被風／重力往下壓一點，越飛越明顯
  const ex = st > 0 ? end.x : 0, ey = st > 0 ? end.y : 0, ez = st > 0 ? end.z : 0;
  for (let i = 0; i <= segs; i++) {
    const s = i / segs, bell = 4 * s * (1 - s);
    let x = 0, y = 0, z = 0;
    if (st < 1) {
      // 沿線頭飛過的路徑（尾端接回會動的竿尖），再跟直線混一點，拖出柔和的甩出弧
      castFlyPoint(rel.x, rel.y, rel.z, land.x, wy, land.z, k * s, _p);
      const w = (1 - s) * (1 - s);
      const px = _p.x + ax * w, py = _p.y + ay * w, pz = _p.z + az * w;
      const cx = tip.x + (_fe.x - tip.x) * s, cy = tip.y + (_fe.y - tip.y) * s, cz = tip.z + (_fe.z - tip.z) * s;
      x = cx + (px - cx) * 0.72; y = cy + (py - cy) * 0.72 - fSag * bell; z = cz + (pz - cz) * 0.72;
    }
    if (st > 0) {
      // 靜止懸垂：竿尖到線頭的弦往下垂，中段最多貼到水面
      const cy = tip.y + (ey - tip.y) * s;
      let ry = cy - sag * bell;
      const floor = Math.min(wy, cy);
      if (ry < floor) ry = floor;
      const rx = tip.x + (ex - tip.x) * s, rz = tip.z + (ez - tip.z) * s;
      x += (rx - x) * st; y += (ry - y) * st; z += (rz - z) * st;
    }
    const j = i * 3;
    out[j] = fin(x, tip.x); out[j + 1] = fin(y, tip.y); out[j + 2] = fin(z, tip.z);
  }
  return out;
}
