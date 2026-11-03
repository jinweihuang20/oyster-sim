import * as THREE from 'three';
import { COVER_DEF, HALF, PILES } from './constants';
import type { DmUmb } from './types';
import type { MatFn, MeshAdd } from './weapons';
import type { Breakable } from './breakables';

export type ArenaDeps = {
  scene: THREE.Scene;
  LO: boolean;
  M: MatFn;
  add: MeshAdd;
  U: Pick<DmUmb, 'shellGeos' | 'shellMat' | 'greyPick'>;
  regBreak: (root: THREE.Object3D, kind: 'fly' | 'solid', hp: number, halfH: number, rad: number, coverIdx?: number, mass?: number) => Breakable;
};

/** 燈光、場地、外景、圍牆、掩體、氛圍道具、蚵仔堆 */
export function buildArena(deps: ArenaDeps) {
  const { scene, LO, M, add, U, regBreak } = deps;
  // 黃昏漁港燈光（同上工場景色調，亮度調高方便瞄準）
  scene.add(new THREE.HemisphereLight(0xffc8b0, 0x3a2a20, LO ? 1.7 : 1.5)); scene.add(new THREE.AmbientLight(0xffe0c8, LO ? 0.55 : 0.35));
  const sun = new THREE.DirectionalLight(0xffb070, LO ? 1.35 : 1.6);
  // 黃昏漸層天空＋夕陽光暈
  {
    const sunDir = new THREE.Vector3(-12, 5, -18).normalize();
    const sky = new THREE.Mesh(new THREE.SphereGeometry(60, LO ? 16 : 32, LO ? 8 : 16), new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, uniforms: { sd: { value: sunDir } },
      vertexShader: 'varying vec3 v;void main(){v=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader: 'uniform vec3 sd;varying vec3 v;void main(){float h=v.y;vec3 top=vec3(.16,.17,.42),mid=vec3(.62,.38,.52),hor=vec3(1.,.6,.4),low=vec3(.35,.24,.26);' +
        'vec3 c=h>0.?mix(hor,mix(mid,top,smoothstep(.15,.7,h)),smoothstep(0.,.18,h)):mix(hor,low,smoothstep(0.,-.15,h));' +
        'float s=max(dot(v,sd),0.);c+=vec3(1.,.7,.4)*(pow(s,8.)*.45+pow(s,200.)*1.2);gl_FragColor=vec4(c,1.);}' }));
    sky.renderOrder = -1; sky.frustumCulled = false; scene.add(sky);
  } sun.position.set(-12, 16, -18); sun.castShadow = !LO;
  if (!LO) { Object.assign(sun.shadow.camera, { left: -20, right: 20, top: 20, bottom: -20, far: 60 }); sun.shadow.mapSize.set(1024, 1024); sun.shadow.bias = -0.002; }
  scene.add(sun);
  // ---- 場地：蚵寮沙地（程序紋理＋濕沙／殼屑） ----
  {
    const sz = LO ? 128 : 256;
    const cv = document.createElement('canvas'); cv.width = cv.height = sz;
    const ctx = cv.getContext('2d')!;
    // 底：暖沙
    ctx.fillStyle = '#c4a878'; ctx.fillRect(0, 0, sz, sz);
    // 粗粒雜訊：淺沙／深沙／殼白點
    for (let i = 0; i < (LO ? 2800 : 9000); i++) {
      const x = Math.random() * sz, y = Math.random() * sz, r = 0.4 + Math.random() * 1.8;
      const roll = Math.random();
      ctx.fillStyle = roll < 0.55 ? `rgba(${168 + Math.random() * 40 | 0},${130 + Math.random() * 35 | 0},${80 + Math.random() * 30 | 0},${0.25 + Math.random() * 0.45})`
        : roll < 0.88 ? `rgba(${210 + Math.random() * 35 | 0},${185 + Math.random() * 30 | 0},${130 + Math.random() * 25 | 0},${0.2 + Math.random() * 0.4})`
        : `rgba(${220 + Math.random() * 30 | 0},${210 + Math.random() * 25 | 0},${190 + Math.random() * 20 | 0},${0.15 + Math.random() * 0.35})`;
      ctx.beginPath(); ctx.arc(x, y, r, 0, 6.28); ctx.fill();
    }
    // 幾道被踩過的淺痕
    for (let i = 0; i < (LO ? 4 : 9); i++) {
      ctx.strokeStyle = `rgba(140,110,70,${0.12 + Math.random() * 0.18})`;
      ctx.lineWidth = 2 + Math.random() * 5;
      ctx.beginPath();
      const x0 = Math.random() * sz, y0 = Math.random() * sz;
      ctx.moveTo(x0, y0);
      ctx.quadraticCurveTo(x0 + (Math.random() - .5) * 80, y0 + (Math.random() - .5) * 80, x0 + (Math.random() - .5) * 120, y0 + (Math.random() - .5) * 120);
      ctx.stroke();
    }
    const sandTex = new THREE.CanvasTexture(cv);
    sandTex.colorSpace = THREE.SRGBColorSpace;
    sandTex.wrapS = sandTex.wrapT = THREE.RepeatWrapping;
    sandTex.anisotropy = LO ? 1 : 4;
    sandTex.repeat.set(8, 8);
    const floor = add(new THREE.PlaneGeometry(HALF * 2 + 4, HALF * 2 + 4), M(0xc2a67a, { map: sandTex, roughness: 1, metalness: 0 }), [0, 0, 0]);
    floor.rotation.x = -Math.PI / 2;
    // 濕沙斑（潮水／潑水）
    const wet = M(0x8a7048, { roughness: 0.55, transparent: true, opacity: 0.42 }), wetG = new THREE.CircleGeometry(1, LO ? 8 : 14);
    for (let i = 0; i < (LO ? 10 : 22); i++) {
      const d = add(wetG, wet, [(Math.random() - .5) * 34, 0.012, (Math.random() - .5) * 34], scene, false);
      d.rotation.x = -Math.PI / 2; d.scale.set(0.6 + Math.random() * 2.2, 0.4 + Math.random() * 1.4, 1);
    }
    // 深色潮痕帶（靠北側碼頭）
    const tide = add(new THREE.PlaneGeometry(HALF * 2 - 2, 3.5), M(0x7a6540, { roughness: 0.7, transparent: true, opacity: 0.35 }), [0, 0.014, -HALF + 3.2], scene, false);
    tide.rotation.x = -Math.PI / 2;
    // 殼屑／小石粒
    const gritCols = [0xd8c8a8, 0xb89868, 0x9a8060, 0xe8e0d0, 0x6a5a40];
    for (let i = 0; i < (LO ? 40 : 110); i++) {
      const s = 0.04 + Math.random() * 0.1;
      const g = add(new THREE.BoxGeometry(s, 0.02, s * (0.5 + Math.random())), M(gritCols[i % gritCols.length], { roughness: 1 }), [(Math.random() - .5) * 36, 0.02, (Math.random() - .5) * 36], scene, false);
      g.rotation.y = Math.random() * 6;
    }
  }

  // ---- 外景：碼頭／海水／漁船／倉庫（牆外，玩家走不到） ----
  {
    const dirt = M(0xb89868, { roughness: 0.98 });
    for (const [x, z, w, d] of [[0, HALF + 14, 80, 28], [-HALF - 14, 0, 28, 80], [HALF + 14, 0, 28, 80]] as const) {
      const gnd = add(new THREE.PlaneGeometry(w, d), dirt, [x, -0.02, z], scene, false); gnd.rotation.x = -Math.PI / 2;
    }
    const water = add(new THREE.PlaneGeometry(120, 70), M(0x3a4a6a, { roughness: 0.22, metalness: 0.35 }), [0, -0.55, -HALF - 22], scene, false); water.rotation.x = -Math.PI / 2;
    add(new THREE.BoxGeometry(HALF * 2 + 8, 0.35, 3.2), M(0x7a7468), [0, -0.2, -HALF - 3.2], scene, false);
    const flagCols = [0xd03030, 0x2a5ad0, 0xf0c020, 0x30a050];
    for (let i = 0; i < 6; i++) {
      const g = new THREE.Group(); g.position.set(-14 + i * 5.5 + (Math.random() - .5), -0.5, -HALF - 8 - (i % 2) * 3); g.rotation.y = (Math.random() - .5) * 0.4; scene.add(g);
      add(new THREE.BoxGeometry(3.0, 0.65, 1.05), M([0xe8e8e0, 0x2a6ab0, 0xd8d0b0][i % 3]), [0, 0.35, 0], g, false);
      add(new THREE.BoxGeometry(3.05, 0.1, 1.1), M(0xb03030), [0, 0.05, 0], g, false);
      add(new THREE.BoxGeometry(0.9, 0.55, 0.75), M(0xf0f0e8), [0.55, 0.95, 0], g, false);
      add(new THREE.CylinderGeometry(0.03, 0.03, 2.0, 4), M(0x333333), [-0.55, 1.6, 0], g, false);
      for (let k = 0; k < 3; k++) add(new THREE.PlaneGeometry(0.32, 0.2), new THREE.MeshBasicMaterial({ color: flagCols[(i + k) % 4], side: THREE.DoubleSide }), [-0.4, 2.4 - k * 0.28, 0], g, false);
    }
    for (let i = 0; i < 5; i++) add(new THREE.CylinderGeometry(0.45 - i * 0.05, 0.5 - i * 0.05, 1.1, 8), M(i % 2 ? 0xf2f2ee : 0xc8302a), [-22, 0.2 + i * 1.1, -HALF - 28], scene, false);
    add(new THREE.ConeGeometry(0.45, 0.55, 8), M(0x2a2a2a), [-22, 5.85, -HALF - 28], scene, false);
    add(new THREE.BoxGeometry(40, 0.5, 1.0), M(0x8a8a84), [0, -0.1, -HALF - 18], scene, false);
    // 外側簡易倉庫／貨櫃剪影
    for (const [x, z, c] of [[-HALF - 6, 8, 0xb04030], [-HALF - 7, -6, 0x3a6a9a], [HALF + 6, -4, 0xc8a030], [HALF + 7, 10, 0x4a7a4a], [6, HALF + 7, 0x8a8a90]] as const) {
      add(new THREE.BoxGeometry(4.2, 2.4, 2.2), M(c, { metalness: 0.2, roughness: 0.65 }), [x, 1.2, z], scene, false);
    }
  }
  
  // ---- 圍牆：木柱＋鐵皮（四面中段開大門看得到外景）＋轉角雨棚 ----
  const tin = M(0x6f7a80, { roughness: 0.6, metalness: 0.3 }), tinD = M(0x56606a, { roughness: 0.6, metalness: 0.3 }), woodPost = M(0x5a4030);
  const steel = M(0x707070, { metalness: 0.5, roughness: 0.4 }), rib = new THREE.BoxGeometry(0.08, 2.4, 0.08), postG = new THREE.BoxGeometry(0.22, 3.2, 0.22);
  function wallSeg(x: number, z: number, w: number, d: number, h = 2.4, y = 1.2) {
    add(new THREE.BoxGeometry(w, h, d), tin, [x, y, z]);
    const alongX = w >= d, len = Math.max(w, d), n = Math.max(2, Math.round(len / 0.55));
    for (let k = 0; k < n; k++) {
      const u = -len / 2 + (k + .5) * len / n;
      add(rib, tinD, alongX ? [x + u, y, z - Math.sign(z || 1) * 0.16] : [x - Math.sign(x || 1) * 0.16, y, z + u], scene, false);
    }
  }
  for (const side of ['n', 's', 'e', 'w'] as const) {
    const gate = 5.5, span = HALF * 2, edge = HALF, half = (span - gate) / 2;
    if (side === 'n' || side === 's') {
      const z = side === 'n' ? -edge : edge, sign = side === 'n' ? -1 : 1;
      wallSeg(-span / 2 + half / 2, z, half, 0.28); wallSeg(span / 2 - half / 2, z, half, 0.28);
      add(new THREE.BoxGeometry(gate + 0.4, 0.18, 0.22), woodPost, [0, 2.55, z]);
      add(new THREE.BoxGeometry(gate + 0.6, 0.08, 1.4), tinD, [0, 2.7, z + sign * 0.4], scene, false);
      for (const sx of [-gate / 2, gate / 2]) add(postG, woodPost, [sx, 1.6, z]);
    } else {
      const x = side === 'w' ? -edge : edge, sign = side === 'w' ? -1 : 1;
      wallSeg(x, -span / 2 + half / 2, 0.28, half); wallSeg(x, span / 2 - half / 2, 0.28, half);
      add(new THREE.BoxGeometry(0.22, 0.18, gate + 0.4), woodPost, [x, 2.55, 0]);
      add(new THREE.BoxGeometry(1.4, 0.08, gate + 0.6), tinD, [x + sign * 0.4, 2.7, 0], scene, false);
      for (const sz of [-gate / 2, gate / 2]) add(postG, woodPost, [x, 1.6, sz]);
    }
  }
  for (const [x, z] of [[-HALF, -HALF], [HALF, HALF], [-HALF, HALF], [HALF, -HALF]]) add(postG, woodPost, [x, 1.6, z]);
  for (const [x, z] of [[-12, -12], [12, 12], [-12, 12], [12, -12]]) {
    add(new THREE.BoxGeometry(5.5, 0.08, 5.5), tinD, [x, 3.15, z], scene, false);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) add(new THREE.CylinderGeometry(0.06, 0.07, 3.15, 5), steel, [x + sx * 2.4, 1.55, z + sz * 2.4], scene, false);
  }
  
  // ---- 掩體 ----
  const wood = M(0x8a6440), woodD = M(0x5e4128), blue = M(0x2a6ad0, { roughness: 0.5 }), tableTop = M(0x9a9a92, { roughness: 0.4, metalness: 0.4 }), tireM = M(0x222222, { roughness: 0.9 });
  COVER_DEF.forEach(([x, z, w, d, h, k], ci) => {
    const g = new THREE.Group(); g.position.set(x, 0, z); scene.add(g);
    if (k === 'crate') {
      const nx = Math.round(Math.max(w, d) / 1.2), along = w >= d;
      for (let i = 0; i < nx; i++) for (let j = 0; j < 2; j++) {
        const off = -Math.max(w, d) / 2 + (i + .5) * Math.max(w, d) / nx, sz = Math.min(w, d);
        const c = add(new THREE.BoxGeometry(along ? Math.max(w, d) / nx - 0.04 : sz, h / 2 - 0.02, along ? sz : Math.max(w, d) / nx - 0.04), wood.clone(), [along ? off : 0, h / 4 + j * h / 2, along ? 0 : off], g);
        c.rotation.y = (Math.random() - .5) * 0.06;
        add(new THREE.BoxGeometry(along ? Math.max(w, d) / nx : sz + 0.02, 0.06, along ? sz + 0.02 : Math.max(w, d) / nx), woodD.clone(), [along ? off : 0, j * h / 2 + h / 4, along ? 0 : off], g, false);
      }
      regBreak(g, 'solid', 5, h / 2, Math.max(w, d) / 2, ci, 2.2);
    } else if (k === 'basket') {
      const along = w >= d, n = Math.round(Math.max(w, d) / 0.55);
      for (let i = 0; i < n; i++) for (let j = 0; j < 4; j++) {
        const off = -Math.max(w, d) / 2 + (i + .5) * Math.max(w, d) / n;
        add(new THREE.BoxGeometry(along ? 0.52 : Math.min(w, d), h / 4 - 0.02, along ? Math.min(w, d) : 0.52), blue.clone(), [along ? off : 0, h / 8 + j * h / 4, along ? 0 : off], g);
      }
      regBreak(g, 'solid', 4, h / 2, Math.max(w, d) / 2, ci, 1.6);
    } else if (k === 'tires') {
      for (let j = 0; j < 4; j++) {
        const t = add(new THREE.TorusGeometry(0.38, 0.14, 6, 12), tireM.clone(), [(Math.random() - .5) * 0.15, 0.16 + j * 0.28, (Math.random() - .5) * 0.15], g);
        t.rotation.x = Math.PI / 2; t.rotation.z = (Math.random() - .5) * 0.2;
      }
      regBreak(g, 'solid', 4, h / 2, Math.max(w, d) / 2, ci, 2.5);
    } else {
      add(new THREE.BoxGeometry(w, 0.06, d), tableTop.clone(), [0, h - 0.03, 0], g);
      add(new THREE.BoxGeometry(w - 0.1, h - 0.1, 0.04), steel.clone(), [0, (h - 0.06) / 2, 0], g);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) add(new THREE.BoxGeometry(0.06, h, 0.06), steel.clone(), [sx * (w / 2 - 0.05), h / 2, sz * (d / 2 - 0.05)], g);
      for (let i = 0; i < 10; i++) { const sh = add(U.shellGeos[i % 6], U.shellMat, [(Math.random() - .5) * (w - .3), h + 0.03, (Math.random() - .5) * (d - .3)], g); sh.rotation.y = Math.random() * 6; }
      regBreak(g, 'solid', 6, h / 2, Math.max(w, d) / 2, ci, 3);
    }
  });
  
  // ---- 氛圍道具：塑膠椅、水桶、冰櫃、臉盆、掛網、電線燈泡、機車、帆布 ----
  const red = M(0xd04040, { roughness: 0.5 }), stoolG = new THREE.CylinderGeometry(0.17, 0.15, 0.3, 10);
  for (const [x, z] of [[-15, -3], [-14.6, -2.4], [15, 4], [6, 16], [-6, -16], [3, -15.5], [-15.5, 10], [14.5, -10], [8, -15.5]]) {
    const m = add(stoolG, red.clone(), [x, 0.15, z]); regBreak(m, 'fly', 1, 0.15, 0.22, -1, 0.7);
  }
  for (const [x, z, c] of [[16.5, -16.5, 0xd07a2a], [-16.5, 16.5, 0x3a8a4a], [16.5, 9, 0x3a8a4a], [-15.8, -8, 0x2a6ad0], [9, 16.2, 0xd07a2a]] as const) {
    const m = add(new THREE.CylinderGeometry(0.22, 0.17, 0.45, 10), M(c), [x, 0.22, z]); regBreak(m, 'fly', 1, 0.22, 0.28, -1, 0.9);
  }
  // 冰櫃（較重 solid）／保麗龍箱（打飛）
  const foam = M(0xe8e4d8), fridgeMat = M(0xc8d0d8, { metalness: 0.25, roughness: 0.45 });
  for (const [x, z] of [[-16.2, -5], [16.2, 6]]) {
    const g = new THREE.Group(); g.position.set(x, 0, z); scene.add(g);
    add(new THREE.BoxGeometry(0.7, 1.1, 0.55), fridgeMat.clone(), [0, 0.55, 0], g);
    add(new THREE.BoxGeometry(0.65, 0.08, 0.5), M(0x333333), [0, 1.05, 0], g, false);
    regBreak(g, 'solid', 7, 0.55, 0.45, -1, 4);
  }
  for (const [x, z] of [[-5, 16.3], [11, -16.3], [-16.3, 2]]) {
    const m = add(new THREE.BoxGeometry(0.85, 0.55, 0.55), foam.clone(), [x, 0.28, z]); regBreak(m, 'fly', 2, 0.28, 0.5, -1, 0.5);
  }
  // 紅臉盆
  const basin = M(0xc84030, { side: THREE.DoubleSide, roughness: 0.6 });
  for (const [x, z] of [[-14, 14], [13, -14], [-2, 16.4], [16.2, -3]]) {
    const m = add(new THREE.CylinderGeometry(0.28, 0.22, 0.16, 12, 1, true), basin.clone(), [x, 0.1, z]); regBreak(m, 'fly', 1, 0.1, 0.3, -1, 0.55);
  }
  // 掛在牆上的漁網／帆布
  const netM = new THREE.MeshBasicMaterial({ color: 0x4a6a50, transparent: true, opacity: 0.45, side: THREE.DoubleSide });
  const tarpM = M(0x2a5a9a, { side: THREE.DoubleSide, roughness: 0.7 });
  for (const [x, z, rx] of [[0, -HALF + 0.2, 0], [0, HALF - 0.2, 0], [-HALF + 0.2, 6, Math.PI / 2], [HALF - 0.2, -6, Math.PI / 2]] as const) {
    const n = add(new THREE.PlaneGeometry(4.5, 2.2), netM, [x, 1.5, z], scene, false); n.rotation.y = rx;
  }
  for (const [x, z, a] of [[-10, -HALF + 0.25, 0], [10, HALF - 0.25, 0]] as const) { const t = add(new THREE.PlaneGeometry(3.2, 1.6), tarpM, [x, 2.0, z], scene, false); t.rotation.y = a; t.rotation.x = -0.15; }
  // 中央上方電線＋燈泡（手機只留發光球，不掛 PointLight）
  const glowM = new THREE.MeshBasicMaterial({ color: 0xffd9a0 }), wireM = M(0x1a1a1a);
  const bulbAt = (x: number, y: number, z: number, lit = false) => {
    add(new THREE.SphereGeometry(0.09, LO ? 6 : 8, LO ? 4 : 6), glowM, [x, y, z], scene, false);
    add(new THREE.CylinderGeometry(0.03, 0.04, 0.08, 6), M(0x333333), [x, y + 0.08, z], scene, false);
    if (lit && !LO) { const l = new THREE.PointLight(0xffb060, 14, 12, 1.6); l.position.set(x, y, z); scene.add(l); }
  };
  add(new THREE.BoxGeometry(22, 0.03, 0.03), wireM, [0, 3.4, 0], scene, false);
  add(new THREE.BoxGeometry(0.03, 0.03, 18), wireM, [0, 3.35, 0], scene, false);
  for (const [x, z, lit] of [[-8, 0, false], [-4, 0, true], [0, 0, false], [4, 0, true], [8, 0, false], [0, -6, false], [0, 6, false]] as const) {
    add(new THREE.BoxGeometry(0.02, 0.45, 0.02), wireM, [x, 3.15, z], scene, false); bulbAt(x, 2.9, z, lit);
  }
  // 轉角路燈（手機：僅兩角＋無點光）
  const lampPos = LO ? [[-17, -17], [17, 17]] as const : [[-17, -17], [17, 17], [-17, 17], [17, -17]] as const;
  for (const [x, z] of lampPos) { add(new THREE.CylinderGeometry(0.05, 0.06, 3.4, 6), steel, [x * 0.97, 1.7, z * 0.97]); add(new THREE.SphereGeometry(0.12, 8, 6), glowM, [x * 0.97, 3.4, z * 0.97], scene, false);
    if (!LO) { const l = new THREE.PointLight(0xffb060, 16, 13, 1.6); l.position.set(x * 0.93, 3.3, z * 0.93); scene.add(l); } }
  // 靠牆機車（大型：只留彈痕）
  {
    const bike = new THREE.Group(); bike.position.set(15.5, 0, 14.2); bike.rotation.y = -0.6; scene.add(bike);
    add(new THREE.BoxGeometry(1.35, 0.35, 0.35), M(0x2a4a8a), [0, 0.55, 0], bike, false);
    add(new THREE.BoxGeometry(0.45, 0.35, 0.4), M(0x1a1a1a), [0.55, 0.85, 0], bike, false);
    const wh = M(0x111111); for (const wx of [-0.45, 0.5]) { const w = add(new THREE.TorusGeometry(0.28, 0.06, 5, 10), wh, [wx, 0.28, 0], bike, false); w.rotation.y = Math.PI / 2; }
    regBreak(bike, 'solid', 8, 0.5, 0.8, -1, 5);
  }
  // 帆布遮陽（靠北側門邊，柱子貼牆不擋動線）
  {
    const canopy = add(new THREE.PlaneGeometry(6, 3.2), M(0xb84838, { side: THREE.DoubleSide, roughness: 0.85 }), [0, 3.2, -HALF + 2.2], scene, false);
    canopy.rotation.x = Math.PI / 2; canopy.rotation.z = 0.05;
    for (const x of [-2.8, 2.8]) add(new THREE.CylinderGeometry(0.05, 0.05, 3.2, 5), woodPost, [x, 1.6, -HALF + 0.55], scene, false);
  }
  // 蚵仔堆：共用上工的蚵殼幾何／材質，InstancedMesh
  const PILE_N = LO ? 48 : 160;
  const coneM = M(0x6a7c94, { roughness: 0.95, emissive: 0x24262a }), coneG = new THREE.ConeGeometry(0.9, 0.55, LO ? 6 : 10), dmy = new THREE.Object3D(), col = new THREE.Color();
  PILES.forEach((pp, pi) => {
    add(coneG, coneM, [pp.x, 0.27, pp.z]);
    const im = new THREE.InstancedMesh(U.shellGeos[pi % U.shellGeos.length], U.shellMat, PILE_N); im.castShadow = !LO;
    for (let i = 0; i < PILE_N; i++) { const a = Math.random() * 6.28, r = Math.sqrt(Math.random()) * 1.0, hh = Math.max(0, 0.55 * (1 - r / 0.95)); dmy.position.set(pp.x + Math.cos(a) * r, hh + 0.03, pp.z + Math.sin(a) * r); dmy.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3); dmy.updateMatrix(); im.setMatrixAt(i, dmy.matrix); im.setColorAt(i, col.setHex(U.greyPick())); }
    scene.add(im);
  });
}
