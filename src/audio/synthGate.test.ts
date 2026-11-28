import { describe, it, expect } from 'vitest';
import { masterSilent, sfxOn, musicOn, ambienceOn } from './synthGate';

const base = { master: 0.8, amb: 0.6, sfx: 0.8, mute: false, music: 0.35 };

describe('synthGate', () => {
  it('mute／master0 算 silent', () => {
    expect(masterSilent(base)).toBe(false);
    expect(masterSilent({ ...base, mute: true })).toBe(true);
    expect(masterSilent({ ...base, master: 0 })).toBe(true);
  });

  it('sfxOn 看 mute／master／sfx', () => {
    expect(sfxOn(base)).toBe(true);
    expect(sfxOn({ ...base, mute: true })).toBe(false);
    expect(sfxOn({ ...base, sfx: 0 })).toBe(false);
    expect(sfxOn({ ...base, master: 0 })).toBe(false);
  });

  it('musicOn／ambienceOn', () => {
    expect(musicOn({ ...base, music: 0 })).toBe(false);
    expect(ambienceOn(base, false)).toBe(true);
    expect(ambienceOn(base, true)).toBe(false);
    expect(ambienceOn({ ...base, amb: 0 }, false)).toBe(false);
  });
});
