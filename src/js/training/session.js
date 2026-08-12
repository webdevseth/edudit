/**
 * =============================================================================
 * EduDit
 * Training Session
 * =============================================================================
 *
 * Owns the lifecycle and temporary state of one training session.
 *
 * Responsibilities:
 *   - Create sessions
 *   - Track session metadata
 *   - Record attempts
 *   - Calculate session-level statistics
 *   - Track session state
 *   - Provide a clean lifecycle for training features
 *
 * This module does NOT:
 *   - Select what the learner should practice
 *   - Decide progression/unlocking
 *   - Calculate character mastery
 *   - Play audio
 *   - Render UI
 *   - Persist data directly
 *
 * The session object can be handed to the storage/state layers when the
 * session needs to be persisted.
 * =============================================================================
 */

/* =============================================================================
   Constants
   ============================================================================= */

const SESSION_STATES = Object.freeze({
  CREATED: "created",
  RUNNING: "running",
  PAUSED: "paused",
  COMPLETED: "completed",
  ABANDONED: "abandoned",
});

const SESSION_MODES = Object.freeze({
  ADAPTIVE: "adaptive",
  SEQUENTIAL: "sequential",
  REVIEW_ONLY: "review-only",
});

const SESSION_TARGETS = Object.freeze({
  CHARACTERS: "characters",
  LESSON: "lesson",
  REINFORCEMENT: "reinforcement",
  WORDS: "words",
  PHRASES: "phrases",
});

/* =============================================================================
   Utilities
   ============================================================================= */

/**
 * Generate a reasonably unique session ID.
 *
 * @returns {string}
 */
function generateSessionId() {
  const timestamp =
    Date.now().toString(36);

  const random =
    Math.random()
      .toString(36)
      .slice(2, 10);

  return `session-${timestamp}-${random}`;
}

/**
 * Normalize a timestamp.
 *
 * @param {*} timestamp
 * @returns {string}
 */
function normalizeTimestamp(timestamp) {
  if (
    timestamp instanceof Date
  ) {
    return timestamp.toISOString();
  }

  if (
    typeof timestamp === "string" &&
    !Number.isNaN(
      Date.parse(timestamp),
    )
  ) {
    return new Date(
      timestamp,
    ).toISOString();
  }

  if (
    typeof timestamp === "number" &&
    Number.isFinite(timestamp)
  ) {
    return new Date(
      timestamp,
    ).toISOString();
  }

  return new Date().toISOString();
}

/**
 * Safely convert a value to a finite number.
 *
 * @param {*} value
 * @param {number} fallback
 * @returns {number}
 */
function toFiniteNumber(
  value,
  fallback = 0,
) {
  const number =
    Number(value);

  return Number.isFinite(number)
    ? number
    : fallback;
}

/**
 * Clamp a number.
 *
 * @param {number} value
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
function clamp(
  value,
  min,
  max,
) {
  return Math.min(
    Math.max(value, min),
    max,
  );
}

/**
 * Round a number.
 *
 * @param {number} value
 * @param {number} decimals
 * @returns {number}
 */
function round(
  value,
  decimals = 2,
) {
  const factor =
    10 ** decimals;

  return (
    Math.round(
      value * factor,
    ) / factor
  );
}

/**
 * Normalize a list into a clean array.
 *
 * @param {*} value
 * @returns {Array}
 */
function normalizeArray(value) {
  return Array.isArray(value)
    ? [...value]
    : [];
}

/* =============================================================================
   Session Creation
   ============================================================================= */

/**
 * Create a new training session.
 *
 * @param {Object} options
 * @returns {Object}
 */
