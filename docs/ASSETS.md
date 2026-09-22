# Generated asset record

Knee Forward uses crisp WebP stills as the primary exercise media on Learn cards, Learn detail, and workout screens. Motion is optional and appears only on Learn detail. A still or animation is an orientation aid, not clinical instruction, a prescription, or medical clearance.

## App icon

The original generated icon is saved as `public/assets/knee-forward-icon.png`, with 192 px and 512 px derivatives.

Prompt summary: an original minimal Knee Forward symbol combining a steady forward path and a subtle bent-knee joint motif, flat vector-like treatment, deep blue-green background, restrained lime mark, no text, medical cross, literal bones, logos, or watermark.

## Original 1024 px exercise stills

Sixteen original square stills were generated with OpenAI image generation. The source PNGs are retained under `work/generated-still-sources/`; optimized 1024 px WebP runtime files are under `public/assets/exercise-stills/`:

- `band-terminal-knee-extension.webp`
- `bilateral-romanian-deadlift.webp`
- `box-assisted-single-leg-squat.webp`
- `bridge-march.webp`
- `chair-sit-to-stand.webp`
- `double-leg-landing.webp`
- `heel-dig-bridge-isometric.webp`
- `seated-knee-extension.webp`
- `supported-double-leg-calf-raise.webp`
- `supported-forward-lunge.webp`
- `supported-lateral-step-down.webp`
- `supported-mini-squat.webp`
- `supported-reverse-lunge.webp`
- `supported-standing-hip-abduction.webp`
- `supported-standing-knee-curl.webp`
- `standing-wall-calf-stretch.webp`

These stills are original project assets, but clinical review is pending. Their presence is not medical clearance and does not establish that an exercise, variation, range, load, or phase is appropriate for anyone.

## Exercise panel illustrations

The generated 4 by 2 source sheets remain under `work/source-sprite-sheets/`:

- `exercise-reference-foundations.png`: heel slide, quadriceps set, ankle pump, straight-leg raise, bridge, low step-up, supported single-leg balance, and lateral band walk.
- `exercise-reference-strength.png`: single-leg knee extension, single-leg hamstring curl, single-leg press, controlled squat, supported heel raise, supported standing fire-hydrant variation, supported single-leg deadlift, and stationary bike.

The 16 original 512 px panel PNGs were moved to `work/source-panel-pngs/`. Their optimized runtime derivatives are the 16 files under `public/assets/exercise-panels/`, named `foundations-0.webp` through `foundations-7.webp` and `strength-0.webp` through `strength-7.webp`.

The panels were cropped from the source sheets, centered on individual square canvases, and converted to WebP so the app does not stretch a sheet or expose neighboring panels. They also require physiotherapist review before public distribution.

## Whole-body coaching stills

Each whole-body catalog record has its own 1024 px WebP still under `public/assets/exercise-stills/`, named with the exercise id (`machine-chest-press.webp`, `lat-pulldown.webp`, `seated-row.webp`, `shoulder-press.webp`, `biceps-curl.webp`, `triceps-pressdown.webp`, `dead-bug.webp`, `side-plank.webp`, `pallof-press.webp`, `band-row.webp`, `band-chest-press.webp`, `band-overhead-press.webp`, `band-biceps-curl.webp`, `band-triceps-extension.webp`, `band-clam.webp`, `cable-face-pull.webp`, `reverse-fly.webp`, `chest-supported-row.webp`, `cable-chest-fly.webp`, `straight-arm-pulldown.webp`, `hip-abduction-machine.webp`, `seated-calf-raise.webp`, `back-extension.webp`, `assisted-pull-up.webp`, `assisted-dip.webp`, `supine-band-hip-abduction.webp`, and `mini-band-good-morning.webp`).

These are original instructional stills generated for Knee Forward on 2026-09-22. Source PNGs for the earlier whole-body set are retained under `work/generated-still-sources/whole-body/`. The two short-loop home stills (`supine-band-hip-abduction`, `mini-band-good-morning`) are stick-figure frames; their source PNGs are under `work/generated-still-sources/coaching-loops/`. Runtime files are lossy VP8 WebP. SHA-256 checksums are locked in `scripts/exercise-catalog-tests.ts`.

They are coaching diagrams for orientation. They are not crops of the rehab panels, not Gym visual GIFs, and not CDC clips. `clinicalReviewStatus` is `pending` and `visualScope` is `generic_pattern`, so the card labels them “General reference”. Alt text says they are not clinically reviewed. Do not point these records at a knee-rehab still or at another exercise’s motion file. Do not mark them reviewed unless a clinician reviews the specific image.

The old shared geometric mark remains at `public/assets/exercise-stills/whole-body-placeholder.svg` so older builds can be compared. No current catalog record uses it.

## Mixed-media runtime policy

- Primary media: a crisp WebP still on Learn cards and Learn detail. Today cards and the active workout view play a reviewed Gym visual loop when one is mapped. Otherwise they show the still.
- Optional motion: Learn detail, after the still. Today and workout cards autoplay a muted loop.
- Gym visual and CDC runtime motion: WebM first, MP4 fallback, and a static poster. Those collections do not serve GIF.
- Stick-figure coaching loops are deprecated for Today. The generator `scripts/generate-coaching-loops.py` and the files under `public/assets/coaching-loops/` remain an archive. Do not attach them to a catalog exercise. Reduced motion shows the Gym visual poster, or the still when no clip is mapped.
- Clinical status: 35 Gym visual mappings are approved, including three extra home general-pattern mappings of clips that were already in the approved set. Generated knee stills and whole-body coaching stills remain pending visual review. None is medical clearance. Catalog records without `demoMedia` must not be treated as covered by the Gym visual manifest.

Motion provenance, rights, transformations, mapping decisions, and checksums are documented in [`MEDIA_LICENSES.md`](MEDIA_LICENSES.md) and the two media manifests.
