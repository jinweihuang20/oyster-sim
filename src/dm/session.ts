// 死鬥模式 session：場景組裝＋對局邏輯（武器／場地／破壞物見同目錄模組）
import * as THREE from 'three';
import { WALK, SPRINT, HALF, EYE, R, PILES, PICK_R, SPAWNS, MAX_HP, makeCoverBoxes } from './constants';
import type { Part, Fighter, Shell, DmUmb } from './types';
import { WEAPON_DEFS, makeWeapon, buildWeaponView, armBurst, cooldownAfterShot, isWeaponId, partDamage, type Weapon, type WeaponId } from './weapons';
import { ico, I } from './icons';
import { loadDS, DM_DEV, type DS } from './settings';
import { makeMeshHelpers } from './mesh';
import { createBreakables, type CrackSfx } from './breakables';
import { buildArena } from './arena';
import { shopCss, shopOverlayHtml, renderShopList } from './shop';
import { openWeaponPreview, closeWeaponPreview, weaponPreviewCss } from './weaponPreview';
import { makePlayerAvatar, poseAimArms, poseUmbArms } from './character';
import { spawnOddLoot, stepOddLoot, tryPickOddLoot, type OddLoot } from './loot';
import {
  resolveMatchConfig, isHostile, teamIdForSeat, DM_MODE_LABEL,
  hordeBotCount, hordeAggression, ffaReward, hordeReward, type DmMatchConfig,
} from './match';
import {
  createPileRuntimes, findPickPile, markPileUsed, sealPileIfNeeded, stepPileCools,
  pileCanPick, nearestPileIndex, PILE_COOL_SEC,
} from './piles';

let active = false;
export const isDeathmatchActive = () => active;
export type { DmUmb };

