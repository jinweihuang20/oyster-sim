import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { FISH, FISH_ERR } from './fishLogic';

const fishSrc = readFileSync(new URL('./plazaFish.ts', import.meta.url), 'utf8');
const css = readFileSync(new URL('../../style.css', import.meta.url), 'utf8');

describe('賣魚沒有每日上限', () => {
  it('客戶端不再有每日賣魚上限（只剩魚獲最多幾條）', () => {
    expect('sellMax' in FISH).toBe(false);
    expect(FISH.holdMax).toBe(20);
  });
  it('只有舊伺服器才會回 daily_cap：提示說是伺服器還沒更新', () => {
    expect(FISH_ERR.daily_cap).toContain('伺服器還沒更新');
  });
});

describe('賣魚按鈕排在釣魚動作鈕最下面', () => {
  it('釣魚中把賣魚插到 #fishBar 最前面（column-reverse 時視覺在最下面、拋竿下面）', () => {
    expect(fishSrc).toMatch(/ui\.bar\.prepend\(ui\.sell\)/);
    expect(fishSrc).not.toMatch(/ui\.bar\.append\(ui\.sell\)/);
  });
  it('CSS 用 order:-1 保證直式橫式都在最下面，#fishBar 不會改成橫向排列', () => {
    expect(css).toMatch(/#boatUi #fishBar #fishSell\{[^}]*order:-1/);
    expect(css).toMatch(/#fishBar\{[^}]*flex-direction:column-reverse/);
    expect(css).not.toMatch(/#fishBar\{[^}]*flex-direction:row/);
  });
});