function createSession({
  profileId,
  mode = SESSION_MODES.ADAPTIVE,
  target = SESSION_TARGETS.CHARACTERS,
  targetId = null,
  material = [],
  sessionLength = null,
  metadata = {},
  id = null,
  startedAt = null,
} = {}) {
  if (
    typeof profileId !== "string" ||
    profileId.trim().length === 0
  ) {
    throw new TypeError(
      "A valid profileId is required to create a session.",
    );
  }

  const normalizedMode =
    Object.values(
      SESSION_MODES,
    ).includes(mode)
      ? mode
      : SESSION_MODES.ADAPTIVE;

  const normalizedTarget =
    Object.values(
      SESSION_TARGETS,
    ).includes(target)
      ? target
      : SESSION_TARGETS.CHARACTERS;

  return {
    id:
      id ||
      generateSessionId(),

    profileId:
      profileId.trim(),

    mode:
      normalizedMode,

    target:
      normalizedTarget,

    targetId:
      targetId ?? null,

    material:
      normalizeArray(material),

    sessionLength:
      sessionLength === null
        ? null
        : Math.max(
            1,
            Math.floor(
              toFiniteNumber(
                sessionLength,
              ),
            ),
          ),

    state:
      SESSION_STATES.CREATED,

    startedAt:
      startedAt
        ? normalizeTimestamp(
            startedAt,
          )
        : null,

    endedAt:
      null,

    pausedAt:
      null,

    totalPausedMs:
      0,

    attempts:
      [],

    correct:
      0,

    incorrect:
      0,

    hintsUsed:
      0,

    currentStreak:
      0,

    bestStreak:
      0,

    metadata:
      {
        ...metadata,
      },
  };
}

/* =============================================================================
   Session State
   ============================================================================= */

/**
 * Start a session.
 *
 * @param {Object} session
 * @param {string|number|Date} timestamp
 * @returns {Object}
 */
function startSession(
  session,
  timestamp = null,
) {
  assertSession(
    session,
  );

  if (
    session.state ===
    SESSION_STATES.COMPLETED
  ) {
    throw new Error(
      "A completed session cannot be started again.",
    );
  }

  if (
    session.state ===
    SESSION_STATES.ABANDONED
  ) {
    throw new Error(
      "An abandoned session cannot be started again.",
    );
  }

  if (
    session.state ===
    SESSION_STATES.RUNNING
  ) {
    return session;
  }

  const startedAt =
    normalizeTimestamp(
      timestamp,
    );

  return {
    ...session,

    state:
      SESSION_STATES.RUNNING,

    startedAt:
      session.startedAt ||
      startedAt,

    pausedAt:
      null,
  };
}

/**
 * Pause a running session.
 *
 * @param {Object} session
 * @param {string|number|Date} timestamp
 * @returns {Object}
 */
function pauseSession(
  session,
  timestamp = null,
) {
  assertSession(
    session,
  );

  if (
    session.state !==
    SESSION_STATES.RUNNING
  ) {
    return session;
  }

  return {
    ...session,

    state:
      SESSION_STATES.PAUSED,

    pausedAt:
      normalizeTimestamp(
        timestamp,
      ),
  };
}

/**
 * Resume a paused session.
 *
 * @param {Object} session
 * @param {string|number|Date} timestamp
 * @returns {Object}
 */
function resumeSession(
  session,
  timestamp = null,
) {
  assertSession(
    session,
  );

  if (
    session.state !==
    SESSION_STATES.PAUSED
  ) {
    return session;
  }

  const resumedAt =
    new Date(
      normalizeTimestamp(
        timestamp,
      ),
    ).getTime();

  const pausedAt =
    session.pausedAt
      ? new Date(
          session.pausedAt,
        ).getTime()
      : resumedAt;

  const pausedDuration =
    Math.max(
      0,
      resumedAt -
        pausedAt,
    );

  return {
    ...session,

    state:
      SESSION_STATES.RUNNING,

    pausedAt:
      null,

    totalPausedMs:
      session.totalPausedMs +
      pausedDuration,
  };
}

/**
 * Complete a session normally.
 *
 * @param {Object} session
 * @param {string|number|Date} timestamp
 * @returns {Object}
 */
function completeSession(
  session,
  timestamp = null,
) {
  assertSession(
    session,
  );

  if (
    session.state ===
    SESSION_STATES.COMPLETED
  ) {
    return session;
  }

  if (
    session.state ===
    SESSION_STATES.ABANDONED
  ) {
    throw new Error(
      "An abandoned session cannot be completed.",
    );
  }

  return {
    ...session,

    state:
      SESSION_STATES.COMPLETED,

    endedAt:
      normalizeTimestamp(
        timestamp,
      ),

    pausedAt:
      null,
  };
}

