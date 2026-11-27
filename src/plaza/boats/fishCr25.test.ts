import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';

const fishSrc = readFileSync(new URL('./plazaFish.ts', import.meta.url), 'utf8');
const css = readFileSync(new URL('../../style.css', import.meta.url), 'utf8');

function rule(src: string, start: string): string {
  const i = src.indexOf(start);
  if (i < 0) return '';
  const j = src.indexOf('}', i);
  return j < 0 ? src.slice(i) : src.slice(i, j + 1);
}

describe('釣魚上方提示半透明、不遮擋按鈕', () => {
  it('#fishHud 用 rgba 半透明深底和淺色邊，不用 backdrop-filter', () => {
    const r = rule(css, '#fishHud{');
    expect(r).toMatch(/background:rgba\(15,24,38,\.5[6-9]\)/);
    expect(r).toMatch(/border:1\.5px solid rgba\(255,255,255,\.18\)/);
    expect(r).toMatch(/text-shadow:/);
    expect(r).not.toMatch(/backdrop-filter/);
    expect(r).not.toMatch(/background:#142231/);
  });

  it('釣魚時上方 toast 半透明，並以 --fish-toast-top 排在狀態列下面', () => {
    const r = rule(css, 'body.plazaFishing #toast.top{');
    expect(r).toMatch(/background:rgba\(15,24,38,\.5[6-9]\)/);
    expect(r).toMatch(/border:1px solid rgba\(255,255,255,\.18\)/);
    expect(r).toMatch(/--fish-toast-top/);
    expect(r).not.toMatch(/backdrop-filter/);
    expect(fishSrc).toMatch(/setProperty\('--fish-toast-top'/);
    expect(fishSrc).toMatch(/removeProperty\('--fish-toast-top'\)/);
    expect(fishSrc).toMatch(/getBoundingClientRect\(\)\.bottom/);
    // 進場就先量一次，長提示不會先蓋在按鈕上
    expect(fishSrc).toMatch(/syncFishToastTop\(\);\s*\}?\s*if \(!ok\) void fetchState\(\);/);
  });
});

describe('隱藏白底回放卡、上方回放鈕更顯眼', () => {
  it('釣到魚不再打開 #fishCatchCard，回放改從上方按鈕開啟', () => {
    expect(fishSrc).not.toMatch(/cardEl\.classList\.add\('on'\)/);
    expect(fishSrc).toMatch(/function showCatchCard\([^)]*\)[\s\S]*?markReplayFresh\(\)/);
    expect(fishSrc).toMatch(/function askReplay/);
    expect(fishSrc).toMatch(/function startReplay/);
    expect(css).toMatch(/#fishCatchCard,#fishCatchCard\.on\{display:none!important/);
  });

  it('回放鈕一直留在列上：沒影片時低調，有影片時金黃高對比並可輕跳提醒', () => {
    expect(css).not.toMatch(/#fishActs \.fhRp\{display:none\}/);
    const muted = rule(css, '#fishActs .fhRp{');
    expect(muted).toMatch(/display:flex/);
    expect(muted).toMatch(/opacity:\.7/);
    const ready = rule(css, '#fishActs.hasRp .fhRp{');
    expect(ready).toMatch(/background:#e8a020/);
    expect(ready).toMatch(/#fff8e4|#1a1204/);
    expect(css).toMatch(/#fishActs\.hasRp \.fhRp::after\{/);
    expect(css).toMatch(/@keyframes fhRpPulse/);
    expect(css).toMatch(/prefers-reduced-motion:reduce/);
    expect(css).not.toMatch(/#fishActs\.hasRp[^{]*\{[^}]*backdrop-filter/);
    expect(fishSrc).toMatch(/classList\.add\('fresh'\)/);
    expect(fishSrc).toMatch(/觀看精彩回放/);
    expect(fishSrc).toMatch(/還沒有可看的回放/);
    expect(fishSrc).toMatch(/rec\.on && recEndT > 0/);
  });
});
