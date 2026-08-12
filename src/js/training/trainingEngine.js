/**
 * =============================================================================
 * EduDit
 * Training Engine
 * =============================================================================
 *
 * Central orchestrator for learner training sessions.
 *
 * The training engine coordinates:
 *
 * - Session lifecycle
 * - Attempt lifecycle
 * - Training targets
 * - Answer evaluation
 * - Training mode
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
 *
 * Lifecycle:
 *
 *   create → start → attempt → answer → next attempt
 *                         ↓
 *                     pause/resume
 *                         ↓
 *                       stop
 *                         ↓
 *                     complete
 *
 * Every training instance can be cleanly stopped and destroyed when its view
 * is unmounted. This prevents stale timers, listeners, or sessions from
 * surviving navigation.
 * =============================================================================
 */

import events, {
  EVENT_NAMES,
} from "../core/events.js";

/* =============================================================================
   Constants
   ============================================================================= */

/**
 * Supported training modes.
 *
 * Adaptive is the default and recommended mode.
 */
const TRAINING_MODES = Object.freeze({
  ADAPTIVE: "adaptive",
  SEQUENTIAL: "sequential",
  REVIEW_ONLY: "review-only",
});

/**
 * Supported training states.
 *
 * A training instance may occupy only one state at a time.
 */
const TRAINING_STATES = Object.freeze({
  IDLE: "idle",
  RUNNING: "running",
  PAUSED: "paused",
  COMPLETED: "completed",
  STOPPED: "stopped",
  DESTROYED: "destroyed",
});

/**
 * Default training configuration.
 */
const DEFAULT_TRAINING_OPTIONS =
  Object.freeze({
    mode: TRAINING_MODES.ADAPTIVE,
    sessionLength: 20,
  });

/* =============================================================================
   Utilities
   ============================================================================= */

/**
 * Generate a reasonably unique session/attempt identifier.
 *
 * The persistence layer may eventually replace this with a stronger ID
 * strategy. For now, this keeps the training engine independent of storage.
 *
 * @param {string} prefix
 * @returns {string}
 */
function createId(prefix) {
  const timestamp =
    Date.now().toString(36);

  const random =
    Math.random()
      .toString(36)
      .slice(2, 10);

  return `${prefix}-${timestamp}-${random}`;
}

/**
 * Return the current timestamp.
 *
 * Kept behind a function so tests can mock time cleanly.
 *
 * @returns {number}
 */
function now() {
  return Date.now();
}

/**
 * Normalize a learner answer.
 *
 * Receive training is intentionally forgiving about surrounding whitespace
 * and letter case.
 *
 * @param {*} answer
 * @returns {string}
 */
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