/**
 * Abandon a session.
 *
 * Abandoned sessions are distinct from successfully completed sessions.
 *
 * @param {Object} session
 * @param {string|number|Date} timestamp
 * @returns {Object}
 */
function abandonSession(
  session,
  timestamp = null,
) {
  assertSession(
    session,
  );

  if (
    session.state ===
    SESSION_STATES.COMPLETED
  ) {
    throw new Error(
      "A completed session cannot be abandoned.",
    );
  }

  return {
    ...session,

    state:
      SESSION_STATES.ABANDONED,

    endedAt:
      normalizeTimestamp(
        timestamp,
      ),

    pausedAt:
      null,
  };
}

/* =============================================================================
   Attempts
   ============================================================================= */

/**
 * Create a normalized attempt object.
 *
 * @param {Object} attempt
 * @returns {Object}
 */
function normalizeAttempt(
  attempt,
) {
  if (
    !attempt ||
    typeof attempt !== "object"
  ) {
    throw new TypeError(
      "Attempt must be an object.",
    );
  }

  const expected =
    attempt.expected ===
      undefined ||
    attempt.expected === null
      ? ""
      : String(
          attempt.expected,
        )
          .trim()
          .toUpperCase();

  const answer =
    attempt.answer ===
      undefined ||
    attempt.answer === null
      ? ""
      : String(
          attempt.answer,
        )
          .trim()
          .toUpperCase();

  const character =
    attempt.character ===
      undefined ||
    attempt.character === null
      ? expected
      : String(
          attempt.character,
        )
          .trim()
          .toUpperCase();

  const responseTimeMs =
    Math.max(
      0,
      toFiniteNumber(
        attempt.responseTimeMs,
      ),
    );

  const correct =
    attempt.correct === true ||
    (
      attempt.correct ===
        undefined &&
      expected.length > 0 &&
      answer === expected
    );

  return {
    id:
      attempt.id ||
      `attempt-${Date.now().toString(36)}-${Math.random()
        .toString(36)
        .slice(2, 8)}`,

    character,

    expected,

    answer,

    correct,

    responseTimeMs,

    hintUsed:
      attempt.hintUsed === true,

    timestamp:
      normalizeTimestamp(
        attempt.timestamp,
      ),

    metadata:
      {
        ...(attempt.metadata || {}),
      },
  };
}

/**
 * Add an attempt to a session.
 *
 * The session must be running.
 *
 * @param {Object} session
 * @param {Object} attempt
 * @returns {Object}
 */
function recordAttempt(
  session,
  attempt,
) {
  assertSession(
    session,
  );

  if (
    session.state !==
    SESSION_STATES.RUNNING
  ) {
    throw new Error(
      "Attempts can only be recorded while a session is running.",
    );
  }

  const normalizedAttempt =
    normalizeAttempt(
      attempt,
    );

  const attempts = [
    ...session.attempts,
    normalizedAttempt,
  ];

  const correct =
    session.correct +
    (
      normalizedAttempt.correct
        ? 1
        : 0
    );

  const incorrect =
    session.incorrect +
    (
      normalizedAttempt.correct
        ? 0
        : 1
    );

  const currentStreak =
    normalizedAttempt.correct
      ? session.currentStreak +
        1
      : 0;

  const bestStreak =
    Math.max(
      session.bestStreak,
      currentStreak,
    );

  const hintsUsed =
    session.hintsUsed +
    (
      normalizedAttempt.hintUsed
        ? 1
        : 0
    );

  return {
    ...session,

    attempts,

    correct,

    incorrect,

    hintsUsed,

    currentStreak,

    bestStreak,
  };
}

/* =============================================================================
   Session Statistics
   ============================================================================= */

/**
 * Calculate session accuracy.
 *
 * @param {Object} session
 * @returns {number}
 */
function calculateSessionAccuracy(
  session,
) {
  assertSession(
    session,
  );

  if (
    session.attempts.length === 0
  ) {
    return 0;
  }

  return round(
    (
      session.correct /
      session.attempts.length
    ) * 100,
    2,
  );
}

/**
 * Get valid response times from session attempts.
 *
 * @param {Object} session
 * @returns {number[]}
 */
