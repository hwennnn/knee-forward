import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alarm,
  ArrowRight,
  Barbell,
  BookOpen,
  CalendarCheck,
  CaretDown,
  ChartLineUp,
  Check,
  CheckCircle,
  DownloadSimple,
  FilmStrip,
  FirstAid,
  Gear,
  House,
  Info,
  Lock,
  LinkSimple,
  Play,
  Plus,
  ShieldCheck,
  SlidersHorizontal,
  Sparkle,
  UploadSimple,
  Warning,
  X,
} from "@phosphor-icons/react";
import { exercises, rehabPhases, SAFETY_NOTICE, seedData, sourceMetadata } from "./data";
import type { EpisodeStage, ExerciseDose, ExerciseRecord, LocalAppState, RehabEpisode, SessionLog, SourceMetadata } from "./types";
import { EmptyState, ExerciseDetailForContext, ExerciseVisual, Modal, RoutineRow, SafetyBanner } from "./components";
import { mediaContextForAppSurface, motionMediaForExerciseContext } from "./exerciseMedia";
import { pathForTab, tabFromPathname } from "./navigation";
import { ProgressPage } from "./ProgressPage";
import { initialPostResponse, performedSetOutcome, previousSetsForExercise } from "./sessionTracking";
import { exportRecoveryData, exportState, importState, loadState, saveState } from "./storage";
import { WorkoutSetLogger } from "./WorkoutSetLogger";
import { AppCheckbox, AppDatePicker, AppNumberField, AppSearchField, AppSelect, AppSlider, AppTextArea, AppTextField, AppTimeField } from "./FormControls";
import { applySharedPlan, createSharedPlanUrl, decodeSharedPlan } from "./planShare";
import type { SharedPlan } from "./planShare";
import type { StorageRecovery } from "./storage";
import type { SessionExerciseStatus, SessionSetLog } from "./types";

type CheckStatus = "pending" | "ready" | "adjust" | "stop";
type CheckFlags = { reviewed: boolean; aboveBaseline: boolean; locking: boolean; instability: boolean; redFlag: boolean };

const exerciseCatalog: readonly ExerciseRecord[] = exercises;
const episodeCatalog: readonly RehabEpisode[] = seedData.episodes;
const sourceCatalog: readonly SourceMetadata[] = sourceMetadata;
const dayLabels = ["S", "M", "T", "W", "T", "F", "S"];
const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function isLocalPreviewHost() {
  if (typeof window === "undefined") return false;
  const isLoopback = window.location.hostname === "127.0.0.1" || window.location.hostname === "localhost" || window.location.hostname === "::1";
  return import.meta.env.VITE_ENABLE_PENDING_MEDIA === "true" && isLoopback;
}

const learningMotionFor = (exercise: ExerciseRecord) => motionMediaForExerciseContext(exercise, "learn", isLocalPreviewHost());

function todayLabel() {
  return new Intl.DateTimeFormat("en-SG", { weekday: "long", month: "long", day: "numeric" }).format(new Date());
}

function stageLabel(stage: EpisodeStage) {
  if (stage === "pre_surgery") return "Pre-surgery";
  if (stage === "post_surgery") return "Post-surgery";
  return "Non-surgical";
}

function profileSetupComplete(state: LocalAppState) {
  return state.profile.onboardingComplete && state.profile.displayName.trim().length > 0;
}

function phasesForStage(stage: EpisodeStage) {
  if (stage === "pre_surgery") return rehabPhases.filter((phase) => phase.id === "prehab");
  if (stage === "post_surgery") return rehabPhases.filter((phase) => phase.id !== "prehab");
  return rehabPhases.filter((phase) => phase.id !== "prehab" && phase.id !== "protect-and-settle");
}

function defaultPhaseForStage(stage: EpisodeStage) {
  if (stage === "pre_surgery") return "prehab";
  if (stage === "post_surgery") return "protect-and-settle";
  return "rebuild-capacity";
}

function consumeSharedPlanFromLocation(): { plan: SharedPlan | null; error: string | null } {
  const url = new URL(window.location.href);
  const encoded = url.searchParams.get("plan");
  if (!encoded) return { plan: null, error: null };
  url.searchParams.delete("plan");
  window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  try {
    return { plan: decodeSharedPlan(encoded), error: null };
  } catch (error) {
    return { plan: null, error: error instanceof Error ? error.message : "This plan link could not be read." };
  }
}

function doseLabel(dose?: ExerciseDose, includeNote = false) {
  if (!dose) return "Add your physio's dose";
  const load = dose.loadKg !== null ? ` at ${dose.loadKg} kg` : "";
  const summary = dose.durationMinutes !== null
    ? `${dose.durationMinutes} min${load}`
    : dose.sets !== null && dose.reps !== null
      ? `${dose.sets} sets × ${dose.reps} reps${load}`
      : dose.sets !== null && dose.holdSeconds !== null
        ? `${dose.sets} × ${dose.holdSeconds}s holds${load}`
        : null;
  if (!summary) return "Add your physio's dose";
  return includeNote && dose.rangeNote ? `${summary} — ${dose.rangeNote}` : summary;
}

function doseIsComplete(dose?: ExerciseDose) {
  if (!dose) return false;
  if (dose.durationMinutes !== null) return true;
  return dose.sets !== null && (dose.reps !== null || dose.holdSeconds !== null);
}

function blankPerformedSets(dose: ExerciseDose): SessionSetLog[] {
  return Array.from({ length: dose.sets ?? 1 }, () => ({ reps: dose.reps, loadKg: dose.loadKg, completed: false }));
}

