import assert from "node:assert/strict";
import { corePrehabExerciseIds, defaultPrehabDoses, previousSeededPrehabDoses, previousSeededPrehabExerciseIds, previousWholeBodyDoses, previousWholeBodyExerciseIds } from "../src/data";
import { initialPostResponse, performedSetOutcome, previousSetsForExercise } from "../src/sessionTracking";
import { importState, initialState, parseState } from "../src/storage";
import type { ExerciseDose, LocalAppState } from "../src/types";

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

const namedProfile = structuredClone(initialState);
namedProfile.profile.displayName = "  Alex  ";
namedProfile.profile.onboardingComplete = true;
assert.equal(parseState(namedProfile).profile.displayName, "Alex");

const invalidProfileName = structuredClone(initialState);
invalidProfileName.profile.displayName = "x".repeat(41);
assert.throws(() => parseState(invalidProfileName), /profile name is invalid/);

const legacyProfile = structuredClone(initialState) as unknown as { profile: Record<string, unknown> };
delete legacyProfile.profile.affectedKnee;
delete legacyProfile.profile.rehabStage;
delete legacyProfile.profile.currentPhaseId;
assert.deepEqual(
  {
    affectedKnee: parseState(legacyProfile).profile.affectedKnee,
    rehabStage: parseState(legacyProfile).profile.rehabStage,
    currentPhaseId: parseState(legacyProfile).profile.currentPhaseId,
  },
  { affectedKnee: "right", rehabStage: "pre_surgery", currentPhaseId: "prehab" },
);

const invalidKnee = structuredClone(initialState) as unknown as { profile: { affectedKnee: string } };
invalidKnee.profile.affectedKnee = "both";
assert.throws(() => parseState(invalidKnee), /affected knee is invalid/);

const invalidStage = structuredClone(initialState) as unknown as { profile: { rehabStage: string } };
invalidStage.profile.rehabStage = "unknown";
assert.throws(() => parseState(invalidStage), /rehab path is invalid/);

const invalidPhase = structuredClone(initialState) as unknown as { profile: { currentPhaseId: string } };
invalidPhase.profile.currentPhaseId = "week-12";
assert.throws(() => parseState(invalidPhase), /rehab phase is invalid/);

const mismatchedPhase = structuredClone(initialState);
mismatchedPhase.profile.rehabStage = "non_surgical";
assert.throws(() => parseState(mismatchedPhase), /phase does not match/);

const changedPhase = structuredClone(initialState);
changedPhase.profile.rehabStage = "post_surgery";
changedPhase.profile.currentPhaseId = "protect-and-settle";
changedPhase.planClinicianConfirmed = true;
assert.equal(parseState(changedPhase).planClinicianConfirmed, false, "a phase change must invalidate an incompatible plan confirmation");
assert.doesNotThrow(() => parseState(changedPhase), "an old plan must remain available for review after a phase change");

assert.equal(initialState.profile.affectedKnee, "right");
assert.equal(initialState.profile.rehabStage, "pre_surgery");
assert.equal(initialState.profile.currentPhaseId, "prehab");
assert.equal(initialState.planClinicianConfirmed, false, "seeded doses still require one clinician-match confirmation");
assert.deepEqual([...initialState.planExerciseIds], [...corePrehabExerciseIds]);
for (const exerciseId of corePrehabExerciseIds) {
  assert.deepEqual(initialState.doses[exerciseId], defaultPrehabDoses[exerciseId], `${exerciseId} must ship with its seeded dose`);
}
const reparsedDefault = parseState(JSON.parse(JSON.stringify(initialState)));
assert.deepEqual([...reparsedDefault.planExerciseIds], [...corePrehabExerciseIds]);
assert.equal(reparsedDefault.doses["stationary-bike"]?.durationMinutes, 30);
assert.equal(reparsedDefault.doses["single-leg-balance"]?.holdSeconds, 40);
assert.equal(reparsedDefault.doses["machine-chest-press"]?.sets, 4);
assert.equal(reparsedDefault.doses["machine-chest-press"]?.loadKg, null);

