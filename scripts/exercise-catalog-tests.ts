import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { corePrehabExerciseIds, defaultPrehabDoses, exercises, previousSeededPrehabDoses, previousWholeBodyDoses, previousWholeBodyExerciseIds, rehabPhases, routines, sourceMetadata } from "../src/data";

const expectedPanelHashes = {
  "/assets/exercise-panels/foundations-0.webp": "1dd28c6eee6af70b34f57f076b950fe91ffa4df043ba5cc18eacbba0723c5c7a",
  "/assets/exercise-panels/foundations-1.webp": "ba3c5347eec8ab50fdb55c82c4138d43b2a915446cabef34eef4af3b930ca164",
  "/assets/exercise-panels/foundations-2.webp": "f2d5e8b8cd78073977220630004ea5a5f65d2c634708c4c2545298b9d962bde0",
  "/assets/exercise-panels/foundations-3.webp": "1b89b795374f351bd6c7d879a3399ab7e2140993242df77284fb81751cc60ae7",
  "/assets/exercise-panels/foundations-4.webp": "fdce78602e64f780a39b8c2eecb08db40c6fc485ae3bb5040e989adea6214e96",
  "/assets/exercise-panels/foundations-5.webp": "1f15a9e595b5f26b731a77fa2571937f4d5ff5ceda80d320c8697de754ceae3c",
  "/assets/exercise-panels/foundations-6.webp": "c5c5bd1bee3e8f30ece0e85155569643e07d2f4b4754d668b39b75ea1ae1dd90",
  "/assets/exercise-panels/foundations-7.webp": "e7cd6eb3cc7dd7207c19521e21832d747e22ca6c941f83e0db3179a114d49c92",
  "/assets/exercise-panels/strength-0.webp": "958d8c0eb25cc9db49366cc2f2ac8de5d6dc491816b3d41bf9f6e485fdbd497e",
  "/assets/exercise-panels/strength-1.webp": "49c503b814971492ac06139e1d8ec660e2be1e2d277fe310e2c679450a2ba825",
  "/assets/exercise-panels/strength-2.webp": "648eb998ab36137e5fb11c225390cb166a460a44cb04b5c40dcc6c594f5aa988",
  "/assets/exercise-panels/strength-3.webp": "4cc856ab07c92c771ac3146a4de691368a4131bfffe219685cb4d618012573b3",
  "/assets/exercise-panels/strength-4.webp": "fa068ec20dea98462650fa05179da61261676d7026ef0cc8eb6de8fdbffae93f",
  "/assets/exercise-panels/strength-5.webp": "81bd7e9b16504b3e7be1727dbb7a5c9a07264f53eadb2809a3f2acaefeb7d2da",
  "/assets/exercise-panels/strength-6.webp": "a269d2d87aa6ce0bc3904c124005e452a36c9a0856953eca3cc54421ab53523d",
  "/assets/exercise-panels/strength-7.webp": "5e33a92f84070bfede04478f3b1c402cc3fbc64b125cc84cfe5c8d48cfb5c24f",
} as const;

const webpDimensions = (bytes: Buffer) => {
  assert.equal(bytes.subarray(0, 4).toString("ascii"), "RIFF", "WebP must use a RIFF container");
  assert.equal(bytes.subarray(8, 12).toString("ascii"), "WEBP", "WebP container signature is missing");
  assert.equal(bytes.subarray(12, 16).toString("ascii"), "VP8 ", "expected lossy VP8 WebP encoding");
  return {
    width: bytes.readUInt16LE(26) & 0x3fff,
    height: bytes.readUInt16LE(28) & 0x3fff,
  };
};

