import { exercises } from "./data";
import type { ExerciseDose, ExerciseRecord, LocalAppState } from "./types";

export interface SharedPlan {
  v: 1;
  exercises: readonly { id: string; dose: ExerciseDose }[];
}

const exerciseCatalog: readonly ExerciseRecord[] = exercises;
const eligibleIds = new Set<string>(exerciseCatalog.filter((exercise) => exercise.planEligible !== false).map((exercise) => exercise.id));

function hasOnlyKeys(record: Record<string, unknown>, keys: readonly string[]) {
  const actual = Object.keys(record);
  return actual.length === keys.length && actual.every((key) => keys.includes(key));
}

function encodeBase64Url(value: string) {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

function decodeBase64Url(value: string) {
  if (!/^[A-Za-z0-9_-]+$/.test(value) || value.length > 12_000) throw new Error("This plan link is invalid.");
  const padded = value.replaceAll("-", "+").replaceAll("_", "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  return new TextDecoder().decode(Uint8Array.from(binary, (character) => character.charCodeAt(0)));
}

function parseNullableNumber(value: unknown, min: number, max: number, integer = false) {
  if (value === null) return null;
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value))) {
    throw new Error("This plan link contains an invalid dose.");
  }
  return value;
}

function parseDose(value: unknown): ExerciseDose {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("This plan link contains an invalid dose.");
  const dose = value as Record<string, unknown>;
  if (!hasOnlyKeys(dose, ["sets", "reps", "loadKg", "holdSeconds", "durationMinutes", "rangeNote"])) {
    throw new Error("This plan link contains an invalid dose.");
  }
  if (typeof dose.rangeNote !== "string" || dose.rangeNote.length > 1_000) throw new Error("This plan link contains an invalid note.");
  return {
    sets: parseNullableNumber(dose.sets, 1, 50, true),
    reps: parseNullableNumber(dose.reps, 1, 500, true),
    loadKg: parseNullableNumber(dose.loadKg, 0, 1_000),
    holdSeconds: parseNullableNumber(dose.holdSeconds, 1, 3_600, true),
    durationMinutes: parseNullableNumber(dose.durationMinutes, 0.25, 480),
    rangeNote: dose.rangeNote,
  };
}

export function sharedPlanFromState(state: LocalAppState): SharedPlan {
  return {
    v: 1,
    exercises: state.planExerciseIds.map((id) => ({ id, dose: { ...state.doses[id], rangeNote: "" } })),
  };
}

export function encodeSharedPlan(plan: SharedPlan) {
  const encoded = encodeBase64Url(JSON.stringify(plan));
  if (encoded.length > 12_000) throw new Error("This plan is too large to share as a link.");
  return encoded;
}

export function decodeSharedPlan(encoded: string): SharedPlan {
  let value: unknown;
  try {
    value = JSON.parse(decodeBase64Url(encoded));
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("This plan link")) throw error;
    throw new Error("This plan link could not be read.");
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("This plan link is invalid.");
  const raw = value as Record<string, unknown>;
  if (!hasOnlyKeys(raw, ["v", "exercises"]) || raw.v !== 1 || !Array.isArray(raw.exercises) || raw.exercises.length < 1 || raw.exercises.length > exercises.length) {
    throw new Error("This plan link uses an unsupported format.");
  }
  const seen = new Set<string>();
  const parsed = raw.exercises.map((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) throw new Error("This plan link contains an invalid exercise.");
    const record = item as Record<string, unknown>;
    if (!hasOnlyKeys(record, ["id", "dose"]) || typeof record.id !== "string" || !eligibleIds.has(record.id) || seen.has(record.id)) throw new Error("This plan link contains an unknown or duplicate exercise.");
    seen.add(record.id);
    return { id: record.id, dose: parseDose(record.dose) };
  });
  return { v: 1, exercises: parsed };
}

export function createSharedPlanUrl(state: LocalAppState, location: Pick<Location, "origin">) {
  const url = new URL("/today/", location.origin);
  url.searchParams.set("plan", encodeSharedPlan(sharedPlanFromState(state)));
  return url.toString();
}

export function applySharedPlan(state: LocalAppState, plan: SharedPlan): LocalAppState {
  const incompatible = plan.exercises.some(({ id }) => {
    const exercise = exerciseCatalog.find((item) => item.id === id);
    return !exercise || !exercise.eligiblePhaseIds.includes(state.profile.currentPhaseId);
  });
  if (incompatible) throw new Error("This plan includes exercises outside your current rehab phase.");
  return {
    ...state,
    planClinicianConfirmed: false,
    planExerciseIds: plan.exercises.map((exercise) => exercise.id),
    doses: {
      ...state.doses,
      ...Object.fromEntries(plan.exercises.map((exercise) => [exercise.id, { ...exercise.dose }])),
    },
    sessionDraft: null,
  };
}
