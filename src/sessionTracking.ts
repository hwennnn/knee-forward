import type {
  SessionExerciseStatus,
  SessionLog,
  SessionSetLog,
} from "./types";

export function initialPostResponse(
  painBefore: number,
  swellingBefore: SessionLog["swellingBefore"],
): Pick<SessionLog, "painAfter" | "swellingAfter"> {
  return {
    painAfter: painBefore,
    swellingAfter: swellingBefore,
  };
}

export function performedSetOutcome(
  completedSetCount: number,
  totalSetCount: number,
): Exclude<SessionExerciseStatus, "stopped"> {
  if (completedSetCount <= 0) return "skipped";
  if (completedSetCount >= totalSetCount) return "completed";
  return "partial";
}

export function previousSetsForExercise(
  sessions: readonly SessionLog[],
  episodeId: string,
  exerciseId: string,
): readonly SessionSetLog[] | null {
  const latest = [...sessions.filter((session) => session.episodeId === episodeId)]
    .sort((left, right) => Date.parse(right.completedAt) - Date.parse(left.completedAt))
    .flatMap((session) => session.exerciseLogs)
    .find((exerciseLog) => exerciseLog.exerciseId === exerciseId);
  return latest?.sets ?? null;
}
