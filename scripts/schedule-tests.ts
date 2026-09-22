import assert from "node:assert/strict";
import { defaultPrehabDoses } from "../src/data";
import { initialState } from "../src/storage";
import {
  KNEE_BLOCK_CORE_IDS,
  KNEE_BLOCK_IDS,
  LOADED_KNEE_IDS,
  UPPER_BODY_IDS,
  gymDayLabels,
  resolveWeek,
  weekMovedGymDays,
} from "../src/schedule";

const plan = {
  doses: initialState.doses,
};

function weekOn(isoInstant: string, overrides: { date: string; choice: "home" | "gym" | "rest" }[] = [], timeZone = "America/Los_Angeles") {
  return resolveWeek(new Date(isoInstant), timeZone, overrides.map((override) => ({ ...override, date: override.date as `${number}-${number}-${number}` })), plan);
}

function ids(day: { exerciseIds: readonly string[] }) {
  return day.exerciseIds;
}

const monday = "2026-09-21T19:00:00.000Z";
const defaults = weekOn(monday);
const byDate = Object.fromEntries(defaults.map((day) => [day.date, day.kind]));
assert.deepEqual(byDate, {
  "2026-09-21": "gym",
  "2026-09-22": "home",
  "2026-09-23": "gym",
  "2026-09-24": "home",
  "2026-09-25": "gym",
  "2026-09-26": "cardio",
  "2026-09-27": "rest",
});
assert.deepEqual(gymDayLabels(defaults), ["Monday", "Wednesday", "Friday"]);
assert.equal(weekMovedGymDays(defaults), null);

const gymMonday = defaults[0]!;
assert.equal(gymMonday.headline, "You're at the gym.");
assert.equal(gymMonday.badge, "Gym");
assert.equal(gymMonday.gymTemplate, "A");
for (const kneeId of KNEE_BLOCK_CORE_IDS) assert.ok(ids(gymMonday).includes(kneeId), `${kneeId} belongs on the training-day knee block`);
assert.equal(ids(gymMonday).includes("straight-leg-raise"), false, "straight-leg raise rotates off gym days");
assert.equal(gymMonday.blocks.find((block) => block.id === "knee")?.exercises.length, 3);
assert.ok(ids(gymMonday).includes("machine-chest-press"));
assert.ok(ids(gymMonday).includes("lat-pulldown"));
assert.ok(ids(gymMonday).includes("single-leg-press"));
assert.ok(ids(gymMonday).includes("single-leg-hamstring-curl-machine"));
assert.ok(ids(gymMonday).includes("stationary-bike"));
assert.equal(ids(gymMonday).includes("band-row"), false);
assert.equal(gymMonday.blocks.find((block) => block.id === "cardio")?.exercises[0]?.dose.durationMinutes, 30);
assert.match(gymMonday.blocks.find((block) => block.id === "cardio")?.exercises[0]?.dose.rangeNote ?? "", /25–30/);
assert.match(gymMonday.blocks.find((block) => block.id === "cardio")?.note ?? "", /moderate/i);
assert.equal(gymMonday.blocks.find((block) => block.id === "strength")?.exercises.find((item) => item.exerciseId === "single-leg-press")?.dose.rangeNote, defaultPrehabDoses["single-leg-press"].rangeNote);
assert.equal(gymMonday.blocks.find((block) => block.id === "strength")?.exercises.find((item) => item.exerciseId === "single-leg-press")?.dose.sets, 4);
assert.equal(gymMonday.blocks.find((block) => block.id === "strength")?.exercises.find((item) => item.exerciseId === "machine-chest-press")?.dose.sets, 4);
assert.match(gymMonday.blocks.find((block) => block.id === "strength")?.note ?? "", /No deep squat/);
assert.match(gymMonday.blocks.find((block) => block.id === "strength")?.note ?? "", /45–60/);
assert.ok(ids(gymMonday).includes("cable-face-pull"));
assert.ok(ids(gymMonday).includes("dead-bug"));
assert.equal(ids(gymMonday).includes("cable-chest-fly"), false);
assert.equal(ids(gymMonday).includes("hip-abduction-machine"), false);
assert.equal(ids(gymMonday).includes("seated-calf-raise"), false);
assert.equal(gymMonday.blocks.find((block) => block.id === "strength")?.exercises.length, 6);

const homeTuesday = defaults[1]!;
assert.equal(homeTuesday.headline, "You're at home.");
assert.equal(homeTuesday.badge, "Home");
for (const kneeId of KNEE_BLOCK_CORE_IDS) assert.ok(ids(homeTuesday).includes(kneeId));
assert.equal(ids(homeTuesday).includes("straight-leg-raise"), false);
for (const upperId of ["band-row", "band-chest-press", "bridge", "lateral-band-walk", "band-biceps-curl", "dead-bug"]) {
  assert.ok(ids(homeTuesday).includes(upperId), `home day missing ${upperId}`);
}
assert.equal(ids(homeTuesday).includes("band-overhead-press"), false);
assert.equal(ids(homeTuesday).includes("band-triceps-extension"), false);
assert.equal(ids(homeTuesday).includes("band-clam"), false);
assert.equal(ids(homeTuesday).includes("side-plank"), false);
assert.equal(ids(homeTuesday).includes("single-leg-balance"), false);
assert.equal(homeTuesday.blocks.find((block) => block.id === "strength")?.exercises.length, 6);
assert.equal(homeTuesday.blocks.find((block) => block.id === "strength")?.exercises.find((item) => item.exerciseId === "band-row")?.dose.sets, 4);
assert.match(homeTuesday.summary, /Six denser band/);