const spritePaths = new Set(exercises.flatMap((exercise) => exercise.media.kind === "sprite" ? [exercise.media.src] : []));
assert.equal(spritePaths.size, 16, "catalog should use all 16 reviewed illustration panels");
for (const spritePath of spritePaths) {
  assert.ok(spritePath in expectedPanelHashes, `untracked illustration panel: ${spritePath}`);
  const localPath = resolve("public", spritePath.slice(1));
  assert.ok(existsSync(localPath), `missing illustration panel: ${spritePath}`);
  const bytes = readFileSync(localPath);
  assert.deepEqual(webpDimensions(bytes), { width: 512, height: 512 }, `${spritePath} must be 512 × 512`);
  assert.equal(createHash("sha256").update(bytes).digest("hex"), expectedPanelHashes[spritePath as keyof typeof expectedPanelHashes], `${spritePath} checksum changed`);
}

const generatedStillHashes = {
  "seated-knee-extension": "cf78d8095c95e60d6b907005a7625d73f8ad4ee11b6bc149dcd0e96bb830e2ee",
  "supported-standing-knee-curl": "dd4206eca27ca577847bd5d2f3cb4d2a81cad98119b3e8ba9ae013cb49ddc412",
  "supported-double-leg-calf-raise": "8a36ec80ff66ed27388fe10f8ada22b0a04246ceb316106e2b2102cd0562ca78",
  "supported-standing-hip-abduction": "6841dd448096d4caee6277ad5012daaff7d3508ca9ef9222490ef605f1a42acc",
  "supported-forward-lunge": "98a3f0eb14e1a36ce2d1c5b656e55aecfc424a7a1bbf20aa8d3487ee7227a5f6",
  "band-terminal-knee-extension": "f845a733c6677dae39607768f4b852869a43d6d3b29806f20682e7d6a43771d9",
  "chair-sit-to-stand": "d8b967a47256f5d706641d2ac088c79dfe7863dc0737c1cf9de69c670d2d0f24",
  "supported-lateral-step-down": "00a31d74e037095c9dc41657228abdc938f4baa1ac17df1023f448285c314962",
  "box-assisted-single-leg-squat": "6af43232a2f12137fbf79fc0c6d9b86ee47ff1a4f3daec25e732b961f991119f",
  "bilateral-romanian-deadlift": "55498b6ccaf4c9dc21f22406d3d2a5f0823b35ecad46297bc87cf6e31cbee14e",
  "heel-dig-bridge-isometric": "cb0058b68a034db409d6b32a134551c83aad50d7c67edf6ae892e76be068a7dd",
  "supported-reverse-lunge": "24dd3fd2b375167f37b78c85daec68c842b50df2f7e7c3b435667a89b21ab7cd",
  "double-leg-landing": "f13bbf336f1c71abcf795add39d322bcb938b091b6322151e83afcdff9e1136a",
  "supported-mini-squat": "f4c070d533ad015483bef1717e14a98f95b696f1b4972dc76e9e902a1745090f",
  "standing-wall-calf-stretch": "88f1e2158a12fb5b43fead478cfb97b354c59ce4e64c8f8da017c38ba4cf7d98",
  "bridge-march": "fb8c3842e8457f86170c8fe09e7e7f0ef80947845e49df7dd241f2921f8fdf1c",
} as const;

for (const [slug, expectedHash] of Object.entries(generatedStillHashes)) {
  const src = `/assets/exercise-stills/${slug}.webp`;
  const bytes = readFileSync(resolve("public", src.slice(1)));
  assert.deepEqual(webpDimensions(bytes), { width: 1024, height: 1024 }, `${src} must be 1024 × 1024`);
  assert.equal(createHash("sha256").update(bytes).digest("hex"), expectedHash, `${src} checksum changed`);
}

const exerciseIds = new Set<string>();
const phaseIds = new Set(rehabPhases.map((phase) => phase.id));
const sourceIds = new Set(sourceMetadata.map((source) => source.id));

for (const exercise of exercises) {
  assert.equal(exerciseIds.has(exercise.id), false, `duplicate exercise id: ${exercise.id}`);
  exerciseIds.add(exercise.id);
  assert.notEqual(exercise.media.kind, "motion", `${exercise.id} primary media must be still`);
  assert.ok(exercise.cues.length > 0, `${exercise.id} needs form cues`);
  assert.ok(exercise.stopSignals.length > 0, `${exercise.id} needs stop signals`);
  assert.ok(exercise.eligiblePhaseIds.length > 0, `${exercise.id} needs phase eligibility`);
  assert.ok(exercise.sourceIds.length > 0, `${exercise.id} needs sources`);
  for (const phaseId of exercise.eligiblePhaseIds) assert.ok(phaseIds.has(phaseId), `${exercise.id} has unknown phase ${phaseId}`);
  for (const sourceId of exercise.sourceIds) assert.ok(sourceIds.has(sourceId), `${exercise.id} has unknown source ${sourceId}`);
}

