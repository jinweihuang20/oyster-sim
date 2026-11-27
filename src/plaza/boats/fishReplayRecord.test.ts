import { describe, it, expect, vi } from 'vitest';
import { VIDEO_QUALITY, VQ_KEY, loadVideoQuality, saveVideoQuality, hdDpr, pickVideoMime, extOfMime, videoFileName, canRecordVideo, fmtMB, ReplayVideoRec, VIDEO_BPS, type VideoRecDeps } from './fishReplayRecord';

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

describe('錄影片：畫質', () => {
  it('標準 30 fps／3.5 Mbps 不拉解析度；高畫質 60 fps／10 Mbps 拉解析度', () => {
    expect(VIDEO_QUALITY.standard).toMatchObject({ fps: 30, bps: 3_500_000, boost: false, label: '標準' });
    expect(VIDEO_QUALITY.high).toMatchObject({ fps: 60, bps: 10_000_000, boost: true, label: '高畫質' });
  });
  it('高畫質倍率：最多 2 倍、不超過 1080p、不比原本差', () => {
    // 手機橫向 844×390：2 倍＝1688×780
    expect(hdDpr(844, 390, 1)).toBe(2);
    // 電腦 1280×720：1.5 倍＝1920×1080
    expect(hdDpr(1280, 720, 1)).toBeCloseTo(1.5, 5);
    // 直式 390×844：2 倍＝780×1688（長邊沒超過 1920）
    expect(hdDpr(390, 844, 1.5)).toBe(2);
    // 平板 1024×768：短邊卡 1080（1440×1080）
    expect(hdDpr(1024, 768, 1)).toBeCloseTo(1080 / 768, 5);
    expect(844 * hdDpr(390, 844, 1)).toBeLessThanOrEqual(1920 + 1e-6);
    // 1920×1080 的螢幕：維持 1；原本 3 倍的就不降
    expect(hdDpr(1920, 1080, 1)).toBe(1);
    expect(hdDpr(390, 844, 3)).toBe(3);
    expect(Number.isFinite(hdDpr(NaN, 0, NaN))).toBe(true);
  });
  it('記住選擇；沒有／壞掉／讀不到＝標準', () => {
    const m = new Map<string, string>();
    const st = { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v); } };
    expect(loadVideoQuality(st)).toBe('standard');
    saveVideoQuality(st, 'high'); expect(m.get(VQ_KEY)).toBe('high'); expect(loadVideoQuality(st)).toBe('high');
    m.set(VQ_KEY, 'ultra'); expect(loadVideoQuality(st)).toBe('standard');
    expect(loadVideoQuality(null)).toBe('standard');
    expect(loadVideoQuality({ getItem: () => { throw new Error('x'); }, setItem: () => { } })).toBe('standard');
    expect(() => saveVideoQuality({ getItem: () => null, setItem: () => { throw new Error('full'); } }, 'high')).not.toThrow();
  });
  it('高畫質用 60 fps／10 Mbps 開串流和錄影機', () => {
    const f = fakes();
    const v = new ReplayVideoRec(f.d);
    v.start('aji', 1, 'high');
    expect(f.d.stream).toHaveBeenCalledWith(60);
    expect(f.rec().opt.videoBitsPerSecond).toBe(10_000_000);
    v.abort();
    v.start('aji', 1);
    expect(f.d.stream).toHaveBeenLastCalledWith(30);
    expect(f.rec().opt.videoBitsPerSecond).toBe(3_500_000);
  });
});

describe('錄影片：解析度一定還原', () => {
  const setup = (frame = false) => {
    const f = fakes();
    const restore = vi.fn();
    const prepare = vi.fn(() => restore);
    f.d.prepare = prepare;
    let pend: (() => void) | null = null;
    if (frame) f.d.nextFrame = cb => { pend = cb; };
    return { f, restore, prepare, flush: () => { const p = pend; pend = null; p?.(); } };
  };
  it('先拉解析度、等一幀，才開串流和錄影機', () => {
    const { f, prepare, flush } = setup(true);
    const v = new ReplayVideoRec(f.d);
    v.start('aji', 1, 'high');
    expect(prepare).toHaveBeenCalledWith('high');
    expect(v.st).toBe('arming');
    expect(f.d.stream).not.toHaveBeenCalled();
    flush();
    expect(f.d.stream).toHaveBeenCalled();
    expect(v.st).toBe('rec');
    expect((prepare.mock.invocationCallOrder[0])).toBeLessThan((f.d.stream as any).mock.invocationCallOrder[0]);
  });
  it('正常錄完：停止那一刻就還原（只一次）', async () => {
    const { f, restore } = setup();
    const v = new ReplayVideoRec(f.d);
    v.start('aji', 1, 'high');
    expect(restore).not.toHaveBeenCalled();
    v.stop();
    expect(restore).toHaveBeenCalledTimes(1);
    await tick();
    expect(v.st).toBe('ready');
    expect(restore).toHaveBeenCalledTimes(1);
  });
  it('離開回放（錄到一半／還在等第一幀）：還原', () => {
    const a = setup(); const v = new ReplayVideoRec(a.f.d);
    v.start('aji', 1, 'high'); v.abort(); expect(a.restore).toHaveBeenCalledTimes(1);
    const b = setup(true); const w = new ReplayVideoRec(b.f.d);
    w.start('aji', 1, 'high'); w.abort(); expect(b.restore).toHaveBeenCalledTimes(1);
    b.flush(); expect(b.f.d.stream).not.toHaveBeenCalled();
    // 等第一幀時按停止＝取消
    const c = setup(true); const x = new ReplayVideoRec(c.f.d);
    x.start('aji', 1, 'high'); x.stop(); expect(c.restore).toHaveBeenCalledTimes(1); expect(x.st).toBe('idle');
  });
  it('出錯（串流拿不到／錄影機出錯／空檔）：還原', async () => {
    const a = setup(); a.f.d.stream = () => { throw new Error('no'); };
    const v = new ReplayVideoRec(a.f.d);
    expect(v.start('aji', 1, 'high')).toBe(false); expect(a.restore).toHaveBeenCalledTimes(1); expect(v.st).toBe('error');
    const b = setup(); const w = new ReplayVideoRec(b.f.d);
    w.start('aji', 1, 'high'); b.f.rec().onerror?.(new Error('x'));
    expect(b.restore).toHaveBeenCalledTimes(1); expect(w.st).toBe('error');
  });
  it('再錄一支：上一支的還原先做', () => {
    const { f, restore } = setup();
    const v = new ReplayVideoRec(f.d);
    v.start('aji', 1, 'high'); v.start('aji', 1, 'high');
    expect(restore).toHaveBeenCalledTimes(1);
    v.clear(); expect(restore).toHaveBeenCalledTimes(2);
  });
});
