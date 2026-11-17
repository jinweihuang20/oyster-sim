// 輕量回跳網址測試（不需瀏覽器）。與 src/core/authReturn.ts 行為對齊。
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

function readOysterAuth(href) {
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

function canonicalReturnUrl(href) {
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

function stripOysterAuthFromUrl(href) {
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

const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../src/core/authReturn.ts'), 'utf8');
assert.match(src, /export function readOysterAuth/);
assert.match(src, /export function canonicalReturnUrl/);
assert.match(src, /oyster_auth/);

assert.equal(readOysterAuth('https://jinweihuang20.github.io/oyster-sim-preview/?oyster_auth=ABC').code, 'ABC');
assert.equal(readOysterAuth('https://jinweihuang20.github.io/oyster-sim-preview/#oyster_auth=DEF').code, 'DEF');
assert.equal(readOysterAuth('https://x.example/oyster-sim-preview/?foo=1&oyster_auth=Q#oyster_auth=H').code, 'Q');
assert.equal(readOysterAuth('https://x.example/p/?oyster_auth_err=denied').err, 'denied');
assert.equal(
  canonicalReturnUrl('https://jinweihuang20.github.io/oyster-sim-preview?oyster_auth=X'),
  'https://jinweihuang20.github.io/oyster-sim-preview/',
);
assert.equal(
  canonicalReturnUrl('https://oyster-dev.gwtech.org/oyster-sim?oyster_auth=X'),
  'https://oyster-dev.gwtech.org/oyster-sim/',
);
assert.equal(
  canonicalReturnUrl('https://jinweihuang20.github.io/oyster-sim-preview/?keep=1&oyster_auth=X'),
  'https://jinweihuang20.github.io/oyster-sim-preview/?keep=1',
);
assert.equal(stripOysterAuthFromUrl('https://x.example/p/?oyster_auth=A&k=1#oyster_auth=A'), '/p/?k=1');
console.log('auth-return tests passed');
