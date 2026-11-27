import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { normRack, type RackDto } from './rackLogic';
import {
  RACK_BEACON, RACK_RADAR, rackBeaconState, rackWorldToRadar, radarClamp, rackRadarCovered, buildRadarMarks,
} from './rackRadar';

const now = 1_000_000;
const rack = (o: Record<string, unknown>): RackDto => normRack({
  id: 1, x: 0, z: 0, h: 0, n: 0, t: now, ok: '', owner: '', max: 12, growMs: 20_000, up: '111111', ...o,
})!;

describe('自己蚵棚的高空標記狀態', () => {
  it('只有自己的棚才有標記；公共、別人的私人都沒有', () => {
    expect(rackBeaconState(rack({ ok: '' }), 'me', now)).toBe('none');
    expect(rackBeaconState(rack({ ok: 'other', owner: '阿明' }), 'me', now)).toBe('none');
    expect(rackBeaconState(rack({ ok: 'me', n: 0 }), 'me', now)).toBe('grow');
    expect(rackBeaconState(rack({ ok: 'me', n: 0 }), '', now)).toBe('none');
  });
  it('有串可收或已長滿＝金色，空棚／還在長＝青色', () => {
    expect(rackBeaconState(rack({ ok: 'me', n: 0, t: now }), 'me', now)).toBe('grow');
    expect(rackBeaconState(rack({ ok: 'me', n: 1, t: now }), 'me', now)).toBe('ripe');
    const growing = rack({ ok: 'me', n: 0, t: now, growMs: 20_000 });
    expect(rackBeaconState(growing, 'me', now + 19_999)).toBe('grow');
    expect(rackBeaconState(growing, 'me', now + 20_000)).toBe('ripe');
    expect(rackBeaconState(rack({ ok: 'me', n: 12, max: 12, t: now }), 'me', now)).toBe('ripe');
  });
  it('光柱最遠 200 m、容量 8、顏色是青／金', () => {
    expect(RACK_BEACON.viewR).toBe(200);
    expect(RACK_BEACON.cap).toBe(8);
    expect(RACK_BEACON.grow).toBe(0x38bdf8);
    expect(RACK_BEACON.ripe).toBe(0xfacc15);
  });
});

describe('海面小雷達：船頭朝上座標', () => {
  it('h=0 時前方是 -z（畫面 -y）、右方是 +x、後方是 +y', () => {
    const a = rackWorldToRadar(0, -10, 0); expect(a.x).toBeCloseTo(0); expect(a.y).toBeCloseTo(-10);
    const r = rackWorldToRadar(10, 0, 0); expect(r.x).toBeCloseTo(10); expect(r.y).toBeCloseTo(0);
    const b = rackWorldToRadar(0, 10, 0); expect(b.x).toBeCloseTo(0); expect(b.y).toBeCloseTo(10);
    const l = rackWorldToRadar(-8, 0, 0); expect(l.x).toBeCloseTo(-8); expect(l.y).toBeCloseTo(0);
  });
  it('h=π/2 時船頭朝 -x，世界 -x 會畫在上方', () => {
    const h = Math.PI / 2;
    const ahead = rackWorldToRadar(-10, 0, h);
    expect(ahead.x).toBeCloseTo(0); expect(ahead.y).toBeCloseTo(-10);
    const right = rackWorldToRadar(0, -10, h);
    expect(right.x).toBeCloseTo(10); expect(right.y).toBeCloseTo(0);
    const behind = rackWorldToRadar(10, 0, h);
    expect(behind.x).toBeCloseTo(0); expect(behind.y).toBeCloseTo(10);
  });
  it('自己的蚵棚超出半徑時貼在內圈邊緣，方位不變', () => {
    const far = radarClamp(0, -200, RACK_RADAR.clampR);
    expect(far.clamped).toBe(true);
    expect(far.dist).toBe(200);
    expect(far.x).toBeCloseTo(0);
    expect(far.y).toBeCloseTo(-RACK_RADAR.clampR);
    const inside = radarClamp(30, -40, RACK_RADAR.clampR);
    expect(inside.clamped).toBe(false);
    expect(inside.x).toBe(30); expect(inside.y).toBe(-40);
    // 斜向：方向（角度）保持
    const a = radarClamp(120, 160, 95);
    expect(a.clamped).toBe(true);
    expect(Math.hypot(a.x, a.y)).toBeCloseTo(95);
    expect(Math.atan2(a.y, a.x)).toBeCloseTo(Math.atan2(160, 120));
  });
  it('組標記：遠處自己的棚會貼邊，別人的棚超出範圍就不畫；碼頭也會貼邊', () => {
    const boat = { x: 0, z: 0, h: 0 };
    const marks = buildRadarMarks({
      boat, me: 'me', now,
      pier: { x: 0, z: 200 },
      racks: [
        rack({ id: 1, ok: 'me', n: 3, x: 0, z: -200 }),
        rack({ id: 2, ok: 'me', n: 0, x: 50, z: 0 }),
        rack({ id: 3, ok: '', n: 5, x: 0, z: -40 }),
        rack({ id: 4, ok: 'other', n: 2, x: 0, z: 180 }),
      ],
    });
    const mineFar = marks.find(m => m.kind === 'mineRipe')!;
    expect(mineFar.clamped).toBe(true);
    expect(mineFar.y).toBeCloseTo(-RACK_RADAR.clampR);
    const mineNear = marks.find(m => m.kind === 'mineGrow')!;
    expect(mineNear.clamped).toBe(false);
    expect(mineNear.x).toBeCloseTo(50);
    expect(marks.some(m => m.kind === 'public' && m.y === -40)).toBe(true);
    expect(marks.some(m => m.kind === 'other')).toBe(false);
    const pier = marks.find(m => m.kind === 'pier')!;
    expect(pier.clamped).toBe(true);
    expect(pier.y).toBeCloseTo(RACK_RADAR.clampR);
  });
  it('拉魚、升級面板、釣魚 HUD 打開時要藏雷達', () => {
    expect(rackRadarCovered('plazaBoating')).toBe(false);
    expect(rackRadarCovered('plazaBoating fishFight')).toBe(true);
    expect(rackRadarCovered('rackPanelOpen')).toBe(true);
    expect(rackRadarCovered('fishPanelOpen')).toBe(true);
    expect(rackRadarCovered('plazaFishing')).toBe(true);
    expect(rackRadarCovered('fishMode')).toBe(true);
    expect(rackRadarCovered('fishReplayOn')).toBe(true);
  });
  it('場景用一個 InstancedMesh 畫自己棚的高空光柱（容量 8、不裁切、不受霧擋住）', () => {
    const scene = readFileSync('src/plaza/boats/boatScene.ts', 'utf8');
    const racks = readFileSync('src/plaza/boats/plazaRacks.ts', 'utf8');
    const css = readFileSync('src/style.css', 'utf8');
    expect(scene).toContain('plazaRackBeacons');
    expect(scene).toContain('RACK_BEACON.cap');
    expect(scene).toContain('fog: false');
    expect(racks).toContain('sea.beacon');
    expect(racks).toContain('isMine(r, me)');
    expect(css).toContain('#boatRadar');
    expect(css).toContain('pointer-events:none');
    expect(css).not.toMatch(/#boatRadar[^}]*backdrop-filter/);
  });
});
