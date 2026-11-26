import { test } from 'vitest';
import assert from 'node:assert/strict';
import { makePet, petRidesHead } from './pets.ts';
import {
  GROUND_PET_WORK_CLEAR,
  SHED_SEATED_WORK,
  PLAZA_SEATED_WORK,
  REMOTE_SEATED_BOWL,
  REMOTE_SEATED_BASIN,
  seatedGroundPetSpot,
  legacySeatedGroundPetSpot,
  workClearance,
  inFpSeatedView,
  ownPetAnchorVisible,
  type FpSeatedCam,
} from './petSeat.ts';

const GROUND_IDS = ['pt_akang', 'pt_apo', 'pt_amei'] as const;
const PET_BODY_Y = 0.12;
const PET_HEAD_Y = 0.26;

const DESK: Pick<FpSeatedCam, 'fov' | 'aspect'> = { fov: 78, aspect: 16 / 9 };
const PHONE_L: Pick<FpSeatedCam, 'fov' | 'aspect'> = { fov: 60, aspect: 19.5 / 9 };
const PHONE_P: Pick<FpSeatedCam, 'fov' | 'aspect'> = { fov: 82, aspect: 9 / 16 };

function seatOf(work: typeof SHED_SEATED_WORK | typeof PLAZA_SEATED_WORK) {
  return { x: 0, z: work.seatZ };
}

function camOf(
  work: typeof SHED_SEATED_WORK | typeof PLAZA_SEATED_WORK,
  view: Pick<FpSeatedCam, 'fov' | 'aspect'>,
): FpSeatedCam {
  return { x: 0, y: work.camY, z: work.seatZ, pitch: work.pitch, yaw: 0, ...view };
}

function place(work: typeof SHED_SEATED_WORK | typeof PLAZA_SEATED_WORK, yaw = 0) {
  return seatedGroundPetSpot({
    seat: seatOf(work),
    yaw,
    bowl: { ...work.bowl },
    basin: { ...work.basin },
  });
}

function assertInWorkView(
  work: typeof SHED_SEATED_WORK | typeof PLAZA_SEATED_WORK,
  label: string,
) {
  const spot = place(work);
  const gap = workClearance(spot, work.bowl, work.basin);
  assert.ok(gap.bowlGap >= GROUND_PET_WORK_CLEAR - 1e-9, `${label} bowl gap ${gap.bowlGap}`);
  assert.ok(gap.basinGap >= GROUND_PET_WORK_CLEAR - 1e-9, `${label} basin gap ${gap.basinGap}`);
  // 在玩家右側、比肉碗更靠近自己（畫面偏下），不要擋到左側臉盆
  assert.ok(spot.x > 0, `${label} should sit on the player's right`);
  assert.ok(spot.z > work.bowl.z, `${label} should sit toward the player from the bowl`);
  assert.ok(spot.x > work.basin.x + work.basin.r, `${label} must stay clear of the left basin`);
  for (const [vname, view] of [['desk', DESK], ['phoneL', PHONE_L], ['phoneP', PHONE_P]] as const) {
    const cam = camOf(work, view);
    assert.equal(inFpSeatedView(cam, { x: spot.x, y: PET_BODY_Y, z: spot.z }), true, `${label} ${vname} body in view`);
    assert.equal(inFpSeatedView(cam, { x: spot.x, y: PET_HEAD_Y, z: spot.z }), true, `${label} ${vname} head in view`);
    assert.equal(inFpSeatedView(cam, { x: work.bowl.x, y: 0.16, z: work.bowl.z }), true, `${label} ${vname} bowl still in view`);
    assert.equal(inFpSeatedView(cam, { x: work.basin.x, y: 0.14, z: work.basin.z }), true, `${label} ${vname} basin still in view`);
  }
}

test('阿康、阿珀、阿妹都是貼地寵物，坐下不站頭上', () => {
  for (const id of GROUND_IDS) {
    const mesh = makePet(id);
    assert.ok(mesh, id);
    assert.equal(!!mesh!.userData.groundPet, true, id);
    assert.equal(petRidesHead(id), false, id);
  }
  assert.equal(petRidesHead('pt_oyster_baby'), true);
});

test('第一人稱坐下時，本機寵物錨點不再因視角被藏起來', () => {
  assert.equal(ownPetAnchorVisible({ play: true }), true);
  assert.equal(ownPetAnchorVisible({ play: true, paused: false, tut: false, onMg: false, race: false }), true);
  assert.equal(ownPetAnchorVisible({ play: false }), false);
  assert.equal(ownPetAnchorVisible({ play: true, onMg: true }), false);
  assert.equal(ownPetAnchorVisible({ play: true, race: true }), false);
  assert.equal(ownPetAnchorVisible({ play: true, tut: true }), false);
  assert.equal(ownPetAnchorVisible({ play: true, paused: true }), false);
});

