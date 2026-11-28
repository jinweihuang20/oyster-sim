import { describe, it, expect } from 'vitest';
import {
  FOG_CULL_HYST, fogCullHidden, beyondFogFar, fogDrawRange, distToPlazaFogFocus, PLAZA_FOG_FOCUS,
} from './fogCull';
import { ISLET } from './islet';

describe('fogCull', () => {
  it('超出 fog.far 才藏、帶遲滯才恢復', () => {
    const far = 64;
    expect(fogCullHidden(50, far, false)).toBe(false);
    expect(fogCullHidden(far + FOG_CULL_HYST + 0.1, far, false)).toBe(true);
    expect(fogCullHidden(far, far, true)).toBe(true); // 還在 hyst 內，維持隱藏
    expect(fogCullHidden(far - FOG_CULL_HYST - 0.1, far, true)).toBe(false);
  });

  it('fogFar 無效時不藏', () => {
    expect(fogCullHidden(999, 0, false)).toBe(false);
    expect(fogCullHidden(999, NaN, true)).toBe(false);
    expect(beyondFogFar(999, 0)).toBe(false);
  });

  it('岸上霧 64：沙洲超出、碼頭船不超出', () => {
    const shoreFog = 64;
    const fromPlaza = distToPlazaFogFocus(PLAZA_FOG_FOCUS.x, PLAZA_FOG_FOCUS.z);
    expect(fromPlaza).toBe(0);
    expect(beyondFogFar(Math.hypot(ISLET.cx, ISLET.cz), shoreFog)).toBe(true);
    expect(beyondFogFar(28, shoreFog)).toBe(false); // 碼頭附近膠筏
  });

  it('海上霧 130：在沙洲上看廣場焦點算被蓋住；開回 -80 看得到', () => {
    const seaFog = 130;
    expect(beyondFogFar(distToPlazaFogFocus(ISLET.cx, ISLET.cz), seaFog)).toBe(true);
    expect(beyondFogFar(distToPlazaFogFocus(-80, 0), seaFog)).toBe(false);
  });

  it('fogDrawRange 不超過霧遠', () => {
    expect(fogDrawRange(200, 64)).toBe(64);
    expect(fogDrawRange(40, 64)).toBe(40);
    expect(fogDrawRange(75, 0)).toBe(75);
  });
});