/**
 * Determine whether a value is a supported training mode.
 *
 * @param {*} mode
 * @returns {boolean}
 */
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

  #session = null;

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

  /**
   * Create a training engine for a learner profile.
   *
   * @param {Object} options
   * @param {string} options.profileId
   * @param {string} [options.mode]
   * @param {number} [options.sessionLength]
   */
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

  /**
   * Return the current training state.
   *
   * @returns {string}
   */
  getState() {
    return this.#state;
  }

  /**
   * Determine whether the engine is currently active.
   *
   * @returns {boolean}
   */
  isRunning() {
    return (
      this.#state ===
      TRAINING_STATES.RUNNING
    );
  }

  /**
   * Determine whether the engine is paused.
   *
   * @returns {boolean}
   */
  isPaused() {
    return (
      this.#state ===
      TRAINING_STATES.PAUSED
    );
  }

  /**
   * Determine whether the engine has been destroyed.
   *
   * @returns {boolean}
   */
  isDestroyed() {
    return this.#destroyed;
  }

  /**
   * Return the profile associated with this engine.
   *
   * @returns {string}
   */
  getProfileId() {
    return this.#profileId;
  }

  /**
   * Return the current training mode.
   *
   * @returns {string}
   */
  getMode() {
    return this.#options.mode;
  }

  /**
   * Return a defensive snapshot of the current session.
   *
   * @returns {Object|null}
   */
  getSessionSnapshot() {
    if (!this.#session) {
      return null;
    }

    return {
      ...this.#session,
      attempts:
        this.#session.attempts.map(
          (attempt) => ({
            ...attempt,
          }),
        ),
    };
  }

  /**
   * Return the current attempt snapshot.
   *
   * @returns {Object|null}
   */
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

  /**
   * Start a new training session.
   *
   * The actual training target should be supplied by the adaptive/progression
   * layer or the feature that launches the session.
   *
   * @param {Object} target
   * @returns {Object} session snapshot
   */
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

    this.#session = {
      id: createId("session"),

      profileId:
        this.#profileId,

      mode:
        this.#options.mode,

      target:
        target
          ? { ...target }
          : null,

      startedAt: now(),

      endedAt: null,

      attempts: [],

      correct: 0,

      total: 0,

      accuracy: 0,

      totalResponseTimeMs: 0,

      averageResponseTimeMs: 0,
    };

    this.#currentAttempt = null;

    this.#state =
      TRAINING_STATES.RUNNING;

    events.emit(
      EVENT_NAMES.TRAINING_STARTED,
      this.getSessionSnapshot(),
    );

    return this.getSessionSnapshot();
  }

  /**
   * Pause the current training session.
   *
   * @returns {Object|null}
   */
  pause() {
    this.#assertUsable();

    if (
      this.#state !==
      TRAINING_STATES.RUNNING
    ) {
      return this.getSessionSnapshot();
    }

    /*
     * An active attempt must not remain open while paused.
     *
     * The feature layer can decide whether to abandon or restore that attempt
     * when training resumes.
     */
    this.#currentAttempt = null;

    this.#state =
      TRAINING_STATES.PAUSED;

    events.emit(
      EVENT_NAMES.TRAINING_PAUSED,
      this.getSessionSnapshot(),
    );

    return this.getSessionSnapshot();
  }

  /**
   * Resume a paused training session.
   *
   * @returns {Object|null}
   */
  resume() {
    this.#assertUsable();

    if (
      this.#state !==
      TRAINING_STATES.PAUSED
    ) {
      return this.getSessionSnapshot();
    }

    this.#state =
      TRAINING_STATES.RUNNING;

    events.emit(
      EVENT_NAMES.TRAINING_RESUMED,
      this.getSessionSnapshot(),
    );

    return this.getSessionSnapshot();
  }

  /**
   * Stop the current session without marking it as successfully completed.
   *
   * The session remains available as a partial session for persistence.
   *
   * @returns {Object|null}
   */
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

    this.#currentAttempt = null;

    this.#session.endedAt =
      now();

    this.#state =
      TRAINING_STATES.STOPPED;

    events.emit(
      EVENT_NAMES.TRAINING_STOPPED,
      this.getSessionSnapshot(),
    );

    return this.getSessionSnapshot();
  }

  /**
   * Complete the current session.
   *
   * @returns {Object|null}
   */
  complete() {
    this.#assertUsable();

    if (
      !this.#session
    ) {
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

    this.#currentAttempt = null;

    this.#session.endedAt =
      now();

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

  /**
   * Begin an attempt.
   *
   * The caller supplies the expected answer and optional curriculum metadata.
   *
   * The actual Morse audio engine is responsible for playing the audio.
   * Response timing begins when this method is called.
   *
   * @param {Object} options
   * @param {string} options.expected
   * @param {Object|null} [options.item]
   * @param {Object|null} [options.metadata]
   * @returns {Object}
   */
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
      id: createId("attempt"),

      sessionId:
        this.#session.id,

      profileId:
        this.#profileId,

      expected:
        normalizedExpected,

      answer: null,

      correct: false,

      responseTimeMs: null,

      hintUsed: false,

      startedAt: now(),

      completedAt: null,

      item: item
        ? { ...item }
        : null,

      metadata: metadata
        ? { ...metadata }
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

  /**
   * Record that the current attempt used a hint.
   *
   * @returns {Object|null}
   */
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

  /**
   * Complete the current attempt with the learner's answer.
   *
   * Response time is measured from startAttempt() until this method is called.
   *
   * @param {string} answer
   * @returns {Object}
   */
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

    this.#session.attempts.push(
      completedAttempt,
    );

    this.#session.total += 1;

    if (correct) {
      this.#session.correct += 1;
    }

    this.#session.totalResponseTimeMs +=
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

  /**
   * Recalculate aggregate session metrics.
   *
   * This is intentionally simple. More sophisticated analytics belong in the
   * learner statistics/adaptive layers.
   *
   * @private
   */
  #recalculateSessionMetrics() {
    if (!this.#session) {
      return;
    }

    const total =
      this.#session.total;

    const correct =
      this.#session.correct;

    this.#session.accuracy =
      total > 0
        ? correct / total
        : 0;

    this.#session.averageResponseTimeMs =
      total > 0
        ? this.#session
            .totalResponseTimeMs /
          total
        : 0;
  }

  /**
   * Complete the session automatically once its configured attempt count has
   * been reached.
   *
   * @private
   */
  #checkAutomaticCompletion() {
    if (
      !this.#session ||
      this.#state !==
        TRAINING_STATES.RUNNING
    ) {
      return;
    }

    if (
      this.#session.total >=
      this.#options.sessionLength
    ) {
      this.complete();
    }
  }

  /* ===========================================================================
     Configuration
     =========================================================================== */

  /**
   * Return a defensive copy of the current training options.
   *
   * @returns {Object}
   */
  getOptions() {
    return {
      ...this.#options,
    };
  }

  /**
   * Update configuration.
   *
   * Configuration changes are allowed only when no active session exists.
   *
   * @param {Object} options
   */
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

  /**
   * Install application lifecycle protection.
   *
   * This does not persist data itself. It ensures the training engine cannot
   * accidentally remain active when the browser window is being unloaded.
   *
   * @private
   */
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

  /**
   * Destroy the training engine.
   *
   * This is the final lifecycle stage and is intended to be called when the
   * Receive/Send feature is unmounted.
   *
   * @returns {Object|null}
   */
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

    this.#session = null;

    this.#state =
      TRAINING_STATES.DESTROYED;

    this.#destroyed = true;
  }

  /* ===========================================================================
     Assertions
     =========================================================================== */

  /**
   * Ensure the engine has not been destroyed.
   *
   * @private
   */
  #assertUsable() {
    if (this.#destroyed) {
      throw new Error(
        "TrainingEngine has been destroyed.",
      );
    }
  }

  /**
   * Ensure the engine is currently running.
   *
   * @private
   */
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

/**
 * Create a training engine for a profile.
 *
 * A factory keeps feature modules from needing to know the constructor
 * implementation.
 *
 * @param {Object} options
 * @returns {TrainingEngine}
 */
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