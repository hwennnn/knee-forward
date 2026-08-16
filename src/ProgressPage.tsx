import { useEffect, useMemo, useState } from "react";
import {
  Barbell,
  CalendarCheck,
  ChartLineUp,
  CheckCircle,
  ListChecks,
} from "@phosphor-icons/react";
import { EmptyState } from "./components";
import { exercises } from "./data";
import type { LocalAppState, SessionExerciseLog, SessionSetLog } from "./types";

type SessionsByDay = readonly { dateKey: string; dateLabel: string; label: string; done: boolean; today: boolean }[];

interface ProgressPageProps {
  state: LocalAppState;
  sessionsByDay: SessionsByDay;
}

const dateFormatter = new Intl.DateTimeFormat("en-SG", {
  dateStyle: "medium",
  timeStyle: "short",
});

function completedSets(exercise: SessionExerciseLog): readonly SessionSetLog[] {
  return exercise.sets.filter((set) => set.completed);
}

function totalReps(sets: readonly SessionSetLog[]): number | null {
  if (!sets.length || sets.some((set) => set.reps === null)) return null;
  return sets.reduce((total, set) => total + (set.reps ?? 0), 0);
}

function topLoad(sets: readonly SessionSetLog[]): number | null {
  const loads = sets.flatMap((set) => set.loadKg === null ? [] : [set.loadKg]);
  return loads.length ? Math.max(...loads) : null;
}

function loadVolume(sets: readonly SessionSetLog[]): number | null {
  if (!sets.length || sets.some((set) => set.reps === null || set.loadKg === null)) return null;
  return sets.reduce((total, set) => total + (set.reps ?? 0) * (set.loadKg ?? 0), 0);
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-SG", { maximumFractionDigits: 2 }).format(value);
}

function formatMetric(value: number | null, unit = ""): string {
  return value === null ? "Unavailable" : `${formatNumber(value)}${unit}`;
}

function formatStatus(status: SessionExerciseLog["status"]): string {
  return String(status).replaceAll("_", " ");
}

