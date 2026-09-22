import { corePrehabExerciseIds, DEFAULT_GOAL_LABEL, defaultPrehabDoses, exercises, previousSeededPrehabDoses, previousSeededPrehabExerciseIds, SEEDED_PLAN_UPDATED_AT, seedData } from "./data";
import type {
  CheckIn,
  DayChoice,
  ExerciseDose,
  ExerciseRecord,
  LocalAppState,
  ScheduleOverride,
  SessionDraft,
  SessionExerciseDraft,
  SessionExerciseLog,
  SessionExerciseStatus,
  SessionLog,
  SessionSetLog,
  WeightEntry,
} from "./types";

const STORAGE_KEY = "knee-forward:state:v1";

const emptyDose = (): ExerciseDose => ({
  sets: null,
  reps: null,
  loadKg: null,
  holdSeconds: null,
  durationMinutes: null,
  rangeNote: "",
});

export const initialState: LocalAppState = {
  schemaVersion: 1,
  profile: {
    onboardingComplete: false,
    displayName: "",
    affectedKnee: "right",
    rehabStage: "pre_surgery",
    currentPhaseId: "prehab",
    plannedSurgeryDate: null,
    timeZone: null,
    goalLabel: DEFAULT_GOAL_LABEL,
  },
  activeEpisodeId: "episode-right-acl-2026",
  planClinicianConfirmed: false,
  reminderTime: "18:30",
  reminderDays: [1, 3, 5],
  reminderDismissedOn: null,
  planExerciseIds: corePrehabExerciseIds.slice(),
  doses: Object.fromEntries(corePrehabExerciseIds.map((id) => [id, { ...defaultPrehabDoses[id] }])),
  planUpdatedAt: SEEDED_PLAN_UPDATED_AT,
  scheduleOverrides: [],
  weightGoalKg: null,
  weightEntries: [],
  checkIns: [],
  syncConsentAt: null,
  sessions: [],
  sessionDraft: null,
};

export interface StorageRecovery {
  raw: string | null;
  message: string;
}

export interface LoadedState {
  state: LocalAppState;
  recovery: StorageRecovery | null;
}

type UnknownRecord = Record<string, unknown>;
/** Previous shipped prehab placeholder: seven exercises and no recorded dose. */
const legacyUnspecifiedPrehabExerciseIds = [
  "single-leg-knee-extension-machine",
  "single-leg-hamstring-curl-machine",
  "single-leg-press",
  "squat",
  "standing-single-leg-heel-raise",
  "standing-hip-abduction-external-rotation-fire-hydrant",
  "modified-single-leg-deadlift",
] as const;

function doseIsBlank(dose: ExerciseDose) {
  return dose.sets === null
    && dose.reps === null
    && dose.loadKg === null
    && dose.holdSeconds === null
    && dose.durationMinutes === null
    && dose.rangeNote === "";
}

function sameDose(left: ExerciseDose, right: ExerciseDose) {
  return left.sets === right.sets
    && left.reps === right.reps
    && left.loadKg === right.loadKg
    && left.holdSeconds === right.holdSeconds
    && left.durationMinutes === right.durationMinutes
    && left.rangeNote === right.rangeNote;
}

function isLegacyUnspecifiedPrehabPlan(planExerciseIds: readonly string[], doses: Record<string, ExerciseDose>) {
  if (planExerciseIds.length !== legacyUnspecifiedPrehabExerciseIds.length) return false;
  const expected = new Set<string>(legacyUnspecifiedPrehabExerciseIds);
  return planExerciseIds.every((id) => expected.has(id) && doseIsBlank(doses[id] ?? emptyDose()));
}

const exerciseCatalog: readonly ExerciseRecord[] = exercises;
const knownExerciseIds = new Set<string>(exerciseCatalog.map((exercise) => exercise.id));
const planEligibleExerciseIds = new Set<string>(exerciseCatalog.filter((exercise) => exercise.planEligible !== false).map((exercise) => exercise.id));
const knownEpisodeIds = new Set<string>(seedData.episodes.map((episode) => episode.id));
const knownPhaseIds = new Set<string>(seedData.phases.map((phase) => phase.id));
const lateralityValues = new Set(["left", "right"]);
const rehabStageValues = new Set(["pre_surgery", "post_surgery", "non_surgical"]);
const swellingValues = new Set(["none", "mild", "moderate", "marked"]);
const sessionExerciseStatuses = new Set<SessionExerciseStatus>(["completed", "partial", "skipped", "stopped"]);

