/** 解析／整理 OAuth 回跳網址（純函式，可供測試）。 */

export function readOysterAuth(href: string): { code: string; err: string } {
  let code = '';
  let err = '';
  try {
    const u = new URL(href);
    code = (u.searchParams.get('oyster_auth') || '').trim();
    err = (u.searchParams.get('oyster_auth_err') || '').trim();
    const raw = (u.hash || '').replace(/^#/, '');
    if (raw) {
      const hp = new URLSearchParams(raw.includes('=') ? raw : '');
      if (!code) code = (hp.get('oyster_auth') || '').trim();
      if (!err) err = (hp.get('oyster_auth_err') || '').trim();
    }
  } catch { /* 無效網址就當沒有 */ }
  return { code, err };
}

/** 回傳給伺服器的遊戲網址：去掉票證參數，目錄路徑補上結尾斜線，避免轉址 404 或丟掉 query。 */
export function canonicalReturnUrl(href: string): string {
  const u = new URL(href);
  u.hash = '';
  u.searchParams.delete('oyster_auth');
  u.searchParams.delete('oyster_auth_err');
  let path = u.pathname || '/';
  const last = path.split('/').pop() || '';
  if (!path.endsWith('/') && !last.includes('.')) path += '/';
  const q = u.searchParams.toString();
  return u.origin + path + (q ? '?' + q : '');
}

export function stripOysterAuthFromUrl(href: string): string {
  const u = new URL(href);
  u.searchParams.delete('oyster_auth');
  u.searchParams.delete('oyster_auth_err');
  let hash = (u.hash || '').replace(/^#/, '');
  if (hash) {
    const hp = new URLSearchParams(hash.includes('=') ? hash : '');
    if (hp.has('oyster_auth') || hp.has('oyster_auth_err')) {
      hp.delete('oyster_auth');
      hp.delete('oyster_auth_err');
      const left = hp.toString();
      u.hash = left ? '#' + left : '';
    }
  }
  const q = u.searchParams.toString();
  return u.pathname + (q ? '?' + q : '') + (u.hash || '');
}
