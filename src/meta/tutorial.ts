/** 新手教學流程（callbacks 經 deps） */

import { eco } from '../core/economy';

export type Tut = { i: number; c0: number; t0: number; b0: number; s0: number; m0: number; d0: number };
export type TutStep = { id: string; line: string; pc: string; mb: string; hi?: string[]; next?: string; done?: () => boolean; enter?: () => void };

export type TutorialDeps = {
  $: (id: string) => HTMLElement;
  on: (id: string, v: boolean) => void;
  COARSE: boolean;
  audio: () => { resume?: () => void } | void;
  getSave: () => { tutDone?: number; seat?: string };
  persist: () => void;
  track: (t: string, d?: Record<string, unknown>) => void;
  toast: (t: string, c?: string) => void;
  startDay: () => void;
  syncShiftUi: () => void;
  renderLocs: () => void;
  renderDaily: () => void;
  setPhase: (p: any) => void;
  getPhase: () => string;
  getState: () => string;
  setState: (s: 'menu' | 'play' | 'end') => void;
  oyster: { visible: boolean };
  closeUmbrella: () => void;
  stopSteal: () => void;
  getWalking: () => boolean;
  setWalking: (v: boolean) => void;
  clearWalkHud: () => void;
  handRig: { visible: boolean };
  stools: { userData: any }[];
  sitDown: (id: string) => void;
  standUp: () => void;
  discardShell: () => void;
  goPick: () => void;
  holdOyster: (i: number) => void;
  setProgress: (v: number) => void;
  setCrackedNow: (v: boolean) => void;
  seamGlow: { visible: boolean };
  seamRing: { visible: boolean };
  seamMark: { visible: boolean };
  shellTop: { visible: boolean };
  meatInHand: { visible: boolean; material: unknown };
  meatMat: unknown;
  setMeatsLeft: (v: number) => void;
  showExtra: () => void;
  setFind: (v: { kind: string; i: number }) => void;
  setEmptyT: (v: number) => void;
  later: (s: number, f: () => void) => void;
  getMissed: () => number;
  getCount: () => number;
  getThrown: () => number;
  getSteals: () => number;
  getMeatHits: () => number;
  getShellsOut: () => number;
  getUmbT: () => number;
  getNpcs: () => any[];
  windUp: (n: any) => void;
  giftAlert: () => void;
  svAlert: () => void;
  featAnnounce: () => void;
  newAnnounce: () => void;
  /** 回主畫面轉場（蓋住場景再開 overlay） */
  returnToMainMenu: (work?: () => void | Promise<void>, opts?: { then?: () => void }) => void;
};

let D: TutorialDeps;
export let tut: Tut | null = null;
export let TUT: TutStep[] = [];
let tutHi: string[] = [];

export function getTut() { return tut; }
export function isTut() { return !!tut; }