const blankDose = (): ExerciseDose => ({
  sets: null,
  reps: null,
  loadKg: null,
  holdSeconds: null,
  durationMinutes: null,
  rangeNote: "",
});
const legacyPlanIds = [
  "single-leg-knee-extension-machine",
  "single-leg-hamstring-curl-machine",
  "single-leg-press",
  "squat",
  "standing-single-leg-heel-raise",
  "standing-hip-abduction-external-rotation-fire-hydrant",
  "modified-single-leg-deadlift",
];
const legacyEmptyPlan = structuredClone(initialState);
legacyEmptyPlan.profile.displayName = "Houman";
legacyEmptyPlan.profile.onboardingComplete = true;
legacyEmptyPlan.planExerciseIds = legacyPlanIds;
legacyEmptyPlan.doses = Object.fromEntries(Object.keys(legacyEmptyPlan.doses).map((id) => [id, blankDose()]));
const upgradedLegacyPlan = parseState(legacyEmptyPlan);
assert.equal(upgradedLegacyPlan.profile.displayName, "Houman");
assert.deepEqual([...upgradedLegacyPlan.planExerciseIds], [...corePrehabExerciseIds]);
assert.deepEqual(upgradedLegacyPlan.doses["heel-slide"], defaultPrehabDoses["heel-slide"]);
assert.deepEqual(upgradedLegacyPlan.doses["band-terminal-knee-extension"], defaultPrehabDoses["band-terminal-knee-extension"]);
assert.equal(upgradedLegacyPlan.planClinicianConfirmed, false);

const customizedLegacyPlan = structuredClone(legacyEmptyPlan);
customizedLegacyPlan.doses.squat = { ...blankDose(), sets: 4, reps: 8, rangeNote: "Kept custom dose" };
const preservedLegacyPlan = parseState(customizedLegacyPlan);
assert.deepEqual([...preservedLegacyPlan.planExerciseIds], [
  ...legacyPlanIds,
  ...corePrehabExerciseIds.filter((id) => !legacyPlanIds.includes(id)),
]);
assert.equal(preservedLegacyPlan.doses.squat?.rangeNote, "Kept custom dose");
assert.deepEqual(preservedLegacyPlan.doses["heel-slide"], defaultPrehabDoses["heel-slide"]);
assert.equal(preservedLegacyPlan.planClinicianConfirmed, false);

const leftKneeLegacyPlan = structuredClone(legacyEmptyPlan);
leftKneeLegacyPlan.profile.affectedKnee = "left";
assert.deepEqual([...parseState(leftKneeLegacyPlan).planExerciseIds], legacyPlanIds);

const laterPhaseLegacyPlan = structuredClone(legacyEmptyPlan);
laterPhaseLegacyPlan.profile.rehabStage = "post_surgery";
laterPhaseLegacyPlan.profile.currentPhaseId = "rebuild-capacity";
assert.deepEqual([...parseState(laterPhaseLegacyPlan).planExerciseIds], legacyPlanIds);

const legacyPlanWithDraft = structuredClone(legacyEmptyPlan);
legacyPlanWithDraft.sessionDraft = {
  id: "legacy-draft",
  episodeId: initialState.activeEpisodeId,
  routineId: "routine-right-prehab-foundations",
  startedAt: "2026-08-13T10:00:00.000Z",
  updatedAt: "2026-08-13T10:05:00.000Z",
  painBefore: 1,
  swellingBefore: "none",
  currentExerciseIndex: 0,
  exercises: [{
    exerciseId: "squat",
    exerciseName: "Squat",
    prescribedDose: blankDose(),
    outcome: null,
    sets: [{ reps: null, loadKg: null, completed: false }],
  }],
};
assert.deepEqual([...parseState(legacyPlanWithDraft).planExerciseIds], legacyPlanIds);

const invalidReminderDate = structuredClone(initialState) as unknown as { reminderDismissedOn: string };
invalidReminderDate.reminderDismissedOn = "2026-13-01";
assert.throws(() => parseState(invalidReminderDate), /reminder acknowledgement is invalid/);

const previousSeed = structuredClone(initialState);
previousSeed.planExerciseIds = [...previousSeededPrehabExerciseIds];
previousSeed.profile.displayName = "Houman";
previousSeed.profile.onboardingComplete = true;
previousSeed.planClinicianConfirmed = true;
for (const id of Object.keys(previousSeed.doses)) {
  previousSeed.doses[id] = {
    sets: null,
    reps: null,
    loadKg: null,
    holdSeconds: null,
    durationMinutes: null,
    rangeNote: "",
  };
}
for (const exerciseId of previousSeededPrehabExerciseIds) {
  previousSeed.doses[exerciseId] = { ...previousSeededPrehabDoses[exerciseId] };
}
const upgradedWholeBody = parseState(previousSeed);
assert.equal(upgradedWholeBody.profile.displayName, "Houman");
assert.deepEqual([...upgradedWholeBody.planExerciseIds], [...corePrehabExerciseIds]);
assert.deepEqual(upgradedWholeBody.doses["band-row"], defaultPrehabDoses["band-row"]);
assert.equal(upgradedWholeBody.planClinicianConfirmed, false);
assert.deepEqual(upgradedWholeBody.doses["single-leg-press"], defaultPrehabDoses["single-leg-press"]);