test('工寮第一人稱坐下：阿康／阿珀／阿妹在鏡頭右前方入鏡，且不擋臉盆與肉碗', () => {
  assertInWorkView(SHED_SEATED_WORK, 'shed');
});

test('廣場第一人稱坐下：阿康／阿珀／阿妹在鏡頭右前方入鏡，且不擋臉盆與肉碗', () => {
  assertInWorkView(PLAZA_SEATED_WORK, 'plaza');
});

test('舊的右側偏後位置會落到第一人稱鏡頭外（這就是以前看不見的原因之一）', () => {
  for (const [label, work] of [['shed', SHED_SEATED_WORK], ['plaza', PLAZA_SEATED_WORK]] as const) {
    const old = legacySeatedGroundPetSpot(seatOf(work), 0);
    const cam = camOf(work, DESK);
    assert.equal(inFpSeatedView(cam, { x: old.x, y: PET_BODY_Y, z: old.z }), false, `${label} old spot hidden`);
    const now = place(work);
    assert.ok(Math.hypot(now.x - old.x, now.z - old.z) > 0.3, `${label} new spot moved into view`);
  }
});

test('站起來／走動時仍用身後位置，與坐下點不同', () => {
  const seated = place(PLAZA_SEATED_WORK);
  // 走動靜止時身後偏右約 (0.28, +0.45)（相對座位）
  const stand = { x: 0.28, z: PLAZA_SEATED_WORK.seatZ + 0.45 };
  assert.ok(Math.hypot(seated.x - stand.x, seated.z - stand.z) > 0.5);
});

test('玩家朝向旋轉後，寵物仍在其右側、肉碗右前方', () => {
  // yaw=π：朝 +Z，右側為 -X
  const yaw = Math.PI;
  const work = PLAZA_SEATED_WORK;
  const seat = { x: 5, z: 7 };
  const fwdDist = work.seatZ - work.bowl.z;
  const basinFwd = work.seatZ - work.basin.z;
  const bowl = { x: seat.x - work.bowl.x, z: seat.z + fwdDist, r: work.bowl.r };
  const basin = { x: seat.x - work.basin.x, z: seat.z + basinFwd, r: work.basin.r };
  const spot = seatedGroundPetSpot({ seat, yaw, bowl, basin });
  const gap = workClearance(spot, bowl, basin);
  assert.ok(gap.bowlGap >= GROUND_PET_WORK_CLEAR - 1e-9, `rot bowl ${gap.bowlGap}`);
  assert.ok(gap.basinGap >= GROUND_PET_WORK_CLEAR - 1e-9, `rot basin ${gap.basinGap}`);
  assert.ok(spot.x < seat.x, 'pet should be on the player right (-X when facing +Z)');
  assert.ok(spot.z > seat.z, 'pet should be in front of the player (+Z)');
});

test('遠端玩家坐下時，寵物同樣在肉碗右前方、不擋臉盆與碗', () => {
  const spot = seatedGroundPetSpot({
    seat: { x: 0, z: 0 },
    yaw: 0,
    bowl: REMOTE_SEATED_BOWL,
    basin: REMOTE_SEATED_BASIN,
  });
  const gap = workClearance(spot, REMOTE_SEATED_BOWL, REMOTE_SEATED_BASIN);
  assert.ok(gap.bowlGap >= GROUND_PET_WORK_CLEAR - 1e-9, `remote bowl ${gap.bowlGap}`);
  assert.ok(gap.basinGap >= GROUND_PET_WORK_CLEAR - 1e-9, `remote basin ${gap.basinGap}`);
  assert.ok(spot.x > 0, 'remote pet on the right');
  assert.ok(spot.z < 0, 'remote pet in front (local -Z)');
  assert.ok(spot.z > REMOTE_SEATED_BOWL.z, 'remote pet closer to the player than the bowl');
});

test('沒有肉碗時退到右側膝蓋旁，不會落到鏡頭後', () => {
  const seat = { x: 0, z: 2 };
  const spot = seatedGroundPetSpot({ seat, yaw: 0 });
  assert.ok(spot.x > 0);
  assert.ok(spot.z < seat.z);
  const cam = camOf(SHED_SEATED_WORK, DESK);
  assert.equal(inFpSeatedView(cam, { x: spot.x, y: PET_BODY_Y, z: spot.z }), true);
});
