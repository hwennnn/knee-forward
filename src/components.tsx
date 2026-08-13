import { useEffect, useId, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  ArrowLeft,
  ArrowSquareOut,
  CaretRight,
  Check,
  CheckCircle,
  Clock,
  FilmStrip,
  Info,
  Warning,
  X,
} from "@phosphor-icons/react";
import type { ExerciseMediaProvenance, ExerciseMotionMedia, ExerciseRecord, ExerciseStillMedia } from "./types";
import { motionMediaForExerciseContext } from "./exerciseMedia";
import type { ExerciseMediaContext } from "./exerciseMedia";

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(() =>
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  return reduced;
}

function MotionExerciseVisual({ media, autoplay, loop }: {
  media: ExerciseMotionMedia;
  autoplay: boolean;
  loop: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [motionFailed, setMotionFailed] = useState(false);

  useEffect(() => {
    setMotionFailed(false);
  }, [media.sources]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (!autoplay) {
      video.pause();
      return;
    }
    void video.play().catch(() => undefined);
  }, [autoplay]);

  useEffect(() => {
    const pauseWhenHidden = () => {
      if (document.hidden) videoRef.current?.pause();
    };
    document.addEventListener("visibilitychange", pauseWhenHidden);
    return () => document.removeEventListener("visibilitychange", pauseWhenHidden);
  }, []);

  const nativeWidth = media.width;
  const nativeHeight = media.height;
  const mediaStyle = {
    "--media-native-width": nativeWidth ? `${nativeWidth}px` : "100%",
    "--media-native-height": nativeHeight ? `${nativeHeight}px` : "100%",
  } as CSSProperties;
  const reportMotionFailure = () => {
    setMotionFailed(true);
  };
  const motionState = motionFailed ? "failed" : autoplay ? "playing" : "paused";
  const provider = media.creator === "Gym visual" ? "gymvisual" : "other";

  return (
    <div
      className="exercise-visual exercise-visual--motion"
      role="img"
      aria-label={media.alt}
      data-media-kind="motion"
      data-media-provider={provider}
      data-media-label={media.visualScope === "generic_pattern" ? "General reference" : "Exact variation"}
      data-motion-state={motionState}
      data-native-width={nativeWidth}
      data-native-height={nativeHeight}
      data-upscale-policy={nativeWidth && nativeHeight ? "native-size-cap" : "contain"}
      style={mediaStyle}
    >
      {!motionFailed && (
        <video
          ref={videoRef}
          className="exercise-visual__media"
          muted
          autoPlay={autoplay}
          loop={loop}
          playsInline
          preload="none"
          poster={media.posterSrc}
          crossOrigin="anonymous"
          width={nativeWidth}
          height={nativeHeight}
          aria-hidden="true"
          onError={reportMotionFailure}
        >
          {media.sources.map((source) => <source key={`${source.mimeType}:${source.src}`} src={source.src} type={source.mimeType} />)}
        </video>
      )}
      {motionFailed && <div className="exercise-visual__error" role="status">Motion could not be loaded. Use the still image and written cues.</div>}
    </div>
  );
}

export function ExerciseVisual({
  media,
  compact = false,
}: {
  media: ExerciseStillMedia;
  compact?: boolean;
}) {
  const nativeWidth = media.kind === "image" ? media.width : 512;
  const nativeHeight = media.kind === "image" ? media.height : 512;
  return (
    <div
      className={`exercise-visual${compact ? " exercise-visual--compact" : ""}`}
      role="img"
      aria-label={media.alt}
      data-media-label={media.visualScope === "generic_pattern" ? "General reference" : "Exact variation"}
      data-media-kind={media.kind === "image" ? "still-image" : "illustration"}
      data-native-width={nativeWidth}
      data-native-height={nativeHeight}
      data-upscale-policy={nativeWidth && nativeHeight ? "native-size-cap" : "contain"}
    >
      <img className={media.kind === "image" ? "exercise-visual__media" : "exercise-visual__sprite"} src={media.src} width={nativeWidth} height={nativeHeight} alt="" aria-hidden="true" loading={compact ? "lazy" : "eager"} decoding="async" />
    </div>
  );
}

