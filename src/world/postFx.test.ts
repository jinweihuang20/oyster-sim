import { describe, expect, it } from 'vitest';
import { assertPostFxAllowed, postFxAllowed } from './postFx';

describe('postFxAllowed', () => {
  it('手機／省電一律關', () => {
    expect(postFxAllowed({ coarse: true })).toBe(false);
    expect(postFxAllowed({ eco: true })).toBe(false);
    expect(postFxAllowed({ coarse: true, eco: true, force: true })).toBe(false);
  });

  it('預設品質也不開（本專案無後製管線）', () => {
    expect(postFxAllowed()).toBe(false);
    expect(postFxAllowed({ coarse: false, eco: false })).toBe(false);
  });

  it('僅非手機且 force 才允許（開發用）', () => {
    expect(postFxAllowed({ coarse: false, eco: false, force: true })).toBe(true);
  });

  it('assert 在停用時丟錯', () => {
    expect(() => assertPostFxAllowed({ coarse: true }, 'Bloom')).toThrow(/Bloom/);
    expect(() => assertPostFxAllowed({ coarse: false, eco: false, force: true })).not.toThrow();
  });
});
