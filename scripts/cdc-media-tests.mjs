import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readdir, readFile, stat } from "node:fs/promises";

const manifestUrl = new URL("../public/assets/motion/media-manifest.json", import.meta.url);
const manifest = JSON.parse(await readFile(manifestUrl, "utf8"));
const seenAssetIds = new Set();
const seenRepositoryPaths = new Set();
const seenPublicUrls = new Set();
const mappings = new Map();
const unmappedAssetIds = new Set();

assert.equal(manifest.schemaVersion, 2);
assert.match(manifest.runtimePolicy, /WebM first.*MP4 fallback/i);
assert.match(manifest.runtimePolicy, /Never serve GIF/i);
assert.ok(Array.isArray(manifest.assets) && manifest.assets.length === 7);

for (const asset of manifest.assets) {
  assert.ok(!seenAssetIds.has(asset.id), `duplicate asset id: ${asset.id}`);
  seenAssetIds.add(asset.id);
  assert.equal(asset.clinicalReviewStatus, "pending", `${asset.id} must remain review-pending`);
  assert.ok(["mapped", "unmapped"].includes(asset.mappingStatus), `${asset.id} mapping status`);

  if (asset.mappingStatus === "mapped") {
    assert.equal(typeof asset.mappedExerciseId, "string", `${asset.id} needs a mapped exercise id`);
    mappings.set(asset.id, asset.mappedExerciseId);
  } else {
    assert.equal(asset.mappedExerciseId, undefined, `${asset.id} must not have a mapped exercise id`);
    unmappedAssetIds.add(asset.id);
  }

  assert.deepEqual(Object.keys(asset.localFiles).sort(), ["mp4", "poster", "webm"]);
  assert.equal(asset.localFiles.webm.mimeType, "video/webm");
  assert.equal(asset.localFiles.mp4.mimeType, "video/mp4");
  assert.equal(asset.localFiles.poster.mimeType, "image/png");

  for (const file of [asset.localFiles.webm, asset.localFiles.mp4, asset.localFiles.poster]) {
    assert.ok(!seenRepositoryPaths.has(file.repositoryPath), `duplicate repository path: ${file.repositoryPath}`);
    seenRepositoryPaths.add(file.repositoryPath);
    assert.ok(!seenPublicUrls.has(file.publicUrl), `duplicate public URL: ${file.publicUrl}`);
    seenPublicUrls.add(file.publicUrl);
    assert.match(file.sha256, /^[a-f0-9]{64}$/, `${file.repositoryPath} SHA-256 format`);

    const fileUrl = new URL(`../${file.repositoryPath}`, import.meta.url);
    const bytes = await readFile(fileUrl);
    assert.equal(createHash("sha256").update(bytes).digest("hex"), file.sha256, `${file.repositoryPath} hash`);
    if (file.bytes !== undefined) {
      const metadata = await stat(fileUrl);
      assert.equal(metadata.size, file.bytes, `${file.repositoryPath} byte size`);
    }
  }
}

assert.deepEqual(mappings, new Map([
  ["lunge", "supported-forward-lunge"],
  ["step-up", "step-up"],
]));
assert.deepEqual(unmappedAssetIds, new Set([
  "hip-abduction",
  "knee-curl",
  "knee-extension",
  "squat",
  "toe-stand",
]));

const publicUrl = new URL("../public/", import.meta.url);
const publicEntries = await readdir(publicUrl, { recursive: true });
const runtimeGifs = publicEntries.filter((entry) => String(entry).toLowerCase().endsWith(".gif"));
for (const entry of runtimeGifs) {
  const normalized = String(entry).split(/[\\/]/).join("/");
  assert.match(normalized, /^assets\/coaching-loops\/[^/]+\.gif$/, `unexpected runtime GIF: ${normalized}`);
}

console.log(`CDC media manifest verified for ${manifest.assets.length} assets. Runtime GIFs are limited to original coaching loops.`);
