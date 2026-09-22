import { parseState } from "./storage";
import type { CheckIn, LocalAppState, SessionLog, WeightEntry } from "./types";
import type { ScheduleOverride } from "./types";

export interface RemoteSnapshot {
  planUpdatedAt: string;
  profile: LocalAppState["profile"];
  activeEpisodeId: string;
  planClinicianConfirmed: boolean;
  reminderTime: string;
  reminderDays: readonly number[];
  reminderDismissedOn: LocalAppState["reminderDismissedOn"];
  planExerciseIds: readonly string[];
  doses: LocalAppState["doses"];
  scheduleOverrides: readonly ScheduleOverride[];
  weightGoalKg: number | null;
  sessions: readonly SessionLog[];
  checkIns: readonly CheckIn[];
  weightEntries: readonly WeightEntry[];
}

export interface UserPlan {
  planExerciseIds: readonly string[];
  doses: LocalAppState["doses"];
  planClinicianConfirmed: boolean;
  reminderTime: string;
  reminderDays: readonly number[];
  reminderDismissedOn: LocalAppState["reminderDismissedOn"];
  scheduleOverrides: readonly ScheduleOverride[];
  profile: LocalAppState["profile"];
  activeEpisodeId: string;
  planUpdatedAt: string;
  weightGoalKg: number | null;
}

export function planFromState(state: LocalAppState): UserPlan {
  return {
    planExerciseIds: state.planExerciseIds,
    doses: state.doses,
    planClinicianConfirmed: state.planClinicianConfirmed,
    reminderTime: state.reminderTime,
    reminderDays: state.reminderDays,
    reminderDismissedOn: state.reminderDismissedOn,
    scheduleOverrides: state.scheduleOverrides,
    profile: state.profile,
    activeEpisodeId: state.activeEpisodeId,
    planUpdatedAt: state.planUpdatedAt,
    weightGoalKg: state.weightGoalKg,
  };
}

function applyPlan(state: LocalAppState, plan: UserPlan): LocalAppState {
  return {
    ...state,
    ...plan,
    sessions: state.sessions,
    checkIns: state.checkIns,
    weightEntries: state.weightEntries,
    sessionDraft: state.sessionDraft,
    syncConsentAt: state.syncConsentAt,
  };
}

/** Sessions and check-ins are append-only: an id that already exists locally is never rewritten. */
function unionById<T extends { id: string }>(local: readonly T[], remote: readonly T[]) {
  const seen = new Set(local.map((item) => item.id));
  return [...local, ...remote.filter((item) => !seen.has(item.id))];
}

function mergeWeights(local: readonly WeightEntry[], remote: readonly WeightEntry[]) {
  const byDate = new Map<string, WeightEntry>();
  for (const entry of [...local, ...remote]) {
    const current = byDate.get(entry.recordedOn);
    if (!current || entry.updatedAt > current.updatedAt) byDate.set(entry.recordedOn, entry);
  }
  return [...byDate.values()];
}

export function mergeSnapshots(local: LocalAppState, remote: RemoteSnapshot | null): LocalAppState {
  if (!remote) return local;
  const base = remote.planUpdatedAt > local.planUpdatedAt
    ? applyPlan(local, {
      planExerciseIds: remote.planExerciseIds,
      doses: remote.doses,
      planClinicianConfirmed: remote.planClinicianConfirmed,
      reminderTime: remote.reminderTime,
      reminderDays: remote.reminderDays,
      reminderDismissedOn: remote.reminderDismissedOn,
      scheduleOverrides: remote.scheduleOverrides,
      profile: remote.profile,
      activeEpisodeId: remote.activeEpisodeId,
      planUpdatedAt: remote.planUpdatedAt,
      weightGoalKg: remote.weightGoalKg,
    })
    : local;
  const sessions = unionById(base.sessions, remote.sessions)
    .sort((left, right) => Date.parse(right.completedAt) - Date.parse(left.completedAt));
  const checkIns = unionById(base.checkIns, remote.checkIns);
  const weightEntries = mergeWeights(base.weightEntries, remote.weightEntries);
  return parseState({
    ...base,
    sessions,
    checkIns,
    weightEntries,
    sessionDraft: local.sessionDraft,
    syncConsentAt: local.syncConsentAt,
  });
}
