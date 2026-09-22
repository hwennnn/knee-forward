import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { corePrehabExerciseIds, defaultPrehabDoses, exercises, rehabPhases, routines, sourceMetadata } from "../src/data";

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

assert.equal(exercises.length, 32, "catalog should contain the 32 reviewed exercise records");
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

assert.deepEqual(defaultPrehabDoses, {
  "heel-slide": { sets: 2, reps: 15, loadKg: null, holdSeconds: null, durationMinutes: null, rangeNote: "Daily ROM. Slow. Stop for sharp medial pinch." },
  "quad-set": { sets: 3, reps: 15, loadKg: null, holdSeconds: null, durationMinutes: null, rangeNote: "Daily. Hard squeeze 2–3s. Pair with heel props outside app if needed." },
  "band-terminal-knee-extension": { sets: 3, reps: 12, loadKg: null, holdSeconds: null, durationMinutes: null, rangeNote: "TKE. Band behind the knee. Soft finish. Stop if the knee snaps backward." },
  "straight-leg-raise": { sets: 3, reps: 12, loadKg: null, holdSeconds: null, durationMinutes: null, rangeNote: "Daily/home. No quad lag. Right (affected) side." },
  "bridge": { sets: 3, reps: 12, loadKg: null, holdSeconds: null, durationMinutes: null, rangeNote: "Home band days OK with band above knees." },
  "lateral-band-walk": { sets: 3, reps: 12, loadKg: null, holdSeconds: null, durationMinutes: null, rangeNote: "Home band day. Short steps, upright torso." },
  "single-leg-balance": { sets: 3, reps: null, loadKg: null, holdSeconds: 30, durationMinutes: null, rangeNote: "Soft knee. Brace if wobbly. Right side first if stable enough." },
  "single-leg-press": { sets: 3, reps: 10, loadKg: null, holdSeconds: null, durationMinutes: null, rangeNote: "Gym. Bilateral OK. Stop ~45–60° bend. Feet mid-high. Moderate load." },
  "single-leg-knee-extension-machine": { sets: 3, reps: 12, loadKg: null, holdSeconds: null, durationMinutes: null, rangeNote: "Gym. Light–moderate. Smooth mid-range. Stop if anterior/medial bite." },
  "single-leg-hamstring-curl-machine": { sets: 3, reps: 12, loadKg: null, holdSeconds: null, durationMinutes: null, rangeNote: "Gym. Controlled both directions." },
  squat: { sets: 3, reps: 10, loadKg: null, holdSeconds: null, durationMinutes: null, rangeNote: "Gym. MINI only ~45° max. High box OK. No deep squat. Meniscus protection." },
  "standing-single-leg-heel-raise": { sets: 3, reps: 12, loadKg: null, holdSeconds: null, durationMinutes: null, rangeNote: "Gym or home. Progress bilateral→single if quiet knee." },
  "standing-hip-abduction-external-rotation-fire-hydrant": { sets: 3, reps: 12, loadKg: null, holdSeconds: null, durationMinutes: null, rangeNote: "Gym/home. Support as needed." },
  "modified-single-leg-deadlift": { sets: 3, reps: 8, loadKg: null, holdSeconds: null, durationMinutes: null, rangeNote: "Gym. Light hinge. Soft knees. Hip-dominant, not deep knee bend." },
  "stationary-bike": { sets: null, reps: null, loadKg: null, holdSeconds: null, durationMinutes: 20, rangeNote: "Primary cardio. Easy–moderate. Seat high. Prefer over steep treadmill incline." },
});

console.log(`Exercise catalog verified for ${exercises.length} records, including ${Object.keys(generatedStillHashes).length} generated stills.`);
