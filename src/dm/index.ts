/** 死鬥模式公開入口；武器目錄給商店等系統直接 import `./weapons` */
export { openDeathmatch, isDeathmatchActive } from './session';
export type { DmUmb } from './types';
export {
  DM_PRESETS, DM_MODE_LABEL, resolveMatchConfig, isHostile,
  hordeBotCount, hordeAggression, ffaReward, hordeReward,
  type DmMatchConfig, type DmMode, type DmArenaId,
} from './match';
export { WEAPON_DEFS, makeWeapon, weaponList, shopWeapons, isWeaponId, type WeaponId, type WeaponDef, type Weapon } from './weapons';
export { SHOP_FREE } from './shop';
export { openWeaponPreview, weaponPreviewCss } from './weaponPreview';