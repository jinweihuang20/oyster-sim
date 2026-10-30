#!/usr/bin/env node
// 產生剝蚵仔兌換碼的雜湊值，貼到 src/redeemCodes.ts。
// 用法：npm run hash-code -- <兌換碼>
// 正規化規則必須和 src/redeem.ts 的 normalizeCode() / hashCode() 一致。
import { createHash } from 'node:crypto';

const HASH_PREFIX = 'oyster-sim:';
const raw = process.argv.slice(2).join(' ');
if (!raw.trim()) { console.error('用法：npm run hash-code -- <兌換碼>'); process.exit(1); }
const normalized = raw.replace(/\s+/g, '').toUpperCase();
const hash = createHash('sha256').update(HASH_PREFIX + normalized, 'utf8').digest('hex');
console.log(`兌換碼（正規化後）：${normalized}`);
console.log(`hash：${hash}`);
console.log('');
console.log('貼到 src/redeemCodes.ts 的 REDEEM_CODES：');
console.log(`  { id: '請取一個不重複的 id', hash: '${hash}', reward: { money: 500 }, label: '活動名稱', end: '2026-12-31T23:59:59+08:00' },`);