function validTimeZone(value: string) {
  try {
    Intl.DateTimeFormat("en-US", { timeZone: value }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

function validDateTime(value: unknown): value is string {
  return typeof value === "string" && value.length <= 40 && Number.isFinite(Date.parse(value));
}

function parseScheduleOverrides(value: unknown): ScheduleOverride[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 400) throw new Error("The saved training-location overrides are invalid.");
  const choices = new Set<DayChoice>(["home", "gym", "rest"]);
  const byDate = new Map<string, ScheduleOverride>();
  for (const item of value) {
    if (!isRecord(item) || !validISODate(item.date) || typeof item.choice !== "string" || !choices.has(item.choice as DayChoice)) {
      throw new Error("A saved training-location override is invalid.");
    }
    byDate.set(item.date, { date: item.date, choice: item.choice as DayChoice });
  }
  return [...byDate.values()].sort((left, right) => left.date < right.date ? -1 : 1);
}

function parseWeightEntries(value: unknown): WeightEntry[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 5_000) throw new Error("The saved weight log is invalid.");
  const byDate = new Map<string, WeightEntry>();
  for (const item of value) {
    if (!isRecord(item) || !validString(item.id, 80) || item.id.length === 0 || !validISODate(item.recordedOn) || !validDateTime(item.updatedAt)) {
      throw new Error("A saved weight entry is invalid.");
    }
    if (typeof item.weightKg !== "number" || !Number.isFinite(item.weightKg) || item.weightKg < 20 || item.weightKg > 400) {
      throw new Error("A saved weight entry has an invalid weight.");
    }
    const entry = { id: item.id, recordedOn: item.recordedOn, weightKg: item.weightKg, updatedAt: item.updatedAt };
    const current = byDate.get(entry.recordedOn);
    if (!current || entry.updatedAt >= current.updatedAt) byDate.set(entry.recordedOn, entry);
  }
  return [...byDate.values()].sort((left, right) => right.recordedOn < left.recordedOn ? -1 : right.recordedOn > left.recordedOn ? 1 : right.updatedAt < left.updatedAt ? -1 : 1);
}

function parseCheckIns(value: unknown): CheckIn[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 10_000) throw new Error("The saved check-in history is invalid.");
  const seen = new Set<string>();
  return value.map((item) => {
    if (!isRecord(item) || !validString(item.id, 80) || item.id.length === 0 || !validString(item.episodeId, 200) || !validDateTime(item.recordedAt) || !validDateTime(item.updatedAt)) {
      throw new Error("A saved check-in is invalid.");
    }
    if (seen.has(item.id)) throw new Error("The saved check-in history has a duplicate id.");
    seen.add(item.id);
    if (item.sessionId !== null && !validString(item.sessionId, 80)) throw new Error("A saved check-in session link is invalid.");
    const painBefore = item.painBefore;
    const painAfter = item.painAfter;
    if (typeof painBefore !== "number" || !Number.isInteger(painBefore) || painBefore < 0 || painBefore > 10) {
      throw new Error("A saved check-in has an invalid pain value.");
    }
    if (painAfter !== null && (typeof painAfter !== "number" || !Number.isInteger(painAfter) || painAfter < 0 || painAfter > 10)) {
      throw new Error("A saved check-in has an invalid pain value.");
    }
    if (typeof item.swellingBefore !== "string" || !swellingValues.has(item.swellingBefore)) {
      throw new Error("A saved check-in has an invalid swelling value.");
    }
    if (item.swellingAfter !== null && (typeof item.swellingAfter !== "string" || !swellingValues.has(item.swellingAfter))) {
      throw new Error("A saved check-in has an invalid swelling value.");
    }
    return {
      id: item.id,
      episodeId: item.episodeId,
      sessionId: (item.sessionId as string | null),
      recordedAt: item.recordedAt,
      painBefore,
      painAfter: painAfter as number | null,
      swellingBefore: item.swellingBefore as CheckIn["swellingBefore"],
      swellingAfter: item.swellingAfter as CheckIn["swellingAfter"],
      updatedAt: item.updatedAt,
    };
  });
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validString(value: unknown, maxLength = 2_000): value is string {
  return typeof value === "string" && value.length <= maxLength;
}

function validISODate(value: unknown): value is NonNullable<LocalAppState["profile"]["plannedSurgeryDate"]> {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year!, month! - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month! - 1 && date.getUTCDate() === day;
}

function nullableNumber(value: unknown, min: number, max: number, integer = false): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value))) {
    throw new Error("A dose contains an invalid number.");
  }
  return value;
}

