import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readdir, readFile, stat } from "node:fs/promises";

const manifestUrl = new URL("../public/assets/motion/gymvisual/media-manifest.json", import.meta.url);
const manifest = JSON.parse(await readFile(manifestUrl, "utf8"));
const seenAssetIds = new Set();
const seenLocalUrls = new Set();
const mappedAssetIds = new Set();

assert.equal(manifest.schemaVersion, 2);
assert.equal(manifest.rightsBasis, "user_confirmed_approval");
assert.match(manifest.runtimePolicy, /WebM first.*MP4 fallback/i);
assert.match(manifest.runtimePolicy, /Never serve GIF/i);
assert.ok(Array.isArray(manifest.assets) && manifest.assets.length === 11);

for (const asset of manifest.assets) {
  assert.ok(!seenAssetIds.has(asset.assetId), `duplicate asset id: ${asset.assetId}`);
  seenAssetIds.add(asset.assetId);
  assert.equal(asset.attributionText, "© Gym visual - https://gymvisual.com/");
  assert.equal(asset.clinicalReviewStatus, "pending");
  assert.ok(["mapped", "unmapped"].includes(asset.mappingStatus));
  assert.ok(["exact_variation", "generic_pattern", "research_only"].includes(asset.visualScope));
  assert.match(asset.sourceGifArchivePath, /^work\/source-motion-gifs\/gymvisual\/.*\.gif$/);

  if (asset.mappingStatus === "mapped") {
    mappedAssetIds.add(asset.assetId);
    assert.ok(["exact_variation", "generic_pattern"].includes(asset.visualScope));
    assert.ok(asset.mappedExerciseId);
  } else {
    assert.equal(asset.visualScope, "research_only");
    assert.equal(asset.mappedExerciseId, undefined);
  }

  assert.deepEqual(Object.keys(asset.localFiles).sort(), ["mp4", "poster", "webm"]);
  assert.equal(asset.localFiles.webm.mimeType, "video/webm");
  assert.equal(asset.localFiles.mp4.mimeType, "video/mp4");
  assert.equal(asset.localFiles.poster.mimeType, "image/jpeg");

  for (const file of [asset.localFiles.webm, asset.localFiles.mp4, asset.localFiles.poster]) {
    assert.ok(!seenLocalUrls.has(file.publicUrl), `duplicate local URL: ${file.publicUrl}`);
    seenLocalUrls.add(file.publicUrl);
    const fileUrl = new URL(`../${file.repositoryPath}`, import.meta.url);
    const bytes = await readFile(fileUrl);
    const metadata = await stat(fileUrl);
    assert.equal(metadata.size, file.bytes, `${file.repositoryPath} byte size`);
    assert.equal(createHash("sha256").update(bytes).digest("hex"), file.sha256, `${file.repositoryPath} hash`);
  }
}

assert.deepEqual(mappedAssetIds, new Set([
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
]));

const runtimeMotionUrl = new URL("../public/assets/motion/", import.meta.url);
const runtimeEntries = await readdir(runtimeMotionUrl, { recursive: true });
const runtimeGifs = runtimeEntries.filter((entry) => entry.toLowerCase().endsWith(".gif"));
assert.deepEqual(runtimeGifs, [], `runtime GIF files found: ${runtimeGifs.join(", ")}`);

console.log(`Gym visual media manifest verified for ${manifest.assets.length} assets with zero runtime GIFs.`);
