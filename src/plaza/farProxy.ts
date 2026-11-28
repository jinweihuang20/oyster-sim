import * as THREE from 'three';
import { remoteLodSimple } from './zones';

/**
 * 遠處人物的簡易小人（LOD）：每種外型一個 InstancedMesh，整場共用、1 個 draw call。
 * 一般玩家／阿伯：圓柱身體＋圓頭；阿婆：較矮、駝背、頭往前，頭頂白髮＋後腦白髮髻。
 * 只有身體（衣服）吃每隻的顏色；皮膚、白髮維持原色（頂點屬性 tint 0/1 控制）。
 */
export type FarProxyKind = 'player' | 'ama';
export const FAR_PROXY_MAX: Record<FarProxyKind, number> = { player: 160, ama: 128 };

export interface LodState {
  carried?: boolean;
  carrying?: boolean;
  phase?: string;
  /** 飛上月球動畫進行中 */
  moonFlight?: boolean;
}

/** 被抱／抱人／飛上月球：一律維持完整角色（月球動畫照舊自己控制顯示） */
export function lodPinned(s: LodState): boolean {
  return !!s.carried || !!s.carrying || s.phase === 'moon' || !!s.moonFlight;
}

/** 這幀要不要換成簡易小人（含遲滯，玩家與 NPC 共用同一套門檻；crowd＝遠端人數，人多縮半徑） */
export function farLodStep(prevSimple: boolean, dist: number, eco: boolean, s: LodState, crowd = 0): boolean {
  return remoteLodSimple(prevSimple, dist, eco, lodPinned(s), crowd);
}

/** 阿婆用阿婆小人；阿伯、玩家用一般小人 */
export function farProxyKind(isNpc: boolean, aber: boolean): FarProxyKind {
  return isNpc && !aber ? 'ama' : 'player';
}

/** 小人高度比例：躺 0.4；坐著／坐船／蹲 0.72；站／走 1 */
export function farProxyHeight(s: { seated?: boolean; mounted?: boolean; mountStand?: boolean; phase?: string }): number {
  const ph = s.seated || s.mounted ? '' : (s.phase || '');
  if (ph === 'lie') return 0.4;
  if (s.seated || (s.mounted && !s.mountStand) || ph === 'crouch') return 0.72;
  return 1;
}

function paint(g: THREE.BufferGeometry, hex: number, tint: 0 | 1) {
  const c = new THREE.Color(hex);
  const ng = g.index ? g.toNonIndexed() : g;
  if (ng !== g) g.dispose();
  const n = ng.getAttribute('position').count;
  const col = new Float32Array(n * 3), t = new Float32Array(n);
  for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; t[i] = tint; }
  ng.setAttribute('color', new THREE.BufferAttribute(col, 3));
  ng.setAttribute('tint', new THREE.BufferAttribute(t, 1));
  return ng;
}

function merge(parts: THREE.BufferGeometry[]) {
  const n = parts.reduce((k, g) => k + g.getAttribute('position').count, 0);
  const pos = new Float32Array(n * 3), col = new Float32Array(n * 3), tint = new Float32Array(n);
  let o = 0;
  for (const g of parts) {
    const c = g.getAttribute('position').count;
    pos.set(g.getAttribute('position').array as Float32Array, o * 3);
    col.set(g.getAttribute('color').array as Float32Array, o * 3);
    tint.set(g.getAttribute('tint').array as Float32Array, o);
    o += c;
    g.dispose();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('tint', new THREE.BufferAttribute(tint, 1));
  geo.computeVertexNormals();
  return geo;
}

const SKIN = 0xf0c8a0, WHITE_HAIR = 0xe8e6e0;

export function buildFarProxyGeometry(kind: FarProxyKind): THREE.BufferGeometry {
  if (kind === 'ama') {
    // 駝背：身體上端往前（+Z）傾，頭往前伸；白髮帽＋後腦髮髻
    const body = new THREE.CylinderGeometry(0.19, 0.28, 1.02, 6, 1).translate(0, 0.51, 0).rotateX(0.16);
    const head = new THREE.SphereGeometry(0.16, 6, 4).translate(0, 1.2, 0.14);
    const cap = new THREE.SphereGeometry(0.168, 6, 3, 0, Math.PI * 2, 0, Math.PI * 0.42).translate(0, 1.21, 0.13);
    const bun = new THREE.SphereGeometry(0.085, 5, 4).translate(0, 1.3, -0.04);
    return merge([paint(body, 0xffffff, 1), paint(head, SKIN, 0), paint(cap, WHITE_HAIR, 0), paint(bun, WHITE_HAIR, 0)]);
  }
  const body = new THREE.CylinderGeometry(0.2, 0.26, 1.15, 6, 1).translate(0, 0.58, 0);
  const head = new THREE.SphereGeometry(0.17, 6, 4).translate(0, 1.36, 0);
  return merge([paint(body, 0xffffff, 1), paint(head, SKIN, 0)]);
}

/** Lambert＋頂點色；instanceColor 只乘在 tint=1 的頂點（衣服） */
export function makeFarProxyMaterial(): THREE.MeshLambertMaterial {
  const m = new THREE.MeshLambertMaterial({ vertexColors: true });
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float tint;')
      .replace('#include <color_vertex>', [
        '#if defined( USE_COLOR ) || defined( USE_INSTANCING_COLOR )',
        '  vColor = vec3( 1.0 );',
        '#endif',
        '#ifdef USE_COLOR',
        '  vColor *= color;',
        '#endif',
        '#ifdef USE_INSTANCING_COLOR',
        '  vColor *= mix( vec3( 1.0 ), instanceColor.xyz, tint );',
        '#endif',
      ].join('\n'));
  };
  m.customProgramCacheKey = () => 'farProxyTint';
  return m;
}

const _m = new THREE.Matrix4(), _s = new THREE.Vector3();

/** 一種外型的小人池：每幀 begin → push… → flush；離開時 dispose（geometry／material 全釋放） */
export class FarProxyPool {
  mesh: THREE.InstancedMesh | null = null;
  n = 0;
  constructor(readonly kind: FarProxyKind, readonly parent: THREE.Object3D, readonly max = FAR_PROXY_MAX[kind]) {}
  private ensure() {
    if (this.mesh) return this.mesh;
    const m = new THREE.InstancedMesh(buildFarProxyGeometry(this.kind), makeFarProxyMaterial(), this.max);
    m.name = this.kind === 'ama' ? 'plazaFarAmaProxies' : 'plazaFarImpostors';
    m.count = 0; m.frustumCulled = false; m.visible = false; m.castShadow = false; m.receiveShadow = false;
    this.parent.add(m);
    return (this.mesh = m);
  }
  begin() { this.n = 0; }
  /** 塞一隻小人（滿了回 false，由呼叫端改只顯示名牌） */
  push(o: THREE.Object3D, heightK: number, color: THREE.Color): boolean {
    if (this.n >= this.max) return false;
    const m = this.ensure();
    _s.set(o.scale.x, o.scale.y * heightK, o.scale.z);
    _m.compose(o.position, o.quaternion, _s);
    m.setMatrixAt(this.n, _m);
    m.setColorAt(this.n, color);
    this.n++;
    return true;
  }
  flush() {
    const m = this.mesh;
    if (!m) return;
    m.count = this.n; m.visible = this.n > 0;
    if (this.n) { m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; }
  }
  dispose() {
    const m = this.mesh;
    if (!m) return;
    m.removeFromParent(); m.geometry.dispose(); (m.material as THREE.Material).dispose(); m.dispose();
    this.mesh = null; this.n = 0;
  }
}
