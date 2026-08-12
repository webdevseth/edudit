/**
 * =============================================================================
 * EduDit
 * Session Service
 * =============================================================================
 *
 * Coordinates training sessions between:
 *
 *   training engine → application state → persistence → application events
 *
 * Responsibilities:
 *
 * - Create and manage the active TrainingEngine.
 * - Keep temporary training state synchronized with application state.
 * - Persist completed/stopped sessions into the learner profile.
 * - Provide one service-level API for feature modules.
 *
 * This service does NOT implement:
 *
 * - adaptive selection
 * - mastery calculations
 * - curriculum progression
 * - Morse audio
 * - UI rendering
 *
 * Those responsibilities remain in their respective layers.
 * =============================================================================
 */

import events, {
  EVENT_NAMES,
} from "../core/events.js";

import state from "../core/state.js";

import storage from "../core/storage.js";

import TrainingEngine, {
  TRAINING_MODES,
} from "../training/trainingEngine.js";


/* =============================================================================
   Internal State
   ============================================================================= */

let engine = null;

let initialized = false;

let eventCleanups = [];


/* =============================================================================
   Initialization
   ============================================================================= */

/**
 * Initialize the session service.
 *
 * The service itself does not start a training session. It only prepares the
 * coordination layer.
 *
 * @returns {Object}
 */
function initialize() {
  if (initialized) {
    return getStatus();
  }

  initialized = true;

  return getStatus();
}


/* =============================================================================
   Session Creation
   ============================================================================= */

/**
 * Start a new training session for the active learner.
 *
 * @param {Object} options
 * @param {string} [options.mode]
 * @param {number} [options.sessionLength]
 * @param {Object|null} [options.target]
 * @returns {Object}
 */
function startSession({
  mode = TRAINING_MODES.ADAPTIVE,
  sessionLength = null,
  target = null,
} = {}) {
  assertInitialized();

  if (engine) {
    if (
      engine.isRunning() ||
      engine.isPaused()
    ) {
      throw new Error(
        "A training session is already active.",
      );
    }

    destroyEngine();
  }

  const profile = state.getActiveProfile();

  if (!profile) {
    throw new Error(
      "Cannot start training without an active learner profile.",
    );
  }

  const settings = profile.settings ?? {};

  const learningSettings =
    settings.learning ?? {};

  const resolvedSessionLength =
    sessionLength ??
    learningSettings.sessionLength ??
    20;

  engine = new TrainingEngine({
    profileId: profile.id,
    mode,
    sessionLength:
      resolvedSessionLength,
  });

  const session =
    engine.start({
      target,
    });

  state.startTraining({
    sessionId: session.id,
    mode: session.mode,
    target: session.target,
  });

  return session;
}


/* =============================================================================
   Session Controls
   ============================================================================= */

/**
 * Pause the active training session.
 *
 * @returns {Object|null}
 */
function pauseSession() {
  assertEngine();

  const session =
    engine.pause();

  if (session) {
    state.updateTraining({
      active: false,
    });
  }

  return session;
}


/**
 * Resume the paused training session.
 *
 * @returns {Object|null}
 */
function resumeSession() {
  assertEngine();

  const session =
    engine.resume();

  if (session) {
    state.updateTraining({
      active: true,
    });
  }

  return session;
}


/**
 * Stop the current training session.
 *
 * A stopped session is retained as partial session history.
 *
 * @returns {Object|null}
 */
function stopSession() {
  assertEngine();

  const session =
    engine.stop();

  if (session) {
    persistSession(session);
  }

  state.clearTraining();

  destroyEngine();

  return session;
}


/**
 * Complete the current training session.
 *
 * @returns {Object|null}
 */
function completeSession() {
  assertEngine();

  const session =
    engine.complete();

  if (session) {
    persistSession(session);
  }

  state.clearTraining();

  destroyEngine();

  return session;
}


/* =============================================================================
   Attempt Lifecycle
   ============================================================================= */

/**
 * Start a training attempt.
 *
 * @param {Object} options
 * @returns {Object}
 */
function startAttempt({
  expected,
  item = null,
  metadata = null,
} = {}) {
  assertRunning();

  return engine.startAttempt({
    expected,
    item,
    metadata,
  });
}


/**
 * Mark the current attempt as having used a hint.
 *
 * @returns {Object|null}
 */
function markHintUsed() {
  assertRunning();

  return engine.markHintUsed();
}


/**
 * Submit an answer for the current attempt.
 *
 * If the configured session length is reached, TrainingEngine automatically
 * completes the session. In that case the resulting session is persisted here.
 *
 * @param {string} answer
 * @returns {Object}
 */
function submitAnswer(answer) {
  assertRunning();

  const attempt =
    engine.submitAnswer(answer);

  const session =
    engine.getSessionSnapshot();

  /*
   * TrainingEngine automatically changes state to completed when the session
   * reaches its configured length.
   */
  if (
    session &&
    engine.getState() ===
      "completed"
  ) {
    persistSession(session);

    state.clearTraining();

    destroyEngine();
  }

  return attempt;
}


/* =============================================================================
   Queries
   ============================================================================= */

/**
 * Return the active training engine.
 *
 * This is intentionally not exposed directly through the public API.
 *
 * @returns {Object|null}
 */
function getEngine() {
  return engine;
}


/**
 * Return the current session snapshot.
 *
 * @returns {Object|null}
 */
function getCurrentSession() {
  if (!engine) {
    return null;
  }

  return engine.getSessionSnapshot();
}


