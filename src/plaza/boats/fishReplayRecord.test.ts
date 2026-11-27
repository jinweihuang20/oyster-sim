import { describe, it, expect, vi } from 'vitest';
import { pickVideoMime, extOfMime, videoFileName, canRecordVideo, fmtMB, ReplayVideoRec, VIDEO_BPS, type VideoRecDeps } from './fishReplayRecord';

describe('錄影片：格式挑選', () => {
  it('MP4 優先於 WebM', () => {
    expect(pickVideoMime(true, () => true)).toEqual({ mime: 'video/mp4;codecs=avc1.42E01E', ext: 'mp4' });
    expect(pickVideoMime(true, t => t === 'video/mp4' || t.startsWith('video/webm'))).toEqual({ mime: 'video/mp4', ext: 'mp4' });
  });
  it('沒有 MP4 就 WebM（vp9 > vp8 > webm）', () => {
    expect(pickVideoMime(true, t => t.startsWith('video/webm'))!.mime).toBe('video/webm;codecs=vp9');
    expect(pickVideoMime(true, t => t === 'video/webm;codecs=vp8' || t === 'video/webm')!.mime).toBe('video/webm;codecs=vp8');
  });
  it('都問不到但有 MediaRecorder＝用預設；沒有 MediaRecorder＝不能錄', () => {
    expect(pickVideoMime(true, () => false)).toEqual({ mime: '', ext: 'webm' });
    expect(pickVideoMime(true, () => { throw new Error('x'); })).toEqual({ mime: '', ext: 'webm' });
    expect(pickVideoMime(true, null)).toEqual({ mime: '', ext: 'webm' });
    expect(pickVideoMime(false, () => true)).toBeNull();
  });
  it('能不能錄：要有 MediaRecorder 和 captureStream', () => {
    expect(canRecordVideo({}, { captureStream: () => 0 })).toBe(false);
    expect(canRecordVideo({ MediaRecorder: function () { } }, {})).toBe(false);
    expect(canRecordVideo({ MediaRecorder: Object.assign(function () { }, { isTypeSupported: () => false }) }, { captureStream: () => 0 })).toBe(true);
  });
  it('副檔名跟著格式', () => {
    expect(extOfMime('video/mp4;codecs=avc1')).toBe('mp4');
    expect(extOfMime('video/webm;codecs=vp9')).toBe('webm');
    expect(extOfMime('')).toBe('webm');
  });
});

describe('錄影片：檔名', () => {
  const d = new Date(2026, 10, 27, 9, 5, 7);
  it('只有安全字元、副檔名正確', () => {
    const n = videoFileName('suzuki', 3.4, 'mp4', d);
    expect(n).toBe('oyster-fish-suzuki-3_40kg-20261127-090507.mp4');
    expect(videoFileName('大 魚/../x?', 12.34, 'webm', d)).toBe('oyster-fish-x-12_3kg-20261127-090507.webm');
    expect(videoFileName('', NaN, 'webm', d)).toBe('oyster-fish-fish-0kg-20261127-090507.webm');
    for (const s of ['a b', '<script>', '黑鯛', 'Kuro_Dai-1']) expect(videoFileName(s, 1, 'mp4', d)).toMatch(/^[a-z0-9_.-]+$/);
  });
  it('大小顯示', () => { expect(fmtMB(3.6 * 1024 * 1024)).toBe('3.6 MB'); expect(fmtMB(10)).toBe('0.1 MB'); });
});

