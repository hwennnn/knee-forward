import assert from "node:assert/strict";
import { initialPostResponse, performedSetOutcome, previousSetsForExercise } from "../src/sessionTracking";
import { importState, initialState, parseState } from "../src/storage";
import type { LocalAppState } from "../src/types";

const exerciseId = "single-leg-knee-extension-machine";
const prescribedDose = {
  sets: 2,
  reps: 10,
  loadKg: 12.5,
  holdSeconds: null,
  durationMinutes: null,
  rangeNote: "Clinician-approved range",
};

function baseState(): LocalAppState {
  return structuredClone(initialState);
}

const legacySession = {
  id: "legacy-session",
  episodeId: initialState.activeEpisodeId,
  routineId: "routine-right-prehab-foundations",
  completedAt: "2026-08-12T10:00:00.000Z",
  painBefore: 1,
  painAfter: 2,
  swellingBefore: "none",
  swellingAfter: "mild",
  completedExerciseIds: [exerciseId],
  note: "Imported from the original local schema",
};

const legacyInput = { ...baseState(), sessions: [legacySession] } as unknown as Record<string, unknown>;
delete legacyInput.sessionDraft;
const normalizedLegacy = parseState(legacyInput);
assert.equal(normalizedLegacy.sessionDraft, null);
assert.deepEqual(normalizedLegacy.sessions[0]?.exerciseLogs, []);
assert.doesNotThrow(() => parseState(normalizedLegacy), "normalized legacy state must remain saveable");

const completedState = baseState();
completedState.sessions = [{
  id: "recorded-session",
  episodeId: initialState.activeEpisodeId,
  routineId: "routine-right-prehab-foundations",
  completedAt: "2026-08-13T10:00:00.000Z",
  painBefore: 1,
  painAfter: 1,
  swellingBefore: "none",
  swellingAfter: "none",
  completedExerciseIds: [exerciseId],
  exerciseLogs: [{
    exerciseId,
    exerciseName: "Single-leg knee extension machine",
    prescribedDose,
    status: "completed",
    sets: [
      { reps: 10, loadKg: 12.5, completed: true },
      { reps: 9, loadKg: 12.5, completed: true },
    ],
  }],
  note: "",
}];
const parsedCompleted = parseState(JSON.parse(JSON.stringify(completedState)));
assert.equal(parsedCompleted.sessions[0]?.exerciseLogs[0]?.sets[1]?.reps, 9);
assert.deepEqual(parseState(JSON.parse(JSON.stringify(parsedCompleted))), parsedCompleted, "export and import must round trip");

assert.deepEqual(
  initialPostResponse(6, "moderate"),
  { painAfter: 6, swellingAfter: "moderate" },
  "an untouched post-check must begin at the recorded pre-session response",
);
assert.equal(performedSetOutcome(2, 2), "completed", "all completed sets must produce a completed exercise");
assert.equal(performedSetOutcome(1, 2), "partial");
assert.equal(performedSetOutcome(0, 2), "skipped");

const otherEpisodeSession = structuredClone(completedState.sessions[0]!);
otherEpisodeSession.id = "other-episode-session";
otherEpisodeSession.episodeId = "episode-left-aclr-history";
otherEpisodeSession.completedAt = "2026-08-14T10:00:00.000Z";
otherEpisodeSession.exerciseLogs[0]!.sets[0] = { reps: 30, loadKg: 99, completed: true };
assert.equal(
  previousSetsForExercise(
    [otherEpisodeSession, completedState.sessions[0]!],
    initialState.activeEpisodeId,
    exerciseId,
  )?.[0]?.loadKg,
  12.5,
  "previous history must stay within the active episode",
);

const mismatchState = structuredClone(completedState);
mismatchState.sessions[0] = { ...mismatchState.sessions[0]!, completedExerciseIds: [] };
assert.throws(() => parseState(mismatchState), /completion list does not match/);

const stoppedState = baseState();
stoppedState.sessions = [{
  ...completedState.sessions[0]!,
  id: "stopped-session",
  completedExerciseIds: [],
  exerciseLogs: [{
    ...completedState.sessions[0]!.exerciseLogs[0]!,
    status: "stopped",
    sets: [
      { reps: 8, loadKg: 10, completed: true },
      { reps: null, loadKg: null, completed: false },
    ],
  }],
}];
assert.doesNotThrow(() => parseState(stoppedState));

