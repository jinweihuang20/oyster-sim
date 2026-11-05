// 玩家回饋直接發到 Discord #玩家回饋（專用 webhook，刻意嵌入前端；被濫用時換新的即可）
const WEBHOOK = 'https://discord.com/api/webhooks/1566245944301977660/ZJfrRyCyltaNuwZgYoK_F_I27CW4nOOoOKTNHmC9yVQMeVaoAZS48pNDBM5UQ7k53zIz';
/** 蚵仔廣場聊天 → Discord 頻道（專用 webhook） */
const WEBHOOK_PLAZA = 'https://discord.com/api/webhooks/1567923085150130289/aRUoBU4Cl42DgTG68hGeDemsB_D2EH5GVA7VVaQCybMiwagSaBx0LdQqijz7g1ykBg6F';

const scrub = (s: string) => s.replace(/@(everyone|here)/gi, '@\u200b$1');

export function postDiscordFeedback(title: string, text: string, fields: Record<string, string | number>): Promise<boolean> {
  const desc = scrub(text).slice(0, 500) || '(空)';
  const body = { allowed_mentions: { parse: [] }, embeds: [{ title: title.slice(0, 250), description: desc, color: 0xffd24a,
    fields: Object.entries(fields).map(([name, v]) => ({ name, value: String(v).slice(0, 200) || '-', inline: true })), timestamp: new Date().toISOString() }] };
  return fetch(WEBHOOK + '?wait=false', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(r => r.ok, () => false);
}

/** 廣場聊天鏡射：以發言者暱稱當 webhook 顯示名（僅發言端送一次，避免每人各送一則） */
export function postDiscordPlazaChat(nick: string, text: string, opts?: { pileId?: number | null }): Promise<boolean> {
  const name = scrub((nick || '剝蚵人').trim()).slice(0, 80) || '剝蚵人';
  const content = scrub(text).trim().slice(0, 400);
  if (!content) return Promise.resolve(false);
  const where = opts?.pileId != null && opts.pileId >= 0 ? `〔堆${opts.pileId + 1}〕 ` : '';
  const body = {
    username: name,
    content: where + content,
    allowed_mentions: { parse: [] as string[] },
  };
  return fetch(WEBHOOK_PLAZA + '?wait=false', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(r => r.ok, () => false);
}