/** 假的瀏覽器：串流軌、錄影機、網址 */
function fakes(opt: { share?: boolean; shareErr?: string; mp4?: boolean } = {}) {
  const tracks = [{ stop: vi.fn() }];
  const urls = new Set<string>(); let un = 0;
  let rec: any = null;
  const shared: File[][] = []; const dl: string[] = [];
  const d: VideoRecDeps = {
    stream: vi.fn(() => ({ getTracks: () => tracks })),
    recorder: vi.fn((_s, o) => {
      rec = { state: 'inactive', mimeType: o.mimeType ?? 'video/webm', opt: o, ondataavailable: null, onstop: null, onerror: null,
        start() { this.state = 'recording'; },
        stop() { this.state = 'inactive'; queueMicrotask(() => { this.ondataavailable?.({ data: new Blob([new Uint8Array(1000)], { type: this.mimeType }) }); this.onstop?.(); }); } };
      return rec;
    }),
    isSupported: t => (opt.mp4 ? true : t.startsWith('video/webm')),
    createURL: () => { const u = `blob:${++un}`; urls.add(u); return u; },
    revokeURL: u => { urls.delete(u); },
    share: opt.share ? vi.fn(async (x: { files: File[] }) => { shared.push(x.files); if (opt.shareErr) { const e = new Error('x'); e.name = opt.shareErr; throw e; } }) : null,
    canShare: opt.share ? () => true : null,
    makeFile: (b, n, t) => ({ name: n, type: t, size: b.size } as unknown as File),
    download: (u, n) => { dl.push(`${u}|${n}`); },
  };
  return { d, tracks, urls, shared, dl, rec: () => rec };
}
const tick = () => new Promise(r => setTimeout(r, 0));

describe('錄影片：狀態機', () => {
  it('開始→停止→好了→下載；位元率、只有影像', async () => {
    const f = fakes();
    const v = new ReplayVideoRec(f.d);
    const ch = vi.fn(); v.onChange = ch;
    expect(v.start('suzuki', 3.4)).toBe(true);
    expect(v.st).toBe('rec');
    expect(f.rec().opt.videoBitsPerSecond).toBe(VIDEO_BPS);
    expect(f.rec().opt.mimeType).toBe('video/webm;codecs=vp9');
    v.stop(); expect(v.st).toBe('finishing');
    await tick();
    expect(v.st).toBe('ready'); expect(ch).toHaveBeenCalledWith('ready');
    expect(v.size).toBe(1000);
    expect(v.name).toMatch(/\.webm$/);
    expect(f.tracks[0].stop).toHaveBeenCalled();
    expect(f.urls.size).toBe(1);
    expect(v.save()).toBe('download');
    expect(f.dl[0]).toContain(v.name);
    v.clear(); expect(f.urls.size).toBe(0); expect(v.st).toBe('idle');
  });
  it('MP4 檔名；手機能分享＝叫分享面板、取消不下載', async () => {
    const f = fakes({ share: true, mp4: true, shareErr: 'AbortError' });
    const v = new ReplayVideoRec(f.d);
    v.start('kurodai', 1.2); v.stop(); await tick();
    expect(v.name).toMatch(/\.mp4$/);
    expect(v.save()).toBe('share');
    await tick(); await tick();
    expect(f.shared.length).toBe(1);
    expect(f.dl.length).toBe(0);
  });
  it('分享失敗（不是取消）改下載', async () => {
    const f = fakes({ share: true, shareErr: 'NotAllowedError' });
    const v = new ReplayVideoRec(f.d);
    v.start('aji', 0.5); v.stop(); await tick();
    v.save(); await tick(); await tick();
    expect(f.dl.length).toBe(1);
  });
  it('中途離開＝丟掉：沒有檔案、軌停掉、沒有網址', async () => {
    const f = fakes();
    const v = new ReplayVideoRec(f.d);
    v.start('aji', 0.5);
    v.abort(); await tick();
    expect(v.st).toBe('idle'); expect(v.blob).toBeNull();
    expect(f.tracks[0].stop).toHaveBeenCalled();
    expect(f.urls.size).toBe(0);
    expect(v.save()).toBe('none'); expect(f.dl.length).toBe(0);
  });
  it('再錄一支會先釋放上一支', async () => {
    const f = fakes();
    const v = new ReplayVideoRec(f.d);
    v.start('aji', 0.5); v.stop(); await tick();
    expect(f.urls.size).toBe(1);
    v.start('aji', 0.5); expect(f.urls.size).toBe(0);
    v.stop(); await tick(); expect(f.urls.size).toBe(1);
    v.abort(); expect(f.urls.size).toBe(0);
  });
  it('串流拿不到＝失敗、不會卡在錄影中', () => {
    const f = fakes();
    f.d.stream = () => { throw new Error('no'); };
    const v = new ReplayVideoRec(f.d);
    expect(v.start('aji', 1)).toBe(false);
    expect(v.st).toBe('error');
  });
});
