// 玩家回饋直接發到 Discord #玩家回饋（專用 webhook，刻意嵌入前端；被濫用時換新的即可）
const WEBHOOK = 'https://discord.com/api/webhooks/1566245944301977660/ZJfrRyCyltaNuwZgYoK_F_I27CW4nOOoOKTNHmC9yVQMeVaoAZS48pNDBM5UQ7k53zIz';
/** 蚵仔廣場聊天 → Discord 頻道（專用 webhook） */
const WEBHOOK_PLAZA = 'https://discord.com/api/webhooks/1567923085150130289/aRUoBU4Cl42DgTG68hGeDemsB_D2EH5GVA7VVaQCybMiwagSaBx0LdQqijz7g1ykBg6F';
/** 蚵仔廣場進出場 → Discord 頻道（專用 webhook） */
const WEBHOOK_PLAZA_IO = 'https://discord.com/api/webhooks/1567925062164680866/cITag35urTNA-Fb1-0Mr7y542qxDS_q5feihNrqCWbVnj4HF7m3cbVVCddPThx9Lr4Z-';
/** 玩家上線／離線 → Discord 頻道（專用 webhook） */
const WEBHOOK_PLAYER_IO = 'https://discord.com/api/webhooks/1567926694482935902/D3nIUNb5KdfXszACYYbM5Zpf4x3TeS_XkGm_W4ND4QXEdL3xCMr31fNiG7zKas1SI9Sk';

const scrub = (s: string) => s.replace(/@(everyone|here)/gi, '@\u200b$1');

/** 暱稱 + #四～五碼玩家號碼（有才附） */
function who(nick: string, tag?: string | null) {
  const name = scrub((nick || '剝蚵人').trim()) || '剝蚵人';
  const id = tag && /^\d{4,5}$/.test(String(tag)) ? ` #${tag}` : '';
  return (name + id).slice(0, 80);
}

function postWebhook(url: string, body: unknown, opts?: { beacon?: boolean }): Promise<boolean> {
  const payload = JSON.stringify(body);
  if (opts?.beacon && typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
    try {
      return Promise.resolve(navigator.sendBeacon(url + '?wait=false', new Blob([payload], { type: 'application/json' })));
    } catch { /* fall through */ }
  }
  return fetch(url + '?wait=false', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payload, keepalive: !!opts?.beacon }).then(r => r.ok, () => false);
}

export function postDiscordFeedback(title: string, text: string, fields: Record<string, string | number>): Promise<boolean> {
  const desc = scrub(text).slice(0, 500) || '(空)';
  const body = { allowed_mentions: { parse: [] }, embeds: [{ title: title.slice(0, 250), description: desc, color: 0xffd24a,
    fields: Object.entries(fields).map(([name, v]) => ({ name, value: String(v).slice(0, 200) || '-', inline: true })), timestamp: new Date().toISOString() }] };
  return postWebhook(WEBHOOK, body);
}

/** 廣場聊天鏡射：以發言者暱稱當 webhook 顯示名（僅發言端送一次，避免每人各送一則） */
export function postDiscordPlazaChat(nick: string, text: string, opts?: { pileId?: number | null; tag?: string | null }): Promise<boolean> {
  const name = who(nick, opts?.tag);
  const content = scrub(text).trim().slice(0, 400);
  if (!content) return Promise.resolve(false);
  const where = opts?.pileId != null && opts.pileId >= 0 ? `〔堆${opts.pileId + 1}〕 ` : '';
  return postWebhook(WEBHOOK_PLAZA, {
    username: name,
    content: where + content,
    allowed_mentions: { parse: [] as string[] },
  });
}

/** 進出廣場（僅本機進／離各送一次，重連不重複） */
export function postDiscordPlazaPresence(
  nick: string,
  kind: 'join' | 'leave',
  opts?: { online?: number | null; tag?: string | null },
): Promise<boolean> {
  const name = who(nick, opts?.tag);
  const n = opts?.online;
  const people = n != null && n >= 0 ? `（目前約 ${n} 人）` : '';
  const content = kind === 'join' ? `🟢 **${name}** 進了蚵仔廣場${people}` : `🚪 **${name}** 離開了蚵仔廣場${people}`;
  return postWebhook(WEBHOOK_PLAZA_IO, {
    username: '蚵仔廣場',
    content,
    allowed_mentions: { parse: [] as string[] },
  });
}

/** 第一次來蚵寮（新手進場；每裝置只送一次） */
export function postDiscordFirstPlay(nick: string, opts?: { tag?: string | null }): Promise<boolean> {
  const name = who(nick, opts?.tag);
  return postWebhook(WEBHOOK_PLAYER_IO, {
    username: '蚵寮廣播',
    content: `🆕 **${name}** 第一次來蚵寮上工了`,
    allowed_mentions: { parse: [] as string[] },
  });
}
