import assert from "node:assert/strict";
import { initialState } from "../src/storage";
import type { SessionLog, WeightEntry } from "../src/types";
import { formatWeightGoal, formatWeightTrend, sevenDayWeightTrend, upsertWeightEntry, weekActivity } from "../src/weightLog";

const today = "2026-09-22";
const empty = sevenDayWeightTrend([], today, null);
assert.equal(empty.sampleCount, 0);
assert.equal(empty.changeKg, null);
assert.match(formatWeightTrend(empty), /No morning weight/);
assert.equal(formatWeightGoal(null).includes("calorie"), true);
assert.doesNotMatch(`${formatWeightTrend(empty)} ${formatWeightGoal(null)}`, /obese|overweight/i);

const first: WeightEntry = { id: "w1", recordedOn: "2026-09-16", weightKg: 86.4, updatedAt: "2026-09-16T15:00:00.000Z" };
const second: WeightEntry = { id: "w2", recordedOn: "2026-09-22", weightKg: 85.8, updatedAt: "2026-09-22T15:00:00.000Z" };
const outside: WeightEntry = { id: "old", recordedOn: "2026-09-01", weightKg: 90, updatedAt: "2026-09-01T15:00:00.000Z" };
const trend = sevenDayWeightTrend([second, outside, first], today, null);
assert.equal(trend.sampleCount, 2);
assert.equal(trend.latestKg, 85.8);
assert.equal(trend.changeKg, -0.6);
assert.match(formatWeightTrend(trend), /0\.6 kg lower/);
assert.doesNotMatch(formatWeightTrend(trend), /obese|overweight|shame/i);

const replaced = upsertWeightEntry([first], { ...first, id: "w1b", weightKg: 86.1, updatedAt: "2026-09-16T18:00:00.000Z" });
assert.equal(replaced.length, 1);
assert.equal(replaced[0]?.weightKg, 86.1);

const keptOlder = upsertWeightEntry([first], { ...first, id: "older", weightKg: 99, updatedAt: "2026-09-16T12:00:00.000Z" });
assert.equal(keptOlder[0]?.weightKg, 86.4);

const one = sevenDayWeightTrend([second], today, null);
assert.equal(one.changeKg, null);
assert.match(formatWeightTrend(one), /another day/i);

const session = {
  id: "session-1",
  episodeId: initialState.activeEpisodeId,
  routineId: "routine-right-prehab-foundations",
  completedAt: "2026-09-22T18:00:00.000Z",
  painBefore: 1,
  painAfter: 2,
  swellingBefore: "none",
  swellingAfter: "mild",
  completedExerciseIds: ["band-row", "stationary-bike"],
  exerciseLogs: [
    {
      exerciseId: "heel-slide",
      exerciseName: "Heel slide",
      prescribedDose: initialState.doses["heel-slide"]!,
      status: "completed",
      sets: [{ reps: 15, loadKg: null, completed: true }],
    },
    {
      exerciseId: "band-row",
      exerciseName: "Band row",
      prescribedDose: initialState.doses["band-row"]!,
      status: "completed",
      sets: [{ reps: 12, loadKg: null, completed: true }],
    },
    {
      exerciseId: "stationary-bike",
      exerciseName: "Stationary bike",
      prescribedDose: { ...initialState.doses["stationary-bike"]!, durationMinutes: 25 },
      status: "completed",
      sets: [{ reps: null, loadKg: null, completed: true }],
    },
  ],
  note: "",
} satisfies SessionLog;

const activity = weekActivity([session], ["2026-09-21", "2026-09-22", "2026-09-23"], "America/Los_Angeles");
assert.equal(activity.strengthSessions, 1);
assert.equal(activity.cardioMinutes, 25);

const romOnly = structuredClone(session);
romOnly.id = "rom";
romOnly.exerciseLogs = [session.exerciseLogs[0]!];
romOnly.completedExerciseIds = ["heel-slide"];
const romActivity = weekActivity([romOnly], ["2026-09-22"], "America/Los_Angeles");
assert.equal(romActivity.strengthSessions, 0);
assert.equal(romActivity.cardioMinutes, 0);

console.log("Weight log tests passed.");