export function ProgressPage({ state, sessionsByDay }: ProgressPageProps) {
  const sortedSessions = useMemo(
    () => state.sessions
      .filter((session) => session.episodeId === state.activeEpisodeId)
      .sort((left, right) => Date.parse(right.completedAt) - Date.parse(left.completedAt)),
    [state.activeEpisodeId, state.sessions],
  );
  const recent = sortedSessions.slice(0, 5);
  const recordedExercises = useMemo(
    () => sortedSessions.flatMap((session) => session.exerciseLogs.map((exercise) => ({ session, exercise }))),
    [sortedSessions],
  );
  const exerciseNames = useMemo(
    () => new Map<string, string>(exercises.map((exercise) => [exercise.id, exercise.name])),
    [],
  );
  const availableExercises = useMemo(() => {
    const names = new Map<string, string>();
    for (const { exercise } of recordedExercises) {
      if (!names.has(exercise.exerciseId)) {
        names.set(exercise.exerciseId, exercise.exerciseName || exerciseNames.get(exercise.exerciseId) || "Recorded exercise");
      }
    }
    return [...names].map(([id, name]) => ({ id, name }));
  }, [exerciseNames, recordedExercises]);
  const mostRecentExerciseId = recordedExercises[0]?.exercise.exerciseId ?? "";
  const [selectedExerciseId, setSelectedExerciseId] = useState(mostRecentExerciseId);

  useEffect(() => {
    if (!availableExercises.some((exercise) => exercise.id === selectedExerciseId)) {
      setSelectedExerciseId(mostRecentExerciseId);
    }
  }, [availableExercises, mostRecentExerciseId, selectedExerciseId]);

  const selectedExerciseHistory = recordedExercises
    .filter(({ exercise }) => exercise.exerciseId === selectedExerciseId);
  const visibleHistory = selectedExerciseHistory.slice(0, 8);
  const latestRecorded = selectedExerciseHistory[0];
  const latestCompletedSets = latestRecorded ? completedSets(latestRecorded.exercise) : [];
  const highestRecordedLoad = selectedExerciseHistory.reduce<number | null>((highest, item) => {
    const load = topLoad(completedSets(item.exercise));
    return load === null ? highest : highest === null ? load : Math.max(highest, load);
  }, null);
  const averagePainChange = sortedSessions.length
    ? (sortedSessions.reduce((sum, item) => sum + item.painAfter - item.painBefore, 0) / sortedSessions.length).toFixed(1)
    : "-";
  const completedSetCount = sortedSessions.reduce(
    (sessionTotal, session) => sessionTotal + session.exerciseLogs.reduce(
      (exerciseTotal, exercise) => exerciseTotal + completedSets(exercise).length,
      0,
    ),
    0,
  );

  return (
    <div className="page-content">
      <header className="page-heading"><p>Progress</p><h1>Your recorded history.</h1></header>
      <div className="metric-grid tracking-metrics">
        <article><CalendarCheck size={24} /><strong>{sortedSessions.length}</strong><span>sessions logged</span></article>
        <article><Barbell size={24} /><strong>{sortedSessions.reduce((sum, item) => sum + item.completedExerciseIds.length, 0)}</strong><span>exercises completed</span></article>
        <article><ListChecks size={24} /><strong>{completedSetCount}</strong><span>completed sets</span></article>
        <article><ChartLineUp size={24} /><strong>{averagePainChange}</strong><span>average pain change</span></article>
      </div>
      <section className="progress-chart">
        <div className="section-heading"><div><h2>Last 7 days</h2></div></div>
        <div className="bar-chart">{sessionsByDay.map((day) => <div key={day.dateKey} role="img" aria-label={`${day.dateLabel}: ${day.done ? "session recorded" : "no session recorded"}${day.today ? ", today" : ""}`}><span aria-hidden="true" style={{ height: day.done ? "82%" : "10%" }} className={day.done ? "done" : ""} /><small aria-hidden="true">{day.label}</small></div>)}</div>
      </section>
      <section className="history-section tracking-exercise-history">
        <div className="section-heading tracking-history-heading">
          <div><h2>Exercise history</h2><p>Recorded values are not targets.</p></div>
          {availableExercises.length > 0 && <label className="tracking-exercise-picker" htmlFor="tracking-exercise-select">
            <span>Exercise</span>
            <select id="tracking-exercise-select" value={selectedExerciseId} onChange={(event) => setSelectedExerciseId(event.target.value)}>
              {availableExercises.map((exercise) => <option key={exercise.id} value={exercise.id}>{exercise.name}</option>)}
            </select>
          </label>}
        </div>
        {latestRecorded ? <>
          <div className="tracking-history-metrics">
            <article><span>Sessions recorded</span><strong>{selectedExerciseHistory.length}</strong></article>
            <article><span>Highest recorded load</span><strong>{formatMetric(highestRecordedLoad, " kg")}</strong></article>
            <article><span>Total reps, latest session</span><strong>{formatMetric(totalReps(latestCompletedSets))}</strong></article>
            <article><span>Latest recorded load-volume</span><strong>{formatMetric(loadVolume(latestCompletedSets), " kg-reps")}</strong></article>
          </div>
          <div className="tracking-session-list">
            {visibleHistory.map(({ session, exercise }) => {
              const sets = completedSets(exercise);
              return <article className={`history-row tracking-session-row tracking-session-row--${exercise.status}`} key={`${session.id}-${exercise.exerciseId}`}>
                {exercise.status === "completed" ? <CheckCircle size={23} weight="fill" aria-hidden="true" /> : <ListChecks size={23} aria-hidden="true" />}
                <div className="tracking-session-summary">
                  <strong>{dateFormatter.format(new Date(session.completedAt))}</strong>
                  <span>Status: {formatStatus(exercise.status)}</span>
                </div>
                <dl className="tracking-session-measures">
                  <div><dt>Completed sets</dt><dd>{sets.length}</dd></div>
                  <div><dt>Total reps</dt><dd>{formatMetric(totalReps(sets))}</dd></div>
                  <div><dt>Top load</dt><dd>{formatMetric(topLoad(sets), " kg")}</dd></div>
                  <div><dt>Load-volume</dt><dd>{formatMetric(loadVolume(sets), " kg-reps")}</dd></div>
                </dl>
              </article>;
            })}
          </div>
        </> : <EmptyState><strong>No exercise history yet</strong><span>Log a session to start tracking sets, reps, and load.</span></EmptyState>}
      </section>
      <section className="history-section">
        <h2>Recent sessions</h2>
        {recent.length ? recent.map((session) => <article className="history-row" key={session.id}><ListChecks size={23} /><div><strong>Prehab foundations</strong><span>{dateFormatter.format(new Date(session.completedAt))}</span></div><div className="history-pain"><span>Pain</span><strong>{session.painBefore} → {session.painAfter}</strong></div></article>) : <EmptyState><strong>No sessions yet</strong><span>Complete your first guided session and it will appear here.</span></EmptyState>}
      </section>
    </div>
  );
}
