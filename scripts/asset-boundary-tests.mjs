import assert from "node:assert/strict";
import { access, readdir, readFile } from "node:fs/promises";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const rootDirectory = dirname(dirname(fileURLToPath(import.meta.url)));
const publicMotionDirectory = join(rootDirectory, "public", "assets", "motion");
const builtMotionDirectory = join(rootDirectory, "dist", "assets", "motion");
const serviceWorkerPath = join(rootDirectory, "dist", "sw.js");
const localBuild = process.argv.includes("--local");

async function pathExists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function collectFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? collectFiles(path) : [path];
  }));
  return nested.flat();
}

function readPrecacheUrls(serviceWorker) {
  const match = serviceWorker.match(/const PRECACHE_URLS = (\[[\s\S]*?\]);/);
  assert.ok(match, "service worker must declare a readable PRECACHE_URLS array");
  return JSON.parse(match[1]);
}

const sourceFiles = (await collectFiles(publicMotionDirectory)).sort();
assert.ok(sourceFiles.length > 0, "source motion collection must not be empty");

const serviceWorker = await readFile(serviceWorkerPath, "utf8");
const precacheUrls = readPrecacheUrls(serviceWorker);

assert.ok(precacheUrls.includes("/index.html"), "service worker must precache the app shell");
assert.ok(
  precacheUrls.some((url) => url.startsWith("/assets/exercise-stills/")),
  "service worker must keep non-motion still assets in the precache",
);
assert.equal(
  precacheUrls.some((url) => url.startsWith("/assets/motion/")),
  false,
  "service worker precache must exclude optional motion media",
);
assert.equal(
  serviceWorker.includes("/assets/motion/"),
  false,
  "generated service worker must not contain motion asset URLs",
);
assert.ok(
  serviceWorker.includes('event.request.destination === "video"'),
  "video requests must bypass service-worker caching so native range requests reach the network",
);

if (localBuild) {
  for (const sourceFile of sourceFiles) {
    const relativePath = relative(publicMotionDirectory, sourceFile);
    const publicUrl = `/assets/motion/${relativePath.split(sep).join("/")}`;
    assert.equal(
      await pathExists(join(builtMotionDirectory, relativePath)),
      true,
      `local artifact is missing ${publicUrl}`,
    );
  }

  console.log(`Local media boundary verified: ${sourceFiles.length} motion files are built and none are precached.`);
} else {
  assert.equal(await pathExists(builtMotionDirectory), false, "production artifact must not contain pending motion media");
  console.log("Production media boundary verified: pending motion files and precache entries are absent.");
}
