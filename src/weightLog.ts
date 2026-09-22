import { addIsoDays, zonedParts } from "./schedule";
import type { SessionLog, WeightEntry } from "./types";

export interface WeightTrend {
  latestKg: number | null;
  averageKg: number | null;
  changeKg: number | null;
  sampleCount: number;
  goalKg: number | null;
}

export function upsertWeightEntry(entries: readonly WeightEntry[], entry: WeightEntry): WeightEntry[] {
  const byDate = new Map(entries.map((item) => [item.recordedOn, item]));
  const current = byDate.get(entry.recordedOn);
  if (!current || entry.updatedAt >= current.updatedAt) byDate.set(entry.recordedOn, entry);
  return [...byDate.values()].sort((left, right) => right.recordedOn < left.recordedOn ? -1 : right.recordedOn > left.recordedOn ? 1 : 0);
}

export function sevenDayWeightTrend(entries: readonly WeightEntry[], today: string, goalKg: number | null): WeightTrend {
  const start = addIsoDays(today, -6);
  const inWindow = entries
    .filter((entry) => entry.recordedOn >= start && entry.recordedOn <= today)
    .sort((left, right) => left.recordedOn < right.recordedOn ? -1 : left.recordedOn > right.recordedOn ? 1 : left.updatedAt < right.updatedAt ? -1 : 1);
  if (!inWindow.length) {
    return { latestKg: null, averageKg: null, changeKg: null, sampleCount: 0, goalKg };
  }
  const latest = inWindow[inWindow.length - 1]!;
  const earliest = inWindow[0]!;
  const average = inWindow.reduce((sum, entry) => sum + entry.weightKg, 0) / inWindow.length;
  return {
    latestKg: latest.weightKg,
    averageKg: Math.round(average * 10) / 10,
    changeKg: inWindow.length >= 2 ? Math.round((latest.weightKg - earliest.weightKg) * 10) / 10 : null,
    sampleCount: inWindow.length,
    goalKg,
  };
}

export function formatWeightTrend(trend: WeightTrend) {
  if (trend.sampleCount === 0) return "No morning weight logged in the last 7 days.";
  const latest = `${trend.latestKg} kg`;
  if (trend.changeKg === null) return `Latest morning weight ${latest}. Log another day this week to see the trend.`;
  if (trend.changeKg === 0) return `Latest morning weight ${latest}. Steady across this week's weigh-ins.`;
  const direction = trend.changeKg < 0 ? "lower" : "higher";
  return `Latest morning weight ${latest}. ${Math.abs(trend.changeKg)} kg ${direction} than the first weigh-in this week.`;
}

export function formatWeightGoal(goalKg: number | null) {
  if (goalKg === null) return "No weight goal yet. Nutrition stays with Kitchen and your clinician. This app does not set calorie targets.";
  return `Personal weight goal: ${goalKg} kg. Nutrition stays with Kitchen and your clinician.`;
}

const KNEE_ONLY = new Set(["band-terminal-knee-extension", "heel-slide", "quad-set", "straight-leg-raise", "lateral-band-walk"]);

export function weekActivity(sessions: readonly SessionLog[], weekDates: readonly string[], timeZone: string) {
  const dates = new Set(weekDates);
  const inWeek = sessions.filter((session) => dates.has(zonedParts(new Date(session.completedAt), timeZone).date));
  const strengthSessions = inWeek.filter((session) => session.exerciseLogs.some((log) => log.status !== "skipped" && log.exerciseId !== "stationary-bike" && !KNEE_ONLY.has(log.exerciseId))).length;
  const cardioMinutes = inWeek.reduce((total, session) => total + session.exerciseLogs.reduce((minutes, log) => {
    if (log.exerciseId !== "stationary-bike" || log.status === "skipped") return minutes;
    return minutes + (log.prescribedDose.durationMinutes ?? 0);
  }, 0), 0);
  return { strengthSessions, cardioMinutes, sessionsLogged: inWeek.length };
}
