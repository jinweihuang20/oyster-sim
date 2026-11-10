export type RoomPhase = 'lobby' | 'countdown' | 'play' | 'results';
export type RoomEndMode = 'untimed' | 'timed' | 'goal';

export type RoomPlayer = {
  pid: string; nick: string; tag: string; host: boolean; ready: boolean;
  seat: number; meat: number; earn: number; payout: number; settled: boolean;
};

export type RoomSnap = {
  code: string; scene: string; seats: number; endMode: RoomEndMode;
  durationSec: number; goalMeat: number; phase: RoomPhase;
  phaseAt: number; playAt: number; remainSec: number;
  hostPid: string; players: RoomPlayer[];
};

export const ROOM_SCENES: { id: string; n: string }[] = [
  { id: 'home', n: '自家蚵寮' },
  { id: 'wanggong', n: '王功漁港' },
  { id: 'dongshi', n: '東石漁人碼頭' },
  { id: 'budai', n: '布袋蚵寮大廠' },
];

export function roomSceneName(id: string) {
  return ROOM_SCENES.find(s => s.id === id)?.n ?? '自家蚵寮';
}

export function roomModeLabel(mode: string, durationSec: number, goal: number) {
  if (mode === 'timed') return `限時 ${Math.round(durationSec / 60)} 分鐘`;
  if (mode === 'goal') return `先剝到 ${goal} 顆`;
  return '不限時';
}

function str(v: unknown) { return String(v ?? ''); }
function num(v: unknown) { const n = Number(v); return Number.isFinite(n) ? n : 0; }
function bool(v: unknown) { return v === true || v === 'true'; }

export function normPlayer(p: any): RoomPlayer {
  return {
    pid: str(p?.pid ?? p?.Pid),
    nick: str(p?.nick ?? p?.Nick) || '剝蚵人',
    tag: str(p?.tag ?? p?.Tag),
    host: bool(p?.host ?? p?.Host),
    ready: bool(p?.ready ?? p?.Ready),
    seat: num(p?.seat ?? p?.Seat),
    meat: num(p?.meat ?? p?.Meat),
    earn: num(p?.earn ?? p?.Earn),
    payout: num(p?.payout ?? p?.Payout),
    settled: bool(p?.settled ?? p?.Settled),
  };
}

export function normSnap(s: any): RoomSnap | null {
  if (!s) return null;
  const endMode = str(s.endMode ?? s.EndMode) as RoomEndMode;
  const phase = str(s.phase ?? s.Phase) as RoomPhase;
  return {
    code: str(s.code ?? s.Code).toUpperCase(),
    scene: str(s.scene ?? s.Scene) || 'home',
    seats: num(s.seats ?? s.Seats) || 4,
    endMode: endMode === 'timed' || endMode === 'goal' ? endMode : 'untimed',
    durationSec: num(s.durationSec ?? s.DurationSec) || 300,
    goalMeat: num(s.goalMeat ?? s.GoalMeat) || 100,
    phase: phase === 'countdown' || phase === 'play' || phase === 'results' ? phase : 'lobby',
    phaseAt: num(s.phaseAt ?? s.PhaseAt),
    playAt: num(s.playAt ?? s.PlayAt),
    remainSec: num(s.remainSec ?? s.RemainSec),
    hostPid: str(s.hostPid ?? s.HostPid),
    players: Array.isArray(s.players ?? s.Players) ? (s.players ?? s.Players).map(normPlayer) : [],
  };
}

export function roomZhErr(err?: string) {
  switch (err) {
    case 'bad_pid': return '帳號不對';
    case 'bad_code': return '房間代碼要 6 個字';
    case 'no_room': return '找不到這個房間';
    case 'in_progress': return '這一局已經開始了';
    case 'full': return '房間坐滿了';
    case 'results': return '這一局已結束';
    case 'not_in': return '你不在房間裡';
    case 'not_lobby': return '現在不能這樣做';
    case 'not_host': return '只有房主可以做';
    case 'not_ready': return '大家還沒準備好';
    case 'not_play': return '這一局還沒開始';
    case 'not_results': return '還在進行中';
    case 'no_player': return '找不到這個人';
    case 'self': return '不能對自己這樣做';
    case 'not_over': return '這一局還沒結束';
    case 'bad_token': return '連線失效，請再試一次';
    case 'bad_scene': return '場景不對';
    case 'bad_seats': return '人數要 2 到 8 人';
    case 'seats_low': return '座位比現在的人少';
    case 'bad_mode': return '結束條件不對';
    case 'bad_duration': return '限時要 3 到 20 分鐘';
    case 'bad_goal': return '顆數要 50 到 300';
    case 'slow': return '請稍後再試';
    default: return err ? '暫時連不上，請再試一次' : '暫時連不上，請再試一次';
  }
}
