const DEFAULT_HUB = 'https://game-status.gwtech.org/hubs/party';
const API = import.meta.env.DEV ? 'http://127.0.0.1:8787/s' : 'https://game-status.gwtech.org/s';

export function partyHubUrl() {
  try {
    const u = new URLSearchParams(location.search).get('partyHub');
    if (u) return u;
  } catch { /* ignore */ }
  if (import.meta.env.DEV) return 'http://127.0.0.1:8787/hubs/party';
  return DEFAULT_HUB;
}

export async function partyInviteFriend(pid: string, to: string, code: string) {
  try {
    const r = await fetch(API + '/party/invite', {
      method: 'POST',
      body: JSON.stringify({ pid, to, code }),
      headers: { 'Content-Type': 'text/plain' },
      mode: 'cors',
    });
    const j = await r.json().catch(() => null);
    return { ok: r.ok && !!j?.ok, err: String(j?.error || (!r.ok ? 'fail' : '')), id: j?.id as string | undefined };
  } catch {
    return { ok: false, err: 'connect_fail' };
  }
}

export async function partyListInvites(pid: string) {
  try {
    const r = await fetch(API + `/party/invites?pid=${encodeURIComponent(pid)}`, { mode: 'cors', cache: 'no-store' });
    const j = await r.json().catch(() => null);
    if (!r.ok || !j?.ok) return [] as any[];
    return Array.isArray(j.invites) ? j.invites : [];
  } catch {
    return [];
  }
}

export async function partyAcceptInvite(pid: string, id: string) {
  try {
    const r = await fetch(API + '/party/invite/accept', {
      method: 'POST',
      body: JSON.stringify({ pid, id }),
      headers: { 'Content-Type': 'text/plain' },
      mode: 'cors',
    });
    const j = await r.json().catch(() => null);
    return { ok: r.ok && !!j?.ok, err: String(j?.error || (!r.ok ? 'fail' : '')), code: String(j?.code || '') };
  } catch {
    return { ok: false, err: 'connect_fail', code: '' };
  }
}

export async function partyDeclineInvite(pid: string, id: string) {
  try {
    await fetch(API + '/party/invite/decline', {
      method: 'POST',
      body: JSON.stringify({ pid, id }),
      headers: { 'Content-Type': 'text/plain' },
      mode: 'cors',
    });
  } catch { /* ignore */ }
}
