import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { access, readFile } from "node:fs/promises";
import { join } from "node:path";
import { exercises } from "../src/data";
import manifest from "../public/assets/motion/gymvisual/media-manifest.json";
import coachingManifest from "../public/assets/coaching-loops/media-manifest.json";

const approvedAssetIds = new Set(manifest.assets.map((asset) => asset.assetId));
const manifestMappings = manifest.assets.flatMap((asset) => asset.mappings.map((mapping) => ({ ...mapping, assetId: asset.assetId })));
const manifestMappingByExercise = new Map(manifestMappings.map((mapping) => [mapping.exerciseId, mapping]));
const usedAssetIds = new Set<string>();
const demos = exercises.flatMap((exercise) => exercise.demoMedia ? [{ exercise, demo: exercise.demoMedia }] : []);
const coachingStillExercises = exercises.filter((exercise) => !exercise.demoMedia);

assert.equal(demos.length, 32, "the reviewed Gym visual set stays mapped");
assert.equal(manifestMappings.length, demos.length, "manifest must contain one mapping per motion exercise");
assert.equal(manifestMappingByExercise.size, demos.length, "manifest exercise mappings must be unique");
assert.ok(coachingStillExercises.length > 0, "whole-body records stay without borrowed Gym visual motion");
for (const exercise of coachingStillExercises) {
  assert.equal(exercise.media.kind, "image");
  assert.equal(exercise.media.clinicalReviewStatus, "pending");
  assert.equal(exercise.media.src.endsWith("whole-body-placeholder.svg"), false, `${exercise.id} must not use the shared placeholder`);
  assert.match(exercise.media.alt, /not clinically reviewed/i);
  assert.doesNotMatch(exercise.media.src, /\/assets\/motion\//, `${exercise.id} must not point its still at another exercise's motion file`);
  await access(join(process.cwd(), "public", exercise.media.src));
}

for (const { exercise, demo } of demos) {
  assert.equal(demo.kind, "motion");
  assert.equal(demo.clinicalReviewStatus, "reviewed", `${exercise.id} must use approved motion`);
  assert.deepEqual(demo.sources.map((source) => source.mimeType), ["video/webm", "video/mp4"], `${exercise.id} must order WebM before MP4`);
  assert.match(demo.changesMade ?? "", /GIF converted to WebM and MP4/);
  assert.match(demo.changesMade ?? "", /no GIF is used at runtime/);
  const expectedPosterSrc = demo.sources[0].src.replace(/\.webm$/, ".jpg");
  assert.equal(demo.posterSrc, expectedPosterSrc, `${exercise.id} must use the matching motion poster`);
  await access(join(process.cwd(), "public", demo.posterSrc));
  for (const source of demo.sources) {
    assert.ok(!source.src.endsWith(".gif"), `${exercise.id} must not use GIF at runtime`);
    await access(join(process.cwd(), "public", source.src));
  }

  assert.equal(demo.creator, "Gym visual", `${exercise.id} must use the approved exercise dataset`);
  const assetId = demo.sources[0].src.split("/").at(-1)?.replace(/\.webm$/, "");
  assert.ok(assetId && approvedAssetIds.has(assetId), `${exercise.id} uses an unapproved Gym visual asset`);
  const manifestMapping = manifestMappingByExercise.get(exercise.id);
  assert.ok(manifestMapping, `${exercise.id} is missing from the media manifest`);
  assert.equal(manifestMapping.assetId, assetId, `${exercise.id} manifest asset mismatch`);
  assert.equal(manifestMapping.visualScope, demo.visualScope, `${exercise.id} manifest scope mismatch`);
  usedAssetIds.add(assetId);
}

assert.deepEqual(usedAssetIds, approvedAssetIds, "all approved Gym visual assets must be used");
assert.deepEqual(new Set(demos.map(({ exercise }) => exercise.id)), new Set(exercises.filter((exercise) => exercise.demoMedia).map((exercise) => exercise.id)), "motion coverage must include every exercise that declares a demonstration");
assert.equal(coachingManifest.schemaVersion, 1);
assert.match(coachingManifest.runtimePolicy, /coaching GIFs/i);
assert.equal(coachingManifest.rightsBasis, "original_project_asset");
const coachingAssets = new Map(coachingManifest.assets.map((asset) => [asset.exerciseId, asset]));
const coachingExercises = exercises.filter((exercise) => exercise.coachingLoop);
assert.equal(coachingExercises.length, coachingAssets.size, "each coaching loop is mapped once");
for (const exercise of coachingExercises) {
  const loop = exercise.coachingLoop;
  assert.ok(loop, exercise.id);
  assert.equal(loop.kind, "coaching-loop");
  assert.equal(loop.clinicalReviewStatus, "pending", `${exercise.id} coaching loop stays unreviewed`);
  assert.equal(loop.visualScope, "generic_pattern");
  assert.match(loop.alt, /not clinically reviewed/i);
  assert.match(loop.attributionText, /Not clinician-reviewed/i);
  assert.equal(loop.creator, "Knee Forward");
  const asset = coachingAssets.get(exercise.id);
  assert.ok(asset, `${exercise.id} is missing from the coaching-loop manifest`);
  assert.equal(asset.clinicalReviewStatus, "pending");
  assert.equal(loop.gifSrc, asset.gif.publicUrl);
  assert.equal(loop.posterSrc, asset.poster.publicUrl);
  for (const file of [asset.gif, asset.poster]) {
    const bytes = await readFile(join(process.cwd(), file.repositoryPath));
    assert.equal(createHash("sha256").update(bytes).digest("hex"), file.sha256, `${file.repositoryPath} hash`);
    assert.equal(bytes.byteLength, file.bytes, `${file.repositoryPath} byte size`);
  }
}

console.log(`Motion catalog verified for ${demos.length} demos, ${usedAssetIds.size} Gym visual assets, and ${coachingExercises.length} coaching loops.`);
