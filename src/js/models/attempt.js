/**
 * =============================================================================
 * EduDit
 * Attempt Model
 * =============================================================================
 *
 * Represents one individual learner response.
 *
 * An attempt is an immutable historical record once created. Services may
 * create attempts, but the model itself does not persist anything.
 * =============================================================================
 */


/* =============================================================================
   Constants
   ============================================================================= */


const ATTEMPT_RESULT = Object.freeze({
  CORRECT: "correct",
  INCORRECT: "incorrect",
});


const ATTEMPT_DIRECTION = Object.freeze({
  RECEIVE: "receive",
  SEND: "send",
});


/* =============================================================================
   Validation
   ============================================================================= */


/**
 * Normalize an attempt result.
 *
 * @param {*} value
 * @returns {string|null}
 */
function normalizeResult(value) {
  if (value === ATTEMPT_RESULT.CORRECT) {
    return ATTEMPT_RESULT.CORRECT;
  }

  if (value === ATTEMPT_RESULT.INCORRECT) {
    return ATTEMPT_RESULT.INCORRECT;
  }

  return null;
}


/**
 * Normalize training direction.
 *
 * @param {*} value
 * @returns {string|null}
 */
function normalizeDirection(value) {
  if (value === ATTEMPT_DIRECTION.RECEIVE) {
    return ATTEMPT_DIRECTION.RECEIVE;
  }

  if (value === ATTEMPT_DIRECTION.SEND) {
    return ATTEMPT_DIRECTION.SEND;
  }

  return null;
}


/**
 * Normalize a response value.
 *
 * @param {*} value
 * @returns {string|null}
 */
function normalizeResponse(value) {
  if (value === null || value === undefined) {
    return null;
  }

  return String(value).trim();
}


/**
 * Normalize a timestamp.
 *
 * @param {*} value
 * @returns {number}
 */
function normalizeTimestamp(value) {
  const timestamp = Number(value);

  if (Number.isFinite(timestamp) && timestamp > 0) {
    return timestamp;
  }

  return Date.now();
}


/* =============================================================================
   Factory
   ============================================================================= */


/**
 * Create a new attempt.
 *
 * @param {Object} data
 * @returns {Object}
 */
function createAttempt({
  id = null,
  sessionId = null,
  profileId = null,

  character = null,
  prompt = null,
  expectedResponse = null,
  actualResponse = null,

  result = null,
  direction = null,

  responseTimeMs = null,
  audioDurationMs = null,

  hintsUsed = 0,

  timestamp = Date.now(),
} = {}) {
  const normalizedResult =
    normalizeResult(result);

  const normalizedDirection =
    normalizeDirection(direction);

  const normalizedResponse =
    normalizeResponse(actualResponse);

  const normalizedExpected =
    normalizeResponse(expectedResponse);

  const normalizedResponseTime =
    Number(responseTimeMs);

  const normalizedAudioDuration =
    Number(audioDurationMs);

  const normalizedHints =
    Number(hintsUsed);

  return {
    id,

    sessionId,
    profileId,

    character:
      character === null ||
      character === undefined
        ? null
        : String(character).toUpperCase(),

    prompt:
      prompt === null ||
      prompt === undefined
        ? null
        : String(prompt),

    expectedResponse:
      normalizedExpected,

    actualResponse:
      normalizedResponse,

    result:
      normalizedResult,

    direction:
      normalizedDirection,

    responseTimeMs:
      Number.isFinite(normalizedResponseTime) &&
      normalizedResponseTime >= 0
        ? normalizedResponseTime
        : null,

    audioDurationMs:
      Number.isFinite(normalizedAudioDuration) &&
      normalizedAudioDuration >= 0
        ? normalizedAudioDuration
        : null,

    hintsUsed:
      Number.isInteger(normalizedHints) &&
      normalizedHints >= 0
        ? normalizedHints
        : 0,

    timestamp:
      normalizeTimestamp(timestamp),
  };
}


/* =============================================================================
   Derived State
   ============================================================================= */


/**
 * Determine whether an attempt was correct.
 *
 * @param {Object} attempt
 * @returns {boolean}
 */
function isAttemptCorrect(attempt) {
  return attempt?.result === ATTEMPT_RESULT.CORRECT;
}


/**
 * Determine whether an attempt was incorrect.
 *
 * @param {Object} attempt
 * @returns {boolean}
 */
function isAttemptIncorrect(attempt) {
  return attempt?.result === ATTEMPT_RESULT.INCORRECT;
}


/**
 * Determine whether an attempt has a completed result.
 *
 * @param {Object} attempt
 * @returns {boolean}
 */
function isAttemptCompleted(attempt) {
  return (
    attempt?.result === ATTEMPT_RESULT.CORRECT ||
    attempt?.result === ATTEMPT_RESULT.INCORRECT
  );
}


/**
 * Calculate an attempt's accuracy contribution.
 *
 * @param {Object} attempt
 * @returns {number}
 */
function getAttemptAccuracy(attempt) {
  return isAttemptCorrect(attempt) ? 1 : 0;
}


/* =============================================================================
   Validation
   ============================================================================= */


/**
 * Validate an attempt object.
 *
 * @param {*} attempt
 * @returns {Object}
 */
function validateAttempt(attempt) {
  const errors = [];

  if (!attempt || typeof attempt !== "object") {
    return {
      valid: false,
      errors: ["Attempt must be an object."],
    };
  }

  if (
    attempt.result !== null &&
    attempt.result !== undefined &&
    !normalizeResult(attempt.result)
  ) {
    errors.push("Attempt result is invalid.");
  }

  if (
    attempt.direction !== null &&
    attempt.direction !== undefined &&
    !normalizeDirection(attempt.direction)
  ) {
    errors.push("Attempt direction is invalid.");
  }

  if (
    attempt.responseTimeMs !== null &&
    attempt.responseTimeMs !== undefined &&
    (
      !Number.isFinite(attempt.responseTimeMs) ||
      attempt.responseTimeMs < 0
    )
  ) {
    errors.push("Response time must be a non-negative number.");
  }

  if (
    attempt.hintsUsed !== null &&
    attempt.hintsUsed !== undefined &&
    (
      !Number.isInteger(attempt.hintsUsed) ||
      attempt.hintsUsed < 0
    )
  ) {
    errors.push("Hints used must be a non-negative integer.");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}


/* =============================================================================
   Exports
   ============================================================================= */


export {
  ATTEMPT_RESULT,
  ATTEMPT_DIRECTION,

  createAttempt,

  isAttemptCorrect,
  isAttemptIncorrect,
  isAttemptCompleted,

  getAttemptAccuracy,

  validateAttempt,
};


export default {
  createAttempt,
  isAttemptCorrect,
  isAttemptIncorrect,
  isAttemptCompleted,
  getAttemptAccuracy,
  validateAttempt,
};