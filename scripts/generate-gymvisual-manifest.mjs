import { createHash } from "node:crypto";
import { readFile, stat, writeFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const upstreamCommit = "7455efae41b330c265e7cd4b78dfa848e7ce5ebd";
const dataset = JSON.parse(await readFile(new URL("work/exercises-dataset-upstream/data/exercises.json", root), "utf8"));

const mappings = {
  "0020-xAySMB0": [["single-leg-balance", "generic_pattern"]],
  "0381-SSsBDwB": [["supported-reverse-lunge", "generic_pattern"]],
  "0411-H6ybluc": [["box-assisted-single-leg-squat", "generic_pattern"]],
  "0585-my33uHU": [["single-leg-knee-extension-machine", "generic_pattern"], ["quad-set", "generic_pattern"], ["seated-knee-extension", "generic_pattern"]],
  "0597-CHpahtl": [["standing-hip-abduction-external-rotation-fire-hydrant", "generic_pattern"]],
  "0628-O95afRA": [["lateral-band-walk", "exact_variation"]],
  "0710-7WaDzyL": [["supported-standing-hip-abduction", "generic_pattern"]],
  "0730-LNE3wfo": [["heel-slide", "generic_pattern"]],
  "0795-C5jncD2": [["supported-standing-knee-curl", "generic_pattern"]],
  "1002-bbLR7fB": [["straight-leg-raise", "generic_pattern"]],
  "1008-d5bTEPV": [["step-up", "generic_pattern"], ["supported-lateral-step-down", "generic_pattern"]],
  "1368-uL9CsKm": [["ankle-pump", "generic_pattern"]],
  "1373-bJYHBIN": [["supported-double-leg-calf-raise", "exact_variation"]],
  "1377-m0tCHqc": [["standing-wall-calf-stretch", "exact_variation"]],
  "1387-0jp9Rlz": [["standing-single-leg-heel-raise", "exact_variation"]],
  "1425-WWD6FzI": [["single-leg-press", "exact_variation"]],
  "1459-rR0LJzx": [["bilateral-romanian-deadlift", "generic_pattern"]],
  "2138-H1PESYI": [["stationary-bike", "exact_variation"]],
  "2805-daBmy1Y": [["modified-single-leg-deadlift", "generic_pattern"]],
  "3007-Y1MsI1l": [["band-terminal-knee-extension", "generic_pattern"]],
  "3013-u0cNiij": [["bridge", "exact_variation"], ["heel-dig-bridge-isometric", "generic_pattern"]],
  "3119-75Bgtjy": [["squat", "exact_variation"]],
  "3132-b63ZzGe": [["supported-mini-squat", "exact_variation"], ["chair-sit-to-stand", "generic_pattern"]],
  "3195-UXpKJoq": [["single-leg-hamstring-curl-machine", "generic_pattern"]],
  "3470-kMzUs9Y": [["supported-forward-lunge", "generic_pattern"]],
  "3543-wfotm7S": [["clinician-cleared-double-leg-landing", "generic_pattern"]],
  "3561-GibBPPg": [["bridge-march", "exact_variation"]],
};

async function fileRecord(assetId, extension, mimeType) {
  const repositoryPath = `public/assets/motion/gymvisual/${assetId}.${extension}`;
  const bytes = await readFile(new URL(repositoryPath, root));
  return {
    repositoryPath,
    publicUrl: `/assets/motion/gymvisual/${assetId}.${extension}`,
    mimeType,
    bytes: (await stat(new URL(repositoryPath, root))).size,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  };
}

const assets = [];
for (const [assetId, exerciseMappings] of Object.entries(mappings)) {
  const datasetExerciseId = assetId.slice(0, 4);
  const record = dataset.find((exercise) => exercise.id === datasetExerciseId);
  if (!record) throw new Error(`Dataset record not found for ${assetId}`);
  assets.push({
    assetId,
    datasetExerciseId,
    mediaId: record.media_id,
    sourceTitle: record.name,
    sourceGifPath: record.gif_url,
    sourceGifArchivePath: `work/source-motion-gifs/gymvisual/${assetId}.gif`,
    sourcePosterPath: record.image,
    sourcePageUrl: `https://github.com/hasaneyldrm/exercises-dataset/blob/${upstreamCommit}/videos/${assetId}.gif`,
    attributionText: "© Gym visual - https://gymvisual.com/",
    mappingStatus: "mapped",
    mappings: exerciseMappings.map(([exerciseId, visualScope]) => ({ exerciseId, visualScope })),
    clinicalReviewStatus: "reviewed",
    localFiles: {
      webm: await fileRecord(assetId, "webm", "video/webm"),
      mp4: await fileRecord(assetId, "mp4", "video/mp4"),
      poster: await fileRecord(assetId, "jpg", "image/jpeg"),
    },
  });
}

const manifest = {
  schemaVersion: 3,
  collection: "Knee Forward Gym visual motion demonstrations",
  retrievedAt: "2026-08-16",
  upstreamRepository: "https://github.com/hasaneyldrm/exercises-dataset",
  upstreamCommit,
  creator: "Gym visual",
  rightsBasis: "user_confirmed_approval",
  rightsNote: "The project owner confirmed approval for public use and all exercise mappings on 2026-08-16. Preserve the underlying approval in the project's legal records.",
  termsUrl: "https://gymvisual.com/content/3-terms-and-conditions-of-use",
  attributionText: "© Gym visual - https://gymvisual.com/",
  clinicalDisclaimer: "These animations are orientation aids, not prescriptions or clearance. General-pattern mappings are labeled in the interface and the clinician-selected setup, range, load, support, and timing take priority.",
  changesMade: "Original 180 x 180 GIFs are archived outside runtime. Runtime derivatives use WebM with MP4 fallback and retain the source JPG poster.",
  runtimePolicy: "WebM first with MP4 fallback and a JPG poster. Never serve GIF at runtime. Motion is delivered on demand and excluded from service-worker precaching.",
  assets,
};

await writeFile(new URL("public/assets/motion/gymvisual/media-manifest.json", root), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Generated Gym visual manifest for ${assets.length} assets and ${assets.flatMap((asset) => asset.mappings).length} exercise mappings.`);
