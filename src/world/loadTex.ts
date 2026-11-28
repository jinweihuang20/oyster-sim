/**
 * 遊戲貼圖載入：優先 KTX2（GPU 保持壓縮），失敗再退回 JPG/PNG；
 * 光柵圖會縮到 texBudget（手機 ≤1024、2 的次方）。
 */
import * as THREE from 'three';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';
import { budgetCanvasSize, TEX_MED } from './texBudget';

let ktx2: KTX2Loader | null = null;
let ktx2Ready = false;

/** 啟動時呼叫一次：掛上 Basis transcoder（public/basis）並偵測 GPU 支援 */
export function initKtx2Loader(renderer: THREE.WebGLRenderer, transcoderPath = '/basis/') {
  if (!ktx2) {
    ktx2 = new KTX2Loader();
    ktx2.setTranscoderPath(transcoderPath);
  }
  try {
    ktx2.detectSupport(renderer);
    ktx2Ready = true;
  } catch {
    ktx2Ready = false;
  }
  return ktx2;
}

export function disposeKtx2Loader() {
  try { ktx2?.dispose(); } catch { /* */ }
  ktx2 = null;
  ktx2Ready = false;
}

function ktx2UrlFor(url: string): string | null {
  if (/\.ktx2(\?|$)/i.test(url)) return url;
  if (/\.(jpe?g|png|webp)(\?|$)/i.test(url)) return url.replace(/\.(jpe?g|png|webp)(\?|$)/i, '.ktx2$2');
  return null;
}

/** 把圖畫進 ≤max 的 POT 畫布（非壓縮後備） */
export function resizeImageToBudget(
  src: CanvasImageSource & { width: number; height: number },
  opts: { coarse?: boolean; eco?: boolean; kind?: 'color' | 'small' } = {},
): THREE.CanvasTexture {
  const { width, height } = budgetCanvasSize(src.width || TEX_MED, src.height || TEX_MED, {
    coarse: opts.coarse,
    eco: opts.eco,
    kind: opts.kind ?? 'color',
    pot: true,
  });
  const cv = document.createElement('canvas');
  cv.width = width;
  cv.height = height;
  const c = cv.getContext('2d')!;
  c.imageSmoothingEnabled = true;
  c.drawImage(src as CanvasImageSource, 0, 0, width, height);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function needsBudget(img: { width: number; height: number }, coarse?: boolean, eco?: boolean): boolean {
  if (coarse || eco) return true;
  if (img.width > 1024 || img.height > 1024) return true;
  const pot = (n: number) => n > 0 && (n & (n - 1)) === 0;
  return !pot(img.width) || !pot(img.height);
}

export type LoadGameTextureOpts = {
  url: string;
  /** null＝不試 KTX2；省略則自動把 .jpg/.png 換成 .ktx2 */
  ktx2Url?: string | null;
  coarse?: boolean;
  eco?: boolean;
  kind?: 'color' | 'small';
  colorSpace?: THREE.ColorSpace;
};

function applyColorSpace(tex: THREE.Texture, space: THREE.ColorSpace) {
  tex.colorSpace = space;
  tex.needsUpdate = true;
  return tex;
}

/** Promise：KTX2 → 失敗則 JPG/PNG（必要時縮到預算） */
export function loadGameTextureAsync(opts: LoadGameTextureOpts): Promise<THREE.Texture> {
  const space = opts.colorSpace ?? THREE.SRGBColorSpace;
  const prefer = opts.ktx2Url === null ? null : (opts.ktx2Url ?? ktx2UrlFor(opts.url));

  const loadRaster = () => new Promise<THREE.Texture>((resolve, reject) => {
    new THREE.TextureLoader().load(
      opts.url,
      (tex) => {
        const img = tex.image as HTMLImageElement | undefined;
        if (img && needsBudget(img, opts.coarse, opts.eco)) {
          const budgeted = resizeImageToBudget(img, opts);
          tex.dispose();
          resolve(applyColorSpace(budgeted, space));
          return;
        }
        resolve(applyColorSpace(tex, space));
      },
      undefined,
      reject,
    );
  });

  if (prefer && ktx2 && ktx2Ready) {
    return new Promise((resolve, reject) => {
      ktx2!.load(
        prefer,
        (tex) => resolve(applyColorSpace(tex, space)),
        undefined,
        () => { loadRaster().then(resolve, reject); },
      );
    });
  }
  return loadRaster();
}

/**
 * 同步建立 Material 用：先回傳佔位 Texture，載入完成後呼叫 onReady（換 map）。
 */
export function loadGameTexture(
  opts: LoadGameTextureOpts & { onReady?: (tex: THREE.Texture) => void; onError?: (err: unknown) => void },
): THREE.Texture {
  const placeholder = new THREE.Texture();
  placeholder.colorSpace = opts.colorSpace ?? THREE.SRGBColorSpace;
  loadGameTextureAsync(opts).then(
    (tex) => {
      placeholder.image = (tex as THREE.Texture).image;
      // CompressedTexture 用 copy 才能帶上 format／mipmaps
      if ((tex as THREE.CompressedTexture).isCompressedTexture) {
        placeholder.copy(tex);
      }
      placeholder.needsUpdate = true;
      opts.onReady?.(tex);
    },
    (err) => opts.onError?.(err),
  );
  return placeholder;
}
