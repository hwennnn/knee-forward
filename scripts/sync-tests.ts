import assert from "node:assert/strict";
import { initialState } from "../src/storage";
import { mergeSnapshots, type RemoteSnapshot } from "../src/syncMerge";
import type { SessionLog } from "../src/types";

function session(id: string, note: string): SessionLog {
  return {
    id,
    episodeId: initialState.activeEpisodeId,
    routineId: "routine-right-prehab-foundations",
    completedAt: "2026-09-20T16:00:00.000Z",
    painBefore: 1,
    painAfter: 1,
    swellingBefore: "none",
    swellingAfter: "none",
    completedExerciseIds: ["heel-slide"],
    exerciseLogs: [],
    note,
  };
}

const local = structuredClone(initialState);
local.planUpdatedAt = "2026-09-22T00:00:00.000Z";
local.sessions = [session("local-only", "kept"), session("shared", "local note")];
local.weightEntries = [{ id: "local-weight", recordedOn: "2026-09-22", weightKg: 85, updatedAt: "2026-09-22T15:00:00.000Z" }];
local.syncConsentAt = "2026-09-22T12:00:00.000Z";
local.sessionDraft = {
  id: "draft",
  episodeId: initialState.activeEpisodeId,
  routineId: "routine-right-prehab-foundations",
  startedAt: "2026-09-22T16:00:00.000Z",
  updatedAt: "2026-09-22T16:05:00.000Z",
  painBefore: 0,
  swellingBefore: "none",
  currentExerciseIndex: 0,
  exercises: [{
    exerciseId: "heel-slide",
    exerciseName: "Heel slide",
    prescribedDose: initialState.doses["heel-slide"]!,
    outcome: null,
    sets: [{ reps: 15, loadKg: null, completed: false }],
  }],
};

const remote: RemoteSnapshot = {
  planUpdatedAt: "2026-09-21T00:00:00.000Z",
  profile: { ...local.profile, displayName: "Remote name" },
  activeEpisodeId: local.activeEpisodeId,
  planClinicianConfirmed: true,
  reminderTime: "07:00",
  reminderDays: [1],
  reminderDismissedOn: null,
  planExerciseIds: ["heel-slide"],
  doses: local.doses,
  scheduleOverrides: [{ date: "2026-09-21", choice: "home" }],
  weightGoalKg: 80,
  sessions: [session("shared", "remote rewrite"), session("remote-only", "from phone")],
  checkIns: [{
    id: "remote-check",
    episodeId: local.activeEpisodeId,
    sessionId: "remote-only",
    recordedAt: "2026-09-20T16:00:00.000Z",
    painBefore: 1,
    painAfter: 1,
    swellingBefore: "none",
    swellingAfter: "none",
    updatedAt: "2026-09-20T16:00:00.000Z",
  }],
  weightEntries: [
    { id: "remote-weight", recordedOn: "2026-09-21", weightKg: 85.4, updatedAt: "2026-09-21T15:00:00.000Z" },
    { id: "conflict", recordedOn: "2026-09-22", weightKg: 90, updatedAt: "2026-09-22T12:00:00.000Z" },
  ],
};

const localWins = mergeSnapshots(local, remote);
assert.equal(localWins.profile.displayName, local.profile.displayName);
assert.equal(localWins.planUpdatedAt, local.planUpdatedAt);
assert.deepEqual(localWins.sessions.map((item) => item.id), ["local-only", "shared", "remote-only"]);
assert.equal(localWins.sessions.find((item) => item.id === "shared")?.note, "local note");
assert.equal(localWins.checkIns.some((item) => item.id === "remote-check"), true);
assert.equal(localWins.weightEntries.find((item) => item.recordedOn === "2026-09-22")?.weightKg, 85);
assert.equal(localWins.weightEntries.some((item) => item.recordedOn === "2026-09-21"), true);
assert.equal(localWins.sessionDraft?.id, "draft");
assert.equal(localWins.syncConsentAt, local.syncConsentAt);

const remotePlan = mergeSnapshots(local, { ...remote, planUpdatedAt: "2026-09-23T00:00:00.000Z" });
assert.equal(remotePlan.profile.displayName, "Remote name");
assert.deepEqual([...remotePlan.planExerciseIds], ["heel-slide"]);
assert.equal(remotePlan.weightGoalKg, 80);
assert.equal(remotePlan.sessions.find((item) => item.id === "shared")?.note, "local note", "a newer plan must not rewrite session history");

console.log("Sync merge tests passed.");
