import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { ExerciseCardVisual, ExerciseDetailForContext, ExerciseVisual } from "../src/components";
import { exercises } from "../src/data";
import { cardMotionForExercise, mediaContextForAppSurface, motionMediaForExerciseContext } from "../src/exerciseMedia";
import type { ExerciseMediaContext } from "../src/exerciseMedia";
import type { ExerciseRecord } from "../src/types";

assert.equal(mediaContextForAppSurface("learn"), "learn");
assert.equal(mediaContextForAppSurface("today"), "today");
assert.equal(mediaContextForAppSurface("plan"), "plan");
assert.equal(mediaContextForAppSurface("active_workout"), "workout");
assert.equal(mediaContextForAppSurface("progress"), null);

const exercise = {
  id: "mixed-media-fixture",
  name: "Mixed media fixture",
  shortName: "Fixture",
  category: "strength",
  equipment: ["none"],
  description: "A fixture for the still-first media hierarchy.",
  cues: ["Move with control."],
  stopSignals: ["Stop if symptoms worsen."],
  eligiblePhaseIds: ["prehab"],
  sourceIds: [],
  media: {
    kind: "image",
    src: "/sharp-still.webp",
    alt: "Sharp still exercise reference",
    width: 1200,
    height: 1200,
    visualScope: "exact_variation",
  },
  demoMedia: {
    kind: "motion",
    sources: [
      { src: "/motion.webm", mimeType: "video/webm" },
      { src: "/motion.mp4", mimeType: "video/mp4" },
    ],
    posterSrc: "/motion-poster.png",
    alt: "Optional exercise motion demonstration",
    sourcePageUrl: "https://example.test/source",
    creator: "Fixture creator",
    attributionText: "Fixture motion",
    visualScope: "exact_variation",
    clinicalReviewStatus: "pending",
  },
} satisfies ExerciseRecord;

const cardMarkup = renderToStaticMarkup(<ExerciseVisual media={exercise.media} />);
assert.match(cardMarkup, /src="\/sharp-still\.webp"/);
assert.doesNotMatch(cardMarkup, /motion\.(?:webm|mp4)/);

const renderDetail = (context: ExerciseMediaContext, allowPendingLearningMedia = false) => renderToStaticMarkup(
  <ExerciseDetailForContext exercise={exercise} context={context} allowPendingLearningMedia={allowPendingLearningMedia} onBack={() => undefined} />,
);

const learnDetail = renderDetail("learn", true);
assert.match(learnDetail, /data-media-source="\/sharp-still\.webp"/);
assert.ok(learnDetail.includes("Demo"));
assert.doesNotMatch(learnDetail, /Play motion|Show still|Pause motion/);
assert.match(learnDetail, /<video/);
assert.match(learnDetail, /autoPlay=""/);
assert.match(learnDetail, /motion\.(?:webm|mp4)/);
assert.match(learnDetail, /motion-poster\.png/);

assert.equal(motionMediaForExerciseContext(exercise, "learn", false), null, "pending motion must stay behind the local-preview gate");
assert.equal(motionMediaForExerciseContext(exercise, "learn", true), exercise.demoMedia);

for (const context of ["today", "plan", "workout"] as const) {
  const detail = renderDetail(context, true);
  assert.match(detail, /data-media-source="\/sharp-still\.webp"/);
  assert.equal(detail.includes("Play motion"), false);
  assert.doesNotMatch(detail, /motion\.(?:webm|mp4)/);
  assert.doesNotMatch(detail, /motion-poster\.png/);
}

const deadBug = exercises.find((exercise) => exercise.id === "dead-bug");
const bridge = exercises.find((exercise) => exercise.id === "bridge");
const chestPress = exercises.find((exercise) => exercise.id === "machine-chest-press");
const terminalExtension = exercises.find((exercise) => exercise.id === "band-terminal-knee-extension");
assert.ok(deadBug && bridge && chestPress && terminalExtension);
const deadBugCard = renderToStaticMarkup(<ExerciseCardVisual exercise={deadBug} />);
assert.match(deadBugCard, /data-media-kind="still-image"/);
assert.match(deadBugCard, /\/assets\/exercise-stills\/dead-bug\.webp/);
assert.doesNotMatch(deadBugCard, /coaching-gif|<video|\.gif/);
const bridgeCard = renderToStaticMarkup(<ExerciseCardVisual exercise={bridge} />);
assert.match(bridgeCard, /<video/);
assert.match(bridgeCard, /3013-u0cNiij\.webm/);
assert.match(bridgeCard, /muted=""/);
assert.doesNotMatch(bridgeCard, /\.gif/);
const chestCard = renderToStaticMarkup(<ExerciseCardVisual exercise={chestPress} />);
assert.match(chestCard, /machine-chest-press\.webp/);
assert.doesNotMatch(chestCard, /<video|\.gif/);
const terminalCard = renderToStaticMarkup(<ExerciseCardVisual exercise={terminalExtension} />);
assert.match(terminalCard, /<video/);
assert.match(terminalCard, /3007-Y1MsI1l\.webm/);
assert.doesNotMatch(terminalCard, /coaching-loops|band-terminal-knee-extension\.gif/);
assert.equal(cardMotionForExercise(terminalExtension), terminalExtension.demoMedia);

const both = {
  ...terminalExtension,
  coachingLoop: {
    kind: "coaching-loop" as const,
    gifSrc: "/assets/coaching-loops/band-terminal-knee-extension.gif",
    posterSrc: "/assets/coaching-loops/band-terminal-knee-extension-poster.jpg",
    alt: "Stick figure that must not win",
    width: 480,
    height: 480,
    visualScope: "generic_pattern" as const,
    clinicalReviewStatus: "pending" as const,
    creator: "Knee Forward",
    attributionText: "Deprecated stick loop",
  },
};
assert.equal(cardMotionForExercise(both)?.kind, "motion");
const bothCard = renderToStaticMarkup(<ExerciseCardVisual exercise={both} />);
assert.match(bothCard, /3007-Y1MsI1l\.webm/);
assert.doesNotMatch(bothCard, /coaching-gif|\.gif/);

console.log("Still-first cards and inline Learn motion boundary verified.");
