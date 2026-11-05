import { postDiscordFeedback } from './discord';

export type FeedbackDeps = {
  $: (id: string) => HTMLElement;
  toast: (t: string, c?: string) => void;
  getState: () => string;
  getLocId: () => string;
  getDays: () => number;
  statsId: string;
  statsUrl: string;
  coarse: boolean;
};

let D: FeedbackDeps;
let fbCat = '', fbFrom = '', fbLast = 0, fbMood = 0, fbTimer = 0;
const FB_PH: Record<string, string> = { bug: '哪裡出問題？在做什麼的時候發生的？例如：在王功漁港撬第三顆時畫面卡住…', idea: '想加什麼東西？新的刀、新漁港、新阿婆都可以講～', fun: '哪裡最好玩？哪個阿婆最好笑？', hard: '哪一段太難？撬殼、投碗還是躲殼？' };
const MOOD_TXT = ['', '很差', '普通偏差', '還可以', '不錯', '超好玩'];

export function fbShow(done: boolean) {
  const $ = D.$;
  $('fbForm').style.display = done ? 'none' : '';
  $('fbDone').classList.toggle('on', done);
}

export function openFb(from: string) {
  const $ = D.$;
  fbFrom = from;
  $(from).classList.remove('show');
  fbShow(false);
  $('fb').classList.add('show');
  fbCount();
  fbCool();
}

function fbCount() {
  const $ = D.$;
  const n = ($('fbText') as HTMLTextAreaElement).value.length, c = $('fbCount');
  c.textContent = `${n}/500`;
  c.className = n >= 480 ? 'full' : n >= 400 ? 'near' : '';
}

function fbCool() {
  const $ = D.$;
  const left = Math.ceil((60_000 - (Date.now() - fbLast)) / 1000), btn = $('fbSend') as HTMLButtonElement;
  clearTimeout(fbTimer);
  if (left > 0 && fbLast) {
    btn.disabled = true;
    $('fbSendTxt').textContent = `阿婆喘口氣… ${left} 秒`;
    fbTimer = window.setTimeout(fbCool, 1000);
  } else {
    btn.disabled = false;
    $('fbSendTxt').textContent = '送出';
  }
}

const bounce = (el: Element) => { el.classList.remove('pop'); void (el as HTMLElement).offsetWidth; el.classList.add('pop'); };

export function initFeedback(deps: FeedbackDeps) {
  D = deps;
  const $ = D.$;
  const FB_URL = D.statsUrl.replace(/\/e$/, '/feedback');

  document.querySelectorAll<HTMLButtonElement>('[data-fc]').forEach(b => b.onclick = () => {
    fbCat = b.dataset.fc!;
    document.querySelectorAll<HTMLButtonElement>('[data-fc]').forEach(x => x.classList.toggle('sel', x === b));
    bounce(b);
    ($('fbText') as HTMLTextAreaElement).placeholder = FB_PH[fbCat] ?? '';
  });
  document.querySelectorAll<HTMLButtonElement>('[data-mood]').forEach(b => b.onclick = () => {
    const v = +b.dataset.mood!;
    fbMood = fbMood === v ? 0 : v;
    document.querySelectorAll<HTMLButtonElement>('[data-mood]').forEach(x => { x.classList.toggle('sel', +x.dataset.mood! <= fbMood); });
    bounce(b);
    $('fbMoodTxt').textContent = fbMood ? `${fbMood}/5 ${MOOD_TXT[fbMood]}` : '';
  });
  $('fbText').addEventListener('input', fbCount);
  $('setFb').onclick = () => openFb('settings');
  $('rFb').onclick = () => openFb('result');
  $('fbClose').onclick = () => { $('fb').classList.remove('show'); fbShow(false); if (fbFrom) $(fbFrom).classList.add('show'); };
  $('fbBack').onclick = () => { $('fb').classList.remove('show'); fbShow(false); if (fbFrom === 'result' || D.getState() !== 'play') { if (fbFrom) $(fbFrom).classList.add('show'); } };
  $('fbSend').onclick = () => {
    const ta = $('fbText') as HTMLTextAreaElement, text = ta.value.trim().slice(0, 500);
    if (!fbCat) { D.toast('先選一個類別喔'); bounce($('fbCats')); return; }
    if (!text) { D.toast('寫點什麼再送出吧'); ta.focus(); return; }
    if (Date.now() - fbLast < 60_000) { fbCool(); return; }
    fbLast = Date.now(); const btn = $('fbSend'); btn.classList.add('flying'); ($('fbSend') as HTMLButtonElement).disabled = true; $('fbSendTxt').textContent = '送出中…';
    const ua = navigator.userAgent, uaS = (/(iPhone|iPad|Android|Windows|Mac OS X|Linux)/.exec(ua)?.[1] ?? '?') + ' ' + (/(Edg|Chrome|Firefox|Safari)\/[\d]+/.exec(ua)?.[0] ?? '');
    const body = JSON.stringify({
      uid: D.statsId, cat: fbCat, text, mood: fbMood || undefined,
      contact: ($('fbContact') as HTMLInputElement).value.trim().slice(0, 120),
      meta: { ver: __BUILD__, dev: D.coarse ? 'mobile' : 'pc', screen: `${innerWidth}x${innerHeight}`, loc: D.getLocId(), days: D.getDays(), ua: uaS, mood: fbMood || undefined },
    });
    const catName: Record<string, string> = { bug: '🐛 Bug', idea: '💡 建議', fun: '😊 好玩', hard: '😣 太難' };
    const pBack = fetch(FB_URL, { method: 'POST', body, headers: { 'Content-Type': 'text/plain' }, mode: 'cors' }).then(r => r.ok, () => false);
    const pDc = postDiscordFeedback(`剝蚵仔模擬器｜${catName[fbCat] ?? fbCat}`, text, {
      心情: fbMood ? `${'🦪'.repeat(fbMood)} ${fbMood}/5` : '未選',
      版本: __BUILD__,
      裝置: `${D.coarse ? 'mobile' : 'pc'} ${uaS}`,
      螢幕: `${innerWidth}x${innerHeight}`,
      漁港: D.getLocId(),
      工數: D.getDays(),
    });
    const minT = new Promise(r => setTimeout(r, 700));
    Promise.all([pBack, pDc, minT]).then(([a, b]) => {
      btn.classList.remove('flying');
      if (a || b) {
        ta.value = ''; fbCount(); fbMood = 0;
        document.querySelectorAll('[data-mood].sel').forEach(x => x.classList.remove('sel'));
        $('fbMoodTxt').textContent = ''; fbShow(true); fbCool();
      } else { fbLast = 0; fbCool(); D.toast('送出失敗，稍後再試'); }
    });
  };
  (window as any).__fbDone = () => fbShow(true);
}
