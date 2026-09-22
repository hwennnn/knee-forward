# Default prehab plan

Fresh right-knee, pre-surgery profiles start in phase `prehab` with the exercises in `corePrehabExerciseIds` and the doses in `defaultPrehabDoses` (`src/data.ts`). Those doses are general guidance so Today is usable without empty placeholders. The treating clinician overrides exercise choice, range, and load. Knee Forward still asks for one confirmation before a session can start.

## Update a default dose

Edit that exercise in `defaultPrehabDoses`. Keep values inside the limits checked by `parseDose` in `src/storage.ts`. A dose counts as filled when it has a duration, or sets plus either reps or a hold.

## Update eligibility

Add or remove an id in `corePrehabExerciseIds`, and give every id in that list a `defaultPrehabDoses` entry. The exercise must already exist, include `prehab` in `eligiblePhaseIds`, and be plan-eligible (`planEligible` omitted or not `false`). `planEligible: false` keeps a record in Learn only. It cannot be saved, imported, or shared.

## Browsers that already saved the empty plan

A saved plan is left alone once any of its doses is filled, the exercise list is not the original seven empty placeholders, the knee is not the right knee, the phase is not prehab, or a session draft is open. That original empty right-knee prehab list is replaced with the current default the next time the app loads. Confirmation is required again after the replacement.

## Unmodified previous 15-exercise seed

A right-knee prehab plan that still matches `previousSeededPrehabExerciseIds` and `previousSeededPrehabDoses` exactly, with no session draft, is replaced by the current whole-body default. Confirmation is cleared so the person reviews the new list once. Any edited dose or exercise list stays as saved.

## Default week

`resolveWeek` in `src/schedule.ts` uses the profile time zone when it is a valid IANA name, otherwise `America/Los_Angeles`. The week starts Monday.

| Day | Default | What Today shows |
| --- | --- | --- |
| Monday, Wednesday, Friday | Gym | Daily knee block, rotated template A, B, or C, then bike 20–30 minutes if the stored bike dose is still the seed |
| Tuesday, Thursday | Home | Daily knee block plus the full band session (row, chest or push pattern, optional overhead, curl, triceps, bridge, band walk, clam, balance, dead bug, side plank) |
| Saturday | Easy cardio | Daily knee block and bike 30–45 minutes when the stored dose is still the seed, or a flat walk |
| Sunday | Rest | Daily knee block and a light band walk. No loaded knee work |

Home on a gym day stores a date override, shows that same home session immediately, and moves the missed gym day to a later weekday that does not sit next to another gym day. Rest or flare stores a rest override: range of motion only, no upper-body work, no cardio, and no replacement gym day. Sunday cannot be assigned as a gym day.

Loaded knee exercises (`LOADED_KNEE_IDS`) stay off home, flare, Saturday, and Sunday. Clinician-edited doses are kept; the Saturday and gym bike overlays apply only while the stored stationary-bike dose still equals the seed.

Stick-figure coaching GIFs are not part of this plan. Do not mark them clinically reviewed unless they are added under the existing media license and provenance rules in [MEDIA_LICENSES.md](MEDIA_LICENSES.md) and [ASSETS.md](ASSETS.md). Whole-body additions that have no reviewed motion use the geometric placeholder described in [ASSETS.md](ASSETS.md).
