// 廣場南牆生涯排行跑馬燈（各項 TOP3）
import * as THREE from 'three';
import { WALK_BOUND, CAFE_SOUTH_WALL_END } from './layout';
import { fetchCareerTop3 } from '../meta/social';

const REFRESH_SEC = 180;
const SCROLL_PX_PER_SEC = 90;
const GAP_PX = 96;

export type CareerMarquee = {
  group: THREE.Group;
  tick: (dt: number) => void;
  dispose: () => void;
};

export function makeCareerMarquee(lowDetail: boolean): CareerMarquee {
  const group = new THREE.Group();
  group.name = 'careerMarquee';
  group.userData.noMerge = true;

  const wallA0 = -21.4 / 2;
  const wallA1 = CAFE_SOUTH_WALL_END;
  const midX = (wallA0 + wallA1) * 0.5;
  const boardW = Math.min(11.2, wallA1 - wallA0 - 1.4);
  const boardH = 0.72;
  const y = 3.15;
  const zFace = WALK_BOUND - 0.05;

  const frameMat = new THREE.MeshStandardMaterial({
    color: 0x1c1c20,
    metalness: 0.55,
    roughness: 0.48,
  });
  const frameGeo = new THREE.BoxGeometry(boardW + 0.14, boardH + 0.14, 0.07);
  const frame = new THREE.Mesh(frameGeo, frameMat);
  frame.position.set(midX, y, zFace + 0.03);
  frame.castShadow = false;
  frame.receiveShadow = false;
  group.add(frame);

  // 兩側掛架
  const bracketMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2e, metalness: 0.5, roughness: 0.55 });
  const bracketGeo = new THREE.BoxGeometry(0.08, 0.36, 0.1);
  for (const sx of [-boardW * 0.42, boardW * 0.42]) {
    const b = new THREE.Mesh(bracketGeo, bracketMat);
    b.position.set(midX + sx, y + boardH * 0.55, zFace + 0.02);
    group.add(b);
  }

  const cw = lowDetail ? 1280 : 2048;
  const ch = lowDetail ? 96 : 128;
  const canvas = document.createElement('canvas');
  canvas.width = cw;
  canvas.height = ch;
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;

  const screenMat = new THREE.MeshBasicMaterial({
    map: tex,
    toneMapped: false,
    transparent: false,
  });
  const screenGeo = new THREE.PlaneGeometry(boardW, boardH);
  const screen = new THREE.Mesh(screenGeo, screenMat);
  screen.position.set(midX, y, zFace);
  screen.rotation.y = Math.PI; // 面向廣場內側（-Z）
  group.add(screen);

  let disposed = false;
  let scroll = 0;
  let text = '　　生涯排行讀取中…　　';
  let textW = 0;
  let paintAcc = 0;
  let refreshAcc = REFRESH_SEC; // 進場立刻拉
  let fetching = false;

  function measureAndPaint() {
    if (disposed) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const labelW = Math.floor(cw * 0.14);
    const fontPx = Math.floor(ch * 0.52);
    ctx.font = `bold ${fontPx}px "Segoe UI","Microsoft JhengHei","PingFang TC",sans-serif`;
    textW = Math.max(ctx.measureText(text).width, 1);

    ctx.fillStyle = '#070e06';
    ctx.fillRect(0, 0, cw, ch);
    // 細橫線模擬 LED 掃描
    ctx.fillStyle = '#0a1408';
    for (let row = 0; row < ch; row += 3) ctx.fillRect(0, row, cw, 1);

    ctx.save();
    ctx.beginPath();
    ctx.rect(labelW, 0, cw - labelW, ch);
    ctx.clip();
    const loop = textW + GAP_PX;
    const x0 = labelW - (scroll % loop);
    ctx.fillStyle = '#6dff5c';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = '#2a8a22';
    ctx.shadowBlur = lowDetail ? 0 : 6;
    ctx.fillText(text, x0, ch * 0.52);
    ctx.fillText(text, x0 + loop, ch * 0.52);
    ctx.restore();

    // 左側固定標題
    ctx.fillStyle = '#0c180a';
    ctx.fillRect(0, 0, labelW, ch);
    ctx.strokeStyle = '#2a5a22';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(labelW - 1, 4);
    ctx.lineTo(labelW - 1, ch - 4);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#b8ff9a';
    ctx.font = `bold ${Math.floor(ch * 0.36)}px "Segoe UI","Microsoft JhengHei","PingFang TC",sans-serif`;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    ctx.fillText('生涯', labelW * 0.5, ch * 0.38);
    ctx.fillText('TOP3', labelW * 0.5, ch * 0.68);
    ctx.textAlign = 'left';

    tex.needsUpdate = true;
  }

  async function refresh() {
    if (disposed || fetching) return;
    fetching = true;
    try {
      const lines = await fetchCareerTop3();
      if (disposed) return;
      if (lines.length) text = `　　${lines.join('　　｜　　')}　　`;
      else if (!text.includes('讀取中')) { /* 保留舊文 */ }
      else text = '　　生涯排行暫時連不上　　';
      measureAndPaint();
    } finally {
      fetching = false;
    }
  }

  measureAndPaint();

  return {
    group,
    tick(dt: number) {
      if (disposed) return;
      refreshAcc += dt;
      if (refreshAcc >= REFRESH_SEC) {
        refreshAcc = 0;
        void refresh();
      }
      scroll += dt * SCROLL_PX_PER_SEC * (cw / 1024);
      paintAcc += dt;
      if (paintAcc < (lowDetail ? 1 / 18 : 1 / 28)) return;
      paintAcc = 0;
      measureAndPaint();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      group.parent?.remove(group);
      tex.dispose();
      screenMat.dispose();
      frameMat.dispose();
      bracketMat.dispose();
      frameGeo.dispose();
      bracketGeo.dispose();
      screenGeo.dispose();
    },
  };
}