function localDateKey(date = new Date()): NonNullable<LocalAppState["reminderDismissedOn"]> {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}` as NonNullable<LocalAppState["reminderDismissedOn"]>;
}

function buildCalendarFile(state: LocalAppState) {
  if (!state.reminderDays.length) return;
  const now = new Date();
  const [hour, minute] = state.reminderTime.split(":").map(Number);
  const chosenDays = state.reminderDays;
  const candidates = chosenDays.map((day) => {
    const candidate = new Date(now);
    candidate.setDate(now.getDate() + ((day - now.getDay() + 7) % 7));
    candidate.setHours(Number.isFinite(hour) ? hour : 18, Number.isFinite(minute) ? minute : 30, 0, 0);
    if (candidate <= now) candidate.setDate(candidate.getDate() + 7);
    return candidate;
  });
  const start = candidates.reduce((soonest, candidate) => candidate < soonest ? candidate : soonest);
  const end = new Date(start.getTime() + 45 * 60_000);
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  const formatLocalCalendarDate = (date: Date) => [
    String(date.getFullYear()).padStart(4, "0"),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
    "T",
    String(date.getHours()).padStart(2, "0"),
    String(date.getMinutes()).padStart(2, "0"),
    String(date.getSeconds()).padStart(2, "0"),
  ].join("");
  const repeatDays = chosenDays.map((day) => ["SU", "MO", "TU", "WE", "TH", "FR", "SA"][day]).join(",");
  const activeDays = chosenDays.map((day) => dayNames[day]).join(", ");
  const text = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Knee Forward//ACL Rehab//EN",
    `X-WR-TIMEZONE:${timeZone}`,
    "BEGIN:VEVENT",
    `UID:knee-forward-${Date.now()}@local`,
    `DTSTAMP:${new Date().toISOString().replaceAll(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z")}`,
    `DTSTART;TZID=${timeZone}:${formatLocalCalendarDate(start)}`,
    `DTEND;TZID=${timeZone}:${formatLocalCalendarDate(end)}`,
    `RRULE:FREQ=WEEKLY;BYDAY=${repeatDays}`,
    "SUMMARY:ACL rehab session",
    `DESCRIPTION:Knee Forward session from my recorded rehabilitation plan. Planned for ${activeDays}.`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
  const url = URL.createObjectURL(new Blob([text], { type: "text/calendar" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "knee-forward-reminder.ics";
  link.click();
  URL.revokeObjectURL(url);
}

function validateDoseForm(form: FormData): string | null {
  const parseOptional = (key: string, min: number, max: number, integer = false) => {
    const raw = form.get(key)?.toString().trim() ?? "";
    if (!raw) return null;
    const value = Number(raw);
    if (!Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value))) {
      throw new Error("Check the dose numbers before saving.");
    }
    return value;
  };

  const sets = parseOptional("sets", 1, 50, true);
  const reps = parseOptional("reps", 1, 500, true);
  const hold = parseOptional("hold", 1, 3_600, true);
  const duration = parseOptional("duration", 0.25, 480);
  parseOptional("load", 0, 1_000);
  if (duration === null && (sets === null || (reps === null && hold === null))) {
    return "Add duration, or add sets with reps or hold time.";
  }
  return null;
}

function App() {
  const [loadedState] = useState(loadState);
  const [state, setState] = useState<LocalAppState>(loadedState.state);
  const [storageRecovery, setStorageRecovery] = useState<StorageRecovery | null>(loadedState.recovery);
  const [sharedPlanResult] = useState(consumeSharedPlanFromLocation);
  const tab = tabFromPathname(window.location.pathname);
  const [modal, setModal] = useState<"onboarding" | "share-import" | "safety" | "settings" | "reminder" | "checkin" | "postcheck" | "dose" | "customize" | "pause-session" | "discard-session" | "stop-session" | null>(
    loadedState.recovery ? null : sharedPlanResult.plan ? "share-import" : profileSetupComplete(loadedState.state) ? null : "onboarding",
  );
  const [selectedExercise, setSelectedExercise] = useState<ExerciseRecord | null>(null);
  const [doseExercise, setDoseExercise] = useState<ExerciseRecord | null>(null);
  const [activeSession, setActiveSession] = useState(false);
  const [prePain, setPrePain] = useState(0);
  const [preSwelling, setPreSwelling] = useState<SessionLog["swellingBefore"]>("none");
  const [checkFlags, setCheckFlags] = useState<CheckFlags>({ reviewed: false, aboveBaseline: false, locking: false, instability: false, redFlag: false });
  const [postPain, setPostPain] = useState(0);
  const [postSwelling, setPostSwelling] = useState<SessionLog["swellingAfter"]>("none");
  const [sessionNote, setSessionNote] = useState("");
  const [search, setSearch] = useState("");
  const [libraryFilter, setLibraryFilter] = useState<"all" | "prehab" | "strength" | "mobility">("all");
  const [toast, setToast] = useState<string | null>(sharedPlanResult.error);
  const [persistenceWarning, setPersistenceWarning] = useState<string | null>(null);
  const importInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (storageRecovery) return;
    try {
      saveState(state);
      setPersistenceWarning(null);
    } catch {
      setPersistenceWarning("Knee Forward could not save to this browser. Keep this tab open and export a backup now.");
    }
  }, [state, storageRecovery]);
  useEffect(() => {
    if (!toast) return;
    const liveRegion = document.getElementById("app-live-region");
    if (liveRegion) liveRegion.textContent = toast;
    const timer = window.setTimeout(() => setToast(null), 3000);
    return () => {
      window.clearTimeout(timer);
      if (liveRegion) liveRegion.textContent = "";
    };
  }, [toast]);
  useEffect(() => {
    if (!activeSession) return;
    const warnBeforeLeaving = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warnBeforeLeaving);
    return () => window.removeEventListener("beforeunload", warnBeforeLeaving);
  }, [activeSession]);
  useEffect(() => {
    if (tab === "learn" && selectedExercise) window.scrollTo({ top: 0, behavior: "auto" });
  }, [selectedExercise, tab]);

  const activeEpisode = episodeCatalog.find((episode) => episode.id === state.activeEpisodeId) ?? episodeCatalog[0];
  if (!activeEpisode) throw new Error("No rehabilitation episode is configured.");
  const currentPhase = rehabPhases.find((phase) => phase.id === state.profile.currentPhaseId) ?? rehabPhases[0];
  if (!currentPhase) throw new Error("No rehabilitation phase is configured.");
  const planExercises = state.planExerciseIds
    .map((id) => exerciseCatalog.find((exercise) => exercise.id === id))
    .filter((exercise): exercise is ExerciseRecord => Boolean(exercise));
  const missingDoseCount = planExercises.filter((exercise) => !doseIsComplete(state.doses[exercise.id])).length;
  const incompatiblePlanCount = planExercises.filter((exercise) => !exercise.eligiblePhaseIds.includes(state.profile.currentPhaseId)).length;
  const planReady = state.planClinicianConfirmed && missingDoseCount === 0 && incompatiblePlanCount === 0;
  const shareLink = useMemo(() => {
    try {
      return { url: createSharedPlanUrl(state, window.location), error: null };
    } catch (error) {
      return { url: "", error: error instanceof Error ? error.message : "This plan cannot be shared as a link." };
    }
  }, [state]);
  const activeEpisodeSessions = state.sessions.filter((session) => session.episodeId === state.activeEpisodeId);
  const completedThisWeek = activeEpisodeSessions.filter((session) => Date.now() - new Date(session.completedAt).getTime() < 7 * 86_400_000).length;
  const sessionsByDay = Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - index));
    return {
      dateKey: localDateKey(date),
      label: new Intl.DateTimeFormat("en-SG", { weekday: "narrow" }).format(date),
      dateLabel: new Intl.DateTimeFormat("en-SG", { weekday: "long", month: "short", day: "numeric" }).format(date),
      done: activeEpisodeSessions.some((session) => new Date(session.completedAt).toDateString() === date.toDateString()),
      today: date.toDateString() === new Date().toDateString(),
    };
  });
  const now = new Date();
  const todayKey = localDateKey(now);
  const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const completedToday = activeEpisodeSessions.some((session) => localDateKey(new Date(session.completedAt)) === todayKey);
  const reminderDue = state.reminderDays.includes(now.getDay())
    && currentTime >= state.reminderTime
    && !completedToday
    && state.reminderDismissedOn !== todayKey;

  const readiness: CheckStatus = checkFlags.redFlag || checkFlags.locking || checkFlags.instability
    ? "stop"
    : checkFlags.aboveBaseline || preSwelling === "marked" || preSwelling === "moderate"
      ? "adjust"
      : checkFlags.reviewed
        ? "ready"
        : "pending";

  const filteredExercises = useMemo(() => {
    const term = search.trim().toLowerCase();
    return exerciseCatalog.filter((exercise) => {
      const matchesSearch = !term || exercise.name.toLowerCase().includes(term) || exercise.description.toLowerCase().includes(term);
      const matchesFilter = libraryFilter === "all"
        || (libraryFilter === "prehab" && exercise.eligiblePhaseIds.includes("prehab"))
        || (libraryFilter === "strength" && exercise.category === "strength")
        || (libraryFilter === "mobility" && ["range_of_motion", "activation"].includes(exercise.category));
      return matchesSearch && matchesFilter;
    });
  }, [libraryFilter, search]);
  const selectedDetailContext = mediaContextForAppSurface(tab);

  const startSession = () => {
    if (readiness !== "ready" || !planReady) return;
    const postResponse = initialPostResponse(prePain, preSwelling);
    setPostPain(postResponse.painAfter);
    setPostSwelling(postResponse.swellingAfter);
    const startedAt = new Date().toISOString();
    const draft = {
      id: crypto.randomUUID(),
      episodeId: state.activeEpisodeId,
      routineId: "routine-right-prehab-foundations",
      startedAt,
      updatedAt: startedAt,
      painBefore: prePain,
      swellingBefore: preSwelling,
      currentExerciseIndex: 0,
      exercises: planExercises.map((exercise) => {
        const prescribedDose = { ...state.doses[exercise.id] };
        return {
          exerciseId: exercise.id,
          exerciseName: exercise.name,
          prescribedDose,
          outcome: null,
          sets: blankPerformedSets(prescribedDose),
        };
      }),
    };
    setState((previous) => ({ ...previous, sessionDraft: draft }));
    setActiveSession(true);
    setModal(null);
  };

  const resumeSession = () => {
    const draft = state.sessionDraft;
    if (!draft) return;
    const postResponse = initialPostResponse(draft.painBefore, draft.swellingBefore);
    setPostPain(postResponse.painAfter);
    setPostSwelling(postResponse.swellingAfter);
    setActiveSession(true);
    setModal(null);
  };

  const resetSessionInputs = () => {
    setPrePain(0);
    setPreSwelling("none");
    setCheckFlags({ reviewed: false, aboveBaseline: false, locking: false, instability: false, redFlag: false });
    setPostPain(0);
    setPostSwelling("none");
    setSessionNote("");
  };

  const leaveSession = () => {
    setModal("pause-session");
  };

  const pauseSession = () => {
    setActiveSession(false);
    setModal(null);
    setSelectedExercise(null);
  };

  const discardSessionDraft = () => {
    if (!state.sessionDraft) return;
    setModal("discard-session");
  };

  const confirmDiscardSessionDraft = () => {
    setState((previous) => ({ ...previous, sessionDraft: null }));
    setActiveSession(false);
    setModal(null);
    resetSessionInputs();
    setToast("In-progress session discarded");
  };

  const updateCurrentSets = (sets: SessionSetLog[]) => {
    setState((previous) => {
      const draft = previous.sessionDraft;
      if (!draft) return previous;
      const exercises = draft.exercises.map((exercise, index) => index === draft.currentExerciseIndex
        ? { ...exercise, outcome: null, sets }
        : exercise);
      return {
        ...previous,
        sessionDraft: { ...draft, updatedAt: new Date().toISOString(), exercises },
      };
    });
  };

  const recordCurrentExercise = (status: SessionExerciseStatus) => {
    const draft = state.sessionDraft;
    if (!draft) return;
    const isLastExercise = draft.currentExerciseIndex === draft.exercises.length - 1;
    const endsSession = status === "stopped" || isLastExercise;
    setState((previous) => {
      const currentDraft = previous.sessionDraft;
      if (!currentDraft) return previous;
      const exercises = currentDraft.exercises.map((exercise, index) => {
        if (index === currentDraft.currentExerciseIndex) return { ...exercise, outcome: status };
        if (status === "stopped" && index > currentDraft.currentExerciseIndex && exercise.outcome === null) {
          return { ...exercise, outcome: "skipped" as const };
        }
        return exercise;
      });
      return {
        ...previous,
        sessionDraft: {
          ...currentDraft,
          updatedAt: new Date().toISOString(),
          currentExerciseIndex: endsSession ? currentDraft.currentExerciseIndex : currentDraft.currentExerciseIndex + 1,
          exercises,
        },
      };
    });
    if (endsSession) setModal("postcheck");
  };

  const stopSessionForSymptoms = () => {
    setModal("stop-session");
  };

  const confirmStopSessionForSymptoms = () => {
    recordCurrentExercise("stopped");
  };

  const finishSession = () => {
    const draft = state.sessionDraft;
    if (!draft) return;
    const exerciseLogs = draft.exercises
      .filter((exercise) => exercise.outcome !== null)
      .map((exercise) => ({
        exerciseId: exercise.exerciseId,
        exerciseName: exercise.exerciseName,
        prescribedDose: { ...exercise.prescribedDose },
        status: exercise.outcome as SessionExerciseStatus,
        sets: exercise.sets.map((set) => ({ ...set })),
      }));
    const log: SessionLog = {
      id: draft.id,
      episodeId: draft.episodeId,
      routineId: draft.routineId,
      completedAt: new Date().toISOString(),
      painBefore: draft.painBefore,
      painAfter: postPain,
      swellingBefore: draft.swellingBefore,
      swellingAfter: postSwelling,
      completedExerciseIds: exerciseLogs.filter((exercise) => exercise.status === "completed").map((exercise) => exercise.exerciseId),
      exerciseLogs,
      note: sessionNote,
    };
    const nextState = state.sessions.some((session) => session.id === log.id)
      ? { ...state, sessionDraft: null }
      : { ...state, sessions: [log, ...state.sessions], sessionDraft: null };
    try {
      saveState(nextState);
    } catch {
      setState(nextState);
      setPersistenceWarning("Knee Forward could not save to this browser. Keep this tab open and export a backup now.");
      return;
    }
    setState(nextState);
    setActiveSession(false);
    setModal(null);
    resetSessionInputs();
    window.location.assign(pathForTab("progress"));
  };

  const saveDose = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!doseExercise) return;
    const form = new FormData(event.currentTarget);
    try {
      const validationMessage = validateDoseForm(form);
      if (validationMessage) {
        setToast(validationMessage);
        return;
      }
    } catch (error) {
      setToast(error instanceof Error ? error.message : "Check the dose before saving.");
      return;
    }
    const numberOrNull = (key: string) => {
      const value = form.get(key)?.toString();
      return value ? Number(value) : null;
    };
    setState((previous) => ({
      ...previous,
      planClinicianConfirmed: false,
      doses: {
        ...previous.doses,
        [doseExercise.id]: {
          sets: numberOrNull("sets"),
          reps: numberOrNull("reps"),
          loadKg: numberOrNull("load"),
          holdSeconds: numberOrNull("hold"),
          durationMinutes: numberOrNull("duration"),
          rangeNote: form.get("range")?.toString() ?? "",
        },
      },
    }));
    setModal(null);
    setToast("Physio dose updated");
  };

  const openDose = (exercise: ExerciseRecord) => {
    setDoseExercise(exercise);
    setModal("dose");
  };

  if (activeSession && state.sessionDraft) {
    const draft = state.sessionDraft;
    const currentDraftExercise = draft.exercises[draft.currentExerciseIndex];
    const exercise = currentDraftExercise
      ? exerciseCatalog.find((item) => item.id === currentDraftExercise.exerciseId)
      : undefined;
    if (!exercise || !currentDraftExercise) throw new Error("The saved session has no available exercise.");
    const completedSetCount = currentDraftExercise.sets.filter((set) => set.completed).length;
    const allSetsCompleted = completedSetCount === currentDraftExercise.sets.length;
    const handledExerciseCount = draft.exercises.filter((item) => item.outcome !== null).length;
    const sessionReadyToReview = handledExerciseCount === draft.exercises.length;
    const previousSets = previousSetsForExercise(state.sessions, draft.episodeId, exercise.id);
    return (
      <div className="workout-shell">
        <header className="workout-topbar">
          <button className="icon-button" onClick={leaveSession} aria-label="Leave workout"><X size={23} /></button>
          <div><strong>{currentPhase.shortName} plan</strong><span>{draft.currentExerciseIndex + 1} of {draft.exercises.length}</span></div>
          <span className="workout-percent">{Math.round((handledExerciseCount / draft.exercises.length) * 100)}%</span>
        </header>
        <div className="workout-progress"><span style={{ width: `${((draft.currentExerciseIndex + 1) / draft.exercises.length) * 100}%` }} /></div>
        <main className="workout-main">
          <div className="workout-media"><ExerciseVisual media={exercise.media} /></div>
          <section className="workout-copy">
            <p className="kicker">{state.profile.affectedKnee === "right" ? "Right" : "Left"} knee · recorded plan</p>
            <h1>{exercise.name}</h1>
            <p className="workout-dose">Clinician target: {doseLabel(currentDraftExercise.prescribedDose)}</p>
            {currentDraftExercise.prescribedDose.rangeNote && <p className="range-note">Range note: {currentDraftExercise.prescribedDose.rangeNote}</p>}
            <WorkoutSetLogger
              exerciseName={exercise.shortName}
              prescribedDose={currentDraftExercise.prescribedDose}
              sets={currentDraftExercise.sets}
              previousSets={previousSets}
              onChange={updateCurrentSets}
            />
            <details className="workout-cues">
              <summary>Form cues and stop signals</summary>
              <ul className="cue-list">
                {exercise.cues.map((cue) => <li key={cue}><Check size={18} weight="bold" />{cue}</li>)}
              </ul>
            </details>
            <SafetyBanner tone="warning">Keep the recorded load unless your clinician changed it. Stop for worsening pain, swelling, locking, or giving way.</SafetyBanner>
            <div className="workout-actions">
              <button className="secondary-button" onClick={() => setSelectedExercise(exercise)}><Info size={18} /> Details</button>
              <button
                className="primary-button"
                disabled={!sessionReadyToReview && completedSetCount === 0}
                onClick={() => sessionReadyToReview
                  ? setModal("postcheck")
                  : recordCurrentExercise(performedSetOutcome(completedSetCount, currentDraftExercise.sets.length))}
              >
                <CheckCircle size={20} weight="fill" />
                {sessionReadyToReview
                  ? "Review response"
                  : completedSetCount === 0
                    ? "Complete a set first"
                    : allSetsCompleted
                      ? "Save and continue"
                      : "Save partial"}
              </button>
            </div>
            {!sessionReadyToReview && <div className="workout-exit-actions">
              {!allSetsCompleted && <button className="text-button" onClick={() => recordCurrentExercise(performedSetOutcome(completedSetCount, currentDraftExercise.sets.length))}>{completedSetCount > 0 ? "End exercise as partial" : "Skip this exercise"}</button>}
              <button className="text-button workout-stop-button" onClick={stopSessionForSymptoms}><Warning size={17} weight="fill" /> Stop for symptoms</button>
            </div>}
          </section>
        </main>
        {selectedExercise && <Modal title={selectedExercise.name} onClose={() => setSelectedExercise(null)} wide><ExerciseDetailForContext exercise={selectedExercise} context={mediaContextForAppSurface("active_workout")} onBack={() => setSelectedExercise(null)} /></Modal>}
        {modal === "postcheck" && <PostCheckModal pain={postPain} setPain={setPostPain} swelling={postSwelling} setSwelling={setPostSwelling} note={sessionNote} setNote={setSessionNote} onClose={() => setModal(null)} onFinish={finishSession} />}
        {modal === "pause-session" && <ActionConfirmModal
          title="Pause this session?"
          message="Your performed set entries are saved on this device. Resume from Today when you are ready."
          confirmLabel="Pause session"
          onClose={() => setModal(null)}
          onConfirm={pauseSession}
        />}
        {modal === "stop-session" && <ActionConfirmModal
          title="Stop because symptoms changed?"
          message="Completed sets stay recorded. Remaining exercises will be marked skipped, then you can record your knee response."
          confirmLabel="Stop and review"
          warning
          onClose={() => setModal(null)}
          onConfirm={confirmStopSessionForSymptoms}
        />}
        {persistenceWarning && <div className="persistence-warning" role="alert">
          <Warning size={20} weight="fill" />
          <span>{persistenceWarning}</span>
          <button className="text-button" onClick={() => exportState(state)}>Export backup</button>
        </div>}
        {toast && <div className="toast" role="status" aria-live="polite"><CheckCircle size={20} weight="fill" />{toast}</div>}
      </div>
    );
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href={pathForTab("today")} aria-label="Knee Forward home">
          <img src="/assets/icon-192.png" alt="" />
          <span>Knee Forward</span>
        </a>
        <div className="episode-card">
          <span className="episode-card__knee">{state.profile.affectedKnee[0].toUpperCase()}</span>
          <div><strong>{state.profile.affectedKnee === "right" ? "Right" : "Left"} knee</strong><span>{stageLabel(state.profile.rehabStage)} · {currentPhase.shortName}</span></div>
          <CaretDown size={16} />
        </div>
        <nav className="desktop-nav" aria-label="Primary navigation">
          <NavItem icon={<House />} label="Today" active={tab === "today"} href={pathForTab("today")} />
          <NavItem icon={<CalendarCheck />} label="My plan" active={tab === "plan"} href={pathForTab("plan")} />
          <NavItem icon={<BookOpen />} label="Learn" active={tab === "learn"} href={pathForTab("learn")} />
          <NavItem icon={<ChartLineUp />} label="Progress" active={tab === "progress"} href={pathForTab("progress")} />
        </nav>
        <div className="sidebar-spacer" />
        <SafetyBanner>General guidance only. Your clinician decides progression.</SafetyBanner>
        <button className="nav-item" onClick={() => setModal("settings")}><Gear /> Settings</button>
      </aside>

      <main className="page">
        <header className="mobile-header">
          <a className="brand" href={pathForTab("today")}><img src="/assets/icon-192.png" alt="" /><span>Knee Forward</span></a>
          <button className="icon-button" onClick={() => setModal("settings")} aria-label="Settings"><Gear size={23} /></button>
        </header>
        {tab === "today" && <TodayPage
          state={state}
          completedThisWeek={completedThisWeek}
          sessionsByDay={sessionsByDay}
          onStart={() => {
            if (state.sessionDraft) {
              resumeSession();
            } else {
              resetSessionInputs();
              setModal("checkin");
            }
          }}
          onDiscardDraft={discardSessionDraft}
          onReminder={() => setModal("reminder")}
          onSafety={() => setModal("safety")}
          onExercise={setSelectedExercise}
          exercises={planExercises}
          planReady={planReady}
          missingDoseCount={missingDoseCount}
          incompatiblePlanCount={incompatiblePlanCount}
          reminderDue={reminderDue}
          onPlan={() => window.location.assign(pathForTab("plan"))}
          onDismissReminder={() => setState((previous) => ({ ...previous, reminderDismissedOn: todayKey }))}
        />}
        {tab === "plan" && <PlanPage
          state={state}
          exercises={planExercises}
          missingDoseCount={missingDoseCount}
          incompatiblePlanCount={incompatiblePlanCount}
          onDose={openDose}
          onCustomize={() => setModal("customize")}
          onConfirm={() => setState((previous) => ({ ...previous, planClinicianConfirmed: true }))}
        />}
        {tab === "learn" && (selectedExercise
          ? <ExerciseDetailForContext exercise={selectedExercise} context={mediaContextForAppSurface(tab)!} allowPendingLearningMedia={isLocalPreviewHost()} onBack={() => setSelectedExercise(null)} />
          : <LearnPage search={search} setSearch={setSearch} filter={libraryFilter} setFilter={setLibraryFilter} exercises={filteredExercises} onExercise={setSelectedExercise} />)}
        {tab === "progress" && <ProgressPage state={state} sessionsByDay={sessionsByDay} />}
      </main>

      <nav className="mobile-nav" aria-label="Primary navigation">
        <NavItem icon={<House />} label="Today" active={tab === "today"} href={pathForTab("today")} />
        <NavItem icon={<CalendarCheck />} label="Plan" active={tab === "plan"} href={pathForTab("plan")} />
        <NavItem icon={<BookOpen />} label="Learn" active={tab === "learn"} href={pathForTab("learn")} />
        <NavItem icon={<ChartLineUp />} label="Progress" active={tab === "progress"} href={pathForTab("progress")} />
      </nav>

      {modal === "safety" && <SafetyModal onClose={() => setModal(null)} />}
      {modal === "onboarding" && <OnboardingModal state={state} setState={setState} onClose={() => setModal(null)} />}
      {modal === "share-import" && sharedPlanResult.plan && <SharedPlanImportModal
        plan={sharedPlanResult.plan}
        onClose={() => setModal(profileSetupComplete(state) ? null : "onboarding")}
        onImport={() => {
          try {
            setState(applySharedPlan(state, sharedPlanResult.plan!));
            setModal(profileSetupComplete(state) ? null : "onboarding");
            setToast("Plan imported. Review it before confirming.");
          } catch (error) {
            setToast(error instanceof Error ? error.message : "This plan could not be imported.");
          }
        }}
      />}
      {modal === "settings" && <SettingsModal
        state={state}
        setState={setState}
        onClose={() => setModal(null)}
        onImport={() => importInput.current?.click()}
        onExport={() => exportState(state)}
        shareUrl={shareLink.url}
        onShare={async () => {
          if (shareLink.error) {
            setToast(shareLink.error);
            return;
          }
          try {
            await navigator.clipboard.writeText(shareLink.url);
            setToast("Plan link copied");
          } catch {
            setToast("Copy failed. Select the link in Settings.");
          }
        }}
      />}
      {modal === "reminder" && <ReminderModal state={state} setState={setState} onClose={() => setModal(null)} onCalendar={() => buildCalendarFile(state)} />}
      {modal === "checkin" && <CheckInModal pain={prePain} setPain={setPrePain} swelling={preSwelling} setSwelling={setPreSwelling} flags={checkFlags} setFlags={setCheckFlags} readiness={readiness} onClose={() => setModal(null)} onStart={startSession} />}
      {modal === "dose" && doseExercise && <DoseModal exercise={doseExercise} dose={state.doses[doseExercise.id]} onClose={() => setModal(null)} onSave={saveDose} />}
      {modal === "customize" && <CustomizePlanModal state={state} setState={setState} onClose={() => setModal(null)} />}
      {modal === "discard-session" && <ActionConfirmModal
        title="Discard this saved session?"
        message="This removes every in-progress set entry. Completed session history is not affected."
        confirmLabel="Discard session"
        warning
        onClose={() => setModal(null)}
        onConfirm={confirmDiscardSessionDraft}
      />}
      {selectedExercise && tab !== "learn" && selectedDetailContext && <Modal title={selectedExercise.name} onClose={() => setSelectedExercise(null)} wide><ExerciseDetailForContext exercise={selectedExercise} context={selectedDetailContext} onBack={() => setSelectedExercise(null)} /></Modal>}
      {storageRecovery && <RecoveryModal
        recovery={storageRecovery}
        onExport={() => exportRecoveryData(storageRecovery)}
        onReset={() => {
          setStorageRecovery(null);
          setModal(sharedPlanResult.plan ? "share-import" : "onboarding");
        }}
      />}
      {persistenceWarning && <div className="persistence-warning" role="alert">
        <Warning size={20} weight="fill" />
        <span>{persistenceWarning}</span>
        <button className="text-button" onClick={() => exportState(state)}>Export backup</button>
      </div>}
      <input
        ref={importInput}
        type="file"
        accept="application/json"
        hidden
        onChange={async (event) => {
          const file = event.target.files?.[0];
          if (!file) return;
          try {
            const imported = await importState(file);
            setState(imported);
            setModal(profileSetupComplete(imported) ? null : "onboarding");
            setToast("Backup imported");
          } catch (error) {
            setToast(error instanceof Error ? error.message : "Could not import backup");
          }
          event.target.value = "";
        }}
      />
      {toast && <div className="toast" role="status" aria-live="polite"><CheckCircle size={20} weight="fill" />{toast}</div>}
    </div>
  );
}

