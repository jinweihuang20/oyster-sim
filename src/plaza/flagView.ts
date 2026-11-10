/** 廣場旗幟 3D：共用幾何／材質，遠處不播特效，同時最多畫一批 */
import * as THREE from 'three';
import {
  FLAG_RENDER_CAP, flagColorOf, flagSizeOf,
  type PlazaFlagState,
} from './flags';

const WAVE_NEAR = 28;
const SHIMMER_NEAR = 22;
const FX3_NEAR = 18;
export const TEX_W = 256;
export const TEX_H = 160;

type FlagObj = {
  k: string;
  group: THREE.Group;
  cloth: THREE.Mesh;
  mat: THREE.MeshLambertMaterial;
  tex: THREE.CanvasTexture;
  canvas: HTMLCanvasElement;
  pillar: THREE.Group;
  sparks: THREE.Points;
  sparkPos: Float32Array;
  sparkLife: Float32Array;
  waveGeo: THREE.PlaneGeometry | null;
  text: string;
  nick: string;
  color: number;
  size: number;
  fx: number;
  seed: number;
  x: number;
  z: number;
};

function hexCss(n: number) {
  return '#' + (n >>> 0).toString(16).padStart(6, '0');
}
function shownColor(f: PlazaFlagState) { return f.colorSel; }
function shownSize(f: PlazaFlagState) { return f.sizeSel; }
function shownFx(f: PlazaFlagState) { return f.fxSel; }

export function paintFlag(canvas: HTMLCanvasElement, text: string, colorLv: number, nick = '') {
  const spec = flagColorOf(colorLv);
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, TEX_W, TEX_H);
  if (spec.style === 'gradient') {
    const g = ctx.createLinearGradient(0, 0, TEX_W, TEX_H);
    g.addColorStop(0, '#b81e28');
    g.addColorStop(0.55, '#d4af37');
    g.addColorStop(1, '#f2d36b');
    ctx.fillStyle = g;
  } else {
    ctx.fillStyle = hexCss(spec.cloth);
  }
  ctx.fillRect(0, 0, TEX_W, TEX_H);
  if (spec.style === 'foil') {
    ctx.globalAlpha = 0.22;
    ctx.fillStyle = '#fff6c8';
    for (let i = -160; i < TEX_W; i += 28) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i + 14, 0);
      ctx.lineTo(i + 54, TEX_H);
      ctx.lineTo(i + 40, TEX_H);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  const nm = (nick || '').trim().slice(0, 16);
  let t = (text || '').trim();
  if (t && nm && nm.startsWith(t)) t = ''; // 舊旗面預設文字就是名字，不要重複寫兩次
  const font = (px: number, w = 700) => `${w} ${px}px "Noto Sans TC","PingFang TC","Microsoft JhengHei","Noto Sans CJK TC",sans-serif`;
  ctx.fillStyle = hexCss(spec.text);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (t) {
    ctx.font = font(32);
    ctx.fillText(t, TEX_W / 2, nm ? TEX_H * 0.42 : TEX_H / 2, TEX_W - 24);
  }
  if (nm) {
    // 插旗玩家的名字：有自訂文字時放在下方小字，沒有就置中
    ctx.globalAlpha = t ? 0.85 : 1;
    ctx.font = t ? font(19, 600) : font(28);
    if (t) {
      ctx.fillRect(TEX_W * 0.3, TEX_H * 0.64, TEX_W * 0.4, 1.5);
    }
    ctx.fillText(nm, TEX_W / 2, t ? TEX_H * 0.78 : TEX_H / 2, TEX_W - 32);
    ctx.globalAlpha = 1;
  }
}

