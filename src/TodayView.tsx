import { Alarm, ArrowRight, Info, Play, SlidersHorizontal } from "@phosphor-icons/react";
import { ExerciseVisual, SafetyBanner } from "./components";
import { choiceFamily, weekMovedGymDays, type ResolvedDay } from "./schedule";
import type { DayChoice, ExerciseDose, ExerciseRecord, LocalAppState } from "./types";
import { formatWeightGoal, formatWeightTrend, type WeightTrend } from "./weightLog";

function formatDose(dose: ExerciseDose) {
  const load = dose.loadKg !== null ? ` at ${dose.loadKg} kg` : "";
  if (dose.durationMinutes !== null) return `${dose.durationMinutes} min${load}`;
  if (dose.sets !== null && dose.reps !== null) return `${dose.sets} × ${dose.reps}${load}`;
  if (dose.sets !== null && dose.holdSeconds !== null) return `${dose.sets} × ${dose.holdSeconds}s holds${load}`;
  return "Dose not recorded";
}

export function TodayView({
  state,
  today,
  week,
  activity,
  trend,
  planReady,
  missingDoseCount,
  incompatiblePlanCount,
  onLocation,
  onStart,
  onDiscardDraft,
  onPlan,
  onExercise,
  onSaveWeight,
  exercises,
  reminderDue,
  onDismissReminder,
  onSafety,
}: {
  state: LocalAppState;
  today: ResolvedDay;
  week: readonly ResolvedDay[];
  activity: { strengthSessions: number; cardioMinutes: number };
  trend: WeightTrend;
  planReady: boolean;
  missingDoseCount: number;
  incompatiblePlanCount: number;
  onLocation: (choice: DayChoice) => void;
  onStart: () => void;
  onDiscardDraft: () => void;
  onPlan: () => void;
  onExercise: (exercise: ExerciseRecord) => void;
  onSaveWeight: (weightKg: number) => void;
  exercises: ReadonlyMap<string, ExerciseRecord>;
  reminderDue: boolean;
  onDismissReminder: () => void;
  onSafety: () => void;
}) {
  const family = choiceFamily(today.kind);
  const weekNote = weekMovedGymDays(week);
  const canTrain = Boolean(state.sessionDraft) || (planReady && today.exerciseIds.length > 0);
  const latestKnee = state.sessions.find((session) => session.episodeId === state.activeEpisodeId);

  return (
    <div className="page-content">
      <header className="page-heading">
        <p>{today.weekdayLabel}</p>
        <h1>{state.profile.displayName ? `Today, ${state.profile.displayName}.` : "Today."}</h1>
      </header>
      <p className="goal-line">{state.profile.goalLabel}</p>
      {reminderDue && <section className="due-banner" role="status">
        <Alarm size={24} weight="fill" />
        <div><strong>Rehab reminder</strong><span>{state.reminderTime}. Check your knee before you start.</span></div>
        <button className="text-button" onClick={onDismissReminder}>Dismiss today</button>
      </section>}
      <section className="today-grid">
        <article className="session-hero">
          <div className="session-hero__top">
            <div>
              <p className="day-badge-row"><span className={`day-badge day-badge--${today.badge.toLowerCase()}`}>{today.badge}</span>{today.gymTemplate ? <span className="day-template">Template {today.gymTemplate}</span> : null}</p>
              <h2>{today.headline}</h2>
              <p>{today.summary}</p>
            </div>
          </div>
          <div className="location-switch" role="group" aria-label="Where you are training today">
            <button type="button" aria-pressed={family === "home"} onClick={() => onLocation("home")}>Training at home today</button>
            <button type="button" aria-pressed={family === "gym"} disabled={today.weekday === 0} onClick={() => onLocation("gym")}>At the gym today</button>
            <button type="button" aria-pressed={family === "rest"} onClick={() => onLocation("rest")}>Rest / knee flared</button>
          </div>
          {today.weekday === 0 && <p className="field-help">Sunday stays off hard knee work so it is not stacked against Monday.</p>}
          {weekNote && <p className="week-move-note">{weekNote}</p>}
          {state.sessionDraft
            ? <SafetyBanner tone="success"><strong>Session in progress.</strong> Resume at exercise {state.sessionDraft.currentExerciseIndex + 1} of {state.sessionDraft.exercises.length}.</SafetyBanner>
            : planReady
              ? <SafetyBanner tone="success"><strong>Plan ready.</strong> The list below is today's session, not the whole saved plan. Check symptoms before you start.</SafetyBanner>
              : <SafetyBanner tone="warning"><strong>{missingDoseCount > 0 || incompatiblePlanCount > 0 ? "Setup needed." : "Confirm once."}</strong> {incompatiblePlanCount > 0
                ? `Review ${incompatiblePlanCount} exercise${incompatiblePlanCount === 1 ? "" : "s"} for your current phase.`
                : missingDoseCount > 0
                  ? `Add doses for ${missingDoseCount} exercise${missingDoseCount === 1 ? "" : "s"}.`
                  : "Starting doses are filled in. Confirm if they match your clinician's plan."} Your clinician's instructions override this guidance.</SafetyBanner>}
          <div className="hero-actions">
            <button className="primary-button primary-button--large" onClick={canTrain ? onStart : onPlan}>
              {canTrain ? <Play size={20} weight="fill" /> : <SlidersHorizontal size={20} />}
              {state.sessionDraft ? "Resume session" : canTrain ? "Start session" : "Review plan"}
            </button>
          </div>
          {state.sessionDraft && <button className="text-button draft-discard-button" onClick={onDiscardDraft}>Discard saved session</button>}
        </article>
        <aside className="status-panel">
          <div className="status-panel__header"><span>This week</span><button className="text-button" onClick={onSafety}>Safety <Info size={16} /></button></div>
          <strong className="runway-number">{activity.strengthSessions}</strong>
          <span className="runway-label">strength session{activity.strengthSessions === 1 ? "" : "s"} logged</span>
          <p className="behavior-line">{activity.cardioMinutes} cardio minute{activity.cardioMinutes === 1 ? "" : "s"} logged</p>
        </aside>
      </section>

      <section className="week-plan" aria-label="This week's training locations">
        {week.map((day) => (
          <div key={day.date} className={day.isToday ? "is-today" : ""}>
            <span className={`day-badge day-badge--${day.badge.toLowerCase()}`}>{day.badge}</span>
            <small>{day.shortLabel}</small>
          </div>
        ))}
      </section>

      {today.blocks.map((block) => (
        <section className="section-block" key={block.id} aria-labelledby={`today-${block.id}`}>
          <div className="section-heading"><div><h2 id={`today-${block.id}`}>{block.title}</h2><p>{block.note}</p></div></div>
          {block.exercises.length ? <div className="exercise-card-grid">
            {block.exercises.map((item) => {
              const exercise = exercises.get(item.exerciseId);
              if (!exercise) return null;
              return (
                <button className="exercise-card" key={item.exerciseId} onClick={() => onExercise(exercise)}>
                  <ExerciseVisual media={exercise.media} />
                  <span>
                    <strong>{exercise.shortName}</strong>
                    <small>{item.group} · {formatDose(item.dose)}</small>
                    <small>{exercise.cues.slice(0, 2).join(" · ")}</small>
                    {item.dose.rangeNote ? <small>{item.dose.rangeNote}</small> : null}
                  </span>
                  <ArrowRight size={18} />
                </button>
              );
            })}
          </div> : null}
        </section>
      ))}

      <section className="section-block" aria-labelledby="today-check-in">
        <div className="section-heading"><div><h2 id="today-check-in">Check-in</h2><p>Morning weight, what you finished, and how the knee responded. No calorie target.</p></div></div>
        <div className="check-in-grid">
          <form className="weight-form" onSubmit={(event) => {
            event.preventDefault();
            const raw = new FormData(event.currentTarget).get("weight")?.toString() ?? "";
            const weightKg = Number(raw);
            if (!Number.isFinite(weightKg) || weightKg < 20 || weightKg > 400) return;
            onSaveWeight(Math.round(weightKg * 10) / 10);
            event.currentTarget.reset();
          }}>
            <label htmlFor="morning-weight">Morning weight (kg)</label>
            <div>
              <input id="morning-weight" name="weight" inputMode="decimal" min={20} max={400} step={0.1} placeholder="Optional" />
              <button className="secondary-button" type="submit">Save weight</button>
            </div>
          </form>
          <p>{formatWeightTrend(trend)}</p>
          <p>{formatWeightGoal(state.weightGoalKg)}</p>
          {latestKnee ? <p>Last knee response: pain {latestKnee.painBefore} → {latestKnee.painAfter}, swelling {latestKnee.swellingBefore} → {latestKnee.swellingAfter}.</p> : <p>No knee response logged yet. The pre-session check still runs before a workout.</p>}
        </div>
      </section>
    </div>
  );
}
