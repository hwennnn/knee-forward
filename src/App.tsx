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
  Database,
  DownloadSimple,
  FilmStrip,
  FirstAid,
  Gear,
  House,
  Info,
  Lock,
  MagnifyingGlass,
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
import type { ExerciseDose, ExerciseRecord, LocalAppState, RehabEpisode, SessionLog, SourceMetadata } from "./types";
import { EmptyState, ExerciseDetailForContext, ExerciseVisual, Modal, RoutineRow, SafetyBanner } from "./components";
import { mediaContextForAppSurface, motionMediaForExerciseContext } from "./exerciseMedia";
import { pathForTab, tabFromPathname } from "./navigation";
import { ProgressPage } from "./ProgressPage";
import { initialPostResponse, performedSetOutcome, previousSetsForExercise } from "./sessionTracking";
import { exportRecoveryData, exportState, importState, loadState, saveState } from "./storage";
import { WorkoutSetLogger } from "./WorkoutSetLogger";
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

function doseLabel(dose?: ExerciseDose) {
  if (!dose) return "Add your physio's dose";
  const load = dose.loadKg !== null ? ` at ${dose.loadKg} kg` : "";
  if (dose.durationMinutes !== null) return `${dose.durationMinutes} min${load}`;
  if (dose.sets !== null && dose.reps !== null) return `${dose.sets} sets × ${dose.reps} reps${load}`;
  if (dose.sets !== null && dose.holdSeconds !== null) return `${dose.sets} × ${dose.holdSeconds}s holds${load}`;
  return "Add your physio's dose";
}

function doseIsComplete(dose?: ExerciseDose) {
  if (!dose) return false;
  if (dose.durationMinutes !== null) return true;
  return dose.sets !== null && (dose.reps !== null || dose.holdSeconds !== null);
}

