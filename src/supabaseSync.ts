import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { isAllowlistedEmail, requestMagicLink } from "./authAllowlist";
import { checkInFromSession, mergeSnapshots, type RemoteSnapshot } from "./syncMerge";
import type { CheckIn, LocalAppState, SessionLog, WeightEntry } from "./types";

export function supabaseConfig() {
  const url = import.meta.env.VITE_SUPABASE_URL?.trim() ?? "";
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() ?? "";
  if (!url || !anonKey) return null;
  return { url, anonKey };
}

export function isSupabaseConfigured() {
  return supabaseConfig() !== null;
}

let client: SupabaseClient | null = null;

export function getSupabase() {
  const config = supabaseConfig();
  if (!config) return null;
  if (!client) {
    client = createClient(config.url, config.anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: "pkce",
      },
    });
  }
  return client;
}

export async function sendMagicLink(email: string) {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Cloud sync is not set up on this deployment.");
  await requestMagicLink(email, async (normalized) => {
    const { error } = await supabase.auth.signInWithOtp({
      email: normalized,
      options: {
        emailRedirectTo: `${window.location.origin}/today/`,
        shouldCreateUser: true,
      },
    });
    if (error) {
      if (/not invited|signup|not authorized|forbidden|hook/i.test(error.message)) {
        throw new Error("This email is not invited.");
      }
      throw new Error(error.message);
    }
  });
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function remoteFromRows(profile: Record<string, unknown> | null, plan: Record<string, unknown> | null, sessions: SessionLog[], checkIns: CheckIn[], weightEntries: WeightEntry[]): RemoteSnapshot | null {
  if (!profile && !plan && sessions.length === 0 && checkIns.length === 0 && weightEntries.length === 0) return null;
  const updatedAt = typeof plan?.updated_at === "string" ? plan.updated_at : "1970-01-01T00:00:00.000Z";
  return {
    hasPlan: Boolean(plan),
    planUpdatedAt: updatedAt,
    profile: {
      onboardingComplete: profile?.onboarding_complete === true,
      displayName: typeof profile?.display_name === "string" ? profile.display_name : "",
      affectedKnee: profile?.affected_knee === "left" ? "left" : "right",
      rehabStage: profile?.rehab_stage === "post_surgery" || profile?.rehab_stage === "non_surgical" ? profile.rehab_stage : "pre_surgery",
      currentPhaseId: typeof profile?.current_phase_id === "string" ? profile.current_phase_id : "prehab",
      plannedSurgeryDate: typeof profile?.planned_surgery_date === "string" ? profile.planned_surgery_date as LocalAppState["profile"]["plannedSurgeryDate"] : null,
      timeZone: typeof profile?.time_zone === "string" ? profile.time_zone : null,
      goalLabel: typeof profile?.goal_label === "string" ? profile.goal_label : "",
    },
    activeEpisodeId: typeof plan?.episode_id === "string" ? plan.episode_id : "episode-right-acl-2026",
    planClinicianConfirmed: plan?.plan_clinician_confirmed === true,
    reminderTime: typeof plan?.reminder_time === "string" ? plan.reminder_time : "18:30",
    reminderDays: Array.isArray(plan?.reminder_days) ? plan.reminder_days.filter((day): day is number => typeof day === "number") : [1, 3, 5],
    reminderDismissedOn: typeof plan?.reminder_dismissed_on === "string" ? plan.reminder_dismissed_on as RemoteSnapshot["reminderDismissedOn"] : null,
    planExerciseIds: Array.isArray(plan?.plan_exercise_ids) ? plan.plan_exercise_ids.filter((id): id is string => typeof id === "string") : ["heel-slide"],
    doses: asRecord(plan?.doses) as LocalAppState["doses"] ?? {},
    scheduleOverrides: Array.isArray(plan?.schedule_overrides) ? plan.schedule_overrides as RemoteSnapshot["scheduleOverrides"] : [],
    weightGoalKg: typeof profile?.weight_goal_kg === "number" ? profile.weight_goal_kg : null,
    sessions,
    checkIns,
    weightEntries,
  };
}

export async function fetchRemoteSnapshot(): Promise<RemoteSnapshot | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user || !isAllowlistedEmail(userData.user.email ?? "")) return null;
  const userId = userData.user.id;
  const [profileResult, planResult, sessionResult, checkInResult, weightResult] = await Promise.all([
    supabase.from("profiles").select("*").eq("user_id", userId).maybeSingle(),
    supabase.from("user_plans").select("*").eq("user_id", userId).maybeSingle(),
    supabase.from("sessions").select("payload").eq("user_id", userId),
    supabase.from("check_ins").select("*").eq("user_id", userId),
    supabase.from("weight_entries").select("*").eq("user_id", userId),
  ]);
  const error = profileResult.error ?? planResult.error ?? sessionResult.error ?? checkInResult.error ?? weightResult.error;
  if (error) throw new Error(error.message);
  const sessions = (sessionResult.data ?? []).flatMap((row) => {
    const payload = asRecord(row.payload);
    return payload ? [payload as unknown as SessionLog] : [];
  });
  const checkIns = (checkInResult.data ?? []).map((row) => ({
    id: String(row.id),
    episodeId: String(row.episode_id),
    sessionId: row.session_id ? String(row.session_id) : null,
    recordedAt: String(row.recorded_at),
    painBefore: Number(row.pain_before),
    painAfter: row.pain_after === null || row.pain_after === undefined ? null : Number(row.pain_after),
    swellingBefore: row.swelling_before as CheckIn["swellingBefore"],
    swellingAfter: row.swelling_after === null || row.swelling_after === undefined ? null : row.swelling_after as CheckIn["swellingAfter"],
    updatedAt: String(row.updated_at),
  }));
  const weightEntries = (weightResult.data ?? []).map((row) => ({
    id: String(row.id),
    recordedOn: String(row.recorded_on).slice(0, 10) as WeightEntry["recordedOn"],
    weightKg: Number(row.weight_kg),
    updatedAt: String(row.updated_at),
  }));
  return remoteFromRows(asRecord(profileResult.data), asRecord(planResult.data), sessions, checkIns, weightEntries);
}

