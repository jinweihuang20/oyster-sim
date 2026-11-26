import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import {
  FAR_PROXY_MAX, FarProxyPool, buildFarProxyGeometry, farLodStep, farProxyHeight, farProxyKind, lodPinned,
} from './farProxy';
import { REMOTE_FULL_R, REMOTE_FULL_R_ECO, REMOTE_LOD_HYST } from './zones';
import { PILE_COUNT, NPC_SLOTS_PER_PILE, PLAZA_CAPACITY } from './layout';

const R = REMOTE_FULL_R, H = REMOTE_LOD_HYST;

describe('遠處 NPC 阿婆 LOD', () => {
  it('阿婆用阿婆小人，阿伯與玩家用一般小人', () => {
    expect(farProxyKind(true, false)).toBe('ama');
    expect(farProxyKind(true, true)).toBe('player');
    expect(farProxyKind(false, false)).toBe('player');
  });

  it('跟玩家同一套門檻：34 m／省電 26 m 內完整，超過＋遲滯換小人（不隱形）', () => {
    expect(farLodStep(false, R, false, {})).toBe(false);
    expect(farLodStep(false, R + H + 0.1, false, {})).toBe(true);
    expect(farLodStep(false, 300, false, {})).toBe(true);
    expect(farLodStep(false, REMOTE_FULL_R_ECO, true, {})).toBe(false);
    expect(farLodStep(false, REMOTE_FULL_R_ECO + H + 0.1, true, {})).toBe(true);
  });

  it('邊界來回走不閃，走回門檻內才還原完整阿婆', () => {
    let s = false;
    const seq = [R - 2, R + 2, R + H + 1, R + 2, R - 2, R - H - 0.1].map(d => (s = farLodStep(s, d, false, {})));
    expect(seq).toEqual([false, false, true, true, true, false]);
  });

  it('被抱著／抱人／飛上月球：一律完整模型', () => {
    for (const st of [{ carried: true }, { carrying: true }, { phase: 'moon' }, { moonFlight: true }]) {
      expect(lodPinned(st)).toBe(true);
      expect(farLodStep(true, 200, false, st)).toBe(false);
    }
    expect(lodPinned({ phase: 'stand' })).toBe(false);
  });

  it('坐著壓矮、站著／走路原高、蹲矮、躺扁；坐船也算坐', () => {
    expect(farProxyHeight({ seated: true })).toBe(0.72);
    expect(farProxyHeight({ phase: 'stand' })).toBe(1);
    expect(farProxyHeight({ phase: '' })).toBe(1);
    expect(farProxyHeight({ phase: 'crouch' })).toBe(0.72);
    expect(farProxyHeight({ phase: 'lie' })).toBe(0.4);
    expect(farProxyHeight({ mounted: true })).toBe(0.72);
    expect(farProxyHeight({ mounted: true, mountStand: true })).toBe(1);
  });

  it('阿婆小人有白髮（不吃衣服色）且比一般小人矮', () => {
    const ama = buildFarProxyGeometry('ama'), pl = buildFarProxyGeometry('player');
    ama.computeBoundingBox(); pl.computeBoundingBox();
    expect(ama.boundingBox!.max.y).toBeLessThan(pl.boundingBox!.max.y);
    const tint = ama.getAttribute('tint'), col = ama.getAttribute('color');
    let whiteUntinted = 0;
    for (let i = 0; i < tint.count; i++) if (tint.getX(i) === 0 && col.getX(i) > 0.7 && col.getZ(i) > 0.7) whiteUntinted++;
    expect(whiteUntinted).toBeGreaterThan(0);
    ama.dispose(); pl.dispose();
  });

  it('小人池：位置／坐姿高度正確、滿了回 false、dispose 釋放 GPU 資源', () => {
    const parent = new THREE.Group();
    const pool = new FarProxyPool('ama', parent, 2);
    const o = new THREE.Object3D(); o.position.set(40, 0, -3); o.scale.setScalar(0.88);
    pool.begin();
    expect(pool.push(o, 0.72, new THREE.Color(0xc0392b))).toBe(true);
    expect(pool.push(o, 1, new THREE.Color(0xc0392b))).toBe(true);
    expect(pool.push(o, 1, new THREE.Color(0xc0392b))).toBe(false);
    pool.flush();
    const m = pool.mesh!;
    expect(m.count).toBe(2); expect(m.visible).toBe(true); expect(m.castShadow).toBe(false);
    const mat = new THREE.Matrix4(); m.getMatrixAt(0, mat);
    const p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3();
    mat.decompose(p, q, s);
    expect(p.x).toBeCloseTo(40); expect(p.z).toBeCloseTo(-3);
    expect(s.y).toBeCloseTo(0.88 * 0.72);
    pool.begin(); pool.flush();
    expect(m.visible).toBe(false);
    const gd = vi.spyOn(m.geometry, 'dispose'), md = vi.spyOn(m.material as THREE.Material, 'dispose');
    pool.dispose();
    expect(gd).toHaveBeenCalled(); expect(md).toHaveBeenCalled();
    expect(parent.children.length).toBe(0); expect(pool.mesh).toBeNull();
  });

  it('容量夠全場玩家＋所有阿婆（就算每個座位都坐阿婆也塞得下）', () => {
    // 阿婆池：全部玩家座位＋阿婆專屬座位＋攤販 3 位
    expect(FAR_PROXY_MAX.ama).toBeGreaterThanOrEqual(PLAZA_CAPACITY + PILE_COUNT * NPC_SLOTS_PER_PILE + 3);
    // 一般池：滿場玩家＋抽菸阿伯，另留站著／船上的人
    expect(FAR_PROXY_MAX.player).toBeGreaterThanOrEqual(PLAZA_CAPACITY * 2 + 1);
  });
});
