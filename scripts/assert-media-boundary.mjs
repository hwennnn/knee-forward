import assert from "node:assert/strict";
import { access, readdir, readFile } from "node:fs/promises";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const rootDirectory = dirname(dirname(fileURLToPath(import.meta.url)));
const publicMotionDirectory = join(rootDirectory, "public", "assets", "motion");
const builtMotionDirectory = join(rootDirectory, "dist", "assets", "motion");
const serviceWorkerPath = join(rootDirectory, "dist", "sw.js");
const localBuild = process.argv.includes("--local");
const serviceWorker = await readFile(serviceWorkerPath, "utf8");

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

if (!localBuild) {
  assert.equal(await pathExists(builtMotionDirectory), false, "production artifact must not contain pending motion media");
  assert.equal(serviceWorker.includes("/assets/motion/"), false, "production service worker must not reference pending motion media");
  console.log("Production media boundary verified: pending motion files and cache entries are absent.");
} else {
  const sourceFiles = (await collectFiles(publicMotionDirectory)).sort();
  assert.ok(sourceFiles.length > 0, "local motion collection must not be empty");
  for (const sourceFile of sourceFiles) {
    const relativePath = relative(publicMotionDirectory, sourceFile);
    const builtFile = join(builtMotionDirectory, relativePath);
    const publicUrl = `/assets/motion/${relativePath.split(sep).join("/")}`;
    assert.equal(await pathExists(builtFile), true, `local artifact is missing ${publicUrl}`);
    assert.equal(serviceWorker.includes(JSON.stringify(publicUrl)), true, `local service worker is missing ${publicUrl}`);
  }
  console.log(`Local media boundary verified for ${sourceFiles.length} motion files.`);
}