function parseDose(value: unknown): ExerciseDose {
  if (!isRecord(value)) throw new Error("A saved exercise dose is invalid.");
  if (value.rangeNote !== undefined && !validString(value.rangeNote, 1_000)) {
    throw new Error("A saved range note is invalid or too long.");
  }
  return {
    sets: nullableNumber(value.sets, 1, 50, true),
    reps: nullableNumber(value.reps, 1, 500, true),
    loadKg: nullableNumber(value.loadKg, 0, 1_000),
    holdSeconds: nullableNumber(value.holdSeconds, 1, 3_600, true),
    durationMinutes: nullableNumber(value.durationMinutes, 0.25, 480),
    rangeNote: (value.rangeNote as string | undefined) ?? "",
  };
}

function requiredNullableNumber(value: unknown, min: number, max: number, integer = false): number | null {
  if (value === null) return null;
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value))) {
    throw new Error("A saved prescribed dose contains an invalid number.");
  }
  return value;
}

function parsePrescribedDose(value: unknown): ExerciseDose {
  if (!isRecord(value) || !validString(value.rangeNote, 1_000)) throw new Error("A saved prescribed dose is invalid.");
  return {
    sets: requiredNullableNumber(value.sets, 1, 50, true),
    reps: requiredNullableNumber(value.reps, 1, 500, true),
    loadKg: requiredNullableNumber(value.loadKg, 0, 1_000),
    holdSeconds: requiredNullableNumber(value.holdSeconds, 1, 3_600, true),
    durationMinutes: requiredNullableNumber(value.durationMinutes, 0.25, 480),
    rangeNote: value.rangeNote,
  };
}

function parseSessionSet(value: unknown): SessionSetLog {
  if (!isRecord(value)) throw new Error("A saved session set is invalid.");
  const rawReps = value.reps;
  if (rawReps !== null && (typeof rawReps !== "number" || !Number.isInteger(rawReps) || rawReps < 1 || rawReps > 500)) {
    throw new Error("A saved session set has an invalid repetition count.");
  }
  const reps = rawReps as number | null;
  const rawLoadKg = value.loadKg;
  if (rawLoadKg !== null && (typeof rawLoadKg !== "number" || !Number.isFinite(rawLoadKg) || rawLoadKg < 0 || rawLoadKg > 1_000)) {
    throw new Error("A saved session set has an invalid load.");
  }
  const loadKg = rawLoadKg as number | null;
  if (typeof value.completed !== "boolean") throw new Error("A saved session set has an invalid completion value.");
  return { reps, loadKg, completed: value.completed };
}