export function initTutorial(deps: TutorialDeps) {
  D = deps;
  TUT = [
    { id: 'grab', line: '來，阿姨教你！先拿一顆蚵仔起來。', pc: '點紅色臉盆裡的蚵仔（或按 Space）；移動滑鼠可以轉動視角', mb: '點紅色臉盆裡的蚵仔，或點自己的手；在畫面上滑動可以轉動視角', done: () => D.getPhase() === 'seam' },
    { id: 'seam', line: '蚵仔殼有一條縫，要轉到對準刀尖喔。', pc: '用滾輪／A D 轉蚵仔，金色的縫對準刀尖時點一下（或按 Space）插刀', mb: '按住 ◀ ▶ 或拖動蚵仔來轉，縫對準刀尖時點一下蚵仔插刀', hi: ['rotL', 'rotR'], done: () => { const p = D.getPhase(); return p === 'twist' || p === 'aim'; } },
    { id: 'pry', line: '刀插進去了！看指針，到綠區再撬，不要太用力喔～', pc: '指針走到綠區就點滑鼠／按 Space，撬到殼打開', mb: '指針走到綠區就點一下螢幕，撬到殼打開', hi: ['gauge'], done: () => D.getPhase() === 'aim' },
    { id: 'toss', line: '蚵仔肉出來了！碗亮起來的時候，點一下碗就能丟進去。', pc: '點一下碗（或碗附近），蚵仔肉就會飛進去', mb: '點一下碗（或碗附近），蚵仔肉就會飛進去', hi: [], done: () => D.getCount() > tut!.c0 },
    { id: 'meat', line: '試試看：再開一顆，點一下阿婆，把蚵仔肉丟過去！', pc: '再開一顆蚵仔，肉出來後轉過去對準阿婆點一下（這步肉不會自己入盆）', mb: '再開一顆蚵仔，肉出來後往上拖畫面找阿婆，點一下她（這步肉不會自己入盆）', hi: [], done: () => D.getMeatHits() > tut!.m0 },
    { id: 'empty', line: '肉丟出去了，手上剩下空殼。空殼可以自己丟到殼堆，或對準阿婆丟過去；平常放著不管，過一下也會自動丟到殼堆。', pc: '這步空殼不會自動丟：點一下畫面丟到殼堆，或對準阿婆按 F／右鍵丟過去', mb: '這步空殼不會自動丟：點一下畫面丟到殼堆，或對準阿婆按「丟殼」丟過去', hi: ['throwBtn'], done: () => D.getThrown() > tut!.t0 || D.getShellsOut() > tut!.d0 },
    { id: 'steal', line: '偷偷跟你說：阿婆轉頭聊天的時候，可以偷她碗裡的肉…', pc: '看到阿婆在聊天，對準她的碗按住 E 偷（被看到她會生氣）', mb: '看到阿婆在聊天，對準她的碗按住「偷」（被看到她會生氣）', hi: ['stealBtn'], next: '知道了 ▶', done: () => D.getSteals() > tut!.s0 },
    { id: 'shell', line: '撬出空殼，也可以丟向別人！', pc: '手上有空殼時，對準阿婆按 F 或右鍵丟過去', mb: '手上有空殼時，對準阿婆按「丟殼」丟過去', hi: ['throwBtn'], next: '知道了 ▶', done: () => D.getThrown() > tut!.t0 },
    { id: 'umb', line: '小心！阿婆要丟殼過來了！', pc: '看到 ⚠ 趕快按住 R 打開雨傘擋', mb: '看到 ⚠ 趕快按住「雨傘」擋', hi: ['umbBtn'], next: '知道了 ▶', done: () => D.getUmbT() > 0, enter: () => D.later(1.2, () => { if (tut && TUT[tut.i].id === 'umb') D.windUp(D.getNpcs()[0]); }) },
    { id: 'stand', line: '坐太久腳會麻，起來走走，找別的位子。', pc: '按 G 換位置', mb: '按「換位置」按鈕', hi: ['standBtn'], next: '知道了 ▶', done: () => D.getWalking() },
    { id: 'sit', line: '每個位子的好處都不一樣，看清楚再坐。', pc: '用 WASD 走到藍色板凳旁邊，按 E／「坐這裡」坐下（或按下面的「坐這裡」坐回原位）', mb: '用搖桿走到藍色板凳旁邊，按「坐這裡」坐下（或按下面的「坐這裡」坐回原位）', hi: ['sitBtn'], next: '坐回去 ▶', done: () => !D.getWalking() },
    { id: 'menu', line: '賺的錢可以去雜貨店買好刀、雨傘、碗和服飾，在「裝備」換穿；開到的珍珠會記在圖鑑裡。', pc: '上面有 🏪 雜貨店、圖鑑、⚙ 設定，開始畫面還有「裝備」', mb: '上面有 🏪 雜貨店、圖鑑、⚙ 設定，開始畫面還有「裝備」', hi: ['shopBtn', 'dexBtn', 'setBtn'], next: '下一步 ▶' },
    { id: 'daily', line: '還有，每天來上工，阿姨都發上工費給你！連續來領會越領越多。', pc: '', mb: '', next: '學會了！🎉' },
  ];

  setInterval(() => {
    if (!tut || D.getState() !== 'play') return; const st = TUT[tut.i];
    if (st.id === 'toss' && D.getPhase() !== 'busy' && D.getPhase() !== 'aim' && D.getCount() === tut.c0 && D.getMissed() > tut.b0) {
      D.toast('沒關係，再來一顆！', '#ffe080'); tutGo(0); return;
    }
    if (st.done?.()) tutGo(tut.i + 1);
  }, 120);

  D.$('tutNext').onclick = e => {
    e.stopPropagation(); if (!tut) return; const st = TUT[tut.i];
    if (st.id === 'sit' && D.getWalking()) D.sitDown(D.getSave().seat ?? 'door');
    tutGo(tut.i + 1);
  };
  D.$('tutStepSkip').onclick = e => {
    e.stopPropagation(); if (!tut || D.getState() !== 'play') return; const st = TUT[tut.i];
    if (st.id === 'empty' && D.getPhase() === 'empty') D.discardShell();
    if (st.id === 'sit' && D.getWalking()) D.sitDown(D.getSave().seat ?? 'door');
    tutGo(tut.i + 1);
  };
  D.$('tutSkip').onclick = e => { e.stopPropagation(); tutEnd(false); };
  ['tutNext', 'tutSkip', 'tutStepSkip'].forEach(id => D.$(id).addEventListener('pointerdown', e => e.stopPropagation()));
}