function checkInsForSync(state: LocalAppState) {
  const byId = new Map(state.checkIns.map((checkIn) => [checkIn.id, checkIn]));
  for (const session of state.sessions) {
    if (!byId.has(session.id)) byId.set(session.id, checkInFromSession(session));
  }
  return [...byId.values()];
}

export async function pushDelta(state: LocalAppState, remote: RemoteSnapshot | null) {
  const supabase = getSupabase();
  if (!supabase) return;
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) throw new Error(userError?.message ?? "Sign in before syncing.");
  const userId = userData.user.id;
  const remoteIsNewer = Boolean(remote && remote.hasPlan !== false && remote.planUpdatedAt > state.planUpdatedAt);
  if (!remoteIsNewer) {
    const profileResult = await supabase.from("profiles").upsert({
      user_id: userId,
      display_name: state.profile.displayName,
      affected_knee: state.profile.affectedKnee,
      rehab_stage: state.profile.rehabStage,
      current_phase_id: state.profile.currentPhaseId,
      planned_surgery_date: state.profile.plannedSurgeryDate,
      time_zone: state.profile.timeZone,
      goal_label: state.profile.goalLabel,
      onboarding_complete: state.profile.onboardingComplete,
      weight_goal_kg: state.weightGoalKg,
      updated_at: state.planUpdatedAt,
    });
    if (profileResult.error) throw new Error(profileResult.error.message);
    const planResult = await supabase.from("user_plans").upsert({
      user_id: userId,
      episode_id: state.activeEpisodeId,
      plan_exercise_ids: [...state.planExerciseIds],
      doses: state.doses,
      plan_clinician_confirmed: state.planClinicianConfirmed,
      reminder_time: state.reminderTime,
      reminder_days: [...state.reminderDays],
      reminder_dismissed_on: state.reminderDismissedOn,
      schedule_overrides: state.scheduleOverrides,
      updated_at: state.planUpdatedAt,
    });
    if (planResult.error) throw new Error(planResult.error.message);
  }
  const remoteSessionIds = new Set(remote?.sessions.map((session) => session.id) ?? []);
  const newSessions = state.sessions.filter((session) => !remoteSessionIds.has(session.id));
  if (newSessions.length) {
    const sessionResult = await supabase.from("sessions").upsert(newSessions.map((session) => ({
      id: session.id,
      user_id: userId,
      episode_id: session.episodeId,
      completed_at: session.completedAt,
      payload: session,
      updated_at: session.completedAt,
    })), { onConflict: "id", ignoreDuplicates: true });
    if (sessionResult.error) throw new Error(sessionResult.error.message);
    const sets = newSessions.flatMap((session) => session.exerciseLogs.flatMap((exercise, exerciseIndex) => exercise.sets.map((set, setIndex) => ({
      id: `${session.id}:${exerciseIndex}:${setIndex}`,
      user_id: userId,
      session_id: session.id,
      exercise_id: exercise.exerciseId,
      set_index: setIndex,
      reps: set.reps,
      load_kg: set.loadKg,
      completed: set.completed,
      updated_at: session.completedAt,
    }))));
    if (sets.length) {
      const setResult = await supabase.from("session_sets").upsert(sets, { onConflict: "id", ignoreDuplicates: true });
      if (setResult.error) throw new Error(setResult.error.message);
    }
  }
  const remoteCheckIds = new Set(remote?.checkIns.map((checkIn) => checkIn.id) ?? []);
  const newCheckIns = checkInsForSync(state).filter((checkIn) => !remoteCheckIds.has(checkIn.id));
  if (newCheckIns.length) {
    const checkResult = await supabase.from("check_ins").upsert(newCheckIns.map((checkIn) => ({
      id: checkIn.id,
      user_id: userId,
      episode_id: checkIn.episodeId,
      session_id: checkIn.sessionId,
      recorded_at: checkIn.recordedAt,
      pain_before: checkIn.painBefore,
      pain_after: checkIn.painAfter,
      swelling_before: checkIn.swellingBefore,
      swelling_after: checkIn.swellingAfter,
      updated_at: checkIn.updatedAt,
    })), { onConflict: "id", ignoreDuplicates: true });
    if (checkResult.error) throw new Error(checkResult.error.message);
  }
  if (state.weightEntries.length) {
    const weightResult = await supabase.from("weight_entries").upsert(state.weightEntries.map((entry) => ({
      id: entry.id,
      user_id: userId,
      recorded_on: entry.recordedOn,
      weight_kg: entry.weightKg,
      updated_at: entry.updatedAt,
    })), { onConflict: "id" });
    if (weightResult.error) throw new Error(weightResult.error.message);
  }
}

export async function deleteCloudData() {
  const supabase = getSupabase();
  if (!supabase) return;
  const { error } = await supabase.rpc("delete_my_cloud_data");
  if (error) throw new Error(error.message);
  await supabase.auth.signOut();
}

export function reconcileCloud(local: LocalAppState, remote: RemoteSnapshot | null) {
  return mergeSnapshots(local, remote);
}
