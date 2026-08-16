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

const sourceFiles = (await collectFiles(publicMotionDirectory)).sort();
assert.ok(sourceFiles.length > 0, "motion collection must not be empty");
for (const sourceFile of sourceFiles) {
  const relativePath = relative(publicMotionDirectory, sourceFile);
  const builtFile = join(builtMotionDirectory, relativePath);
  const publicUrl = `/assets/motion/${relativePath.split(sep).join("/")}`;
  assert.equal(await pathExists(builtFile), true, `${localBuild ? "local" : "production"} artifact is missing ${publicUrl}`);
  assert.equal(serviceWorker.includes(JSON.stringify(publicUrl)), false, `service worker must not precache ${publicUrl}`);
}
console.log(`${localBuild ? "Local" : "Production"} media delivery verified for ${sourceFiles.length} approved motion files.`);