/**
 * Return the current attempt.
 *
 * @returns {Object|null}
 */
function getCurrentAttempt() {
  if (!engine) {
    return null;
  }

  return engine.getCurrentAttempt();
}


/**
 * Return the current service status.
 *
 * @returns {Object}
 */
function getStatus() {
  return {
    initialized,
    active: Boolean(
      engine &&
      engine.isRunning(),
    ),
    paused: Boolean(
      engine &&
      engine.isPaused(),
    ),
    sessionId:
      engine?.getSessionSnapshot()?.id ??
      null,
    profileId:
      engine?.getProfileId() ??
      state.getActiveProfileId() ??
      null,
    mode:
      engine?.getMode() ??
      null,
  };
}


/**
 * Determine whether training is currently active.
 *
 * @returns {boolean}
 */
function isActive() {
  return Boolean(
    engine &&
    engine.isRunning(),
  );
}


/**
 * Determine whether training is paused.
 *
 * @returns {boolean}
 */
function isPaused() {
  return Boolean(
    engine &&
    engine.isPaused(),
  );
}


/* =============================================================================
   Application Event Binding
   ============================================================================= */

/**
 * Bind application-level session events.
 *
 * This provides a single place for future session-wide coordination without
 * making individual feature modules responsible for persistence internals.
 */
function bindApplicationEvents() {
  assertInitialized();

  if (eventCleanups.length > 0) {
    return;
  }

  /*
   * Training completion can occur automatically inside TrainingEngine after
   * the final submitted attempt.
   *
   * The submitAnswer() path handles that transition directly, but this event
   * listener also provides a safety net for other completion paths.
   */
  eventCleanups.push(
    events.on(
      EVENT_NAMES.TRAINING_COMPLETED,
      (session) => {
        if (!session) {
          return;
        }

        const current =
          state.getActiveProfile();

        if (
          !current ||
          current.id !== session.profileId
        ) {
          return;
        }

        /*
         * Avoid duplicating a session that submitAnswer() or completeSession()
         * has already persisted.
         */
        const existing =
          current.sessions?.some(
            (savedSession) =>
              savedSession.id ===
              session.id,
          );

        if (!existing) {
          persistSession(session);
        }
      },
    ),
  );
}


/* =============================================================================
   Persistence
   ============================================================================= */

/**
 * Persist a finished or stopped session into the active learner profile.
 *
 * The state store remains responsible for modifying profile state.
 * The storage service remains responsible for persistence.
 *
 * @param {Object} session
 * @returns {Object}
 */
function persistSession(session) {
  if (
    !session ||
    typeof session !== "object"
  ) {
    throw new TypeError(
      "Cannot persist an invalid session.",
    );
  }

  const profile =
    state.getActiveProfile();

  if (!profile) {
    throw new Error(
      "Cannot persist a session without an active learner profile.",
    );
  }

  if (
    session.profileId &&
    session.profileId !== profile.id
  ) {
    throw new Error(
      "Session profile does not match the active learner.",
    );
  }

  const savedSession =
    state.addSession({
      ...session,
      profileId: profile.id,
    });

  /*
   * state.addSession() changes profile state but intentionally does not know
   * about the persistence implementation.
   *
   * Therefore the service explicitly queues the updated profile here.
   */
  const updatedProfile =
    state.getProfile(profile.id);

  if (updatedProfile) {
    storage.queueProfileWrite(
      updatedProfile,
    );
  }

  return savedSession;
}


/* =============================================================================
   Cleanup
   ============================================================================= */

/**
 * Destroy the current engine.
 *
 * This does not delete persisted session history.
 */
function destroyEngine() {
  if (!engine) {
    return;
  }

  try {
    engine.destroy();
  } catch (error) {
    console.error(
      "[EduDit] Failed to destroy training engine.",
      error,
    );
  }

  engine = null;
}


/**
 * Destroy the session service.
 *
 * Primarily used during application shutdown and tests.
 */
function destroy() {
  eventCleanups.forEach(
    (unsubscribe) => {
      try {
        unsubscribe();
      } catch (error) {
        console.error(
          "[EduDit] Failed to remove session listener.",
          error,
        );
      }
    },
  );

  eventCleanups = [];

  destroyEngine();

  initialized = false;
}


/* =============================================================================
   Validation
   ============================================================================= */

function assertInitialized() {
  if (!initialized) {
    throw new Error(
      "SessionService has not been initialized.",
    );
  }
}


function assertEngine() {
  assertInitialized();

  if (!engine) {
    throw new Error(
      "No active training session.",
    );
  }
}


function assertRunning() {
  assertEngine();

  if (!engine.isRunning()) {
    throw new Error(
      "Training is not currently running.",
    );
  }
}


/* =============================================================================
   Public API
   ============================================================================= */

const sessionService = Object.freeze({
  initialize,
  bindApplicationEvents,

  startSession,
  pauseSession,
  resumeSession,
  stopSession,
  completeSession,

  startAttempt,
  markHintUsed,
  submitAnswer,

  getCurrentSession,
  getCurrentAttempt,
  getStatus,

  isActive,
  isPaused,

  destroy,
});


export {
  initialize,
  bindApplicationEvents,

  startSession,
  pauseSession,
  resumeSession,
  stopSession,
  completeSession,

  startAttempt,
  markHintUsed,
  submitAnswer,

  getCurrentSession,
  getCurrentAttempt,
  getStatus,

  isActive,
  isPaused,

  destroy,
};


export default sessionService;