function blankPerformedSets(dose: ExerciseDose): SessionSetLog[] {
  return Array.from({ length: dose.sets ?? 1 }, () => ({ reps: null, loadKg: null, completed: false }));
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
  const tab = tabFromPathname(window.location.pathname);
  const [modal, setModal] = useState<"safety" | "settings" | "reminder" | "checkin" | "postcheck" | "dose" | "customize" | "pause-session" | "discard-session" | "stop-session" | null>(null);
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
  const [toast, setToast] = useState<string | null>(null);
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
  const planExercises = state.planExerciseIds
    .map((id) => exerciseCatalog.find((exercise) => exercise.id === id))
    .filter((exercise): exercise is ExerciseRecord => Boolean(exercise));
  const missingDoseCount = planExercises.filter((exercise) => !doseIsComplete(state.doses[exercise.id])).length;
  const planReady = state.planClinicianConfirmed && missingDoseCount === 0;
  const surgeryDate = activeEpisode.plannedSurgeryDate
    ? new Intl.DateTimeFormat("en-SG", { month: "short", day: "numeric", year: "numeric" }).format(new Date(`${activeEpisode.plannedSurgeryDate}T00:00:00`))
    : "Not set";
  const daysToSurgery = activeEpisode.plannedSurgeryDate
    ? Math.max(0, Math.ceil((new Date(`${activeEpisode.plannedSurgeryDate}T00:00:00`).getTime() - Date.now()) / 86_400_000))
    : null;
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
          <div><strong>Prehab foundations</strong><span>{draft.currentExerciseIndex + 1} of {draft.exercises.length}</span></div>
          <span className="workout-percent">{Math.round((handledExerciseCount / draft.exercises.length) * 100)}%</span>
        </header>
        <div className="workout-progress"><span style={{ width: `${((draft.currentExerciseIndex + 1) / draft.exercises.length) * 100}%` }} /></div>
        <main className="workout-main">
          <div className="workout-media"><ExerciseVisual media={exercise.media} /></div>
          <section className="workout-copy">
            <p className="kicker">Right knee · recorded clinician instructions</p>
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
            <SafetyBanner tone="warning">Previous values are history only. Do not increase load unless your clinician changed today&apos;s plan. Stop for worsening pain, swelling, locking, or giving way.</SafetyBanner>
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
          <span className="episode-card__knee">R</span>
          <div><strong>Right knee</strong><span>Pre-surgery · active</span></div>
          <CaretDown size={16} />
        </div>
        <nav className="desktop-nav" aria-label="Primary navigation">
          <NavItem icon={<House />} label="Today" active={tab === "today"} href={pathForTab("today")} />
          <NavItem icon={<CalendarCheck />} label="My plan" active={tab === "plan"} href={pathForTab("plan")} />
          <NavItem icon={<BookOpen />} label="Learn" active={tab === "learn"} href={pathForTab("learn")} />
          <NavItem icon={<ChartLineUp />} label="Progress" active={tab === "progress"} href={pathForTab("progress")} />
        </nav>
        <div className="sidebar-spacer" />
        <SafetyBanner><strong>Education, not clearance.</strong><br />Your clinical team decides progression.</SafetyBanner>
        <button className="nav-item" onClick={() => setModal("settings")}><Gear /> Settings</button>
      </aside>

      <main className="page">
        <header className="mobile-header">
          <a className="brand" href={pathForTab("today")}><img src="/assets/icon-192.png" alt="" /><span>Knee Forward</span></a>
          <button className="icon-button" onClick={() => setModal("settings")} aria-label="Settings"><Gear size={23} /></button>
        </header>
        {tab === "today" && <TodayPage
          state={state}
          surgeryDate={surgeryDate}
          daysToSurgery={daysToSurgery}
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
          reminderDue={reminderDue}
          onPlan={() => window.location.assign(pathForTab("plan"))}
          onDismissReminder={() => setState((previous) => ({ ...previous, reminderDismissedOn: todayKey }))}
        />}
        {tab === "plan" && <PlanPage
          state={state}
          exercises={planExercises}
          missingDoseCount={missingDoseCount}
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
      {modal === "settings" && <SettingsModal state={state} onClose={() => setModal(null)} onImport={() => importInput.current?.click()} onExport={() => exportState(state)} />}
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
        onReset={() => setStorageRecovery(null)}
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
            setState(await importState(file));
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

function TodayPage({ state, surgeryDate, daysToSurgery, completedThisWeek, sessionsByDay, onStart, onDiscardDraft, onReminder, onSafety, onExercise, exercises: planExercises, planReady, missingDoseCount, reminderDue, onPlan, onDismissReminder }: {
  state: LocalAppState;
  surgeryDate: string;
  daysToSurgery: number | null;
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
  reminderDue: boolean;
  onPlan: () => void;
  onDismissReminder: () => void;
}) {
  return (
    <div className="page-content">
      <header className="page-heading">
        <p>{todayLabel()}</p>
        <h1>Let’s keep your knee moving forward.</h1>
      </header>
      {reminderDue && <section className="due-banner" role="status">
        <Alarm size={24} weight="fill" />
        <div><strong>Your rehab time has arrived.</strong><span>{state.reminderTime} on this device. Check your knee before deciding whether to begin.</span></div>
        <button className="text-button" onClick={onDismissReminder}>Dismiss today</button>
      </section>}
      <section className="today-grid">
        <article className="session-hero">
          <div className="session-hero__top">
            <div>
              <p className="kicker">From your first physio visit</p>
              <h2>Prehab foundations</h2>
              <p>{planExercises.length} exercises · dose and range come from your clinician</p>
            </div>
            <div className="session-mark"><Barbell size={32} weight="duotone" /></div>
          </div>
          <div className="hero-exercises">
            {planExercises.slice(0, 4).map((exercise) => <ExerciseVisual key={exercise.id} media={exercise.media} compact />)}
            {planExercises.length > 4 && <span className="more-exercises">+{planExercises.length - 4}</span>}
          </div>
          {state.sessionDraft
            ? <SafetyBanner tone="success"><strong>Session saved in progress.</strong> Resume at exercise {state.sessionDraft.currentExerciseIndex + 1} of {state.sessionDraft.exercises.length}. Your performed sets stay on this device.</SafetyBanner>
            : planReady
            ? <SafetyBanner tone="success"><strong>Plan confirmed.</strong> We’ll still check pain, swelling, locking, and giving way before you begin.</SafetyBanner>
            : <SafetyBanner tone="warning"><strong>Setup needed.</strong> {missingDoseCount > 0 ? `Add clinician-provided dosage for ${missingDoseCount} movement${missingDoseCount === 1 ? "" : "s"}.` : "Confirm that you copied this plan from your clinician."}</SafetyBanner>}
          <div className="hero-actions">
            <button className="primary-button primary-button--large" onClick={state.sessionDraft || planReady ? onStart : onPlan}>{state.sessionDraft || planReady ? <Play size={20} weight="fill" /> : <SlidersHorizontal size={20} />} {state.sessionDraft ? "Resume session" : planReady ? "Start session" : "Complete plan"}</button>
            <button className="secondary-button" onClick={onReminder}><Alarm size={20} /> {state.reminderTime}</button>
          </div>
          <p className="tracking-intro-copy">Guided sessions keep your clinician target separate from the reps and kilograms you perform today.</p>
          {state.sessionDraft && <button className="text-button draft-discard-button" onClick={onDiscardDraft}>Discard saved session</button>}
        </article>

        <aside className="status-panel">
          <div className="status-panel__header"><span>Your runway</span><button className="text-button" onClick={onSafety}>Safety <Info size={16} /></button></div>
          <strong className="runway-number">{daysToSurgery ?? "-"}</strong>
          <span className="runway-label">days until planned surgery</span>
          <div className="surgery-date"><CalendarCheck size={20} /><div><span>Planned date</span><strong>{surgeryDate}</strong></div></div>
          <p className="microcopy">The date keeps you oriented. It never unlocks a rehab phase.</p>
        </aside>
      </section>

      <section className="weekly-strip">
        <div><strong>This week</strong><span>{completedThisWeek} session{completedThisWeek === 1 ? "" : "s"} logged</span></div>
        <div className="week-dots">{sessionsByDay.map((day) => <div key={day.dateKey} role="img" aria-label={`${day.dateLabel}: ${day.done ? "session recorded" : "no session recorded"}${day.today ? ", today" : ""}`}><span aria-hidden="true" className={`${day.done ? "done" : ""}${day.today ? " today" : ""}`}>{day.done ? <Check size={15} weight="bold" /> : ""}</span><small aria-hidden="true">{day.label}</small></div>)}</div>
      </section>

      <section className="section-block">
        <div className="section-heading"><div><h2>Your visit exercises</h2><p>Seeded from your first pre-surgery rehab visit.</p></div><span>{planExercises.length} movements</span></div>
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

function PlanPage({ state, exercises: planExercises, missingDoseCount, onDose, onCustomize, onConfirm }: {
  state: LocalAppState;
  exercises: readonly ExerciseRecord[];
  missingDoseCount: number;
  onDose: (exercise: ExerciseRecord) => void;
  onCustomize: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="page-content">
      <header className="page-heading"><p>Right knee · pre-surgery</p><h1>Record your first-visit plan.</h1></header>
      <SafetyBanner>Nothing here advances automatically. Copy only the exercises, dose, range, and setup your physiotherapist gave you.</SafetyBanner>
      <div className="plan-layout">
        <section className="plan-list">
          <div className="section-heading"><div><h2>Prehab foundations</h2><p>Tap a movement to record reps, holds or duration, load, and range notes.</p></div><button className="secondary-button" onClick={onCustomize}><SlidersHorizontal size={18} /> Customize</button></div>
          {planExercises.map((exercise) => <RoutineRow key={exercise.id} exercise={exercise} dose={doseLabel(state.doses[exercise.id])} onOpen={() => onDose(exercise)} />)}
          <div className={`plan-confirmation${state.planClinicianConfirmed ? " plan-confirmation--confirmed" : ""}`}>
            <div>
              {state.planClinicianConfirmed ? <CheckCircle size={23} weight="fill" /> : <ShieldCheck size={23} />}
              <span>
                <strong>{state.planClinicianConfirmed ? "Recorded plan confirmed" : missingDoseCount ? "Dosage still needed" : "Ready for your confirmation"}</strong>
                <small>{state.planClinicianConfirmed
                  ? "Changing an exercise or dose will ask you to confirm again."
                  : missingDoseCount
                    ? `${missingDoseCount} movement${missingDoseCount === 1 ? " is" : "s are"} missing a clinician-provided dose.`
                    : "Confirm only if this exactly matches what your clinician prescribed."}</small>
              </span>
            </div>
            <button className="primary-button" disabled={missingDoseCount > 0 || state.planClinicianConfirmed} onClick={onConfirm}>
              <Check size={18} weight="bold" /> {state.planClinicianConfirmed ? "Confirmed" : "Confirm copied plan"}
            </button>
          </div>
        </section>
        <aside className="phase-path">
          <h2>Rehab path</h2>
          <p>Typical windows are deliberately omitted. Your milestones and procedure determine progression.</p>
          {rehabPhases.map((phase, index) => (
            <div className={`phase-step${index === 0 ? " phase-step--active" : ""}`} key={phase.id}>
              <span>{index === 0 ? <Check size={16} weight="bold" /> : <Lock size={15} />}</span>
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
      <header className="page-heading"><p>General guide · no sign-in needed</p><h1>Understand each movement.</h1></header>
      <SafetyBanner tone="warning">The library teaches concepts. It does not prescribe an exercise, dose, range, or phase for your knee.</SafetyBanner>
      {motionDemoCount > 0 && <section className="demo-guide" aria-label="Motion demonstration note">
          <div>
            <strong>{exerciseCatalog.length} exercises, with {motionDemoCount} motion references</strong>
            <span>Cards stay still for clarity. Open an exercise to see its reference demo below the primary image. Your physiotherapist decides the variation, range, resistance, and timing.</span>
          </div>
        </section>}
      <div className="library-toolbar">
        <label className="search-box"><MagnifyingGlass size={20} /><span className="sr-only">Search exercises</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search exercises" /></label>
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
          <h2>About the motion demos</h2>
          <p>Every exercise includes an approved dataset animation below its primary still. Exact matches and general movement references are labeled separately; the written setup and your clinician's instructions take priority.</p>
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
    <p className="modal-intro">This check does not diagnose readiness. It helps you notice changes before exercising.</p>
    <label className="field-block"><span>Current knee pain <strong>{pain}/10</strong></span><input type="range" min="0" max="10" value={pain} onChange={(event) => setPain(Number(event.target.value))} /></label>
    <fieldset className="field-block"><legend>Swelling compared with your usual baseline</legend><div className="segment-control">{(["none", "mild", "moderate", "marked"] as const).map((value) => <button type="button" key={value} aria-pressed={swelling === value} className={swelling === value ? "active" : ""} onClick={() => setSwelling(value)}>{value}</button>)}</div></fieldset>
    <div className="check-list">
      <CheckToggle checked={flags.aboveBaseline} onChange={(checked) => setFlags({ ...flags, aboveBaseline: checked })} label="Pain, warmth, stiffness, or swelling is above my usual baseline" />
      <CheckToggle checked={flags.locking} onChange={(checked) => setFlags({ ...flags, locking: checked })} label="New or repeated locking" />
      <CheckToggle checked={flags.instability} onChange={(checked) => setFlags({ ...flags, instability: checked })} label="Giving way or new instability" />
      <CheckToggle checked={flags.redFlag} onChange={(checked) => setFlags({ ...flags, redFlag: checked })} label="Chest pain, breathlessness, hot painful calf, fever, wound drainage, or uncontrolled pain" />
      <CheckToggle checked={flags.reviewed} onChange={(checked) => setFlags({ ...flags, reviewed: checked })} label="I reviewed today’s symptoms and every warning sign above" />
    </div>
    {readiness === "pending" && <SafetyBanner><strong>Complete the safety review.</strong> Consider each question, then confirm that you reviewed today’s symptoms before beginning.</SafetyBanner>}
    {readiness === "ready" && <SafetyBanner tone="success"><strong>No new warning signal selected.</strong> This is not medical clearance. Follow only the plan you recorded from your clinician.</SafetyBanner>}
    {readiness === "adjust" && <SafetyBanner tone="warning"><strong>Pause this session.</strong> Use only a clinician-authored flare plan, or contact your care team for guidance.</SafetyBanner>}
    {readiness === "stop" && <SafetyBanner tone="warning"><strong>Do not start this session.</strong> Contact your clinician. Seek urgent help for chest pain or breathlessness.</SafetyBanner>}
    <div className="modal-actions"><button className="secondary-button" onClick={onClose}>Not now</button><button className="primary-button" onClick={onStart} disabled={readiness !== "ready"}><Play size={18} weight="fill" />{readiness === "ready" ? "Begin recorded plan" : readiness === "pending" ? "Review check first" : "Session paused"}</button></div>
  </Modal>;
}

function CheckToggle({ checked, onChange, label }: { checked: boolean; onChange: (value: boolean) => void; label: string }) {
  return <label className="check-toggle"><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} /><span><Check size={15} weight="bold" /></span>{label}</label>;
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
    <label className="field-block"><span>Knee pain now <strong>{pain}/10</strong></span><input type="range" min="0" max="10" value={pain} onChange={(event) => setPain(Number(event.target.value))} /></label>
    <fieldset className="field-block"><legend>Swelling now</legend><div className="segment-control">{(["none", "mild", "moderate", "marked"] as const).map((value) => <button type="button" key={value} aria-pressed={swelling === value} className={swelling === value ? "active" : ""} onClick={() => setSwelling(value)}>{value}</button>)}</div></fieldset>
    <label className="field-block"><span>Note for next time</span><textarea maxLength={10_000} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Load, range, discomfort, or a question for your physio" /></label>
    <SafetyBanner>If pain, warmth, stiffness, or swelling rises and does not settle with your agreed response plan, contact your clinician.</SafetyBanner>
    <div className="modal-actions"><button className="secondary-button" onClick={onClose}>Back</button><button className="primary-button" onClick={onFinish}><CheckCircle size={18} weight="fill" /> Save session</button></div>
  </Modal>;
}

function DoseModal({ exercise, dose, onClose, onSave }: { exercise: ExerciseRecord; dose?: ExerciseDose; onClose: () => void; onSave: (event: React.FormEvent<HTMLFormElement>) => void }) {
  return <Modal title={`Dose: ${exercise.shortName}`} onClose={onClose}>
    <form onSubmit={onSave}>
      <SafetyBanner tone="warning">Copy only what your physio prescribed. Add either reps, hold time, or duration. Leave fields blank if you are unsure.</SafetyBanner>
      <div className="form-grid">
        <label><span>Sets</span><input name="sets" type="number" min="1" max="50" defaultValue={dose?.sets ?? ""} /></label>
        <label><span>Reps per set</span><input name="reps" type="number" min="1" max="500" defaultValue={dose?.reps ?? ""} /></label>
        <label><span>Hold (seconds)</span><input name="hold" type="number" min="1" max="3600" defaultValue={dose?.holdSeconds ?? ""} /></label>
        <label><span>Duration (minutes)</span><input name="duration" type="number" min="0.25" max="480" step="0.25" defaultValue={dose?.durationMinutes ?? ""} /></label>
        <label><span>Load (kg)</span><input name="load" type="number" min="0" max="1000" step="0.5" defaultValue={dose?.loadKg ?? ""} /></label>
        <label className="form-grid__full"><span>Approved range or setup note</span><input name="range" type="text" maxLength={1_000} defaultValue={dose?.rangeNote ?? ""} placeholder="Example: only the range my physio showed me" /></label>
      </div>
      <div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>Cancel</button><button className="primary-button" type="submit">Save dose</button></div>
    </form>
  </Modal>;
}

function CustomizePlanModal({ state, setState, onClose }: { state: LocalAppState; setState: React.Dispatch<React.SetStateAction<LocalAppState>>; onClose: () => void }) {
  const eligible = exerciseCatalog.filter((exercise) => exercise.planEligible !== false && exercise.eligiblePhaseIds.includes("prehab"));
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
  return <Modal title="Customize this prehab session" onClose={onClose}>
    <p className="modal-intro">Add or remove only movements your clinician approved for this right-knee episode. At least one exercise remains in the session.</p>
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
    <label className="field-block"><span>Preferred time</span><input className="time-input" type="time" value={state.reminderTime} onChange={(event) => setState((previous) => ({ ...previous, reminderTime: event.target.value, reminderDismissedOn: null }))} /></label>
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

function SettingsModal({ state, onClose, onExport, onImport }: { state: LocalAppState; onClose: () => void; onExport: () => void; onImport: () => void }) {
  return <Modal title="Settings and your data" onClose={onClose}>
    <section className="settings-section"><h3>Rehab episodes</h3>{episodeCatalog.map((episode) => <button disabled={episode.id !== state.activeEpisodeId} className={`episode-option${state.activeEpisodeId === episode.id ? " active" : ""}`} key={episode.id}><span className="episode-card__knee">{episode.knee[0].toUpperCase()}</span><span><strong>{episode.title}</strong><small>{episode.status}, {episode.stage.replace("_", " ")}{episode.id !== state.activeEpisodeId ? " · history" : ""}</small></span>{state.activeEpisodeId === episode.id && <CheckCircle size={21} weight="fill" />}</button>)}</section>
    <section className="settings-section"><h3>Local data</h3><p>Your health-adjacent data stays in this browser. No account or server is used in this MVP.</p><div className="settings-actions"><button className="secondary-button" onClick={onExport}><DownloadSimple size={18} /> Export backup</button><button className="secondary-button" onClick={onImport}><UploadSimple size={18} /> Import backup</button></div></section>
    <SafetyBanner><Database size={19} />Optional Supabase sign-in and cross-device sync are intentionally deferred until productionization.</SafetyBanner>
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