export function tutMeat() { return !!tut && TUT[tut.i].id === 'meat'; }

function tutShow() {
  if (!tut) return; const st = TUT[tut.i];
  tutHi.forEach(id => D.$(id).classList.remove('tutHi')); tutHi = st.hi ?? []; tutHi.forEach(id => D.$(id).classList.add('tutHi'));
  D.$('tutStep').textContent = `教學 ${tut.i + 1}/${TUT.length}`;
  D.$('tutLine').textContent = '👵 ' + st.line;
  let tip = D.COARSE ? st.mb : st.pc;
  if (st.id === 'daily') {
    const lo = eco.dailyPays[0] ?? 1000, hi = eco.dailyPays[6] ?? 3000;
    tip = `在開始畫面按「領今日上工費」，每天一次，從 $${lo} 起跳，連續 7 天最多 $${hi}`;
  }
  D.$('tutDo').textContent = '👉 ' + tip;
  D.$('tutKeys').style.display = D.COARSE ? 'none' : '';
  const nb = D.$('tutNext'); nb.textContent = (st.next ?? '') + (D.COARSE ? '' : '（Enter）'); nb.style.display = st.next ? '' : 'none';
}

export function tutGo(i: number) {
  if (!tut) return; if (i >= TUT.length) { tutEnd(true); return; }
  tut.i = i; tut.b0 = D.getMissed(); tut.c0 = D.getCount(); tut.t0 = D.getThrown(); tut.s0 = D.getSteals();
  tut.m0 = D.getMeatHits(); tut.d0 = D.getShellsOut();
  D.track('tutorial_step', { step: TUT[i].id, i }); TUT[i].enter?.(); tutPrep(); tutShow();
}

export function tutStart() {
  D.audio();
  ['overlay', 'result', 'dex', 'settings', 'shop'].forEach(i => D.$(i).classList.remove('show'));
  tut = { i: 0, c0: 0, t0: 0, b0: 0, s0: 0, m0: 0, d0: 0 };
  D.startDay(); document.body.classList.add('tutOn'); D.on('tut', true);
  D.track('tutorial_start', { replay: D.getSave().tutDone ? 1 : 0 });
  tutGo(0);
}