function parseExerciseLogs(value: unknown, completedExerciseIds: readonly string[]): SessionExerciseLog[] {
  if (!Array.isArray(value) || value.length > 200) throw new Error("A saved session exercise log collection is invalid.");
  if (value.length === 0) return [];
  const completedIds = new Set(completedExerciseIds);
  const seenIds = new Set<string>();
  const exerciseLogs = value.map((exerciseLog) => {
    if (!isRecord(exerciseLog) || typeof exerciseLog.exerciseId !== "string" || !knownExerciseIds.has(exerciseLog.exerciseId)) {
      throw new Error("A saved session exercise log references an unknown exercise.");
    }
    if (seenIds.has(exerciseLog.exerciseId)) throw new Error("A saved session has duplicate exercise logs.");
    seenIds.add(exerciseLog.exerciseId);
    if (!validString(exerciseLog.exerciseName, 500) || exerciseLog.exerciseName.length === 0) {
      throw new Error("A saved session exercise log has an invalid exercise name.");
    }
    if (typeof exerciseLog.status !== "string" || !sessionExerciseStatuses.has(exerciseLog.status as SessionExerciseStatus)) {
      throw new Error("A saved session exercise log has an invalid status.");
    }
    if (!Array.isArray(exerciseLog.sets) || exerciseLog.sets.length < 1 || exerciseLog.sets.length > 50) {
      throw new Error("A saved session exercise log has an invalid set collection.");
    }
    return {
      exerciseId: exerciseLog.exerciseId,
      exerciseName: exerciseLog.exerciseName,
      prescribedDose: parsePrescribedDose(exerciseLog.prescribedDose),
      status: exerciseLog.status as SessionExerciseStatus,
      sets: exerciseLog.sets.map(parseSessionSet),
    };
  });
  let completedLogCount = 0;
  for (const exerciseLog of exerciseLogs) {
    const performedSetCount = exerciseLog.sets.filter((set) => set.completed).length;
    if (exerciseLog.status === "completed" && performedSetCount !== exerciseLog.sets.length) {
      throw new Error("A completed exercise log contains an unfinished set.");
    }
    if (exerciseLog.status === "partial" && performedSetCount === 0) {
      throw new Error("A partial exercise log contains no completed set.");
    }
    if (exerciseLog.status === "skipped" && performedSetCount !== 0) {
      throw new Error("A skipped exercise log contains a completed set.");
    }
    if (exerciseLog.status === "completed") completedLogCount += 1;
    if (completedIds.has(exerciseLog.exerciseId) !== (exerciseLog.status === "completed")) {
      throw new Error("A saved session completion list does not match its exercise logs.");
    }
  }
  if (completedLogCount !== completedIds.size) {
    throw new Error("A saved session completion list does not match its exercise logs.");
  }
  return exerciseLogs;
}

function parseSessionExerciseDraft(value: unknown): SessionExerciseDraft {
  if (!isRecord(value) || typeof value.exerciseId !== "string" || !knownExerciseIds.has(value.exerciseId)) {
    throw new Error("A saved session draft references an unknown exercise.");
  }
  if (!validString(value.exerciseName, 500) || value.exerciseName.length === 0) {
    throw new Error("A saved session draft has an invalid exercise name.");
  }
  if (value.outcome !== null && (typeof value.outcome !== "string" || !sessionExerciseStatuses.has(value.outcome as SessionExerciseStatus))) {
    throw new Error("A saved session draft has an invalid exercise outcome.");
  }
  if (!Array.isArray(value.sets) || value.sets.length < 1 || value.sets.length > 50) {
    throw new Error("A saved session draft has an invalid set collection.");
  }
  return {
    exerciseId: value.exerciseId,
    exerciseName: value.exerciseName,
    prescribedDose: parsePrescribedDose(value.prescribedDose),
    outcome: value.outcome as SessionExerciseStatus | null,
    sets: value.sets.map(parseSessionSet),
  };
}

function parseSessionDraft(value: unknown, activeEpisodeId: string): SessionDraft {
  if (!isRecord(value)) throw new Error("The saved session draft is invalid.");
  if (!validString(value.id, 200) || !validString(value.routineId, 200)) {
    throw new Error("The saved session draft has invalid identity data.");
  }
  if (!validString(value.episodeId, 200) || !knownEpisodeIds.has(value.episodeId) || value.episodeId !== activeEpisodeId) {
    throw new Error("The saved session draft references an invalid rehabilitation episode.");
  }
  if (
    !validString(value.startedAt, 100) || Number.isNaN(Date.parse(value.startedAt)) ||
    !validString(value.updatedAt, 100) || Number.isNaN(Date.parse(value.updatedAt)) ||
    Date.parse(value.updatedAt) < Date.parse(value.startedAt)
  ) {
    throw new Error("The saved session draft has invalid date data.");
  }
  const painBefore = nullableNumber(value.painBefore, 0, 10);
  if (painBefore === null) throw new Error("The saved session draft pain score is missing.");
  if (!swellingValues.has(value.swellingBefore as string)) throw new Error("The saved session draft has an invalid swelling value.");
  if (!Array.isArray(value.exercises) || value.exercises.length < 1 || value.exercises.length > 200) {
    throw new Error("The saved session draft has an invalid exercise collection.");
  }
  const exercises = value.exercises.map(parseSessionExerciseDraft);
  if (new Set(exercises.map((exercise) => exercise.exerciseId)).size !== exercises.length) {
    throw new Error("The saved session draft has duplicate exercises.");
  }
  if (!Number.isInteger(value.currentExerciseIndex) || (value.currentExerciseIndex as number) < 0 || (value.currentExerciseIndex as number) >= exercises.length) {
    throw new Error("The saved session draft has an invalid current exercise index.");
  }
  return {
    id: value.id,
    episodeId: value.episodeId,
    routineId: value.routineId,
    startedAt: value.startedAt,
    updatedAt: value.updatedAt,
    painBefore,
    swellingBefore: value.swellingBefore as SessionDraft["swellingBefore"],
    currentExerciseIndex: value.currentExerciseIndex as number,
    exercises,
  };
}

