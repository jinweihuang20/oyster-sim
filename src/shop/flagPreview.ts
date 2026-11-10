/** 商店旗幟預覽：2D 畫布模擬廣場上的樣子（顏色、尺寸、特效、文字即時反映） */
import { paintFlag, TEX_W, TEX_H } from '../plaza/flagView';
import { flagSizeOf } from '../plaza/flags';

export type FlagPreviewState = { color: number; size: number; fx: number; text: string; nick: string };

const W = 260;
const H = 200;
const GROUND = 186;
const POLE_X = 70;

type Spark = { x: number; y: number; vx: number; vy: number; life: number; hue: number };

export function mountFlagPreview(canvas: HTMLCanvasElement, get: () => FlagPreviewState) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const tex = document.createElement('canvas');
  tex.width = TEX_W; tex.height = TEX_H;
  const cloth = document.createElement('canvas');
  const cctx = cloth.getContext('2d')!;
  let key = '';
  const sparks: Spark[] = [];
  let nextBurst = 0;
  const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  const frame = (now: number) => {
    if (!canvas.isConnected) return;
    const s = get();
    const k = `${s.color}|${s.text}|${s.nick}`;
    if (k !== key) { key = k; paintFlag(tex, s.text, s.color, s.nick); }
    const t = still ? 0 : now / 1000;
    const sc = flagSizeOf(s.size).scale;
    const poleH = 92 * sc;
    const cw = Math.round(70 * sc);
    const ch = Math.round(44 * sc);
    const top = GROUND - poleH;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    // 地面
    ctx.fillStyle = 'rgba(255,255,255,.08)';
    ctx.fillRect(0, GROUND, W, 1);

    // 光柱
    if (s.fx >= 3) {
      const a = 0.22 + 0.08 * Math.sin(t * 2.4);
      const g = ctx.createLinearGradient(0, GROUND, 0, 0);
      g.addColorStop(0, `rgba(255,226,140,${a + 0.15})`);
      g.addColorStop(1, 'rgba(255,226,140,0)');
      ctx.fillStyle = g;
      ctx.fillRect(POLE_X - 14, 0, 28, GROUND);
    }

    // 人形比例尺
    const px = 210, ph = 58;
    ctx.fillStyle = 'rgba(244,240,232,.28)';
    ctx.beginPath(); ctx.arc(px, GROUND - ph + 7, 7, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(px - 10, GROUND); ctx.lineTo(px - 9, GROUND - ph + 18);
    ctx.quadraticCurveTo(px, GROUND - ph + 13, px + 9, GROUND - ph + 18);
    ctx.lineTo(px + 10, GROUND); ctx.closePath(); ctx.fill();

    // 旗桿
    ctx.fillStyle = '#c9ced6';
    ctx.fillRect(POLE_X - 2, top, 4, poleH);
    ctx.beginPath(); ctx.arc(POLE_X, top, 3.5, 0, Math.PI * 2); ctx.fill();

    // 旗面（逐欄切片做擺動）
    const pad = 12;
    cloth.width = cw + 2; cloth.height = ch + pad * 2;
    cctx.clearRect(0, 0, cloth.width, cloth.height);
    const cols = 28;
    const amp = s.fx >= 1 ? 3.2 * sc : 0;
    for (let i = 0; i < cols; i++) {
      const u0 = i / cols;
      const dx = u0 * cw;
      const dw = cw / cols + 0.6;
      const ph2 = t * 3.6 - i * 0.32;
      const dy = Math.sin(ph2) * amp * u0;
      cctx.drawImage(tex, u0 * TEX_W, 0, TEX_W / cols, TEX_H, dx, pad + dy, dw, ch);
      if (amp) {
        const shade = Math.cos(ph2) * 0.12 * u0;
        cctx.fillStyle = shade > 0 ? `rgba(255,255,255,${shade})` : `rgba(0,0,0,${-shade})`;
        cctx.globalCompositeOperation = 'source-atop';
        cctx.fillRect(dx, 0, dw, cloth.height);
        cctx.globalCompositeOperation = 'source-over';
      }
    }
    if (s.fx >= 2) {
      // 金光：斜向亮帶掃過
      const p = ((t * 0.55) % 1.6) - 0.3;
      const bx = p * cw;
      const g = cctx.createLinearGradient(bx - 18, 0, bx + 18, cloth.height);
      g.addColorStop(0, 'rgba(255,240,180,0)');
      g.addColorStop(0.5, 'rgba(255,240,180,.55)');
      g.addColorStop(1, 'rgba(255,240,180,0)');
      cctx.globalCompositeOperation = 'source-atop';
      cctx.fillStyle = g;
      cctx.fillRect(0, 0, cloth.width, cloth.height);
      cctx.globalCompositeOperation = 'source-over';
    }
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,.35)';
    ctx.shadowBlur = 6; ctx.shadowOffsetY = 2;
    ctx.drawImage(cloth, POLE_X + 1, top + 2 - pad);
    ctx.restore();

    if (s.fx >= 2) {
      for (let i = 0; i < 4; i++) {
        const q = (t * 0.9 + i * 0.37) % 1;
        const a = Math.sin(q * Math.PI);
        const sx = POLE_X + 6 + ((i * 53) % cw);
        const sy = top + ((i * 29) % ch);
        ctx.fillStyle = `rgba(255,236,160,${a * 0.9})`;
        ctx.beginPath(); ctx.arc(sx, sy, 1.6 + a, 0, Math.PI * 2); ctx.fill();
      }
    }

    // 煙火
    if (s.fx >= 3 && !still) {
      if (now > nextBurst) {
        nextBurst = now + 900 + Math.random() * 700;
        const cx = POLE_X + (Math.random() - 0.3) * 60, cy = 30 + Math.random() * 30;
        const hue = [42, 8, 50, 330][Math.floor(Math.random() * 4)];
        for (let i = 0; i < 22; i++) {
          const ang = (i / 22) * Math.PI * 2, sp = 0.9 + Math.random() * 0.6;
          sparks.push({ x: cx, y: cy, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, life: 1, hue });
        }
      }
      for (let i = sparks.length - 1; i >= 0; i--) {
        const p = sparks[i];
        p.x += p.vx; p.y += p.vy; p.vy += 0.025; p.life -= 0.018;
        if (p.life <= 0) { sparks.splice(i, 1); continue; }
        ctx.fillStyle = `hsla(${p.hue},95%,70%,${p.life})`;
        ctx.fillRect(p.x, p.y, 2, 2);
      }
    } else sparks.length = 0;

    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
