import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { RF, RF_STRIDE, newReplayRec, recStart, recTick, recPush, recClip, clipSample } from './fishReplay';
import { rpPlaceOf, newRpPlace, rpPlaceBoat, rpRigQuat, newRigStash, rigStage, rigPlace, rigRestore, newVisStash, visHide, visRestore } from './fishReplayStage';

const meta = { sp: 'x', name: '測試魚', kg: 2, tier: 0, player: 'A' };
const DT = 1 / 60;
/** 中魚過程船在開：船沿弧線前進、船頭慢慢轉、浪晃；人站在甲板上（相對船頭轉 0.4） */
const boatAt = (t: number) => ({ x: -40 - 3 * t, z: 5 + Math.sin(t * 0.5) * 4, h: 0.2 + 0.15 * t, y: -0.3 + Math.sin(t * 2) * 0.05, rx: Math.sin(t * 1.7) * 0.03, rz: Math.cos(t * 1.3) * 0.04 });
function recordBoat(sec: number, onBoat = true) {
  const r = recStart(newReplayRec());
  for (let i = 0; i < Math.round(sec / DT); i++) {
    if (!recTick(r, DT)) continue;
    const t = r.t, b = boatAt(t);
    recPush(r, (f, o) => {
      if (onBoat) {
        f[o + RF.px] = b.x + 0.5; f[o + RF.py] = b.y + 0.4; f[o + RF.pz] = b.z - 0.3; f[o + RF.pyaw] = b.h + 0.4;
        f[o + RF.boat] = 1; f[o + RF.bx] = b.x; f[o + RF.bz] = b.z; f[o + RF.bh] = b.h; f[o + RF.by] = b.y; f[o + RF.brx] = b.rx; f[o + RF.brz] = b.rz;
      } else {
        f[o + RF.px] = -26.5; f[o + RF.py] = 0.05; f[o + RF.pz] = 1.2; f[o + RF.pyaw] = 1.3; f[o + RF.boat] = 0;
      }
      f[o + RF.fx] = -60; f[o + RF.fz] = 8;
    });
  }
  return recClip(r, meta)!;
}
const yawOf = (m: THREE.Matrix4) => Math.atan2(m.elements[8], m.elements[10]);
const angClose = (a: number, b: number, d = 3) => expect(Math.atan2(Math.sin(a - b), Math.cos(a - b))).toBeCloseTo(0, d);
/** 跟遊戲一樣：人掛在現場那艘船的座位錨點下 */
function liveScene() {
  const scene = new THREE.Scene();
  const liveBoat = new THREE.Group(), anchor = new THREE.Object3D(); anchor.position.set(0.3, 0.25, -0.6);
  liveBoat.add(anchor); scene.add(liveBoat);
  const rig = new THREE.Group(); anchor.add(rig);
  rig.position.set(0.1, 0.15, 0.2); rig.rotation.set(0, 0.7, 0);
  const stage = new THREE.Group(); scene.add(stage);
  return { scene, liveBoat, anchor, rig, stage };
}

describe('CR-32 回放錄下船的每一格', () => {
  it('回放格多了船的高度與傾斜，記憶體還是很小', () => {
    expect(RF_STRIDE).toBe(47);
    expect([RF.by, RF.brx, RF.brz]).toEqual([44, 45, 46]);
    expect(newReplayRec().buf.byteLength).toBeLessThan(64 * 1024);
  });
  it('內插出來的船位置／船頭／浪晃＝當時那一格（船在開也一樣）', () => {
    const c = recordBoat(6), fr = new Float32Array(RF_STRIDE), p = newRpPlace();
    for (const t of [0.5, 2, 3.7, 5.5]) {
      clipSample(c, t, fr); rpPlaceOf(fr, p);
      const b = boatAt(t + DT); // 片段時間從第一格（錄影第 1 幀）算起
      expect(p.boat).toBe(true);
      expect(p.bx).toBeCloseTo(b.x, 1); expect(p.bz).toBeCloseTo(b.z, 1); angClose(p.bh, b.h, 2);
      expect(p.by).toBeCloseTo(b.y, 1);
      expect(p.x).toBeCloseTo(b.x + 0.5, 1); expect(p.z).toBeCloseTo(b.z - 0.3, 1);
    }
  });
});

