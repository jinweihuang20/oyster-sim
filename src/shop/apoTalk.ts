/** 阿珀垃圾話與貓拳打中阿婆時的抱怨（廣場只同步編號，避免自由文字） */
export const APO_LINES = [
  '這廣場的蚵仔都我的',
  '你剝那麼慢是在剝空氣嗎',
  '本喵只是路過，順便收保護費',
  '阿婆的碗看來就不太老實',
  '走那麼快，殼都跟不上',
  '別盯著本喵，去剝你的蚵仔',
  '你們人類手腳真的很笨',
  '本喵一拳比你剝一天還有效',
  '聞得到殼，沒看到本事',
  '凳子留給會剝的人坐',
  '阿婆轉頭就偷，學著點',
  '本喵不是來陪逛的',
  '碗空空的還坐在這裡幹嘛',
  '誰把殼丟過來，對折回去',
  '本喵腳邊不要亂站',
  '這堆蚵仔品質普通，勉為其難',
  '你再發呆，本喵要先收工了',
  '廣場風水不錯，適合收保護費',
  '別摸頭，本喵在執勤',
  '那盤看起來就很一般',
  '走路不看路，差點踩到本喵',
  '本喵今天心情一般，你們小心點',
  '蚵仔給我留一點，剩下隨你們',
  '本喵先巡一圈，不要跟丟了',
] as const;

export const APO_SCOLDS = [
  '哎唷！哪來的貓拳！',
  '這貓怎麼打人的頭！',
  '我的蚵仔！你給我放下！',
  '惡貓！誰家的！',
  '頭好暈，這是什麼爪子',
  '拜託管好你家的貓',
  '疼死了啦！貓拳頭那麼長',
  '打人還搖爪子，太過分了',
] as const;

export const APO_ID = 'pt_apo';

export function apoLine(i: number): string {
  const n = APO_LINES.length;
  if (n <= 0) return '';
  return APO_LINES[((i % n) + n) % n];
}

export function apoScold(i: number): string {
  const n = APO_SCOLDS.length;
  if (n <= 0) return '';
  return APO_SCOLDS[((i % n) + n) % n];
}

export function pickApoLine(): number {
  return Math.floor(Math.random() * APO_LINES.length);
}

export function pickApoScold(): number {
  return Math.floor(Math.random() * APO_SCOLDS.length);
}