function getSessionResponseTimes(
  session,
) {
  assertSession(
    session,
  );

  return session.attempts
    .map(
      (attempt) =>
        Number(
          attempt.responseTimeMs,
        ),
    )
    .filter(
      (value) =>
        Number.isFinite(
          value,
        ) &&
        value >= 0,
    );
}

/**
 * Calculate average response time for a session.
 *
 * @param {Object} session
 * @returns {number}
 */
function calculateAverageResponseTime(
  session,
) {
  const times =
    getSessionResponseTimes(
      session,
    );

  if (
    times.length === 0
  ) {
    return 0;
  }

  const total =
    times.reduce(
      (sum, value) =>
        sum + value,
      0,
    );

  return round(
    total /
      times.length,
    0,
  );
}

/**
 * Get the elapsed session duration.
 *
 * Paused time is excluded.
 *
 * @param {Object} session
 * @param {string|number|Date} now
 * @returns {number}
 */
function getSessionDurationMs(
  session,
  now = null,
) {
  assertSession(
    session,
  );

  if (
    !session.startedAt
  ) {
    return 0;
  }

  const start =
    new Date(
      session.startedAt,
    ).getTime();

  const end =
    session.endedAt
      ? new Date(
          session.endedAt,
        ).getTime()
      : new Date(
          normalizeTimestamp(
            now,
          ),
        ).getTime();

  if (
    !Number.isFinite(
      start,
    ) ||
    !Number.isFinite(
      end,
    )
  ) {
    return 0;
  }

  return Math.max(
    0,
    end -
      start -
      session.totalPausedMs,
  );
}

/**
 * Return a compact statistics object.
 *
 * @param {Object} session
 * @returns {Object}
 */
function getSessionStats(
  session,
) {
  assertSession(
    session,
  );

  return {
    id:
      session.id,

    profileId:
      session.profileId,

    mode:
      session.mode,

    target:
      session.target,

    targetId:
      session.targetId,

    state:
      session.state,

    attempts:
      session.attempts.length,

    correct:
      session.correct,

    incorrect:
      session.incorrect,

    accuracy:
      calculateSessionAccuracy(
        session,
      ),

    averageResponseTime:
      calculateAverageResponseTime(
        session,
      ),

    hintsUsed:
      session.hintsUsed,

    currentStreak:
      session.currentStreak,

    bestStreak:
      session.bestStreak,

    durationMs:
      getSessionDurationMs(
        session,
      ),

    startedAt:
      session.startedAt,

    endedAt:
      session.endedAt,
  };
}

/* =============================================================================
   Session Queries
   ============================================================================= */

/**
 * Determine whether a session is active.
 *
 * @param {Object} session
 * @returns {boolean}
 */
function isSessionActive(
  session,
) {
  return (
    Boolean(session) &&
    (
      session.state ===
        SESSION_STATES.RUNNING ||
      session.state ===
        SESSION_STATES.PAUSED
    )
  );
}

/**
 * Determine whether a session is finished.
 *
 * @param {Object} session
 * @returns {boolean}
 */
function isSessionFinished(
  session,
) {
  return (
    Boolean(session) &&
    (
      session.state ===
        SESSION_STATES.COMPLETED ||
      session.state ===
        SESSION_STATES.ABANDONED
    )
  );
}

/**
 * Determine whether the session has reached its requested attempt length.
 *
 * @param {Object} session
 * @returns {boolean}
 */
function hasReachedSessionLength(
  session,
) {
  if (
    session.sessionLength ===
      null ||
    session.sessionLength ===
      undefined
  ) {
    return false;
  }

  return (
    session.attempts.length >=
    session.sessionLength
  );
}

/**
 * Get the remaining number of attempts.
 *
 * @param {Object} session
 * @returns {number|null}
 */
function getRemainingAttempts(
  session,
) {
  if (
    session.sessionLength ===
      null ||
    session.sessionLength ===
      undefined
  ) {
    return null;
  }

  return Math.max(
    0,
    session.sessionLength -
      session.attempts.length,
  );
}

/* =============================================================================
   Serialization / Validation
   ============================================================================= */

