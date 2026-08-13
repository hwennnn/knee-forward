import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { ExerciseDetailForContext, ExerciseVisual } from "../src/components";
import type { ExerciseRecord, ExerciseStillImageMedia } from "../src/types";

const still = {
  kind: "image",
  src: "/still.webp",
  alt: "Sharp still exercise reference",
  width: 1200,
  height: 900,
  visualScope: "exact_variation",
} satisfies ExerciseStillImageMedia;

const stillMarkup = renderToStaticMarkup(<ExerciseVisual media={still} />);
assert.match(stillMarkup, /data-media-kind="still-image"/);
assert.match(stillMarkup, /data-media-label="Exact variation"/);
assert.match(stillMarkup, /data-native-width="1200"/);
assert.match(stillMarkup, /data-upscale-policy="native-size-cap"/);
assert.match(stillMarkup, /src="\/still\.webp"/);
assert.doesNotMatch(stillMarkup, /<video/);

const spriteMarkup = renderToStaticMarkup(<ExerciseVisual media={{
  kind: "sprite",
  spriteSheetId: "exercise-reference-strength",
  src: "/assets/exercise-panels/strength-2.png",
  tileIndex: 2,
  panelCount: 8,
  alt: "Exercise illustration",
  visualScope: "generic_pattern",
}} />);
assert.match(spriteMarkup, /data-native-width="512"/);
assert.match(spriteMarkup, /class="exercise-visual__sprite"/);
assert.match(spriteMarkup, /data-media-label="General reference"/);

const exercise = {
  id: "quality-fixture",
  name: "Quality fixture",
  shortName: "Fixture",
  category: "strength",
  equipment: ["none"],
  description: "Fixture description.",
  cues: [],
  stopSignals: [],
  eligiblePhaseIds: ["prehab"],
  sourceIds: [],
  media: still,
  demoMedia: {
    kind: "motion",
    sources: [
      { src: "/motion.webm", mimeType: "video/webm" },
      { src: "/motion.mp4", mimeType: "video/mp4" },
    ],
    posterSrc: "/motion-poster.png",
    alt: "Motion demonstration",
    sourcePageUrl: "https://example.test/source",
    creator: "Fixture creator",
    attributionText: "Fixture motion attribution",
    visualScope: "generic_pattern",
    clinicalReviewStatus: "reviewed",
    width: 720,
    height: 720,
  },
} satisfies ExerciseRecord;

const initialDetailMarkup = renderToStaticMarkup(<ExerciseDetailForContext exercise={exercise} context="learn" onBack={() => undefined} />);
assert.match(initialDetailMarkup, /data-motion-available="true"/);
assert.ok(initialDetailMarkup.includes("Motion reference"));
assert.doesNotMatch(initialDetailMarkup, /Play motion|Show still|Pause motion/);
assert.doesNotMatch(initialDetailMarkup, /aria-pressed/);
assert.match(initialDetailMarkup, /<video/);
assert.match(initialDetailMarkup, /autoPlay=""/);
assert.match(initialDetailMarkup, /src="\/motion\.(?:webm|mp4)"/);
assert.match(initialDetailMarkup, /poster="\/motion-poster\.png"/);
assert.doesNotMatch(initialDetailMarkup, /image\/gif/);

console.log("Still quality, dual-video contract, and inline motion rendering verified.");
