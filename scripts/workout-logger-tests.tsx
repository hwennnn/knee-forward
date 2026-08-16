import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { WorkoutSetLogger } from "../src/WorkoutSetLogger";

const markup = renderToStaticMarkup(<WorkoutSetLogger
  exerciseName="Knee extension"
  prescribedDose={{ sets: 2, reps: 10, loadKg: 12.5, holdSeconds: null, durationMinutes: null, rangeNote: "" }}
  sets={[
    { reps: 10, loadKg: 12.5, completed: false },
    { reps: 10, loadKg: 12.5, completed: false },
  ]}
  previousSets={[{ reps: 9, loadKg: 10, completed: true }]}
  onChange={() => undefined}
/>);

assert.match(markup, /Log set 1/);
assert.match(markup, /Last time:/);
assert.match(markup, /value="12\.5"/);
assert.match(markup, /value="10"/);
assert.doesNotMatch(markup, /Previous history|Load convention|History only/);

console.log("workout logger tests passed");
