/** 存檔寫入門面（從 main.ts 拆出，行為不變） */
export type PersistDeps = {
  write: () => void;
  cloudTouch: () => void;
  achCheck: () => void;
};

let D: PersistDeps;
let achT = 0;

export function initPersist(deps: PersistDeps) {
  D = deps;
}

export function persist() {
  D.write();
  D.cloudTouch();
  if ((window as any).__achOk && !achT) achT = window.setTimeout(() => { achT = 0; D.achCheck(); }, 250);
}