export function SafetyBanner({ children, tone = "info" }: { children: ReactNode; tone?: "info" | "warning" | "success" }) {
  const Icon = tone === "warning" ? Warning : tone === "success" ? CheckCircle : Info;
  return (
    <div className={`safety-banner safety-banner--${tone}`}>
      <Icon size={20} weight="fill" aria-hidden="true" />
      <div>{children}</div>
    </div>
  );
}

export function Modal({ title, children, onClose, wide = false, dismissible = true }: { title: string; children: ReactNode; onClose: () => void; wide?: boolean; dismissible?: boolean }) {
  const dialogRef = useRef<HTMLElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const closeRef = useRef(onClose);
  const titleId = useId();
  closeRef.current = onClose;

  useEffect(() => {
    previousFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const appRoot = document.getElementById("root");
    const liveRegion = document.getElementById("app-live-region");
    const priorAriaHidden = appRoot?.getAttribute("aria-hidden");
    const priorOverflow = document.body.style.overflow;
    appRoot?.setAttribute("inert", "");
    appRoot?.setAttribute("aria-hidden", "true");
    liveRegion?.removeAttribute("inert");
    liveRegion?.removeAttribute("aria-hidden");
    document.body.style.overflow = "hidden";

    const focusableSelector = "button:not([disabled]), a[href], input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex='-1'])";
    const focusable = () => Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(focusableSelector) ?? []);
    (focusable()[0] ?? dialogRef.current)?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && dismissible) {
        event.preventDefault();
        closeRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const items = focusable();
      if (!items.length) {
        event.preventDefault();
        dialogRef.current?.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      appRoot?.removeAttribute("inert");
      if (priorAriaHidden === null || priorAriaHidden === undefined) appRoot?.removeAttribute("aria-hidden");
      else appRoot?.setAttribute("aria-hidden", priorAriaHidden);
      document.body.style.overflow = priorOverflow;
      previousFocus.current?.focus();
    };
  }, []);

  return createPortal(
    <div className="modal-layer" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && dismissible && onClose()}>
      <section ref={dialogRef} className={`modal${wide ? " modal--wide" : ""}`} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}>
        <header className="modal__header">
          <h2 id={titleId}>{title}</h2>
          {dismissible && <button className="icon-button" onClick={onClose} aria-label="Close dialog"><X size={22} /></button>}
        </header>
        <div className="modal__body">{children}</div>
      </section>
    </div>,
    document.body,
  );
}

function MediaDisclosure({ exerciseId, media, label }: {
  exerciseId: string;
  media: ExerciseStillMedia | ExerciseMotionMedia;
  label: "Still image" | "Motion demonstration";
}) {
  const provenance = media as Partial<ExerciseMediaProvenance>;
  const attribution = provenance.attributionText ?? "Original reference illustration bundled with Knee Forward.";
  const reviewStatus = provenance.clinicalReviewStatus;
  const headingId = `media-license-${exerciseId}`;
  return (
    <section className="media-disclosure" aria-labelledby={headingId}>
      <div className="media-disclosure__heading">
        <FilmStrip size={20} weight="duotone" aria-hidden="true" />
        <div>
          <h3 id={headingId}>{label} source &amp; rights</h3>
          {reviewStatus && (
            <span className={`media-review-status media-review-status--${reviewStatus}`}>
              {reviewStatus === "reviewed" ? "Visual mapping reviewed" : reviewStatus === "rejected" ? "Visual mapping rejected" : "Visual review pending"}
            </span>
          )}
        </div>
      </div>
      <p className="media-disclosure__attribution">{attribution}</p>
      {(provenance.creator || provenance.licenseId || provenance.permissionText) && (
        <p className="media-disclosure__meta">
          {provenance.creator && <span>Creator: {provenance.creator}</span>}
          {provenance.licenseId && <span>License: {provenance.licenseId}</span>}
          {provenance.permissionText && <span>Permission: {provenance.permissionText}</span>}
        </p>
      )}
      {(provenance.sourcePageUrl || provenance.licenseUrl) && (
        <div className="media-disclosure__links">
          {provenance.sourcePageUrl && <a href={provenance.sourcePageUrl} target="_blank" rel="noreferrer">Source page <ArrowSquareOut size={15} aria-hidden="true" /></a>}
          {provenance.licenseUrl && <a href={provenance.licenseUrl} target="_blank" rel="noreferrer">{provenance.licenseId ? "License terms" : "Media terms"} <ArrowSquareOut size={15} aria-hidden="true" /></a>}
        </div>
      )}
      {provenance.visualScope === "generic_pattern" && (
        <div className="media-scope-warning">
          <Warning size={18} weight="fill" aria-hidden="true" />
          <p>This visual is a general reference, not an exact demonstration of the named exercise. Your prescribed setup, range, load, and support may differ.</p>
        </div>
      )}
      {provenance.visualScope === "exact_variation" && <p className="media-scope-label">Scope: Exact exercise variation.</p>}
    </section>
  );
}