const educationOnlyExpansion = new Set([
  "chair-sit-to-stand",
  "supported-lateral-step-down",
  "box-assisted-single-leg-squat",
  "bilateral-romanian-deadlift",
  "heel-dig-bridge-isometric",
  "supported-reverse-lunge",
  "clinician-cleared-double-leg-landing",
  "supported-mini-squat",
  "standing-wall-calf-stretch",
  "bridge-march",
]);

const coachingStillHashes = {
  "machine-chest-press": "4acc094a12dfbaadb90606706416aa11d60813ee1060771130d1e268768b29ab",
  "lat-pulldown": "834bc0cf9baf65d2812d7123e5cae5df3f39266cfc99444983cb37c44416c188",
  "seated-row": "db942c6923e7c0a39ff99c9282c0beb75d78b9d967f25e0c01090ec639386f56",
  "shoulder-press": "7bdd0f77ff444439ab92b83db348b8621b8e9af87ec5d96818a20bde82daafdd",
  "biceps-curl": "1cdd3352765cba236e744ff7c1eba007c13f6ba4b0a89afe3241448cd6807e33",
  "triceps-pressdown": "c073004443e90703acb978063c45c1cbfd0205ddda57655cfab9a2032a398668",
  "dead-bug": "bc9f048c83d14e3f2b5f7327bb916bb429860dc53f00315de62c9c429771208f",
  "side-plank": "a4c21790a756a93d144297caf166f80f5dcc53a4124675eede38982bcbefee43",
  "pallof-press": "6b78f58cd2872ea114d7f340e9c89cfff845031bf6da6ac8e3baf01d4a44975d",
  "band-row": "ba3ce0389feb50b49d5f044031c83d97e53578bf1a88ea554c8358797603787a",
  "band-chest-press": "4b553bf10e69abfb5f22c2628c79e7fe5a44c7cd6b431dae521fabf6f886d115",
  "band-overhead-press": "886694d46b375fad3cb7544dd86201f952180313fd959e9e4c703e2cbb486992",
  "band-biceps-curl": "089e0a8d70a0ddf9b7272d150ca95884ccbfaad2968dc5d45f60f4d608e76ca8",
  "band-triceps-extension": "c747f13b1afab71d65e8ce04e34f8b1b1e4ba934e1ce003dca54bf205e1b5dea",
  "band-clam": "9305305701c57a3767fdf8bd9de70375d2109fbecb7e4f9608e53743e2617c02",
  "cable-face-pull": "3663ec08210cad979c4ccd1694e825fa633bad6130c5f0c13537dc84af151733",
  "reverse-fly": "f78752a8d163403290d1334cea825898cccc7f940a7481c3618145db73887afa",
  "chest-supported-row": "8580a47072ee7a4e73e2cdf76cf740079551f505b7864145673ebb56d08cd8f7",
  "cable-chest-fly": "aa70c2727935a42d98a6d123317ceb6c42007cd59ec8fe6001ff7290b9e1d4b5",
  "straight-arm-pulldown": "0e076dbeb5192841711902ecc2be67d9d6bfc4381c5954323fd3e81e051cb51d",
  "hip-abduction-machine": "a1eb383d3bb1348c29f22681c26fb1e3b7ed032188d01a88fd1318823035c012",
  "seated-calf-raise": "ea50cf68431e9e4cc338627740a5bf7c1dfb44e84f69bd0e3e10471dc90b349f",
  "back-extension": "753f7dab85e11434d6f07c8de7e1a1b4cba87cd040b6872d5682f3db3053ffba",
  "assisted-pull-up": "8ce439122d2ad3684ccffb95f5a0a435efcde4e171a8cf9a50918b482f3c2522",
  "assisted-dip": "0e7685381344f63a5c06fc4f6f3c38d1c4715b60c90eb7f9a0fe1fb9dd87c3eb",
  "supine-band-hip-abduction": "51982ff33eb3bd0964022c91fc091da522fe0dd3f5eb472b4362ee6609fc8c9c",
  "mini-band-good-morning": "114907e68a38c1b308e39899fab596d385b0ad42f3c0d9a7d2ad49b71ca1c832",
} as const;

