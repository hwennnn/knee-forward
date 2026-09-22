# Knee Forward

Knee Forward is a local-first ACL rehabilitation companion. It helps someone record and follow a clinician-provided exercise plan, learn common rehabilitation movements, track symptom response, and maintain a practical routine without creating an account.

## What is implemented

- Guest-first use with no sign-in or server
- Real static URLs for Today, Plan, Learn, and Progress, so refreshing or reopening a browser tab preserves the current section
- Private first-run onboarding stored in the browser
- A seeded right-knee pre-surgery plan with sets, reps, holds, and bike duration, so a new profile is not waiting on empty doses. See [docs/DEFAULT_PLAN.md](docs/DEFAULT_PLAN.md). The treating clinician's plan overrides these starting doses.
- Editable sets, repetitions, holds, duration, load, and range notes supplied by a physiotherapist
- A required dosage-complete confirmation gate before a recorded plan can run
- A required pre-session safety review for symptoms, swelling, locking, instability, and urgent warning signs
- A guided exercise-by-exercise workout flow
- Hevy-style performed-set logging for repetitions and kilograms, kept separate from the clinician-recorded target
- Read-only previous-set hints, partial/skip/stop outcomes, and an automatically saved resumable workout draft
- Post-session pain, swelling, and note logging
- Exercise-level history with completed-set counts, highest recorded load, repetitions, and recorded load-volume
- A phase-aware learning library with 32 exercises and crisp WebP stills as the primary media for cards, detail, and workouts
- Approved Learn-detail motion for all 32 exercises from the Gym visual exercise dataset, served as WebM with MP4 fallback and never as runtime GIF
- Local reminders plus an `.ics` calendar download
- Progress history, weekly adherence, and symptom-response summaries
- Validated JSON backup and restore, with non-destructive recovery for unreadable local data
- Plan-only share links with confirmed import; dates, symptoms, notes, reminders, and history are excluded
- Installable PWA shell with offline support after the first production load
- System light and dark modes, reduced-motion support, and responsive desktop/mobile layouts

## Run locally

```bash
npm install
npm run dev
```

Open the local URL printed by Vite.

To open the local preview at a fixed address:

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

Motion appears below the primary still on every Learn detail page in local and production builds. Runtime video uses WebM first with MP4 fallback; GIF is never served. Reduced-motion preferences receive a static poster. Motion files are delivered on demand and excluded from the offline precache. The original Gym visual GIFs are preserved under `work/source-motion-gifs/gymvisual/` for provenance, and public derivatives remain credited and tracked in a checksum manifest under `public/assets/motion/gymvisual/`.

Twenty-seven Gym visual assets provide 32 exercise mappings in the Learn detail view. General movement references are labeled wherever the dataset setup differs from the named rehabilitation exercise. No visual represents medical clearance.

## Data and privacy

Knee Forward stores settings and history in browser `localStorage` under `knee-forward:state:v1`. Nothing is uploaded. Surgery dates are entered only in local Settings and are not included in the public seed or plan links. Full backups include all local data, so treat exported files as private.

Performed set history is an observation record. Previous and highest values are never treated as a recommendation, a progression target, or clearance to increase load.

## Medical boundary

This app is educational. It does not diagnose an ACL injury, prescribe rehabilitation, or clear someone to run, jump, pivot, or return to sport. Rehabilitation progression is both time-based and milestone-based. The treating surgeon and physiotherapist decide what is appropriate, especially after meniscus, cartilage, or other ligament procedures and with graft-specific restrictions. Bundled prehab doses are general guidance for the right-knee episode and do not replace those instructions.

## Clinical references

- [AAOS ACL Clinical Practice Guideline](https://www.aaos.org/globalassets/quality-and-practice-resources/anterior-cruciate-ligament-injuries/aclcpg.pdf)
- [Aspetar ACL rehabilitation guideline](https://bjsm.bmj.com/content/57/9/500)
- [Mass General Brigham ACL reconstruction protocol](https://www.massgeneral.org/assets/MGH/pdf/orthopaedics/sports-medicine/physical-therapy/rehabilitation-protocol-for-ACL.pdf)
- [Royal Devon patient guidance](https://www.royaldevon.nhs.uk/media/dcejpp2l/preparing-for-your-anterior-cruciate-ligament-reconstruction-at-swaoc-rd-e-24-035-002a.pdf)

## Next production step

The proposed Supabase migration, row-level security model, data-merging flow, and notification path are documented in [docs/PRODUCTION.md](docs/PRODUCTION.md).
