export type ISODate = `${number}-${number}-${number}`;
export type ISODateTime = string;

export type Laterality = "left" | "right";
export type EpisodeStage = "pre_surgery" | "post_surgery" | "non_surgical";
export type EpisodeStatus = "active" | "paused" | "completed";

export interface RehabEpisode {
  id: string;
  title: string;
  knee: Laterality;
  status: EpisodeStatus;
  stage: EpisodeStage;
  currentPhaseId: string;
  startedOn?: ISODate;
  plannedSurgeryDate?: ISODate;
  surgeryDate?: ISODate;
  clinicianName?: string;
  notes?: string;
  updatedAt: ISODateTime;
}

export type PhaseTone = "prepare" | "protect" | "rebuild" | "advance" | "return";

export interface RehabPhase {
  id: string;
  order: number;
  name: string;
  shortName: string;
  tone: PhaseTone;
  summary: string;
  goals: readonly string[];
  entryCriteria: readonly string[];
  exitCriteria: readonly string[];
  safetyNote: string;
  sourceIds: readonly string[];
}

export type ExerciseCategory =
  | "range_of_motion"
  | "activation"
  | "strength"
  | "balance"
  | "conditioning";

export type ExerciseEquipment =
  | "none"
  | "stationary_bike"
  | "knee_extension_machine"
  | "hamstring_curl_machine"
  | "leg_press_machine"
  | "ankle_weight"
  | "step"
  | "resistance_band"
  | "support_surface";

/** Valid zero-based tile positions in an eight-panel sprite sheet. */
export type ExerciseMediaTileIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;

export type ExerciseVisualScope = "exact_variation" | "generic_pattern";
export type ExerciseMediaReviewStatus = "pending" | "reviewed" | "rejected";

export interface ExerciseMediaProvenance {
  sourcePageUrl: string;
  creator: string;
  licenseId?: string;
  permissionText?: string;
  licenseUrl?: string;
  attributionText: string;
  visualScope: ExerciseVisualScope;
  clinicalReviewStatus: ExerciseMediaReviewStatus;
}

/** Existing bundled illustrations may add provenance as it becomes available. */
export interface ExerciseSpriteMedia extends Partial<ExerciseMediaProvenance> {
  kind: "sprite";
  spriteSheetId: "exercise-reference-strength" | "exercise-reference-foundations";
  src: string;
  tileIndex: ExerciseMediaTileIndex;
  panelCount: 8;
  alt: string;
}

/** A sharp, non-animated image suitable for cards and primary exercise reference. */
export interface ExerciseStillImageMedia extends Partial<ExerciseMediaProvenance> {
  kind: "image";
  src: string;
  alt: string;
  width?: number;
  height?: number;
}

export interface ExerciseWebMSource {
  src: string;
  mimeType: "video/webm";
}

export interface ExerciseMp4Source {
  src: string;
  mimeType: "video/mp4";
}

export interface ExerciseMotionMedia extends ExerciseMediaProvenance {
  kind: "motion";
  /** WebM is preferred; MP4 is the required browser fallback. */
  sources: readonly [ExerciseWebMSource, ExerciseMp4Source];
  /** Still frame shown by the browser while the motion asset is loading or paused. */
  posterSrc: string;
  alt: string;
  width?: number;
  height?: number;
  durationSeconds?: number;
  bytes?: number;
  changesMade?: string;
}

export type ExerciseStillMedia = ExerciseSpriteMedia | ExerciseStillImageMedia;
export type ExerciseMedia = ExerciseStillMedia | ExerciseMotionMedia;

export interface ExerciseRecord {
  id: string;
  name: string;
  shortName: string;
  category: ExerciseCategory;
  equipment: readonly ExerciseEquipment[];
  description: string;
  cues: readonly string[];
  stopSignals: readonly string[];
  eligiblePhaseIds: readonly string[];
  sourceIds: readonly string[];
  /** False keeps an educational record out of recorded plans, imports, and workouts. */
  planEligible?: boolean;
  /** Optional motion-only learning demonstration. Pending media is local-preview-only. */
  demoMedia?: ExerciseMotionMedia;
  /** Still-only card and primary reference asset used throughout the product. */
  media: ExerciseStillMedia;
}

export interface ExerciseDose {
  sets: number | null;
  reps: number | null;
  loadKg: number | null;
  holdSeconds: number | null;
  durationMinutes: number | null;
  rangeNote: string;
}

export interface SessionSetLog {
  reps: number | null;
  loadKg: number | null;
  completed: boolean;
}

export type SessionExerciseStatus = "completed" | "partial" | "skipped" | "stopped";

export interface SessionExerciseLog {
  exerciseId: string;
  exerciseName: string;
  prescribedDose: ExerciseDose;
  status: SessionExerciseStatus;
  sets: readonly SessionSetLog[];
}

export interface SessionExerciseDraft {
  exerciseId: string;
  exerciseName: string;
  prescribedDose: ExerciseDose;
  outcome: SessionExerciseStatus | null;
  sets: readonly SessionSetLog[];
}

export interface SessionDraft {
  id: string;
  episodeId: string;
  routineId: string;
  startedAt: ISODateTime;
  updatedAt: ISODateTime;
  painBefore: number;
  swellingBefore: "none" | "mild" | "moderate" | "marked";
  currentExerciseIndex: number;
  exercises: readonly SessionExerciseDraft[];
}

export interface SessionLog {
  id: string;
  episodeId: string;
  routineId: string;
  completedAt: ISODateTime;
  painBefore: number;
  painAfter: number;
  swellingBefore: "none" | "mild" | "moderate" | "marked";
  swellingAfter: "none" | "mild" | "moderate" | "marked";
  completedExerciseIds: readonly string[];
  exerciseLogs: readonly SessionExerciseLog[];
  note: string;
}

export interface LocalAppState {
  schemaVersion: 1;
  profile: {
    onboardingComplete: boolean;
    plannedSurgeryDate: ISODate | null;
  };
  activeEpisodeId: string;
  planClinicianConfirmed: boolean;
  reminderTime: string;
  reminderDays: readonly number[];
  reminderDismissedOn: ISODate | null;
  planExerciseIds: readonly string[];
  doses: Record<string, ExerciseDose>;
  sessions: readonly SessionLog[];
  sessionDraft: SessionDraft | null;
}

export interface ClinicianDefinedDose {
  kind: "clinician_defined";
  note: string;
}

export interface RoutineItem {
  id: string;
  exerciseId: string;
  order: number;
  dose: ClinicianDefinedDose;
  side?: "affected" | "unaffected" | "both" | "alternating";
  clinicianNote?: string;
}

export interface RehabRoutine {
  id: string;
  episodeId: string;
  phaseId: string;
  name: string;
  description: string;
  status: "draft" | "clinician_approved" | "retired";
  items: readonly RoutineItem[];
  safetyNote: string;
  approvedBy?: string;
  approvedAt?: ISODateTime;
  updatedAt: ISODateTime;
}

export type SourceKind = "clinical_guideline" | "rehab_protocol" | "care_team_plan";

export interface SourceMetadata {
  id: string;
  kind: SourceKind;
  title: string;
  publisher: string;
  url?: string;
  publishedYear?: number;
  accessedOn?: ISODate;
  note: string;
}

export interface KneeForwardSeedData {
  generatedAt: ISODateTime;
  activeEpisodeId: string;
  episodes: readonly RehabEpisode[];
  phases: readonly RehabPhase[];
  exercises: readonly ExerciseRecord[];
  routines: readonly RehabRoutine[];
  sources: readonly SourceMetadata[];
}