for (const [slug, expectedHash] of Object.entries(coachingStillHashes)) {
  const src = `/assets/exercise-stills/${slug}.webp`;
  const bytes = readFileSync(resolve("public", src.slice(1)));
  assert.deepEqual(webpDimensions(bytes), { width: 1024, height: 1024 }, `${src} must be 1024 × 1024`);
  assert.equal(createHash("sha256").update(bytes).digest("hex"), expectedHash, `${src} checksum changed`);
}

const wholeBodyCoaching = exercises.filter((exercise) => !exercise.demoMedia);
assert.equal(exercises.filter((exercise) => exercise.demoMedia).length, 32, "the 32 reviewed motion records stay");
assert.equal(wholeBodyCoaching.length, Object.keys(coachingStillHashes).length, "each whole-body record has its own coaching still");
assert.equal(exercises.length, 32 + wholeBodyCoaching.length);
for (const exercise of wholeBodyCoaching) {
  assert.equal(exercise.demoMedia, undefined, `${exercise.id} must not reuse a knee demonstration as if it were this movement`);
  assert.equal(exercise.planEligible === false, false, `${exercise.id} is part of the whole-body plan`);
  assert.equal(exercise.media.kind, "image");
  assert.equal(exercise.media.clinicalReviewStatus, "pending");
  assert.equal(exercise.media.visualScope, "generic_pattern");
  assert.equal(exercise.media.src.endsWith("whole-body-placeholder.svg"), false, `${exercise.id} must not use the shared placeholder`);
  assert.equal(exercise.media.src, `/assets/exercise-stills/${exercise.id}.webp`, `${exercise.id} still must match its own slug`);
  assert.match(exercise.media.alt, /instructional still/i);
  assert.match(exercise.media.alt, /not clinically reviewed/i);
  assert.ok(exercise.id in coachingStillHashes, `${exercise.id} is missing a coaching still checksum`);
}
for (const exerciseId of educationOnlyExpansion) {
  const exercise = exercises.find((candidate) => candidate.id === exerciseId);
  assert.ok(exercise, `missing education-only exercise: ${exerciseId}`);
  assert.equal(exercise.planEligible, false, `${exerciseId} must not enter a plan without an explicit future product decision`);
  assert.equal(routines.some((routine) => routine.items.some((item) => item.exerciseId === exerciseId)), false, `${exerciseId} must not be seeded into a routine`);
  assert.equal(exercise.media.visualScope, "exact_variation", `${exerciseId} generated still must depict the exact named variation`);
}

const prehabRoutine = routines.find((routine) => routine.id === "routine-right-prehab-foundations");
assert.ok(prehabRoutine, "missing the default prehab routine");
assert.equal(prehabRoutine.phaseId, "prehab");
assert.equal(prehabRoutine.status, "draft", "seeded doses stay general guidance until a clinician confirms them in the app");
assert.deepEqual(prehabRoutine.items.map((item) => item.exerciseId), [...corePrehabExerciseIds]);

const bandTerminalKneeExtension = exercises.find((exercise) => exercise.id === "band-terminal-knee-extension");
assert.ok(bandTerminalKneeExtension);
assert.notEqual(bandTerminalKneeExtension.planEligible, false, "band terminal knee extension is part of the default prehab plan");
assert.ok(bandTerminalKneeExtension.eligiblePhaseIds.includes("prehab"));

