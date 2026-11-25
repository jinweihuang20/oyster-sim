import { describe, it, expect } from 'vitest';
import { pushReward, liveRewards, REWARD_SEC, type RewardItem } from './rewardToast';

const mk = (id: number, key: string, until = 1000): RewardItem => ({ id, key, kind: 'mine', label: '撈到漂流箱', amount: '+$5,000', until });

describe('獎勵提示佇列', () => {
  it('停留 2.5～3 秒', () => {
    expect(REWARD_SEC.mine).toBeGreaterThanOrEqual(2.5); expect(REWARD_SEC.mine).toBeLessThanOrEqual(3);
    expect(REWARD_SEC.feed).toBeGreaterThanOrEqual(2.5); expect(REWARD_SEC.feed).toBeLessThanOrEqual(3);
  });
  it('新的一筆不會把別的蓋掉（最多 3 筆，超過才丟最舊）', () => {
    let l: RewardItem[] = [];
    l = pushReward(l, mk(1, 'a')); l = pushReward(l, mk(2, 'b'));
    expect(l.map(x => x.id)).toEqual([1, 2]);
    l = pushReward(l, mk(3, 'c')); l = pushReward(l, mk(4, 'd'));
    expect(l.map(x => x.id)).toEqual([2, 3, 4]);
  });
  it('同一件事只留最新一筆', () => {
    let l = pushReward([], mk(1, 'x')); l = pushReward(l, mk(2, 'y')); l = pushReward(l, mk(3, 'x'));
    expect(l.map(x => x.id)).toEqual([2, 3]);
  });
  it('過期才拿掉', () => {
    const l = [mk(1, 'a', 500), mk(2, 'b', 1500)];
    expect(liveRewards(l, 1000).map(x => x.id)).toEqual([2]);
  });
});