export function openDeathmatch(U: DmUmb, onExit: () => void, cfg?: Partial<DmMatchConfig>) {
  if (active) return; active = true;
  const match = resolveMatchConfig(cfg);
  const isHorde = match.mode === 'horde';
  let roundLeft = match.durationSec;
  let roundOver = false;
  let payout = 0;
  let wave = 1, wavesCleared = 0, waveBreakT = 0;
  let agr = hordeAggression(1);
  let msgT = 0; // 須在首波 msg() 之前初始化，避免 TDZ 黑屏
  /** 進場凍結總長＝3 秒數字＋短暫「開始！」；>0 時不能動／開火／計時 */
  const INTRO_GO = 0.42;
  let introT = 3 + INTRO_GO;
  let introShown = 0;
  let matchClock = 0;
  let matchReported = false;
  try { U.reportMatchStart?.(match.mode); } catch { /* 後端掛掉安靜失敗 */ }
  const isTouch = matchMedia('(pointer: coarse)').matches;
  const root = document.createElement('div'); root.id = 'dmRoot';
  root.innerHTML = `<style>
#dmRoot{position:fixed;inset:0;z-index:9000;background:#000;touch-action:none;user-select:none;-webkit-user-select:none;font-family:inherit}
#dmRoot canvas{position:absolute;inset:0;width:100%;height:100%}
#dmRoot .dmb{position:absolute;background:#c8102e;color:#fff6d8;border:3px solid #ffd23f;border-radius:10px;font-weight:900;font-size:18px;padding:10px 16px;box-shadow:0 3px 0 #6b0010;letter-spacing:2px}
#dmX{top:calc(env(safe-area-inset-top) + 10px);right:calc(env(safe-area-inset-right) + 10px);width:48px;height:48px;padding:0!important;font-size:24px!important}
#dmHpF{position:absolute;left:0;top:0;bottom:0;width:100%;background:#3c3;transition:width .15s}
#dmHpN{position:absolute;inset:0;text-align:center;color:#fff6d8;font-weight:900;font-size:16px;line-height:20px;text-shadow:0 2px 0 #000;letter-spacing:1px}
#dmHp.hit{animation:dmHit .3s}@keyframes dmHit{0%{border-color:#fff}100%{border-color:#ffd23f}}
#dmEdge{position:absolute;inset:0;pointer-events:none;box-shadow:inset 0 0 90px 20px rgba(220,0,0,.75);opacity:0;transition:opacity .35s}
#dmEdge.on{opacity:1;transition:none}
#dmFeed div{background:rgba(42,18,6,.8);border:2px solid #ffd23f;border-radius:6px;color:#fff6d8;font-weight:900;padding:2px 8px;font-size:15px;transition:opacity .4s}
#dmFeed .me{color:#ffd23f}
#dmHud.empty{border-color:#ff3b3b;color:#ff3b3b}
#dmUmb.cd{opacity:.45}
.dmPop svg{filter:drop-shadow(0 2px 0 #000)}
#dmRoot.dead canvas{filter:saturate(.3) brightness(.75)}
#dmRoot.dead #dmEdge{opacity:.8}
#dmCross{position:absolute;left:50%;top:50%;width:22px;height:22px;margin:-11px 0 0 -11px;pointer-events:none}
#dmCross:before,#dmCross:after{content:'';position:absolute;background:#fff;box-shadow:0 0 2px #000}
#dmCross:before{left:10px;top:0;width:2px;height:22px}#dmCross:after{top:10px;left:0;height:2px;width:22px}
#dmMark{position:absolute;left:50%;top:50%;width:34px;height:34px;margin:-17px 0 0 -17px;pointer-events:none;opacity:0;border:3px solid #ff3b3b;transform:rotate(45deg);transition:opacity .25s}
#dmMsg{position:absolute;left:50%;top:30%;transform:translateX(-50%);color:#fff6d8;font-weight:900;font-size:28px;text-shadow:0 3px 0 #000;pointer-events:none;text-align:center}
#dmCount{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none;z-index:8;background:rgba(0,0,0,.38)}
#dmCount.hide{display:none}
#dmCount span{font-size:clamp(110px,32vw,240px);font-weight:900;color:#fff;line-height:1;text-shadow:0 6px 0 rgba(0,0,0,.45),0 0 48px rgba(0,0,0,.35);animation:dmCountPop .28s ease-out}
#dmCount.go span{font-size:clamp(64px,18vw,140px);letter-spacing:.12em}
@keyframes dmCountPop{from{transform:scale(1.55);opacity:.25}to{transform:scale(1);opacity:1}}
#dmHs{position:absolute;left:50%;top:calc(env(safe-area-inset-top) + 56px);transform:translate(-50%,-8px);color:#ffd23f;font-weight:900;font-size:clamp(22px,4.5vw,36px);letter-spacing:.08em;text-shadow:0 2px 0 #000,0 0 18px rgba(255,60,40,.55);pointer-events:none;opacity:0;transition:opacity .15s,transform .15s;z-index:4;white-space:nowrap}
#dmHs.on{opacity:1;transform:translate(-50%,0)}
.dmPop{position:absolute;color:#ffd23f;font-weight:900;font-size:22px;text-shadow:0 2px 0 #000;pointer-events:none;transform:translate(-50%,-50%);transition:transform .8s,opacity .8s}
#dmBoard{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);background:#2a1206;border:4px solid #ffd23f;border-radius:12px;color:#fff6d8;padding:14px 18px;display:none;min-width:300px;max-width:92vw;z-index:12;pointer-events:auto}
#dmBoard.show{display:block}#dmBoard h2{margin:0 0 8px;color:#ffd23f;text-align:center;letter-spacing:4px}
#dmBoard table{border-collapse:collapse;width:100%;font-size:16px}#dmBoard td,#dmBoard th{padding:4px 8px;text-align:center;border-bottom:1px solid #6b3a12}
#dmBoard tr.me td{color:#ffd23f;font-weight:900}
#dmBoardAct{display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin-top:12px}
#dmBoardAct .dmb{position:static;min-height:48px;min-width:120px;font-size:16px}
#dmRoot{--bs:1;--bo:.85}
#dmSet{position:absolute;inset:0;background:rgba(10,5,0,.6);display:none;align-items:center;justify-content:center;z-index:5}
#dmSet.show{display:flex}
#dmSetBox{position:relative;background:#2a1206;border:4px solid #ffd23f;border-radius:12px;color:#fff6d8;padding:0 16px 14px;width:min(92vw,360px);max-height:calc(100dvh - env(safe-area-inset-top) - env(safe-area-inset-bottom) - 24px);overflow:auto;touch-action:pan-y}
#dmSetHd{position:sticky;top:0;background:#2a1206;display:flex;justify-content:space-between;align-items:center;padding:10px 0;color:#ffd23f;z-index:1}
#dmSetX{position:static!important;width:44px;height:44px;padding:0!important}
#dmSetBox label{display:flex;justify-content:space-between;align-items:center;gap:10px;margin:10px 0;font-weight:900}
#dmSetBox input[type=range]{flex:1;max-width:180px}
#dmSetBox input[type=checkbox]{width:26px;height:26px}
#dmPause{position:absolute;inset:0;display:none;align-items:center;justify-content:center;color:#ffd23f;background:rgba(0,0,0,.35);pointer-events:none}
#dmPause.show{display:flex}
#dmFJ.show{display:block}#dmFJ.sprint{border-color:#ff7a3b}
#dmUmb.held{background:#ffd23f;color:#2a1206}
#dmHelp{position:absolute;left:50%;bottom:calc(env(safe-area-inset-bottom) + 12px);transform:translateX(-50%);color:#fff6d8;font-size:14px;text-shadow:0 1px 0 #000;pointer-events:none;text-align:center;line-height:1.45;max-width:min(92vw,720px);white-space:normal}

/* ---- HUD 版面（橫向為主，直向備援） ---- */
#dmX,#dmScoreBtn,#dmSetBtn,#dmShopBtn{top:calc(env(safe-area-inset-top) + 8px);width:44px;height:44px;padding:0!important;display:flex;align-items:center;justify-content:center}
#dmX{right:calc(env(safe-area-inset-right) + 8px)}#dmScoreBtn{right:calc(env(safe-area-inset-right) + 60px)}#dmSetBtn{right:calc(env(safe-area-inset-right) + 164px)}
${shopCss()}
#dmRoot #dmMap{position:absolute;left:auto;bottom:auto;top:calc(env(safe-area-inset-top) + 60px);right:calc(env(safe-area-inset-right) + 8px);width:96px;height:96px;border:2px solid #ffd23f;border-radius:8px;background:rgba(20,10,0,.55);pointer-events:none}
#dmHud{position:absolute;left:calc(env(safe-area-inset-left) + 8px);top:calc(env(safe-area-inset-top) + 8px);color:#ffd23f;font-weight:900;font-size:17px;text-shadow:0 2px 0 #000;background:rgba(20,10,0,.55);border:2px solid #ffd23f;border-radius:8px;padding:4px 10px;pointer-events:none;white-space:nowrap}
#dmHud svg,#dmAmmo svg{vertical-align:-3px}
#dmFeed{position:absolute;left:calc(env(safe-area-inset-left) + 8px);top:calc(env(safe-area-inset-top) + 50px);display:flex;flex-direction:column;gap:3px;align-items:flex-start;pointer-events:none;max-width:30vw;max-height:26vh;overflow:hidden}
#dmFeed div{font-size:13px!important;padding:1px 6px!important;white-space:nowrap}
#dmBar{position:absolute;left:50%;transform:translateX(-50%);bottom:calc(env(safe-area-inset-bottom) + 14px);display:flex;gap:8px;align-items:center;pointer-events:none}
#dmHp{position:relative;width:min(24vw,200px);height:24px;background:#2a1206;border:3px solid #ffd23f;border-radius:8px;overflow:hidden}
#dmAmmo{color:#ffd23f;font-weight:900;font-size:17px;text-shadow:0 2px 0 #000;background:rgba(20,10,0,.6);border:2px solid #ffd23f;border-radius:8px;padding:2px 8px;white-space:nowrap}
#dmAmmo.empty{border-color:#ff3b3b;color:#ff3b3b}
#dmRoot .ctl{opacity:var(--bo);border-radius:50%!important;padding:0!important;display:flex;align-items:center;justify-content:center}
#dmThrow{right:calc(env(safe-area-inset-right) + 22px);bottom:calc(env(safe-area-inset-bottom) + 22px);width:calc(92px*var(--bs));height:calc(92px*var(--bs))}
#dmUmb{right:calc(env(safe-area-inset-right) + 22px + 104px*var(--bs));bottom:calc(env(safe-area-inset-bottom) + 26px);width:calc(60px*var(--bs));height:calc(60px*var(--bs))}
#dmScope{right:calc(env(safe-area-inset-right) + 22px + 104px*var(--bs));bottom:calc(env(safe-area-inset-bottom) + 22px + 96px*var(--bs));width:calc(60px*var(--bs));height:calc(60px*var(--bs));display:none}
#dmScope.showBtn{display:flex}
#dmScope.held{background:rgba(235,235,235,.85)!important;color:#1a1a1a!important}
#dmPick{right:calc(env(safe-area-inset-right) + 22px + 184px*var(--bs));bottom:calc(env(safe-area-inset-bottom) + 22px + 96px*var(--bs));width:calc(60px*var(--bs));height:calc(60px*var(--bs))}
#dmFireL{left:calc(env(safe-area-inset-left) + 30px + 124px*var(--bs));bottom:calc(env(safe-area-inset-bottom) + 22px + 110px*var(--bs));width:calc(64px*var(--bs));height:calc(64px*var(--bs))}
#dmScopeFx{position:absolute;inset:0;pointer-events:none;opacity:0;transition:opacity .12s;z-index:3;background:radial-gradient(circle at 50% 48%,transparent 0 16vh,rgba(0,0,0,.92) 28vh,rgba(0,0,0,.97) 100%)}
#dmScopeFx.on{opacity:1}
#dmScopeFx:before,#dmScopeFx:after{content:'';position:absolute;background:rgba(235,235,235,.55);left:50%;top:48%;transform:translate(-50%,-50%)}
#dmScopeFx:before{width:2px;height:22px}#dmScopeFx:after{width:22px;height:2px}
#dmRoot.ads #dmCross,#dmCross.hideHip{opacity:0}
#dmJoyHint{position:absolute;left:calc(env(safe-area-inset-left) + 30px);bottom:calc(env(safe-area-inset-bottom) + 22px);width:calc(120px*var(--bs));height:calc(120px*var(--bs));border-radius:50%;border:3px solid rgba(255,210,63,.55);background:radial-gradient(circle,rgba(255,210,63,.55) 0 22%,rgba(0,0,0,.25) 23%);pointer-events:none;opacity:var(--bo)}
#dmFJ{position:absolute;width:130px;height:130px;margin:-65px 0 0 -65px;border-radius:50%;border:3px solid rgba(255,210,63,.7);background:rgba(0,0,0,.25);display:none;pointer-events:none;opacity:var(--bo)}
#dmFK{position:absolute;left:40px;top:40px;width:50px;height:50px;border-radius:50%;background:rgba(255,210,63,.85)}
#dmRot{position:absolute;inset:0;display:none;flex-direction:column;align-items:center;justify-content:center;gap:14px;background:rgba(20,10,0,.82);color:#ffd23f;z-index:6}
#dmRotOk{position:static!important}#dmRot>svg{animation:dmTurn 1.6s ease-in-out infinite}@keyframes dmTurn{0%,30%{transform:rotate(0)}60%,100%{transform:rotate(-90deg)}}
@media (orientation:landscape) and (max-width:720px){#dmBar{left:45%}#dmHp{width:18vw}#dmAmmo{font-size:15px;padding:2px 6px}}
@media (orientation:portrait){
 #dmFireL{left:calc(env(safe-area-inset-left) + 30px + 28px*var(--bs));bottom:calc(env(safe-area-inset-bottom) + 22px + 136px*var(--bs))}
 #dmUmb{right:calc(env(safe-area-inset-right) + 22px + 16px*var(--bs));bottom:calc(env(safe-area-inset-bottom) + 22px + 104px*var(--bs))}
 #dmScope{right:calc(env(safe-area-inset-right) + 22px + 16px*var(--bs));bottom:calc(env(safe-area-inset-bottom) + 22px + 176px*var(--bs))}
 #dmPick{right:calc(env(safe-area-inset-right) + 22px + 96px*var(--bs));bottom:calc(env(safe-area-inset-bottom) + 22px + 150px*var(--bs))}
 #dmRoot.touch:not(.rotOk) #dmRot{display:flex}
 #dmBar{bottom:calc(env(safe-area-inset-bottom) + 34px + 220px*var(--bs));flex-direction:row}
 #dmHp{width:min(52vw,220px)}
 #dmFeed{top:calc(env(safe-area-inset-top) + 50px);max-width:55vw}
}

/* ---- 內斂風格（覆蓋舊招牌配色） ---- */
#dmRoot{--bg:rgba(20,20,20,.42);--ln:rgba(235,235,235,.55);--tx:#f2f2f2;--red:#c0605a}
#dmRoot .dmb{background:var(--bg)!important;color:var(--tx)!important;border:1px solid var(--ln)!important;box-shadow:none!important;border-radius:12px;font-weight:600;-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px)}
#dmRoot .dmb svg{stroke-width:1.6}
#dmRoot .ctl{border-radius:50%!important}
#dmUmb.held{background:rgba(235,235,235,.85)!important;color:#1a1a1a!important}
#dmTL{position:absolute;left:calc(env(safe-area-inset-left) + 8px);top:calc(env(safe-area-inset-top) + 8px);display:flex;gap:6px;pointer-events:none}
#dmRoot #dmHud,#dmRoot #dmAmmo{position:static;background:var(--bg);border:1px solid var(--ln);border-radius:10px;color:var(--tx);font-weight:600;font-size:15px;text-shadow:none;padding:4px 10px;white-space:nowrap}
#dmHud svg,#dmAmmo svg{stroke-width:1.6}
#dmRoot #dmAmmo.empty{color:var(--red);border-color:var(--red)}
#dmFeed div{background:var(--bg)!important;border:none!important;border-radius:8px!important;color:var(--tx)!important;font-weight:500!important}
#dmFeed .me{box-shadow:inset 2px 0 0 var(--tx)}#dmFeed small{opacity:.7}
#dmRoot #dmMap{background:var(--bg);border:1px solid var(--ln);border-radius:12px}
#dmRoot #dmBar{left:0!important;right:0;bottom:0!important;transform:none;display:block}
#dmRoot #dmHp{position:absolute;left:0;right:0;bottom:0;width:auto!important;height:7px;background:rgba(20,20,20,.5);border:none;border-radius:0;overflow:visible}
#dmRoot #dmHpF{transition:width .15s,background .3s}
#dmRoot #dmHpN{inset:auto;left:50%;bottom:calc(env(safe-area-inset-bottom) + 12px);transform:translateX(-50%);color:var(--tx);font-weight:600;font-size:14px;line-height:1;text-shadow:0 1px 2px rgba(0,0,0,.6);white-space:nowrap}
#dmHp.hit #dmHpF{filter:brightness(1.6)}
#dmJoyHint{border:1px solid var(--ln)!important;background:radial-gradient(circle,rgba(235,235,235,.35) 0 22%,rgba(20,20,20,.3) 23%)!important}
#dmFJ{border:1px solid var(--ln)!important;background:rgba(20,20,20,.3)!important}#dmFJ.sprint{border-color:var(--tx)!important;border-width:2px!important}
#dmFK{background:rgba(235,235,235,.55)!important}
#dmMark{border:2px solid var(--red)!important}
#dmEdge{box-shadow:inset 0 0 90px 20px rgba(150,40,40,.6)!important}
#dmMsg{color:var(--tx)!important;font-weight:600!important;text-shadow:0 1px 3px rgba(0,0,0,.6)!important}
#dmCount{background:rgba(0,0,0,.42)!important}
#dmCount span{color:#fff!important;text-shadow:0 4px 0 rgba(0,0,0,.5),0 0 40px rgba(0,0,0,.4)!important}
#dmHs{color:#fff!important;text-shadow:0 1px 2px rgba(0,0,0,.75),0 0 16px rgba(255,80,60,.45)!important}
.dmPop{color:var(--tx)!important;font-weight:600!important;text-shadow:0 1px 3px rgba(0,0,0,.6)!important}
#dmBoard,#dmSetBox{background:rgba(24,24,24,.78)!important;border:1px solid var(--ln)!important;color:var(--tx)!important;-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);border-radius:14px!important}
#dmBoard h2,#dmSetHd{color:var(--tx)!important;background:transparent!important}
#dmSetHd{background:rgba(24,24,24,.95)!important}
#dmBoard td,#dmBoard th{border-bottom:1px solid rgba(255,255,255,.12)!important;font-weight:500}
#dmBoard tr.me td{color:var(--tx)!important;font-weight:700;background:rgba(255,255,255,.08)}
#dmSetBox label{font-weight:500!important}#dmSetBox input{accent-color:#bdbdbd}
#dmSet{background:rgba(0,0,0,.45)!important}
@media (orientation:portrait){#dmTL{flex-direction:column;align-items:flex-start}#dmFeed{top:calc(env(safe-area-inset-top) + 82px)!important}#dmRoot #dmHpN{left:calc(50% + 22px);font-size:13px}}
#dmPause,#dmRot{color:var(--tx)!important}#dmRot{background:rgba(15,15,15,.82)!important}
/* 電腦版：底部血條加寬加厚；操作提示抬到血條上方，避免擋道 */
@media (pointer:fine){
 #dmRoot #dmBar{left:50%!important;right:auto;bottom:calc(env(safe-area-inset-bottom) + 18px)!important;transform:translateX(-50%);width:min(52vw,560px);display:block;z-index:2}
 #dmRoot #dmHp{position:relative;left:auto;right:auto;bottom:auto;width:100%!important;height:20px;border:1px solid var(--ln);border-radius:8px;background:rgba(20,20,20,.55);overflow:hidden}
 #dmRoot #dmHpN{inset:0;left:0;bottom:auto;transform:none;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;letter-spacing:.04em}
 #dmHelp{bottom:calc(env(safe-area-inset-bottom) + 52px);font-size:13px;opacity:.9;z-index:1;color:var(--tx)}
 #dmHelp b{font-weight:800;color:#fff}
}
</style><canvas></canvas><div id="dmCross"></div><div id="dmScopeFx"></div><div id="dmMark"></div><div id="dmHs">Headshot !</div><div id="dmMsg"></div><div id="dmCount"><span>3</span></div><div id="dmTL"><div id="dmAmmo"></div><div id="dmHud"></div></div><div id="dmEdge"></div><div id="dmBar"><div id="dmHp"><div id="dmHpF"></div><div id="dmHpN"></div></div></div><canvas id="dmMap" width="192" height="192"></canvas><div id="dmFeed"></div>
<button class="dmb" id="dmScoreBtn" aria-label="戰績"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4" style="vertical-align:-3px"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg></button>
<button class="dmb" id="dmShopBtn" aria-label="武器店">${ico(I.shop, 22)}</button>
<button class="dmb" id="dmSetBtn" aria-label="設定">${ico(I.gear, 26)}</button><div id="dmPause">${ico(I.play, 64)}</div>
${shopOverlayHtml()}
<div id="dmSet"><div id="dmSetBox"><div id="dmSetHd">${ico(I.gear, 26)}<button class="dmb" id="dmSetX" aria-label="關閉">✕</button></div>
<label>滑鼠靈敏度<input type="range" id="dsSens" min="0.3" max="3" step="0.05"></label>
<label>觸控靈敏度<input type="range" id="dsTsens" min="0.3" max="3" step="0.05"></label>
<label>上下反轉<input type="checkbox" id="dsInv"></label>
<label>瞄準輔助<input type="checkbox" id="dsAssist"></label>
<label>開鏡模式<select id="dsAdsMode" style="flex:1;max-width:180px;background:#1a1a1a;color:#f2f2f2;border:1px solid rgba(235,235,235,.4);border-radius:8px;padding:6px 8px;font:inherit">
<option value="hold">長按（按住開鏡）</option>
<option value="tap">輕觸（點一下開關）</option>
<option value="mix">混合（短按切換／長按維持）</option>
</select></label>
<label>按鈕大小<input type="range" id="dsBtn" min="0.7" max="1.3" step="0.05"></label>
<label>按鈕透明度<input type="range" id="dsOp" min="0.3" max="1" step="0.05"></label>
${DM_DEV ? `<div id="dmDevSec" style="margin-top:12px;padding-top:10px;border-top:1px solid rgba(255,255,255,.12)">
<div style="font-size:12px;opacity:.65;margin-bottom:6px">開發測試（僅本機 dev，不存檔）</div>
<label>無限血量<input type="checkbox" id="dsGodHp"></label>
<label>無限子彈<input type="checkbox" id="dsGodAmmo"></label>
</div>` : ''}
</div></div>
<button class="dmb" id="dmX" aria-label="離開">✕</button><div id="dmBoard"><h2>${ico(I.board, 26)}</h2><div id="dmTable"></div></div>
${isTouch
    ? `<div id="dmJoyHint"></div><div id="dmFJ"><div id="dmFK"></div></div><button class="dmb ctl" id="dmPick" aria-label="拿殼">${ico(I.grab, 28)}</button><button class="dmb ctl" id="dmScope" aria-label="開鏡">${ico(I.scope, 26)}</button><button class="dmb ctl" id="dmUmb" aria-label="雨傘">${ico(I.umb, 28)}</button><button class="dmb ctl" id="dmFireL" aria-label="丟">${ico(I.throw, 30)}</button><div id="dmRot">${ico(I.rotate, 72)}<button class="dmb" id="dmRotOk" aria-label="繼續">${ico(I.play, 26)}</button></div><button class="dmb ctl" id="dmThrow" aria-label="丟">${ico(I.throw, 38)}</button>`
    : `<button class="dmb ctl" id="dmScope" aria-label="開鏡" style="position:absolute;right:calc(env(safe-area-inset-right) + 18px);bottom:calc(env(safe-area-inset-bottom) + 56px);width:52px;height:52px">${ico(I.scope, 24)}</button><div id="dmHelp"><b>WASD</b> 移動　<b>Shift</b> 衝刺　<b>滑鼠</b> 轉視角<br><b>左鍵</b> 開火　<b>右鍵</b> 開鏡（狙擊等）　<b>R</b> 撐傘擋彈　<b>E</b> 撿蚵殼補彈　<b>Tab</b> 戰績<br>開鏡手感可在右上角「設定」切換（長按／輕觸）</div>`}`;
  document.body.appendChild(root);
  const q = (id: string) => root.querySelector('#' + id) as HTMLElement;
  const canvas = root.querySelector('canvas')!;
  if (isTouch) { root.classList.add('touch'); q('dmRotOk').onclick = () => root.classList.add('rotOk'); }
  // 手機／粗指標：降畫質（陰影、抗鋸齒、像素比、燈數、蚵殼密度）
  const LO = isTouch || matchMedia('(max-width: 900px)').matches;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !LO, powerPreference: LO ? 'low-power' : 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, LO ? 1.25 : 2));
  renderer.shadowMap.enabled = !LO;
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x6a5070); scene.fog = new THREE.Fog(0x8a6070, LO ? 16 : 20, LO ? 55 : 70);
  const FOV0 = 70;
  const cam = new THREE.PerspectiveCamera(FOV0, 1, 0.05, LO ? 80 : 100); cam.rotation.order = 'YXZ';

  const { M, add } = makeMeshHelpers(scene, LO);
  const covers = makeCoverBoxes();
  const crackSfx: CrackSfx = { crack: () => {} };
  const { breakables, regBreak, hitBreakable, propContains, stepBreakables, stepScrap, placeScar, stepScars } = createBreakables({ scene, LO, covers, sfx: crackSfx });
  buildArena({ scene, LO, M, add, U, regBreak });
  const piles = createPileRuntimes(scene);

  const BARN_N = LO ? 3 : 8;
  function shellMesh() {
    const m = new THREE.Mesh(U.shellGeos[Math.floor(Math.random() * U.shellGeos.length)], U.shellMat); m.scale.setScalar(1.7); m.castShadow = !LO;
    const bl: THREE.Object3D[] = []; for (let i = 0; i < BARN_N; i++) { const b = new THREE.Mesh(U.barnGeo, U.barnMat); m.add(b); bl.push(b); } U.placeBarn(bl, 2); return m;
  }
  // 蚵殼灰燼：半透明薄片（對相機 billboard），避免大方塊飄滿畫面
  const AN = LO ? 80 : 180;
  const ash = new THREE.InstancedMesh(
    new THREE.PlaneGeometry(0.05, 0.032),
    new THREE.MeshBasicMaterial({ color: 0xd8d0c4, transparent: true, opacity: 0.42, depthWrite: false, side: THREE.DoubleSide }),
    AN,
  );
  ash.frustumCulled = false; ash.renderOrder = 2; scene.add(ash);
  const ap = new Float32Array(AN * 3), av = new Float32Array(AN * 3), al = new Float32Array(AN), as0 = new Float32Array(AN), aSpin = new Float32Array(AN); let ai = 0;
  const _am = new THREE.Matrix4(), _aq = new THREE.Quaternion(), _aspin = new THREE.Quaternion(), _ae = new THREE.Euler();
  const _az = new THREE.Matrix4().makeScale(0, 0, 0), _ac = new THREE.Color(), _ap = new THREE.Vector3(), _as = new THREE.Vector3();
  for (let i = 0; i < AN; i++) ash.setMatrixAt(i, _az);
  const ashCols = [0xf0e8dc, 0xe0d6c8, 0xcfc4b4, 0xb8aea0, 0xa39888, 0xd4c8b0];
  function emitAsh(at: THREE.Vector3, dir: THREE.Vector3, n: number, spread = 1) {
    const nn = LO ? Math.min(n, 2) : Math.min(n, 6);
    const spd0 = dir.length() || 1; const dx = dir.x / spd0, dy = dir.y / spd0, dz = dir.z / spd0;
    for (let k = 0; k < nn; k++) {
      const i = ai; ai = (ai + 1) % AN;
      ap[i * 3] = at.x + (Math.random() - .5) * 0.08 * spread;
      ap[i * 3 + 1] = at.y + (Math.random() - .5) * 0.06 * spread;
      ap[i * 3 + 2] = at.z + (Math.random() - .5) * 0.08 * spread;
      const back = 0.6 + Math.random() * 1.4, side = (Math.random() - .5) * 1.2 * spread;
      av[i * 3] = -dx * back + side; av[i * 3 + 1] = -dy * back * 0.35 + 0.15 + Math.random() * 0.55; av[i * 3 + 2] = -dz * back + (Math.random() - .5) * 1.2 * spread;
      al[i] = 0.14 + Math.random() * 0.22; as0[i] = 0.35 + Math.random() * 0.55; aSpin[i] = Math.random() * 6.28;
      ash.setColorAt(i, _ac.setHex(ashCols[(Math.random() * ashCols.length) | 0]));
    }
    if (ash.instanceColor) ash.instanceColor.needsUpdate = true;
  }
  function stepAsh(dt: number) {
    let any = false;
    for (let i = 0; i < AN; i++) {
      if (al[i] <= 0) continue; any = true; al[i] -= dt;
      if (al[i] <= 0) { ash.setMatrixAt(i, _az); continue; }
      av[i * 3] *= Math.exp(-3.2 * dt); av[i * 3 + 2] *= Math.exp(-3.2 * dt); av[i * 3 + 1] -= 1.6 * dt;
      ap[i * 3] += av[i * 3] * dt; ap[i * 3 + 1] += av[i * 3 + 1] * dt; ap[i * 3 + 2] += av[i * 3 + 2] * dt;
      if (ap[i * 3 + 1] < 0.03) { ap[i * 3 + 1] = 0.03; av[i * 3 + 1] = 0; av[i * 3] *= 0.4; av[i * 3 + 2] *= 0.4; al[i] -= dt * 2.2; }
      const t = Math.max(0, al[i] / 0.28), sc = as0[i] * (0.25 + t * 0.85);
      aSpin[i] += dt * 5;
      _ae.set(0, 0, aSpin[i]); _aspin.setFromEuler(_ae);
      _aq.copy(cam.quaternion).multiply(_aspin);
      _ap.set(ap[i * 3], ap[i * 3 + 1], ap[i * 3 + 2]); _as.set(sc, sc * 0.65, 1);
      _am.compose(_ap, _aq, _as); ash.setMatrixAt(i, _am);
    }
    if (any) ash.instanceMatrix.needsUpdate = true;
  }
  // 第三人稱玩家模型（未來＝其他玩家）；本機仍用第一人稱
  function makeBot(look: { shirt: number; hair: number; pants?: number }) {
    const a = makePlayerAvatar(look, M, add, LO);
    if (!LO) a.outer.traverse(o => { (o as THREE.Mesh).castShadow = true; });
    scene.add(a.outer);
    return { outer: a.outer, rig: a };
  }
  const mk = (name: string, isPlayer: boolean, teamId: number): Fighter => ({ name, isPlayer, teamId, pos: new THREE.Vector3(), vel: new THREE.Vector3(), yaw: 0, pitch: 0, hp: MAX_HP, wpn: makeWeapon('oysterGun'), dead: false, respawnAt: 0, invulnUntil: 0, kills: 0, deaths: 0, hs: 0, shots: 0, hits: 0, mesh: null, rig: null, stepAcc: 0, hpBar: null, deathAt: 0, fallDir: new THREE.Vector3(0, 0, 1), throwA: 0, walkPh: 0, pickCd: 0, cd: 1, umbT: 0, umbHeld: false, umbTired: false, umbMesh: null, goal: new THREE.Vector3(), idleUntil: 0, pickT: 0 });
  const me = mk('你', true, teamIdForSeat(match.mode, 0));
  const BOT_NAMES = ['BOT 阿桃', 'BOT 阿春', 'BOT 阿嬌', 'BOT 阿明', 'BOT 阿雄', 'BOT 阿美', 'BOT 阿福', 'BOT 阿珍'];
  const BOT_LOOKS = [
    [0x3a6fc0, 0x2a2a2a, 0x2a3548], [0xc84a3a, 0x4a3020, 0x1a2838], [0x3a8a5a, 0x555555, 0x2a2a40], [0xc8a03a, 0x3a2818, 0x283040],
    [0x7a4ac0, 0x1a1a1a, 0x2a3040], [0xc05a8a, 0x4a3030, 0x203038], [0x3a9aaa, 0x2a3038, 0x1a2830], [0x6a7040, 0x403020, 0x2a2a38],
  ] as const;
  const botSlots = isHorde ? 8 : match.botCount;
  const fighters: Fighter[] = [me];
  for (let i = 0; i < botSlots; i++) {
    const f = mk(BOT_NAMES[i] ?? `BOT ${i + 1}`, false, teamIdForSeat(match.mode, i + 1));
    const look = BOT_LOOKS[i % BOT_LOOKS.length];
    const b = makeBot({ shirt: look[0], hair: look[1], pants: look[2] });
    f.mesh = b.outer; f.rig = b.rig;
    fighters.push(f);
  }
  const botsOnly = () => fighters.filter(f => !f.isPlayer);
  const oddLoots: OddLoot[] = [];
  const shells: Shell[] = [];
  const wpnCtx = () => ({ M, add, LO, shellGeos: U.shellGeos, shellMat: U.shellMat });
  function attachWeaponView(w: Weapon) {
    if (w.view) { cam.remove(w.view); w.view = null; }
    w.view = buildWeaponView(w.def.id, wpnCtx());
    w.view.position.set(...w.def.hip); w.view.rotation.set(...w.def.hipRot);
    cam.add(w.view);
  }
  /** 第三人稱：槍掛胸前架，方塊手已在握把／護木上 */
  function attachTpGun(f: Fighter) {
    const hold = f.rig?.weaponMount; if (!hold) return;
    // 只換槍模，保留 handL／handR
    for (const ch of [...hold.children]) {
      if (ch === f.rig!.handL || ch === f.rig!.handR) continue;
      hold.remove(ch);
    }
    const g = buildWeaponView(f.wpn.def.id, wpnCtx());
    g.scale.setScalar(1.15);
    // 握把靠近右手塊、護木靠近左手塊
    g.position.set(0, 0.02, 0.02);
    g.rotation.set(0, 0, 0);
    hold.add(g);
    // 手在槍前面，避免被槍模挡住
    hold.add(f.rig!.handR); hold.add(f.rig!.handL);
  }
  function equipWeapon(f: Fighter, id: WeaponId) {
    if (f.isPlayer) { adsNeedRelease = false; setAds(false); }
    if (f.isPlayer && f.wpn.view) { cam.remove(f.wpn.view); f.wpn.view = null; }
    f.wpn = makeWeapon(id);
    if (f.isPlayer) { attachWeaponView(f.wpn); syncScopeBtn(); }
    else attachTpGun(f);
  }
  // 對手初始各拿一把；玩家只能用雜貨店已買的槍
  const botLoadout: WeaponId[] = ['oysterAk', 'oysterM4', 'oysterSmg', 'oysterDeagle', 'oysterNova', 'oysterGun', 'oysterAk', 'oysterM4'];
  fighters.forEach((f, i) => { if (!f.isPlayer) equipWeapon(f, botLoadout[i - 1] ?? 'oysterGun'); });
  const ownedWpns = new Set<WeaponId>([
    'oysterGun',
    ...U.ownedWeapons.filter(isWeaponId),
    ...(DM_DEV ? (Object.keys(WEAPON_DEFS) as WeaponId[]).filter(id => WEAPON_DEFS[id].inShop) : []),
  ]);
  const startWpn: WeaponId = ownedWpns.has(U.equippedWeapon) ? U.equippedWeapon : 'oysterGun';
  me.wpn = makeWeapon(startWpn);
  // 雨傘：沿用上工的傘
  scene.add(cam);
  me.umbMesh = U.model; U.model.visible = false; U.model.position.set(0.12, -0.3, -0.85); U.model.rotation.set(0, 0, 0); U.model.scale.setScalar(0.62);
  cam.add(U.model);
  for (const f of fighters) if (f.mesh) { const m = U.model.clone(true); m.visible = false; m.position.set(0, 1.2, -0.6); m.rotation.set(0, 0, 0); m.scale.setScalar(0.8); f.mesh.add(m); f.umbMesh = m; }
  U.model.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh) { m.material = (m.material as THREE.Material).clone(); Object.assign(m.material, { transparent: true, opacity: 0.6, depthWrite: false }); } });
  attachWeaponView(me.wpn);
  // ---- 開鏡（狙擊等 zoom>1）：壓低 FOV、遮罩、藏槍模、降靈敏度；模式見 DSv.adsMode ----
  let ads = false, adsT = 0; // adsT 0..1 平滑
  /** 開火斷鏡後：長按模式需先鬆開再開；輕觸則下次點按即可 */
  let adsNeedRelease = false;
  let scopeDownAt = 0, mixHoldTimer = 0, mixAsHold = false;
  const canAds = () => me.wpn.def.zoom > 1 && !me.dead && !me.umbHeld && !adsNeedRelease;
  function syncScopeBtn() {
    const b = q('dmScope'); if (!b) return;
    b.classList.toggle('showBtn', me.wpn.def.zoom > 1);
    b.classList.toggle('held', ads);
    // 非開鏡準心：看槍的 hipCross；開鏡時本來就藏（CSS .ads）
    q('dmCross').classList.toggle('hideHip', !me.wpn.def.hipCross);
  }
  function setAds(on: boolean) {
    if (on) {
      if (!canAds()) return;
      ads = true;
    } else {
      ads = false;
    }
    root.classList.toggle('ads', ads);
    q('dmScopeFx').classList.toggle('on', ads);
    syncScopeBtn();
  }
  function releaseAdsLatch() { adsNeedRelease = false; }
  function clearMixTimer() { if (mixHoldTimer) { clearTimeout(mixHoldTimer); mixHoldTimer = 0; } }
  /** 開鏡按下（右鍵／開鏡鈕／觸控） */
  function scopePress() {
    if (me.wpn.def.zoom <= 1 || me.dead || me.umbHeld) return;
    const mode = DSv.adsMode;
    scopeDownAt = performance.now();
    mixAsHold = false;
    clearMixTimer();
    if (mode === 'tap') {
      adsNeedRelease = false;
      setAds(!ads);
      return;
    }
    if (mode === 'hold') {
      if (adsNeedRelease) return;
      setAds(true);
      return;
    }
    // mix：短按在鬆開時切換；按住超過閾值改成長按維持
    mixHoldTimer = window.setTimeout(() => {
      mixHoldTimer = 0;
      if (adsNeedRelease) return;
      mixAsHold = true;
      setAds(true);
    }, 180);
  }
  /** 開鏡放開 */
  function scopeRelease() {
    if (me.wpn.def.zoom <= 1) { adsNeedRelease = false; clearMixTimer(); return; }
    const mode = DSv.adsMode;
    if (mode === 'tap') {
      adsNeedRelease = false; // 開火斷鏡後，鬆開／點按週期清 latch
      return;
    }
    if (mode === 'hold') {
      adsNeedRelease = false;
      setAds(false);
      return;
    }
    // mix
    const quick = performance.now() - scopeDownAt < 180;
    clearMixTimer();
    if (mixAsHold) {
      adsNeedRelease = false;
      setAds(false);
    } else if (quick) {
      adsNeedRelease = false;
      setAds(!ads);
    } else {
      adsNeedRelease = false;
    }
    mixAsHold = false;
  }
  syncScopeBtn();
  const umbUp = (f: Fighter) => f.umbHeld && (U.umb.open + U.umb.dur - f.umbT) >= U.umb.open;
  function openUmb(f: Fighter) { if (introT > 0 || f.dead || f.umbHeld || f.umbTired) return; if (f.isPlayer) setAds(false); f.umbHeld = true; f.umbT = U.umb.open + U.umb.dur; }
  function closeUmb(f: Fighter) { f.umbTired = false; f.umbHeld = false; f.umbT = 0; }
  let now = 0;
  function spawn(f: Fighter) {
    const opts = SPAWNS.map(([x, z]) => new THREE.Vector3(x, 0, z)).sort((a, b) => minDist(b, f) - minDist(a, f));
    f.pos.copy(opts[Math.floor(Math.random() * 3)]); f.vel.set(0, 0, 0); f.hp = MAX_HP; f.wpn.ammo = f.wpn.def.maxAmmo; f.wpn.kick = 0; f.dead = false;
    f.invulnUntil = now + 3; f.idleUntil = now + 1; f.umbHeld = false; f.umbTired = false; f.umbT = 0; f.yaw = Math.atan2(-f.pos.x, -f.pos.z) + Math.PI; f.pitch = 0; f.goal.copy(nearOpenPile(f.pos)); f.pickT = 0;
    if (f.mesh) f.mesh.visible = true;
    if (f.isPlayer) setAds(false);
  }
  function nearOpenPile(p: THREE.Vector3) {
    const open = piles.filter(pileCanPick);
    const list = open.length ? open : piles;
    return list.reduce((a, b) => (Math.hypot(b.pos.x - p.x, b.pos.z - p.z) < Math.hypot(a.pos.x - p.x, a.pos.z - p.z) ? b : a)).pos;
  }
  const pileDist = (p: THREE.Vector3) => {
    const i = nearestPileIndex(p, piles);
    return Math.hypot(piles[i].pos.x - p.x, piles[i].pos.z - p.z);
  };
  const minDist = (p: THREE.Vector3, self: Fighter) => Math.min(...fighters.filter(o => isHostile(self, o) && !o.dead).map(o => o.pos.distanceTo(p)), 99);
  function parkBot(f: Fighter) {
    f.dead = true; f.respawnAt = 1e12; f.vel.set(0, 0, 0); f.hp = 0;
    if (f.mesh) f.mesh.visible = false;
    if (f.hpBar) f.hpBar.g.visible = false;
  }
  function startHordeWave(w: number) {
    wave = w; agr = hordeAggression(w);
    const n = hordeBotCount(w);
    const bots = botsOnly();
    bots.forEach((b, i) => {
      if (i < n) spawn(b);
      else parkBot(b);
    });
    msg(`第 ${w} 關 · ${n} 人來亂`, 2.5);
  }
  if (isHorde) {
    spawn(me);
    botsOnly().forEach(parkBot);
    // 首波等倒數結束再放
  } else {
    fighters.forEach(spawn);
  }
  const frozen = () => introT > 0 || roundOver;

  // ---- 音效：程序合成，接到遊戲的音效音量（跟著主音量／靜音設定） ----
  let voices = 0; const MAXV = 14; let nbuf: AudioBuffer | null = null;
  function ctx() { try { const a = U.audio(); if (!nbuf) { nbuf = a.createBuffer(1, a.sampleRate, a.sampleRate); const d = nbuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; } return a; } catch { return null; } }
  function outPan(a: AudioContext, g: GainNode, pan: number) { if (pan && a.createStereoPanner) { const p = a.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan)); g.connect(p).connect(U.sfxOut()); } else g.connect(U.sfxOut()); }
  function nz(dur: number, freq: number, vol: number, pan = 0, sweepTo = 0, delay = 0, qv = 0.8) {
    const a = ctx(); if (!a || voices >= MAXV || vol < 0.004) return; voices++;
    const t = a.currentTime + delay, s = a.createBufferSource(); s.buffer = nbuf; const f = a.createBiquadFilter(); f.type = 'bandpass'; f.frequency.setValueAtTime(freq, t); f.Q.value = qv;
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
    const g = a.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur); s.connect(f).connect(g); outPan(a, g, pan);
    s.start(t, Math.random() * 0.5, dur + 0.02); setTimeout(() => voices--, (delay + dur) * 1000 + 60);
  }
  function tn(freq: number, dur: number, vol: number, type: OscillatorType = 'sine', pan = 0, delay = 0, glideTo = 0) {
    const a = ctx(); if (!a || voices >= MAXV || vol < 0.004) return; voices++;
    const t = a.currentTime + delay, o = a.createOscillator(), g = a.createGain(); o.type = type; o.frequency.setValueAtTime(freq, t); if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, t + dur);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.006); g.gain.exponentialRampToValueAtTime(0.001, t + dur); o.connect(g); outPan(a, g, pan);
    o.start(t); o.stop(t + dur + 0.03); setTimeout(() => voices--, (delay + dur) * 1000 + 60);
  }
  const _r = new THREE.Vector3(), _d = new THREE.Vector3();
  // 位置音：距離衰減＋左右聲道
  function spatial(p: THREE.Vector3) { _d.copy(p).sub(cam.position); const dist = _d.length(); _r.set(1, 0, 0).applyQuaternion(cam.quaternion); return { v: 1 / (1 + dist * 0.22), pan: dist > 0.1 ? _d.normalize().dot(_r) * 0.85 : 0 }; }
  const SND = {
    throw(f: Fighter) { const sp = f.isPlayer ? { v: 1, pan: 0 } : spatial(f.pos), k = f.isPlayer ? 1 : 0.5;
      nz(0.2, 2200, 0.35 * sp.v * k, sp.pan, 500); tn(260, 0.07, 0.12 * sp.v * k, 'square', sp.pan, 0, 110); },
    pick() { tn(1900, 0.03, 0.05, 'square'); nz(0.03, 3500, 0.06); },
    reload() { nz(0.035, 3200, 0.3, 0, 0, 0, 3); tn(900, 0.03, 0.08, 'square'); nz(0.06, 1300, 0.35, 0, 600, 0.13, 2); tn(170, 0.07, 0.18, 'square', 0, 0.13, 90); nz(0.03, 4200, 0.18, 0, 0, 0.2, 4); },
    hit(at: THREE.Vector3, head: boolean, mine: boolean) { const sp = mine ? { v: 1, pan: 0 } : spatial(at);
      nz(0.09, 380, 0.5 * sp.v, sp.pan); tn(140, 0.1, 0.25 * sp.v, 'sine', sp.pan, 0, 70);
      if (head) { tn(1500, 0.14, 0.22 * sp.v, 'triangle', sp.pan, 0.01); tn(2250, 0.2, 0.16 * sp.v, 'triangle', sp.pan, 0.05); nz(0.07, 2600, 0.3 * sp.v, sp.pan, 900); } },
    hurt() { nz(0.12, 300, 0.5); tn(110, 0.15, 0.3, 'sawtooth', 0, 0, 60); },
    block(at: THREE.Vector3) { const sp = spatial(at); nz(0.12, 240, 0.55 * sp.v, sp.pan); tn(85, 0.14, 0.3 * sp.v, 'sine', sp.pan); },
    crack(at: THREE.Vector3, heavy = false) { const sp = spatial(at); nz(0.1, heavy ? 420 : 900, (heavy ? 0.55 : 0.4) * sp.v, sp.pan); tn(heavy ? 90 : 220, 0.1, 0.2 * sp.v, 'square', sp.pan, 0, heavy ? 50 : 120); nz(0.06, 2200, 0.25 * sp.v, sp.pan, 400); },
    step(f: Fighter) { const sp = f.isPlayer ? { v: 1, pan: 0 } : spatial(f.pos), k = f.isPlayer ? 0.14 : 0.3;
      nz(0.07, 650 + Math.random() * 300, k * sp.v, sp.pan, 300); nz(0.05, 3500, k * 0.25 * sp.v, sp.pan, 0, 0.01); }, // 濕水泥地
  };
  crackSfx.crack = (at, heavy) => SND.crack(at, heavy);
  // ---- 槍口火花 ----
  // FP：掛在槍模 muzzle 上（鏡頭空間），才看得到；TP：世界空間實例池
  const flashMat = (c: number, o: number) => new THREE.MeshBasicMaterial({
    color: c, transparent: true, opacity: o, depthWrite: false, depthTest: false,
    blending: THREE.AdditiveBlending, toneMapped: false,
  });
  const fpFlash = new THREE.Group();
  fpFlash.visible = false;
  {
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), flashMat(0xfff4c8, 1));
    const jet = new THREE.Mesh(new THREE.ConeGeometry(0.028, 0.11, 6), flashMat(0xff9020, 0.95));
    jet.rotation.x = -Math.PI / 2; // 槍管朝 -Z
    jet.position.z = -0.05;
    const wing = new THREE.Mesh(new THREE.ConeGeometry(0.016, 0.07, 4), flashMat(0xffd080, 0.8));
    wing.rotation.set(-Math.PI / 2, 0, 0.9); wing.position.set(0.02, 0, -0.03);
    const wing2 = wing.clone(); wing2.rotation.z = -0.9; wing2.position.x = -0.02;
    fpFlash.add(core, jet, wing, wing2);
  }
  let fpFlashT = 0, fpFlashDur = 0.09;
  function emitFpMuzzleFlash() {
    const mz = me.wpn.view?.userData.muzzle as THREE.Object3D | undefined;
    if (!mz || !me.wpn.view?.visible) return;
    if (fpFlash.parent !== mz) mz.add(fpFlash);
    fpFlash.visible = true;
    fpFlash.rotation.z = Math.random() * Math.PI;
    fpFlashDur = 0.07 + Math.random() * 0.04;
    fpFlashT = fpFlashDur;
    fpFlash.scale.setScalar(0.85 + Math.random() * 0.45);
  }
  function stepFpFlash(dt: number) {
    if (fpFlashT <= 0) { if (fpFlash.visible) fpFlash.visible = false; return; }
    fpFlashT -= dt;
    const k = Math.max(0, fpFlashT / fpFlashDur);
    fpFlash.scale.setScalar(0.35 + k * 1.0);
    (fpFlash.children[0] as THREE.Mesh).scale.setScalar(0.6 + k * 0.8);
    if (fpFlashT <= 0) fpFlash.visible = false;
  }

  const FN = LO ? 10 : 16;
  const flashCore = new THREE.InstancedMesh(new THREE.SphereGeometry(0.04, 6, 5), flashMat(0xfff1c2, 0.9), FN);
  const flashJet = new THREE.InstancedMesh(new THREE.ConeGeometry(0.028, 0.12, 5), flashMat(0xff8a28, 0.85), FN);
  for (const m of [flashCore, flashJet]) { m.frustumCulled = false; m.renderOrder = 4; scene.add(m); }
  const fl = new Float32Array(FN), fMax = new Float32Array(FN), fSc = new Float32Array(FN);
  const fPx = new Float32Array(FN), fPy = new Float32Array(FN), fPz = new Float32Array(FN);
  const fAx = new Float32Array(FN), fAy = new Float32Array(FN), fAz = new Float32Array(FN);
  let fi = 0;
  const _fp = new THREE.Vector3(), _fq2 = new THREE.Quaternion(), _fs = new THREE.Vector3(), _fm = new THREE.Matrix4();
  const _fz = new THREE.Matrix4().makeScale(0, 0, 0), _fwd = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i < FN; i++) { flashCore.setMatrixAt(i, _fz); flashJet.setMatrixAt(i, _fz); }
  const _muzzleW = new THREE.Vector3(), _aimN = new THREE.Vector3();

  function emitTpMuzzleFlash(f: Fighter, aim: THREE.Vector3) {
    _aimN.copy(aim); if (_aimN.lengthSq() < 1e-6) _aimN.set(0, 0, -1); else _aimN.normalize();
    let mz: THREE.Object3D | undefined;
    if (f.rig) for (const ch of f.rig.weaponMount.children) if (ch.userData.muzzle) { mz = ch.userData.muzzle as THREE.Object3D; break; }
    if (mz) mz.getWorldPosition(_muzzleW);
    else _muzzleW.copy(eyeOf(f)).addScaledVector(_aimN, 0.45);
    const i = fi; fi = (fi + 1) % FN;
    fl[i] = fMax[i] = 0.05 + Math.random() * 0.02;
    fSc[i] = 0.7 + Math.random() * 0.35;
    fPx[i] = _muzzleW.x; fPy[i] = _muzzleW.y; fPz[i] = _muzzleW.z;
    fAx[i] = _aimN.x; fAy[i] = _aimN.y; fAz[i] = _aimN.z;
    writeTpFlash(i, 1);
    flashCore.instanceMatrix.needsUpdate = true; flashJet.instanceMatrix.needsUpdate = true;
    emitAsh(_muzzleW, aim, LO ? 1 : 2, 0.3);
  }
  function writeTpFlash(i: number, fade: number) {
    const sc = fSc[i] * fade;
    _muzzleW.set(fPx[i], fPy[i], fPz[i]); _aimN.set(fAx[i], fAy[i], fAz[i]);
    _fs.set(sc, sc, sc); _fm.compose(_muzzleW, cam.quaternion, _fs); flashCore.setMatrixAt(i, _fm);
    _fq2.setFromUnitVectors(_fwd, _aimN);
    _fp.copy(_muzzleW).addScaledVector(_aimN, 0.05 * sc);
    _fs.set(sc * 0.85, sc * 1.3, sc * 0.85); _fm.compose(_fp, _fq2, _fs); flashJet.setMatrixAt(i, _fm);
  }
  function stepTpFlash(dt: number) {
    let any = false;
    for (let i = 0; i < FN; i++) {
      if (fl[i] <= 0) continue; any = true; fl[i] -= dt;
      if (fl[i] <= 0) { fl[i] = 0; flashCore.setMatrixAt(i, _fz); flashJet.setMatrixAt(i, _fz); continue; }
      writeTpFlash(i, Math.min(1, fl[i] / Math.max(1e-4, fMax[i] * 0.55)));
    }
    if (any) { flashCore.instanceMatrix.needsUpdate = true; flashJet.instanceMatrix.needsUpdate = true; }
  }
  function emitMuzzleFlash(f: Fighter, aim: THREE.Vector3) {
    if (f.isPlayer) emitFpMuzzleFlash();
    else emitTpMuzzleFlash(f, aim);
  }
  function stepFlash(dt: number) { stepFpFlash(dt); stepTpFlash(dt); }
  // ---- 血花：一個 InstancedMesh 池，不在命中時配置新物件 ----
  const BN = LO ? 80 : 240, blood = new THREE.InstancedMesh(new THREE.BoxGeometry(0.035, 0.035, 0.035), new THREE.MeshBasicMaterial({ color: 0x9a0a0a }), BN);
  blood.frustumCulled = false; scene.add(blood);
  const bp = new Float32Array(BN * 3), bv = new Float32Array(BN * 3), bl = new Float32Array(BN); let bi = 0;
  const _m = new THREE.Matrix4(), _zero = new THREE.Matrix4().makeScale(0, 0, 0);
  for (let i = 0; i < BN; i++) blood.setMatrixAt(i, _zero);
  function burst(at: THREE.Vector3, dir: THREE.Vector3, n: number) {
    if (!U.gore()) return;
    const nn = LO ? Math.min(n, 8) : n;
    for (let k = 0; k < nn; k++) { const i = bi; bi = (bi + 1) % BN; const sp = 1.5 + Math.random() * 3;
      bp[i * 3] = at.x; bp[i * 3 + 1] = at.y; bp[i * 3 + 2] = at.z;
      bv[i * 3] = dir.x * sp + (Math.random() - .5) * 2.2; bv[i * 3 + 1] = dir.y * sp + Math.random() * 2; bv[i * 3 + 2] = dir.z * sp + (Math.random() - .5) * 2.2; bl[i] = 0.35 + Math.random() * 0.35; }
  }
  function stepBlood(dt: number) {
    let any = false;
    for (let i = 0; i < BN; i++) { if (bl[i] <= 0) continue; any = true; bl[i] -= dt;
      if (bl[i] <= 0 || bp[i * 3 + 1] < 0.01) { bl[i] = 0; blood.setMatrixAt(i, _zero); continue; }
      bv[i * 3 + 1] -= 9.8 * dt; bp[i * 3] += bv[i * 3] * dt; bp[i * 3 + 1] += bv[i * 3 + 1] * dt; bp[i * 3 + 2] += bv[i * 3 + 2] * dt;
      const sc = Math.min(1, bl[i] * 3); _m.makeScale(sc, sc, sc).setPosition(bp[i * 3], bp[i * 3 + 1], bp[i * 3 + 2]); blood.setMatrixAt(i, _m); }
    if (any) blood.instanceMatrix.needsUpdate = true;
  }
  // ---- 對手頭上血條（看板，滿血或太遠就藏） ----
  const barG = new THREE.PlaneGeometry(0.7, 0.09);
  for (const f of fighters) if (f.mesh) {
    const g = new THREE.Group(), bg = new THREE.MeshBasicMaterial({ color: 0x1a1a1a, transparent: true, depthWrite: false }), fm = new THREE.MeshBasicMaterial({ color: 0x33cc33, transparent: true, depthWrite: false });
    const b = new THREE.Mesh(barG, bg); b.scale.set(1.08, 1.5, 1); const fill = new THREE.Mesh(barG, fm); fill.position.z = 0.001; g.add(b, fill); g.renderOrder = 5; scene.add(g); g.visible = false;
    f.hpBar = { g, fill, bg, fm };
  }
  function stepBars() {
    for (const f of fighters) { const h = f.hpBar; if (!h) continue;
      const show = !f.dead && f.hp < MAX_HP && f.pos.distanceTo(me.pos) < 20; h.g.visible = show; if (!show) continue;
      h.g.position.set(f.pos.x, 2.05, f.pos.z); h.g.quaternion.copy(cam.quaternion);
      const r = Math.max(0, f.hp) / MAX_HP; h.fill.scale.x = Math.max(0.001, r); h.fill.position.x = -0.35 * (1 - r); h.fm.color.set(hpCol(Math.max(0, f.hp) / MAX_HP * 100));
      const op = now < f.invulnUntil ? 0.35 : 1; h.fm.opacity = op; h.bg.opacity = op * 0.8; }
  }
  // ---- 輸入 ----
  const DSv = loadDS(); DSv.btn = Math.min(1.3, Math.max(0.7, DSv.btn));
  // 開發作弊：僅 session，不寫入 oyster-dm-set
  let cheatHp = !!DM_DEV, cheatAmmo = !!DM_DEV; // 開發模式預設開無限血／彈
  const applyDS = () => { root.style.setProperty('--bs', String(DSv.btn)); root.style.setProperty('--bo', String(DSv.op)); try { localStorage.setItem('oyster-dm-set', JSON.stringify(DSv)); } catch { /* 無痕模式 */ } };
  {
    const bind = (id: string, k: keyof DS) => { const el = q(id) as HTMLInputElement; if (el.type === 'checkbox') { el.checked = DSv[k] as boolean; el.onchange = () => { (DSv as Record<string, unknown>)[k] = el.checked; applyDS(); }; } else { el.value = String(DSv[k]); el.oninput = () => { (DSv as Record<string, unknown>)[k] = +el.value; applyDS(); }; } };
    bind('dsSens', 'sens'); bind('dsTsens', 'tsens'); bind('dsInv', 'invY'); bind('dsAssist', 'assist'); bind('dsBtn', 'btn'); bind('dsOp', 'op');
    { const el = q('dsAdsMode') as HTMLSelectElement; el.value = DSv.adsMode; el.onchange = () => { DSv.adsMode = el.value as DS['adsMode']; adsNeedRelease = false; clearMixTimer(); applyDS(); }; }
    applyDS();
    if (DM_DEV) {
      const hpEl = q('dsGodHp') as HTMLInputElement, ammoEl = q('dsGodAmmo') as HTMLInputElement;
      hpEl.checked = cheatHp; ammoEl.checked = cheatAmmo;
      hpEl.onchange = () => { cheatHp = hpEl.checked; if (cheatHp && me.dead) { spawn(me); if (me.mesh) me.mesh.visible = true; q('dmMsg').innerHTML = ''; } else if (cheatHp) me.hp = MAX_HP; };
      ammoEl.onchange = () => { cheatAmmo = ammoEl.checked; if (cheatAmmo && !me.dead) me.wpn.ammo = me.wpn.def.maxAmmo; };
    }
    q('dmSetBtn').onclick = () => { if (document.pointerLockElement) document.exitPointerLock(); q('dmShop').classList.remove('show'); q('dmSet').classList.add('show'); };
    q('dmSetX').onclick = () => q('dmSet').classList.remove('show');
  }
  // ---- 換槍（僅雜貨店已購買；點開預覽，預覽內可裝備）----
  function doEquipWpn(id: WeaponId) {
    if (!ownedWpns.has(id)) { msg('這把還沒買，先去雜貨店', 1.8); return false; }
    if (me.wpn.def.id === id) { msg(`已在用 ${me.wpn.def.name}`, 1.0); return true; }
    equipWeapon(me, id);
    U.equippedWeapon = id;
    U.setEquippedWeapon(id);
    msg(`換上 ${me.wpn.def.name}`, 1.2);
    return true;
  }
  function refreshShop() {
    renderShopList(q('dmShopList'), {
      equipped: me.wpn.def.id,
      owned: ownedWpns,
      onPick: (id) => {
        const own = ownedWpns.has(id);
        const eq = me.wpn.def.id === id;
        const act = eq
          ? '<button type="button" class="ghost" disabled>使用中</button>'
          : own
            ? `<button type="button" data-prev-eq="${id}">裝備</button>`
            : '<button type="button" class="ghost" disabled>未購買</button>';
        openWeaponPreview({
          id,
          ctx: { shellGeos: U.shellGeos, shellMat: U.shellMat },
          actionsHtml: `${act}<button type="button" class="ghost" data-prev-x>關閉</button>`,
          bindActions: (box, close) => {
            box.querySelector('[data-prev-x]')?.addEventListener('click', e => { e.stopPropagation(); close(); });
            box.querySelector(`[data-prev-eq="${id}"]`)?.addEventListener('click', e => {
              e.stopPropagation();
              if (doEquipWpn(id)) { close(); refreshShop(); }
            });
          },
        });
        if (!own) msg('這把還沒買，先去雜貨店', 1.6);
      },
    });
  }
  function openShop() {
    if (document.pointerLockElement) document.exitPointerLock();
    q('dmSet').classList.remove('show');
    refreshShop();
    q('dmShop').classList.add('show');
  }
  q('dmShopBtn').onclick = () => openShop();
  q('dmShopX').onclick = () => q('dmShop').classList.remove('show');
  const keys: Record<string, boolean> = {}; const joy = { x: 0, y: 0 }; let holdPick = false, sprint = false, rmb = false;
  // 按住開火：按下立刻第一發；基本槍為 3 連發節奏（組內短間隔、組間停頓），放開或沒殼就停
  let fireHeld = 0, fireCd = 0;
  const tryAutoFire = () => {
    if (frozen() || fireCd > 0 || me.dead) return;
    if (me.wpn.ammo <= 0 && !(DM_DEV && cheatAmmo)) { fireHeld = 0; me.wpn.burstLeft = 0; return; }
    armBurst(me.wpn);
    if (throwShell(me)) fireCd = cooldownAfterShot(me.wpn);
  };
  const fireDown = () => { fireHeld++; tryAutoFire(); };
  const fireUp = () => { fireHeld = Math.max(0, fireHeld - 1); if (!fireHeld) me.wpn.burstLeft = 0; };
  const blur = () => { for (const k in keys) keys[k] = false; closeUmb(me); clearMixTimer(); adsNeedRelease = false; setAds(false); holdPick = false; rmb = false; fireHeld = 0; me.wpn.burstLeft = 0; };
  addEventListener('blur', blur);
  let locked = false, wasLocked = false;
  const onKey = (e: KeyboardEvent, d: boolean) => {
    if (d && (e.code === 'Escape' || e.key === 'Escape')) {
      if (closeWeaponPreview()) { e.preventDefault(); return; }
      if (q('dmSet').classList.contains('show')) { q('dmSet').classList.remove('show'); e.preventDefault(); return; }
      if (q('dmShop').classList.contains('show')) { q('dmShop').classList.remove('show'); e.preventDefault(); return; }
      if (q('dmBoard').classList.contains('show') && !roundOver) { q('dmBoard').classList.remove('show'); e.preventDefault(); return; }
    }
    if ((e.target as HTMLElement).tagName === 'INPUT') return;
    keys[e.code] = d;
    if (e.code === 'Tab') { e.preventDefault(); q('dmBoard').classList.toggle('show', d); if (d) renderBoard(); }
    if (d && e.code === 'KeyE') pick(me);
    if (e.code === 'KeyR' && !e.repeat) { if (d) openUmb(me); else if (!rmb) closeUmb(me); }
  };
  const kd = (e: KeyboardEvent) => onKey(e, true), ku = (e: KeyboardEvent) => onKey(e, false);
  addEventListener('keydown', kd); addEventListener('keyup', ku);
  const plc = () => { locked = document.pointerLockElement === canvas; if (locked) wasLocked = true; else blur(); };
  document.addEventListener('pointerlockchange', plc);
  canvas.addEventListener('contextmenu', e => e.preventDefault());
  canvas.addEventListener('mousedown', e => { if (isTouch) return; if (!locked) { canvas.requestPointerLock?.(); return; }
    if (e.button === 0) fireDown();
    if (e.button === 2) {
      rmb = true;
      if (me.wpn.def.zoom > 1) scopePress();
      else openUmb(me);
    }
  });
  const mu = (e: MouseEvent) => {
    if (e.button === 0 && fireHeld) fireUp();
    if (e.button === 2 && rmb) {
      rmb = false;
      if (me.wpn.def.zoom > 1) scopeRelease();
      else if (!keys.KeyR) closeUmb(me);
    }
  };
  addEventListener('mouseup', mu);
  // 桌面開鏡鈕（觸控走下方 root pointer，避免重複觸發）
  if (!isTouch) {
    q('dmScope').addEventListener('pointerdown', e => { e.preventDefault(); scopePress(); });
    q('dmScope').addEventListener('pointerup', () => scopeRelease());
    q('dmScope').addEventListener('pointercancel', () => scopeRelease());
    q('dmScope').addEventListener('pointerleave', () => { if (!rmb && DSv.adsMode !== 'tap') scopeRelease(); });
  }
  const clampP = (p: number) => Math.max(-1.3, Math.min(1.3, p));
  const inv = () => (DSv.invY ? -1 : 1);
  const lookScale = () => (ads && me.wpn.def.zoom > 1 ? 1 / me.wpn.def.zoom : 1);
  canvas.addEventListener('mousemove', e => {
    if (!locked) return;
    const k = 0.0025 * DSv.sens * lookScale();
    me.yaw -= e.movementX * k; me.pitch = clampP(me.pitch - e.movementY * k * inv());
  });
  // 瞄準輔助：準星靠近對手時轉視角變慢
  const _af = new THREE.Vector3(), _at = new THREE.Vector3();
  function assistK() {
    if (!DSv.assist) return 1; const e = eyeOf(me); _af.copy(dirOf(me.yaw, me.pitch)); let best = 1;
    for (const f of fighters) { if (f === me || f.dead) continue; _at.set(f.pos.x, f.pos.y + 1.3, f.pos.z).sub(e); const d = _at.length(); if (d > 30) continue; const ang = _af.angleTo(_at.normalize()), lim = Math.max(0.04, 0.6 / d);
      if (ang < lim) best = Math.min(best, 0.45 + 0.55 * (ang / lim)); }
    return best;
  }
  // 觸控轉視角：靈敏度曲線＋輕微加速
  function touchLook(dx: number, dy: number) {
    const k = 0.0055 * DSv.tsens * assistK() * lookScale();
    me.yaw -= dx * k; me.pitch = clampP(me.pitch - dy * k * inv());
  }
  if (isTouch) {
    // 多指同時操作：用 pointerId 分開追蹤浮動搖桿、轉視角、各個按鈕
    const fj = q('dmFJ'), fk = q('dmFK'), hint = q('dmJoyHint');
    type P = { k: 'joy' | 'look' | 'btn'; el?: HTMLElement; x: number; y: number; ox: number; oy: number };
    const ptr = new Map<number, P>(); const DEAD = 0.15, RAD = 55;
    const joyAt = (p: P, x: number, y: number) => {
      let jx = (x - p.ox) / RAD, jy = (y - p.oy) / RAD; const l = Math.hypot(jx, jy); if (l > 1) { jx /= l; jy /= l; }
      const m = Math.min(1, l); fk.style.transform = `translate(${jx * 40}px,${jy * 40}px)`;
      if (m < DEAD) { joy.x = joy.y = 0; sprint = false; } else { const r = (m - DEAD) / (1 - DEAD) / m; joy.x = jx * r; joy.y = jy * r; sprint = l > 1.15; } // 推出外圈＝衝刺
      fj.classList.toggle('sprint', sprint);
    };
    root.addEventListener('pointerdown', e => {
      if (e.pointerType === 'mouse' || q('dmSet').classList.contains('show') || q('dmShop').classList.contains('show')) return; const t = e.target as HTMLElement, b = t.closest('button') as HTMLElement | null;
      const rec: P = { k: 'look', x: e.clientX, y: e.clientY, ox: e.clientX, oy: e.clientY };
      if (b) {
        if (b.id === 'dmUmb') openUmb(me);
        if (b.id === 'dmScope') scopePress();
        if (b.id === 'dmThrow' || b.id === 'dmFireL') fireDown();
        if (b.id === 'dmPick') holdPick = true;
        rec.k = 'btn'; rec.el = b; ptr.set(e.pointerId, rec); return;
      }
      if (e.clientX < innerWidth * 0.45 && ![...ptr.values()].some(p => p.k === 'joy')) { rec.k = 'joy'; fj.style.left = e.clientX + 'px'; fj.style.top = e.clientY + 'px'; fj.classList.add('show'); hint.style.display = 'none'; joyAt(rec, e.clientX, e.clientY); }
      ptr.set(e.pointerId, rec);
    });
    root.addEventListener('pointermove', e => {
      const p = ptr.get(e.pointerId); if (!p) return;
      if (p.k === 'joy') joyAt(p, e.clientX, e.clientY);
      else if (p.k === 'look' || (p.k === 'btn' && (p.el?.id === 'dmThrow' || p.el?.id === 'dmFireL' || p.el?.id === 'dmScope'))) touchLook(e.clientX - p.x, e.clientY - p.y);
      p.x = e.clientX; p.y = e.clientY;
    });
    const end = (e: PointerEvent) => {
      const p = ptr.get(e.pointerId); if (!p) return; ptr.delete(e.pointerId);
      if (p.k === 'joy') { joy.x = joy.y = 0; sprint = false; fj.classList.remove('show', 'sprint'); fk.style.transform = ''; hint.style.display = ''; }
      if (p.k === 'btn' && p.el) {
        if (p.el.id === 'dmUmb') closeUmb(me);
        if (p.el.id === 'dmScope') scopeRelease();
        if (p.el.id === 'dmPick') { holdPick = false; if (e.type === 'pointerup') pick(me); }
        if (p.el.id === 'dmThrow' || p.el.id === 'dmFireL') fireUp();
      }
    };
    root.addEventListener('pointerup', end); root.addEventListener('pointercancel', end);
  }
  q('dmScoreBtn').onclick = () => { q('dmBoard').classList.toggle('show'); renderBoard(); };
  q('dmX').onclick = () => requestExit();

  // ---- 遊戲邏輯 ----
  function pick(f: Fighter) {
    if (introT > 0 || f.dead || f.wpn.ammo >= f.wpn.def.maxAmmo) return false;
    const pile = findPickPile(f.pos, piles);
    if (!pile) {
      if (f.isPlayer && pileDist(f.pos) <= PICK_R) msg('這堆冷卻中，換一堆蚵仔', 1.6);
      return false;
    }
    const was = f.wpn.ammo; f.wpn.ammo = f.wpn.def.maxAmmo;
    markPileUsed(pile); sealPileIfNeeded(pile, true, true);
    if (f.isPlayer && was < f.wpn.def.maxAmmo) SND.reload();
    return true;
  }
  function eyeOf(f: Fighter) { return new THREE.Vector3(f.pos.x, f.pos.y + EYE, f.pos.z); }
  function dirOf(yaw: number, pitch: number) { return new THREE.Vector3(-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch)); }
  const shotAt = new Map<Fighter, number>();
  function throwShell(f: Fighter, yaw = f.yaw, pitch = f.pitch) {
    if (introT > 0 || f.dead) return false;
    if (f.umbHeld) { return false; }
    const w = f.wpn, infAmmo = DM_DEV && cheatAmmo && f.isPlayer;
    if (w.ammo <= 0 && !infAmmo) { return false; }
    if (!infAmmo) w.ammo--; f.shots++; shotAt.set(f, now); if (f.isPlayer) f.invulnUntil = 0;
    if (f.isPlayer && !infAmmo && w.ammo === 0) msg('沒殼了！去蚵仔堆塡彈', 3.2);
    const spd = w.def.bulletSpeed;
    const n = Math.max(1, w.def.pelletCount | 0);
    const spr = Math.max(0, w.def.spread);
    f.throwA = 0.35; w.kick = 1; SND.throw(f);
    const aim0 = dirOf(yaw, pitch);
    emitMuzzleFlash(f, aim0);
    for (let i = 0; i < n; i++) {
      const yy = yaw + (spr ? (Math.random() - 0.5) * 2 * spr : 0);
      const pp = pitch + (spr ? (Math.random() - 0.5) * 2 * spr : 0);
      const d = dirOf(yy, pp);
      const p = eyeOf(f).addScaledVector(aim0, 0.4);
      const m = shellMesh(); m.position.copy(p); scene.add(m);
      const vel = f.isPlayer ? d.multiplyScalar(spd) : d.multiplyScalar(spd).add(f.vel.clone().multiplyScalar(0.5));
      if (!f.isPlayer && i === 0) emitAsh(p, vel, LO ? 2 : 4, 0.85);
      shells.push({ pos: p, vel, owner: f, mesh: m, life: 6, trail: 0, damage: w.def.damage });
    }
    if (f.isPlayer && w.def.adsBreakOnFire) { adsNeedRelease = true; setAds(false); }
    return true;
  }
  // 點是否在某人的命中區（頭為球，身體與腳為圓柱）
  function hitPart(f: Fighter, p: THREE.Vector3): Part | null {
    const dx = p.x - f.pos.x, dz = p.z - f.pos.z, y = p.y - f.pos.y, h = Math.hypot(dx, dz);
    if (Math.hypot(h, y - 1.665) < 0.22) return 'head';
    if (h < 0.34 && y >= 0.8 && y < 1.5) return 'body';
    if (h < 0.24 && y >= 0 && y < 0.8) return 'legs';
    return null;
  }
  const _wn = new THREE.Vector3();
  /** 撞牆／地板：回傳表面法線；未撞則 null */
  function hitWorld(p: THREE.Vector3): THREE.Vector3 | null {
    if (p.y <= 0) return _wn.set(0, 1, 0);
    if (Math.abs(p.x) >= HALF - 0.2) return _wn.set(-Math.sign(p.x) || -1, 0, 0);
    if (Math.abs(p.z) >= HALF - 0.2) return _wn.set(0, 0, -Math.sign(p.z) || -1);
    return null;
  }
  function damage(src: Fighter, f: Fighter, part: Part, at: THREE.Vector3, bodyDamage: number, dir?: THREE.Vector3) {
    src.hits++;
    if (f.dead) return;
    const amt = partDamage(bodyDamage, part);
    const inv = now < f.invulnUntil || (DM_DEV && cheatHp && f.isPlayer);
    if (!inv) { burst(at, dir ?? _d.set(0, 0, 0), part === 'head' ? 26 : 10); SND.hit(at, part === 'head', src.isPlayer); }
    if (src.isPlayer) { popAt(at, inv ? ico(I.shield, 28) : part === 'head' ? ico(I.head, 34) : `-${amt}`); mark(); }
    if (inv) return;
    f.hp -= amt;
    if (f.isPlayer) { flashHurt(); SND.hurt(); }
    if (f.hp <= 0) {
      f.dead = true; f.deathAt = now; if (dir) f.fallDir.set(dir.x, 0, dir.z).normalize(); if (f.fallDir.lengthSq() < 0.5) f.fallDir.set(0, 0, 1); f.deaths++; f.respawnAt = now + 3; f.wpn.ammo = 0; f.wpn.kick = 0; src.kills++; if (part === 'head') src.hs++;
      if (f.umbMesh) f.umbMesh.visible = false; f.umbHeld = false;
      feed(src, f, part === 'head');
      if (src.isPlayer && part === 'head') showHeadshot();
      if (src.isPlayer && !f.isPlayer) spawnOddLoot(_at.set(f.pos.x, f.pos.y + 0.95, f.pos.z), scene, LO, oddLoots);
      if (isHorde && f.isPlayer) { f.respawnAt = 1e12; endRound('你倒下了'); }
      else if (isHorde && !f.isPlayer) checkHordeWaveClear();
    }
  }
  function checkHordeWaveClear() {
    if (roundOver || waveBreakT > 0) return;
    if (botsOnly().some(b => !b.dead)) return;
    wavesCleared = wave;
    me.hp = Math.min(MAX_HP, me.hp + 30);
    waveBreakT = 3.2;
    msg(`第 ${wave} 關過關！休息一下…`, 2.8);
  }
  const _dir = new THREE.Vector3(), _sa = new THREE.Vector3(), _sb = new THREE.Vector3(), _sp = new THREE.Vector3(), _inc = new THREE.Vector3();
  function stepShells(dt: number) {
    const step = LO ? 0.14 : 0.08;
    for (let i = shells.length - 1; i >= 0; i--) {
      const s = shells[i]; _sa.copy(s.pos); _sb.copy(_sa).addScaledVector(s.vel, dt); s.life -= dt;
      // 飛行中持續剝落殼灰
      s.trail += _sa.distanceTo(_sb);
      while (s.trail > (LO ? 0.9 : 0.55)) {
        s.trail -= LO ? 0.9 : 0.55;
        _sp.lerpVectors(_sa, _sb, Math.random());
        emitAsh(_sp, s.vel, 1, 0.45);
      }
      const n = Math.max(1, Math.ceil(_sa.distanceTo(_sb) / step)); let done = false;
      for (let k = 1; k <= n && !done; k++) {
        _sp.lerpVectors(_sa, _sb, k / n);
        for (const f of fighters) {
          if (f.dead || !isHostile(s.owner, f)) continue;
          if (umbUp(f) && Math.hypot(_sp.x - f.pos.x, _sp.z - f.pos.z) < 0.9 && _sp.y > f.pos.y + 0.3 && _sp.y < f.pos.y + 2.2) {
            const fwd = dirOf(f.yaw, 0); _inc.copy(s.vel).setY(0).normalize();
            if (-fwd.dot(_inc) > Math.cos(Math.PI / 3) && Math.random() < U.umb.cover) { SND.block(_sp); emitAsh(_sp, s.vel, LO ? 2 : 4, 1.0); if (f.isPlayer || s.owner.isPlayer) popAt(_sp, ico(I.umb, 28)); done = true; break; }
          }
          const part = hitPart(f, _sp); if (part) { damage(s.owner, f, part, _sp, s.damage, _dir.copy(s.vel).normalize()); emitAsh(_sp, s.vel, LO ? 3 : 5, 1.1); done = true; break; } }
        if (!done) {
          for (const br of breakables) {
            if (propContains(br, _sp)) { hitBreakable(br, _sp, _dir.copy(s.vel).normalize()); emitAsh(_sp, s.vel, LO ? 2 : 4, 1.0); done = true; break; }
          }
        }
        if (!done) {
          const wn = hitWorld(_sp);
          if (wn) { placeScar(_sp, wn); emitAsh(_sp, s.vel, LO ? 2 : 4, 0.95); done = true; }
        }
      }
      s.pos.copy(_sb); s.mesh.position.copy(_sb); s.mesh.rotation.y += dt * 20; s.mesh.rotation.x += dt * 9;
      if (done || s.life <= 0) { scene.remove(s.mesh); shells.splice(i, 1); }
    }
  }
  function collide(f: Fighter) {
    f.pos.x = Math.max(-HALF + 0.5, Math.min(HALF - 0.5, f.pos.x)); f.pos.z = Math.max(-HALF + 0.5, Math.min(HALF - 0.5, f.pos.z));
    for (const b of covers) {
      if (b.max.y < 0) continue; // 已破壞清空
      const cx = Math.max(b.min.x, Math.min(b.max.x, f.pos.x)), cz = Math.max(b.min.z, Math.min(b.max.z, f.pos.z));
      const dx = f.pos.x - cx, dz = f.pos.z - cz, d = Math.hypot(dx, dz);
      if (d < R) { if (d < 1e-4) { f.pos.x += R; continue; } f.pos.x = cx + dx / d * R; f.pos.z = cz + dz / d * R; }
    }
  }
  // 直線仰角：水平距離 d、高差 dy
  function launchPitch(d: number, dy: number) {
    return Math.atan2(dy, d); // 直線彈道
  }
  function botThink(f: Fighter, dt: number) {
    if (now < f.idleUntil) { f.vel.set(0, 0, 0); return; }
    if (f.umbHeld) { if (!shells.some(s => isHostile(s.owner, f) && s.pos.distanceTo(f.pos) < 8)) closeUmb(f); }
    else if (f.cd > 0.4) for (const s of shells) { if (!isHostile(s.owner, f)) continue; const rel = f.pos.clone().sub(s.pos); rel.y = 0; if (rel.length() < 8 && rel.normalize().dot(s.vel.clone().setY(0).normalize()) > 0.95 && Math.random() < 0.02) { f.yaw = Math.atan2(s.pos.x - f.pos.x, s.pos.z - f.pos.z) + Math.PI; openUmb(f); break; } }
    const targets = fighters.filter(o => isHostile(f, o) && !o.dead);
    let tgt: Fighter | null = null, best = 1e9;
    for (const o of targets) { const d = o.pos.distanceTo(f.pos) * (o.isPlayer ? 0.8 : 1); if (d < best) { best = d; tgt = o; } }
    if (f.wpn.ammo === 0 || (f.pickT > 0 && f.wpn.ammo < f.wpn.def.maxAmmo)) {
      f.goal.copy(nearOpenPile(f.pos)); f.pickT = 1; // 去最近可填的蚵仔堆
    } else if (f.pos.distanceTo(f.goal) < 1.5 || Math.random() < dt * 0.3) {
      f.pickT = 0; const base = tgt ? tgt.pos : nearOpenPile(f.pos); const a = Math.random() * 6.28, r = 7 + Math.random() * 6;
      f.goal.set(base.x + Math.cos(a) * r, 0, base.z + Math.sin(a) * r);
    }
    const to = f.goal.clone().sub(f.pos); to.y = 0;
    const spd = WALK * 0.72 * (isHorde ? agr.spdMul : 1);
    if (to.length() > 0.3) f.vel.copy(to.normalize().multiplyScalar(spd)); else f.vel.set(0, 0, 0);
    if (tgt && !f.umbHeld) {
      // 預判：用飛行時間估計目標位置
      const pspd = f.wpn.def.bulletSpeed;
      let aim = tgt.pos.clone(); for (let k = 0; k < 3; k++) { const t = eyeOf(f).distanceTo(aim) / (pspd * 0.95); aim = tgt.pos.clone().addScaledVector(tgt.vel, t); }
      // 圍毆後期較常瞄頭
      const headP = isHorde ? Math.min(0.42, 0.1 + wave * 0.03) : 0.15;
      aim.y += 1.15 + (Math.random() < headP ? 0.45 : 0);
      const e = eyeOf(f), dx = aim.x - e.x, dz = aim.z - e.z, d = Math.hypot(dx, dz);
      f.yaw = Math.atan2(-dx, -dz); f.pitch = launchPitch(d, aim.y - e.y);
      f.cd -= dt;
      if (f.wpn.ammo > 0 && f.cd <= 0 && d < 22) {
        const err = (0.02 + d * 0.0025) * (isHorde ? agr.errMul : 1);
        throwShell(f, f.yaw + (Math.random() - .5) * err * 2, f.pitch + (Math.random() - .5) * err * 2);
        f.cd = (0.75 + Math.random() * 0.8) * (isHorde ? agr.cdMul : 1);
      }
    } else f.yaw = Math.atan2(-f.vel.x, -f.vel.z);
  }
  const _fq = new THREE.Quaternion(), _yq = new THREE.Quaternion(), _fa = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0);
  const _mv = new THREE.Vector3();
  function syncIntro() {
    const el = q('dmCount');
    if (introT <= 0) {
      el.classList.add('hide');
      el.innerHTML = '';
      return;
    }
    el.classList.remove('hide');
    if (introT <= INTRO_GO) {
      if (introShown !== -1) {
        introShown = -1;
        el.classList.add('go');
        el.innerHTML = '<span>開始！</span>';
        tn(520, 0.12, 0.18, 'square');
        tn(780, 0.16, 0.14, 'triangle', 0, 0.04);
      }
      return;
    }
    el.classList.remove('go');
    const n = Math.max(1, Math.ceil(introT - INTRO_GO));
    if (introShown !== n) {
      introShown = n;
      el.innerHTML = `<span>${n}</span>`;
      tn(280 + (4 - n) * 90, 0.09, 0.14, 'square');
    }
  }
  function beginMatch() {
    q('dmCount').classList.add('hide');
    q('dmCount').innerHTML = '';
    if (isHorde) startHordeWave(1);
    else msg(`${DM_MODE_LABEL.ffa} · ${match.botCount} BOT · ${Math.round(match.durationSec / 60)} 分鐘`, 2.6);
  }
  function update(dt: number) {
    if (roundOver) return;
    if (introT > 0) {
      introT -= dt;
      syncIntro();
      if (introT <= 0) {
        introT = 0;
        syncIntro();
        beginMatch();
      }
      return;
    }
    if (DM_DEV && cheatAmmo && !me.dead) me.wpn.ammo = me.wpn.def.maxAmmo;
    if (DM_DEV && cheatHp && !me.dead) me.hp = MAX_HP;
    fireCd -= dt; if (fireHeld) tryAutoFire();
    now += dt;
    matchClock += dt;
    if (!isHorde) {
      roundLeft -= dt;
      if (roundLeft <= 0) { endRound('時間到'); return; }
    } else if (waveBreakT > 0) {
      waveBreakT -= dt;
      if (waveBreakT <= 0) startHordeWave(wave + 1);
    }
    stepPileCools(dt, piles, cam);
    for (const f of fighters) {
      f.wpn.kick = Math.max(0, f.wpn.kick - dt * 9);
      if (f.dead && f.mesh) { // 倒地：往被打的方向倒下，躺到復活（沒有命中判定）
        const k = Math.min(1, (now - f.deathAt) / 0.55), e = k * k * (3 - 2 * k) * (Math.PI / 2 - 0.08) + (k >= 1 ? 0 : Math.sin(k * Math.PI) * 0.05);
        _fq.setFromAxisAngle(_fa.set(f.fallDir.z, 0, -f.fallDir.x), e); _yq.setFromAxisAngle(_up, f.yaw); f.mesh.quaternion.copy(_fq).multiply(_yq); f.mesh.position.copy(f.pos); f.mesh.visible = true; }
      if (f.dead) {
        f.vel.set(0, 0, 0);
        if (!isHorde && now >= f.respawnAt) { spawn(f); if (f.mesh) f.mesh.visible = true; if (f.isPlayer) q('dmMsg').innerHTML = ''; }
        continue;
      }
      if (f.umbHeld) { f.umbT -= dt; if (f.umbT <= 0) { f.umbHeld = false; f.umbTired = true; f.umbT = 0; } }
      if (f.umbMesh) f.umbMesh.visible = f.umbHeld;
      // 邊走邊撿：可填的蚵堆每 0.12 秒補一顆；填滿或離開後該堆進冷卻
      {
        const pile = findPickPile(f.pos, piles);
        if (pile && f.wpn.ammo < f.wpn.def.maxAmmo) {
          f.pickCd -= dt;
          if (f.pickCd <= 0) {
            f.wpn.ammo++; f.pickCd = 0.12; markPileUsed(pile);
            if (f.isPlayer) { if (f.wpn.ammo === f.wpn.def.maxAmmo) SND.reload(); else SND.pick(); }
            if (f.wpn.ammo >= f.wpn.def.maxAmmo) sealPileIfNeeded(pile, true, true);
          }
        } else f.pickCd = 0;
      }
      if (f.isPlayer && (holdPick || keys.KeyE)) pick(f);
      if (f.isPlayer) {
        let fx = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0) + joy.x, fz = (keys.KeyS ? 1 : 0) - (keys.KeyW ? 1 : 0) + joy.y;
        const l = Math.hypot(fx, fz); if (l > 1) { fx /= l; fz /= l; }
        const s = Math.sin(f.yaw), c = Math.cos(f.yaw);
        // 各方向同一最高速：輸入長度≤1（搖桿類比保留），衝刺全方向一致×SPRINT，後退方向平滑降到 0.85，加減速與幀率無關
        const ln = Math.hypot(fx, fz), back = ln > 0 ? Math.max(0, fz / ln) : 0;
        const vmax = WALK * ((keys.ShiftLeft || keys.ShiftRight || sprint) ? SPRINT : 1) * (1 - 0.15 * back) * (ads ? 0.55 : 1);
        _mv.set((fx * c + fz * s) * vmax, 0, (-fx * s + fz * c) * vmax); f.vel.lerp(_mv, 1 - Math.exp(-14 * dt));
      } else botThink(f, dt);
      if (f.vel.lengthSq() > 0.01) f.invulnUntil = Math.min(f.invulnUntil, now); // 一開始移動就結束無敵
      const spd = f.vel.length(); if (spd > 0.5) { f.stepAcc += spd * dt; if (f.stepAcc > 0.75) { f.stepAcc = 0; if (f.isPlayer || f.pos.distanceTo(me.pos) < 25) SND.step(f); } } else f.stepAcc = 0.6;
      f.pos.addScaledVector(f.vel, dt); collide(f);
      if (f.rig) {
        const r = f.rig;
        const sp = f.vel.length();
        const moving = sp > 0.4;
        const sprinting = sp > WALK * 1.25;
        const cadence = (sprinting ? 3.4 : 2.5) * Math.min(1.35, sp / Math.max(0.01, WALK));
        if (moving) f.walkPh += dt * cadence * 6.2;
        else f.walkPh += dt * 1.2;
        const ph = f.walkPh;
        const amp = moving ? Math.min(1, sp / (WALK * 0.85)) : 0.12;
        const stride = Math.sin(ph) * amp;
        const stride2 = Math.sin(ph * 2);
        // 身體：上下顛簸＋扭腰＋側傾（別只平移）
        r.root.position.y = Math.abs(stride2) * 0.045 * amp;
        r.torso.rotation.y = stride * 0.18;
        r.torso.rotation.z = stride * -0.1;
        r.torso.rotation.x = moving ? -0.06 * amp - (sprinting ? 0.04 : 0) : 0;
        r.head.rotation.y = -r.torso.rotation.y * 0.55;
        r.head.rotation.x = moving ? 0.04 * amp : Math.sin(ph * 0.5) * 0.02;
        // 腿：跨步＋小腿回踢
        r.legL.rotation.x = stride * 0.85;
        r.legR.rotation.x = -stride * 0.85;
        r.shinL.rotation.x = Math.max(0, -Math.sin(ph)) * 0.7 * amp + 0.08;
        r.shinR.rotation.x = Math.max(0, Math.sin(ph)) * 0.7 * amp + 0.08;
        // 持槍：方塊手黏槍＋臂段對準；開火後座；撐傘另姿
        f.throwA = Math.max(0, f.throwA - dt);
        const fireKick = f.throwA > 0 ? Math.sin((f.throwA / 0.35) * Math.PI) : 0;
        if (f.umbHeld) poseUmbArms(r);
        else {
          poseAimArms(r, fireKick);
          r.weaponMount.rotation.y += stride * 0.02;
          r.weaponMount.position.y += Math.abs(stride) * 0.01;
        }
      }
      if (f.mesh) { f.mesh.position.copy(f.pos); f.mesh.rotation.set(0, f.yaw, 0); f.mesh.visible = now < f.invulnUntil ? Math.floor(now * 10) % 2 === 0 : true; }
    }
    stepShells(dt); stepAsh(dt); stepBreakables(dt); stepScrap(dt); stepScars(dt); stepFlash(dt); stepBlood(dt); stepBars();
    for (const pile of piles) {
      if (!pile.dirty || pile.cool > 0) continue;
      const someone = fighters.some(f => !f.dead && Math.hypot(f.pos.x - pile.pos.x, f.pos.z - pile.pos.z) <= PICK_R);
      sealPileIfNeeded(pile, someone, false);
    }
    stepOddLoot(dt, oddLoots, scene, HALF);
    if (!me.dead) {
      const got = tryPickOddLoot(me.pos, oddLoots, scene, U.grantOdd);
      if (got) {
        const first = got.n === 1 ? ' 🆕第一次！' : `（×${got.n}）`;
        msg(`獲得奇物「${got.name}」${first}`, 2.8);
        popAt(got.pos, got.name);
        SND.pick();
      }
    }
  }

  // ---- UI ----
  function msg(t: string, sec: number) { q('dmMsg').textContent = t; msgT = sec; }
  // 開場文案改由 beginMatch（倒數結束後）再叫；肉鴿提示在 startHordeWave
  syncIntro();
  function endRound(reason: string) {
    if (roundOver) return;
    roundOver = true; roundLeft = 0; waveBreakT = 0; fireHeld = 0; me.wpn.burstLeft = 0;
    if (ads) setAds(false);
    for (const f of fighters) f.vel.set(0, 0, 0);
    if (document.pointerLockElement === canvas) document.exitPointerLock();
    if (isHorde) payout = hordeReward(wavesCleared, me.kills);
    else {
      const rows = [...fighters].sort((a, b) => b.kills - a.kills || a.deaths - b.deaths);
      const place = Math.max(1, rows.findIndex(f => f.isPlayer) + 1);
      payout = ffaReward(place, me.kills);
    }
    if (payout > 0) U.grantMoney(payout, isHorde ? 'dm-horde' : 'dm-ffa');
    if (!matchReported) {
      matchReported = true;
      try {
        U.reportMatchEnd?.({
          mode: match.mode,
          kills: me.kills,
          wavesCleared,
          payout,
          reason: isHorde && reason.includes('倒下') ? 'death' : 'time',
          durationSec: Math.max(0, Math.round(matchClock)),
        });
      } catch { /* 安靜失敗 */ }
    }
    q('dmBoard').classList.add('show'); renderBoard();
    msg(`${reason}${payout > 0 ? `　+$${payout}` : ''}`, 10);
  }
  function fmtClock(sec: number) {
    const s = Math.max(0, Math.ceil(sec)), m = (s / 60) | 0, r = s % 60;
    return `${m}:${r < 10 ? '0' : ''}${r}`;
  }
  let markT = 0; function mark() { q('dmMark').style.opacity = '1'; markT = 0.25; }
  let hsT = 0;
  function showHeadshot() {
    const el = q('dmHs');
    el.classList.remove('on'); void el.offsetWidth;
    el.classList.add('on');
    hsT = 1.35;
  }
  function flashHurt() { const e = q('dmEdge'); e.classList.add('on'); requestAnimationFrame(() => requestAnimationFrame(() => e.classList.remove('on'))); const h = q('dmHp'); h.classList.remove('hit'); void h.offsetWidth; h.classList.add('hit'); }
  // 擊殺欄：「擊倒者 圖示 倒下者」，名字只留代號
  const tag = (f: Fighter) => f.isPlayer ? '你' : f.name.slice(-1);
  function feed(a: Fighter, b: Fighter, head: boolean) {
    const box = q('dmFeed'), el = document.createElement('div'); if (a.isPlayer || b.isPlayer) el.className = 'me';
    const html = `${tag(a)} ${ico(head ? I.head : I.skull, 16)} ${tag(b)}`, top = box.firstElementChild as HTMLElement | null;
    if (top && top.dataset.k === html) { const n = +(top.dataset.n || 1) + 1; top.dataset.n = String(n); top.innerHTML = `${html} <small>×${n}</small>`; return; } // 連續相同就合併
    el.dataset.k = html; el.innerHTML = html; box.prepend(el);
    while (box.children.length > 4) box.lastElementChild!.remove(); setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 450); }, 4000);
  }
  function popAt(p: THREE.Vector3, t: string) {
    const v = p.clone().project(cam); if (v.z > 1) return;
    const el = document.createElement('div'); el.className = 'dmPop'; el.innerHTML = t;
    el.style.left = ((v.x + 1) / 2 * innerWidth) + 'px'; el.style.top = ((1 - v.y) / 2 * innerHeight) + 'px'; root.appendChild(el);
    requestAnimationFrame(() => { el.style.transform = 'translate(-50%,-150%)'; el.style.opacity = '0'; }); setTimeout(() => el.remove(), 900);
  }
  function renderBoard() {
    const rows = isHorde
      ? [me, ...botsOnly().filter(b => b.kills + b.deaths + b.shots > 0 || !b.dead)].sort((a, b) => b.kills - a.kills || a.deaths - b.deaths)
      : [...fighters].sort((a, b) => b.kills - a.kills || a.deaths - b.deaths);
    const hd = q('dmBoard').querySelector('h2');
    if (hd) {
      const title = roundOver
        ? (isHorde ? ` 撐到第 ${wavesCleared} 關` : ' 時間到')
        : (isHorde ? ` 第 ${wave} 關` : '');
      hd.innerHTML = `${ico(I.board, 26)}${title}`;
    }
    const payLine = roundOver && payout > 0 ? `<div style="text-align:center;margin:6px 0 8px;font-weight:800;color:#ffd23f">獎勵 +$${payout}</div>` : '';
    const act = roundOver
      ? `<div id="dmBoardAct"><button type="button" class="dmb" id="dmAgain">${ico(I.play, 20)} 再來一次</button><button type="button" class="dmb" id="dmLeave">離開</button></div>`
      : '';
    q('dmTable').innerHTML = `${payLine}<table><tr><th></th><th>${ico(I.skull, 18)}</th><th>${ico(I.heart, 18)}</th><th>${ico(I.head, 18)}</th><th>%</th></tr>${rows.map(f => `<tr class="${f.isPlayer ? 'me' : ''}"><td>${tag(f)}</td><td>${f.kills}</td><td>${f.deaths}</td><td>${f.hs}</td><td>${f.shots ? Math.round(f.hits / f.shots * 100) : 0}%</td></tr>`).join('')}</table>${act}`;
    if (roundOver) {
      q('dmAgain')?.addEventListener('click', () => replay());
      q('dmLeave')?.addEventListener('click', () => requestExit());
    }
  }
  const hpCol = (hp: number) => `hsl(${Math.max(0, Math.min(100, hp)) * 1.05},32%,52%)`; // 低飽和：綠→琥珀→紅
  // 小地圖：場地外框、殼堆、玩家箭頭，最近有開火的對手才顯示紅點
  const mapC = (q('dmMap') as HTMLCanvasElement).getContext('2d')!;
  function drawMap() {
    const W = 192, k = (W - 16) / (HALF * 2), X = (x: number) => W / 2 + x * k, c = mapC;
    c.clearRect(0, 0, W, W); c.fillStyle = 'rgba(180,150,100,.35)'; c.fillRect(8, 8, W - 16, W - 16);
    c.strokeStyle = 'rgba(235,235,235,.7)'; c.lineWidth = 2; c.strokeRect(8, 8, W - 16, W - 16);
    for (let i = 0; i < piles.length; i++) {
      const p = piles[i];
      c.fillStyle = p.cool > 0 ? 'rgba(80,80,90,.75)' : 'rgba(210,190,150,.7)';
      c.beginPath(); c.arc(X(p.pos.x), X(p.pos.z), 5, 0, 7); c.fill();
      if (p.cool > 0) {
        c.strokeStyle = '#ffd23f'; c.lineWidth = 2; c.beginPath();
        c.arc(X(p.pos.x), X(p.pos.z), 7, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (p.cool / PILE_COOL_SEC)); c.stroke();
      }
    }
    c.fillStyle = '#c0605a'; for (const f of fighters) { if (f === me || f.dead || now - (shotAt.get(f) ?? -9) > 2) continue; c.beginPath(); c.arc(X(f.pos.x), X(f.pos.z), 7, 0, 7); c.fill(); }
    c.save(); c.translate(X(me.pos.x), X(me.pos.z)); c.rotate(-me.yaw); c.fillStyle = '#f2f2f2'; c.strokeStyle = 'rgba(0,0,0,.5)'; c.lineWidth = 1.5;
    c.beginPath(); c.moveTo(0, -13); c.lineTo(9, 9); c.lineTo(0, 4); c.lineTo(-9, 9); c.closePath(); c.fill(); c.stroke(); c.restore();
  }
  function hud() {
    const hpPct = Math.max(0, me.hp) / MAX_HP * 100; q('dmHpF').style.width = hpPct + '%'; q('dmHpF').style.background = hpCol(hpPct); q('dmHpN').innerHTML = `${ico(I.heart, 16)} ${DM_DEV && cheatHp ? '∞' : Math.max(0, me.hp)}`;
    const atPile = pileDist(me.pos) <= PICK_R;
    if (isTouch) q('dmUmb').classList.toggle('held', me.umbHeld);
    syncScopeBtn();
    const outAmmo = me.wpn.ammo === 0 && !(DM_DEV && cheatAmmo);
    q('dmAmmo').innerHTML = `${ico(I.gun)} ${me.wpn.def.name}　${ico(I.shell)} ${DM_DEV && cheatAmmo ? '∞' : `${me.wpn.ammo}/${me.wpn.def.maxAmmo}`}${outAmmo && !atPile ? '　去蚵堆' : ''}`;
    q('dmAmmo').classList.toggle('empty', outAmmo);
    const aliveBots = botsOnly().filter(b => !b.dead).length;
    const clock = isHorde ? `第${wave}關` : fmtClock(roundLeft);
    const pile = findPickPile(me.pos, piles);
    const nearCool = !pile && atPile;
    q('dmHud').innerHTML = `${clock}　${DM_MODE_LABEL[match.mode]}　${ico(I.person)} ${aliveBots + (me.dead ? 0 : 1)}　${ico(I.skull)} ${me.kills}${now < me.invulnUntil && !me.dead ? ' ' + ico(I.shield) : ''}${pile && me.wpn.ammo < me.wpn.def.maxAmmo && !me.dead ? ' ' + ico(I.grab) : ''}${nearCool ? ' 冷卻' : ''}`;
    drawMap(); if (isTouch) q('dmUmb').classList.toggle('cd', me.umbTired);
    if (introT > 0) { /* 倒數期間不蓋訊息 */ }
    else if (!roundOver && me.dead && !isHorde) q('dmMsg').innerHTML = `${ico(I.skull, 40)}<br>${Math.max(1, Math.ceil(me.respawnAt - now))}`;
    else if (!roundOver && !me.dead && msgT <= 0) {
      q('dmMsg').textContent = outAmmo
        ? (nearCool ? '這堆冷卻中 — 換下一堆填彈' : '沒殼了 — 去蚵仔堆塡彈')
        : '';
    }
    if (q('dmBoard').classList.contains('show') && !roundOver) renderBoard();
  }

  // ---- 迴圈 ----
  let raf = 0, last = performance.now(), hudT = 0;
  // 第一人稱頭晃：相位跟腳步距離對齊（每 0.75m 一步），停下平滑收斂；只動鏡頭不影響射擊起點
  let bobPh = 0, bobW = 0;
  function resize() { renderer.setSize(innerWidth, innerHeight, false); cam.aspect = innerWidth / innerHeight; cam.updateProjectionMatrix(); }
  addEventListener('resize', resize); resize();
  function loop() {
    raf = requestAnimationFrame(loop);
    const t = performance.now(), dt = Math.min(0.05, (t - last) / 1000); last = t;
    const paused = !isTouch && wasLocked && !locked; const overlay = q('dmSet').classList.contains('show') || q('dmShop').classList.contains('show');
    q('dmPause').classList.toggle('show', paused && !overlay);
    if (!paused) update(dt);
    if (me.dead || me.umbHeld || me.wpn.def.zoom <= 1) { if (ads) setAds(false); }
    adsT += ((ads ? 1 : 0) - adsT) * (1 - Math.exp(-(ads ? 16 : 12) * dt));
    const zMag = Math.max(1, me.wpn.def.zoom);
    const fovT = FOV0 / (1 + (zMag - 1) * adsT);
    if (Math.abs(cam.fov - fovT) > 0.05) { cam.fov = fovT; cam.updateProjectionMatrix(); }
    cam.position.copy(eyeOf(me)); let roll = 0, pt = me.pitch;
    if (me.dead) { bobW = 0; const k = Math.min(1, (now - me.deathAt) / 0.6), e = k * k * (3 - 2 * k); cam.position.y = EYE + (0.25 - EYE) * e; roll = 1.25 * e; pt = me.pitch * (1 - e) + 0.15 * e; }
    else {
      const spd = Math.hypot(me.vel.x, me.vel.z);
      const tgt = adsT > 0.5 ? 0 : (spd > 0.4 ? Math.min(1.2, spd / WALK) : 0); // 開鏡壓過頭晃
      bobW += (tgt - bobW) * (1 - Math.exp(-(tgt > bobW ? 16 : 9) * dt));
      if (spd > 0.4 && adsT < 0.5) bobPh += dt * spd * (Math.PI / 0.75);
      const w = bobW * bobW * (1 - adsT), sy = Math.sin(bobPh), cy = Math.cos(bobPh);
      const ox = cy * 0.03 * w, oy = sy * 0.055 * w, oz = -Math.abs(sy) * 0.014 * w;
      const rs = Math.sin(me.yaw), rc = Math.cos(me.yaw);
      cam.position.x += rc * ox - rs * oz; cam.position.y += oy; cam.position.z += -rs * ox - rc * oz;
      pt += cy * 0.014 * w; roll += sy * 0.02 * w;
      const lat = me.vel.x * rc - me.vel.z * rs;
      roll += Math.max(-1, Math.min(1, lat / WALK)) * 0.04 * Math.min(1, bobW + 0.25) * (1 - adsT);
    }
    // 第一人稱武器：開鏡時藏起；走路晃＋射擊後座；撐傘／死亡時收起
    {
      const w = me.wpn, v = w.view;
      if (v) {
        const hide = me.dead || me.umbHeld || adsT > 0.35; v.visible = !hide;
        if (!hide) {
          const d = w.def, k = w.kick * w.kick * d.kickScale, sw = bobW * bobW;
          const sx = Math.sin(bobPh) * 0.014 * sw, sy = Math.cos(bobPh) * 0.012 * sw;
          v.position.set(d.hip[0] + k * 0.025 + sx, d.hip[1] + k * 0.05 + sy, d.hip[2] + k * 0.1);
          v.rotation.set(d.hipRot[0] - k * 0.32, d.hipRot[1] + sx * 0.4, d.hipRot[2] + k * 0.06);
        }
      }
    }
    cam.rotation.set(pt, me.yaw, roll); root.classList.toggle('dead', me.dead);
    if (msgT > 0) { msgT -= dt; if (msgT <= 0) q('dmMsg').textContent = ''; }
    if (markT > 0) { markT -= dt; if (markT <= 0) q('dmMark').style.opacity = '0'; }
    if (hsT > 0) { hsT -= dt; if (hsT <= 0) q('dmHs').classList.remove('on'); }
    if ((hudT -= dt) <= 0) { hud(); hudT = 0.1; }
    renderer.render(scene, cam);
  }
  loop();

  function teardown() {
    cancelAnimationFrame(raf); removeEventListener('keydown', kd); removeEventListener('keyup', ku); removeEventListener('resize', resize); removeEventListener('blur', blur); removeEventListener('mouseup', mu);
    document.removeEventListener('pointerlockchange', plc); if (document.pointerLockElement === canvas) document.exitPointerLock();
    renderer.dispose(); root.remove(); active = false; delete (window as any).__dm;
  }
  function requestExit() {
    if (document.pointerLockElement) document.exitPointerLock();
    const tip = roundOver
      ? '確定要離開死鬥？'
      : '確定要離開死鬥？本局將直接結束，不會結算獎勵。';
    if (!confirm(tip)) return;
    exit();
  }
  function exit() {
    teardown(); onExit();
  }
  function replay() {
    const cfg = { mode: match.mode, botCount: match.botCount, arenaId: match.arenaId, durationSec: match.durationSec };
    const umb = U, done = onExit;
    // 再來一次：延續本局模式／人數／場地／時長，以及目前裝備的槍
    umb.equippedWeapon = me.wpn.def.id;
    umb.setEquippedWeapon(me.wpn.def.id);
    teardown();
    // 同一幀清完再開，避免 active 卡死
    queueMicrotask(() => openDeathmatch(umb, done, cfg));
  }
  // 測試掛勾
  (window as any).__dm = { fighters, shells, me, pick, equipWeapon, WEAPON_DEFS, input: { keys, joy, setSprint: (v: boolean) => { sprint = v; } }, fireDown, fireUp, fireHeldN: () => fireHeld, DSv, assistK, touchLook, get voices() { return voices; }, bloodLive: () => Array.from(bl).filter(x => x > 0).length, bars: () => fighters.map(f => f.hpBar?.g.visible ?? null), openUmb, closeUmb, throwShell, update, exit, replay, renderBoard, launchPitch, get now() { return now; } };
}

