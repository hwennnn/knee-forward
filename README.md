# Knee Forward

Knee Forward is a local-first ACL rehabilitation companion and a general whole-body training guide. It shows the exact session for today (gym, home, or rest), keeps a clinician-overridable right-knee prehab plan, and tracks optional morning weight plus session behavior. Guest use needs no account. Sign-in is an optional magic-link backup.

## What is implemented

- Guest-first use. The app works with no Supabase project.
- Today answers location and exact doses: Knee block, Strength, Cardio, and Check-in. The default week is gym on Monday, Wednesday, and Friday; short-loop home work on Tuesday and Thursday; moderate cardio on Saturday; rest on Sunday. Time zone defaults to `America/Los_Angeles` and can be changed in Settings.
- “Training at home today”, “At the gym today”, and “Rest / knee flared” remap the rest of the week. A home override replaces that gym day with the short-loop floor session and moves the missed gym day to a later non-adjacent weekday. A flare day is range of motion only and does not refill a gym day. Sunday is never turned into a hard knee day.
- Whole-body gym templates A, B, and C rotate a short day: two safe lowers, one push, one pull, one arm or rear-delt move, and one core exercise, plus moderate bike or a flat walk. Home days use six floor moves with a short closed-loop mini band or bodyweight. No door anchor, long tube, furniture brace, or rail. The knee block is three moves. Starting doses stay inside the protective ranges (mini squat about 45°, leg press about 45–60°, no deep squat, lunge, run, cut, pivot, or jump). Specific kilograms are not seeded. The rest of the catalog stays on the plan.
- Optional morning weight in kilograms, a 7-day trend, and counts of strength sessions and cardio minutes. There is no calorie target and no numeric weight goal until one is entered.
- Real static URLs for Today, Plan, Learn, and Progress, so refreshing or reopening a browser tab preserves the current section
- Private first-run onboarding stored in the browser
- A seeded right-knee pre-surgery plan with sets, reps, holds, and bike duration, so a new profile is not waiting on empty doses. See [docs/DEFAULT_PLAN.md](docs/DEFAULT_PLAN.md). The treating clinician's plan overrides these starting doses. An unmodified previous 15-exercise seed, or an unmodified previous whole-body seed, upgrades to the current gym plan and asks for confirmation again. A right-knee prehab plan that is only missing newer catalog moves gets those moves appended, and confirmation is asked again only when that plan was already confirmed. Today follows the day template even when the saved id list is still thin.
- Editable sets, repetitions, holds, duration, load, and range notes supplied by a physiotherapist
- A required dosage-complete confirmation gate before a recorded plan can run
- A required pre-session safety review for symptoms, swelling, locking, instability, and urgent warning signs
- A guided exercise-by-exercise workout flow
- Hevy-style performed-set logging for repetitions and kilograms, kept separate from the clinician-recorded target
- Read-only previous-set hints, partial/skip/stop outcomes, and an automatically saved resumable workout draft
- Post-session pain, swelling, and note logging
- Exercise-level history with completed-set counts, highest recorded load, repetitions, and recorded load-volume
- A phase-aware learning library. The original 32 exercises keep crisp WebP stills and approved Gym visual motion on Learn detail (WebM with MP4 fallback). Home moves without a matching clip use original stick-figure coaching GIFs on Today cards. Those GIFs are general coaching and are not clinically reviewed. Whole-body additions use their own original coaching stills, also not clinically reviewed.
- Optional magic-link backup for `whman63@gmail.com` only, when `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are present at build time. Other addresses are rejected before a link is sent. See [docs/SUPABASE.md](docs/SUPABASE.md).
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

Knee Forward stores settings and history in browser `localStorage` under `knee-forward:state:v1`. Cloud sync is off unless the deployment was built with Supabase and the invited person chooses **Upload and sync**. Surgery dates are entered only in Settings and are not included in the public seed or plan links. Full backups include all local data, so treat exported files as private. Magic-link mail and any future push text must not include symptoms, notes, or weight.

Performed set history is an observation record. Previous and highest values are never treated as a recommendation, a progression target, or clearance to increase load.

## Medical boundary

This app is educational. It does not diagnose an ACL injury, prescribe rehabilitation, or clear someone to run, jump, pivot, or return to sport. Rehabilitation progression is both time-based and milestone-based. The treating surgeon and physiotherapist decide what is appropriate, especially after meniscus, cartilage, or other ligament procedures and with graft-specific restrictions. Bundled prehab doses are general guidance for the right-knee episode and do not replace those instructions.

## Clinical references

- [AAOS ACL Clinical Practice Guideline](https://www.aaos.org/globalassets/quality-and-practice-resources/anterior-cruciate-ligament-injuries/aclcpg.pdf)
- [Aspetar ACL rehabilitation guideline](https://bjsm.bmj.com/content/57/9/500)
- [Mass General Brigham ACL reconstruction protocol](https://www.massgeneral.org/assets/MGH/pdf/orthopaedics/sports-medicine/physical-therapy/rehabilitation-protocol-for-ACL.pdf)
- [Royal Devon patient guidance](https://www.royaldevon.nhs.uk/media/dcejpp2l/preparing-for-your-anterior-cruciate-ligament-reconstruction-at-swaoc-rd-e-24-035-002a.pdf)

## Next production step

Schema, allowlist, and sync behavior are in [docs/SUPABASE.md](docs/SUPABASE.md). The VPS release path is in [docs/DEPLOY.md](docs/DEPLOY.md). Remaining production work, including closed-browser reminders, is in [docs/PRODUCTION.md](docs/PRODUCTION.md).
