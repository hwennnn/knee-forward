import { defaultPrehabDoses } from "./data";
import type { DayChoice, ExerciseDose, ScheduleOverride } from "./types";

export const DEFAULT_SCHEDULE_TIME_ZONE = "America/Los_Angeles";

export type SessionKind = "gym" | "home" | "cardio" | "rest";
export type GymTemplate = "A" | "B" | "C";
export type ScheduleBlockId = "knee" | "strength" | "cardio";

const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;
const WEEKDAY_INDEX: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
/** Monday=0 … Saturday=5, Sunday=6. Default hard-knee days are Monday, Wednesday, Friday. */
const DEFAULT_GYM = new Set([0, 2, 4]);
const DEFAULT_KIND: readonly SessionKind[] = ["gym", "home", "gym", "home", "gym", "cardio", "rest"];

/** TKE, heel slide, and quad set. Straight-leg raise rotates in on some days and is not stacked on top. */
export const KNEE_BLOCK_CORE_IDS = [
  "band-terminal-knee-extension",
  "heel-slide",
  "quad-set",
] as const;

export const KNEE_BLOCK_IDS = [
  ...KNEE_BLOCK_CORE_IDS,
  "straight-leg-raise",
] as const;

type KneeThirdId = "quad-set" | "straight-leg-raise";

export const LOADED_KNEE_IDS = [
  "single-leg-press",
  "single-leg-hamstring-curl-machine",
  "single-leg-knee-extension-machine",
  "squat",
  "standing-single-leg-heel-raise",
  "standing-hip-abduction-external-rotation-fire-hydrant",
  "modified-single-leg-deadlift",
  "hip-abduction-machine",
  "seated-calf-raise",
  "back-extension",
] as const;

export const UPPER_BODY_IDS = [
  "machine-chest-press",
  "lat-pulldown",
  "seated-row",
  "shoulder-press",
  "biceps-curl",
  "triceps-pressdown",
  "dead-bug",
  "side-plank",
  "pallof-press",
  "band-row",
  "band-chest-press",
  "band-overhead-press",
  "band-biceps-curl",
  "band-triceps-extension",
  "cable-face-pull",
  "reverse-fly",
  "chest-supported-row",
  "cable-chest-fly",
  "straight-arm-pulldown",
  "assisted-pull-up",
  "assisted-dip",
] as const;

const LIGHT_BAND_IDS = ["lateral-band-walk"] as const;

type StrengthGroup = "Lower" | "Upper push" | "Upper pull" | "Arms" | "Core" | "Hip and balance";

/** Six hard moves: two safe lowers, one push, one pull, one arm or rear-delt, one core. Cardio is a separate block. */
const GYM_TEMPLATES: Record<GymTemplate, readonly { exerciseId: string; group: StrengthGroup }[]> = {
  A: [
    { exerciseId: "single-leg-press", group: "Lower" },
    { exerciseId: "single-leg-hamstring-curl-machine", group: "Lower" },
    { exerciseId: "machine-chest-press", group: "Upper push" },
    { exerciseId: "lat-pulldown", group: "Upper pull" },
    { exerciseId: "cable-face-pull", group: "Arms" },
    { exerciseId: "dead-bug", group: "Core" },
  ],
  B: [
    { exerciseId: "squat", group: "Lower" },
    { exerciseId: "single-leg-knee-extension-machine", group: "Lower" },
    { exerciseId: "shoulder-press", group: "Upper push" },
    { exerciseId: "chest-supported-row", group: "Upper pull" },
    { exerciseId: "triceps-pressdown", group: "Arms" },
    { exerciseId: "side-plank", group: "Core" },
  ],
  C: [
    { exerciseId: "modified-single-leg-deadlift", group: "Lower" },
    { exerciseId: "hip-abduction-machine", group: "Lower" },
    { exerciseId: "machine-chest-press", group: "Upper push" },
    { exerciseId: "seated-row", group: "Upper pull" },
    { exerciseId: "biceps-curl", group: "Arms" },
    { exerciseId: "pallof-press", group: "Core" },
  ],
};