describe('CR-32 船上回放：照錄到的軌跡播，現在的船開去哪都不影響', () => {
  it('人和替身船每一格都在錄到的世界座標；現場那艘船移動／轉彎不會帶走回放', () => {
    const c = recordBoat(6), fr = new Float32Array(RF_STRIDE), p = newRpPlace();
    const { scene, liveBoat, rig, stage } = liveScene();
    const proxy = new THREE.Group(); scene.add(proxy); proxy.visible = false;
    const st = newRigStash();
    const seen: number[] = [];
    for (let i = 0; i <= 50; i++) {
      const t = (c.dur * i) / 50;
      // 現場：船照樣在開（往完全不同的方向），座位上的人照樣每幀被現場系統寫位置
      liveBoat.position.set(30 + i * 0.8, -0.3, -20 - i * 0.5); liveBoat.rotation.set(0.02, -1.2 + i * 0.07, -0.03);
      rig.position.set(0.1, 0.15, 0.2); rig.rotation.set(0, 0.7, 0);
      clipSample(c, t, fr); rpPlaceOf(fr, p);
      rigStage(st, rig, stage); rigPlace(rig, p); rpPlaceBoat(proxy, p);
      scene.updateMatrixWorld(true);
      const w = new THREE.Vector3().setFromMatrixPosition(rig.matrixWorld);
      expect(w.x).toBeCloseTo(fr[RF.px], 4); expect(w.y).toBeCloseTo(fr[RF.py], 4); expect(w.z).toBeCloseTo(fr[RF.pz], 4);
      angClose(yawOf(rig.matrixWorld), fr[RF.pyaw], 1);
      expect(proxy.visible).toBe(true);
      expect(proxy.position.x).toBeCloseTo(fr[RF.bx], 5); expect(proxy.position.z).toBeCloseTo(fr[RF.bz], 5);
      expect(proxy.position.y).toBeCloseTo(fr[RF.by], 5); angClose(proxy.rotation.y, fr[RF.bh], 5);
      seen.push(w.x);
    }
    // 船在開：回放裡的人真的沿著當時的路線走（不是凍在原地）
    expect(Math.abs(seen[50] - seen[0])).toBeGreaterThan(12);
    // 人跟著替身船一起晃：人相對替身船的位置＝錄到的相對位置
    const rel = new THREE.Vector3().setFromMatrixPosition(rig.matrixWorld).sub(proxy.position);
    expect(rel.x).toBeCloseTo(0.5, 3); expect(rel.z).toBeCloseTo(-0.3, 3);
  });
  it('人的朝向套上當時船的傾斜，相對船頭的角度不變', () => {
    const p = { ...newRpPlace(), boat: true, bh: 1.1, brx: 0.05, brz: -0.04, yaw: 1.5 };
    const q = rpRigQuat(p, new THREE.Quaternion());
    const boatQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(p.brx, p.bh, p.brz));
    const relQ = boatQ.clone().invert().multiply(q);
    const relYaw = new THREE.Euler().setFromQuaternion(relQ, 'YXZ').y;
    expect(relYaw).toBeCloseTo(0.4, 5);
  });
});

describe('CR-32 岸上回放：人站在錄到的岸邊位置，不出現替身船', () => {
  it('岸上格：替身船藏起來，人在錄到的 (px,py,pz,pyaw)', () => {
    const c = recordBoat(3, false), fr = new Float32Array(RF_STRIDE), p = newRpPlace();
    const { scene, liveBoat, rig, stage } = liveScene();
    const proxy = new THREE.Group(); proxy.visible = true; scene.add(proxy);
    const st = newRigStash();
    for (const t of [0, 1.1, c.dur]) {
      liveBoat.position.set(t * 10, 0, -t * 7); liveBoat.rotation.y = t;
      clipSample(c, t, fr); rpPlaceOf(fr, p);
      rigStage(st, rig, stage); rigPlace(rig, p);
      expect(rpPlaceBoat(proxy, p)).toBe(false);
      expect(proxy.visible).toBe(false);
      scene.updateMatrixWorld(true);
      const w = new THREE.Vector3().setFromMatrixPosition(rig.matrixWorld);
      expect(w.x).toBeCloseTo(-26.5, 4); expect(w.y).toBeCloseTo(0.05, 4); expect(w.z).toBeCloseTo(1.2, 4);
      angClose(yawOf(rig.matrixWorld), 1.3, 4);
    }
  });
});

