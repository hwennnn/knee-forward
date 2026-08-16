import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readdir, readFile, stat } from "node:fs/promises";

const manifestUrl = new URL("../public/assets/motion/gymvisual/media-manifest.json", import.meta.url);
const manifest = JSON.parse(await readFile(manifestUrl, "utf8"));
const seenAssetIds = new Set();
const seenLocalUrls = new Set();
const mappedAssetIds = new Set();

assert.equal(manifest.schemaVersion, 3);
assert.equal(manifest.rightsBasis, "user_confirmed_approval");
assert.match(manifest.runtimePolicy, /WebM first.*MP4 fallback/i);
assert.match(manifest.runtimePolicy, /Never serve GIF/i);
assert.ok(Array.isArray(manifest.assets) && manifest.assets.length === 27);

for (const asset of manifest.assets) {
  assert.ok(!seenAssetIds.has(asset.assetId), `duplicate asset id: ${asset.assetId}`);
  seenAssetIds.add(asset.assetId);
  assert.equal(asset.attributionText, "© Gym visual - https://gymvisual.com/");
  assert.equal(asset.clinicalReviewStatus, "reviewed");
  assert.equal(asset.mappingStatus, "mapped");
  assert.ok(Array.isArray(asset.mappings) && asset.mappings.length > 0);
  assert.match(asset.sourceGifArchivePath, /^work\/source-motion-gifs\/gymvisual\/.*\.gif$/);

  mappedAssetIds.add(asset.assetId);
  for (const mapping of asset.mappings) {
    assert.ok(mapping.exerciseId);
    assert.ok(["exact_variation", "generic_pattern"].includes(mapping.visualScope));
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

assert.equal(mappedAssetIds.size, 27);
assert.equal(manifest.assets.flatMap((asset) => asset.mappings).length, 32);

const runtimeMotionUrl = new URL("../public/assets/motion/", import.meta.url);
const runtimeEntries = await readdir(runtimeMotionUrl, { recursive: true });
const runtimeGifs = runtimeEntries.filter((entry) => entry.toLowerCase().endsWith(".gif"));
assert.deepEqual(runtimeGifs, [], `runtime GIF files found: ${runtimeGifs.join(", ")}`);

console.log(`Gym visual media manifest verified for ${manifest.assets.length} assets with zero runtime GIFs.`);
