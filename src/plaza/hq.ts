import * as THREE from 'three';
import type { MatFn } from '../dm/weapons';
import { rboxEnv, rcyl } from '../core/geo';
import { HQ_BUILDING, HQ_PROPS, SEAFOOD_BUILDING } from './layout';

type AddFn = (
  geo: THREE.BufferGeometry,
  mat: THREE.Material,
  pos: [number, number, number],
  parent: THREE.Object3D,
  cast?: boolean,
) => THREE.Mesh;

function canvasTex(w: number, h: number, draw: (c: CanvasRenderingContext2D) => void) {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  draw(cv.getContext('2d')!);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  t.needsUpdate = true;
  return t;
}

const FONT = '"Noto Sans TC","Microsoft JhengHei","PingFang TC",system-ui,sans-serif';
const GREEN_DARK = '#17603a';
const GREEN_MID = '#2f8a45';
const GREEN_LIME = '#8cc63f';

/** 簡單蚵殼輪廓（不規則波浪邊） */
function shellPath(c: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number, seed: number) {
  c.beginPath();
  const n = 40;
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    const k = 1 + 0.06 * Math.sin(a * 7 + seed) + 0.03 * Math.sin(a * 13 + seed * 2);
    const x = cx + Math.cos(a) * rx * k, y = cy + Math.sin(a) * ry * k;
    if (i === 0) c.moveTo(x, y); else c.lineTo(x, y);
  }
  c.closePath();
}

/** 圓形蚵殼標誌（虛構，非任何政黨標誌） */
function drawEmblem(c: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  c.fillStyle = '#ffffff';
  c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2); c.fill();
  c.strokeStyle = GREEN_DARK;
  c.lineWidth = r * 0.12;
  c.beginPath(); c.arc(cx, cy, r * 0.86, 0, Math.PI * 2); c.stroke();
  c.fillStyle = '#9a9384';
  shellPath(c, cx, cy + r * 0.05, r * 0.58, r * 0.46, 1.3);
  c.fill();
  c.fillStyle = '#efe9dc';
  c.beginPath(); c.ellipse(cx, cy + r * 0.08, r * 0.32, r * 0.24, 0, 0, Math.PI * 2); c.fill();
  c.strokeStyle = '#6f6a60';
  c.lineWidth = Math.max(1, r * 0.05);
  for (const a of [-0.5, 0, 0.5]) {
    c.beginPath();
    c.moveTo(cx + Math.sin(a) * r * 0.36, cy - Math.cos(a) * r * 0.3);
    c.lineTo(cx + Math.sin(a) * r * 0.55, cy - Math.cos(a) * r * 0.42);
    c.stroke();
  }
}

