/**
 * 頭上「釣魚中／拉魚中！／釣到了！」狀態牌：實底圓角膠囊＋線條釣竿圖示（不用模糊、不用 emoji）。
 * 三種牌各畫一次、全場共用一份貼圖與材質（多人在釣也不會多耗）。
 */
import * as THREE from 'three';
import { FISH_BADGE_TEXT } from './fishSync';

/** 牌子世界高度（公尺）；名牌約 0.26 */
export const FISH_BADGE_H = 0.22;
const FILL = ['', '#2a5a86', '#c4512a', '#2f7a4e'];
const cache: ({ mat: THREE.SpriteMaterial; aspect: number } | null)[] = [null, null, null, null];

function draw(kind: 1 | 2 | 3) {
  const dpr = Math.min(2, typeof devicePixelRatio === 'number' ? devicePixelRatio : 1);
  const text = FISH_BADGE_TEXT[kind];
  const fontPx = 26, padX = 14, iconW = 30, h = 44;
  const cv = document.createElement('canvas');
  const c0 = cv.getContext('2d')!;
  c0.font = `800 ${fontPx}px "Segoe UI","PingFang TC","Noto Sans TC","Microsoft JhengHei",sans-serif`;
  const w = Math.ceil(c0.measureText(text).width + iconW + padX * 2 + 4);
  cv.width = Math.ceil(w * dpr); cv.height = Math.ceil(h * dpr);
  const ctx = cv.getContext('2d')!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const r = h / 2 - 1;
  ctx.beginPath();
  ctx.moveTo(1 + r, 1); ctx.lineTo(w - 1 - r, 1); ctx.arc(w - 1 - r, h / 2, r, -Math.PI / 2, Math.PI / 2);
  ctx.lineTo(1 + r, h - 1); ctx.arc(1 + r, h / 2, r, Math.PI / 2, Math.PI * 1.5); ctx.closePath();
  ctx.fillStyle = FILL[kind]; ctx.fill();
  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2.4; ctx.stroke();
  // 線條圖示：斜斜的釣竿＋垂下的線＋鉤子
  const ix = padX + 2, iy = 9;
  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2.4; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(ix, iy + 26); ctx.lineTo(ix + 20, iy); ctx.stroke();
  ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.moveTo(ix + 20, iy); ctx.lineTo(ix + 22, iy + 16); ctx.stroke();
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(ix + 19.5, iy + 18, 2.6, 0, Math.PI); ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
  ctx.font = `800 ${fontPx}px "Segoe UI","PingFang TC","Noto Sans TC","Microsoft JhengHei",sans-serif`;
  ctx.fillText(text, padX + iconW, h / 2 + 1);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace; tex.minFilter = THREE.LinearFilter; tex.magFilter = THREE.LinearFilter; tex.generateMipmaps = false;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: true, depthWrite: false, sizeAttenuation: true, toneMapped: false });
  return { mat, aspect: w / h };
}

/** 共用材質（第一次用到才畫） */
export function fishBadgeLook(kind: 1 | 2 | 3) {
  return (cache[kind] ??= draw(kind));
}
/** 新的一面牌（掛在名牌上方）；材質共用，拆掉時只要 removeFromParent，不要 dispose 材質 */
export function makeFishBadge(kind: 1 | 2 | 3) {
  const s = new THREE.Sprite(fishBadgeLook(kind).mat);
  s.center.set(0.5, 0);
  s.renderOrder = 30;
  setFishBadge(s, kind);
  return s;
}
export function setFishBadge(s: THREE.Sprite, kind: 1 | 2 | 3) {
  const L = fishBadgeLook(kind);
  if (s.material !== L.mat) s.material = L.mat;
  s.scale.set(FISH_BADGE_H * L.aspect, FISH_BADGE_H, 1);
  s.userData.fishBadge = kind;
}
