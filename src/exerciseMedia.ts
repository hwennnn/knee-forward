import type { ExerciseCoachingLoop, ExerciseMotionMedia, ExerciseRecord, ExerciseStillMedia } from "./types";

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
  if (!exercise.demoMedia || exercise.coachingLoop) return null;
  if (context === "learn") {
    if (exercise.demoMedia.clinicalReviewStatus === "reviewed") return exercise.demoMedia;
    if (exercise.demoMedia.clinicalReviewStatus === "pending" && allowPendingLearningMedia) return exercise.demoMedia;
    return null;
  }
  if ((context === "today" || context === "workout") && exercise.demoMedia.clinicalReviewStatus === "reviewed") {
    return exercise.demoMedia;
  }
  return null;
}

/** Looping demo for a Today or workout card: coaching GIF first, otherwise a reviewed Gym visual clip. */
export function cardMotionForExercise(exercise: ExerciseRecord): ExerciseCoachingLoop | ExerciseMotionMedia | null {
  if (exercise.coachingLoop) return exercise.coachingLoop;
  if (exercise.demoMedia?.clinicalReviewStatus === "reviewed") return exercise.demoMedia;
  return null;
}

export function coachingLoopForContext(exercise: ExerciseRecord, context: ExerciseMediaContext): ExerciseCoachingLoop | null {
  if (!exercise.coachingLoop || context === "plan") return null;
  return exercise.coachingLoop;
}
