# Default prehab plan

Fresh right-knee, pre-surgery profiles start in phase `prehab` with the exercises in `corePrehabExerciseIds` and the doses in `defaultPrehabDoses` (`src/data.ts`). Those doses are general guidance so Today is usable without empty placeholders. The treating clinician overrides exercise choice, range, and load. Knee Forward still asks for one confirmation before a session can start.

## Update a default dose

Edit that exercise in `defaultPrehabDoses`. Keep values inside the limits checked by `parseDose` in `src/storage.ts`. A dose counts as filled when it has a duration, or sets plus either reps or a hold.

## Update eligibility

Add or remove an id in `corePrehabExerciseIds`, and give every id in that list a `defaultPrehabDoses` entry. The exercise must already exist, include `prehab` in `eligiblePhaseIds`, and be plan-eligible (`planEligible` omitted or not `false`). `planEligible: false` keeps a record in Learn only. It cannot be saved, imported, or shared.

## Browsers that already saved the empty plan

A saved plan is left alone once any of its doses is filled, the exercise list is not the original seven empty placeholders, the knee is not the right knee, the phase is not prehab, or a session draft is open. That original empty right-knee prehab list is replaced with the current default the next time the app loads. Confirmation is required again after the replacement.

## Unmodified previous 15-exercise seed

A right-knee prehab plan that still matches `previousSeededPrehabExerciseIds` and `previousSeededPrehabDoses` exactly, with no session draft, is replaced by the current gym plan. Confirmation is cleared so the person reviews the new list once. Those historical doses stay frozen even when `defaultPrehabDoses` gets harder.

## Unmodified previous whole-body seed

A right-knee prehab plan that still matches `previousWholeBodyExerciseIds` and `previousWholeBodyDoses` exactly, with no session draft, is replaced by the current 24 Hour Fitness plan (extra machines plus harder strength doses). Confirmation is cleared once. An open session draft blocks the replacement.

## Partial, confirmed, and edited plans

Today shows the full day template (knee block, gym template A/B/C, home strength, or cardio). An exercise is not hidden because it is missing from `planExerciseIds`. The dose on screen is the saved dose when that dose has sets or a duration. A missing or zero-filled dose uses `defaultPrehabDoses`. A saved dose that already has sets or a duration is kept, including when it differs from the seed. Bike length overlays still apply only while the stored bike dose matches the seed.

On load, a right-knee prehab plan with no open session draft appends any `corePrehabExerciseIds` that are missing. Doses already stored for those ids are kept. Blank doses are filled from `defaultPrehabDoses`. Left-knee plans, later phases, and an open session draft are not rewritten.

Confirmation is cleared only when that append adds at least one id to a plan that was already confirmed. A confirmed plan that already lists every core id stays confirmed. There is no excluded-exercise flag, so a core exercise removed in the plan editor is appended again the next time a right-knee prehab plan loads. `planExerciseIds` is still the list for the plan editor, share links, and the logging library. The day view does not use it as a filter.

Daily knee-block doses (heel slide, quad set, terminal knee extension, straight-leg raise) stay the protective seed. Strength doses do not. Today shows three of those four: terminal knee extension and heel slide every day, quad set on training days, and straight-leg raise on the second home day of the week and on the default Sunday rest day. A flare rest day keeps the three quiet moves and drops the raise.

## Default week

`resolveWeek` in `src/schedule.ts` uses the profile time zone when it is a valid IANA name, otherwise `America/Los_Angeles`. The week starts Monday.

| Day | Default | What Today shows |
| --- | --- | --- |
| Monday, Wednesday, Friday | Gym | Three-move knee block, rotated template A, B, or C (6 strength moves), then bike 25–30 minutes moderate if the stored bike dose is still the seed |
| Tuesday, Thursday | Home | Three-move knee block plus six floor moves. Short loop band + floor — no anchor needed. Tuesday is bridge, clam, band walk, supine band abduction, dead bug, and knees-down side plank. Thursday swaps the abduction for a mini-band good morning and rotates the straight-leg raise into the knee block |
| Saturday | Moderate cardio | Three-move knee block and bike 35–45 minutes when the stored dose is still the seed, or a flat walk |
| Sunday | Rest | Terminal knee extension, heel slide, straight-leg raise, and a light band walk. No loaded knee work |

Gym A is leg press, hamstring curl, chest press, lat pulldown, face pull, and dead bug. Gym B is mini squat, knee extension, shoulder press, chest-supported row, triceps pressdown, and side plank. Gym C is hip hinge, hip abduction machine, chest press, seated row, biceps curl, and Pallof press. Each gym day is two safe lowers, one push, one pull, one arm or rear-delt move, and one core move. Cardio stays in its own block. Load stays unset (`loadKg` null). Notes tell the person to push load when the form is clean. The compounds that remain stay at the harder seeded doses.

Calf raise, chest fly, fire hydrant, heel raise, back extension, straight-arm pulldown, assisted pull-up, assisted dip, rear-delt fly, and single-leg balance stay in the plan catalog. They are not forced into every Today session. Band row, band chest press, band overhead press, band curl, and band triceps stay in the catalog too, but they need an anchor or a long band, so they are not on home Today. Bridge march stays off home days because it is a single-leg progression and is not part of this prehab home set. Home is a short closed-loop mini band and the floor only. Gym A, B, and C stay the slim 24 Hour Fitness sessions.

Knee limits stay on the doses and on the gym strength note: mini squat about 45° (goblet, dumbbell, or Smith is allowed), leg press about 45–60°, soft knees on hinges, no deep squat, lunge, run, cut, pivot, or jump. Hanging knee raises and kneeling cable crunches are not in the plan. Open-chain knee extension stays a shorter protected set, not a 4×8 compound.

Home on a gym day stores a date override, shows that same home session immediately, and moves the missed gym day to a later weekday that does not sit next to another gym day. Rest or flare stores a rest override: range of motion only, no upper-body work, no cardio, and no replacement gym day. Sunday cannot be assigned as a gym day.

Loaded knee exercises (`LOADED_KNEE_IDS`, including the hip-abduction machine, seated calf raise, and back extension) stay off home, flare, Saturday, and Sunday. Clinician-edited doses are kept; the Saturday and gym bike overlays apply only while the stored stationary-bike dose still equals the seed.

Home Today cards play a reviewed Gym visual WebM/MP4 loop when a close approved clip exists. Bridge and lateral band walk use their exact clips. Terminal knee extension, heel slide, quad set, straight-leg raise, band clam, supine band abduction, and the mini-band good morning use a labeled general-pattern clip when the setup differs (short loop, no anchor, or a different body position). Dead bug and the knees-down side plank stay on their own stills plus cues, because no approved Gym visual clip is a close match. Stick-figure coaching GIFs are deprecated for Today and are not attached. See [MEDIA_LICENSES.md](MEDIA_LICENSES.md) and [ASSETS.md](ASSETS.md). Whole-body exercises that are not in that home set still use their own coaching stills. Those stills are pending visual review and are not clinician media.
