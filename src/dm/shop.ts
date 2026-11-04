import { shopWeapons, type WeaponDef, type WeaponId } from './weapons';
import { ico, I } from './icons';

/** 死鬥內只換槍，不賣；購買在主線雜貨店 */
export const SHOP_FREE = false;

export function shopOverlayHtml(): string {
  return `<div id="dmShop"><div id="dmShopBox">
<div id="dmShopHd"><span>${ico(I.shop, 22)} 換槍</span>
<button class="dmb" id="dmShopX" aria-label="關閉">✕</button></div>
<div id="dmShopHint">點槍可預覽（拖曳旋轉）；只能裝備雜貨店已買的槍。</div>
<div id="dmShopList"></div>
</div></div>`;
}

export function shopCss(): string {
  return `
#dmShopBtn{right:calc(env(safe-area-inset-right) + 112px)}
#dmShop{position:absolute;inset:0;background:rgba(0,0,0,.45);display:none;align-items:center;justify-content:center;z-index:5}
#dmShop.show{display:flex}
#dmShopBox{position:relative;background:rgba(24,24,24,.82);border:1px solid rgba(235,235,235,.55);border-radius:14px;color:#f2f2f2;padding:0 14px 14px;width:min(92vw,380px);max-height:calc(100dvh - env(safe-area-inset-top) - env(safe-area-inset-bottom) - 24px);overflow:auto;touch-action:pan-y;-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px)}
#dmShopHd{position:sticky;top:0;background:rgba(24,24,24,.95);display:flex;justify-content:space-between;align-items:center;padding:10px 0;z-index:1;font-weight:600}
#dmShopX{position:static!important;width:44px;height:44px;padding:0!important}
#dmShopHint{font-size:13px;opacity:.7;margin:0 0 10px}
#dmShopList{display:flex;flex-direction:column;gap:8px}
.dmShopItem{display:flex;flex-direction:column;gap:4px;padding:10px 12px;border:1px solid rgba(235,235,235,.22);border-radius:12px;background:rgba(255,255,255,.04);cursor:pointer;text-align:left;color:inherit;font:inherit}
.dmShopItem:hover,.dmShopItem:focus{border-color:rgba(235,235,235,.55);background:rgba(255,255,255,.08)}
.dmShopItem.on{border-color:#3dcf6a;box-shadow:0 0 0 1px #3dcf6a}
.dmShopItem.locked{opacity:.45;cursor:not-allowed}
.dmShopItem.locked:hover,.dmShopItem.locked:focus{border-color:rgba(235,235,235,.22);background:rgba(255,255,255,.04)}
.dmShopItem b{font-weight:700;font-size:16px}
.dmShopItem small{opacity:.72;font-size:12px;line-height:1.35}
.dmShopMeta{display:flex;flex-wrap:wrap;gap:8px;font-size:12px;opacity:.8;margin-top:2px}
.dmShopAct{font-size:12px;font-weight:600;opacity:.9;margin-top:4px}
`;
}

function itemStats(d: WeaponDef): string {
  return `<span>傷害 ${d.damage}</span><span>彈匣 ${d.maxAmmo}</span><span>射速 ${d.fireRate.toFixed(1)}/s</span>${d.burstCount > 1 ? `<span>${d.burstCount} 連發</span>` : ''}${d.pelletCount > 1 ? `<span>散彈 ×${d.pelletCount}</span>` : ''}<span>彈速 ${d.bulletSpeed}</span>${d.zoom > 1 ? `<span>開鏡 ${d.zoom}×</span>` : ''}${d.adsBreakOnFire ? '<span>開火須重開鏡</span>' : ''}`;
}

export function renderShopList(
  listEl: HTMLElement,
  opts: { equipped: WeaponId; owned: Set<WeaponId>; onPick: (id: WeaponId) => void },
) {
  const rows = shopWeapons();
  listEl.innerHTML = rows.map(d => {
    const eq = d.id === opts.equipped;
    const own = opts.owned.has(d.id);
    const act = eq ? '使用中' : own ? '裝備' : '未購買・去雜貨店';
    return `<button type="button" class="dmShopItem${eq ? ' on' : ''}${own ? '' : ' locked'}" data-id="${d.id}" ${own ? '' : 'aria-disabled="true"'}>
<b>${ico(I.gun, 18)} ${d.name}</b>
<small>${d.blurb}</small>
<div class="dmShopMeta">${itemStats(d)}</div>
<div class="dmShopAct">${act}</div>
</button>`;
  }).join('');
  listEl.querySelectorAll<HTMLElement>('.dmShopItem').forEach(el => {
    el.onclick = () => {
      const id = el.dataset.id as WeaponId;
      if (id) opts.onPick(id);
    };
  });
}
