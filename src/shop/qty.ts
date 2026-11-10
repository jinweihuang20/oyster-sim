/** 商店購買數量元件：可重複購買的商品用（藥品、道具） */
const QTY_MAX = 99;
const qtyMem = new Map<string, number>();

export function getQty(key: string) { return qtyMem.get(key) ?? 1; }
export function resetQty(key: string) { qtyMem.set(key, 1); }

export function qtyHtml(key: string) {
  const n = getQty(key);
  return `<div class="qtyBox" data-qk="${key}"><button type="button" class="qtyBtn" data-qd="-1" aria-label="少一個"${n <= 1 ? ' disabled' : ''}><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true"><path d="M6 12h12"/></svg></button><input class="qtyIn" type="text" inputmode="numeric" value="${n}" aria-label="購買數量"><button type="button" class="qtyBtn" data-qd="1" aria-label="多一個"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true"><path d="M6 12h12M12 6v12"/></svg></button></div>`;
}

/**
 * 綁定數量元件。unit：單價（含特價）；money：目前餘額；buy：購買按鈕；
 * label：數量 1 時原本的按鈕內容（保留特價樣式）
 */
export function bindQty(root: ParentNode, key: string, unit: () => number, money: () => number, buy: HTMLButtonElement) {
  const box = root.querySelector<HTMLElement>(`.qtyBox[data-qk="${key}"]`);
  if (!box) return;
  const inp = box.querySelector<HTMLInputElement>('.qtyIn')!;
  const minus = box.querySelector<HTMLButtonElement>('[data-qd="-1"]')!;
  const plus = box.querySelector<HTMLButtonElement>('[data-qd="1"]')!;
  const label1 = buy.innerHTML;
  const set = (v: number) => {
    const n = Math.max(1, Math.min(QTY_MAX, Math.floor(Number.isFinite(v) ? v : 1)));
    qtyMem.set(key, n);
    inp.value = String(n);
    minus.disabled = n <= 1;
    const u = unit();
    const afford = Math.floor(money() / Math.max(1, u));
    plus.disabled = n >= QTY_MAX || n >= afford;
    buy.innerHTML = n === 1 ? label1 : `買 ${n} 個 $${u * n}`;
    buy.disabled = money() < u * n;
  };
  minus.onclick = e => { e.stopPropagation(); set(getQty(key) - 1); };
  plus.onclick = e => { e.stopPropagation(); set(getQty(key) + 1); };
  inp.oninput = () => { const v = parseInt(inp.value.replace(/\D/g, ''), 10); if (Number.isFinite(v)) set(v); };
  inp.onblur = () => set(getQty(key));
  inp.onfocus = () => inp.select();
  set(getQty(key));
}