/**
 * Six denser band moves. Even home days use the first list; odd home days use the second
 * so band walk/curl/dead bug and clam/triceps/side plank both show up in a normal week.
 */
const HOME_STRENGTH_ROTATION: readonly (readonly { exerciseId: string; group: StrengthGroup }[])[] = [
  [
    { exerciseId: "band-row", group: "Upper pull" },
    { exerciseId: "band-chest-press", group: "Upper push" },
    { exerciseId: "bridge", group: "Hip and balance" },
    { exerciseId: "lateral-band-walk", group: "Hip and balance" },
    { exerciseId: "band-biceps-curl", group: "Arms" },
    { exerciseId: "dead-bug", group: "Core" },
  ],
  [
    { exerciseId: "band-row", group: "Upper pull" },
    { exerciseId: "band-chest-press", group: "Upper push" },
    { exerciseId: "bridge", group: "Hip and balance" },
    { exerciseId: "band-clam", group: "Hip and balance" },
    { exerciseId: "band-triceps-extension", group: "Arms" },
    { exerciseId: "side-plank", group: "Core" },
  ],
];

export interface ScheduledExercise {
  exerciseId: string;
  group: string;
  dose: ExerciseDose;
}

export interface ScheduleBlock {
  id: ScheduleBlockId;
  title: string;
  note: string;
  exercises: readonly ScheduledExercise[];
}

export interface ResolvedDay {
  date: string;
  weekday: number;
  weekdayLabel: string;
  shortLabel: string;
  isToday: boolean;
  defaultKind: SessionKind;
  kind: SessionKind;
  badge: "Gym" | "Home" | "Rest";
  headline: string;
  summary: string;
  gymTemplate: GymTemplate | null;
  blocks: readonly ScheduleBlock[];
  exerciseIds: readonly string[];
}

/** Doses for day resolution. Membership in the saved plan does not hide a template exercise. */
export interface PlanDoseContext {
  doses: Record<string, ExerciseDose>;
}

export function isValidTimeZone(value: string) {
  try {
    Intl.DateTimeFormat("en-US", { timeZone: value }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

export function timeZoneOf(profile: { timeZone?: string | null }) {
  if (profile.timeZone && isValidTimeZone(profile.timeZone)) return profile.timeZone;
  return DEFAULT_SCHEDULE_TIME_ZONE;
}

export function choiceFamily(kind: SessionKind): DayChoice {
  if (kind === "gym") return "gym";
  if (kind === "rest") return "rest";
  return "home";
}

export function zonedParts(date: Date, timeZone: string) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date).map((part) => [part.type, part.value]));
  const weekday = WEEKDAY_INDEX[parts.weekday ?? ""];
  if (weekday === undefined || !parts.year || !parts.month || !parts.day) {
    throw new Error("The schedule time zone could not be read.");
  }
  return { date: `${parts.year}-${parts.month}-${parts.day}`, weekday };
}

export function addIsoDays(isoDate: string, days: number) {
  const [year, month, day] = isoDate.split("-").map(Number);
  const utc = new Date(Date.UTC(year!, (month ?? 1) - 1, (day ?? 1) + days));
  return utc.toISOString().slice(0, 10);
}

export function setScheduleOverride(overrides: readonly ScheduleOverride[], date: string, choice: DayChoice) {
  const next = overrides.filter((override) => override.date !== date);
  next.push({ date: date as ScheduleOverride["date"], choice });
  return next.sort((left, right) => left.date < right.date ? -1 : 1).slice(-180);
}

function isNonAdjacent(indexes: readonly number[]) {
  const sorted = [...indexes].sort((left, right) => left - right);
  for (let index = 1; index < sorted.length; index += 1) {
    if (sorted[index]! - sorted[index - 1]! === 1) return false;
  }
  return true;
}

function combinations(items: readonly number[]) {
  const results: number[][] = [[]];
  for (const item of items) {
    const grown = results.map((set) => [...set, item]);
    results.push(...grown);
  }
  return results;
}

