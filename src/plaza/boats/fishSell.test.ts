import { describe, it, expect } from 'vitest';
import { FISH, FISH_ERR } from './fishLogic';

describe('賣魚沒有每日上限', () => {
  it('客戶端不再有每日賣魚上限（只剩魚獲最多幾條）', () => {
    expect('sellMax' in FISH).toBe(false);
    expect(FISH.holdMax).toBe(20);
  });
  it('只有舊伺服器才會回 daily_cap：提示說是伺服器還沒更新', () => {
    expect(FISH_ERR.daily_cap).toContain('伺服器還沒更新');
  });
});
