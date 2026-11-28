/** 音量閘門只用到的欄位（避免跟 audio/index 循環依賴） */
export type MixGate = { master: number; amb: number; sfx: number; mute: boolean; music: number };

/** 靜音或主音量 0 */
export function masterSilent(m: MixGate): boolean {
  return m.mute || m.master <= 0;
}

/** 音效會不會真的合成（mute／主音量／sfx 任一關就否） */
export function sfxOn(m: MixGate): boolean {
  return !masterSilent(m) && m.sfx > 0;
}

export function musicOn(m: MixGate): boolean {
  return !masterSilent(m) && m.music > 0;
}

export function ambienceOn(m: MixGate, deathmatch: boolean): boolean {
  return !masterSilent(m) && !deathmatch && m.amb > 0;
}