/** 卡通蚵仔候選人：蚵殼臉＋西裝領＋握拳（非真人） */
function drawMascot(c: CanvasRenderingContext2D, cx: number, cy: number, s: number, opt: { glasses: boolean; tie: string; seed: number }) {
  // 西裝肩膀
  c.fillStyle = '#26334a';
  c.beginPath();
  c.moveTo(cx - s * 1.15, cy + s * 2.2);
  c.quadraticCurveTo(cx - s * 1.1, cy + s * 0.95, cx - s * 0.35, cy + s * 0.8);
  c.lineTo(cx + s * 0.35, cy + s * 0.8);
  c.quadraticCurveTo(cx + s * 1.1, cy + s * 0.95, cx + s * 1.15, cy + s * 2.2);
  c.closePath();
  c.fill();
  // 白襯衫 V 領＋領帶
  c.fillStyle = '#f4f4f0';
  c.beginPath();
  c.moveTo(cx - s * 0.34, cy + s * 0.8);
  c.lineTo(cx + s * 0.34, cy + s * 0.8);
  c.lineTo(cx, cy + s * 1.7);
  c.closePath();
  c.fill();
  c.fillStyle = opt.tie;
  c.beginPath();
  c.moveTo(cx - s * 0.08, cy + s * 0.86);
  c.lineTo(cx + s * 0.08, cy + s * 0.86);
  c.lineTo(cx + s * 0.12, cy + s * 1.5);
  c.lineTo(cx, cy + s * 1.66);
  c.lineTo(cx - s * 0.12, cy + s * 1.5);
  c.closePath();
  c.fill();
  // 蚵殼頭
  c.fillStyle = '#a8a091';
  shellPath(c, cx, cy, s * 0.95, s * 0.85, opt.seed);
  c.fill();
  c.strokeStyle = '#6f6a60';
  c.lineWidth = Math.max(1.5, s * 0.05);
  c.stroke();
  // 殼紋
  c.lineWidth = Math.max(1, s * 0.03);
  for (let i = 0; i < 5; i++) {
    const a = -2.4 + i * 0.35;
    c.beginPath();
    c.moveTo(cx + Math.cos(a) * s * 0.7, cy + Math.sin(a) * s * 0.62);
    c.lineTo(cx + Math.cos(a) * s * 0.9, cy + Math.sin(a) * s * 0.8);
    c.stroke();
  }
  // 蚵肉臉
  c.fillStyle = '#f1ebdd';
  c.beginPath(); c.ellipse(cx, cy + s * 0.08, s * 0.62, s * 0.52, 0, 0, Math.PI * 2); c.fill();
  // 眼、腮紅、笑
  c.fillStyle = '#2b2f33';
  for (const dx of [-0.24, 0.24]) { c.beginPath(); c.arc(cx + dx * s, cy, s * 0.07, 0, Math.PI * 2); c.fill(); }
  c.fillStyle = 'rgba(230,120,120,0.55)';
  for (const dx of [-0.4, 0.4]) { c.beginPath(); c.ellipse(cx + dx * s, cy + s * 0.18, s * 0.09, s * 0.05, 0, 0, Math.PI * 2); c.fill(); }
  c.strokeStyle = '#2b2f33';
  c.lineWidth = Math.max(1.5, s * 0.05);
  c.beginPath(); c.arc(cx, cy + s * 0.14, s * 0.2, 0.2, Math.PI - 0.2); c.stroke();
  if (opt.glasses) {
    c.lineWidth = Math.max(1.5, s * 0.04);
    for (const dx of [-0.24, 0.24]) { c.beginPath(); c.arc(cx + dx * s, cy, s * 0.15, 0, Math.PI * 2); c.stroke(); }
    c.beginPath(); c.moveTo(cx - s * 0.09, cy); c.lineTo(cx + s * 0.09, cy); c.stroke();
  }
  // 握拳（舉在胸前）
  const fx = cx - s * 0.7, fy = cy + s * 1.25;
  c.fillStyle = '#26334a';
  c.fillRect(fx - s * 0.16, fy + s * 0.15, s * 0.32, s * 0.8);
  c.fillStyle = '#c9c1b0';
  c.beginPath(); c.ellipse(fx, fy, s * 0.24, s * 0.22, 0, 0, Math.PI * 2); c.fill();
  c.strokeStyle = '#7a7466';
  c.lineWidth = Math.max(1, s * 0.03);
  for (const dy of [-0.08, 0, 0.08]) { c.beginPath(); c.moveTo(fx - s * 0.12, fy + dy * s); c.lineTo(fx + s * 0.16, fy + dy * s); c.stroke(); }
}