/** Hard knee days stay at least one day apart. Home swaps keep three gym days when that still fits. Rest does not add a makeup day. Sunday is never a hard knee day. */
export function gymIndexesForWeek(pins: ReadonlyMap<number, DayChoice>) {
  const blocked = new Set<number>();
  const required = new Set<number>();
  for (const [index, choice] of pins) {
    if (index === 6) continue;
    if (choice === "rest" || choice === "home") blocked.add(index);
    if (choice === "gym") required.add(index);
  }
  for (const index of required) blocked.delete(index);
  const pool = [0, 1, 2, 3, 4, 5].filter((index) => !blocked.has(index) || required.has(index));
  const restRemovedDefaults = [...DEFAULT_GYM].filter((index) => pins.get(index) === "rest").length;
  const desiredCount = Math.max(3 - restRemovedDefaults, required.size);
  let best: number[] = [];
  let bestScore = -1;
  for (const subset of combinations(pool)) {
    if (subset.length > desiredCount) continue;
    if (![...required].every((index) => subset.includes(index))) continue;
    if (!isNonAdjacent(subset)) continue;
    const overlap = subset.filter((index) => DEFAULT_GYM.has(index)).length;
    const earliness = subset.reduce((sum, index) => sum + index, 0);
    const score = subset.length * 1_000 + overlap * 50 - earliness;
    if (score > bestScore) {
      bestScore = score;
      best = subset;
    }
  }
  return new Set(best);
}

function seededDose(exerciseId: string): ExerciseDose | undefined {
  return (defaultPrehabDoses as Record<string, ExerciseDose>)[exerciseId];
}

function doseMatchesSeed(exerciseId: string, dose: ExerciseDose) {
  const seeded = seededDose(exerciseId);
  if (!seeded) return false;
  return dose.sets === seeded.sets
    && dose.reps === seeded.reps
    && dose.loadKg === seeded.loadKg
    && dose.holdSeconds === seeded.holdSeconds
    && dose.durationMinutes === seeded.durationMinutes
    && dose.rangeNote === seeded.rangeNote;
}

/** Saved dose when it can be performed; otherwise the seeded prehab dose. A zero-filled map entry is treated as missing. */
function doseFor(exerciseId: string, doses: Record<string, ExerciseDose>, mode?: "gym-cardio" | "long-cardio"): ExerciseDose | null {
  const stored = doses[exerciseId];
  const usable = stored && (stored.sets !== null || stored.durationMinutes !== null) ? stored : seededDose(exerciseId);
  if (!usable || (usable.durationMinutes === null && usable.sets === null)) return null;
  if (exerciseId !== "stationary-bike" || !mode || !doseMatchesSeed(exerciseId, usable)) return usable;
  if (mode === "long-cardio") {
    return {
      ...usable,
      durationMinutes: 40,
      rangeNote: "35–45 minutes moderate. Seat high. A flat walk can replace the bike. No running.",
    };
  }
  return {
    ...usable,
    durationMinutes: 30,
    rangeNote: "Moderate. 25–30 minutes. Seat high. Steady pace, not a fluff spin. A flat walk can replace the bike. No running.",
  };
}

function pushExercises(
  target: ScheduledExercise[],
  items: readonly { exerciseId: string; group: string }[],
  doses: Record<string, ExerciseDose>,
  mode?: "gym-cardio" | "long-cardio",
) {
  for (const item of items) {
    const dose = doseFor(item.exerciseId, doses, item.exerciseId === "stationary-bike" ? mode : undefined);
    if (!dose) continue;
    target.push({ exerciseId: item.exerciseId, group: item.group, dose });
  }
}

function kneeBlockItems(thirdId: KneeThirdId) {
  return [
    { exerciseId: "band-terminal-knee-extension", group: "Knee" },
    { exerciseId: "heel-slide", group: "Knee" },
    { exerciseId: thirdId, group: "Knee" },
  ];
}