export function createPlazaFlagView(parent: THREE.Object3D) {
  const root = new THREE.Group();
  root.name = 'plazaFlags';
  parent.add(root);

  const poleGeo = new THREE.CylinderGeometry(0.028, 0.036, 1.9, 6);
  poleGeo.translate(0, 0.95, 0);
  poleGeo.userData.sharedGeo = true;
  const finialGeo = new THREE.SphereGeometry(0.05, 8, 6);
  finialGeo.userData.sharedGeo = true;
  const baseGeo = new THREE.CylinderGeometry(0.08, 0.11, 0.08, 6);
  baseGeo.translate(0, 0.04, 0);
  baseGeo.userData.sharedGeo = true;
  // 旗面切 10 段，飄動時逐段彎曲（離旗桿越遠擺越大）；有飄動特效的旗才各自複製一份來變形
  const clothGeo = new THREE.PlaneGeometry(1.12, 0.72, 10, 2);
  clothGeo.userData.sharedGeo = true;
  const clothBaseX = Float32Array.from({ length: clothGeo.attributes.position.count }, (_, i) => clothGeo.attributes.position.getX(i));
  const pillarGeo = new THREE.PlaneGeometry(0.42, 3.4);
  pillarGeo.translate(0, 1.7, 0);
  pillarGeo.userData.sharedGeo = true;

  const poleMat = new THREE.MeshLambertMaterial({ color: 0x4a3a2c });
  const finialMat = new THREE.MeshLambertMaterial({ color: 0xc9a227 });
  const baseMat = new THREE.MeshLambertMaterial({ color: 0x3a322c });
  const pillarMat = new THREE.MeshBasicMaterial({
    color: 0xffe08a,
    transparent: true,
    opacity: 0.26,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const sparkMat = new THREE.PointsMaterial({
    color: 0xffe9a0,
    size: 0.16,
    transparent: true,
    opacity: 0.9,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: true,
  });
  poleMat.userData.sharedMat = true;
  finialMat.userData.sharedMat = true;
  baseMat.userData.sharedMat = true;
  pillarMat.userData.sharedMat = true;
  sparkMat.userData.sharedMat = true;

  const byK = new Map<string, FlagObj>();
  const frustum = new THREE.Frustum();
  const proj = new THREE.Matrix4();
  const camPos = new THREE.Vector3();
  const tmp = new THREE.Vector3();

  function makeFlag(f: PlazaFlagState): FlagObj {
    const group = new THREE.Group();
    group.name = 'plazaFlag';
    const pole = new THREE.Mesh(poleGeo, poleMat);
    pole.castShadow = false;
    pole.receiveShadow = false;
    pole.userData.sharedGeo = true;
    pole.userData.sharedMat = true;
    const finial = new THREE.Mesh(finialGeo, finialMat);
    finial.position.y = 1.94;
    finial.userData.sharedGeo = true;
    finial.userData.sharedMat = true;
    const base = new THREE.Mesh(baseGeo, baseMat);
    base.userData.sharedGeo = true;
    base.userData.sharedMat = true;
    const canvas = document.createElement('canvas');
    canvas.width = TEX_W;
    canvas.height = TEX_H;
    paintFlag(canvas, f.text, shownColor(f), f.nick);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    const spec = flagColorOf(shownColor(f));
    const mat = new THREE.MeshLambertMaterial({
      map: tex,
      side: THREE.DoubleSide,
      transparent: false,
      emissive: spec.style === 'foil' || spec.style === 'gradient' ? 0x3a2a10 : 0x000000,
      emissiveIntensity: spec.style === 'foil' ? 0.18 : 0,
    });
    const cloth = new THREE.Mesh(clothGeo, mat);
    cloth.position.set(0.62, 1.52, 0);
    cloth.userData.sharedGeo = true;
    const pillar = new THREE.Group();
    const p1 = new THREE.Mesh(pillarGeo, pillarMat);
    const p2 = new THREE.Mesh(pillarGeo, pillarMat);
    p2.rotation.y = Math.PI / 2;
    p1.userData.sharedGeo = true;
    p1.userData.sharedMat = true;
    p2.userData.sharedGeo = true;
    p2.userData.sharedMat = true;
    pillar.add(p1, p2);
    pillar.visible = false;
    const sparkPos = new Float32Array(16 * 3);
    const sparkLife = new Float32Array(16);
    const sparkGeo = new THREE.BufferGeometry();
    sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPos, 3));
    const sparks = new THREE.Points(sparkGeo, sparkMat);
    sparks.visible = false;
    sparks.userData.sharedMat = true;
    group.add(base, pole, finial, cloth, pillar, sparks);
    const o: FlagObj = {
      k: f.k, group, cloth, mat, tex, canvas, pillar, sparks, sparkPos, sparkLife, waveGeo: null,
      text: f.text, nick: f.nick, color: shownColor(f), size: shownSize(f), fx: shownFx(f),
      seed: hashSeed(f.k), x: f.x, z: f.z,
    };
    applyPose(o, f);
    return o;
  }

  function applyPose(o: FlagObj, f: PlazaFlagState) {
    o.x = f.x; o.z = f.z;
    o.group.position.set(f.x, 0, f.z);
    o.group.rotation.y = f.yaw;
    const sc = flagSizeOf(shownSize(f)).scale;
    o.group.scale.setScalar(sc);
    if (o.text !== f.text || o.nick !== f.nick || o.color !== shownColor(f)) {
      paintFlag(o.canvas, f.text, shownColor(f), f.nick);
      o.tex.needsUpdate = true;
      const spec = flagColorOf(shownColor(f));
      o.mat.emissive.setHex(spec.style === 'foil' || spec.style === 'gradient' ? 0x3a2a10 : 0x000000);
      o.mat.emissiveIntensity = spec.style === 'foil' ? 0.18 : 0;
      o.text = f.text;
      o.nick = f.nick;
      o.color = shownColor(f);
    }
    o.size = shownSize(f);
    o.fx = shownFx(f);
    // 閃光要有發光色才看得到：一般布色原本 emissive 是黑色，強度怎麼調都不會亮
    if (o.fx >= 2) o.mat.emissive.setHex(0xffd27a);
    else { const sp = flagColorOf(o.color); o.mat.emissive.setHex(sp.style === 'foil' || sp.style === 'gradient' ? 0x3a2a10 : 0x000000); }
    if (o.fx >= 1 && !o.waveGeo) { o.waveGeo = clothGeo.clone(); o.cloth.geometry = o.waveGeo; }
    else if (o.fx < 1 && o.waveGeo) { o.cloth.geometry = clothGeo; o.waveGeo.dispose(); o.waveGeo = null; }
  }

  function bendCloth(o: FlagObj, t: number, amp: number) {
    const g = o.waveGeo;
    if (!g) return;
    const pos = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const x0 = clothBaseX[i];
      const u = (x0 + 0.56) / 1.12; // 0＝旗桿邊 → 1＝旗尾
      const y = pos.getY(i);
      pos.setZ(i, amp * u * (Math.sin(u * 5.2 - t * 4.2) * 0.16 + Math.sin(u * 2.4 - t * 2.3 + y * 1.5) * 0.06));
      pos.setX(i, x0 - amp * u * u * 0.04);
    }
    pos.needsUpdate = true;
    g.computeVertexNormals();
  }

  function hashSeed(k: string) {
    let h = 2166136261;
    for (let i = 0; i < k.length; i++) h = Math.imul(h ^ k.charCodeAt(i), 16777619);
    return (h >>> 0) / 4294967296;
  }

  function disposeFlag(o: FlagObj) {
    o.group.removeFromParent();
    o.mat.dispose();
    o.tex.dispose();
    o.sparks.geometry.dispose();
    o.waveGeo?.dispose();
  }

  function sync(list: PlazaFlagState[]) {
    const seen = new Set<string>();
    for (const f of list) {
      if (!f.planted || !f.k) continue;
      seen.add(f.k);
      const cur = byK.get(f.k);
      if (!cur) {
        const o = makeFlag(f);
        byK.set(f.k, o);
        root.add(o.group);
      } else {
        applyPose(cur, f);
      }
    }
    for (const [k, o] of byK) {
      if (seen.has(k)) continue;
      disposeFlag(o);
      byK.delete(k);
    }
  }

  function resetCloth(o: FlagObj) {
    o.cloth.rotation.y = 0;
    o.cloth.rotation.z = 0;
    o.mat.emissiveIntensity = flagColorOf(o.color).style === 'foil' ? 0.18 : 0;
    o.pillar.visible = false;
    o.sparks.visible = false;
  }

  function tickSparks(o: FlagObj, dt: number) {
    const pos = o.sparkPos;
    const life = o.sparkLife;
    for (let i = 0; i < life.length; i++) {
      let t = life[i] - dt;
      if (t <= 0) {
        t = 0.7 + Math.random() * 0.8;
        pos[i * 3] = (Math.random() - 0.5) * 0.35;
        pos[i * 3 + 1] = 1.4 + Math.random() * 0.4;
        pos[i * 3 + 2] = (Math.random() - 0.5) * 0.35;
      } else {
        pos[i * 3] += (Math.random() - 0.5) * dt * 0.4;
        pos[i * 3 + 1] += dt * (1.6 + (i % 3) * 0.25);
        pos[i * 3 + 2] += (Math.random() - 0.5) * dt * 0.4;
      }
      life[i] = t;
    }
    const attr = o.sparks.geometry.getAttribute('position') as THREE.BufferAttribute;
    attr.needsUpdate = true;
  }

  function tick(dt: number, camera: THREE.Camera) {
    if (!byK.size) return;
    camera.getWorldPosition(camPos);
    proj.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    frustum.setFromProjectionMatrix(proj);
    const ranked: { o: FlagObj; d: number }[] = [];
    for (const o of byK.values()) {
      tmp.set(o.x, 1.2, o.z);
      ranked.push({ o, d: camPos.distanceTo(tmp) });
    }
    ranked.sort((a, b) => a.d - b.d);
    const t = performance.now() * 0.001;
    let fx3 = 0;
    for (let i = 0; i < ranked.length; i++) {
      const { o, d } = ranked[i];
      const show = i < FLAG_RENDER_CAP;
      o.group.visible = show;
      if (!show) { resetCloth(o); continue; }
      tmp.set(o.x, 1.4, o.z);
      const onScreen = frustum.containsPoint(tmp);
      if (o.fx >= 1 && d < WAVE_NEAR) {
        const w = t * 2.1 + o.seed * 12;
        o.cloth.rotation.y = Math.sin(w) * 0.06;
        o.cloth.rotation.z = Math.sin(w * 0.73 + 0.4) * 0.03;
        if (onScreen) bendCloth(o, t + o.seed * 7, 1);
      } else {
        o.cloth.rotation.y = 0;
        o.cloth.rotation.z = 0;
      }
      if (o.fx >= 2 && d < SHIMMER_NEAR) {
        // 每 2.4 秒閃一下金光，平常微亮
        const ph = ((t + o.seed * 5) % 2.4) / 2.4;
        const pulse = 0.06 + 0.06 * Math.sin(t * 3.4 + o.seed * 9) + (ph < 0.18 ? Math.sin(ph / 0.18 * Math.PI) * 0.55 : 0);
        o.mat.emissiveIntensity = pulse;
      } else {
        o.mat.emissiveIntensity = flagColorOf(o.color).style === 'foil' ? 0.18 : 0;
      }
      const wantFx3 = o.fx >= 3 && d < FX3_NEAR && onScreen && fx3 < 8;
      o.pillar.visible = wantFx3;
      o.sparks.visible = wantFx3;
      if (wantFx3) {
        fx3++;
        o.pillar.rotation.y = t * 0.35 + o.seed;
        const op = 0.18 + 0.12 * (0.5 + 0.5 * Math.sin(t * 2.2 + o.seed * 5));
        // shared mat opacity would affect all pillars; skip per-flag opacity, just spin
        void op;
        tickSparks(o, dt);
      }
    }
  }

  function dispose() {
    for (const o of byK.values()) disposeFlag(o);
    byK.clear();
    root.removeFromParent();
    poleGeo.dispose();
    finialGeo.dispose();
    baseGeo.dispose();
    clothGeo.dispose();
    pillarGeo.dispose();
    poleMat.dispose();
    finialMat.dispose();
    baseMat.dispose();
    pillarMat.dispose();
    sparkMat.dispose();
  }

  return { root, sync, tick, dispose };
}

export type PlazaFlagView = ReturnType<typeof createPlazaFlagView>;
