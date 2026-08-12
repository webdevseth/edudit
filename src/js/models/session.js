/**
 * =============================================================================
 * EduDit
 * Session Model
 * =============================================================================
 *
 * Represents one training session.
 *
 * A session groups attempts and tracks session-level state. It does not decide
 * what the learner should practice; that belongs to the training/adaptive
 * layer.
 * =============================================================================
 */


/* =============================================================================
   Constants
   ============================================================================= */


const SESSION_STATUS = Object.freeze({
  CREATED: "created",
  ACTIVE: "active",
  PAUSED: "paused",
  COMPLETED: "completed",
  ABANDONED: "abandoned",
});


const SESSION_DIRECTION = Object.freeze({
  RECEIVE: "receive",
  SEND: "send",
});


/* =============================================================================
   Factory
   ============================================================================= */


/**
 * Create a new training session.
 *
 * @param {Object} options
 * @returns {Object}
 */
function createSession({
  id = null,
  profileId = null,

  direction = SESSION_DIRECTION.RECEIVE,

  status = SESSION_STATUS.CREATED,

  targetAttempts = 20,

  startedAt = null,
  pausedAt = null,
  completedAt = null,

  attemptIds = [],

  material = [],
} = {}) {
  return {
    id,
    profileId,

    direction:
      normalizeDirection(direction),

    status:
      normalizeStatus(status),

    targetAttempts:
      normalizeTargetAttempts(
        targetAttempts,
      ),

    startedAt:
      normalizeOptionalTimestamp(
        startedAt,
      ),

    pausedAt:
      normalizeOptionalTimestamp(
        pausedAt,
      ),

    completedAt:
      normalizeOptionalTimestamp(
        completedAt,
      ),

    attemptIds:
      Array.isArray(attemptIds)
        ? [...attemptIds]
        : [],

    material:
      Array.isArray(material)
        ? [...material]
        : [],
  };
}


/* =============================================================================
   Normalization
   ============================================================================= */


/**
 * Normalize session status.
 *
 * @param {*} status
 * @returns {string}
 */
function normalizeStatus(status) {
  return Object.values(
    SESSION_STATUS,
  ).includes(status)
    ? status
    : SESSION_STATUS.CREATED;
}


/**
 * Normalize session direction.
 *
 * @param {*} direction
 * @returns {string}
 */
function normalizeDirection(direction) {
  return Object.values(
    SESSION_DIRECTION,
  ).includes(direction)
    ? direction
    : SESSION_DIRECTION.RECEIVE;
}


/**
 * Normalize target attempt count.
 *
 * @param {*} value
 * @returns {number}
 */
function normalizeTargetAttempts(value) {
  const number =
    Number(value);

  if (
    !Number.isInteger(number) ||
    number < 1
  ) {
    return 20;
  }

  return number;
}


/**
 * Normalize an optional timestamp.
 *
 * @param {*} value
 * @returns {number|null}
 */
function normalizeOptionalTimestamp(value) {
  if (
    value === null ||
    value === undefined
  ) {
    return null;
  }

  const timestamp =
    Number(value);

  return Number.isFinite(timestamp) &&
    timestamp > 0
    ? timestamp
    : null;
}


/**
 * Normalize a session.
 *
 * @param {Object|null} session
 * @returns {Object}
 */
function normalizeSession(session) {
  if (
    !session ||
    typeof session !== "object"
  ) {
    return createSession();
  }

  return {
    ...session,

    direction:
      normalizeDirection(
        session.direction,
      ),

    status:
      normalizeStatus(
        session.status,
      ),

    targetAttempts:
      normalizeTargetAttempts(
        session.targetAttempts,
      ),

    startedAt:
      normalizeOptionalTimestamp(
        session.startedAt,
      ),

    pausedAt:
      normalizeOptionalTimestamp(
        session.pausedAt,
      ),

    completedAt:
      normalizeOptionalTimestamp(
        session.completedAt,
      ),

    attemptIds:
      Array.isArray(session.attemptIds)
        ? [...session.attemptIds]
        : [],

    material:
      Array.isArray(session.material)
        ? [...session.material]
        : [],
  };
}


/* =============================================================================
   State Transitions
   ============================================================================= */


/**
 * Start a session.
 *
 * @param {Object} session
 * @param {number} timestamp
 * @returns {Object}
 */