const skippedWithSet = structuredClone(stoppedState);
skippedWithSet.sessions[0] = {
  ...skippedWithSet.sessions[0]!,
  exerciseLogs: [{ ...skippedWithSet.sessions[0]!.exerciseLogs[0]!, status: "skipped" }],
};
assert.throws(() => parseState(skippedWithSet), /skipped exercise log contains a completed set/);

const legacyPartialWithAllSets = structuredClone(completedState);
legacyPartialWithAllSets.sessions[0] = {
  ...legacyPartialWithAllSets.sessions[0]!,
  id: "legacy-partial-all-sets",
  completedExerciseIds: [],
  exerciseLogs: [{
    ...legacyPartialWithAllSets.sessions[0]!.exerciseLogs[0]!,
    status: "partial",
  }],
};
assert.equal(
  parseState(legacyPartialWithAllSets).sessions[0]?.exerciseLogs[0]?.status,
  "partial",
  "version 1 history from the former all-sets partial action must remain readable",
);

const duplicateLogState = structuredClone(completedState);
duplicateLogState.sessions[0] = {
  ...duplicateLogState.sessions[0]!,
  exerciseLogs: [
    duplicateLogState.sessions[0]!.exerciseLogs[0]!,
    structuredClone(duplicateLogState.sessions[0]!.exerciseLogs[0]!),
  ],
};
assert.throws(() => parseState(duplicateLogState), /duplicate exercise logs/);

const invalidLoadState = structuredClone(completedState);
invalidLoadState.sessions[0]!.exerciseLogs[0]!.sets[0] = { reps: 10, loadKg: -1, completed: true };
assert.throws(() => parseState(invalidLoadState), /invalid load/);

const invalidCompletionState = JSON.parse(JSON.stringify(completedState));
invalidCompletionState.sessions[0].exerciseLogs[0].sets[0].completed = "yes";
assert.throws(() => parseState(invalidCompletionState), /invalid completion value/);

const draftState = baseState();
draftState.sessionDraft = {
  id: "draft-session",
  episodeId: initialState.activeEpisodeId,
  routineId: "routine-right-prehab-foundations",
  startedAt: "2026-08-13T10:00:00.000Z",
  updatedAt: "2026-08-13T10:05:00.000Z",
  painBefore: 1,
  swellingBefore: "none",
  currentExerciseIndex: 0,
  exercises: [{
    exerciseId,
    exerciseName: "Single-leg knee extension machine",
    prescribedDose,
    outcome: null,
    sets: [
      { reps: 10, loadKg: 12.5, completed: true },
      { reps: null, loadKg: null, completed: false },
    ],
  }],
};
const parsedDraft = parseState(JSON.parse(JSON.stringify(draftState)));
assert.equal(parsedDraft.sessionDraft?.exercises[0]?.sets[0]?.completed, true);

const invalidDraft = structuredClone(draftState) as unknown as {
  sessionDraft: { exercises: Array<{ sets: Array<{ reps: number | null }> }> };
};
invalidDraft.sessionDraft.exercises[0]!.sets[0]!.reps = 1.5;
assert.throws(() => parseState(invalidDraft), /invalid repetition count/);

const invalidCalendarDate = structuredClone(initialState) as unknown as { profile: { plannedSurgeryDate: string } };
invalidCalendarDate.profile.plannedSurgeryDate = "2026-02-31";
assert.throws(() => parseState(invalidCalendarDate), /surgery date is invalid/);

const invalidReminderDate = structuredClone(initialState) as unknown as { reminderDismissedOn: string };
invalidReminderDate.reminderDismissedOn = "2026-13-01";
assert.throws(() => parseState(invalidReminderDate), /reminder acknowledgement is invalid/);

await assert.rejects(
  () => importState(new File([new Uint8Array(2_000_001)], "oversized.json", { type: "application/json" })),
  /limit is 2 MB/,
);

console.log("State parser tests passed.");