function blocksFor(
  kind: SessionKind,
  template: GymTemplate | null,
  romOnly: boolean,
  lightBand: boolean,
  doses: Record<string, ExerciseDose>,
  kneeThird: KneeThirdId,
  homeOrdinal: number,
): ScheduleBlock[] {
  const knee: ScheduledExercise[] = [];
  pushExercises(knee, kneeBlockItems(kneeThird), doses);
  const strength: ScheduledExercise[] = [];
  const cardio: ScheduledExercise[] = [];
  if (kind === "gym" && template) {
    pushExercises(strength, GYM_TEMPLATES[template], doses);
    pushExercises(cardio, [{ exerciseId: "stationary-bike", group: "Cardio" }], doses, "gym-cardio");
  } else if (kind === "home") {
    const homeList = HOME_STRENGTH_ROTATION[homeOrdinal % HOME_STRENGTH_ROTATION.length] ?? HOME_STRENGTH_ROTATION[0]!;
    pushExercises(strength, homeList, doses);
  } else if (kind === "cardio") {
    pushExercises(cardio, [{ exerciseId: "stationary-bike", group: "Cardio" }], doses, "long-cardio");
  } else if (lightBand && !romOnly) {
    pushExercises(strength, LIGHT_BAND_IDS.map((exerciseId) => ({ exerciseId, group: "Light band" })), doses);
  }
  const blocks: ScheduleBlock[] = [{
    id: "knee",
    title: "Knee block",
    note: "Short daily range of motion. Stop for a sharp medial pinch. This is general guidance, not a clinician prescription.",
    exercises: knee,
  }];
  if (kind === "rest" && !lightBand) {
    blocks.push({
      id: "strength",
      title: "Strength",
      note: "No loaded work today. Hard knee exercises stay off the list.",
      exercises: [],
    });
    blocks.push({
      id: "cardio",
      title: "Cardio",
      note: "No cardio today.",
      exercises: [],
    });
    return blocks;
  }
  if (kind === "rest" && lightBand) {
    blocks.push({
      id: "strength",
      title: "Strength",
      note: "Light band only. No squat, leg press, or other loaded knee work.",
      exercises: strength,
    });
    blocks.push({
      id: "cardio",
      title: "Cardio",
      note: "Rest day. Skip cardio.",
      exercises: [],
    });
    return blocks;
  }
  if (kind === "home") {
    blocks.push({
      id: "strength",
      title: "Strength",
      note: "Short home session: six denser band moves with a controlled tempo. No leg press, mini squat, or machine knee work. Last sets can be hard, with about 1–2 reps left. The other band exercises stay on the plan.",
      exercises: strength,
    });
    blocks.push({
      id: "cardio",
      title: "Cardio",
      note: "Not scheduled today. A short easy walk is optional if the knee stays quiet. Skip it rather than adding load.",
      exercises: [],
    });
    return blocks;
  }
  blocks.push({
    id: "strength",
    title: "Strength",
    note: kind === "gym"
      ? `Gym ${template ?? ""}. Six hard moves. Last 1–2 reps can be hard, with about 1–2 left. Mini squat stays about 45°. Leg press stays about 45–60°. No deep squat, lunge, run, cut, pivot, or jump. Other machines stay on the plan.`
      : "No strength loading on this cardio day.",
    exercises: strength,
  });
  blocks.push({
    id: "cardio",
    title: "Cardio",
    note: kind === "gym"
      ? "25–30 minutes moderate. A flat walk can replace the bike. No running."
      : "35–45 minutes moderate. A flat walk can replace the bike. No running.",
    exercises: cardio,
  });
  return blocks;
}

function copyFor(kind: SessionKind, template: GymTemplate | null, lightBand: boolean): { badge: ResolvedDay["badge"]; headline: string; summary: string } {
  if (kind === "gym") {
    return {
      badge: "Gym",
      headline: "You're at the gym.",
      summary: `Short gym strength ${template ?? ""}, a three-move knee block, and moderate cardio.`.replace("  ", " "),
    };
  }
  if (kind === "home") {
    return {
      badge: "Home",
      headline: "You're at home.",
      summary: "Six denser band moves, plus a three-move knee block.",
    };
  }
  if (kind === "cardio") {
    return {
      badge: "Home",
      headline: "You're at home.",
      summary: "Moderate cardio day. Knee range of motion, then 35–45 minutes on the bike or a flat walk.",
    };
  }
  return {
    badge: "Rest",
    headline: "You're at home.",
    summary: lightBand
      ? "Rest day. Knee range of motion and a light band only."
      : "Rest day. Knee range of motion only. No loaded knee work and no makeup volume.",
  };
}

