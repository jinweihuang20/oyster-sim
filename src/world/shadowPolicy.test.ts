import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  SHADOW_MAP_MAX, SHADOW_MAP_MOBILE,
  shadowMapEnabled, shadowMapSize, shadowMapType,
} from './shadowPolicy';

describe('shadowPolicy', () => {
  it('手機／省電／已烘焙場景關即時陰影', () => {
    expect(shadowMapEnabled({ coarse: true })).toBe(false);
    expect(shadowMapEnabled({ eco: true })).toBe(false);
    expect(shadowMapEnabled({ bakedScene: true })).toBe(false);
    expect(shadowMapEnabled({})).toBe(true);
  });

  it('不用 PCFSoft；手機 Basic、桌機 PCF', () => {
    expect(shadowMapType({ coarse: true })).toBe(THREE.BasicShadowMap);
    expect(shadowMapType({ eco: true })).toBe(THREE.BasicShadowMap);
    expect(shadowMapType({})).toBe(THREE.PCFShadowMap);
    expect(shadowMapType({})).not.toBe(THREE.PCFSoftShadowMap);
  });

  it('貼圖尺寸 ≤1024', () => {
    expect(shadowMapSize({ coarse: true })).toBe(SHADOW_MAP_MOBILE);
    expect(shadowMapSize({})).toBe(SHADOW_MAP_MAX);
    expect(SHADOW_MAP_MAX).toBeLessThanOrEqual(1024);
  });
});
