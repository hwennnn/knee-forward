import type { ExerciseMotionMedia, ExerciseRecord, ExerciseStillMedia } from "./types";

export type ExerciseMediaContext = "learn" | "today" | "plan" | "workout";
export type AppTab = "today" | "plan" | "learn" | "progress";
export type AppDetailSurface = AppTab | "active_workout";

export function mediaContextForAppSurface(surface: Exclude<AppDetailSurface, "progress">): ExerciseMediaContext;
export function mediaContextForAppSurface(surface: "progress"): null;
export function mediaContextForAppSurface(surface: AppDetailSurface): ExerciseMediaContext | null;
export function mediaContextForAppSurface(surface: AppDetailSurface): ExerciseMediaContext | null {
  if (surface === "active_workout") return "workout";
  if (surface === "progress") return null;
  return surface;
}

export function mediaForExerciseContext(
  exercise: ExerciseRecord,
  _context: ExerciseMediaContext,
): ExerciseStillMedia {
  return exercise.media;
}

export function motionMediaForExerciseContext(
  exercise: ExerciseRecord,
  context: ExerciseMediaContext,
  allowPendingLearningMedia = false,
): ExerciseMotionMedia | null {
  if (context !== "learn" || !exercise.demoMedia) return null;
  if (exercise.demoMedia.clinicalReviewStatus === "reviewed") return exercise.demoMedia;
  if (exercise.demoMedia.clinicalReviewStatus === "pending" && allowPendingLearningMedia) return exercise.demoMedia;
  return null;
}
