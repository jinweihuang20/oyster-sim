// 玩家回饋直接發到 Discord #玩家回饋（專用 webhook，刻意嵌入前端；被濫用時換新的即可）
const WEBHOOK = 'https://discord.com/api/webhooks/1566245944301977660/ZJfrRyCyltaNuwZgYoK_F_I27CW4nOOoOKTNHmC9yVQMeVaoAZS48pNDBM5UQ7k53zIz';
export function postDiscordFeedback(title: string, text: string, fields: Record<string, string | number>): Promise<boolean> {
  const desc = text.replace(/@(everyone|here)/gi, '@\u200b$1').slice(0, 500) || '(空)';
  const body = { allowed_mentions: { parse: [] }, embeds: [{ title: title.slice(0, 250), description: desc, color: 0xffd24a,
    fields: Object.entries(fields).map(([name, v]) => ({ name, value: String(v).slice(0, 200) || '-', inline: true })), timestamp: new Date().toISOString() }] };
  return fetch(WEBHOOK + '?wait=false', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(r => r.ok, () => false);
}