const customizedPreviousSeed = structuredClone(previousSeed);
customizedPreviousSeed.doses["heel-slide"] = { ...previousSeededPrehabDoses["heel-slide"], reps: 8 };
const backfilledPreviousSeed = parseState(customizedPreviousSeed);
assert.deepEqual([...backfilledPreviousSeed.planExerciseIds], [...corePrehabExerciseIds]);
assert.equal(backfilledPreviousSeed.doses["heel-slide"]?.reps, 8);
assert.deepEqual(backfilledPreviousSeed.doses["band-row"], defaultPrehabDoses["band-row"]);
assert.equal(backfilledPreviousSeed.planClinicianConfirmed, false, "adding catalog moves to a confirmed plan asks for confirmation again");

const wholeBodySeed = structuredClone(initialState);
wholeBodySeed.profile.displayName = "Houman";
wholeBodySeed.profile.onboardingComplete = true;
wholeBodySeed.planClinicianConfirmed = true;
wholeBodySeed.planExerciseIds = [...previousWholeBodyExerciseIds];
for (const id of Object.keys(wholeBodySeed.doses)) {
  wholeBodySeed.doses[id] = blankDose();
}
for (const exerciseId of previousWholeBodyExerciseIds) {
  wholeBodySeed.doses[exerciseId] = { ...previousWholeBodyDoses[exerciseId] };
}
const upgradedGymPlan = parseState(wholeBodySeed);
assert.equal(upgradedGymPlan.profile.displayName, "Houman");
assert.deepEqual([...upgradedGymPlan.planExerciseIds], [...corePrehabExerciseIds]);
assert.equal(upgradedGymPlan.planClinicianConfirmed, false);
assert.deepEqual(upgradedGymPlan.doses["cable-face-pull"], defaultPrehabDoses["cable-face-pull"]);
assert.equal(upgradedGymPlan.doses["single-leg-press"]?.sets, 4);
assert.equal(upgradedGymPlan.doses["assisted-dip"]?.loadKg, null);

const customizedWholeBody = structuredClone(wholeBodySeed);
customizedWholeBody.doses["machine-chest-press"] = { ...previousWholeBodyDoses["machine-chest-press"], reps: 6 };
customizedWholeBody.doses["cable-face-pull"] = { ...defaultPrehabDoses["cable-face-pull"], reps: 6 };
const preservedWholeBody = parseState(customizedWholeBody);
assert.deepEqual([...preservedWholeBody.planExerciseIds], [...corePrehabExerciseIds]);
assert.equal(preservedWholeBody.doses["machine-chest-press"]?.reps, 6);
assert.equal(preservedWholeBody.doses["cable-face-pull"]?.reps, 6, "a dose already stored for a missing id is not replaced");
assert.equal(preservedWholeBody.planClinicianConfirmed, false);

const confirmedCurrentPlan = structuredClone(initialState);
confirmedCurrentPlan.planClinicianConfirmed = true;
confirmedCurrentPlan.doses["heel-slide"] = { ...defaultPrehabDoses["heel-slide"], reps: 9 };
const stillConfirmed = parseState(confirmedCurrentPlan);
assert.equal(stillConfirmed.planClinicianConfirmed, true, "confirmation stays when no new ids were added");
assert.equal(stillConfirmed.doses["heel-slide"]?.reps, 9);

const wholeBodyWithDraft = structuredClone(wholeBodySeed);
wholeBodyWithDraft.sessionDraft = {
  id: "whole-body-draft",
  episodeId: initialState.activeEpisodeId,
  routineId: "routine-right-prehab-foundations",
  startedAt: "2026-09-21T10:00:00.000Z",
  updatedAt: "2026-09-21T10:05:00.000Z",
  painBefore: 1,
  swellingBefore: "none",
  currentExerciseIndex: 0,
  exercises: [{
    exerciseId: "machine-chest-press",
    exerciseName: "Chest press",
    prescribedDose: { ...previousWholeBodyDoses["machine-chest-press"] },
    outcome: null,
    sets: [{ reps: null, loadKg: null, completed: false }],
  }],
};
assert.deepEqual([...parseState(wholeBodyWithDraft).planExerciseIds], [...previousWholeBodyExerciseIds]);

const missingCollections = structuredClone(initialState) as unknown as Record<string, unknown>;
delete missingCollections.weightEntries;
delete missingCollections.checkIns;
delete missingCollections.scheduleOverrides;
delete missingCollections.planUpdatedAt;
delete missingCollections.syncConsentAt;
delete missingCollections.weightGoalKg;
const parsedMissing = parseState(missingCollections);
assert.deepEqual(parsedMissing.weightEntries, []);
assert.deepEqual(parsedMissing.checkIns, []);
assert.deepEqual(parsedMissing.scheduleOverrides, []);
assert.equal(parsedMissing.syncConsentAt, null);
assert.equal(parsedMissing.weightGoalKg, null);

await assert.rejects(
  () => importState(new File([new Uint8Array(2_000_001)], "oversized.json", { type: "application/json" })),
  /limit is 2 MB/,
);

console.log("State parser tests passed.");
