export type RaceMode = 'timed' | 'goal';

export type RaceMatched = {
  code: string;
  mode: RaceMode;
  param: number;
  durationSec: number;
  goalMeat: number;
  /** 雙方共用蚵仔抽取種子 */
  fairSeed: number;
};

export type RacePlayer = {
  connId: string;
  pid: string;
  nick: string;
  tag?: string;
  pileId: number;
  slot: number;
  phase: string;
  count: number;
  seated: boolean;
};

export type RaceSnap = {
  code: string;
  mode: RaceMode;
  param: number;
  phase: 'lobby' | 'countdown' | 'play' | 'results' | string;
  phaseAt: number;
  playAt: number;
  remainSec: number;
  goalMeat: number;
  durationSec: number;
  winnerConnId?: string | null;
  winnerPid?: string | null;
  winnerNick?: string | null;
  reason: string;
  winPay: number;
  losePay: number;
  fairSeed: number;
  players: RacePlayer[];
};

export type RaceResults = {
  code: string;
  mode: string;
  phase: string;
  reason: string;
  winnerConnId?: string | null;
  winnerPid?: string | null;
  winnerNick?: string | null;
  winPay: number;
  losePay: number;
  players: RacePlayer[];
};

const ERR_ZH: Record<string, string> = {
  bad_pid: '玩家 ID 無效',
  bad_mode: '規則無效',
  bad_code: '房間代碼無效',
  bad_seat: '只能坐對戰那兩席',
  locked_seat: '競速不能換位置',
  bad_target: '目標無效',
  queue_busy: '這個規則已有人在排，請稍候',
  not_queued: '你不在排隊中',
  no_match: '對局不存在或已結束',
  not_in_match: '你不在這場對局',
  not_joined: '尚未進場',
  not_play: '還沒開始比賽',
  results: '對局已結束',
  in_progress: '對局進行中',
  taken: '位子有人了',
  no_seat: '要先坐下',
  no_target: '找不到對手',
  other_pile: '只能偷同桌',
  slow: '太快了，緩一下',
  steal_ban: '偷太多次被禁了',
  newcomer: '剛坐下，暫時不能偷',
  protected: '對方碗裡太少，不能偷',
  umb: '對方撐著傘',
  busy: '對方正在撬殼',
  immune: '對方剛被偷過',
  watching: '對方看著你／看著碗',
  pair_cd: '同一人偷太勤',
  victim_cap: '對方這分鐘被偷太多次',
  connect_fail: '連線失敗',
  full: '人滿了',
};

export function raceZhErr(e?: string) {
  return (e && ERR_ZH[e]) || e || '失敗了';
}

export function raceModeLabel(mode: RaceMode, param?: number) {
  if (mode === 'timed') return `限時 ${param || 120} 秒`;
  return `先到 ${param || 20} 顆`;
}

export function normRaceMatched(e: any): RaceMatched {
  const modeRaw = String(e?.mode ?? e?.Mode ?? 'timed').toLowerCase();
  const mode: RaceMode = modeRaw.startsWith('goal') ? 'goal' : 'timed';
  return {
    code: String(e?.code ?? e?.Code ?? ''),
    mode,
    param: Number(e?.param ?? e?.Param ?? (mode === 'goal' ? 20 : 120)) || (mode === 'goal' ? 20 : 120),
    durationSec: Number(e?.durationSec ?? e?.DurationSec ?? 120) || 120,
    goalMeat: Number(e?.goalMeat ?? e?.GoalMeat ?? 20) || 20,
    fairSeed: Math.max(1, Number(e?.fairSeed ?? e?.FairSeed ?? 0) | 0) || 1,
  };
}

function normRacePlayer(p: any): RacePlayer {
  const pileId = Number(p?.pileId ?? p?.PileId ?? -1);
  return {
    connId: String(p?.connId ?? p?.ConnId ?? ''),
    pid: String(p?.pid ?? p?.Pid ?? ''),
    nick: String(p?.nick ?? p?.Nick ?? '剝蚵人'),
    tag: String(p?.tag ?? p?.Tag ?? '').replace(/^#/, '') || undefined,
    pileId,
    slot: Number(p?.slot ?? p?.Slot ?? -1),
    phase: String(p?.phase ?? p?.Phase ?? 'idle'),
    count: Number(p?.count ?? p?.Count ?? 0) || 0,
    seated: !!(p?.seated ?? p?.Seated ?? pileId >= 0),
  };
}

export function normRaceSnap(e: any): RaceSnap {
  const modeRaw = String(e?.mode ?? e?.Mode ?? 'timed').toLowerCase();
  const mode: RaceMode = modeRaw.startsWith('goal') ? 'goal' : 'timed';
  const players = (e?.players ?? e?.Players ?? []).map(normRacePlayer);
  return {
    code: String(e?.code ?? e?.Code ?? ''),
    mode,
    param: Number(e?.param ?? e?.Param ?? (mode === 'goal' ? 20 : 120)) || (mode === 'goal' ? 20 : 120),
    phase: String(e?.phase ?? e?.Phase ?? 'lobby'),
    phaseAt: Number(e?.phaseAt ?? e?.PhaseAt ?? 0) || 0,
    playAt: Number(e?.playAt ?? e?.PlayAt ?? 0) || 0,
    remainSec: Math.max(0, Number(e?.remainSec ?? e?.RemainSec ?? 0) | 0),
    goalMeat: Number(e?.goalMeat ?? e?.GoalMeat ?? 20) || 20,
    durationSec: Number(e?.durationSec ?? e?.DurationSec ?? 120) || 120,
    winnerConnId: e?.winnerConnId ?? e?.WinnerConnId ?? null,
    winnerPid: e?.winnerPid ?? e?.WinnerPid ?? null,
    winnerNick: e?.winnerNick ?? e?.WinnerNick ?? null,
    reason: String(e?.reason ?? e?.Reason ?? ''),
    winPay: Math.max(0, Number(e?.winPay ?? e?.WinPay ?? 300) | 0),
    losePay: Math.max(0, Number(e?.losePay ?? e?.LosePay ?? 80) | 0),
    fairSeed: Math.max(1, Number(e?.fairSeed ?? e?.FairSeed ?? 0) | 0) || 1,
    players,
  };
}

export function normRaceResults(e: any): RaceResults {
  const s = normRaceSnap(e);
  return {
    code: s.code,
    mode: s.mode,
    phase: s.phase,
    reason: s.reason,
    winnerConnId: s.winnerConnId,
    winnerPid: s.winnerPid,
    winnerNick: s.winnerNick,
    winPay: s.winPay,
    losePay: s.losePay,
    players: s.players,
  };
}
