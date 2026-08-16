import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join, relative, sep } from "node:path";

const outputDirectory = new URL("../dist/", import.meta.url);
async function collectFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? collectFiles(path) : [path];
  }));
  return nested.flat();
}

const absoluteOutputPath = outputDirectory.pathname;
const buildFiles = (await collectFiles(absoluteOutputPath))
  .filter((file) => !file.endsWith(`${sep}sw.js`))
  .sort();
const publicPaths = buildFiles
  .map((file) => `/${relative(absoluteOutputPath, file).split(sep).join("/")}`)
  .filter((publicPath) => !publicPath.startsWith("/assets/motion/"));
const buildHash = createHash("sha256");

for (const publicPath of publicPaths) {
  buildHash.update(publicPath);
  buildHash.update(await readFile(join(absoluteOutputPath, publicPath.slice(1))));
}

const cacheName = `knee-forward-${buildHash.digest("hex").slice(0, 12)}`;
const worker = `const CACHE_NAME = ${JSON.stringify(cacheName)};
const PRECACHE_URLS = ${JSON.stringify(publicPaths, null, 2)};

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key.startsWith("knee-forward-") && key !== CACHE_NAME).map((key) => caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  // Leave streamed motion requests to the browser and network. This preserves
  // native byte-range handling and avoids storing large optional media at runtime.
  const requestPath = new URL(event.request.url).pathname;
  if (event.request.destination === "video" || /\\.(?:gif|mp4|webm)$/i.test(requestPath)) return;

  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.put("/index.html", copy)));
          }
          return response;
        })
        .catch(() => caches.match("/index.html"))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => cached ?? fetch(event.request).then((response) => {
      if (!response.ok) return response;
      const copy = response.clone();
      event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy)));
      return response;
    }))
  );
});
`;

await writeFile(new URL("sw.js", outputDirectory), worker);
console.log(`Generated ${cacheName} with ${publicPaths.length} precached files.`);
