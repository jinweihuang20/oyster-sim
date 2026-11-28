import { describe, it, expect } from 'vitest';
import { PLAZA_SFX_HEAR_CAP, plazaSfxHearR, plazaSfxAudible } from './sfxHear';

describe('sfxHear', () => {
  it('hearR 不超過霧遠與硬上限', () => {
    expect(plazaSfxHearR(64)).toBe(PLAZA_SFX_HEAR_CAP);
    expect(plazaSfxHearR(130)).toBe(PLAZA_SFX_HEAR_CAP);
    expect(plazaSfxHearR(40)).toBe(40);
    expect(plazaSfxHearR(0)).toBe(PLAZA_SFX_HEAR_CAP);
    expect(plazaSfxHearR(NaN)).toBe(PLAZA_SFX_HEAR_CAP);
  });

  it('外海鏡頭聽不到廣場丟殼；碼頭附近聽得到', () => {
    const seaFog = 130;
    expect(plazaSfxAudible(0, 0, -100, 0, seaFog)).toBe(false);
    expect(plazaSfxAudible(0, 0, -30, 0, seaFog)).toBe(true);
  });

  it('岸上聽不到外海撞船；碼頭邊聽得到附近船', () => {
    const shoreFog = 64;
    expect(plazaSfxAudible(-90, 0, 0, 0, shoreFog)).toBe(false);
    expect(plazaSfxAudible(-40, 0, 0, 0, shoreFog)).toBe(true);
  });

  it('座標無效＝聽不到', () => {
    expect(plazaSfxAudible(NaN, 0, 0, 0, 64)).toBe(false);
  });
});
