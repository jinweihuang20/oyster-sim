/** 死鬥模式公開入口；武器目錄給商店等系統直接 import `./weapons` */
export { openDeathmatch, isDeathmatchActive } from './session';
export type { DmUmb } from './types';
export { WEAPON_DEFS, makeWeapon, weaponList, shopWeapons, type WeaponId, type WeaponDef, type Weapon } from './weapons';
export { SHOP_FREE } from './shop';
