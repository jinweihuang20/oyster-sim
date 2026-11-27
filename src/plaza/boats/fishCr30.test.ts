import { describe, it, expect } from 'vitest';
import { standWantYaw, yawOf, castPoint } from './fishLogic';

/** 兩角最短差的絕對值 */
const ang = (a: number, b: number) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));

describe('船上釣魚時人物朝向跟著鏡頭（CR-30）', () => {
  const boatH = 0.7;
  const castH = boatH + Math.PI / 2; // 先前往左舷拋
  const camYaw = boatH - Math.PI / 3; // 鏡頭已轉去右前方
  const walkYaw = 0.4;
  const follow = { followCam: true as const };

  it('沒按收線、線在水裡：只要沒在走，面向跟著鏡頭，不再鎖在拋竿方向', () => {
    const want = standWantYaw(castH, false, walkYaw, camYaw, boatH, follow);
    expect(ang(want + boatH, camYaw)).toBeLessThan(1e-9);
    expect(ang(want + boatH, castH)).toBeGreaterThan(0.5);
  });

  it('蓄力、等魚、拉魚都一樣：沒在走就跟鏡頭，不管有沒有按收線', () => {
    for (const fishYaw of [castH, boatH, null]) {
      const idle = standWantYaw(fishYaw, false, walkYaw, camYaw, boatH, follow);
      const reelingLook = standWantYaw(fishYaw, false, walkYaw, camYaw, boatH, follow);
      expect(ang(idle + boatH, camYaw)).toBeLessThan(1e-9);
      expect(ang(reelingLook + boatH, camYaw)).toBeLessThan(1e-9);
    }
  });

  it('船上走動：面向走路方向，不鎖拋竿方向、也不再跟鏡頭橫移', () => {
    const want = standWantYaw(castH, true, walkYaw, camYaw, boatH, follow);
    expect(ang(want, walkYaw)).toBeLessThan(1e-9);
  });

  it('船頭轉向後仍用世界鏡頭朝向換算（camYaw - boatH）', () => {
    const h = -1.2;
    const cam = 0.35;
    const want = standWantYaw(h + 0.5, false, 0, cam, h, follow);
    expect(ang(want, cam - h)).toBeLessThan(1e-9);
  });

  it('未指定 followCam：行為跟以前一樣（線在水裡＝拋竿方向；站著不動＝鏡頭；走路＝走的方向）', () => {
    expect(ang(standWantYaw(castH, false, walkYaw, camYaw, boatH) + boatH, castH)).toBeLessThan(1e-9);
    expect(ang(standWantYaw(castH, true, walkYaw, camYaw, boatH) + boatH, castH)).toBeLessThan(1e-9);
    expect(ang(standWantYaw(null, false, walkYaw, camYaw, boatH) + boatH, camYaw)).toBeLessThan(1e-9);
    expect(ang(standWantYaw(null, true, walkYaw, camYaw, boatH), walkYaw)).toBeLessThan(1e-9);
  });

  it('人物跟著鏡頭轉時，假魚／落點仍停在拋竿方向的水面，不跟人一起傳送', () => {
    const ox = -60, oz = 20, power = 0.6;
    const lure = castPoint(ox, oz, castH, power, 'minnow');
    const face = standWantYaw(castH, false, 0, camYaw, boatH, follow);
    expect(ang(face + boatH, camYaw)).toBeLessThan(1e-9);
    expect(ang(yawOf(lure.x - ox, lure.z - oz), castH)).toBeLessThan(1e-4);
    // 鏡頭轉了，落點還是在原來的左舷，不是鏡頭前方
    expect(ang(yawOf(lure.x - ox, lure.z - oz), camYaw)).toBeGreaterThan(0.5);
  });
});