/**
 * Create a persistence-safe snapshot.
 *
 * No live references are retained.
 *
 * @param {Object} session
 * @returns {Object}
 */
function serializeSession(
  session,
) {
  assertSession(
    session,
  );

  return JSON.parse(
    JSON.stringify(
      session,
    ),
  );
}

/**
 * Restore a session from persisted data.
 *
 * @param {Object} data
 * @returns {Object}
 */
function restoreSession(
  data,
) {
  if (
    !data ||
    typeof data !== "object"
  ) {
    throw new TypeError(
      "Invalid session data.",
    );
  }

  const session =
    createSession({
      profileId:
        data.profileId,

      mode:
        data.mode,

      target:
        data.target,

      targetId:
        data.targetId,

      material:
        data.material,

      sessionLength:
        data.sessionLength,

      metadata:
        data.metadata,

      id:
        data.id,

      startedAt:
        data.startedAt,
    });

  return {
    ...session,

    state:
      Object.values(
        SESSION_STATES,
      ).includes(data.state)
        ? data.state
        : SESSION_STATES.CREATED,

    endedAt:
      data.endedAt
        ? normalizeTimestamp(
            data.endedAt,
          )
        : null,

    pausedAt:
      data.pausedAt
        ? normalizeTimestamp(
            data.pausedAt,
          )
        : null,

    totalPausedMs:
      Math.max(
        0,
        toFiniteNumber(
          data.totalPausedMs,
        ),
      ),

    attempts:
      normalizeArray(
        data.attempts,
      ).map(
        normalizeAttempt,
      ),

    correct:
      Math.max(
        0,
        Math.floor(
          toFiniteNumber(
            data.correct,
          ),
        ),
      ),

    incorrect:
      Math.max(
        0,
        Math.floor(
          toFiniteNumber(
            data.incorrect,
          ),
        ),
      ),

    hintsUsed:
      Math.max(
        0,
        Math.floor(
          toFiniteNumber(
            data.hintsUsed,
          ),
        ),
      ),

    currentStreak:
      Math.max(
        0,
        Math.floor(
          toFiniteNumber(
            data.currentStreak,
          ),
        ),
      ),

    bestStreak:
      Math.max(
        0,
        Math.floor(
          toFiniteNumber(
            data.bestStreak,
          ),
        ),
      ),
  };
}

/**
 * Validate a session object.
 *
 * @param {Object} session
 */
function assertSession(
  session,
) {
  if (
    !session ||
    typeof session !== "object"
  ) {
    throw new TypeError(
      "Invalid training session.",
    );
  }

  if (
    typeof session.id !==
      "string" ||
    session.id.length === 0
  ) {
    throw new TypeError(
      "Training session must have a valid id.",
    );
  }

  if (
    typeof session.profileId !==
      "string" ||
    session.profileId.length === 0
  ) {
    throw new TypeError(
      "Training session must have a valid profileId.",
    );
  }

  if (
    !Object.values(
      SESSION_STATES,
    ).includes(
      session.state,
    )
  ) {
    throw new TypeError(
      `Invalid training session state "${session.state}".`,
    );
  }

  if (
    !Array.isArray(
      session.attempts,
    )
  ) {
    throw new TypeError(
      "Training session attempts must be an array.",
    );
  }
}

/* =============================================================================
   Exports
   ============================================================================= */

export {
  SESSION_STATES,
  SESSION_MODES,
  SESSION_TARGETS,

  generateSessionId,

  createSession,

  startSession,
  pauseSession,
  resumeSession,
  completeSession,
  abandonSession,

  normalizeAttempt,
  recordAttempt,

  calculateSessionAccuracy,
  calculateAverageResponseTime,
  getSessionDurationMs,
  getSessionStats,

  isSessionActive,
  isSessionFinished,
  hasReachedSessionLength,
  getRemainingAttempts,

  serializeSession,
  restoreSession,
  assertSession,
};

export default {
  createSession,

  startSession,
  pauseSession,
  resumeSession,
  completeSession,
  abandonSession,

  recordAttempt,

  getSessionStats,

  isSessionActive,
  isSessionFinished,

  serializeSession,
  restoreSession,
};