function parseSession(value: unknown, fallbackEpisodeId: string): SessionLog {
  if (!isRecord(value)) throw new Error("A saved session is invalid.");
  const painBefore = nullableNumber(value.painBefore, 0, 10);
  const painAfter = nullableNumber(value.painAfter, 0, 10);
  if (painBefore === null || painAfter === null) throw new Error("A session pain score is missing.");
  if (!validString(value.id, 200) || !validString(value.routineId, 200) || !validString(value.completedAt, 100) || Number.isNaN(Date.parse(value.completedAt))) {
    throw new Error("A saved session has invalid identity or date data.");
  }
  const episodeId = validString(value.episodeId, 200) ? value.episodeId : fallbackEpisodeId;
  if (!knownEpisodeIds.has(episodeId)) throw new Error("A saved session references an unknown episode.");
  if (!swellingValues.has(value.swellingBefore as string) || !swellingValues.has(value.swellingAfter as string)) {
    throw new Error("A saved session has an invalid swelling value.");
  }
  if (!Array.isArray(value.completedExerciseIds) || value.completedExerciseIds.some((id) => typeof id !== "string" || !knownExerciseIds.has(id))) {
    throw new Error("A saved session references an unknown exercise.");
  }
  const completedExerciseIds = value.completedExerciseIds as string[];
  if (new Set(completedExerciseIds).size !== completedExerciseIds.length) {
    throw new Error("A saved session has duplicate completed exercises.");
  }
  const exerciseLogs = value.exerciseLogs === undefined ? [] : parseExerciseLogs(value.exerciseLogs, completedExerciseIds);
  if (!validString(value.note ?? "", 10_000)) throw new Error("A saved session note is invalid or too long.");
  return {
    id: value.id,
    episodeId,
    routineId: value.routineId,
    completedAt: value.completedAt,
    painBefore,
    painAfter,
    swellingBefore: value.swellingBefore as SessionLog["swellingBefore"],
    swellingAfter: value.swellingAfter as SessionLog["swellingAfter"],
    completedExerciseIds,
    exerciseLogs,
    note: (value.note as string | undefined) ?? "",
  };
}

