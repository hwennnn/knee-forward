import { copyFile, mkdir } from "node:fs/promises";

const outputDirectory = new URL("../dist/", import.meta.url);
const source = new URL("index.html", outputDirectory);
const pages = ["today", "plan", "learn", "progress"];

for (const page of pages) {
  const directory = new URL(`${page}/`, outputDirectory);
  await mkdir(directory, { recursive: true });
  await copyFile(source, new URL("index.html", directory));
}

console.log(`Generated ${pages.length} static tab pages.`);
