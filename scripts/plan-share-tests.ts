import assert from "node:assert/strict";
import { applySharedPlan, createSharedPlanUrl, decodeSharedPlan, encodeSharedPlan, sharedPlanFromState } from "../src/planShare";
import { initialState } from "../src/storage";

const state = structuredClone(initialState);
state.profile.plannedSurgeryDate = "2026-12-12";
state.sessions = [];
state.reminderTime = "07:15";
state.doses[state.planExerciseIds[0]!] = { sets: 3, reps: 8, loadKg: 12.5, holdSeconds: null, durationMinutes: null, rangeNote: "Approved range" };

const shared = sharedPlanFromState(state);
const encoded = encodeSharedPlan(shared);
assert.deepEqual(decodeSharedPlan(encoded), shared);
assert.doesNotMatch(encoded, /2026-12-12|07:15/);
assert.equal(shared.exercises[0]?.dose.rangeNote, "", "free-text plan notes must never enter a URL");

const url = createSharedPlanUrl(state, { origin: "https://knee.example" } as Location);
assert.match(url, /^https:\/\/knee\.example\/today\/\?plan=/);
assert.doesNotMatch(url, /2026-12-12|07%3A15/);

const imported = applySharedPlan({ ...state, planClinicianConfirmed: true }, shared);
assert.equal(imported.planClinicianConfirmed, false);
assert.equal(imported.profile.plannedSurgeryDate, "2026-12-12");
assert.equal(imported.reminderTime, "07:15");
assert.deepEqual(imported.planExerciseIds, state.planExerciseIds);
assert.throws(() => decodeSharedPlan("not-valid!"), /invalid/);

const encodeRaw = (value: unknown) => Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
assert.throws(
  () => decodeSharedPlan(encodeRaw({ ...shared, unexpected: true })),
  /unsupported format/,
  "unknown top-level fields must be rejected",
);
assert.throws(
  () => decodeSharedPlan(encodeRaw({ v: 1, exercises: [{ ...shared.exercises[0], unexpected: true }] })),
  /unknown or duplicate exercise/,
  "unknown exercise fields must be rejected",
);
assert.throws(
  () => applySharedPlan(state, {
    v: 1,
    exercises: [{
      id: "step-up",
      dose: { sets: 2, reps: 8, loadKg: null, holdSeconds: null, durationMinutes: null, rangeNote: "" },
    }],
  }),
  /outside your current rehab phase/,
);

console.log("plan share tests passed");