function startSession(
  session,
  timestamp = Date.now(),
) {
  const current =
    normalizeSession(session);

  return {
    ...current,

    status:
      SESSION_STATUS.ACTIVE,

    startedAt:
      current.startedAt ??
      timestamp,

    pausedAt:
      null,
  };
}


/**
 * Pause a session.
 *
 * @param {Object} session
 * @param {number} timestamp
 * @returns {Object}
 */
function pauseSession(
  session,
  timestamp = Date.now(),
) {
  const current =
    normalizeSession(session);

  return {
    ...current,

    status:
      SESSION_STATUS.PAUSED,

    pausedAt:
      timestamp,
  };
}


/**
 * Resume a session.
 *
 * @param {Object} session
 * @returns {Object}
 */
function resumeSession(session) {
  const current =
    normalizeSession(session);

  return {
    ...current,

    status:
      SESSION_STATUS.ACTIVE,

    pausedAt:
      null,
  };
}


/**
 * Complete a session.
 *
 * @param {Object} session
 * @param {number} timestamp
 * @returns {Object}
 */
function completeSession(
  session,
  timestamp = Date.now(),
) {
  const current =
    normalizeSession(session);

  return {
    ...current,

    status:
      SESSION_STATUS.COMPLETED,

    completedAt:
      timestamp,

    pausedAt:
      null,
  };
}


/**
 * Abandon a session.
 *
 * @param {Object} session
 * @returns {Object}
 */
function abandonSession(session) {
  const current =
    normalizeSession(session);

  return {
    ...current,

    status:
      SESSION_STATUS.ABANDONED,

    pausedAt:
      null,
  };
}


/* =============================================================================
   Attempts
   ============================================================================= */


/**
 * Add an attempt ID to a session.
 *
 * Duplicate IDs are ignored.
 *
 * @param {Object} session
 * @param {string} attemptId
 * @returns {Object}
 */
function addAttempt(session, attemptId) {
  const current =
    normalizeSession(session);

  if (
    attemptId === null ||
    attemptId === undefined
  ) {
    return current;
  }

  if (
    current.attemptIds.includes(
      attemptId,
    )
  ) {
    return current;
  }

  return {
    ...current,

    attemptIds: [
      ...current.attemptIds,
      attemptId,
    ],
  };
}


/**
 * Get the number of recorded attempts.
 *
 * @param {Object} session
 * @returns {number}
 */
function getAttemptCount(session) {
  return normalizeSession(
    session,
  ).attemptIds.length;
}


/**
 * Determine whether the session has reached its target.
 *
 * @param {Object} session
 * @returns {boolean}
 */
function hasReachedTarget(session) {
  const current =
    normalizeSession(session);

  return (
    getAttemptCount(current) >=
    current.targetAttempts
  );
}


/* =============================================================================
   Queries
   ============================================================================= */


/**
 * Determine whether a session is active.
 *
 * @param {Object} session
 * @returns {boolean}
 */
function isSessionActive(session) {
  return (
    normalizeSession(session).status ===
    SESSION_STATUS.ACTIVE
  );
}


/**
 * Determine whether a session is paused.
 *
 * @param {Object} session
 * @returns {boolean}
 */
function isSessionPaused(session) {
  return (
    normalizeSession(session).status ===
    SESSION_STATUS.PAUSED
  );
}


/**
 * Determine whether a session is complete.
 *
 * @param {Object} session
 * @returns {boolean}
 */
function isSessionCompleted(session) {
  return (
    normalizeSession(session).status ===
    SESSION_STATUS.COMPLETED
  );
}


/* =============================================================================
   Exports
   ============================================================================= */


export {
  SESSION_STATUS,
  SESSION_DIRECTION,

  createSession,
  normalizeSession,

  startSession,
  pauseSession,
  resumeSession,
  completeSession,
  abandonSession,

  addAttempt,
  getAttemptCount,
  hasReachedTarget,

  isSessionActive,
  isSessionPaused,
  isSessionCompleted,
};


export default {
  createSession,
  normalizeSession,

  startSession,
  pauseSession,
  resumeSession,
  completeSession,
  abandonSession,

  addAttempt,
  getAttemptCount,
  hasReachedTarget,

  isSessionActive,
  isSessionPaused,
  isSessionCompleted,
};