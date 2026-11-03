/** 開鏡：輕觸切換／長按維持／混合（短按切換、按住維持） */
export type AdsMode = 'tap' | 'hold' | 'mix';

export type DS = {
  sens: number; tsens: number; invY: boolean; assist: boolean; btn: number; op: number;
  adsMode: AdsMode; v?: number;
};

const DS_DEF: DS = { sens: 1, tsens: 1, invY: false, assist: false, btn: 1, op: 0.85, adsMode: 'hold' };
const DS_VER = 3; // v3：開鏡模式

export function loadDS(): DS {
  try {
    const o = JSON.parse(localStorage.getItem('oyster-dm-set') || '{}');
    if ((o.v || 1) < 2) o.assist = false;
    if ((o.v || 1) < 3 && o.adsMode == null) o.adsMode = 'hold';
    if (o.adsMode !== 'tap' && o.adsMode !== 'hold' && o.adsMode !== 'mix') o.adsMode = 'hold';
    o.v = DS_VER;
    return { ...DS_DEF, ...o };
  } catch {
    return { ...DS_DEF };
  }
}

export function saveDS(ds: DS) {
  try { localStorage.setItem('oyster-dm-set', JSON.stringify({ ...ds, v: DS_VER })); } catch { /* ignore */ }
}

/** Vite 開發伺服器才為 true；正式／預覽 build 不會帶出作弊開關 */
export const DM_DEV = import.meta.env.DEV;
