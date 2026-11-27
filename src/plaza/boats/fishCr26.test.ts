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

describe('釣魚長按按鈕不會跳出 iOS 放大鏡選字泡泡', () => {
  it('#fishBar 和按鈕（含內部文字）都禁止選取、關閉呼叫出選單', () => {
    const bar = rule(css, '#fishBar{');
    expect(bar).toMatch(/-webkit-user-select:\s*none/);
    expect(bar).toMatch(/user-select:\s*none/);
    expect(bar).toMatch(/-webkit-touch-callout:\s*none/);
    const btn = rule(css, '#fishBar .boatBtn,#fishBar .boatBtn *{');
    expect(btn).toMatch(/-webkit-user-select:\s*none/);
    expect(btn).toMatch(/user-select:\s*none/);
    expect(btn).toMatch(/-webkit-touch-callout:\s*none/);
    expect(btn).toMatch(/-webkit-tap-highlight-color:\s*transparent/);
    expect(btn).toMatch(/touch-action:\s*none/);
    const boat = rule(css, '#boatUi .boatBtn{');
    expect(boat).toMatch(/-webkit-user-select:\s*none/);
    expect(boat).toMatch(/-webkit-touch-callout:\s*none/);
    expect(boat).toMatch(/user-select:\s*none/);
  });

  it('拋竿／收線／抽竿用 pointerdown，並擋掉 contextmenu 與 touchstart 預設行為', () => {
    // 這三顆都是按住操作，preventDefault touchstart 不會吃掉 pointer 事件
    expect(fishSrc).toMatch(/cast\.addEventListener\('pointerdown'/);
    expect(fishSrc).toMatch(/bindReelFeel\(reel,/);
    expect(fishSrc).toMatch(/tap\(jerk,/);
    expect(fishSrc).toMatch(/for \(const b of \[jerk, reel, cast\]\) \{/);
    expect(fishSrc).toMatch(/b\.addEventListener\('contextmenu', e => e\.preventDefault\(\)\)/);
    expect(fishSrc).toMatch(/b\.addEventListener\('touchstart', e => e\.preventDefault\(\), \{ passive: false \}\)/);
  });
});