export function resolveWeek(anchor: Date, timeZone: string, overrides: readonly ScheduleOverride[], plan: PlanDoseContext): ResolvedDay[] {
  const zone = isValidTimeZone(timeZone) ? timeZone : DEFAULT_SCHEDULE_TIME_ZONE;
  const todayParts = zonedParts(anchor, zone);
  const mondayOffset = todayParts.weekday === 0 ? -6 : 1 - todayParts.weekday;
  const monday = addIsoDays(todayParts.date, mondayOffset);
  const dates = Array.from({ length: 7 }, (_, index) => addIsoDays(monday, index));
  const pins = new Map<number, DayChoice>();
  dates.forEach((date, index) => {
    const choice = overrides.find((override) => override.date === date)?.choice;
    if (choice) pins.set(index, choice);
  });
  const gymSet = gymIndexesForWeek(pins);
  const gymOrder = [...gymSet].sort((left, right) => left - right);
  const letters: GymTemplate[] = ["A", "B", "C"];
  const templateAt = new Map<number, GymTemplate>();
  gymOrder.forEach((index, order) => templateAt.set(index, letters[Math.min(order, 2)]!));
  let homeOrdinal = 0;
  return dates.map((date, index) => {
    const weekday = index === 6 ? 0 : index + 1;
    const defaultKind = DEFAULT_KIND[index] ?? "rest";
    const pin = pins.get(index);
    let kind: SessionKind;
    if (gymSet.has(index)) kind = "gym";
    else if (pin === "rest") kind = "rest";
    else if (pin === "home" && defaultKind === "cardio") kind = "cardio";
    else if (pin === "home" || defaultKind === "gym") kind = "home";
    else kind = defaultKind;
    const template = kind === "gym" ? templateAt.get(index) ?? "A" : null;
    const lightBand = kind === "rest" && pin !== "rest";
    const romOnly = pin === "rest";
    const thisHomeOrdinal = kind === "home" ? homeOrdinal++ : 0;
    const kneeThird: KneeThirdId = !romOnly && ((kind === "rest" && lightBand) || (kind === "home" && thisHomeOrdinal % 2 === 1))
      ? "straight-leg-raise"
      : "quad-set";
    const blocks = blocksFor(kind, template, romOnly, lightBand, plan.doses, kneeThird, thisHomeOrdinal);
    const text = copyFor(kind, template, lightBand);
    const exerciseIds = blocks.flatMap((block) => block.exercises.map((exercise) => exercise.exerciseId));
    return {
      date,
      weekday,
      weekdayLabel: WEEKDAY_NAMES[weekday] ?? "Day",
      shortLabel: (WEEKDAY_NAMES[weekday] ?? "Day").slice(0, 3),
      isToday: date === todayParts.date,
      defaultKind,
      kind,
      badge: text.badge,
      headline: text.headline,
      summary: text.summary,
      gymTemplate: template,
      blocks,
      exerciseIds,
    };
  });
}

export function todayInWeek(days: readonly ResolvedDay[]) {
  return days.find((day) => day.isToday) ?? days[0];
}

export function gymDayLabels(days: readonly ResolvedDay[]) {
  return days.filter((day) => day.kind === "gym").map((day) => day.weekdayLabel);
}

export function weekMovedGymDays(days: readonly ResolvedDay[]) {
  const labels = gymDayLabels(days);
  const defaults = ["Monday", "Wednesday", "Friday"];
  if (labels.length === defaults.length && labels.every((label, index) => label === defaults[index])) return null;
  if (!labels.length) return "No gym day left this week. Hard knee work was not stacked to replace it.";
  const list = labels.length === 1
    ? labels[0]!
    : `${labels.slice(0, -1).join(", ")}, and ${labels[labels.length - 1]}`;
  return `Gym days this week: ${list}.`;
}