function NavItem({ icon, label, active, href }: { icon: React.ReactElement; label: string; active: boolean; href: string }) {
  return <a className={`nav-item${active ? " nav-item--active" : ""}`} aria-current={active ? "page" : undefined} href={href}>{icon}<span>{label}</span></a>;
}

function TodayPage({ state, completedThisWeek, sessionsByDay, onStart, onDiscardDraft, onReminder, onSafety, onExercise, exercises: planExercises, planReady, missingDoseCount, incompatiblePlanCount, reminderDue, onPlan, onDismissReminder }: {
  state: LocalAppState;
  completedThisWeek: number;
  sessionsByDay: { dateKey: string; dateLabel: string; label: string; done: boolean; today: boolean }[];
  onStart: () => void;
  onDiscardDraft: () => void;
  onReminder: () => void;
  onSafety: () => void;
  onExercise: (exercise: ExerciseRecord) => void;
  exercises: readonly ExerciseRecord[];
  planReady: boolean;
  missingDoseCount: number;
  incompatiblePlanCount: number;
  reminderDue: boolean;
  onPlan: () => void;
  onDismissReminder: () => void;
}) {
  return (
    <div className="page-content">
      <header className="page-heading">
        <p>{todayLabel()}</p>
        <h1>{state.profile.displayName ? `Today's rehab, ${state.profile.displayName}.` : "Today's rehab."}</h1>
      </header>
      {reminderDue && <section className="due-banner" role="status">
        <Alarm size={24} weight="fill" />
        <div><strong>Rehab reminder</strong><span>{state.reminderTime}. Check your knee before you start.</span></div>
        <button className="text-button" onClick={onDismissReminder}>Dismiss today</button>
      </section>}
      <section className="today-grid">
        <article className="session-hero">
          <div className="session-hero__top">
            <div>
              <h2>Your recorded plan</h2>
              <p>{planExercises.length} exercises</p>
            </div>
            <div className="session-mark"><Barbell size={32} weight="duotone" /></div>
          </div>
          <div className="hero-exercises">
            {planExercises.slice(0, 4).map((exercise) => <ExerciseVisual key={exercise.id} media={exercise.media} compact />)}
            {planExercises.length > 4 && <span className="more-exercises">+{planExercises.length - 4}</span>}
          </div>
          {state.sessionDraft
            ? <SafetyBanner tone="success"><strong>Session in progress.</strong> Resume at exercise {state.sessionDraft.currentExerciseIndex + 1} of {state.sessionDraft.exercises.length}.</SafetyBanner>
            : planReady
            ? <SafetyBanner tone="success"><strong>Plan ready.</strong> Check symptoms before you start.</SafetyBanner>
            : missingDoseCount > 0 || incompatiblePlanCount > 0
            ? <SafetyBanner tone="warning"><strong>Setup needed.</strong> {incompatiblePlanCount > 0
              ? `Review ${incompatiblePlanCount} exercise${incompatiblePlanCount === 1 ? "" : "s"} for your current phase.`
              : `Add doses for ${missingDoseCount} exercise${missingDoseCount === 1 ? "" : "s"}.`}</SafetyBanner>
            : <SafetyBanner tone="warning"><strong>Confirm once.</strong> Starting doses are filled in. Confirm if they match your clinician's plan.</SafetyBanner>}
          <div className="hero-actions">
            <button className="primary-button primary-button--large" onClick={state.sessionDraft || planReady ? onStart : onPlan}>{state.sessionDraft || planReady ? <Play size={20} weight="fill" /> : <SlidersHorizontal size={20} />} {state.sessionDraft ? "Resume session" : planReady ? "Start session" : missingDoseCount > 0 || incompatiblePlanCount > 0 ? "Set up plan" : "Review plan"}</button>
            <button className="secondary-button" onClick={onReminder}><Alarm size={20} /> {state.reminderTime}</button>
          </div>
          {state.sessionDraft && <button className="text-button draft-discard-button" onClick={onDiscardDraft}>Discard saved session</button>}
        </article>

        <aside className="status-panel">
          <div className="status-panel__header"><span>This week</span><button className="text-button" onClick={onSafety}>Safety <Info size={16} /></button></div>
          <strong className="runway-number">{completedThisWeek}</strong>
          <span className="runway-label">session{completedThisWeek === 1 ? "" : "s"} logged</span>
        </aside>
      </section>

      <section className="weekly-strip">
        <div><strong>Last 7 days</strong><span>Session history</span></div>
        <div className="week-dots">{sessionsByDay.map((day) => <div key={day.dateKey} role="img" aria-label={`${day.dateLabel}: ${day.done ? "session recorded" : "no session recorded"}${day.today ? ", today" : ""}`}><span aria-hidden="true" className={`${day.done ? "done" : ""}${day.today ? " today" : ""}`}>{day.done ? <Check size={15} weight="bold" /> : ""}</span><small aria-hidden="true">{day.label}</small></div>)}</div>
      </section>

      <section className="section-block">
        <div className="section-heading"><div><h2>Your plan</h2></div><span>{planExercises.length} exercises</span></div>
        <div className="exercise-card-grid">
          {planExercises.map((exercise) => (
            <button className="exercise-card" key={exercise.id} onClick={() => onExercise(exercise)}>
              <ExerciseVisual media={exercise.media} />
              <span><strong>{exercise.shortName}</strong><small>{doseLabel(state.doses[exercise.id])}</small></span>
              <ArrowRight size={18} />
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

function PlanPage({ state, exercises: planExercises, missingDoseCount, incompatiblePlanCount, onDose, onCustomize, onConfirm }: {
  state: LocalAppState;
  exercises: readonly ExerciseRecord[];
  missingDoseCount: number;
  incompatiblePlanCount: number;
  onDose: (exercise: ExerciseRecord) => void;
  onCustomize: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="page-content">
      <header className="page-heading"><p>{state.profile.affectedKnee} knee · {stageLabel(state.profile.rehabStage)}</p><h1>Your rehab plan.</h1></header>
      <SafetyBanner>Starting doses are general guidance for this episode. Your clinician's instructions override them.</SafetyBanner>
      <div className="plan-layout">
        <section className="plan-list">
          <div className="section-heading"><div><h2>Recorded exercises</h2></div><button className="secondary-button" onClick={onCustomize}><SlidersHorizontal size={18} /> Customize</button></div>
          {planExercises.map((exercise) => <RoutineRow key={exercise.id} exercise={exercise} dose={doseLabel(state.doses[exercise.id], true)} onOpen={() => onDose(exercise)} />)}
          <div className={`plan-confirmation${state.planClinicianConfirmed ? " plan-confirmation--confirmed" : ""}`}>
            <div>
              {state.planClinicianConfirmed ? <CheckCircle size={23} weight="fill" /> : <ShieldCheck size={23} />}
              <span>
                <strong>{state.planClinicianConfirmed ? "Plan confirmed" : incompatiblePlanCount ? "Phase review needed" : missingDoseCount ? "Doses needed" : "Ready to confirm"}</strong>
                <small>{state.planClinicianConfirmed
                  ? "Changes require confirmation again."
                  : incompatiblePlanCount
                    ? `${incompatiblePlanCount} exercise${incompatiblePlanCount === 1 ? " is" : "s are"} outside the selected phase. Customize the plan before confirming.`
                    : missingDoseCount
                    ? `${missingDoseCount} exercise${missingDoseCount === 1 ? " is" : "s are"} missing a dose.`
                    : "Confirm only if this matches your clinician's plan."}</small>
              </span>
            </div>
            <button className="primary-button" disabled={missingDoseCount > 0 || incompatiblePlanCount > 0 || state.planClinicianConfirmed} onClick={onConfirm}>
              <Check size={18} weight="bold" /> {state.planClinicianConfirmed ? "Confirmed" : "Confirm plan"}
            </button>
          </div>
        </section>
        <aside className="phase-path">
          <h2>Rehab path</h2>
          <p>Your clinician decides when you progress.</p>
          {rehabPhases.map((phase) => (
            <div className={`phase-step${phase.id === state.profile.currentPhaseId ? " phase-step--active" : ""}`} key={phase.id}>
              <span>{phase.id === state.profile.currentPhaseId ? <Check size={16} weight="bold" /> : <Lock size={15} />}</span>
              <div><strong>{phase.shortName}</strong><small>{phase.summary}</small></div>
            </div>
          ))}
        </aside>
      </div>
    </div>
  );
}

function LearnPage({ search, setSearch, filter, setFilter, exercises: results, onExercise }: {
  search: string;
  setSearch: (value: string) => void;
  filter: "all" | "prehab" | "strength" | "mobility";
  setFilter: (value: "all" | "prehab" | "strength" | "mobility") => void;
  exercises: readonly ExerciseRecord[];
  onExercise: (exercise: ExerciseRecord) => void;
}) {
  const motionDemoCount = exerciseCatalog.filter((exercise) => learningMotionFor(exercise)).length;

  return (
    <div className="page-content">
      <header className="page-heading"><p>Exercise library</p><h1>Understand each movement.</h1></header>
      <SafetyBanner tone="warning">General guidance only. Use movements cleared for your knee.</SafetyBanner>
      <div className="library-toolbar">
        <AppSearchField value={search} onChange={setSearch} placeholder="Search exercises" label="Search exercises" />
        <div className="filter-tabs" role="group" aria-label="Exercise filters">
          {(["all", "prehab", "strength", "mobility"] as const).map((value) => <button key={value} aria-pressed={filter === value} className={filter === value ? "active" : ""} onClick={() => setFilter(value)}>{value === "all" ? "All" : value[0].toUpperCase() + value.slice(1)}</button>)}
        </div>
      </div>
      {results.length ? <div className="library-grid">{results.map((exercise) => (
        <button className="library-card" key={exercise.id} onClick={() => onExercise(exercise)}>
          <ExerciseVisual media={exercise.media} />
          <div>
            <span>{exercise.category.replaceAll("_", " ")}</span>
            <h3>{exercise.name}</h3>
            {learningMotionFor(exercise) && <strong className="motion-available"><FilmStrip size={14} aria-hidden="true" /> Motion available</strong>}
            <p>{exercise.description}</p>
          </div>
        </button>
      ))}</div> : <EmptyState><strong>No exercises found</strong><span>Try another search or filter.</span></EmptyState>}
      {motionDemoCount > 0 && <section className="media-credit-section">
        <div><FilmStrip size={22} weight="duotone" aria-hidden="true" /></div>
        <div>
          <h2>Motion sources</h2>
          <p>Animations are movement references. Written cues and clinician instructions take priority.</p>
          <div className="media-credit-links">
            <a href="https://github.com/hasaneyldrm/exercises-dataset" target="_blank" rel="noreferrer">Exercise dataset <ArrowRight size={16} /></a>
            <a href="https://gymvisual.com/content/3-terms-and-conditions-of-use" target="_blank" rel="noreferrer">Gym visual terms <ArrowRight size={16} /></a>
          </div>
        </div>
      </section>}
      <section className="source-section"><h2>Clinical sources</h2>{sourceCatalog.filter((source) => source.url).map((source) => <a href={source.url} target="_blank" rel="noreferrer" key={source.id}><ShieldCheck size={20} /><span><strong>{source.publisher}</strong><small>{source.title}</small></span><ArrowRight size={17} /></a>)}</section>
    </div>
  );
}

function CheckInModal({ pain, setPain, swelling, setSwelling, flags, setFlags, readiness, onClose, onStart }: {
  pain: number;
  setPain: (value: number) => void;
  swelling: SessionLog["swellingBefore"];
  setSwelling: (value: SessionLog["swellingBefore"]) => void;
  flags: CheckFlags;
  setFlags: (value: CheckFlags) => void;
  readiness: CheckStatus;
  onClose: () => void;
  onStart: () => void;
}) {
  return <Modal title="How is your knee right now?" onClose={onClose}>
    <p className="modal-intro">Use this check to notice changes. It is not medical clearance.</p>
    <AppSlider label="Current knee pain" value={pain} onChange={setPain} suffix="/10" />
    <fieldset className="field-block"><legend>Swelling compared with your usual baseline</legend><div className="segment-control">{(["none", "mild", "moderate", "marked"] as const).map((value) => <button type="button" key={value} aria-pressed={swelling === value} className={swelling === value ? "active" : ""} onClick={() => setSwelling(value)}>{value}</button>)}</div></fieldset>
    <div className="check-list">
      <CheckToggle checked={flags.aboveBaseline} onChange={(checked) => setFlags({ ...flags, aboveBaseline: checked })} label="Pain, warmth, stiffness, or swelling is above my usual baseline" />
      <CheckToggle checked={flags.locking} onChange={(checked) => setFlags({ ...flags, locking: checked })} label="New or repeated locking" />
      <CheckToggle checked={flags.instability} onChange={(checked) => setFlags({ ...flags, instability: checked })} label="Giving way or new instability" />
      <CheckToggle checked={flags.redFlag} onChange={(checked) => setFlags({ ...flags, redFlag: checked })} label="Chest pain, breathlessness, hot painful calf, fever, wound drainage, or uncontrolled pain" />
      <CheckToggle checked={flags.reviewed} onChange={(checked) => setFlags({ ...flags, reviewed: checked })} label="I reviewed today’s symptoms and every warning sign above" />
    </div>
    {readiness === "pending" && <SafetyBanner><strong>Review each warning sign, then confirm.</strong></SafetyBanner>}
    {readiness === "ready" && <SafetyBanner tone="success"><strong>No warning signs selected.</strong> Follow your recorded plan.</SafetyBanner>}
    {readiness === "adjust" && <SafetyBanner tone="warning"><strong>Pause.</strong> Follow your flare plan or contact your care team.</SafetyBanner>}
    {readiness === "stop" && <SafetyBanner tone="warning"><strong>Do not start this session.</strong> Contact your clinician. Seek urgent help for chest pain or breathlessness.</SafetyBanner>}
    <div className="modal-actions"><button className="secondary-button" onClick={onClose}>Not now</button><button className="primary-button" onClick={onStart} disabled={readiness !== "ready"}><Play size={18} weight="fill" />{readiness === "ready" ? "Start session" : readiness === "pending" ? "Review first" : "Session paused"}</button></div>
  </Modal>;
}

function CheckToggle({ checked, onChange, label }: { checked: boolean; onChange: (value: boolean) => void; label: string }) {
  return <AppCheckbox className="check-toggle" checked={checked} onChange={onChange} label={label} />;
}

function ActionConfirmModal({ title, message, confirmLabel, warning = false, onClose, onConfirm }: {
  title: string;
  message: string;
  confirmLabel: string;
  warning?: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return <Modal title={title} onClose={onClose}>
    <SafetyBanner tone={warning ? "warning" : "info"}>{message}</SafetyBanner>
    <div className="modal-actions">
      <button className="secondary-button" onClick={onClose}>Keep session open</button>
      <button className={warning ? "danger-button" : "primary-button"} onClick={onConfirm}>{warning && <Warning size={18} weight="fill" />}{confirmLabel}</button>
    </div>
  </Modal>;
}

function PostCheckModal({ pain, setPain, swelling, setSwelling, note, setNote, onClose, onFinish }: {
  pain: number; setPain: (value: number) => void; swelling: SessionLog["swellingAfter"]; setSwelling: (value: SessionLog["swellingAfter"]) => void; note: string; setNote: (value: string) => void; onClose: () => void; onFinish: () => void;
}) {
  return <Modal title="How did your knee respond?" onClose={onClose}>
    <AppSlider label="Knee pain now" value={pain} onChange={setPain} suffix="/10" />
    <fieldset className="field-block"><legend>Swelling now</legend><div className="segment-control">{(["none", "mild", "moderate", "marked"] as const).map((value) => <button type="button" key={value} aria-pressed={swelling === value} className={swelling === value ? "active" : ""} onClick={() => setSwelling(value)}>{value}</button>)}</div></fieldset>
    <AppTextArea label="Note for next time" maxLength={10_000} value={note} onChange={setNote} placeholder="Load, range, discomfort, or a question for your physio" />
    <SafetyBanner>If pain, warmth, stiffness, or swelling rises and does not settle with your agreed response plan, contact your clinician.</SafetyBanner>
    <div className="modal-actions"><button className="secondary-button" onClick={onClose}>Back</button><button className="primary-button" onClick={onFinish}><CheckCircle size={18} weight="fill" /> Save session</button></div>
  </Modal>;
}

function DoseModal({ exercise, dose, onClose, onSave }: { exercise: ExerciseRecord; dose?: ExerciseDose; onClose: () => void; onSave: (event: React.FormEvent<HTMLFormElement>) => void }) {
  return <Modal title={`Dose: ${exercise.shortName}`} onClose={onClose}>
    <form onSubmit={onSave}>
      <SafetyBanner tone="warning">Copy your prescribed dose. Leave uncertain fields blank.</SafetyBanner>
      <div className="form-grid">
        <AppNumberField label="Sets" name="sets" minValue={1} maxValue={50} defaultValue={dose?.sets ?? undefined} />
        <AppNumberField label="Reps per set" name="reps" minValue={1} maxValue={500} defaultValue={dose?.reps ?? undefined} />
        <AppNumberField label="Hold (seconds)" name="hold" minValue={1} maxValue={3600} defaultValue={dose?.holdSeconds ?? undefined} />
        <AppNumberField label="Duration (minutes)" name="duration" minValue={0.25} maxValue={480} step={0.25} defaultValue={dose?.durationMinutes ?? undefined} />
        <AppNumberField label="Load (kg)" name="load" minValue={0} maxValue={1000} step={0.5} defaultValue={dose?.loadKg ?? undefined} />
        <AppTextField className="form-grid__full" label="Approved range or setup note" name="range" maxLength={1_000} defaultValue={dose?.rangeNote ?? ""} placeholder="Example: only the range my physio showed me" />
      </div>
      <div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>Cancel</button><button className="primary-button" type="submit">Save dose</button></div>
    </form>
  </Modal>;
}

function CustomizePlanModal({ state, setState, onClose }: { state: LocalAppState; setState: React.Dispatch<React.SetStateAction<LocalAppState>>; onClose: () => void }) {
  const eligible = exerciseCatalog.filter((exercise) => exercise.planEligible !== false && exercise.eligiblePhaseIds.includes(state.profile.currentPhaseId));
  const toggleExercise = (exerciseId: string) => {
    setState((previous) => {
      const included = previous.planExerciseIds.includes(exerciseId);
      if (included && previous.planExerciseIds.length === 1) return previous;
      return {
        ...previous,
        planClinicianConfirmed: false,
        planExerciseIds: included
          ? previous.planExerciseIds.filter((id) => id !== exerciseId)
          : [...previous.planExerciseIds, exerciseId],
      };
    });
  };
  return <Modal title="Customize plan" onClose={onClose}>
    <p className="modal-intro">Include only approved exercises. At least one must remain.</p>
    <div className="customize-list">
      {eligible.map((exercise) => {
        const included = state.planExerciseIds.includes(exercise.id);
        return <button key={exercise.id} aria-pressed={included} className={`customize-row${included ? " active" : ""}`} onClick={() => toggleExercise(exercise.id)}>
          <ExerciseVisual media={exercise.media} compact />
          <span><strong>{exercise.name}</strong><small>{exercise.equipment.join(", ").replaceAll("_", " ")}</small></span>
          <span className="customize-check">{included ? <Check size={16} weight="bold" /> : <Plus size={16} />}</span>
        </button>;
      })}
    </div>
    <SafetyBanner tone="warning">Choosing an item here records your plan. It is not clinical clearance.</SafetyBanner>
    <div className="modal-actions"><button className="primary-button" onClick={onClose}>Done</button></div>
  </Modal>;
}

function ReminderModal({ state, setState, onClose, onCalendar }: { state: LocalAppState; setState: React.Dispatch<React.SetStateAction<LocalAppState>>; onClose: () => void; onCalendar: () => void }) {
  return <Modal title="Set your rehab rhythm" onClose={onClose}>
    <AppTimeField label="Preferred time" value={state.reminderTime} onChange={(reminderTime) => setState((previous) => ({ ...previous, reminderTime, reminderDismissedOn: null }))} />
    <fieldset className="field-block"><legend>Usher me on</legend><div className="day-picker">{dayLabels.map((label, day) => {
      const selected = state.reminderDays.includes(day);
      return <button type="button" key={`${label}-${day}`} aria-label={dayNames[day]} aria-pressed={selected} className={selected ? "active" : ""} onClick={() => setState((previous) => ({ ...previous, reminderDismissedOn: null, reminderDays: previous.reminderDays.includes(day) ? previous.reminderDays.filter((item) => item !== day) : [...previous.reminderDays, day].sort() }))}>{label}</button>;
    })}</div></fieldset>
    <SafetyBanner>{state.reminderDays.length ? "When you open Knee Forward after the selected local time, a due card appears. For a reliable closed-browser reminder, add the repeating event to your calendar." : "Select at least one day to enable the due card and calendar schedule."}</SafetyBanner>
    <div className="modal-actions"><button className="secondary-button" onClick={onCalendar} disabled={!state.reminderDays.length}><DownloadSimple size={18} /> Add to calendar</button><button className="primary-button" onClick={onClose}>Done</button></div>
  </Modal>;
}

function RecoveryModal({ recovery, onExport, onReset }: { recovery: StorageRecovery; onExport: () => void; onReset: () => void }) {
  return <Modal title="Your local data needs attention" onClose={() => undefined} dismissible={false}>
    <SafetyBanner tone="warning"><strong>Knee Forward did not overwrite the unreadable data.</strong> The app is showing a fresh preview until you choose what to do.</SafetyBanner>
    <p className="modal-intro recovery-copy">Reason: {recovery.message}</p>
    <p className="recovery-copy">Download the original local value for safekeeping or manual repair. Starting fresh replaces it on this device.</p>
    <div className="modal-actions">
      {recovery.raw !== null && <button className="secondary-button" onClick={onExport}><DownloadSimple size={18} /> Download recovery copy</button>}
      <button className="primary-button" onClick={onReset}>Use fresh local state</button>
    </div>
  </Modal>;
}

function OnboardingModal({ state, setState, onClose }: {
  state: LocalAppState;
  setState: React.Dispatch<React.SetStateAction<LocalAppState>>;
  onClose: () => void;
}) {
  const [displayName, setDisplayName] = useState(state.profile.displayName);
  const [affectedKnee, setAffectedKnee] = useState<LocalAppState["profile"]["affectedKnee"]>(state.profile.affectedKnee);
  const [rehabStage, setRehabStage] = useState<LocalAppState["profile"]["rehabStage"]>(state.profile.rehabStage);
  const [currentPhaseId, setCurrentPhaseId] = useState(state.profile.currentPhaseId);
  const [surgeryDate, setSurgeryDate] = useState<LocalAppState["profile"]["plannedSurgeryDate"]>(state.profile.plannedSurgeryDate);
  const [reminderTime, setReminderTime] = useState(state.reminderTime);
  const [reminderDays, setReminderDays] = useState<readonly number[]>(state.reminderDays);
  const cleanName = displayName.trim();

  return <Modal title="Set up your local profile" onClose={onClose} dismissible={profileSetupComplete(state)}>
    <p className="modal-intro">Choose what Knee Forward calls you and when it should nudge you.</p>
    <form onSubmit={(event) => {
      event.preventDefault();
      if (!cleanName) return;
      setState((previous) => ({
        ...previous,
        profile: {
          ...previous.profile,
          displayName: cleanName,
          affectedKnee,
          rehabStage,
          currentPhaseId,
          plannedSurgeryDate: rehabStage === "non_surgical" ? null : surgeryDate,
          onboardingComplete: true,
        },
        planClinicianConfirmed: false,
        reminderTime,
        reminderDays,
        reminderDismissedOn: null,
      }));
      onClose();
    }}>
      <AppTextField className="onboarding-name-field" label="Name or nickname" autoComplete="nickname" maxLength={40} value={displayName} onChange={setDisplayName} required />
      <div className="onboarding-context-grid">
        <fieldset className="field-block">
          <legend>Affected knee</legend>
          <div className="segment-control segment-control--two">
            {(["left", "right"] as const).map((knee) => <button type="button" key={knee} className={affectedKnee === knee ? "active" : ""} aria-pressed={affectedKnee === knee} onClick={() => setAffectedKnee(knee)}>{knee}</button>)}
          </div>
        </fieldset>
        <AppSelect
          label="Rehab path"
          value={rehabStage}
          options={[
            { id: "pre_surgery", label: "Pre-surgery" },
            { id: "post_surgery", label: "Post-surgery" },
            { id: "non_surgical", label: "Non-surgical" },
          ]}
          onChange={(value) => {
            const nextStage = value as EpisodeStage;
            setRehabStage(nextStage);
            setCurrentPhaseId(defaultPhaseForStage(nextStage));
          }}
        />
        <AppSelect label="Current phase" value={currentPhaseId} options={phasesForStage(rehabStage).map((phase) => ({ id: phase.id, label: phase.name }))} onChange={setCurrentPhaseId} />
        {rehabStage !== "non_surgical" && <AppDatePicker label={rehabStage === "post_surgery" ? "Surgery date" : "Planned surgery date"} value={surgeryDate} onChange={setSurgeryDate} optional />}
      </div>
      <p className="field-help">Choose the phase your clinician has confirmed. A date never advances your plan automatically.</p>
      <div className="onboarding-reminder-grid">
        <AppTimeField label="Preferred time" value={reminderTime} onChange={setReminderTime} />
        <fieldset className="field-block">
          <legend>Reminder days</legend>
          <div className="day-picker">{dayLabels.map((label, day) => {
            const selected = reminderDays.includes(day);
            return <button
              type="button"
              key={`${label}-${day}`}
              aria-label={dayNames[day]}
              aria-pressed={selected}
              className={selected ? "active" : ""}
              onClick={() => setReminderDays((previous) => previous.includes(day) ? previous.filter((item) => item !== day) : [...previous, day].sort())}
            >{label}</button>;
          })}</div>
        </fieldset>
      </div>
      <SafetyBanner>This profile stays in this browser. Shared plan links never include your name, surgery date, check-ins, or history.</SafetyBanner>
      <div className="modal-actions"><button className="primary-button" type="submit" disabled={!cleanName}>Save profile</button></div>
    </form>
  </Modal>;
}

function SharedPlanImportModal({ plan, onClose, onImport }: { plan: SharedPlan; onClose: () => void; onImport: () => void }) {
  return <Modal title="Import shared plan?" onClose={onClose}>
    <p>This link contains {plan.exercises.length} exercise{plan.exercises.length === 1 ? "" : "s"} and their recorded doses.</p>
    <SafetyBanner tone="warning">Importing replaces your current plan and clears any in-progress session. It does not import dates, symptoms, notes, reminders, or history.</SafetyBanner>
    <div className="modal-actions"><button className="secondary-button" onClick={onClose}>Cancel</button><button className="primary-button" onClick={onImport}>Import plan</button></div>
  </Modal>;
}

function SettingsModal({ state, setState, onClose, onExport, onImport, shareUrl, onShare }: {
  state: LocalAppState;
  setState: React.Dispatch<React.SetStateAction<LocalAppState>>;
  onClose: () => void;
  onExport: () => void;
  onImport: () => void;
  shareUrl: string;
  onShare: () => void;
}) {
  const contextLocked = state.sessionDraft !== null;
  const updateContext = (patch: Partial<Pick<LocalAppState["profile"], "affectedKnee" | "rehabStage" | "currentPhaseId">>) => {
    if (contextLocked) return;
    setState((previous) => ({
      ...previous,
      profile: { ...previous.profile, ...patch },
      planClinicianConfirmed: false,
    }));
  };
  return <Modal title="Settings" onClose={onClose}>
    <section className="settings-section"><h3>Profile</h3><AppTextField label="Name or nickname" autoComplete="nickname" maxLength={40} value={state.profile.displayName} onChange={(displayName) => setState((previous) => ({ ...previous, profile: { ...previous.profile, displayName: displayName.slice(0, 40) } }))} /></section>
    <section className="settings-section">
      <h3>Rehab context</h3>
      <fieldset className="field-block" disabled={contextLocked}>
        <legend>Affected knee</legend>
        <div className="segment-control segment-control--two">{(["left", "right"] as const).map((knee) => <button type="button" key={knee} className={state.profile.affectedKnee === knee ? "active" : ""} aria-pressed={state.profile.affectedKnee === knee} onClick={() => updateContext({ affectedKnee: knee })}>{knee}</button>)}</div>
      </fieldset>
      <AppSelect label="Rehab path" disabled={contextLocked} value={state.profile.rehabStage} options={[{ id: "pre_surgery", label: "Pre-surgery" }, { id: "post_surgery", label: "Post-surgery" }, { id: "non_surgical", label: "Non-surgical" }]} onChange={(value) => {
        const rehabStage = value as EpisodeStage;
        updateContext({ rehabStage, currentPhaseId: defaultPhaseForStage(rehabStage) });
      }} />
      <AppSelect label="Current phase" disabled={contextLocked} value={state.profile.currentPhaseId} options={phasesForStage(state.profile.rehabStage).map((phase) => ({ id: phase.id, label: phase.name }))} onChange={(currentPhaseId) => updateContext({ currentPhaseId })} />
      {state.profile.rehabStage !== "non_surgical" && <AppDatePicker label={state.profile.rehabStage === "post_surgery" ? "Surgery date" : "Planned surgery date"} value={state.profile.plannedSurgeryDate} onChange={(plannedSurgeryDate) => setState((previous) => ({ ...previous, profile: { ...previous.profile, plannedSurgeryDate } }))} optional />}
      {contextLocked
        ? <SafetyBanner tone="warning">Finish or discard the saved session before changing knee or phase.</SafetyBanner>
        : <p className="field-help">Changing knee or phase requires you to review and confirm the recorded plan again.</p>}
    </section>
    <section className="settings-section"><h3>Share plan</h3><p>Includes exercises and doses only.</p><AppTextField label="Plan link" readOnly value={shareUrl} onFocus={(event) => event.currentTarget.select()} /><button className="secondary-button" disabled={!shareUrl} onClick={onShare}><LinkSimple size={18} /> Copy link</button></section>
    <section className="settings-section"><h3>Backup</h3><p>Backups include all data stored in this browser.</p><div className="settings-actions"><button className="secondary-button" onClick={onExport}><DownloadSimple size={18} /> Export backup</button><button className="secondary-button" onClick={onImport}><UploadSimple size={18} /> Import backup</button></div></section>
  </Modal>;
}

function SafetyModal({ onClose }: { onClose: () => void }) {
  return <Modal title="Safety comes before the streak" onClose={onClose} wide>
    <div className="safety-modal-grid">
      <section><FirstAid size={28} /><h3>What this app does</h3><p>It teaches general concepts, stores the plan you record from your clinician, and helps you notice patterns.</p></section>
      <section><ShieldCheck size={28} /><h3>What it never does</h3><p>It does not diagnose, prescribe, or clear you to run, jump, pivot, or return to sport.</p></section>
      <section><Warning size={28} /><h3>Stop and contact your clinician</h3><p>For sharp or worsening pain, new swelling, loss of motion, repeated locking, or giving way.</p></section>
      <section><Sparkle size={28} /><h3>Seek urgent help</h3><p>After surgery, chest pain or breathlessness needs urgent medical help. A hot painful calf, fever, wound drainage, or uncontrolled pain needs prompt assessment.</p></section>
    </div>
    <SafetyBanner>{SAFETY_NOTICE}</SafetyBanner>
    <div className="source-links">{sourceCatalog.filter((source) => source.url).map((source) => <a key={source.id} href={source.url} target="_blank" rel="noreferrer">{source.publisher}<ArrowRight size={16} /></a>)}</div>
  </Modal>;
}

export default App;
