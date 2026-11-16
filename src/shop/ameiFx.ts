/** 阿妹隱藏反應：延遲後觸發與阿康相同的玩家雨傘（程式內部使用） */
export const AMEI_ID = 'pt_amei';
/** 被砸後再撐傘的延遲（秒） */
export const AMEI_UMB_DELAY = 0.38;

export function isAmeiId(id: string | null | undefined): boolean {
  return id === AMEI_ID;
}
