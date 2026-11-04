import type * as THREE from 'three';
import type { Weapon, WeaponId } from './weapons';
import type { PlayerRig } from './character';

export type Part = 'head' | 'body' | 'legs';
export type CoverKind = 'crate' | 'basket' | 'table' | 'tires';

export interface Fighter {
  name: string; isPlayer: boolean; teamId: number; pos: THREE.Vector3; vel: THREE.Vector3; yaw: number; pitch: number;
  hp: number; wpn: Weapon; dead: boolean; respawnAt: number; invulnUntil: number;
  kills: number; deaths: number; hs: number; shots: number; hits: number;
  mesh: THREE.Group | null; cd: number; stepAcc: number; deathAt: number; fallDir: THREE.Vector3;
  hpBar: { g: THREE.Group; fill: THREE.Mesh; bg: THREE.MeshBasicMaterial; fm: THREE.MeshBasicMaterial } | null;
  /** 第三人稱方塊人骨架；本機玩家通常 null（第一人稱） */
  rig: PlayerRig | null;
  throwA: number; walkPh: number; pickCd: number; umbT: number; umbHeld: boolean; umbTired: boolean;
  umbMesh: THREE.Object3D | null; goal: THREE.Vector3; idleUntil: number; pickT: number;
}

export interface Shell {
  pos: THREE.Vector3; vel: THREE.Vector3; owner: Fighter; mesh: THREE.Mesh; life: number; trail: number;
  /** 發射當下槍枝軀幹傷害（彈丸） */
  damage: number;
}

/** 死鬥向主遊戲借用的美術／音訊／雨傘 */
export interface DmUmb {
  umb: { n: string; open: number; dur: number; cover: number }; model: THREE.Object3D;
  makeAma: (top: number, hair: number) => { g: THREE.Group; head: THREE.Group; armL: THREE.Group; armR: THREE.Group; pants: THREE.Material };
  shellGeos: THREE.BufferGeometry[]; shellMat: THREE.Material; greyPick: () => number;
  audio: () => AudioContext; sfxOut: () => AudioNode; gore: () => boolean;
  barnGeo: THREE.BufferGeometry; barnMat: THREE.Material; placeBarn: (list: THREE.Object3D[], dd: number, y?: number) => void;
  /** 撿到奇物：寫入存檔並回傳提示資料；失敗回 null */
  grantOdd: (index: number) => { name: string; line: string; n: number; color: string } | null;
  /** 雜貨店已購買、可在死鬥裝備的槍 */
  ownedWeapons: WeaponId[];
  /** 進場預設裝備（須在 ownedWeapons 內） */
  equippedWeapon: WeaponId;
  /** 死鬥內換槍時寫回存檔 */
  setEquippedWeapon: (id: WeaponId) => void;
  /** 結算發錢（寫入主線錢包） */
  grantMoney: (amount: number, via: string) => void;
  /** 進場（統計開戰人數） */
  reportMatchStart?: (mode: 'ffa' | 'horde') => void;
  /** 正常結算後上報成績／排行榜 */
  reportMatchEnd?: (info: {
    mode: 'ffa' | 'horde';
    kills: number;
    wavesCleared: number;
    payout: number;
    reason: 'time' | 'death';
    durationSec: number;
  }) => void;
}
