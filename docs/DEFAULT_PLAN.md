# Default prehab plan

Fresh right-knee, pre-surgery profiles start in phase `prehab` with the exercises in `corePrehabExerciseIds` and the doses in `defaultPrehabDoses` (`src/data.ts`). Those doses are general guidance so Today is usable without empty placeholders. The treating clinician overrides exercise choice, range, and load. Knee Forward still asks for one confirmation before a session can start.

## Update a default dose

Edit that exercise in `defaultPrehabDoses`. Keep values inside the limits checked by `parseDose` in `src/storage.ts`. A dose counts as filled when it has a duration, or sets plus either reps or a hold.

## Update eligibility

Add or remove an id in `corePrehabExerciseIds`, and give every id in that list a `defaultPrehabDoses` entry. The exercise must already exist, include `prehab` in `eligiblePhaseIds`, and be plan-eligible (`planEligible` omitted or not `false`). `planEligible: false` keeps a record in Learn only. It cannot be saved, imported, or shared.

## Browsers that already saved the empty plan

A saved plan is left alone once any of its doses is filled, the exercise list is not the original seven empty placeholders, the knee is not the right knee, the phase is not prehab, or a session draft is open. That original empty right-knee prehab list is replaced with the current default the next time the app loads. Confirmation is required again after the replacement.

Stick-figure coaching GIFs are not part of this plan. Do not mark them clinically reviewed unless they are added under the existing media license and provenance rules in [MEDIA_LICENSES.md](MEDIA_LICENSES.md) and [ASSETS.md](ASSETS.md).
