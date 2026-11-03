/** 相容入口：實作在 `src/dm/`。商店等系統請直接 `import { WEAPON_DEFS } from './dm/weapons'` */
export { openDeathmatch, isDeathmatchActive, type DmUmb } from './dm';
export {
  DM_PRESETS, DM_MODE_LABEL, resolveMatchConfig, isHostile,
  hordeBotCount, hordeAggression, ffaReward, hordeReward,
  type DmMatchConfig, type DmMode, type DmArenaId,
} from './dm';
export { WEAPON_DEFS, makeWeapon, weaponList, shopWeapons, isWeaponId, type WeaponId, type WeaponDef, type Weapon } from './dm/weapons';
export { SHOP_FREE } from './dm/shop';
export { openWeaponPreview, weaponPreviewCss } from './dm/weaponPreview';