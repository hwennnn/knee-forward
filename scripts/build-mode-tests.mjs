import assert from "node:assert/strict";
import { readdir, stat } from "node:fs/promises";
import { dirname, join, relative, sep } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const rootDirectory = dirname(dirname(fileURLToPath(import.meta.url)));
const sourceMotionDirectory = join(rootDirectory, "public", "assets", "motion");

async function collectInventory(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const inventory = [];

  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      inventory.push(...await collectInventory(path));
    } else {
      const details = await stat(path);
      inventory.push(`${relative(sourceMotionDirectory, path).split(sep).join("/")}:${details.size}`);
    }
  }

  return inventory.sort();
}

function runBuild(script) {
  const result = spawnSync("npm", ["run", script], {
    cwd: rootDirectory,
    encoding: "utf8",
    stdio: "inherit",
  });
  assert.equal(result.error, undefined, `${script} could not be started`);
  assert.equal(result.status, 0, `${script} failed`);
}

const sourceInventory = await collectInventory(sourceMotionDirectory);
assert.ok(sourceInventory.length > 0, "source motion collection must not be empty");

runBuild("build:local");
assert.deepEqual(
  await collectInventory(sourceMotionDirectory),
  sourceInventory,
  "local build must not modify source motion assets",
);

runBuild("build");
assert.deepEqual(
  await collectInventory(sourceMotionDirectory),
  sourceInventory,
  "production build must not modify source motion assets",
);

console.log("Local and production build-mode boundaries verified without modifying source motion assets.");
