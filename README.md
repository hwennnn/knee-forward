# Knee Forward

Knee Forward is a local-first ACL rehabilitation companion. It helps someone record and follow a clinician-provided exercise plan, learn common rehabilitation movements, track symptom response, and maintain a practical routine without creating an account.

## What is implemented

- Guest-first use with no sign-in or server
- Separate right-knee active prehab and left-knee historical episodes
- The seven exercises from the first pre-surgery rehab visit
- Editable sets, repetitions, holds, duration, load, and range notes supplied by a physiotherapist
- A required dosage-complete confirmation gate before a recorded plan can run
- A required pre-session safety review for symptoms, swelling, locking, instability, and urgent warning signs
- A guided exercise-by-exercise workout flow
- Hevy-style performed-set logging for repetitions and kilograms, kept separate from the clinician-recorded target
- Read-only previous-set hints, partial/skip/stop outcomes, and an automatically saved resumable workout draft
- Post-session pain, swelling, and note logging
- Exercise-level history with completed-set counts, highest recorded load, repetitions, and recorded load-volume
- A phase-aware learning library with 32 exercises and crisp WebP stills as the primary media for cards, detail, and workouts
- Optional Learn-detail motion for two mapped CDC references and eleven mapped Gym visual references, served as WebM with MP4 fallback and never as runtime GIF
- Local reminders plus an `.ics` calendar download
- Progress history, weekly adherence, and symptom-response summaries
- Validated JSON backup and restore, with non-destructive recovery for unreadable local data
- Installable PWA shell with offline support after the first production load
- System light and dark modes, reduced-motion support, and responsive desktop/mobile layouts

## Run locally

```bash
npm install
npm run dev
```

Open the local URL printed by Vite.

To open the local preview with the pending motion references at a fixed address:

```bash
npm run build:local
npm run preview -- --port 4175
```

Then visit `http://127.0.0.1:4175`.

For a production-style local build:

```bash
npm run build
npm run preview
```

The production build physically removes all motion files that are still awaiting clinical review before it generates the offline cache. `npm run build:local` is intentionally local-only and includes those files for evaluation on a loopback address. Motion appears below the primary still on Learn detail pages. Runtime video uses WebM first with MP4 fallback; GIF is never served. Reduced-motion preferences receive a static poster. The original Gym visual GIFs are preserved under `work/source-motion-gifs/gymvisual/` for provenance, and public derivatives remain credited and tracked in a checksum manifest under `public/assets/motion/gymvisual/`.

CDC step-up and lunge plus eleven Gym visual assets are mapped in the Learn detail view. Nine Gym visual references depict exact movement variations; the knee-extension and hamstring-curl references are clearly identified as general machine references because their setup differs from the named variation. All mappings and the 16 original 1024 px WebP exercise stills remain pending clinical review; none represents medical clearance.

## Data and privacy

The MVP stores plan settings and session history in browser `localStorage` under `knee-forward:state:v1`. Nothing is uploaded. Use **Settings > Export backup** before clearing browser storage or moving devices.

Performed set history is an observation record. Previous and highest values are never treated as a recommendation, a progression target, or clearance to increase load.

## Medical boundary

This app is educational. It does not diagnose an ACL injury, prescribe rehabilitation, or clear someone to run, jump, pivot, or return to sport. Rehabilitation progression is both time-based and milestone-based. The treating surgeon and physiotherapist decide what is appropriate, especially after meniscus, cartilage, or other ligament procedures and with graft-specific restrictions.

## Clinical references

- [AAOS ACL Clinical Practice Guideline](https://www.aaos.org/globalassets/quality-and-practice-resources/anterior-cruciate-ligament-injuries/aclcpg.pdf)
- [Aspetar ACL rehabilitation guideline](https://bjsm.bmj.com/content/57/9/500)
- [Mass General Brigham ACL reconstruction protocol](https://www.massgeneral.org/assets/MGH/pdf/orthopaedics/sports-medicine/physical-therapy/rehabilitation-protocol-for-ACL.pdf)
- [Royal Devon patient guidance](https://www.royaldevon.nhs.uk/media/dcejpp2l/preparing-for-your-anterior-cruciate-ligament-reconstruction-at-swaoc-rd-e-24-035-002a.pdf)

## Next production step

The proposed Supabase migration, row-level security model, data-merging flow, and notification path are documented in [docs/PRODUCTION.md](docs/PRODUCTION.md).
