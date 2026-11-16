// 廣場南牆生涯排行跑馬燈（各項 TOP3）
// 整串字只在換內容時畫一次（切成好幾列塞進一張貼圖），捲動靠 shader 位移取樣：
// 每幀不重畫 Canvas、不重新上傳貼圖，60fps 平順捲動；有 mipmap，遠看不閃。
import * as THREE from 'three';
import { WALK_BOUND, CAFE_SOUTH_WALL_END } from './layout';
import { fetchCareerTop3 } from '../meta/social';

const REFRESH_SEC = 180;
/** 捲動速度（公尺／秒，跟舊版 2048px 板 180px/s 一樣） */
const SCROLL_M_PER_SEC = 0.98;
const LABEL_FRAC = 0.14;
const PAD = 4;
const MAX_ROWS = 24;
const BG = '#041008';
const FONT = '"Segoe UI","Microsoft JhengHei","PingFang TC",sans-serif';
const LOADING = '　　生涯排行讀取中…　　';
const OFFLINE = '　　生涯排行暫時連不上　　';

export type CareerMarquee = {
  group: THREE.Group;
  tick: (dt: number) => void;
  dispose: () => void;
};

/** 依各項結果組字：連不上的項目沿用上次的字；全部連不上且沒舊字才顯示「暫時連不上」 */
export function composeMarqueeText(lines: (string | null)[], prev: (string | null)[]): { text: string | null; keep: (string | null)[] } {
  const keep = lines.map((l, i) => l ?? prev[i] ?? null);
  const ok = keep.filter((l): l is string => !!l);
  if (ok.length) return { text: `　　${ok.join('　　｜　　')}　　`, keep };
  return { text: null, keep };
}

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
  // 牆內側面在 WALK_BOUND；螢幕必須凸出在廣場側，外框退到牆內，避免框體蓋住畫面
  const zScreen = WALK_BOUND - 0.08;
  const zFrame = WALK_BOUND + 0.02;

  const frameMat = new THREE.MeshStandardMaterial({ color: 0x1c1c20, metalness: 0.55, roughness: 0.48 });
  const frameGeo = new THREE.BoxGeometry(boardW + 0.16, boardH + 0.16, 0.08);
  const frame = new THREE.Mesh(frameGeo, frameMat);
  frame.position.set(midX, y, zFrame);
  frame.castShadow = false;
  frame.receiveShadow = false;
  group.add(frame);

  const bracketMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2e, metalness: 0.5, roughness: 0.55 });
  const bracketGeo = new THREE.BoxGeometry(0.08, 0.36, 0.1);
  for (const sx of [-boardW * 0.42, boardW * 0.42]) {
    const b = new THREE.Mesh(bracketGeo, bracketMat);
    b.position.set(midX + sx, y + boardH * 0.55, zFrame);
    group.add(b);
  }

  const screenW = boardW - 0.04, screenH = boardH - 0.04;
  // 貼圖解析度：列高（px）＝螢幕高；水平 px/m 跟垂直一樣，字才不會變形
  const rowH = lowDetail ? 64 : 96;
  const rowW = lowDetail ? 1024 : 2048;
  const pxPerM = rowH / screenH;
  const labelW = Math.round(LABEL_FRAC * screenW * pxPerM);
  const winW = (1 - LABEL_FRAC) * screenW * pxPerM;
  const gapPx = Math.round(96 * rowH / 128);
  const rowStride = rowH + PAD * 2;

  const canvas = document.createElement('canvas');
  canvas.width = rowW + PAD * 2;
  canvas.height = rowStride * 2;
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = true;
  tex.anisotropy = 4;
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;

  const uni = {
    uScroll: { value: 0 },
    uTextW: { value: 1 },
    uLoop: { value: 1 + gapPx },
    uWinW: { value: winW },
    uLabelFrac: { value: LABEL_FRAC },
    uLabelW: { value: labelW },
    uRowW: { value: rowW },
    uRowH: { value: rowH },
    uRowStride: { value: rowStride },
    uPad: { value: PAD },
    uLabelRow: { value: 1 },
    uTexSize: { value: new THREE.Vector2(canvas.width, canvas.height) },
  };

  const screenMat = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false, side: THREE.FrontSide, depthWrite: true });
  screenMat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uni);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
uniform float uScroll, uTextW, uLoop, uWinW, uLabelFrac, uLabelW, uRowW, uRowH, uRowStride, uPad, uLabelRow;
uniform vec2 uTexSize;`)
      .replace('#include <map_fragment>', `