const homeThursday = defaults[3]!;
assert.equal(homeThursday.kind, "home");
for (const upperId of ["band-row", "band-chest-press", "bridge", "band-clam", "band-triceps-extension", "side-plank"]) {
  assert.ok(ids(homeThursday).includes(upperId), `second home day missing ${upperId}`);
}
assert.ok(ids(homeThursday).includes("straight-leg-raise"), "straight-leg raise rotates onto the second home day");
assert.equal(ids(homeThursday).includes("quad-set"), false);
assert.equal(homeThursday.blocks.find((block) => block.id === "knee")?.exercises.length, 3);
assert.equal(homeThursday.blocks.find((block) => block.id === "strength")?.exercises.length, 6);
for (const loadedId of LOADED_KNEE_IDS) assert.equal(ids(homeTuesday).includes(loadedId), false, `home day must not include ${loadedId}`);

const templates = [defaults[0], defaults[2], defaults[4]];
assert.deepEqual(templates.map((day) => day?.gymTemplate), ["A", "B", "C"]);
assert.ok(ids(defaults[2]!).includes("squat"));
assert.ok(ids(defaults[2]!).includes("single-leg-knee-extension-machine"));
assert.ok(ids(defaults[2]!).includes("shoulder-press"));
assert.ok(ids(defaults[2]!).includes("chest-supported-row"));
assert.ok(ids(defaults[2]!).includes("triceps-pressdown"));
assert.ok(ids(defaults[2]!).includes("side-plank"));
assert.equal(ids(defaults[2]!).includes("assisted-dip"), false);
assert.equal(ids(defaults[2]!).includes("reverse-fly"), false);
assert.ok(ids(defaults[4]!).includes("modified-single-leg-deadlift"));
assert.ok(ids(defaults[4]!).includes("hip-abduction-machine"));
assert.ok(ids(defaults[4]!).includes("seated-row"));
assert.ok(ids(defaults[4]!).includes("biceps-curl"));
assert.ok(ids(defaults[4]!).includes("pallof-press"));
assert.equal(ids(defaults[4]!).includes("back-extension"), false);
assert.equal(ids(defaults[4]!).includes("straight-arm-pulldown"), false);
assert.equal(ids(defaults[4]!).includes("assisted-pull-up"), false);
const forbidden = ["supported-reverse-lunge", "supported-forward-lunge", "clinician-cleared-double-leg-landing", "box-assisted-single-leg-squat"];
for (const day of templates) {
  const strengthCount = day?.blocks.find((block) => block.id === "strength")?.exercises.length ?? 0;
  assert.ok(strengthCount >= 6 && strengthCount <= 7, `${day?.gymTemplate} should list 6–7 strength moves`);
  assert.equal(day?.blocks.find((block) => block.id === "knee")?.exercises.length, 3);
  assert.ok(day && ids(day).some((id) => (UPPER_BODY_IDS as readonly string[]).includes(id)));
  assert.ok(day && KNEE_BLOCK_CORE_IDS.every((id) => ids(day).includes(id)));
  assert.equal(day ? ids(day).includes("straight-leg-raise") : false, false);
  for (const id of forbidden) assert.equal(day ? ids(day).includes(id) : false, false, `${day?.gymTemplate} must not include ${id}`);
}
assert.ok(KNEE_BLOCK_IDS.includes("straight-leg-raise"));

const saturday = defaults[5]!;
assert.equal(saturday.kind, "cardio");
assert.equal(saturday.headline, "You're at home.");
assert.equal(saturday.blocks.find((block) => block.id === "cardio")?.exercises[0]?.dose.durationMinutes, 40);
assert.match(saturday.blocks.find((block) => block.id === "cardio")?.exercises[0]?.dose.rangeNote ?? "", /35–45/);
assert.match(saturday.summary, /35–45/);
for (const loadedId of LOADED_KNEE_IDS) assert.equal(ids(saturday).includes(loadedId), false);

const sunday = defaults[6]!;
assert.equal(sunday.badge, "Rest");
assert.deepEqual(ids(sunday), ["band-terminal-knee-extension", "heel-slide", "straight-leg-raise", "lateral-band-walk"]);
assert.equal(sunday.blocks.find((block) => block.id === "knee")?.exercises.length, 3);

