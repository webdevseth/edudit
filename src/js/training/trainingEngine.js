/**
 * =============================================================================
 * EduDit
 * Training Engine
 * =============================================================================
 *
 * Central orchestrator for learner training sessions.
 *
 * The Training Engine owns runtime training behavior.
 *
 * The Session Model remains the canonical representation of the persisted
 * session itself.
 *
 * Responsibilities:
 *
 * - Session lifecycle orchestration
 * - Attempt lifecycle
 * - Training target context
 * - Answer evaluation
 * - Training mode
 * - Runtime session metrics
 * - Training state
 * - Event notifications
 *
 * It does NOT own:
 *
 * - Curriculum definitions
 * - Learner persistence
 * - Mastery formulas
 * - Adaptive selection algorithms
 * - Audio implementation
 * - UI rendering
 *
 * Those responsibilities belong to their respective modules.
 * =============================================================================
 */

import events, {
  EVENT_NAMES,
} from "../core/events.js";

import {
  createSession as createSessionModel,
  startSession as startSessionModel,
  pauseSession as pauseSessionModel,
  resumeSession as resumeSessionModel,
  completeSession as completeSessionModel,
  abandonSession as abandonSessionModel,
  addAttempt as addSessionAttempt,
} from "../models/session.js";


/* =============================================================================
   Constants
   ============================================================================= */

const TRAINING_MODES = Object.freeze({
  ADAPTIVE: "adaptive",
  SEQUENTIAL: "sequential",
  REVIEW_ONLY: "review-only",
});


const TRAINING_STATES = Object.freeze({
  IDLE: "idle",
  RUNNING: "running",
  PAUSED: "paused",
  COMPLETED: "completed",
  STOPPED: "stopped",
  DESTROYED: "destroyed",
});


const DEFAULT_TRAINING_OPTIONS =
  Object.freeze({
    mode: TRAINING_MODES.ADAPTIVE,
    sessionLength: 20,
  });


/* =============================================================================
   Utilities
   ============================================================================= */

function createId(prefix) {
  const timestamp =
    Date.now().toString(36);

  const random =
    Math.random()
      .toString(36)
      .slice(2, 10);

  return `${prefix}-${timestamp}-${random}`;
}


function now() {
  return Date.now();
}


function normalizeAnswer(answer) {
  if (
    typeof answer !== "string"
  ) {
    return "";
  }

  return answer
    .trim()
    .toUpperCase();
}


function isValidTrainingMode(mode) {
  return Object.values(
    TRAINING_MODES,
  ).includes(mode);
}


/* =============================================================================
   Training Engine
   ============================================================================= */

class TrainingEngine {
  #profileId = null;

  /*
   * The canonical Session Model.
   *
   * This object contains the persisted session representation:
   *
   * - id
   * - profileId
   * - direction
   * - status
   * - targetAttempts
   * - timestamps
   * - attemptIds
   * - material
   */
  #session = null;

