import * as THREE from 'three';

export type WorldLabelKind = 'name' | 'bubble';

export type WorldLabel = {
  sprite: THREE.Sprite;
  setText: (text: string, force?: boolean) => void;
  setOpacity: (a: number) => void;
  dispose: () => void;
};

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const t = text.trim() || ' ';
  const lines: string[] = [];
  let line = '';
  for (const ch of t) {
    const trial = line + ch;
    if (ctx.measureText(trial).width > maxW && line) {
      lines.push(line);
      line = ch;
    } else line = trial;
  }
  if (line) lines.push(line);
  return lines.slice(0, 4);
}

/** 名牌底色：真人偏暖褐；阿婆偏青灰，廣場一眼可辨 */
export type WorldLabelNameTone = 'player' | 'npc';

export type WorldLabelOpts = {
  worldH?: number;
  /** 廣場人名等需蓋過場景時關深度測試（等同舊 DOM 疊層） */
  depthTest?: boolean;
  /** 僅 kind=name：真人／阿婆底色 */
  nameTone?: WorldLabelNameTone;
};

/** 頭頂名牌／對話泡泡：Canvas 貼到 Sprite，跟隨 3D，不寫 DOM */
export function makeWorldLabel(
  initial: string,
  kind: WorldLabelKind,
  worldHOrOpts: number | WorldLabelOpts = kind === 'name' ? 0.2 : 0.3,
): WorldLabel {
  const opts: WorldLabelOpts = typeof worldHOrOpts === 'number' ? { worldH: worldHOrOpts } : worldHOrOpts;
  const worldH = opts.worldH ?? (kind === 'name' ? 0.2 : 0.3);
  const depthTest = opts.depthTest !== false;
  const nameTone: WorldLabelNameTone = opts.nameTone === 'npc' ? 'npc' : 'player';
  // 固定畫布尺寸：避免改 canvas.width 導致 WebGL 貼圖卡住舊畫面
  const dpr = Math.min(typeof devicePixelRatio === 'number' ? devicePixelRatio : 1, 2);
  const cssW = kind === 'bubble' ? 320 : 360;
  const cssH = kind === 'bubble' ? 160 : 64;
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(cssW * dpr);
  canvas.height = Math.ceil(cssH * dpr);
  const ctx = canvas.getContext('2d')!;
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  const mat = new THREE.SpriteMaterial({
    map: tex,
    transparent: true,
    depthTest,
    depthWrite: false,
    sizeAttenuation: true,
  });
  const sprite = new THREE.Sprite(mat);
  sprite.center.set(0.5, 0);
  sprite.renderOrder = kind === 'bubble' ? 3 : 2;
  let text = '';
  let opacity = 1;

  const redraw = () => {
    const fontPx = kind === 'name' ? 26 : 24;
    const padX = kind === 'name' ? 14 : 16;
    const padY = kind === 'name' ? 8 : 10;
    const maxTextW = kind === 'bubble' ? 260 : 320;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.font = `800 ${fontPx}px "Segoe UI","PingFang TC","Noto Sans TC","Microsoft JhengHei",sans-serif`;
    const lines = wrapLines(ctx, text, maxTextW);
    const lineH = fontPx * 1.25;
    const textW = Math.max(...lines.map(l => ctx.measureText(l).width), 8);
    const w = Math.min(cssW, Math.ceil(textW + padX * 2));
    const h = Math.min(cssH, Math.ceil(lines.length * lineH + padY * 2 + (kind === 'bubble' ? 8 : 0)));
    // 畫在畫布底部中央（sprite.center 在底邊）
    const ox = (cssW - w) / 2;
    const oy = cssH - h;
    ctx.clearRect(0, 0, cssW, cssH);
    if (kind === 'name') {
      roundRect(ctx, ox + 0.5, oy + 0.5, w - 1, h - 1, 10);
      if (nameTone === 'npc') {
        ctx.fillStyle = 'rgba(16,44,48,0.88)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(140,210,200,0.55)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.fillStyle = '#c8f0e6';
      } else {
        ctx.fillStyle = 'rgba(30,20,10,0.82)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,220,160,0.55)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.fillStyle = '#ffe9c0';
      }
    } else {
      roundRect(ctx, ox + 1, oy + 1, w - 2, h - 10, 12);
      ctx.fillStyle = '#fff8e8';
      ctx.fill();
      ctx.strokeStyle = '#1b1b1b';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(ox + w / 2 - 8, oy + h - 10);
      ctx.lineTo(ox + w / 2, oy + h - 2);
      ctx.lineTo(ox + w / 2 + 8, oy + h - 10);
      ctx.closePath();
      ctx.fillStyle = '#fff8e8';
      ctx.fill();
      ctx.strokeStyle = '#1b1b1b';
      ctx.stroke();
      ctx.fillStyle = '#3a2410';
    }
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    ctx.font = `800 ${fontPx}px "Segoe UI","PingFang TC","Noto Sans TC","Microsoft JhengHei",sans-serif`;
    const y0 = oy + padY + lineH / 2;
    for (let i = 0; i < lines.length; i++) ctx.fillText(lines[i], ox + w / 2, y0 + i * lineH);
    // 裁切到實際文字區（flipY 下底邊對齊），避免整張空白畫布把字縮太小
    tex.offset.set(ox / cssW, 1 - (oy + h) / cssH);
    tex.repeat.set(w / cssW, h / cssH);
    tex.needsUpdate = true;
    const aspect = w / Math.max(1, h);
    sprite.scale.set(worldH * aspect, worldH, 1);
    mat.opacity = opacity;
    mat.needsUpdate = true;
  };

  const setText = (t: string, force = false) => {
    const next = t || '';
    if (!force && next === text && kind === 'name') return;
    text = next;
    redraw();
  };
  const setOpacity = (a: number) => {
    const next = Math.max(0, Math.min(1, a));
    if (Math.abs(next - opacity) < 0.01) {
      mat.opacity = opacity;
      return;
    }
    opacity = next;
    mat.opacity = opacity;
    mat.needsUpdate = true;
  };
  const dispose = () => {
    mat.map?.dispose();
    mat.dispose();
    sprite.removeFromParent();
  };

  setText(initial || ' ', true);
  return { sprite, setText, setOpacity, dispose };
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}
