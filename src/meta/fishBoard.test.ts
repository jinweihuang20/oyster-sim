import { describe, expect, it } from 'vitest';
import { parseFishLb, fishScoreHtml, fishEmptyHint, fishMeText, fmtKg, isFishBoard, FISH_BOARDS } from './fishBoard';

const row = (o: Record<string, unknown>) => ({ rank: 1, k: 'aaaaaaaa', nick: '小美', tag: '12345', title: null, atitle: null, foil: false, me: false, kg: 0, sp: '', name: '', total: 0, n: 0, rev: 0, ...o });
const sample = {
  big: { rows: [row({ kg: 420.5, sp: 'manta', name: '鬼蝠魟', foil: true }), row({ rank: 2, k: 'bbbbbbbb', nick: '小華', kg: 0.25, sp: 'kisu', name: '沙鮻', me: true })], mine: row({ rank: 2, k: 'bbbbbbbb', nick: '小華', kg: 0.25, sp: 'kisu', name: '沙鮻', me: true }), count: 2 },
  weight: { rows: [row({ total: 1234.56, n: 88 })], mine: null, count: 1 },
  rev: { rows: [row({ rev: 1250000 })], mine: row({ rank: null, me: true, rev: 99999 }), count: 1 },
};

describe('釣魚歷史排行榜', () => {
  it('解析三個榜與 mine', () => {
    const fl = parseFishLb(sample)!;
    expect(fl.big.rows).toHaveLength(2);
    expect(fl.big.rows[0].foil).toBe(true);
    expect(fl.big.mine?.rank).toBe(2);
    expect(fl.weight.rows[0].n).toBe(88);
    expect(fl.rev.mine?.rank).toBeNull();
    expect(fl.rev.mine?.rev).toBe(99999);
  });
  it('舊伺服器／壞資料回 null，缺欄位補預設', () => {
    expect(parseFishLb(null)).toBeNull();
    expect(parseFishLb({ rows: [] })).toBeNull();
    const fl = parseFishLb({ big: { rows: [{ rank: 1, nick: '' }, null] } })!;
    expect(fl.big.rows).toHaveLength(1);
    expect(fl.big.rows[0].nick).toBe('剝蚵人');
    expect(fl.weight.rows).toEqual([]);
    expect(fl.rev.mine).toBeNull();
  });
  it('大物榜顯示魚種名＋公斤', () => {
    const fl = parseFishLb(sample)!;
    const h = fishScoreHtml('fBig', fl.big.rows[0]);
    expect(h).toContain('鬼蝠魟');
    expect(h).toContain('420.5');
    expect(h).toContain('kg');
    expect(fishScoreHtml('fBig', fl.big.rows[1])).toContain('0.25');
  });
  it('累積總重顯示公斤與條數；總賣魚收入顯示金額', () => {
    const fl = parseFishLb(sample)!;
    const w = fishScoreHtml('fWeight', fl.weight.rows[0]);
    expect(w).toContain('1,234.6');
    expect(w).toContain('88 條');
    const r = fishScoreHtml('fRev', fl.rev.rows[0]);
    expect(r).toContain('$');
    expect(r).toContain('1,250,000');
  });
  it('名字會跳脫 HTML', () => {
    expect(fishScoreHtml('fBig', row({ name: '<b>x</b>', kg: 1 }) as any)).not.toContain('<b>x</b>');
  });
  it('空榜提示與我的名次', () => {
    for (const b of FISH_BOARDS) expect(fishEmptyHint(b.id).length).toBeGreaterThan(0);
    expect(fishMeText('fBig', null)).toBe('你尚未上榜');
    const fl = parseFishLb(sample)!;
    expect(fishMeText('fBig', fl.big.mine)).toContain('第 <b>2</b> 名');
    expect(fishMeText('fBig', fl.big.mine)).toContain('沙鮻 0.25 kg');
    expect(fishMeText('fRev', fl.rev.mine)).toContain('不公開排名');
    expect(fishMeText('fRev', fl.rev.mine)).toContain('$99,999');
  });
  it('公斤格式與榜 id', () => {
    expect(fmtKg(420.5)).toBe('420.5');
    expect(fmtKg(850)).toBe('850.0');
    expect(fmtKg(0.3)).toBe('0.3');
    expect(fmtKg(1234.56)).toBe('1,234.6');
    expect(isFishBoard('fBig')).toBe(true);
    expect(isFishBoard('seat')).toBe(false);
  });
});