/** 綠色大看板（全為虛構：標語、標誌、候選人皆非真實） */
function bannerTexture(lowDetail: boolean) {
  const W = lowDetail ? 512 : 1024, H = lowDetail ? 232 : 464;
  return canvasTex(W, H, c => {
    c.fillStyle = GREEN_DARK;
    c.fillRect(0, 0, W, H);
    // 左側人像區（淺綠漸層）
    const lg = c.createLinearGradient(0, 0, 0, H);
    lg.addColorStop(0, '#3f9a52');
    lg.addColorStop(1, '#1f6b3e');
    c.fillStyle = lg;
    c.fillRect(0, 0, W * 0.42, H * 0.8);
    // 上方標語條
    c.fillStyle = GREEN_MID;
    c.fillRect(W * 0.42, 0, W * 0.58, H * 0.17);
    drawEmblem(c, W * 0.48, H * 0.085, H * 0.065);
    c.fillStyle = '#ffffff';
    c.textAlign = 'left';
    c.textBaseline = 'middle';
    c.font = `800 ${Math.round(H * 0.11)}px ${FONT}`;
    c.fillText('2026  蚵仔贏面', W * 0.53, H * 0.09);
    // 兩位蚵仔候選人
    drawMascot(c, W * 0.12, H * 0.33, H * 0.17, { glasses: true, tie: '#3b74a8', seed: 0.4 });
    drawMascot(c, W * 0.31, H * 0.31, H * 0.18, { glasses: false, tie: '#c0463a', seed: 2.1 });
    // 號次＋職稱＋姓名
    const rows: [string, string, string][] = [['1', '蚵長', '蚵蚊哲'], ['2', '蚵議員', '蚵博文']];
    rows.forEach(([num, title, name], i) => {
      const y = H * (0.32 + i * 0.29);
      const bx = W * 0.5, r = H * 0.105;
      c.fillStyle = '#ffffff';
      c.beginPath(); c.arc(bx, y, r, 0, Math.PI * 2); c.fill();
      c.fillStyle = GREEN_DARK;
      c.textAlign = 'center';
      c.font = `900 ${Math.round(r * 1.4)}px ${FONT}`;
      c.fillText(num, bx, y + r * 0.06);
      // 職稱（白字＋上下細線）
      c.fillStyle = '#ffffff';
      c.font = `800 ${Math.round(H * 0.075)}px ${FONT}`;
      c.fillText(title, W * 0.625, y);
      c.fillRect(W * 0.57, y - H * 0.065, W * 0.11, Math.max(1, H * 0.006));
      c.fillRect(W * 0.57, y + H * 0.06, W * 0.11, Math.max(1, H * 0.006));
      // 姓名（大白字）
      c.font = `900 ${Math.round(H * 0.19)}px ${FONT}`;
      c.fillText(name, W * 0.84, y + H * 0.01);
    });
    // 下方「聯合競選總部」萊姆綠條
    c.fillStyle = GREEN_LIME;
    c.fillRect(0, H * 0.8, W, H * 0.2);
    c.fillStyle = '#0f4a24';
    c.textAlign = 'center';
    c.font = `900 ${Math.round(H * 0.16)}px ${FONT}`;
    c.fillText('聯合競選總部', W * 0.5, H * 0.905);
    // 外框
    c.strokeStyle = 'rgba(255,255,255,0.5)';
    c.lineWidth = Math.max(2, H * 0.008);
    c.strokeRect(c.lineWidth / 2, c.lineWidth / 2, W - c.lineWidth, H - c.lineWidth);
  });
}

/** 組合屋正面：白鋼板＋X 斜撐線＋小窗＋三格開著的鐵捲門洞 */
function facadeTexture(lowDetail: boolean) {
  const W = lowDetail ? 512 : 1024, H = lowDetail ? 128 : 256;
  return canvasTex(W, H, c => {
    c.fillStyle = '#ecebe6';
    c.fillRect(0, 0, W, H);
    const n = 6, pw = W / n;
    const lw = Math.max(1.5, H * 0.012);
    for (let i = 0; i < n; i++) {
      const x0 = i * pw, x1 = x0 + pw;
      if (i >= 2 && i <= 4) {
        // 門洞：深色室內＋上方捲起的鐵捲門
        const top = H * 0.2;
        const g = c.createLinearGradient(0, top, 0, H);
        g.addColorStop(0, '#2c3034');
        g.addColorStop(1, '#4a4e50');
        c.fillStyle = g;
        c.fillRect(x0 + pw * 0.04, top, pw * 0.92, H - top);
        c.fillStyle = '#9ea2a4';
        c.fillRect(x0 + pw * 0.02, top - H * 0.07, pw * 0.96, H * 0.07);
        c.fillStyle = 'rgba(0,0,0,0.25)';
        for (let k = 0; k < 3; k++) c.fillRect(x0 + pw * 0.02, top - H * 0.07 + k * H * 0.024, pw * 0.96, Math.max(1, H * 0.006));
        continue;
      }
      if (i === 1) {
        // 小窗（兩扇鋁窗）
        c.fillStyle = '#8f9396';
        c.fillRect(x0 + pw * 0.08, H * 0.28, pw * 0.84, H * 0.36);
        c.fillStyle = '#41474b';
        c.fillRect(x0 + pw * 0.11, H * 0.31, pw * 0.37, H * 0.3);
        c.fillRect(x0 + pw * 0.52, H * 0.31, pw * 0.37, H * 0.3);
      } else {
        c.strokeStyle = 'rgba(120,124,126,0.75)';
        c.lineWidth = lw;
        c.beginPath();
        c.moveTo(x0 + pw * 0.06, H * 0.08); c.lineTo(x1 - pw * 0.06, H * 0.94);
        c.moveTo(x1 - pw * 0.06, H * 0.08); c.lineTo(x0 + pw * 0.06, H * 0.94);
        c.stroke();
      }
    }
    // 立柱縫＋上下框
    c.fillStyle = '#b7b9b8';
    for (let i = 0; i <= n; i++) c.fillRect(i * pw - lw, 0, lw * 2, H);
    c.fillRect(0, 0, W, H * 0.04);
    c.fillRect(0, H * 0.96, W, H * 0.04);
  });
}