export function tutEnd(done: boolean) {
  if (!tut) return; const st = TUT[tut.i].id; tut = null;
  D.track(done ? 'tutorial_complete' : 'tutorial_skip', { step: st });
  D.getSave().tutDone = 1; D.persist();
  tutHi.forEach(id => D.$(id).classList.remove('tutHi')); tutHi = [];
  document.body.classList.remove('tutOn'); D.on('tut', false);
  if (document.pointerLockElement) document.exitPointerLock();
  if (D.getWalking()) { D.setWalking(false); D.clearWalkHud(); D.handRig.visible = true; D.stools.forEach(g => g.userData.tag.visible = false); }
  D.stopSteal(); D.setPhase('busy');
  D.oyster.visible = false; D.closeUmbrella();
  D.on('umbBtn', false); D.on('medBtn', false); D.on('quitBtn', false);
  D.$('radioBtn').style.display = 'none';
  document.getElementById('vign')?.classList.remove('on');
  D.$('medList').classList.remove('show');
  D.on('stealBtn', false); D.on('standBtn', false); D.on('lockHint', false);
  if (done) D.toast('出師了！去剝蚵仔賺錢吧～', '#9be37a');
  D.renderDaily();
  D.returnToMainMenu(undefined, {
    then: () => { setTimeout(() => { D.giftAlert(); D.svAlert(); D.featAnnounce(); D.newAnnounce(); }, 400); },
  });
}

function tutGive(want: 'pick' | 'seam' | 'twist' | 'aim' | 'empty') {
  if (!tut || D.getState() !== 'play') return;
  if (D.getWalking() && want !== 'pick') D.sitDown(D.getSave().seat ?? 'door');
  if (D.getWalking()) return;
  const phase = D.getPhase();
  const OK: Record<string, string[]> = { pick: ['pick'], seam: ['seam', 'twist', 'aim'], twist: ['twist', 'aim'], aim: ['aim'], empty: ['empty'] };
  if (OK[want].includes(phase)) return;
  if (want === 'pick') { if (phase !== 'busy') D.goPick(); return; }
  if (want === 'seam') { D.holdOyster(0); return; }
  if (phase !== 'seam' && phase !== 'twist') D.holdOyster(0);
  D.seamGlow.visible = false; D.seamRing.visible = false;
  if (want === 'twist') { D.setProgress(0); D.setCrackedNow(false); D.setPhase('twist'); return; }
  D.seamMark.visible = false; D.shellTop.visible = false; D.setMeatsLeft(1); D.showExtra(); D.setFind({ kind: 'none', i: 0 });
  if (want === 'aim') { D.meatInHand.visible = true; D.meatInHand.material = D.meatMat; D.setPhase('aim'); return; }
  D.meatInHand.visible = false; D.setEmptyT(2.2); D.setPhase('empty');
}

const TUT_NEED: Record<string, () => void> = {
  grab: () => tutGive('pick'), seam: () => tutGive('seam'), pry: () => tutGive('twist'),
  toss: () => tutGive('aim'), meat: () => tutGive('aim'), empty: () => tutGive('empty'),
  steal: () => { if (D.getWalking()) D.sitDown(D.getSave().seat ?? 'door'); },
  shell: () => tutGive('empty'),
  umb: () => { if (D.getWalking()) D.sitDown(D.getSave().seat ?? 'door'); },
  stand: () => { if (D.getWalking()) D.sitDown(D.getSave().seat ?? 'door'); },
  sit: () => { if (!D.getWalking()) D.standUp(); },
  menu: () => { if (D.getWalking()) D.sitDown(D.getSave().seat ?? 'door'); },
  daily: () => { if (D.getWalking()) D.sitDown(D.getSave().seat ?? 'door'); },
};

export function tutPrep() {
  if (!tut) return; const id = TUT[tut.i].id; TUT_NEED[id]?.();
  [0.7, 1.5, 2.5].forEach(t => D.later(t, () => { if (tut && TUT[tut.i].id === id && D.getPhase() !== 'busy') TUT_NEED[id]?.(); }));
}
