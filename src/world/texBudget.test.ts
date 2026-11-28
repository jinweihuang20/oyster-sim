import { describe, expect, it } from 'vitest';
import { budgetCanvasSize, clampTexDim, isPot, potCeil, texMaxSide, TEX_MAX, TEX_MED, TEX_SMALL } from './texBudget';

describe('texBudget', () => {
  it('potCeil 對齊 2 的次方', () => {
    expect(potCeil(1)).toBe(1);
    expect(potCeil(168)).toBe(256);
    expect(potCeil(198)).toBe(256);
    expect(potCeil(1024)).toBe(1024);
    expect(potCeil(1025)).toBe(2048);
  });

  it('手機／省電上限', () => {
    expect(texMaxSide({ coarse: true })).toBe(TEX_MAX);
    expect(texMaxSide({ eco: true })).toBe(TEX_MED);
    expect(texMaxSide({ kind: 'small' })).toBe(TEX_SMALL);
  });

  it('clamp 不超過 max 且為 POT', () => {
    expect(clampTexDim(2048, 1024)).toBe(1024);
    expect(clampTexDim(400, 1024)).toBe(512);
    expect(isPot(clampTexDim(233, 1024))).toBe(true);
  });

  it('budgetCanvasSize 手機看板 ≤1024', () => {
    const b = budgetCanvasSize(2048, 96, { coarse: true, kind: 'sign' });
    expect(b.width).toBeLessThanOrEqual(TEX_MAX);
    expect(b.height).toBeLessThanOrEqual(TEX_MAX);
    expect(isPot(b.width)).toBe(true);
  });
});
