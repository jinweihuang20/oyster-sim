// 帳號綁定方式的顯示清單。伺服器 /s/auth/status 的 providers 決定哪些按鈕出現。
// 之後要加一種：在這裡補 id、顯示名、線形圖示，並在伺服器加設定與處理即可。

export type AuthProviderId = 'google' | 'discord' | 'github' | 'email';

export type AuthProviderDef = {
  id: AuthProviderId;
  name: string;
  iconSvg: string;
};

const svg = (paths: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;

export const AUTH_PROVIDERS: AuthProviderDef[] = [
  {
    id: 'google',
    name: 'Google',
    iconSvg: svg('<circle cx="12" cy="12" r="8"/><path d="M16 12h-5"/><path d="M12 8.5a3.5 3.5 0 1 0 3.2 5"/>'),
  },
  {
    id: 'discord',
    name: 'Discord',
    iconSvg: svg('<rect x="4" y="6" width="16" height="12" rx="4"/><circle cx="9.5" cy="12" r="1.15" fill="currentColor" stroke="none"/><circle cx="14.5" cy="12" r="1.15" fill="currentColor" stroke="none"/><path d="m8 18.5 1-2.4M16 18.5l-1-2.4"/>'),
  },
  {
    id: 'github',
    name: 'GitHub',
    iconSvg: svg('<circle cx="6" cy="6" r="2.2"/><circle cx="6" cy="18" r="2.2"/><circle cx="18" cy="12" r="2.2"/><path d="M6 8.2v7.6"/><path d="M8.15 7.15c3.1 0 5.15 1.55 7.55 3.2"/>'),
  },
  {
    id: 'email',
    name: 'Email',
    iconSvg: svg('<rect x="3.5" y="5.5" width="17" height="13" rx="1.5"/><path d="m4.2 7.2 7.8 6 7.8-6"/>'),
  },
];

const byId = new Map(AUTH_PROVIDERS.map((p) => [p.id, p]));

export function providerDef(id: string): AuthProviderDef | undefined {
  return byId.get(id as AuthProviderId);
}

export function providerName(id: string): string {
  return providerDef(id)?.name || id;
}

/** 只顯示伺服器已開放的方式；未在清單裡的之後新增項目不會提早出現。 */
export function visibleProviders(enabledIds: string[]): AuthProviderDef[] {
  const set = new Set(enabledIds);
  return AUTH_PROVIDERS.filter((p) => set.has(p.id));
}

export function parseEnabledProviders(j: unknown): string[] {
  if (!j || typeof j !== 'object') return [];
  const rec = j as Record<string, unknown>;
  if (Array.isArray(rec.providers)) {
    return rec.providers.map((x) => String(x || '').trim().toLowerCase()).filter(Boolean);
  }
  if (rec.google === true) return ['google'];
  return [];
}

export function parseLinkedProviders(j: unknown): string[] {
  if (!j || typeof j !== 'object') return [];
  const rec = j as Record<string, unknown>;
  if (Array.isArray(rec.links)) {
    const out: string[] = [];
    for (const item of rec.links) {
      if (typeof item === 'string') {
        if (item) out.push(item);
      } else if (item && typeof item === 'object' && 'provider' in item) {
        const p = String((item as { provider?: unknown }).provider || '').trim();
        if (p) out.push(p);
      }
    }
    return out;
  }
  if (rec.bound && rec.provider) return [String(rec.provider)];
  return [];
}
