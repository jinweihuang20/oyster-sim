/**
 * 精彩回放存成影片（純畫面，不錄聲音）：
 * - 格式：先找 MP4（手機相簿／LINE 最好用），不行再 WebM；都問不到但有 MediaRecorder 就用瀏覽器預設。
 * - 錄影＝WebGL 畫布的 captureStream(30)，只有影像軌；約 3.5 Mbps（手機不燙、檔案小）。
 * - 錄完不直接下載（那時已經不在點擊裡，Safari／Chrome 會擋）：變成「影片好了 — 儲存／分享」按鈕，
 *   玩家再點一次才分享（navigator.share 檔案）或下載（<a download>），兩邊都在新的點擊裡，一定成功。
 * - 中途離開回放＝丟掉，不會跳出壞掉的下載；串流軌一定停掉、物件網址一定釋放。
 * 瀏覽器物件都從 deps 進來（可測試）。
 */

export const VIDEO_MIMES = [
  'video/mp4;codecs=avc1.42E01E',
  'video/mp4;codecs=h264',
  'video/mp4',
  'video/webm;codecs=vp9',
  'video/webm;codecs=vp8',
  'video/webm',
] as const;
export const VIDEO_FPS = 30;
export const VIDEO_BPS = 3_500_000;

export type VideoExt = 'mp4' | 'webm';
export const extOfMime = (m: string | undefined | null): VideoExt => (/mp4|quicktime|h264|avc/i.test(m ?? '') ? 'mp4' : 'webm');

/** 挑格式：回 null＝這個瀏覽器不能錄；mime＝''＝用 MediaRecorder 預設 */
export function pickVideoMime(hasRecorder: boolean, isSupported?: ((t: string) => boolean) | null): { mime: string; ext: VideoExt } | null {
  if (!hasRecorder) return null;
  if (isSupported) {
    for (const m of VIDEO_MIMES) {
      let ok = false;
      try { ok = !!isSupported(m); } catch { ok = false; }
      if (ok) return { mime: m, ext: extOfMime(m) };
    }
  }
  return { mime: '', ext: 'webm' };
}

/** 瀏覽器能不能錄畫布影片 */
export function canRecordVideo(g: any = globalThis, canvas?: { captureStream?: unknown } | null): boolean {
  const MR = g?.MediaRecorder;
  if (typeof MR !== 'function') return false;
  const cs = canvas ? canvas.captureStream : g?.HTMLCanvasElement?.prototype?.captureStream;
  if (typeof cs !== 'function') return false;
  return !!pickVideoMime(true, typeof MR.isTypeSupported === 'function' ? (t: string) => MR.isTypeSupported(t) : null);
}

const pad = (n: number) => String(n).padStart(2, '0');
/** 檔名：oyster-fish-<魚種>-<重量>kg-<日期時間>.<副檔名>（只有英數、-、_） */
export function videoFileName(sp: string, kg: number, ext: VideoExt, d: Date = new Date()) {
  const s = String(sp ?? '').toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 32) || 'fish';
  const w = Number.isFinite(kg) && kg > 0 ? (kg < 10 ? kg.toFixed(2) : kg.toFixed(1)).replace('.', '_') : '0';
  const ts = Number.isFinite(d.getTime()) ? `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}` : 'clip';
  return `oyster-fish-${s}-${w}kg-${ts}.${ext === 'mp4' ? 'mp4' : 'webm'}`;
}
export const fmtMB = (bytes: number) => `${Math.max(0.1, (Number.isFinite(bytes) ? bytes : 0) / (1024 * 1024)).toFixed(1)} MB`;

// ---------------- 錄影狀態機 ----------------
type Track = { stop(): void };
type Stream = { getTracks(): Track[] };
type Rec = {
  state: string; mimeType?: string;
  ondataavailable: ((e: { data: Blob }) => void) | null;
  onstop: (() => void) | null;
  onerror: ((e: unknown) => void) | null;
  start(slice?: number): void; stop(): void;
};
export type VideoRecDeps = {
  /** 拿畫布串流（只有影像） */
  stream: (fps: number) => Stream;
  recorder: (s: Stream, opt: { mimeType?: string; videoBitsPerSecond: number }) => Rec;
  isSupported?: ((t: string) => boolean) | null;
  createURL: (b: Blob) => string;
  revokeURL: (u: string) => void;
  /** 分享（沒有＝只能下載） */
  share?: ((d: { files: File[]; title?: string }) => Promise<void>) | null;
  canShare?: ((d: { files: File[] }) => boolean) | null;
  makeFile?: (b: Blob, name: string, type: string) => File;
  /** 下載（<a download>） */
  download: (url: string, name: string) => void;
};
export type VideoRecState = 'idle' | 'rec' | 'finishing' | 'ready' | 'error';

export class ReplayVideoRec {
  st: VideoRecState = 'idle';
  blob: Blob | null = null;
  url = '';
  name = '';
  type = '';
  private stream: Stream | null = null;
  private rec: Rec | null = null;
  private chunks: Blob[] = [];
  private discard = false;
  private sp = ''; private kg = 0; private ext: VideoExt = 'webm';
  /** 狀態變了（錄好／失敗）時通知 UI */
  onChange: ((st: VideoRecState) => void) | null = null;
  constructor(private d: VideoRecDeps) {}