/** 小旗：綠底白字 */
function flagTexture(text: string) {
  return canvasTex(64, 160, c => {
    c.fillStyle = GREEN_MID;
    c.fillRect(0, 0, 64, 160);
    c.fillStyle = GREEN_LIME;
    c.fillRect(0, 140, 64, 20);
    c.fillStyle = '#ffffff';
    c.font = `900 34px ${FONT}`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    [...text].forEach((ch, i) => c.fillText(ch, 32, 30 + i * 40));
  });
}

/**
 * 樸子腳北側「蚵蚊哲・蚵博文 聯合競選總部」外觀（不可進入、無座位）。
 * 白色組合屋＋整面綠色大看板，正門朝西（-X）。無點光源。
 */
export function makePlazaHq(
  M: MatFn,
  add: AddFn,
  lowDetail = false,
): { group: THREE.Group; dispose: () => void } {
  const root = new THREE.Group();
  root.name = 'plazaHq';
  const LO = lowDetail;
  const segs = LO ? 6 : 10;
  const textures: THREE.Texture[] = [];
  const B = HQ_BUILDING;
  const W = B.x1 - B.x0, D = B.z1 - B.z0;
  const cz = (B.z0 + B.z1) / 2;
  const fx = B.x0;

  const facadePlane = (w: number, h: number, mat: THREE.Material, x: number, y: number, z: number) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    m.rotation.y = -Math.PI / 2;
    m.position.set(x, y, z);
    root.add(m);
    return m;
  };

  // ── 組合屋本體（白鋼板＋淺灰屋頂） ──
  const panel = M(0xe6e5e0, { roughness: 0.7, metalness: 0.15 });
  const roof = M(0xa9aba9, { roughness: 0.8, metalness: 0.3 });
  const steel = M(0x8d9295, { roughness: 0.5, metalness: 0.5 });
  {
    const body = new THREE.Mesh(new THREE.BoxGeometry(W, B.h, D), [panel, panel, roof, roof, panel, panel]);
    body.position.set((B.x0 + B.x1) / 2, B.h / 2, cz);
    body.castShadow = !LO; body.receiveShadow = !LO;
    root.add(body);
    // 與樸子腳之間的窄縫補牆
    const gap = SEAFOOD_BUILDING.z0 - B.z1;
    if (gap > 0.01) add(new THREE.BoxGeometry(W - 0.1, B.h, gap), panel, [(B.x0 + B.x1) / 2 + 0.05, B.h / 2, B.z1 + gap / 2], root, false);
  }
  // 正面鋼板貼圖
  {
    const tex = facadeTexture(LO); textures.push(tex);
    facadePlane(D, B.h - 0.1, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7, metalness: 0.1 }), fx - 0.01, (B.h - 0.1) / 2, cz);
    // 屋簷水槽
    add(new THREE.BoxGeometry(0.22, 0.14, D + 0.1), steel, [fx - 0.1, B.h + 0.02, cz], root, true);
  }

  // ── 綠色大看板（屋頂上鋼架撐起，蓋住正面上半） ──
  const BH = 3.0, by = B.h + 0.15 + BH / 2;
  {
    const tex = bannerTexture(LO); textures.push(tex);
    add(new THREE.BoxGeometry(0.06, BH, D + 0.1), M(0x1d5a36, { roughness: 0.85 }), [fx - 0.05, by, cz], root, true);
    facadePlane(D + 0.06, BH - 0.04, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8 }), fx - 0.09, by, cz);
    // 背後鋼架（立柱＋斜撐）
    const n = LO ? 3 : 4;
    for (let i = 0; i < n; i++) {
      const z = B.z0 + 0.25 + (i / (n - 1)) * (D - 0.5);
      add(new THREE.BoxGeometry(0.06, BH + 0.1, 0.06), steel, [fx + 0.05, by, z], root, false);
      // 斜撐：屋頂後方（x+1.35）撐到看板立柱（y+1.6）
      const brace = add(new THREE.BoxGeometry(Math.hypot(1.35, 1.6), 0.05, 0.05), steel, [fx + 0.05 + 0.675, B.h + 0.8, z], root, false);
      brace.rotation.z = Math.atan2(-1.6, 1.35);
    }
  }

  // ── 門口擺設 ──
  for (const p of HQ_PROPS) {
    if (p.kind === 'flags') {
      // 三角旗架：底座＋三支旗桿
      add(rcyl(0.26, 0.3, 0.12, segs), M(0x3a3e42, { roughness: 0.7 }), [p.x, 0.06, p.z], root, true);
      const texts = ['凍蒜', '蚵蚊哲', '蚵博文'];
      const n = LO ? 2 : 3;
      for (let i = 0; i < n; i++) {
        const a = (i / 3) * Math.PI * 2;
        const x = p.x + Math.cos(a) * 0.12, z = p.z + Math.sin(a) * 0.12;
        const h = 2.3 + i * 0.15;
        add(rcyl(0.018, 0.018, h, 6), steel, [x, h / 2, z], root, false);
        const t = flagTexture(texts[i]); textures.push(t);
        const flag = new THREE.Mesh(
          new THREE.PlaneGeometry(0.4, 1.0),
          new THREE.MeshStandardMaterial({ map: t, roughness: 0.85, side: THREE.DoubleSide }),
        );
        flag.position.set(x - 0.01, h - 0.55, z + 0.21);
        flag.rotation.y = -Math.PI / 2 + (i - 1) * 0.35;
        root.add(flag);
      }
    } else if (p.kind === 'chairs') {
      // 改成可坐的單張塑膠椅，畫在 seafood.ts（休息座）；這裡只留碰撞
      continue;
      // 疊放的白色塑膠椅
      const chair = M(0xf2f2ee, { roughness: 0.6 });
      const k = LO ? 3 : 5;
      for (let i = 0; i < k; i++) {
        add(rboxEnv(0.42, 0.04, 0.42, 0.15), chair, [p.x, 0.45 + i * 0.07, p.z], root, i === 0);
      }
      const top = 0.45 + (k - 1) * 0.07;
      add(rboxEnv(0.04, 0.42, 0.42, 0.15), chair, [p.x + 0.2, top + 0.22, p.z], root, true);
      for (const [dx, dz] of [[-0.18, -0.18], [-0.18, 0.18], [0.18, -0.18], [0.18, 0.18]] as const) {
        add(new THREE.BoxGeometry(0.04, 0.45, 0.04), chair, [p.x + dx, 0.225, p.z + dz], root, false);
      }
    } else {
      // 小講台：綠色面板＋蚵殼標誌貼片＋麥克風
      const box = M(0x1f6b3e, { roughness: 0.75 });
      add(rboxEnv(0.5, 1.05, 0.62, 0.05), box, [p.x, 0.525, p.z], root, true);
      add(new THREE.BoxGeometry(0.58, 0.05, 0.7), M(0x8cc63f, { roughness: 0.7 }), [p.x, 1.07, p.z], root, false);
      const t = canvasTex(64, 64, c => {
        c.fillStyle = GREEN_DARK; c.fillRect(0, 0, 64, 64);
        drawEmblem(c, 32, 32, 26);
      });
      textures.push(t);
      facadePlane(0.32, 0.32, new THREE.MeshBasicMaterial({ map: t }), p.x - 0.26, 0.7, p.z);
      add(rcyl(0.012, 0.012, 0.3, 6), steel, [p.x - 0.12, 1.22, p.z], root, false);
      add(new THREE.SphereGeometry(0.035, 8, 6), M(0x2b2f33, { roughness: 0.5 }), [p.x - 0.14, 1.38, p.z], root, false);
    }
  }

  return {
    group: root,
    dispose: () => { for (const t of textures) t.dispose(); },
  };
}