describe('CR-32 回放結束：人掛回原本的地方，不瞬移', () => {
  it('還原後回到現場的爸爸、自動矩陣，位置＝現場系統最後寫的值；重複還原沒事', () => {
    const { scene, anchor, rig, stage } = liveScene();
    const st = newRigStash();
    rigStage(st, rig, stage); rigPlace(rig, { ...newRpPlace(), x: 99, y: 3, z: -77, yaw: 2 });
    expect(rig.parent).toBe(stage); expect(rig.matrixAutoUpdate).toBe(false);
    // 回放期間現場系統照樣寫座位上的位置（不是回放的位置）
    rig.position.set(0.4, 0.1, -0.2); rig.rotation.set(0, -0.3, 0);
    expect(rigRestore(st, stage)).toBe(true);
    expect(rig.parent).toBe(anchor); expect(rig.matrixAutoUpdate).toBe(true);
    scene.updateMatrixWorld(true);
    const want = new THREE.Vector3(0.4, 0.1, -0.2).applyMatrix4(anchor.matrixWorld);
    expect(new THREE.Vector3().setFromMatrixPosition(rig.matrixWorld).distanceTo(want)).toBeLessThan(1e-6);
    expect(rigRestore(st, stage)).toBe(false);
    expect(rig.parent).toBe(anchor);
    expect(stage.children.length).toBe(0);
  });
  it('回放中被搬到別處（上下船）：記下新爸爸，結束時掛回新爸爸', () => {
    const { scene, rig, stage } = liveScene();
    const st = newRigStash(), seat2 = new THREE.Object3D(); scene.add(seat2);
    rigStage(st, rig, stage);
    seat2.add(rig); // 現場系統把人掛到別的座位
    rigStage(st, rig, stage);
    expect(rig.parent).toBe(stage);
    rigRestore(st, stage);
    expect(rig.parent).toBe(seat2);
  });
  it('結束前已被別人搬走（離開廣場）：留在那裡，只恢復自動矩陣', () => {
    const { scene, rig, stage } = liveScene();
    const st = newRigStash();
    rigStage(st, rig, stage);
    scene.attach(rig);
    rigRestore(st, stage);
    expect(rig.parent).toBe(scene); expect(rig.matrixAutoUpdate).toBe(true);
  });
});

describe('CR-32 回放時藏起現場的人和船，結束照原樣還原', () => {
  it('藏起來 → 還原成原本的可見度（原本就藏著的維持藏著）', () => {
    const a = new THREE.Object3D(), b = new THREE.Object3D(), c = new THREE.Object3D();
    b.visible = false;
    const s = newVisStash();
    visHide(s, a); visHide(s, b); visHide(s, c); visHide(s, null);
    expect([a.visible, b.visible, c.visible]).toEqual([false, false, false]);
    expect(visRestore(s)).toBe(3);
    expect([a.visible, b.visible, c.visible]).toEqual([true, false, true]);
  });
  it('同一個藏兩次只記第一次的原狀；還原兩次、沒藏就還原都安全', () => {
    const a = new THREE.Object3D();
    const s = newVisStash();
    expect(visRestore(s)).toBe(0);
    visHide(s, a); visHide(s, a);
    expect(s.n).toBe(1);
    expect(visRestore(s)).toBe(1);
    expect(a.visible).toBe(true);
    expect(visRestore(s)).toBe(0);
    expect(a.visible).toBe(true);
    // 提早結束（藏到一半就還原）也一樣乾淨，之後還能再用
    const x = new THREE.Object3D(), y = new THREE.Object3D(); y.visible = false;
    visHide(s, x); visRestore(s); visHide(s, y); visRestore(s);
    expect([x.visible, y.visible]).toEqual([true, false]);
    expect(s.objs.length).toBe(0);
  });
});
