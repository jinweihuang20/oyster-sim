import * as THREE from 'three';

export type WorldLabelKind = 'name' | 'bubble';

export type WorldLabel = {
  sprite: THREE.Sprite;
  setText: (text: string, force?: boolean) => void;
  setOpacity: (a: number) => void;
  setNameFrame: (on: boolean) => void;
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

/** 名牌：真人白底藍邊＋人像；NPC 半透明灰、無邊框；sign＝桌牌（白底藍邊、無人像） */
export type WorldLabelNameTone = 'player' | 'npc' | 'sign';

export type WorldLabelOpts = {
  worldH?: number;
  /** 預設關閉深度測試，避免被牆、攤位擋住；本機角色會在主畫面之後再畫一次蓋住名牌 */
  depthTest?: boolean;
  /** 真人／NPC 樣式（名牌與泡泡皆用） */
  nameTone?: WorldLabelNameTone;
  /** 泡泡依文字自訂底色／邊框／字色 */
  bubbleTint?: (text: string) => { fill: string; line: string; text: string } | null;
};

/** 頭頂名牌／對話泡泡：Canvas 貼到 Sprite，跟隨 3D，不寫 DOM */
export function makeWorldLabel(
  initial: string,
  kind: WorldLabelKind,
  worldHOrOpts: number | WorldLabelOpts = kind === 'name' ? 0.2 : 0.3,
): WorldLabel {
  const opts: WorldLabelOpts = typeof worldHOrOpts === 'number' ? { worldH: worldHOrOpts } : worldHOrOpts;
  const worldH = opts.worldH ?? (kind === 'name' ? 0.2 : 0.3);
  const depthTest = opts.depthTest === true;
  const nameTone: WorldLabelNameTone = opts.nameTone === 'npc' || opts.nameTone === 'sign' ? opts.nameTone : 'player';
  // 固定畫布尺寸：避免改 canvas.width 導致 WebGL 貼圖卡住舊畫面
  // 手機／粗指標（COARSE）：DPR 鎖 1，貼圖容量砍 1/4，近距離看文字仍清楚
  const isCoarse = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;
  const dprCap = isCoarse ? 1 : 2;
  const dpr = Math.min(typeof devicePixelRatio === 'number' ? devicePixelRatio : 1, dprCap);
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
    toneMapped: false,
  });
  const sprite = new THREE.Sprite(mat);
  sprite.center.set(0.5, 0);
  // 不寫深度；與場景的遮擋改由本機角色第二趟上色處理
  sprite.renderOrder = kind === 'bubble' ? 31 : 30;
  let text = '';
  let opacity = 1;
  let nameFrame = false;

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
    const iconW = kind === 'name' && nameTone === 'player' ? 26 : 0;
    const w = Math.min(cssW, Math.ceil(textW + iconW + padX * 2));
    const h = Math.min(cssH, Math.ceil(lines.length * lineH + padY * 2 + (kind === 'bubble' ? 8 : 0)));
    // 畫在畫布底部中央（sprite.center 在底邊）
    const ox = (cssW - w) / 2;
    const oy = cssH - h;
    ctx.clearRect(0, 0, cssW, cssH);
    if (kind === 'name') {
      roundRect(ctx, ox + 0.5, oy + 0.5, w - 1, h - 1, 10);
      if (nameTone === 'npc') {
        // NPC：半透明灰底、灰字、無邊框（退到背景）
        ctx.fillStyle = 'rgba(70,76,84,0.5)';
        ctx.fill();
        ctx.fillStyle = '#d4d9de';
      } else {
        // 真人：實底白名牌＋藍細邊＋人像線條圖示；金箔框改金邊＋內線，字色維持深色好讀
        ctx.fillStyle = nameFrame ? 'rgba(255,252,242,0.82)' : 'rgba(255,255,255,0.7)';
        ctx.fill();
        if (nameFrame) {
          ctx.strokeStyle = '#c9a227';
          ctx.lineWidth = 3.4;
          ctx.stroke();
          roundRect(ctx, ox + 3.6, oy + 3.6, w - 7.2, h - 7.2, 7);
          ctx.strokeStyle = '#ecd27a';
          ctx.lineWidth = 1.15;
          ctx.stroke();
        } else {
          ctx.strokeStyle = '#2a5a86';
          ctx.lineWidth = 2.5;
          ctx.stroke();
        }
        if (nameTone === 'player') {
          const ix = ox + padX + 10, iy = oy + h / 2;
          ctx.strokeStyle = nameFrame ? '#c9a227' : '#2a5a86';
          ctx.lineWidth = 2.2;
          ctx.beginPath(); ctx.arc(ix, iy - 5, 4.5, 0, Math.PI * 2); ctx.stroke();
          ctx.beginPath(); ctx.arc(ix, iy + 10, 8.5, Math.PI * 1.08, Math.PI * 1.92); ctx.stroke();
        }
        ctx.fillStyle = '#1f2a35';
      }
    } else {
      roundRect(ctx, ox + 1, oy + 1, w - 2, h - 10, 12);
      const npcB = nameTone === 'npc';
      const tint = opts.bubbleTint?.(text) ?? null;
      const bFill = tint ? tint.fill : npcB ? 'rgba(62,68,76,0.82)' : '#ffffff';
      const bLine = tint ? tint.line : npcB ? 'rgba(62,68,76,0.82)' : '#2a5a86';
      ctx.fillStyle = bFill;
      ctx.fill();
      ctx.strokeStyle = bLine;
      ctx.lineWidth = tint || npcB ? 1 : 2.5;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(ox + w / 2 - 8, oy + h - 10);
      ctx.lineTo(ox + w / 2, oy + h - 2);
      ctx.lineTo(ox + w / 2 + 8, oy + h - 10);
      ctx.closePath();
      ctx.fillStyle = bFill;
      ctx.fill();
      ctx.strokeStyle = bLine;
      ctx.stroke();
      ctx.fillStyle = tint ? tint.text : npcB ? '#e4e8ec' : '#1f2a35';
    }
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    ctx.font = `800 ${fontPx}px "Segoe UI","PingFang TC","Noto Sans TC","Microsoft JhengHei",sans-serif`;
    const y0 = oy + padY + lineH / 2;
    const tx = ox + iconW / 2 + w / 2;
    if (kind === 'name' && nameTone === 'npc') ctx.font = `600 ${fontPx}px "Segoe UI","PingFang TC","Noto Sans TC","Microsoft JhengHei",sans-serif`;
    for (let i = 0; i < lines.length; i++) ctx.fillText(lines[i], tx, y0 + i * lineH);
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
    // 文字沒變就不必重畫 Canvas／重新上傳貼圖（氣泡與名牌同樣適用）
    if (!force && next === text) return;
    text = next;
    redraw();
  };
  const setNameFrame = (on: boolean) => {
    const next = !!on && kind === 'name' && nameTone === 'player';
    if (next === nameFrame) return;
    nameFrame = next;
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
  return { sprite, setText, setOpacity, setNameFrame, dispose };
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

/** 本機第三人稱角色專用圖層：主畫面（含名牌）畫完後再畫一次，蓋住疊在自己身上的名牌 */
export const LOCAL_AVATAR_LAYER = 3;

export function markLocalAvatarLayer(root: THREE.Object3D | null | undefined) {
  if (!root) return;
  root.traverse(o => { o.layers.set(LOCAL_AVATAR_LAYER); });
}

/**
 * 第一趟不畫本機角色（只放在 LOCAL_AVATAR_LAYER），先畫世界與名牌。
 * 第二趟不清顏色／深度，用一般 LessEqual 只畫本機角色：
 * 牆的深度仍在，會擋住自己；名牌沒寫深度，自己的頭／帽／身體會蓋住後面的名牌。
 * 不改 depthFunc＝Equal：iOS 等行動 GPU 深度精度較粗時 Equal 會幾乎全失敗，角色只剩少數網格（例如雨鞋）。
 * 角色只畫一趟，也不會再出現小腿與鞋互搶深度的問題。
 */
/** scene 的燈每幀遍歷一次很浪費；第一次啟用本機二趟時掃一次就夠 */
let _lightsCached: THREE.Light[] | null = null;
/** localRoot 的子節點也 cache；換 root 才重掃。新增的部件(帽子等)會回到預設 layer，等於只在第一趟畫，不影響正確性 */
let _localCache: { root: THREE.Object3D | null; nodes: THREE.Object3D[] } | null = null;
/** 外部可呼叫：角色換裝／加帽後清快取，確保第二趟也蓋得過自己的名牌 */
export function invalidateLocalAvatarCache() { _localCache = null; }
/** 新燈加入 scene 時呼叫一次 */
export function invalidateLightLayerCache() { _lightsCached = null; }

export function renderSceneWithLocalAvatarOnTop(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  localRoot?: THREE.Object3D | null,
) {
  const prevObjLayers: { obj: THREE.Object3D; mask: number }[] = [];
  const hasLocal = !!localRoot?.visible;
  if (hasLocal) {
    if (!_localCache || _localCache.root !== localRoot) {
      const nodes: THREE.Object3D[] = [];
      localRoot.traverse(o => nodes.push(o));
      _localCache = { root: localRoot, nodes };
    }
    const nodes = _localCache.nodes;
    for (let i = 0; i < nodes.length; i++) {
      const o = nodes[i];
      prevObjLayers.push({ obj: o, mask: o.layers.mask });
      o.layers.set(LOCAL_AVATAR_LAYER);
    }
    if (!_lightsCached) {
      _lightsCached = [];
      scene.traverse(o => { if ((o as THREE.Light).isLight) _lightsCached!.push(o as THREE.Light); });
    }
    for (let i = 0; i < _lightsCached.length; i++) _lightsCached[i].layers.enable(LOCAL_AVATAR_LAYER);
  }
  const prevMask = camera.layers.mask;
  const prevAuto = renderer.autoClear;
  const prevAutoColor = renderer.autoClearColor;
  const prevAutoDepth = renderer.autoClearDepth;
  const prevAutoStencil = renderer.autoClearStencil;
  const prevShadow = renderer.shadowMap.enabled;
  const prevBg = scene.background;
  try {
    renderer.render(scene, camera);
    if (!hasLocal) return;
    // Three.js 只要 scene.background 是 Color，即使 autoClear=false 也會 forceClear 整張畫布（含深度），世界就會被清掉只剩本機角色
    renderer.autoClear = false;
    renderer.autoClearColor = false;
    renderer.autoClearDepth = false;
    renderer.autoClearStencil = false;
    renderer.shadowMap.enabled = false;
    scene.background = null;
    camera.layers.set(LOCAL_AVATAR_LAYER);
    renderer.render(scene, camera);
  } finally {
    for (const { obj, mask } of prevObjLayers) obj.layers.mask = mask;
    camera.layers.mask = prevMask;
    renderer.autoClear = prevAuto;
    renderer.autoClearColor = prevAutoColor;
    renderer.autoClearDepth = prevAutoDepth;
    renderer.autoClearStencil = prevAutoStencil;
    renderer.shadowMap.enabled = prevShadow;
    scene.background = prevBg;
  }
}
