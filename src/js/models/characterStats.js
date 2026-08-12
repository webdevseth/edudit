/**
 * =============================================================================
 * EduDit
 * Character Statistics Model
 * =============================================================================
 *
 * Represents accumulated learner performance for one curriculum character.
 *
 * This model stores observations. It does not decide whether a character
 * should be introduced, reviewed, or mastered.
 * =============================================================================
 */


/* =============================================================================
   Constants
   ============================================================================= */


const DEFAULT_CHARACTER_STATS = Object.freeze({
  attempts: 0,
  correct: 0,
  incorrect: 0,

  mastery: 0,

  totalResponseTimeMs: 0,
  averageResponseTimeMs: 0,

  hintsUsed: 0,

  lastAttemptAt: null,
  lastCorrectAt: null,
  lastIncorrectAt: null,
});


/* =============================================================================
   Factory
   ============================================================================= */


/**
 * Create a fresh character statistics object.
 *
 * @param {Object} options
 * @returns {Object}
 */
function createCharacterStats({
  character = null,
  profileId = null,
  ...overrides
} = {}) {
  return {
    character:
      character === null ||
      character === undefined
        ? null
        : String(character).toUpperCase(),

    profileId,

    ...DEFAULT_CHARACTER_STATS,

    ...overrides,
  };
}


/* =============================================================================
   Normalization
   ============================================================================= */


/**
 * Normalize character statistics.
 *
 * @param {Object|null} stats
 * @returns {Object}
 */
function normalizeCharacterStats(stats) {
  const source =
    stats && typeof stats === "object"
      ? stats
      : {};

  const attempts =
    Number.isInteger(source.attempts) &&
    source.attempts >= 0
      ? source.attempts
      : 0;

  const correct =
    Number.isInteger(source.correct) &&
    source.correct >= 0
      ? source.correct
      : 0;

  const incorrect =
    Number.isInteger(source.incorrect) &&
    source.incorrect >= 0
      ? source.incorrect
      : 0;

  const totalResponseTimeMs =
    Number.isFinite(source.totalResponseTimeMs) &&
    source.totalResponseTimeMs >= 0
      ? source.totalResponseTimeMs
      : 0;

  const averageResponseTimeMs =
    attempts > 0
      ? totalResponseTimeMs / attempts
      : 0;

  return {
    ...DEFAULT_CHARACTER_STATS,
    ...source,

    attempts,
    correct,
    incorrect,

    totalResponseTimeMs,
    averageResponseTimeMs,

    mastery:
      clampMastery(source.mastery),
  };
}


/* =============================================================================
   Mastery
   ============================================================================= */


/**
 * Clamp mastery to the supported range.
 *
 * @param {*} value
 * @returns {number}
 */
function clampMastery(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return 0;
  }

  return Math.min(
    100,
    Math.max(0, number),
  );
}


/**
 * Set mastery without allowing an invalid value.
 *
 * @param {Object} stats
 * @param {number} mastery
 * @returns {Object}
 */
function withMastery(stats, mastery) {
  return {
    ...normalizeCharacterStats(stats),

    mastery:
      clampMastery(mastery),
  };
}


/* =============================================================================
   Recording
   ============================================================================= */


/**
 * Record one completed attempt against a character.
 *
 * @param {Object} stats
 * @param {Object} attempt
 * @returns {Object}
 */
function recordAttempt(stats, attempt) {
  const current =
    normalizeCharacterStats(stats);

  const correct =
    attempt?.result === "correct";

  const responseTime =
    Number(attempt?.responseTimeMs);

  const responseTimeMs =
    Number.isFinite(responseTime) &&
    responseTime >= 0
      ? responseTime
      : 0;

  const hints =
    Number(attempt?.hintsUsed);

  const hintsUsed =
    Number.isInteger(hints) &&
    hints >= 0
      ? hints
      : 0;

  const attempts =
    current.attempts + 1;

  const totalResponseTimeMs =
    current.totalResponseTimeMs +
    responseTimeMs;

  const timestamp =
    Number.isFinite(attempt?.timestamp)
      ? attempt.timestamp
      : Date.now();

  return {
    ...current,

    attempts,

    correct:
      current.correct +
      (correct ? 1 : 0),

    incorrect:
      current.incorrect +
      (correct ? 0 : 1),

    totalResponseTimeMs,

    averageResponseTimeMs:
      attempts > 0
        ? totalResponseTimeMs / attempts
        : 0,

    hintsUsed:
      current.hintsUsed +
      hintsUsed,

    lastAttemptAt:
      timestamp,

    lastCorrectAt:
      correct
        ? timestamp
        : current.lastCorrectAt,

    lastIncorrectAt:
      correct
        ? current.lastIncorrectAt
        : timestamp,
  };
}


/* =============================================================================
   Statistics
   ============================================================================= */


/**
 * Get character accuracy as a percentage.
 *
 * @param {Object} stats
 * @returns {number}
 */
function getAccuracy(stats) {
  const normalized =
    normalizeCharacterStats(stats);

  if (normalized.attempts === 0) {
    return 0;
  }

  return (
    normalized.correct /
    normalized.attempts
  ) * 100;
}


/**
 * Get total number of attempts.
 *
 * @param {Object} stats
 * @returns {number}
 */
function getAttemptCount(stats) {
  return normalizeCharacterStats(stats).attempts;
}


/**
 * Determine whether the character has any recorded history.
 *
 * @param {Object} stats
 * @returns {boolean}
 */
function hasHistory(stats) {
  return getAttemptCount(stats) > 0;
}


/* =============================================================================
   Exports
   ============================================================================= */


export {
  DEFAULT_CHARACTER_STATS,

  createCharacterStats,
  normalizeCharacterStats,

  clampMastery,
  withMastery,

  recordAttempt,

  getAccuracy,
  getAttemptCount,
  hasHistory,
};


export default {
  createCharacterStats,
  normalizeCharacterStats,
  recordAttempt,
  getAccuracy,
  getAttemptCount,
  hasHistory,
};