const movedHome = weekOn(monday, [{ date: "2026-09-21", choice: "home" }]);
const movedMonday = movedHome[0]!;
assert.equal(movedMonday.kind, "home");
assert.equal(movedMonday.headline, "You're at home.");
assert.deepEqual(ids(movedMonday), ids(homeTuesday), "the first home day of the week uses the same short home session");
assert.deepEqual(gymDayLabels(movedHome), ["Tuesday", "Thursday", "Saturday"]);
assert.match(weekMovedGymDays(movedHome) ?? "", /Tuesday, Thursday, and Saturday/);
for (let index = 1; index < movedHome.length; index += 1) {
  assert.equal(movedHome[index - 1]!.kind === "gym" && movedHome[index]!.kind === "gym", false, "hard knee days must not sit next to each other");
}
assert.ok(ids(movedHome[1]!).includes("single-leg-press"));
assert.ok(ids(movedHome[1]!).includes("machine-chest-press"));
assert.equal(movedHome[6]!.kind, "rest");

const flared = weekOn(monday, [{ date: "2026-09-21", choice: "rest" }]);
assert.equal(flared[0]!.kind, "rest");
assert.deepEqual(ids(flared[0]!), [...KNEE_BLOCK_CORE_IDS]);
for (const loadedId of LOADED_KNEE_IDS) assert.equal(ids(flared[0]!).includes(loadedId), false);
for (const upperId of UPPER_BODY_IDS) assert.equal(ids(flared[0]!).includes(upperId), false);
assert.equal(ids(flared[0]!).includes("stationary-bike"), false);
assert.deepEqual(gymDayLabels(flared), ["Wednesday", "Friday"]);
for (let index = 1; index < flared.length; index += 1) {
  assert.equal(flared[index - 1]!.kind === "gym" && flared[index]!.kind === "gym", false);
}

const fridayHome = weekOn(monday, [{ date: "2026-09-25", choice: "home" }]);
assert.equal(fridayHome[4]!.kind, "home");
assert.deepEqual(ids(fridayHome[4]!), ids(homeTuesday));
assert.equal(fridayHome[5]!.kind, "gym");
assert.deepEqual(gymDayLabels(fridayHome), ["Monday", "Wednesday", "Saturday"]);

const singapore = weekOn("2026-09-22T16:30:00.000Z", [], "Asia/Singapore");
assert.equal(singapore.find((day) => day.isToday)?.date, "2026-09-23");
assert.equal(singapore.find((day) => day.isToday)?.kind, "gym");
const losAngeles = weekOn("2026-09-22T16:30:00.000Z");
assert.equal(losAngeles.find((day) => day.isToday)?.date, "2026-09-22");
assert.equal(losAngeles.find((day) => day.isToday)?.kind, "home");

const thinIds = ["heel-slide", "quad-set", "straight-leg-raise", "bridge", "lateral-band-walk", "single-leg-balance"];
const blankDose = { sets: null, reps: null, loadKg: null, holdSeconds: null, durationMinutes: null, rangeNote: "" };
const thinDoses: Record<string, typeof blankDose> = {};
for (const id of thinIds) thinDoses[id] = { ...defaultPrehabDoses[id] };
thinDoses["heel-slide"] = { ...defaultPrehabDoses["heel-slide"], reps: 8 };
thinDoses["band-row"] = { ...blankDose };
thinDoses["band-terminal-knee-extension"] = { ...blankDose };
const thinWeek = resolveWeek(new Date(monday), "America/Los_Angeles", [], { planExerciseIds: thinIds, doses: thinDoses });
const thinHome = thinWeek[1]!;
assert.equal(thinHome.kind, "home");
assert.match(thinHome.blocks.find((block) => block.id === "strength")?.note ?? "", /Short home session/);
for (const id of ["band-row", "band-chest-press", "bridge", "lateral-band-walk", "band-biceps-curl", "dead-bug", "band-terminal-knee-extension"]) {
  assert.ok(ids(thinHome).includes(id), `thin home day missing ${id}`);
}
assert.equal(thinHome.blocks.find((block) => block.id === "strength")?.exercises.length, 6);
assert.equal(thinHome.blocks.find((block) => block.id === "knee")?.exercises.length, 3);
assert.equal(thinHome.blocks.find((block) => block.id === "strength")?.exercises.find((item) => item.exerciseId === "band-row")?.dose.sets, defaultPrehabDoses["band-row"].sets);
assert.equal(thinHome.blocks.find((block) => block.id === "knee")?.exercises.find((item) => item.exerciseId === "band-terminal-knee-extension")?.dose.reps, defaultPrehabDoses["band-terminal-knee-extension"].reps);
assert.equal(thinHome.blocks.find((block) => block.id === "knee")?.exercises.find((item) => item.exerciseId === "heel-slide")?.dose.reps, 8);
assert.ok(ids(thinWeek[0]!).includes("single-leg-press"));
assert.equal(thinIds.includes("band-row"), false);
assert.equal(thinIds.includes("band-terminal-knee-extension"), false);

console.log("Schedule tests passed.");
