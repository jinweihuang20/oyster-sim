export const PARTY_CAPACITY = 8;
export const PARTY_PILE_ID = 5;

export type PartyPlayer = {
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

export type PartySnap = {
  code: string;
  phase: string;
  occupied: number;
  capacity: number;
  players: PartyPlayer[];
};

export type PartyInvite = {
  id: string;
  from: string;
  nick: string;
  tag: string;
  code: string;
  at: number;
};

const ERR_ZH: Record<string, string> = {
  bad_pid: '玩家 ID 無效',
  bad_code: '房間代碼無效',
  bad_seat: '只能坐中央那桌',
  bad_target: '目標無效',
  no_room: '房間不存在或已解散',
  not_in_room: '你不在這間房',
  not_joined: '尚未進場',
  taken: '位子有人了',
  no_seat: '要先坐下',
  no_target: '找不到對方',
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
  not_friend: '只能邀請好友',
  gone: '邀請已失效',
  self: '不能邀請自己',
};

export function partyZhErr(e?: string) {
  return (e && ERR_ZH[e]) || e || '失敗了';
}

function normPartyPlayer(p: any): PartyPlayer {
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

export function normPartySnap(e: any): PartySnap {
  const players = (e?.players ?? e?.Players ?? []).map(normPartyPlayer);
  const rawOcc = e?.occupied ?? e?.Occupied;
  const occupied = typeof rawOcc === 'number' ? rawOcc : players.length;
  return {
    code: String(e?.code ?? e?.Code ?? ''),
    phase: String(e?.phase ?? e?.Phase ?? 'play'),
    occupied,
    capacity: Number(e?.capacity ?? e?.Capacity ?? PARTY_CAPACITY) || PARTY_CAPACITY,
    players,
  };
}

/** 複製用邀請網址（含 Pages base） */
export function partyInviteUrl(code: string) {
  const c = String(code || '').trim().toUpperCase();
  const u = new URL(location.href);
  u.searchParams.set('party', c);
  return u.toString();
}
