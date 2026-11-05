import * as THREE from 'three';

export type SkyDome = {
  mesh: THREE.Mesh;
  /** 天頂／地平／下方（海平面下）色 */
  setColors: (zenith: number, horizon: number, nadir?: number) => void;
  /** 太陽方向（世界空間）與光暈強度 0～1 */
  setSun: (dir: THREE.Vector3, strength?: number) => void;
    /** 雲量 0～1 */
  setClouds: (amount: number) => void;
  /** 每幀：跟鏡頭、捲雲 */
  tick: (cam: THREE.Camera, tSec: number) => void;
};

/**
 * 半球天空穹頂：垂直漸層＋柔和程序雲＋太陽光暈。
 * 跟著鏡頭移動，不改場景縮放／模型。
 */
export function createSkyDome(opts?: { radius?: number; lo?: boolean }): SkyDome {
  const lo = !!opts?.lo;
  const radius = opts?.radius ?? (lo ? 42 : 48);
  const sunDir = new THREE.Vector3(-0.35, 0.75, -0.55).normalize();
  const u = {
    zenith: { value: new THREE.Color(0x5aa8d8) },
    horizon: { value: new THREE.Color(0xd8eaf4) },
    nadir: { value: new THREE.Color(0x8ab0c8) },
    sunDir: { value: sunDir.clone() },
    sunStr: { value: 0.85 },
    cloudAmt: { value: 0.55 },
    time: { value: 0 },
  };
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: u,
    vertexShader: /* glsl */ `
      varying vec3 vW;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vW = normalize(w.xyz - cameraPosition);
        gl_Position = projectionMatrix * viewMatrix * w;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 zenith, horizon, nadir, sunDir;
      uniform float sunStr, cloudAmt, time;
      varying vec3 vW;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p){
        vec2 i = floor(p), f = fract(p);
        float a = hash(i), b = hash(i + vec2(1.,0.));
        float c = hash(i + vec2(0.,1.)), d = hash(i + vec2(1.,1.));
        vec2 u = f * f * (3. - 2. * f);
        return mix(a, b, u.x) + (c - a) * u.y * (1. - u.x) + (d - b) * u.x * u.y;
      }
      float fbm(vec2 p){
        float v = 0., a = .5;
        for (int i = 0; i < ${lo ? 3 : 5}; i++) { v += a * noise(p); p *= 2.05; a *= .5; }
        return v;
      }
      void main() {
        vec3 v = normalize(vW);
        float h = v.y;
        // 垂直漸層：下→地平→天頂（真實天空，避免一塊平板）
        vec3 col = h < 0.
          ? mix(nadir, horizon, smoothstep(-.35, 0., h))
          : mix(horizon, zenith, pow(smoothstep(0., .85, h), .85));
        // 地平線附近略加一層亮帶，減少「虛空切邊」
        col = mix(col, horizon * 1.05, exp(-abs(h) * 8.) * .35);
        // 太陽光暈
        float s = max(dot(v, normalize(sunDir)), 0.);
        col += vec3(1.0, .92, .78) * (pow(s, 12.) * .35 + pow(s, 180.) * 1.1) * sunStr;
        // 柔和積雲：只在中高空，低頻＋漂浮
        float band = smoothstep(.02, .22, h) * smoothstep(.72, .28, h);
        if (cloudAmt > .01 && band > .01) {
          vec2 uv = v.xz / max(h + .35, .08);
          uv += vec2(time * .018, time * .01);
          float n = fbm(uv * 2.4 + 3.1);
          float c = smoothstep(.42, .72, n) * cloudAmt * band;
          // 雲底略灰、頂略亮，避免平坦剪紙感
          vec3 cloud = mix(vec3(.86, .90, .94), vec3(1., .99, .97), smoothstep(.5, .85, n));
          col = mix(col, cloud, c * .88);
        }
        // 高空微弱色散，增加空氣感
        col += vec3(.02, .04, .07) * max(h, 0.) * .25;
        gl_FragColor = vec4(col, 1.);
      }
    `,
  });
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(radius, lo ? 20 : 32, lo ? 12 : 20),
    mat,
  );
  mesh.renderOrder = -2;
  mesh.frustumCulled = false;
  mesh.name = 'skyDome';

  const _dir = new THREE.Vector3();
  return {
    mesh,
    setColors(zenith, horizon, nadir) {
      u.zenith.value.setHex(zenith);
      u.horizon.value.setHex(horizon);
      u.nadir.value.setHex(nadir ?? horizon);
    },
    setSun(dir, strength = 0.85) {
      _dir.copy(dir).normalize();
      u.sunDir.value.copy(_dir);
      u.sunStr.value = Math.max(0, Math.min(1.2, strength));
    },
    setClouds(amount) {
      u.cloudAmt.value = Math.max(0, Math.min(1, amount));
    },
    tick(cam, tSec) {
      mesh.position.copy(cam.position);
      u.time.value = tSec;
    },
  };
}