  /*
   * Runtime-only information belongs to the engine rather than the Session
   * Model.
   */
  #sessionContext = {
    mode: DEFAULT_TRAINING_OPTIONS.mode,
    target: null,
    attempts: [],
    correct: 0,
    total: 0,
    accuracy: 0,
    totalResponseTimeMs: 0,
    averageResponseTimeMs: 0,
  };

  #state = TRAINING_STATES.IDLE;

  #options = {
    ...DEFAULT_TRAINING_OPTIONS,
  };

  #currentAttempt = null;

  #destroyed = false;

  #onBeforeUnload = null;


  /* ===========================================================================
     Initialization
     =========================================================================== */

  constructor({
    profileId,
    mode = DEFAULT_TRAINING_OPTIONS.mode,
    sessionLength =
      DEFAULT_TRAINING_OPTIONS.sessionLength,
  } = {}) {
    if (
      typeof profileId !== "string" ||
      profileId.length === 0
    ) {
      throw new TypeError(
        "TrainingEngine requires a valid profileId.",
      );
    }

    if (!isValidTrainingMode(mode)) {
      throw new Error(
        `Unsupported training mode "${mode}".`,
      );
    }

    if (
      !Number.isInteger(
        sessionLength,
      ) ||
      sessionLength <= 0
    ) {
      throw new TypeError(
        "Training sessionLength must be a positive integer.",
      );
    }

    this.#profileId =
      profileId;

    this.#options = {
      mode,
      sessionLength,
    };

    this.#installLifecycleHandlers();
  }


  /* ===========================================================================
     State
     =========================================================================== */

  getState() {
    return this.#state;
  }


  isRunning() {
    return (
      this.#state ===
      TRAINING_STATES.RUNNING
    );
  }


  isPaused() {
    return (
      this.#state ===
      TRAINING_STATES.PAUSED
    );
  }


  isDestroyed() {
    return this.#destroyed;
  }


  getProfileId() {
    return this.#profileId;
  }


  getMode() {
    return this.#options.mode;
  }


  /**
   * Return a defensive public snapshot.
   *
   * The Session Model fields are exposed directly because sessionService and
   * state management consume the snapshot as a session object.
   *
   * Runtime-only engine metrics are deliberately added as a separate layer.
   *
   * @returns {Object|null}
   */
  getSessionSnapshot() {
    if (!this.#session) {
      return null;
    }

    return {
      ...this.#session,

      mode:
        this.#sessionContext.mode,

      target:
        this.#sessionContext.target
          ? {
              ...this.#sessionContext.target,
            }
          : null,

      attempts:
        this.#sessionContext.attempts.map(
          (attempt) => ({
            ...attempt,
          }),
        ),

      correct:
        this.#sessionContext.correct,

      total:
        this.#sessionContext.total,

      accuracy:
        this.#sessionContext.accuracy,

      totalResponseTimeMs:
        this.#sessionContext
          .totalResponseTimeMs,

      averageResponseTimeMs:
        this.#sessionContext
          .averageResponseTimeMs,
    };
  }


  getCurrentAttempt() {
    if (!this.#currentAttempt) {
      return null;
    }

    return {
      ...this.#currentAttempt,
    };
  }


  /* ===========================================================================
     Session Lifecycle
     =========================================================================== */

  start({
    target = null,
  } = {}) {
    this.#assertUsable();

    if (
      this.#state ===
      TRAINING_STATES.RUNNING
    ) {
      throw new Error(
        "A training session is already running.",
      );
    }

    if (
      this.#state ===
      TRAINING_STATES.PAUSED
    ) {
      throw new Error(
        "A paused session must be resumed or stopped before starting a new session.",
      );
    }

    const startedAt =
      now();

    const direction =
      target?.direction === "send"
        ? "send"
        : "receive";

    this.#session =
      createSessionModel({
        id:
          createId("session"),

        profileId:
          this.#profileId,

        direction,

        targetAttempts:
          this.#options.sessionLength,

        startedAt,

        material:
          target
            ? [target]
            : [],
      });

    this.#session =
      startSessionModel(
        this.#session,
        startedAt,
      );

    this.#sessionContext = {
      mode:
        this.#options.mode,

      target:
        target
          ? {
              ...target,
            }
          : null,

      attempts: [],

      correct: 0,

      total: 0,

      accuracy: 0,

      totalResponseTimeMs: 0,

      averageResponseTimeMs: 0,
    };

    this.#currentAttempt =
      null;

    this.#state =
      TRAINING_STATES.RUNNING;

    events.emit(
      EVENT_NAMES.TRAINING_STARTED,
      this.getSessionSnapshot(),
    );

    return this.getSessionSnapshot();
  }


  pause() {
    this.#assertUsable();

    if (
      this.#state !==
      TRAINING_STATES.RUNNING
    ) {
      return this.getSessionSnapshot();
    }

    /*
     * An active attempt cannot remain open across a pause.
     */
    this.#currentAttempt =
      null;

    this.#session =
      pauseSessionModel(
        this.#session,
        now(),
      );

    this.#state =
      TRAINING_STATES.PAUSED;

    events.emit(
      EVENT_NAMES.TRAINING_PAUSED,
      this.getSessionSnapshot(),
    );

    return this.getSessionSnapshot();
  }


  resume() {
    this.#assertUsable();

    if (
      this.#state !==
      TRAINING_STATES.PAUSED
    ) {
      return this.getSessionSnapshot();
    }

    this.#session =
      resumeSessionModel(
        this.#session,
      );

    this.#state =
      TRAINING_STATES.RUNNING;

    events.emit(
      EVENT_NAMES.TRAINING_RESUMED,
      this.getSessionSnapshot(),
    );

    return this.getSessionSnapshot();
  }


  stop() {
    this.#assertUsable();

    if (
      !this.#session ||
      this.#state ===
        TRAINING_STATES.IDLE ||
      this.#state ===
        TRAINING_STATES.STOPPED ||
      this.#state ===
        TRAINING_STATES.COMPLETED
    ) {
      return this.getSessionSnapshot();
    }

    this.#currentAttempt =
      null;

    this.#session =
      abandonSessionModel(
        this.#session,
      );

    this.#state =
      TRAINING_STATES.STOPPED;

    events.emit(
      EVENT_NAMES.TRAINING_STOPPED,
      this.getSessionSnapshot(),
    );

    return this.getSessionSnapshot();
  }


  complete() {
    this.#assertUsable();

    if (!this.#session) {
      return null;
    }

    if (
      this.#state ===
      TRAINING_STATES.COMPLETED
    ) {
      return this.getSessionSnapshot();
    }

    if (
      this.#state ===
      TRAINING_STATES.STOPPED
    ) {
      return this.getSessionSnapshot();
    }

    this.#currentAttempt =
      null;

    this.#session =
      completeSessionModel(
        this.#session,
        now(),
      );

    this.#recalculateSessionMetrics();

    this.#state =
      TRAINING_STATES.COMPLETED;

    events.emit(
      EVENT_NAMES.TRAINING_COMPLETED,
      this.getSessionSnapshot(),
    );

    return this.getSessionSnapshot();
  }


  /* ===========================================================================
     Attempt Lifecycle
     =========================================================================== */

  startAttempt({
    expected,
    item = null,
    metadata = null,
  } = {}) {
    this.#assertRunning();

    if (
      this.#currentAttempt
    ) {
      throw new Error(
        "An attempt is already active.",
      );
    }

    const normalizedExpected =
      normalizeAnswer(expected);

    if (
      normalizedExpected.length ===
      0
    ) {
      throw new TypeError(
        "An attempt requires a valid expected answer.",
      );
    }

    const attempt = {
      id:
        createId("attempt"),

      sessionId:
        this.#session.id,

      profileId:
        this.#profileId,

      expected:
        normalizedExpected,

      answer:
        null,

      correct:
        false,

      responseTimeMs:
        null,

      hintUsed:
        false,

      startedAt:
        now(),

      completedAt:
        null,

      item:
        item
          ? {
              ...item,
            }
          : null,

      metadata:
        metadata
          ? {
              ...metadata,
            }
          : null,
    };

    this.#currentAttempt =
      attempt;

    events.emit(
      EVENT_NAMES.ATTEMPT_STARTED,
      {
        ...attempt,
      },
    );

    return {
      ...attempt,
    };
  }


  markHintUsed() {
    this.#assertRunning();

    if (
      !this.#currentAttempt
    ) {
      return null;
    }

    this.#currentAttempt.hintUsed =
      true;

    return {
      ...this.#currentAttempt,
    };
  }


  submitAnswer(answer) {
    this.#assertRunning();

    if (
      !this.#currentAttempt
    ) {
      throw new Error(
        "There is no active training attempt.",
      );
    }

    const completedAt =
      now();

    const normalizedAnswer =
      normalizeAnswer(answer);

    const responseTimeMs =
      Math.max(
        0,
        completedAt -
          this.#currentAttempt
            .startedAt,
      );

    const correct =
      normalizedAnswer ===
      this.#currentAttempt.expected;

    const completedAttempt = {
      ...this.#currentAttempt,

      answer:
        normalizedAnswer,

      correct,

      responseTimeMs,

      completedAt,
    };

    /*
     * Runtime attempt history belongs to the engine.
     */
    this.#sessionContext.attempts.push(
      completedAttempt,
    );

    /*
     * The Session Model stores only the relationship to the attempt.
     */
    this.#session =
      addSessionAttempt(
        this.#session,
        completedAttempt.id,
      );

    this.#sessionContext.total += 1;

    if (correct) {
      this.#sessionContext.correct += 1;
    }

    this.#sessionContext
      .totalResponseTimeMs +=
      responseTimeMs;

    this.#recalculateSessionMetrics();

    this.#currentAttempt =
      null;

    events.emit(
      EVENT_NAMES.ATTEMPT_COMPLETED,
      {
        ...completedAttempt,
      },
    );

    this.#checkAutomaticCompletion();

    return {
      ...completedAttempt,
    };
  }


  /* ===========================================================================
     Session Metrics
     =========================================================================== */

  #recalculateSessionMetrics() {
    const total =
      this.#sessionContext.total;

    const correct =
      this.#sessionContext.correct;

    this.#sessionContext.accuracy =
      total > 0
        ? correct / total
        : 0;

    this.#sessionContext
      .averageResponseTimeMs =
      total > 0
        ? this.#sessionContext
            .totalResponseTimeMs /
          total
        : 0;
  }


  #checkAutomaticCompletion() {
    if (
      !this.#session ||
      this.#state !==
        TRAINING_STATES.RUNNING
    ) {
      return;
    }

    if (
      this.#sessionContext.total >=
      this.#options.sessionLength
    ) {
      this.complete();
    }
  }


  /* ===========================================================================
     Configuration
     =========================================================================== */

  getOptions() {
    return {
      ...this.#options,
    };
  }


  setOptions({
    mode = this.#options.mode,
    sessionLength =
      this.#options.sessionLength,
  } = {}) {
    this.#assertUsable();

    if (
      this.#session &&
      (
        this.#state ===
          TRAINING_STATES.RUNNING ||
        this.#state ===
          TRAINING_STATES.PAUSED
      )
    ) {
      throw new Error(
        "Training options cannot be changed during an active session.",
      );
    }

    if (!isValidTrainingMode(mode)) {
      throw new Error(
        `Unsupported training mode "${mode}".`,
      );
    }

    if (
      !Number.isInteger(
        sessionLength,
      ) ||
      sessionLength <= 0
    ) {
      throw new TypeError(
        "Training sessionLength must be a positive integer.",
      );
    }

    this.#options = {
      mode,
      sessionLength,
    };
  }


  /* ===========================================================================
     Lifecycle Cleanup
     =========================================================================== */

  #installLifecycleHandlers() {
    if (
      typeof window ===
      "undefined"
    ) {
      return;
    }

    this.#onBeforeUnload =
      () => {
        if (
          this.#state ===
            TRAINING_STATES.RUNNING ||
          this.#state ===
            TRAINING_STATES.PAUSED
        ) {
          this.stop();
        }
      };

    window.addEventListener(
      "beforeunload",
      this.#onBeforeUnload,
    );
  }


  destroy() {
    if (this.#destroyed) {
      return null;
    }

    if (
      this.#state ===
        TRAINING_STATES.RUNNING ||
      this.#state ===
        TRAINING_STATES.PAUSED
    ) {
      this.stop();
    }

    if (
      this.#onBeforeUnload &&
      typeof window !==
        "undefined"
    ) {
      window.removeEventListener(
        "beforeunload",
        this.#onBeforeUnload,
      );
    }

    this.#onBeforeUnload =
      null;

    this.#currentAttempt =
      null;

    this.#session =
      null;

    this.#sessionContext = {
      mode:
        DEFAULT_TRAINING_OPTIONS.mode,

      target:
        null,

      attempts: [],

      correct: 0,

      total: 0,

      accuracy: 0,

      totalResponseTimeMs: 0,

      averageResponseTimeMs: 0,
    };

    this.#state =
      TRAINING_STATES.DESTROYED;

    this.#destroyed =
      true;
  }


  /* ===========================================================================
     Assertions
     =========================================================================== */

  #assertUsable() {
    if (this.#destroyed) {
      throw new Error(
        "TrainingEngine has been destroyed.",
      );
    }
  }


  #assertRunning() {
    this.#assertUsable();

    if (
      this.#state !==
      TRAINING_STATES.RUNNING
    ) {
      throw new Error(
        "TrainingEngine is not currently running.",
      );
    }
  }
}


/* =============================================================================
   Factory
   ============================================================================= */

function createTrainingEngine(
  options,
) {
  return new TrainingEngine(
    options,
  );
}


/* =============================================================================
   Exports
   ============================================================================= */

export {
  TrainingEngine,
  TRAINING_MODES,
  TRAINING_STATES,
  DEFAULT_TRAINING_OPTIONS,
  createTrainingEngine,
  normalizeAnswer,
  isValidTrainingMode,
};

export default TrainingEngine;