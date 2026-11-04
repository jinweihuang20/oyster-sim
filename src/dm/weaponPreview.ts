import * as THREE from 'three';
import { WEAPON_DEFS, buildWeaponView, type WeaponId, type WeaponViewCtx } from './weapons';

export type WeaponPreviewCtx = {
  shellGeos: THREE.BufferGeometry[];
  shellMat: THREE.Material;
};

export type WeaponPreviewOpts = {
  id: WeaponId;
  ctx: WeaponPreviewCtx;
  /** 預覽框下方操作區（按鈕等） */
  actionsHtml?: string;
  /** 掛上 DOM 後綁定按鈕 */
  bindActions?: (root: HTMLElement, close: () => void) => void;
};

let activeClose: (() => void) | null = null;

function viewCtx(ctx: WeaponPreviewCtx): WeaponViewCtx {
  const M = (c: number, o: Partial<THREE.MeshStandardMaterialParameters> = {}) =>
    new THREE.MeshStandardMaterial({ color: c, roughness: 0.85, flatShading: true, ...o });
  const add: WeaponViewCtx['add'] = (g, m, p, parent) => {
    const mesh = new THREE.Mesh(g, m);
    mesh.position.set(...p);
    parent?.add(mesh);
    return mesh;
  };
  return { M, add, LO: false, shellGeos: ctx.shellGeos, shellMat: ctx.shellMat };
}

/** 雜貨店／死鬥：點武器開 3D 預覽，手指／滑鼠拖曳旋轉 */
export function openWeaponPreview(opts: WeaponPreviewOpts) {
  activeClose?.();
  const def = WEAPON_DEFS[opts.id];
  const root = document.createElement('div');
  root.className = 'wpnPrev';
  root.innerHTML = `<div class="wpnPrevBox">
<button type="button" class="wpnPrevX" aria-label="關閉">✕</button>
<b class="wpnPrevTitle">${def.name}</b>
<small class="wpnPrevBlurb">${def.blurb}</small>
<div class="wpnPrevStage"><canvas></canvas><span class="wpnPrevHint">拖曳可旋轉</span></div>
<div class="wpnPrevMeta">傷害 ${def.damage}　彈匣 ${def.maxAmmo}　射速 ${def.fireRate.toFixed(1)}/s${def.burstCount > 1 ? `　${def.burstCount} 連發` : ''}${def.pelletCount > 1 ? `　散彈 ×${def.pelletCount}` : ''}　彈速 ${def.bulletSpeed}${def.zoom > 1 ? `　開鏡 ${def.zoom}×` : ''}</div>
<div class="wpnPrevAct">${opts.actionsHtml ?? ''}</div>
</div>`;
  document.body.appendChild(root);

  const canvas = root.querySelector('canvas')!;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(35, 1, 0.05, 20);
  cam.position.set(0.55, 0.28, 1.15);
  cam.lookAt(0, 0.02, -0.15);
  scene.add(new THREE.AmbientLight(0xfff0e0, 0.85));
  const key = new THREE.DirectionalLight(0xffe0c0, 1.1); key.position.set(2, 3, 2); scene.add(key);
  const fill = new THREE.DirectionalLight(0x88aacc, 0.35); fill.position.set(-2, 1, -1); scene.add(fill);

  const pivot = new THREE.Group();
  scene.add(pivot);
  const gun = buildWeaponView(opts.id, viewCtx(opts.ctx));
  gun.rotation.set(0.15, Math.PI * 0.15, 0);
  gun.position.set(0, 0.02, 0);
  pivot.add(gun);

  let yaw = 0.35, pitch = 0.12, auto = true;
  let dragging = false, lx = 0, ly = 0, raf = 0, dead = false;

  const size = () => {
    const stage = root.querySelector('.wpnPrevStage') as HTMLElement;
    const w = Math.max(160, stage.clientWidth);
    const h = Math.max(160, stage.clientHeight);
    renderer.setSize(w, h, false);
    cam.aspect = w / h; cam.updateProjectionMatrix();
  };
  size();
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(size) : null;
  ro?.observe(root.querySelector('.wpnPrevStage')!);

  const onDown = (e: PointerEvent) => {
    dragging = true; auto = false; lx = e.clientX; ly = e.clientY;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };
  const onMove = (e: PointerEvent) => {
    if (!dragging) return;
    yaw += (e.clientX - lx) * 0.01;
    pitch = Math.max(-0.6, Math.min(0.7, pitch + (e.clientY - ly) * 0.008));
    lx = e.clientX; ly = e.clientY;
  };
  const onUp = () => { dragging = false; };
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onUp);
  canvas.addEventListener('pointerleave', onUp);

  const tick = () => {
    if (dead) return;
    raf = requestAnimationFrame(tick);
    if (auto) yaw += 0.008;
    pivot.rotation.set(pitch, yaw, 0);
    renderer.render(scene, cam);
  };
  tick();

  const close = () => {
    if (dead) return;
    dead = true; activeClose = null;
    cancelAnimationFrame(raf);
    ro?.disconnect();
    canvas.removeEventListener('pointerdown', onDown);
    canvas.removeEventListener('pointermove', onMove);
    canvas.removeEventListener('pointerup', onUp);
    canvas.removeEventListener('pointercancel', onUp);
    canvas.removeEventListener('pointerleave', onUp);
    renderer.dispose();
    root.remove();
  };
  activeClose = close;
  root.querySelector('.wpnPrevX')!.addEventListener('click', close);
  root.addEventListener('click', e => { if (e.target === root) close(); });
  opts.bindActions?.(root, close);
  return close;
}

