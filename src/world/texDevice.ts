/** 貼圖預算用的裝置旗標（避免 world 模組直接依賴 main 的 COARSE） */
export function matchMediaCoarse(): boolean {
  try { return matchMedia('(pointer: coarse)').matches; } catch { return false; }
}
