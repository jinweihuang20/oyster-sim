/**
 * 走路速度（公尺／秒）：廣場走路、船上甲板走路共用同一個數字，手感才會一樣。
 * 純常數（不碰 three／DOM），fishLogic 這種純邏輯檔也能用。
 */
export const PLAZA_WALK_SPD = 3.0;
/** 走路擺腿幅度（0～1）：跟廣場其他人走路同一條（速度 1.2 m/s 以上就是全幅） */
export const walkAmpOf = (spd: number) => Math.max(0.25, Math.min(1, spd / 1.2));