  get size() { return this.blob?.size ?? 0; }
  /** 開始錄（先丟掉上一支）；失敗回 false */
  start(sp: string, kg: number): boolean {
    this.clear();
    const pick = pickVideoMime(true, this.d.isSupported);
    if (!pick) return false;
    this.sp = sp; this.kg = kg; this.ext = pick.ext; this.discard = false; this.chunks = [];
    try {
      this.stream = this.d.stream(VIDEO_FPS);
      const opt: { mimeType?: string; videoBitsPerSecond: number } = { videoBitsPerSecond: VIDEO_BPS };
      if (pick.mime) opt.mimeType = pick.mime;
      const r = this.d.recorder(this.stream, opt);
      this.rec = r;
      r.ondataavailable = e => { if (!this.discard && e.data && e.data.size > 0) this.chunks.push(e.data); };
      r.onstop = () => this.finish();
      r.onerror = () => { this.fail(); };
      r.start(500);
      this.st = 'rec';
      return true;
    } catch {
      this.fail();
      return false;
    }
  }
  /** 錄到尾巴／玩家按停止：收成一支影片（非同步，好了會變 ready） */
  stop() {
    if (this.st !== 'rec') return;
    this.st = 'finishing';
    try { if (this.rec && this.rec.state !== 'inactive') this.rec.stop(); else this.finish(); } catch { this.finish(); }
  }
  /** 中途離開：丟掉，不產生檔案 */
  abort() {
    if (this.st === 'rec' || this.st === 'finishing') {
      this.discard = true;
      try { if (this.rec && this.rec.state !== 'inactive') this.rec.stop(); } catch { /* 已停 */ }
    }
    this.clear();
  }
  /** 丟掉一切（停串流、釋放網址） */
  clear() {
    if (this.rec) { this.rec.ondataavailable = null; this.rec.onstop = null; this.rec.onerror = null; }
    this.rec = null;
    this.stopTracks();
    if (this.url) { try { this.d.revokeURL(this.url); } catch { /* */ } }
    this.url = ''; this.blob = null; this.name = ''; this.type = ''; this.chunks = [];
    this.st = 'idle';
  }
  private stopTracks() {
    const s = this.stream; this.stream = null;
    if (s) for (const t of s.getTracks()) { try { t.stop(); } catch { /* */ } }
  }
  private finish() {
    const rec = this.rec;
    this.stopTracks();
    if (this.discard || !rec) { this.clear(); return; }
    rec.ondataavailable = null; rec.onstop = null; rec.onerror = null;
    this.rec = null;
    const type = rec.mimeType || this.chunks[0]?.type || (this.ext === 'mp4' ? 'video/mp4' : 'video/webm');
    const blob = new Blob(this.chunks, { type: type.split(';')[0] });
    this.chunks = [];
    if (blob.size <= 0) { this.fail(); return; }
    this.ext = extOfMime(type);
    this.blob = blob; this.type = blob.type;
    this.name = videoFileName(this.sp, this.kg, this.ext);
    this.url = this.d.createURL(blob);
    this.st = 'ready';
    this.onChange?.('ready');
  }
  private fail() {
    this.discard = true;
    this.clear();
    this.st = 'error';
    this.onChange?.('error');
  }
  /**
   * 儲存／分享：一定要在玩家的點擊裡同步呼叫（share／下載才不會被擋）。
   * 能分享檔案（手機）＝叫分享面板（存到相簿、傳 LINE）；玩家取消（AbortError）就算了；其他失敗或不能分享＝下載。
   * 回 'share' | 'download' | 'none'
   */
  save(): 'share' | 'download' | 'none' {
    if (this.st !== 'ready' || !this.blob) return 'none';
    const mk = this.d.makeFile ?? ((b: Blob, n: string, t: string) => new File([b], n, { type: t }));
    let file: File | null = null;
    try { file = mk(this.blob, this.name, this.type); } catch { file = null; }
    if (file && this.d.share && this.d.canShare) {
      let can = false;
      try { can = !!this.d.canShare({ files: [file] }); } catch { can = false; }
      if (can) {
        const url = this.url, name = this.name;
        this.d.share({ files: [file], title: '蚵仔煎模擬器・精彩回放' }).catch((e: unknown) => {
          if ((e as { name?: string })?.name === 'AbortError') return;
          // 分享失敗（不是取消）：改下載
          if (this.url === url) this.d.download(url, name);
        });
        return 'share';
      }
    }
    this.d.download(this.url, this.name);
    return 'download';
  }
}

/** 瀏覽器版的 deps */
export function browserVideoDeps(canvas: HTMLCanvasElement): VideoRecDeps {
  const MR = (globalThis as any).MediaRecorder;
  const nav = globalThis.navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean };
  return {
    stream: fps => (canvas as any).captureStream(fps),
    recorder: (s, opt) => new MR(s, opt),
    isSupported: typeof MR?.isTypeSupported === 'function' ? (t: string) => MR.isTypeSupported(t) : null,
    createURL: b => URL.createObjectURL(b),
    revokeURL: u => URL.revokeObjectURL(u),
    share: typeof nav?.share === 'function' ? d => nav.share(d) : null,
    canShare: typeof nav?.canShare === 'function' ? d => nav.canShare!(d) : null,
    download: (url, name) => {
      const a = document.createElement('a');
      a.href = url; a.download = name; a.rel = 'noopener'; a.style.display = 'none';
      document.body.append(a); a.click(); a.remove();
    },
  };
}
