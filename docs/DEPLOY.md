# Deploy

Production is the static site at `https://knee.hwendev.com`. Houman's VPS deploys from the tracked branch. Pushing that branch is the release. This repo does not store hosting tokens, and a cloud agent must not merge to the tracked branch or force-push.

## Build

```bash
npm ci
npm test
npm run build
```

`npm run build` typechecks, writes `dist/`, copies the Today / Plan / Learn / Progress shells, generates `sw.js`, and checks that motion files are present and not precached.

Optional Supabase values are build-time `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. Omit them and the built site stays guest-only. See [SUPABASE.md](SUPABASE.md).

## Cache headers

`public/_headers` is copied into `dist/` for hosts that understand Cloudflare-style header files:

- `/assets/*` — one year, immutable (Vite fingerprints these files)
- `/`, `/index.html`, `/sw.js`, and the tab folders — `no-cache` so a new deploy is picked up

If the VPS serves `dist/` with its own header config, match that policy. Do not cache `index.html` or `sw.js` for a year.

## What not to do

Do not deploy with a guessed API token, Wrangler login, or force-push. Do not commit `.env.local`.
