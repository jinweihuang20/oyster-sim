export type RoomPhase = 'lobby' | 'countdown' | 'play' | 'results';
export type RoomEndMode = 'untimed' | 'timed' | 'goal';

export type RoomPlayer = {
  pid: string; nick: string; tag: string; host: boolean; ready: boolean;
  seat: number; meat: number; earn: number; payout: number; settled: boolean;
  isNpc?: boolean;
};

export type RoomBody = {
  connId: string; pid: string; nick: string; tag: string;
  host: boolean; ready: boolean; isNpc: boolean;
  seat: number; meat: number; earn: number; payout: number; settled: boolean;
  phase: string; x: number; z: number; yaw: number;
  seated: boolean; moving: boolean; umb: boolean;
  lookYaw: number; pitch: number;
  hair: string; head: string; hand: string; body: string; legs: string; feet: string;
  carriedBy: string; cosmetics: string;
};

export type RoomSnap = {
  code: string; scene: string; seats: number; endMode: RoomEndMode;
  durationSec: number; goalMeat: number; phase: RoomPhase;
  phaseAt: number; playAt: number; remainSec: number;
  hostPid: string; players: RoomPlayer[];
  npcCount: number; npcs: RoomBody[]; bodies: RoomBody[];
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
    isNpc: bool(p?.isNpc ?? p?.IsNpc),
  };
}

export function normBody(p: any): RoomBody {
  return {
    connId: str(p?.connId ?? p?.ConnId),
    pid: str(p?.pid ?? p?.Pid),
    nick: str(p?.nick ?? p?.Nick) || '剝蚵人',
    tag: str(p?.tag ?? p?.Tag),
    host: bool(p?.host ?? p?.Host),
    ready: bool(p?.ready ?? p?.Ready),
    isNpc: bool(p?.isNpc ?? p?.IsNpc),
    seat: num(p?.seat ?? p?.Seat),
    meat: num(p?.meat ?? p?.Meat),
    earn: num(p?.earn ?? p?.Earn),
    payout: num(p?.payout ?? p?.Payout),
    settled: bool(p?.settled ?? p?.Settled),
    phase: str(p?.phase ?? p?.Phase) || 'idle',
    x: num(p?.x ?? p?.X),
    z: num(p?.z ?? p?.Z),
    yaw: num(p?.yaw ?? p?.Yaw),
    seated: bool(p?.seated ?? p?.Seated) || num(p?.seat ?? p?.Seat) >= 0,
    moving: bool(p?.moving ?? p?.Moving),
    umb: bool(p?.umb ?? p?.Umb),
    lookYaw: num(p?.lookYaw ?? p?.LookYaw),
    pitch: num(p?.pitch ?? p?.Pitch),
    hair: str(p?.hair ?? p?.Hair) || 'hr_basic',
    head: str(p?.head ?? p?.Head) || 'hd_basic',
    hand: str(p?.hand ?? p?.Hand) || 'hn_basic',
    body: str(p?.body ?? p?.Body) || 'bd_basic',
    legs: str(p?.legs ?? p?.Legs) || 'lg_basic',
    feet: str(p?.feet ?? p?.Feet) || 'ft_basic',
    carriedBy: str(p?.carriedBy ?? p?.CarriedBy),
    cosmetics: str(p?.cosmetics ?? p?.Cosmetics),
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
    npcCount: num(s.npcCount ?? s.NpcCount) || 0,
    npcs: Array.isArray(s.npcs ?? s.Npcs) ? (s.npcs ?? s.Npcs).map(normBody) : [],
    bodies: Array.isArray(s.bodies ?? s.Bodies) ? (s.bodies ?? s.Bodies).map(normBody) : [],
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
    case 'need_players': return '至少要 2 人才能開始';
    case 'bad_npcs': return '鄰居人數要 0 到 4 人';
    case 'bad_seat': return '這個位子坐不下';
    case 'taken': return '這個位子有人了';
    case 'carrying': return '先把抱著的人放下';
    case 'already_carry': return '一次只能抱一位';
    case 'notnpc': return '只能抱鄰居';
    case 'seated': return '請先站起來再抱';
    case 'far': return '再靠近一點才能抱';
    case 'notcarrier': return '你沒有抱這個人';
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
