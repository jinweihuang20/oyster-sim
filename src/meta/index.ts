export * as Social from './social';
export { initAnnounce, featAnnounce, featDots } from './announce';
export { initFeedback, openFb, fbShow } from './feedback';
export {
  initAchievements, achS, AS, ACHS, achTitle, achAdd, achBump, achShiftGot, clearAchShiftGot,
  achCheck, achDot, achOpen, achShift, type AchSave,
} from './achievements';
export type { EvCfg, EvOdd } from './eventsTypes';
export {
  initEvents, setEvShown, evMeat, evHud, evFinish, evLeft, evRender, evFetch, evFetchFrom,
  evStart, evAgain, evLbOpen, evCfg, evSkew, evShown,
} from './events';
export {
  initSurvey, setSvPrompted, svFetch, svAlert, svRender, svOpen, svList, svPrompted,
} from './survey';
export {
  initTutorial, tut, TUT, tutMeat, tutGo, tutStart, tutEnd, tutPrep, isTut, getTut,
} from './tutorial';

export { initPersist, persist } from './persist';
export {
  initDaily, renderDaily, openDaily, claimDaily, checkReturn, stampRow, type DailyDeps,
} from './daily';
