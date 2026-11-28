/**
 * 後製（EffectComposer）政策：Bloom／SSAO／DOF／SMAA 會對全螢幕做多次 RenderTarget 讀寫，
 * 是手機發熱常見原因（見 mobile.txt §5）。
 *
 * 本專案主迴圈只用一次 `renderer.render`；若日後掛上 composer，必須先過這關。
 * 行動裝置與省電模式永遠關閉。
 */

export type PostFxOpts = {
  /** pointer: coarse（觸控手機／平板） */
  coarse?: boolean;
  /** 設定裡的省電模式 */
  eco?: boolean;
  /**
   * 僅開發／錄影可強制開；正式玩法勿傳 true。
   * 就算 force，coarse／eco 仍拒絕（避免實機誤開爆熱）。
   */
  force?: boolean;
};

/** 是否允許掛 EffectComposer／Bloom／SSAO／DOF 等全螢幕後製 */
export function postFxAllowed(opts: PostFxOpts = {}): boolean {
  if (opts.coarse || opts.eco) return false;
  // 全平台預設關：沒有後製管線；日後 PC 要開再加 mix 開關並在此回傳
  if (!opts.force) return false;
  return true;
}

/** 建立 composer 前呼叫；不允許時丟錯，避免誤接進 animate */
export function assertPostFxAllowed(opts: PostFxOpts, what = 'EffectComposer'): void {
  if (postFxAllowed(opts)) return;
  throw new Error(`${what} 在手機／省電／預設品質下停用（多次全螢幕渲染易發熱）`);
}
