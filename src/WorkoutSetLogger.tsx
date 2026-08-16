import { useId } from "react";
import { CheckCircle } from "@phosphor-icons/react";
import type { ExerciseDose, SessionSetLog } from "./types";
import { AppCheckbox, AppCompactNumberField } from "./FormControls";

export interface WorkoutSetLoggerProps {
  exerciseName: string;
  prescribedDose: ExerciseDose;
  sets: readonly SessionSetLog[];
  previousSets: readonly SessionSetLog[] | null;
  onChange: (sets: SessionSetLog[]) => void;
}

function doseDescription(dose: ExerciseDose) {
  const parts: string[] = [];
  if (dose.sets !== null) parts.push(`${dose.sets} sets`);
  if (dose.reps !== null) parts.push(`${dose.reps} reps`);
  if (dose.loadKg !== null) parts.push(`${dose.loadKg} kg`);
  if (dose.holdSeconds !== null) parts.push(`${dose.holdSeconds} second hold`);
  if (dose.durationMinutes !== null) parts.push(`${dose.durationMinutes} minutes`);
  if (dose.rangeNote.trim()) parts.push(dose.rangeNote.trim());
  return parts.length ? parts.join(", ") : "No numeric target recorded";
}

function previousDescription(set: SessionSetLog | undefined) {
  if (!set) return "No history";
  const load = set.loadKg === null ? "No kg" : `${set.loadKg} kg`;
  const reps = set.reps === null ? "No reps" : `${set.reps} reps`;
  return `${load} / ${reps}${set.completed ? "" : " / not done"}`;
}

function isValidSet(set: SessionSetLog, repsRequired: boolean) {
  const loadIsValid = set.loadKg === null
    || (Number.isFinite(set.loadKg) && set.loadKg >= 0 && set.loadKg <= 1000);
  const repsAreValid = set.reps === null
    ? !repsRequired
    : Number.isInteger(set.reps) && set.reps >= 1 && set.reps <= 500;
  return loadIsValid && repsAreValid;
}

export function WorkoutSetLogger({
  exerciseName,
  prescribedDose,
  sets,
  previousSets,
  onChange,
}: WorkoutSetLoggerProps) {
  const descriptionId = useId();
  const repsRequired = prescribedDose.reps !== null;
  const completedSets = sets.filter((set) => set.completed).length;
  const completedRows = sets.filter((set) => set.completed);
  const nextSetIndex = sets.findIndex((set) => !set.completed);
  const recordedLoadVolume = completedRows.length && completedRows.every((set) => set.reps !== null && set.loadKg !== null)
    ? completedRows.reduce((total, set) => total + ((set.reps ?? 0) * (set.loadKg ?? 0)), 0)
    : null;

  const updateSet = (index: number, change: Partial<SessionSetLog>) => {
    const nextSets = sets.map((set, setIndex) => {
      if (setIndex !== index) return { ...set };
      const nextSet = { ...set, ...change };
      if (set.completed && !isValidSet(nextSet, repsRequired)) {
        nextSet.completed = false;
      }
      return nextSet;
    });
    onChange(nextSets);
  };

  return (
    <fieldset className="set-logger" aria-describedby={descriptionId}>
      <legend className="set-logger__legend">Log performed sets for {exerciseName}</legend>
      <div id={descriptionId} className="set-logger__intro">
        <p><strong>Target:</strong> {doseDescription(prescribedDose)}</p>
        {previousSets?.[0] && <p><strong>Last time:</strong> {previousDescription(previousSets[0])}</p>}
      </div>

      {nextSetIndex >= 0 && <button
        className="primary-button set-logger__quick-log"
        disabled={!isValidSet(sets[nextSetIndex]!, repsRequired)}
        onClick={(event) => { event.preventDefault(); updateSet(nextSetIndex, { completed: true }); }}
      ><CheckCircle size={19} weight="fill" /> Log set {nextSetIndex + 1}</button>}

      <div className="set-logger__table-wrap">
        <table className="set-logger__table">
          <caption className="set-logger__caption">Performed set details</caption>
          <thead>
            <tr>
              <th scope="col">Set</th>
              <th scope="col">kg</th>
              <th scope="col">Reps</th>
              <th scope="col">Done</th>
            </tr>
          </thead>
          <tbody>
            {sets.map((set, index) => {
              const setNumber = index + 1;
              const completionDisabled = !isValidSet(set, repsRequired);
              return (
                <tr key={setNumber} className="set-logger__row">
                  <th scope="row" className="set-logger__set-number">{setNumber}</th>
                  <td className="set-logger__input-cell">
                    <AppCompactNumberField
                      className="set-logger__input set-logger__input--load"
                      minValue={0}
                      maxValue={1000}
                      step={0.5}
                      inputMode="decimal"
                      ariaLabel={`Set ${setNumber} performed load in kilograms`}
                      value={set.loadKg}
                      onChange={(value) => {
                        if (value === null || (value >= 0 && value <= 1000)) updateSet(index, { loadKg: value });
                      }}
                    />
                  </td>
                  <td className="set-logger__input-cell">
                    <AppCompactNumberField
                      className="set-logger__input set-logger__input--reps"
                      minValue={1}
                      maxValue={500}
                      step={1}
                      inputMode="numeric"
                      ariaLabel={`Set ${setNumber} performed repetitions`}
                      value={set.reps}
                      onChange={(value) => {
                        if (value === null || (Number.isInteger(value) && value >= 1 && value <= 500)) updateSet(index, { reps: value });
                      }}
                    />
                  </td>
                  <td className="set-logger__done-cell">
                    <AppCheckbox
                      className="set-logger__done-target"
                      ariaLabel={`Mark set ${setNumber} done`}
                      checked={set.completed}
                      disabled={completionDisabled}
                      onChange={(completed) => updateSet(index, { completed })}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="set-logger__summary" aria-live="polite">
        {completedSets} of {sets.length} sets logged{recordedLoadVolume === null ? "" : ` · ${recordedLoadVolume} kg-reps`}.
      </p>
    </fieldset>
  );
}

export default WorkoutSetLogger;
