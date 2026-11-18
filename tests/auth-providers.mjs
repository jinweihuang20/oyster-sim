// 帳號綁定方式清單與伺服器回傳解析（不啟動瀏覽器）
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { transformSync } from 'esbuild';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = readFileSync(join(root, 'src/core/authProviders.ts'), 'utf8');
const { code } = transformSync(src, { loader: 'ts', format: 'cjs', target: 'node18' });
const require = createRequire(import.meta.url);
const mod = { exports: {} };
const fn = new Function('module', 'exports', 'require', code);
fn(mod, mod.exports, require);
const {
  AUTH_PROVIDERS, providerName, visibleProviders, parseEnabledProviders, parseLinkedProviders,
} = mod.exports;

let failed = 0;
const eq = (a, b, msg) => {
  const sa = JSON.stringify(a), sb = JSON.stringify(b);
  if (sa !== sb) { console.error('FAIL', msg, 'got', sa, 'want', sb); failed++; }
  else console.log('ok', msg);
};

eq(AUTH_PROVIDERS.map((p) => p.id), ['google', 'discord', 'github', 'email'], 'registry order');
eq(providerName('google'), 'Google', 'google display name');
eq(visibleProviders(['google']).map((p) => p.id), ['google'], 'only enabled show');
eq(visibleProviders(['discord', 'google']).map((p) => p.id), ['google', 'discord'], 'keep registry order');
eq(visibleProviders([]), [], 'none enabled');
eq(parseEnabledProviders({ ok: true, google: true, providers: ['google'] }), ['google'], 'providers list');
eq(parseEnabledProviders({ ok: true, google: true }), ['google'], 'back-compat google:true');
eq(parseEnabledProviders({ ok: false, google: false, providers: [] }), [], 'empty when not configured');
eq(parseLinkedProviders({ bound: true, provider: 'google', links: [{ provider: 'google' }] }), ['google'], 'links objects');
eq(parseLinkedProviders({ bound: true, provider: 'google' }), ['google'], 'back-compat single provider');
eq(parseLinkedProviders({ bound: false }), [], 'unbound has no links');

for (const p of AUTH_PROVIDERS) {
  if (!p.iconSvg.includes('<svg') || !p.iconSvg.includes('stroke="currentColor"')) {
    console.error('FAIL icon', p.id); failed++;
  } else console.log('ok icon', p.id);
}

if (failed) process.exit(1);
console.log('all ok');