export function ExerciseDetail({ exercise, onBack, demoMedia }: {
  exercise: ExerciseRecord;
  onBack: () => void;
  demoMedia?: ExerciseMotionMedia | null;
}) {
  const reducedMotion = usePrefersReducedMotion();
  const disclosedMedia = demoMedia ?? exercise.media;

  return (
    <section className="detail-view" data-media-source={exercise.media.src} data-motion-available={demoMedia ? "true" : "false"}>
      <button className="text-button" onClick={onBack}><ArrowLeft size={18} /> Back to library</button>
      <div className="detail-grid">
        <div className="detail-media-stage">
          <div className="detail-media-stage__still">
            <ExerciseVisual media={exercise.media} />
          </div>
          {demoMedia && (
            <div className="detail-motion-block">
              <p className="detail-motion-label">Motion reference</p>
              <MotionExerciseVisual media={demoMedia} autoplay={!reducedMotion} loop={!reducedMotion} />
              <p className="motion-reference-note">Movement reference only, not clearance or a prescribed range or load.</p>
              {reducedMotion && <p className="reduced-motion-note">A static poster is shown because reduced motion is enabled.</p>}
            </div>
          )}
        </div>
        <div>
          <p className="kicker">{exercise.category.replaceAll("_", " ")}</p>
          <h1>{exercise.name}</h1>
          <p className="lede">{exercise.description}</p>
          <SafetyBanner>
            Use the range, load, and variation your physiotherapist approved. This visual is an orientation aid.
          </SafetyBanner>
          <h3>Form cues</h3>
          <ul className="cue-list">
            {exercise.cues.map((cue) => <li key={cue}><Check size={17} weight="bold" />{cue}</li>)}
          </ul>
          <h3>Stop signals</h3>
          <ul className="plain-list">
            {exercise.stopSignals.map((signal) => <li key={signal}>{signal}</li>)}
          </ul>
          <MediaDisclosure exerciseId={exercise.id} media={disclosedMedia} label={demoMedia ? "Motion demonstration" : "Still image"} />
        </div>
      </div>
    </section>
  );
}

export function ExerciseDetailForContext({
  exercise,
  context,
  allowPendingLearningMedia = false,
  onBack,
}: {
  exercise: ExerciseRecord;
  context: ExerciseMediaContext;
  allowPendingLearningMedia?: boolean;
  onBack: () => void;
}) {
  const demoMedia = motionMediaForExerciseContext(exercise, context, allowPendingLearningMedia);
  return <ExerciseDetail exercise={exercise} demoMedia={demoMedia} onBack={onBack} />;
}

export function RoutineRow({ exercise, dose, onOpen }: {
  exercise: ExerciseRecord;
  dose: string;
  onOpen: () => void;
}) {
  return (
    <button className="routine-row" onClick={onOpen}>
      <ExerciseVisual media={exercise.media} compact />
      <span className="routine-row__copy">
        <strong>{exercise.name}</strong>
        <span>{dose}</span>
      </span>
      <CaretRight size={19} aria-hidden="true" />
    </button>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <div className="empty-state"><Clock size={28} />{children}</div>;
}
