/** 與伺服器 RoomWorld.SeatWorld 同一套：桌邊一圈位子，面向蚵堆。 */
export const ROOM_SEAT_R = 2.05;

export function roomPhysicalSeats(humanSeats: number, npcCount: number) {
  return Math.max(2, Math.min(8, humanSeats | 0)) + Math.max(0, Math.min(4, npcCount | 0));
}

export function roomSeatPose(slot: number, total: number) {
  const n = Math.max(total, 2);
  const a = (slot / n) * Math.PI * 2;
  return { x: -Math.sin(a) * ROOM_SEAT_R, z: Math.cos(a) * ROOM_SEAT_R, yaw: -a };
}