/** ESC／關閉鈕：關掉目前開著的武器預覽 */
export function closeWeaponPreview(): boolean {
  if (!activeClose) return false;
  activeClose();
  return true;
}

export function weaponPreviewCss(): string {
  return `
.wpnPrev{position:fixed;inset:0;z-index:10050;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;padding:12px;touch-action:none}
.wpnPrevBox{position:relative;width:min(92vw,380px);background:rgba(28,20,12,.96);border:2px solid #d9952b;border-radius:14px;color:#fff4dc;padding:14px 14px 12px;display:flex;flex-direction:column;gap:8px;box-shadow:0 12px 40px rgba(0,0,0,.45)}
.wpnPrevX{position:absolute;right:8px;top:8px;width:40px;height:40px;border:0;border-radius:10px;background:rgba(255,255,255,.08);color:inherit;font-size:18px;cursor:pointer}
.wpnPrevTitle{font-size:18px;font-weight:800;padding-right:44px}
.wpnPrevBlurb{opacity:.75;font-size:13px;line-height:1.35}
.wpnPrevStage{position:relative;height:min(42vh,260px);border-radius:12px;background:radial-gradient(ellipse at 50% 70%,#3a2a18 0%,#1a120c 70%);overflow:hidden;touch-action:none;cursor:grab}
.wpnPrevStage:active{cursor:grabbing}
.wpnPrevStage canvas{width:100%!important;height:100%!important;display:block}
.wpnPrevHint{position:absolute;left:10px;bottom:8px;font-size:11px;opacity:.55;pointer-events:none}
.wpnPrevMeta{font-size:12px;opacity:.8;line-height:1.4}
.wpnPrevAct{display:flex;gap:8px;flex-wrap:wrap;justify-content:center}
.wpnPrevAct button{min-height:44px;min-width:100px;padding:8px 14px;border-radius:10px;border:1px solid rgba(255,255,255,.25);background:#d9952b;color:#2a1600;font-weight:700;cursor:pointer}
.wpnPrevAct button:disabled{opacity:.45;cursor:default}
.wpnPrevAct button.ghost{background:rgba(255,255,255,.08);color:#fff4dc}
.wpnRow{cursor:pointer}
.wpnRow:hover{background:rgba(255,255,255,.04)}
`;
}