export function parseState(value: unknown): LocalAppState {
  if (!isRecord(value) || value.schemaVersion !== 1) throw new Error("Unsupported Knee Forward backup version.");
  let activeEpisodeId = initialState.activeEpisodeId;
  if (value.activeEpisodeId !== undefined) {
    if (!validString(value.activeEpisodeId, 200) || !knownEpisodeIds.has(value.activeEpisodeId)) {
      throw new Error("The saved state references an unknown rehabilitation episode.");
    }
    activeEpisodeId = value.activeEpisodeId;
  }
  const rawPlanIds = value.planExerciseIds === undefined ? initialState.planExerciseIds : value.planExerciseIds;
  if (!Array.isArray(rawPlanIds) || rawPlanIds.length === 0 || rawPlanIds.some((id) => typeof id !== "string" || !planEligibleExerciseIds.has(id))) {
    throw new Error("The saved plan contains an unknown exercise or a library-only demonstration.");
  }
  const planExerciseIds = [...new Set(rawPlanIds as string[])];
  const activeEpisode = seedData.episodes.find((episode) => episode.id === activeEpisodeId);
  if (!activeEpisode || activeEpisode.status !== "active" || activeEpisode.id !== seedData.activeEpisodeId) {
    throw new Error("Only the current active rehabilitation episode can be restored.");
  }
  const rawDoses = value.doses === undefined ? {} : value.doses;
  if (!isRecord(rawDoses)) throw new Error("The saved dose collection is invalid.");
  const doses: Record<string, ExerciseDose> = {};
  for (const exerciseId of knownExerciseIds) {
    doses[exerciseId] = rawDoses[exerciseId] === undefined ? emptyDose() : parseDose(rawDoses[exerciseId]);
  }
  if (!Array.isArray(value.sessions) || value.sessions.length > 10_000) throw new Error("The saved session history is invalid.");
  const reminderDays = value.reminderDays === undefined ? initialState.reminderDays : value.reminderDays;
  if (!Array.isArray(reminderDays) || reminderDays.some((day) => !Number.isInteger(day) || day < 0 || day > 6)) {
    throw new Error("The saved reminder days are invalid.");
  }
  let reminderTime = initialState.reminderTime;
  if (value.reminderTime !== undefined) {
    if (!validString(value.reminderTime, 5) || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value.reminderTime)) {
      throw new Error("The saved reminder time is invalid.");
    }
    reminderTime = value.reminderTime;
  }
  if (value.planClinicianConfirmed !== undefined && typeof value.planClinicianConfirmed !== "boolean") {
    throw new Error("The saved plan confirmation is invalid.");
  }
  const dismissed = value.reminderDismissedOn;
  if (dismissed !== undefined && dismissed !== null && !validISODate(dismissed)) {
    throw new Error("The saved reminder acknowledgement is invalid.");
  }
  const rawProfile = value.profile;
  const profile = isRecord(rawProfile) ? rawProfile : {};
  const displayName = profile.displayName;
  if (displayName !== undefined && !validString(displayName, 40)) {
    throw new Error("The saved profile name is invalid.");
  }
  const affectedKnee = profile.affectedKnee ?? initialState.profile.affectedKnee;
  if (typeof affectedKnee !== "string" || !lateralityValues.has(affectedKnee)) {
    throw new Error("The saved affected knee is invalid.");
  }
  const rehabStage = profile.rehabStage ?? initialState.profile.rehabStage;
  if (typeof rehabStage !== "string" || !rehabStageValues.has(rehabStage)) {
    throw new Error("The saved rehab path is invalid.");
  }
  const currentPhaseId = profile.currentPhaseId ?? initialState.profile.currentPhaseId;
  if (typeof currentPhaseId !== "string" || !knownPhaseIds.has(currentPhaseId)) {
    throw new Error("The saved rehab phase is invalid.");
  }
  const phaseMatchesStage = rehabStage === "pre_surgery"
    ? currentPhaseId === "prehab"
    : rehabStage === "post_surgery"
      ? currentPhaseId !== "prehab"
      : currentPhaseId !== "prehab" && currentPhaseId !== "protect-and-settle";
  if (!phaseMatchesStage) throw new Error("The saved rehab phase does not match the rehab path.");
  const plannedSurgeryDate = profile.plannedSurgeryDate;
  if (plannedSurgeryDate !== undefined && plannedSurgeryDate !== null && !validISODate(plannedSurgeryDate)) {
    throw new Error("The saved surgery date is invalid.");
  }
  let resolvedPlanExerciseIds = planExerciseIds;
  let planClinicianConfirmed = value.planClinicianConfirmed === true;
  const upgradeLegacyPlan = affectedKnee === "right"
    && rehabStage === "pre_surgery"
    && currentPhaseId === "prehab"
    && (value.sessionDraft === undefined || value.sessionDraft === null)
    && isLegacyUnspecifiedPrehabPlan(planExerciseIds, doses);
  if (upgradeLegacyPlan) {
    resolvedPlanExerciseIds = [...corePrehabExerciseIds];
    for (const exerciseId of corePrehabExerciseIds) {
      if (doseIsBlank(doses[exerciseId] ?? emptyDose())) doses[exerciseId] = { ...defaultPrehabDoses[exerciseId] };
    }
    planClinicianConfirmed = false;
  }
  const unmodifiedPreviousSeed = affectedKnee === "right"
    && rehabStage === "pre_surgery"
    && currentPhaseId === "prehab"
    && (value.sessionDraft === undefined || value.sessionDraft === null)
    && resolvedPlanExerciseIds.length === previousSeededPrehabExerciseIds.length
    && previousSeededPrehabExerciseIds.every((exerciseId, index) => resolvedPlanExerciseIds[index] === exerciseId)
    && previousSeededPrehabExerciseIds.every((exerciseId) => sameDose(doses[exerciseId] ?? emptyDose(), previousSeededPrehabDoses[exerciseId]));
  if (unmodifiedPreviousSeed) {
    resolvedPlanExerciseIds = [...corePrehabExerciseIds];
    for (const exerciseId of corePrehabExerciseIds) doses[exerciseId] = { ...defaultPrehabDoses[exerciseId] };
    planClinicianConfirmed = false;
  }
  const goalLabel = profile.goalLabel;
  if (goalLabel !== undefined && !validString(goalLabel, 80)) throw new Error("The saved profile goal is invalid.");
  const timeZone = profile.timeZone;
  if (timeZone !== undefined && timeZone !== null && (!validString(timeZone, 80) || !validTimeZone(timeZone))) {
    throw new Error("The saved time zone is invalid.");
  }
  let planUpdatedAt = SEEDED_PLAN_UPDATED_AT;
  if (value.planUpdatedAt !== undefined) {
    if (!validDateTime(value.planUpdatedAt)) throw new Error("The saved plan timestamp is invalid.");
    planUpdatedAt = value.planUpdatedAt;
  }
  const weightGoalKg = value.weightGoalKg;
  if (weightGoalKg !== undefined && weightGoalKg !== null && (typeof weightGoalKg !== "number" || !Number.isFinite(weightGoalKg) || weightGoalKg < 20 || weightGoalKg > 400)) {
    throw new Error("The saved weight goal is invalid.");
  }
  const syncConsentAt = value.syncConsentAt;
  if (syncConsentAt !== undefined && syncConsentAt !== null && !validDateTime(syncConsentAt)) {
    throw new Error("The saved sync consent is invalid.");
  }
  const planMatchesCurrentPhase = resolvedPlanExerciseIds.every((exerciseId) => exerciseCatalog
    .find((exercise) => exercise.id === exerciseId)
    ?.eligiblePhaseIds.includes(currentPhaseId));

  return {
    schemaVersion: 1,
    profile: {
      onboardingComplete: profile.onboardingComplete === true,
      displayName: (displayName as string | undefined)?.trim() ?? "",
      affectedKnee: affectedKnee as LocalAppState["profile"]["affectedKnee"],
      rehabStage: rehabStage as LocalAppState["profile"]["rehabStage"],
      currentPhaseId,
      plannedSurgeryDate: (plannedSurgeryDate as LocalAppState["profile"]["plannedSurgeryDate"] | undefined) ?? null,
      timeZone: (timeZone as string | null | undefined) ?? null,
      goalLabel: (goalLabel as string | undefined)?.trim() || DEFAULT_GOAL_LABEL,
    },
    activeEpisodeId,
    planClinicianConfirmed: planClinicianConfirmed && planMatchesCurrentPhase,
    reminderTime,
    reminderDays: [...new Set(reminderDays as number[])].sort(),
    reminderDismissedOn: (dismissed as LocalAppState["reminderDismissedOn"] | undefined) ?? null,
    planExerciseIds: resolvedPlanExerciseIds,
    doses,
    planUpdatedAt,
    scheduleOverrides: parseScheduleOverrides(value.scheduleOverrides),
    weightGoalKg: (weightGoalKg as number | null | undefined) ?? null,
    weightEntries: parseWeightEntries(value.weightEntries),
    checkIns: parseCheckIns(value.checkIns),
    syncConsentAt: (syncConsentAt as string | null | undefined) ?? null,
    sessions: value.sessions.map((session) => parseSession(session, activeEpisodeId)),
    sessionDraft: value.sessionDraft === undefined || value.sessionDraft === null ? null : parseSessionDraft(value.sessionDraft, activeEpisodeId),
  };
}

export function loadState(): LoadedState {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { state: initialState, recovery: null };
    return { state: parseState(JSON.parse(raw)), recovery: null };
  } catch (error) {
    return {
      state: initialState,
      recovery: {
        raw,
        message: error instanceof Error ? error.message : "The saved local data could not be read.",
      },
    };
  }
}

export function saveState(state: LocalAppState) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(parseState(state)));
}

export function exportRecoveryData(recovery: StorageRecovery) {
  if (recovery.raw === null) return;
  const blob = new Blob([recovery.raw], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `knee-forward-recovery-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

export function exportState(state: LocalAppState) {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `knee-forward-backup-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

export async function importState(file: File): Promise<LocalAppState> {
  if (file.size > 2_000_000) throw new Error("This backup is too large. The limit is 2 MB.");
  try {
    return parseState(JSON.parse(await file.text()));
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : "This is not a valid Knee Forward backup.");
  }
}
