import assert from "node:assert/strict";
import { access } from "node:fs/promises";
import { join } from "node:path";
import { exercises } from "../src/data";

const approvedAssetIds = new Set([
  "0585-my33uHU",
  "0628-O95afRA",
  "1377-m0tCHqc",
  "1387-0jp9Rlz",
  "1425-WWD6FzI",
  "2138-H1PESYI",
  "3013-u0cNiij",
  "3119-75Bgtjy",
  "3132-b63ZzGe",
  "3195-UXpKJoq",
  "3561-GibBPPg",
]);
const usedAssetIds = new Set<string>();
const demos = exercises.flatMap((exercise) => exercise.demoMedia ? [{ exercise, demo: exercise.demoMedia }] : []);

assert.equal(demos.length, 13, "catalog must retain exactly thirteen motion demonstrations");

for (const { exercise, demo } of demos) {
  assert.equal(demo.kind, "motion");
  assert.equal(demo.clinicalReviewStatus, "pending", `${exercise.id} must remain review-pending`);
  assert.deepEqual(demo.sources.map((source) => source.mimeType), ["video/webm", "video/mp4"], `${exercise.id} must order WebM before MP4`);
  assert.match(demo.changesMade ?? "", /GIF converted to WebM and MP4/);
  assert.match(demo.changesMade ?? "", /no GIF is used at runtime/);
  const expectedPosterSrc = demo.creator === "Gym visual"
    ? demo.sources[0].src.replace(/\.webm$/, ".jpg")
    : demo.sources[0].src.replace(/\.webm$/, "-poster.png");
  assert.equal(demo.posterSrc, expectedPosterSrc, `${exercise.id} must use the matching motion poster`);
  await access(join(process.cwd(), "public", demo.posterSrc));
  for (const source of demo.sources) {
    assert.ok(!source.src.endsWith(".gif"), `${exercise.id} must not use GIF at runtime`);
    await access(join(process.cwd(), "public", source.src));
  }

  if (demo.creator !== "Gym visual") continue;
  const assetId = demo.sources[0].src.split("/").at(-1)?.replace(/\.webm$/, "");
  assert.ok(assetId && approvedAssetIds.has(assetId), `${exercise.id} uses an unapproved Gym visual asset`);
  usedAssetIds.add(assetId);
}

assert.deepEqual(usedAssetIds, approvedAssetIds, "all approved Gym visual assets must be used");
assert.deepEqual(
  new Set(demos.map(({ exercise }) => exercise.id)),
  new Set([
    "bridge",
    "bridge-march",
    "lateral-band-walk",
    "single-leg-hamstring-curl-machine",
    "single-leg-knee-extension-machine",
    "single-leg-press",
    "squat",
    "standing-wall-calf-stretch",
    "standing-single-leg-heel-raise",
    "stationary-bike",
    "step-up",
    "supported-forward-lunge",
    "supported-mini-squat",
  ]),
  "motion demonstrations must be limited to the approved exercise mappings",
);
console.log(`Motion catalog verified for ${demos.length} demos and ${usedAssetIds.size} Gym visual assets.`);
