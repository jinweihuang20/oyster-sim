// 從 src/main.ts 的物品陣列產生 catalog.json（後台用：名稱、類別、稀有度、權重、價格、活動限定）。
// 用法：vite build 時自動輸出到 dist/catalog.json；也可 `node scripts/catalog.mjs` 印出來檢查。
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';

function grab(src, name) {
  const m = new RegExp(`(?:export\\s+)?const ${name}\\b[^=]*=\\s*`).exec(src);
  if (!m) throw new Error(`catalog: 找不到 const ${name}`);
  let i = m.index + m[0].length;
  while (i < src.length && /\s/.test(src[i])) i++;
  if (src[i] !== '[' && src[i] !== '{') throw new Error(`catalog: ${name} 不是陣列／物件`);
  let depth = 0, q = null;
  const start = i;
  for (; i < src.length; i++) {
    const c = src[i];
    if (q) { if (c === '\\') i++; else if (c === q) q = null; continue; }
    if (c === "'" || c === '"' || c === '`') q = c;
    else if (c === '[' || c === '{') depth++;
    else if (c === ']' || c === '}') { depth--; if (depth === 0) break; }
  }
  return src.slice(start, i + 1);
}
const ev = (src, name, scope = {}) => new Function(...Object.keys(scope), 'return ' + grab(src, name))(...Object.values(scope));
const rarOf = w => w <= 2 ? 'legend' : w <= 10 ? 'rare' : w <= 20 ? 'uncommon' : 'common';
const SLOT_CAT = { head: 'equip-head', hand: 'equip-sleeve', body: 'equip-shirt', legs: 'equip-pants', feet: 'equip-shoes' };

export function buildCatalog(src, version = '', oddSrc = src, wpnSrc = '') {
  const DIFF_W = ev(src, 'DIFF_W');
  const items = [];
  ev(src, 'RAR').forEach((p, i) => items.push({ id: `pearl-${i}`, name: p.name, category: 'pearl', rarity: rarOf(p.w), weight: p.w, price: p.price, limited: false }));
  ev(oddSrc, 'ODD').forEach((o, i) => items.push({ id: `odd-${i}`, name: o.name, category: 'odd', rarity: rarOf(o.weight), weight: o.weight, price: o.price, limited: !!o.limited }));
  ev(src, 'KNIVES').forEach(k => items.push({ id: k.id, name: k.n, category: 'knife', price: k.price, limited: false }));
  ev(src, 'UMBS').forEach(u => items.push({ id: u.id, name: u.n, category: 'umbrella', price: u.price, limited: false }));
  // 盆的 id 'wide' 和刀重複：購買事件只能用價格分辨，所以盆另給 key
  ev(src, 'BOWLS').forEach(b => items.push({ id: b.id, key: b.id === 'wide' ? 'bowl-wide' : b.id, name: b.n, category: 'basin', price: b.price, limited: false }));
  ev(src, 'GEAR').forEach(g => items.push({ id: g.id, name: g.n.replace(/^\S+\s/, ''), category: 'tool', price: g.price, limited: false }));
  ev(src, 'MEDS').forEach(m => items.push({ id: 'med-' + m.id, name: m.n, emo: m.emo, category: 'med', price: m.price, limited: false }));
  ev(src, 'ITEMS').forEach(m => items.push({ id: 'item-' + m.id, name: m.n, category: 'item', price: m.price, limited: false }));
  ev(src, 'EQUIP').forEach(e => items.push({ id: e.id, name: e.n, category: SLOT_CAT[e.slot] ?? 'equip', price: e.price, limited: false }));
  ev(src, 'LOCS', { DIFF_W }).forEach(l => items.push({ id: 'loc-' + l.id, loc: l.id, name: l.n, category: 'location', price: l.price, need: l.need, limited: false }));
  ev(src, 'SEATS').forEach(s => items.push({ id: s.id, name: s.n, category: 'seat', price: 0, limited: false }));
  if (wpnSrc) {
    Object.values(ev(wpnSrc, 'WEAPON_DEFS')).forEach(w => {
      if (!w?.inShop) return;
      items.push({ id: w.id, name: w.name, category: 'weapon', price: w.price, limited: false });
    });
  }
  const sets = ev(src, 'SETS').map(s => ({ id: s.id, name: s.n, need: s.need }));
  return { schema: 1, version, generated: new Date().toISOString(), items, sets };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const main = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8');
  const odd = readFileSync(new URL('../src/oddities.ts', import.meta.url), 'utf8');
  const wpn = readFileSync(new URL('../src/dm/weapons.ts', import.meta.url), 'utf8');
  const c = buildCatalog(main, '', odd, wpn);
  console.log(JSON.stringify(c, null, 1));
}
