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

function fxStats(fx) {
  if (!fx || typeof fx !== 'object') return {};
  const o = {};
  for (const [k, v] of Object.entries(fx)) if (typeof v === 'number') o[k] = v;
  return o;
}

export function buildCatalog(src, version = '', oddSrc = src, wpnSrc = '', petSrc = '') {
  const DIFF_W = ev(src, 'DIFF_W');
  const items = [];
  ev(src, 'RAR').forEach((p, i) => items.push({ id: `pearl-${i}`, name: p.name, category: 'pearl', rarity: rarOf(p.w), weight: p.w, price: p.price, limited: false }));
  ev(oddSrc, 'ODD').forEach((o, i) => items.push({ id: `odd-${i}`, name: o.name, category: 'odd', rarity: rarOf(o.weight), weight: o.weight, price: o.price, limited: !!o.limited }));
  ev(src, 'KNIVES').forEach(k => items.push({
    id: k.id, name: k.n, category: 'knife', price: k.price, limited: false,
    stats: { n: k.n, desc: k.desc, green: k.green, speed: k.speed, steps: k.steps, stab: k.stab, seam: k.seam, luck: k.luck },
  }));
  ev(src, 'UMBS').forEach(u => items.push({
    id: u.id, name: u.n, category: 'umbrella', price: u.price, limited: false,
    stats: { n: u.n, desc: u.desc, open: u.open, dur: u.dur, perf: u.perf, cover: u.cover, reflect: u.reflect, size: u.size },
  }));
  // 盆的 id 'wide' 和刀重複：購買事件只能用價格分辨，所以盆另給 key
  ev(src, 'BOWLS').forEach(b => items.push({
    id: b.id, key: b.id === 'wide' ? 'bowl-wide' : b.id, name: b.n, category: 'basin', price: b.price, limited: false,
    stats: { n: b.n, desc: b.desc, r: b.r, bounce: b.bounce, dist: b.dist, perf: b.perf, bonus: b.bonus, h: b.h },
  }));
  const walkBonus = (() => { try { return ev(src, 'WALK_SPEED_BONUS'); } catch { return {}; } })();
  ev(src, 'GEAR').forEach(g => items.push({
    id: g.id, name: g.n.replace(/^\S+\s/, ''), category: 'tool', price: g.price, limited: false,
    stats: {
      n: g.n, good: g.good, bad: g.bad,
      dmgMul: g.dmgMul, speedMul: g.speedMul, angerMul: g.angerMul, seamMul: g.seamMul,
    },
  }));
  ev(src, 'COSMETICS').forEach(g => items.push({
    id: g.id, name: g.n, category: 'tool', price: g.price, limited: false,
    stats: { n: g.n, good: g.good },
  }));
  ev(src, 'FLAG_PRICE_ITEMS').forEach(g => items.push({ id: g.id, name: g.n, category: 'tool', price: g.price, limited: false }));
  ev(src, 'MEDS').forEach(m => {
    const stats = { n: m.n, good: m.good, bad: m.bad, dur: m.dur ?? 0 };
    if (m.luck != null) stats.luck = m.luck;
    if (m.heal != null) stats.heal = m.heal;
    if (m.m) for (const [k, v] of Object.entries(m.m)) stats['m' + k[0].toUpperCase() + k.slice(1)] = v;
    items.push({ id: 'med-' + m.id, name: m.n, emo: m.emo, category: 'med', price: m.price, limited: false, stats });
  });
  ev(src, 'ITEMS').forEach(m => items.push({
    id: 'item-' + m.id, name: m.n, category: 'item', price: m.price, limited: false,
    stats: { n: m.n, good: m.good, bad: m.bad },
  }));
  ev(src, 'EQUIP').forEach(e => {
    const stats = { n: e.n, eff: e.eff, ...fxStats(e.fx) };
    if (walkBonus[e.id] != null) stats.walk = walkBonus[e.id];
    items.push({ id: e.id, name: e.n, category: SLOT_CAT[e.slot] ?? 'equip', price: e.price, limited: false, stats });
  });
  if (petSrc) {
    ev(petSrc, 'PETS').forEach(p => items.push({
      id: p.id, name: p.n, category: 'pet', price: p.price, limited: false,
      stats: { n: p.n, desc: p.desc, eff: p.eff, tickSec: p.fx?.tickSec, perTick: p.fx?.perTick, meatDiff: p.fx?.meatDiff },
    }));
  }
  ev(src, 'LOCS', { DIFF_W }).forEach(l => items.push({ id: 'loc-' + l.id, loc: l.id, name: l.n, category: 'location', price: l.price, need: l.need, limited: false }));
  ev(src, 'SEATS').forEach(s => items.push({ id: s.id, name: s.n, category: 'seat', price: 0, limited: false }));
  if (wpnSrc) {
    Object.values(ev(wpnSrc, 'WEAPON_DEFS')).forEach(w => {
      if (!w?.inShop) return;
      items.push({ id: w.id, name: w.name, category: 'weapon', price: w.price, limited: false });
    });
  }
  const sets = ev(src, 'SETS').map(s => ({ id: s.id, name: s.n, need: s.need, stats: { n: s.n, eff: s.eff, ...fxStats(s.fx) } }));
  return { schema: 2, version, generated: new Date().toISOString(), items, sets };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const main = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8')
    + '\n' + readFileSync(new URL('../src/shop/yardShop.ts', import.meta.url), 'utf8')
    + '\n' + readFileSync(new URL('../src/plaza/flags.ts', import.meta.url), 'utf8')
    + '\n' + readFileSync(new URL('../src/shop/meds.ts', import.meta.url), 'utf8')
    + '\n' + readFileSync(new URL('../src/shop/shopEquip.ts', import.meta.url), 'utf8')
    + '\n' + readFileSync(new URL('../src/world/locs.ts', import.meta.url), 'utf8');
  const odd = readFileSync(new URL('../src/shop/oddities.ts', import.meta.url), 'utf8');
  const wpn = readFileSync(new URL('../src/dm/weapons.ts', import.meta.url), 'utf8');
  const pet = readFileSync(new URL('../src/shop/pets.ts', import.meta.url), 'utf8');
  const c = buildCatalog(main, '', odd, wpn, pet);
  console.log(JSON.stringify(c, null, 1));
}