for (const exerciseId of corePrehabExerciseIds) {
  const exercise = exercises.find((candidate) => candidate.id === exerciseId);
  assert.ok(exercise, `default plan references an unknown exercise: ${exerciseId}`);
  assert.notEqual(exercise.planEligible, false, `${exerciseId} must be plan-eligible`);
  assert.ok(exercise.eligiblePhaseIds.includes("prehab"), `${exerciseId} must be eligible in prehab`);
  const dose = defaultPrehabDoses[exerciseId];
  const recorded = dose.durationMinutes !== null || (dose.sets !== null && (dose.reps !== null || dose.holdSeconds !== null));
  assert.equal(recorded, true, `${exerciseId} needs a seeded dose`);
}

const dailyKneeIds = ["heel-slide", "quad-set", "band-terminal-knee-extension", "straight-leg-raise"] as const;
for (const exerciseId of dailyKneeIds) {
  assert.deepEqual(defaultPrehabDoses[exerciseId], previousSeededPrehabDoses[exerciseId], `${exerciseId} daily knee dose stays protective`);
}
assert.equal(previousWholeBodyDoses["machine-chest-press"].sets, 3, "the previous whole-body snapshot keeps the lighter chest dose");
assert.equal(previousWholeBodyDoses["stationary-bike"].durationMinutes, 20);
assert.equal(previousSeededPrehabDoses["single-leg-press"].sets, 3);
assert.equal(defaultPrehabDoses["single-leg-press"].sets, 4);
assert.equal(defaultPrehabDoses["single-leg-press"].loadKg, null);
assert.match(defaultPrehabDoses["single-leg-press"].rangeNote, /45–60/);
assert.match(defaultPrehabDoses["single-leg-press"].rangeNote, /depth stays shallow/);
assert.equal(defaultPrehabDoses["single-leg-hamstring-curl-machine"].sets, 4);
assert.equal(defaultPrehabDoses.squat.sets, 4);
assert.match(defaultPrehabDoses.squat.rangeNote, /45°/);
assert.match(defaultPrehabDoses.squat.rangeNote, /No deep squat/);
assert.equal(defaultPrehabDoses["modified-single-leg-deadlift"].sets, 4);
assert.match(defaultPrehabDoses["modified-single-leg-deadlift"].rangeNote, /Load the hinge/);
assert.equal(defaultPrehabDoses["machine-chest-press"].sets, 4);
assert.equal(defaultPrehabDoses["machine-chest-press"].reps, 8);
assert.match(defaultPrehabDoses["lat-pulldown"].rangeNote, /1–2/);
assert.equal(defaultPrehabDoses["biceps-curl"].sets, 3);
assert.equal(defaultPrehabDoses["side-plank"].holdSeconds, 40);
assert.equal(defaultPrehabDoses["pallof-press"].reps, 12);
assert.equal(defaultPrehabDoses["band-row"].sets, 4);
assert.equal(defaultPrehabDoses["stationary-bike"].durationMinutes, 30);
assert.equal(defaultPrehabDoses["cable-face-pull"].loadKg, null);
assert.equal(defaultPrehabDoses["assisted-dip"].sets, 3);
for (const exerciseId of ["cable-face-pull", "reverse-fly", "chest-supported-row", "cable-chest-fly", "straight-arm-pulldown", "hip-abduction-machine", "seated-calf-raise", "back-extension", "assisted-pull-up", "assisted-dip", "supine-band-hip-abduction", "mini-band-good-morning"] as const) {
  assert.ok(corePrehabExerciseIds.includes(exerciseId), `${exerciseId} belongs on the default plan`);
  assert.equal(previousWholeBodyExerciseIds.includes(exerciseId), false, `${exerciseId} is new and must not be treated as the previous whole-body seed`);
}
for (const exerciseId of corePrehabExerciseIds) {
  assert.equal(/lunge|jump|sprint|sled|bulgarian/.test(exerciseId), false, `${exerciseId} is outside the knee-safe plan`);
}

console.log(`Exercise catalog verified for ${exercises.length} records, including ${Object.keys(generatedStillHashes).length} knee stills and ${Object.keys(coachingStillHashes).length} coaching stills.`);
