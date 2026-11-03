import * as THREE from 'three';
import type { CoverKind } from './types';

export const WALK = 3.8, SPRINT = 1.35, HALF = 18, EYE = 1.6, R = 0.35, PICK_R = 1.9;
/** 死鬥基本生命上限 */
export const MAX_HP = 200;

/** 蚵仔堆（補彈點）；座標避開圍牆內緣 */
export const PILES = [
  [0, 0], [-13, -12], [13, 12], [-12, 12], [12, -12], [0, -6], [5, 15],
  [-6, 0], [7, 7], [-7, -8], [9, -14], [-14, 5], [14, -3], [0, 8], [-15, -5], [3, -14], [-4, 14],
].map(([x, z]) => new THREE.Vector3(x, 0, z));

/** 掩體：木箱堆、藍色塑膠籃堆、剝蚵工作桌、輪胎堆 */
export const COVER_DEF: [number, number, number, number, number, CoverKind][] = [
  [-8, -6, 2.4, 1.2, 1.5, 'crate'], [8, 6, 2.4, 1.2, 1.5, 'crate'], [-7, 8, 2.2, 1.0, 1.3, 'basket'], [7, -8, 2.2, 1.0, 1.3, 'basket'],
  [0, 11, 3.0, 1.2, 1.0, 'table'], [0, -11, 3.0, 1.2, 1.0, 'table'], [-12, 0, 1.2, 2.6, 1.5, 'crate'], [12, 0, 1.0, 2.2, 1.3, 'basket'],
  [5, 0, 1.5, 1.5, 1.15, 'tires'], [-4, 4, 1.8, 1.1, 1.0, 'table'], [4, -4, 1.6, 1.6, 1.35, 'crate'], [-9, -13, 2.0, 1.0, 1.2, 'basket'],
];

/** 玩家＋8 BOT 分散點；重生選離敵最遠 */
export const SPAWNS = [
  [-15, -15], [15, 15], [-15, 15], [15, -15],
  [0, -16], [0, 16], [-16, 0], [16, 0],
  [-10, -10], [10, 10], [-10, 10], [10, -10],
];

/** 每場死鬥新建，避免上一場破壞狀態殘留 */
export function makeCoverBoxes(): THREE.Box3[] {
  return COVER_DEF.map(([x, z, w, d, h]) => new THREE.Box3(new THREE.Vector3(x - w / 2, 0, z - d / 2), new THREE.Vector3(x + w / 2, h, z + d / 2)));
}
