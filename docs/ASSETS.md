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

## Mixed-media runtime policy

- Primary media: a crisp WebP still on Learn cards, Learn detail, and workout screens.
- Optional motion: Learn detail only, after the still and explanatory content.
- Runtime motion: WebM first, MP4 fallback, and a static poster.
- Runtime GIF: prohibited. Original Gym visual GIFs are preserved only under `work/source-motion-gifs/gymvisual/` for provenance.
- Clinical status: all generated stills and mapped motion references remain pending clinical review. None is medical clearance.

Motion provenance, rights, transformations, mapping decisions, and checksums are documented in [`MEDIA_LICENSES.md`](MEDIA_LICENSES.md) and the two media manifests.
