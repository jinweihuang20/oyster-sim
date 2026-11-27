import { describe, it, expect } from 'vitest';
import { standWantYaw, yawOf, castPoint } from './fishLogic';

/** 兩角最短差的絕對值 */
const ang = (a: number, b: number) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));

describe('船上收線時人物朝向跟著鏡頭（CR-30）', () => {
  const boatH = 0.7;
  const castH = boatH + Math.PI / 2; // 先前往左舷拋
  const camYaw = boatH - Math.PI / 3; // 鏡頭已轉去右前方
  const walkYaw = 0.4;

  it('收線中：面向跟著鏡頭（船身座標＝camYaw - boatH），不再鎖在拋竿方向', () => {
    const want = standWantYaw(castH, false, walkYaw, camYaw, boatH, { reeling: true });
    expect(ang(want + boatH, camYaw)).toBeLessThan(1e-9);
    expect(ang(want + boatH, castH)).toBeGreaterThan(0.5);
  });

  it('路亞收線時在甲板走動：面向仍跟鏡頭，不改走走路方向或拋竿方向', () => {
    const want = standWantYaw(castH, true, walkYaw, camYaw, boatH, { reeling: true });
    expect(ang(want + boatH, camYaw)).toBeLessThan(1e-9);
  });

  it('拉魚收線（fight）同樣跟著鏡頭，船頭轉向後仍用世界鏡頭朝向換算', () => {
    const h = -1.2;
    const cam = 0.35;
    const want = standWantYaw(h + 0.5, false, 0, cam, h, { reeling: true });
    expect(ang(want, cam - h)).toBeLessThan(1e-9);
  });

  it('放開收線後維持目前朝向，不會瞬間轉回原來的拋竿方向', () => {
    const held = camYaw - boatH;
    const want = standWantYaw(castH, false, walkYaw, camYaw + 0.8, boatH, { reeling: false, holdYaw: held });
    expect(ang(want, held)).toBeLessThan(1e-9);
    expect(ang(want + boatH, castH)).toBeGreaterThan(0.5);
  });

  it('放開收線後再走：改面向走路方向；沒在收線、也沒剛收過線時，走路仍鎖在拋竿方向', () => {
    const held = camYaw - boatH;
    const afterReel = standWantYaw(castH, true, walkYaw, camYaw, boatH, { holdYaw: held });
    expect(ang(afterReel, walkYaw)).toBeLessThan(1e-9);
    const neverReeled = standWantYaw(castH, true, walkYaw, camYaw, boatH);
    expect(ang(neverReeled + boatH, castH)).toBeLessThan(1e-9);
  });

  it('沒在收線、也沒剛收過線：行為跟以前一樣（線在水裡＝拋竿方向；站著不動＝鏡頭）', () => {
    expect(ang(standWantYaw(castH, false, walkYaw, camYaw, boatH) + boatH, castH)).toBeLessThan(1e-9);
    expect(ang(standWantYaw(null, false, walkYaw, camYaw, boatH) + boatH, camYaw)).toBeLessThan(1e-9);
    expect(ang(standWantYaw(null, true, walkYaw, camYaw, boatH), walkYaw)).toBeLessThan(1e-9);
  });

  it('人物跟著鏡頭轉時，假魚／落點仍停在拋竿方向的水面，不跟人一起傳送', () => {
    const ox = -60, oz = 20, power = 0.6;
    const lure = castPoint(ox, oz, castH, power, 'minnow');
    const face = standWantYaw(castH, false, 0, camYaw, boatH, { reeling: true });
    expect(ang(face + boatH, camYaw)).toBeLessThan(1e-9);
    expect(ang(yawOf(lure.x - ox, lure.z - oz), castH)).toBeLessThan(1e-4);
    // 鏡頭轉了，落點還是在原來的左舷，不是鏡頭前方
    expect(ang(yawOf(lure.x - ox, lure.z - oz), camYaw)).toBeGreaterThan(0.5);
  });
});