#ifdef USE_MAP
  vec2 suv = vMapUv;
  // 以連續座標算梯度，避免 mod／分支處 mipmap 接縫
  vec2 pxD = vec2(uWinW / (1.0 - uLabelFrac), uRowH);
  vec2 gx = dFdx(suv) * pxD / uTexSize;
  vec2 gy = dFdy(suv) * pxD / uTexSize;
  float cyIn = (1.0 - suv.y) * uRowH;
  vec2 cp;
  if (suv.x < uLabelFrac) {
    cp = vec2(uPad + suv.x / uLabelFrac * uLabelW, uLabelRow * uRowStride + uPad + cyIn);
  } else {
    float s = mod(uScroll + (suv.x - uLabelFrac) / (1.0 - uLabelFrac) * uWinW, uLoop);
    s = min(s, uTextW + 2.0);
    float row = floor(s / uRowW);
    cp = vec2(uPad + (s - row * uRowW), row * uRowStride + uPad + cyIn);
  }
  vec2 tuv = vec2(cp.x / uTexSize.x, 1.0 - cp.y / uTexSize.y);
  vec4 sampledDiffuseColor = textureGrad(map, tuv, gx, gy);
  // LED 掃描線：近看有線，遠看（一像素蓋好幾條線）淡掉，避免摩爾紋閃爍
  float fw = fwidth(cyIn);
  float line = step(mod(cyIn, 3.0), 1.0);
  float lineK = 0.32 * (1.0 - clamp(fw - 0.6, 0.0, 1.0));
  sampledDiffuseColor.rgb *= 1.0 - line * lineK;
  diffuseColor *= sampledDiffuseColor;
#endif`);
  };
  screenMat.customProgramCacheKey = () => 'careerMarqueeV2';
  // 薄盒：不靠旋轉朝向，廣場側一定看得到貼圖
  const screenGeo = new THREE.BoxGeometry(screenW, screenH, 0.03);
  const screen = new THREE.Mesh(screenGeo, screenMat);
  screen.position.set(midX, y, zScreen);
  screen.renderOrder = 2;
  group.add(screen);

  let disposed = false;
  let text = LOADING;
  let prevLines: (string | null)[] = [];
  let scroll = 0;
  let refreshAcc = REFRESH_SEC;
  let fetching = false;

  /** 換字時畫一次：整串切成每列 rowW 寬（左右各留 PAD 重疊，避免列接縫），最後一列放左側「生涯 TOP3」 */
  function paintAtlas() {
    if (disposed) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const fontPx = Math.floor(rowH * 0.52);
    const font = `bold ${fontPx}px ${FONT}`;
    ctx.font = font;
    const textW = Math.max(1, Math.ceil(ctx.measureText(text).width));
    const rows = Math.min(MAX_ROWS, Math.ceil((textW + 8) / rowW));
    const h = rowStride * (rows + 1);
    if (canvas.height !== h) {
      canvas.height = h; // 尺寸變了：舊 GPU 貼圖作廢重建
      tex.dispose();
    }
    ctx.font = font;
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#9dff88';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    for (let r = 0; r < rows; r++) {
      const top = r * rowStride;
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, top, canvas.width, rowStride);
      ctx.clip();
      ctx.fillText(text, PAD - r * rowW, top + PAD + rowH * 0.52);
      ctx.restore();
    }
    // 標籤列
    const lt = rows * rowStride + PAD;
    ctx.fillStyle = '#0c1c0e';
    ctx.fillRect(PAD, lt, labelW, rowH);
    ctx.strokeStyle = '#3a7a32';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(PAD + labelW - 1, lt + 4);
    ctx.lineTo(PAD + labelW - 1, lt + rowH - 4);
    ctx.stroke();
    ctx.fillStyle = '#d4ffc4';
    ctx.font = `bold ${Math.floor(rowH * 0.36)}px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText('生涯', PAD + labelW * 0.5, lt + rowH * 0.38);
    ctx.fillText('TOP3', PAD + labelW * 0.5, lt + rowH * 0.68);
    ctx.textAlign = 'left';

    const loop = Math.min(textW, rows * rowW - 8) + gapPx;
    // 保留目前捲到的位置（同一個 px 偏移），內容更新時不會跳回開頭
    scroll = scroll % loop;
    uni.uTextW.value = Math.min(textW, rows * rowW - 8);
    uni.uLoop.value = loop;
    uni.uLabelRow.value = rows;
    uni.uTexSize.value.set(canvas.width, canvas.height);
    tex.needsUpdate = true;
  }

  async function refresh() {
    if (disposed || fetching) return;
    fetching = true;
    try {
      const lines = await fetchCareerTop3();
      if (disposed) return;
      const { text: next, keep } = composeMarqueeText(lines, prevLines);
      prevLines = keep;
      const want = next ?? (text === LOADING || text === OFFLINE ? OFFLINE : text);
      if (want !== text) { text = want; paintAtlas(); }
    } catch { /* 保留舊字 */ } finally {
      fetching = false;
    }
  }

  paintAtlas();

  return {
    group,
    tick(dt: number) {
      // 只在廣場（看板顯示中）才捲動／抓資料；捲動只改一個 uniform
      if (disposed || !group.visible) return;
      refreshAcc += dt;
      if (refreshAcc >= REFRESH_SEC) {
        refreshAcc = 0;
        void refresh();
      }
      scroll = (scroll + dt * SCROLL_M_PER_SEC * pxPerM) % uni.uLoop.value;
      uni.uScroll.value = scroll;
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
