/**
 * =============================================================================
 * EduDit
 * Mastery Engine
 * =============================================================================
 *
 * Owns character-level learning statistics and mastery calculations.
 *
 * This module answers:
 *
 *   "How well does the learner know this character?"
 *
 * It does NOT answer:
 *
 *   "What should the learner practice?"
 *
 * That belongs to adaptive.js.
 *
 * It does NOT answer:
 *
 *   "What has the learner unlocked?"
 *
 * That belongs to progression.js.
 *
 * The mastery model is intentionally transparent and tunable.
 * =============================================================================
 */

/* =============================================================================
   Constants
   ============================================================================= */

/**
 * Mastery bands used internally and optionally exposed to the UI.
 */
const MASTERY_LEVELS = Object.freeze({
  UNFAMILIAR: "unfamiliar",
  LEARNING: "learning",
  DEVELOPING: "developing",
  COMFORTABLE: "comfortable",
  STRONG: "strong",
});

/**
 * Conceptual mastery ranges from the product blueprint.
 */
const MASTERY_RANGES = Object.freeze({
  UNFAMILIAR: Object.freeze({
    min: 0,
    max: 20,
  }),

  LEARNING: Object.freeze({
    min: 21,
    max: 40,
  }),

  DEVELOPING: Object.freeze({
    min: 41,
    max: 60,
  }),

  COMFORTABLE: Object.freeze({
    min: 61,
    max: 80,
  }),

  STRONG: Object.freeze({
    min: 81,
    max: 100,
  }),
});

/**
 * Default character statistics.
 *
 * These fields form the canonical character-stat schema.
 */
const DEFAULT_CHARACTER_STATS = Object.freeze({
  attempts: 0,
  correct: 0,

  accuracy: 0,
  recentAccuracy: 0,

  averageResponseTime: 0,
  recentResponseTime: 0,
  fastestResponseTime: null,

  lastSeen: null,
  timesIntroduced: 0,
  timesMissed: 0,

  currentStreak: 0,

  masteryScore: 0,

  hintsUsed: 0,
});

/**
 * Number of recent attempts used when calculating recent performance.
 *
 * This is intentionally small enough that recent mistakes matter without
 * completely discarding long-term knowledge.
 */
const RECENT_ATTEMPT_LIMIT = 10;

/**
 * Maximum response time considered useful when calculating adaptive
 * performance.
 *
 * The raw response time should still be stored in attempt/session history.
 * This ceiling only protects rolling performance calculations from a learner
 * being interrupted or leaving the application open.
 */
const RESPONSE_TIME_ADAPTIVE_CAP_MS =
  30_000;

/**
 * Percentage of recent/long-term performance used by the mastery calculation.
 */
const MASTERY_WEIGHTS = Object.freeze({
  LONG_TERM_ACCURACY: 0.45,
  RECENT_ACCURACY: 0.35,
  RESPONSE_TIME: 0.20,
});

/**
 * Response time considered "excellent" for mastery purposes.
 *
 * This is not a required answer-speed target for the learner. It is simply
 * the upper reference point used to translate response time into a normalized
 * performance signal.
 */
const RESPONSE_TIME_REFERENCE_MS =
  2_500;

/* =============================================================================
   Utilities
   ============================================================================= */

/**
 * Clamp a number to a range.
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

  return Number.isFinite(
    number,
  )
    ? number
    : fallback;
}

/**
 * Round a number to a useful precision.
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
 * Normalize a character identifier.
 *
 * @param {*} character
 * @returns {string}
 */
function normalizeCharacter(
  character,
) {
  if (
    character === null ||
    character === undefined
  ) {
    throw new TypeError(
      "Character is required.",
    );
  }

  const normalized =
    String(character)
      .trim()
      .toUpperCase();

  if (!normalized) {
    throw new TypeError(
      "Character cannot be empty.",
    );
  }

  return normalized;
}

/**
 * Normalize a timestamp into an ISO string.
 *
 * @param {*} timestamp
 * @returns {string}
 */
function normalizeTimestamp(
  timestamp,
) {
  if (
    timestamp instanceof Date
  ) {
    return timestamp.toISOString();
  }

  if (
    typeof timestamp ===
      "string" &&
    !Number.isNaN(
      Date.parse(timestamp),
    )
  ) {
    return new Date(
      timestamp,
    ).toISOString();
  }

  if (
    typeof timestamp ===
      "number" &&
    Number.isFinite(timestamp)
  ) {
    return new Date(
      timestamp,
    ).toISOString();
  }

  return new Date().toISOString();
}

/* =============================================================================
   Character Statistics
   ============================================================================= */

/**
 * Create a fresh statistics object for a character.
 *
 * @returns {Object}
 */
function createCharacterStats() {
  return {
    ...DEFAULT_CHARACTER_STATS,
  };
}

/**
 * Normalize existing character statistics.
 *
 * This is useful when loading persisted data created by an older schema.
 *
 * @param {Object|null} stats
 * @returns {Object}
 */
function normalizeCharacterStats(
  stats,
) {
  const normalized = {
    ...DEFAULT_CHARACTER_STATS,
    ...(stats || {}),
  };

  normalized.attempts =
    Math.max(
      0,
      Math.floor(
        toFiniteNumber(
          normalized.attempts,
        ),
      ),
    );

  normalized.correct =
    clamp(
      Math.floor(
        toFiniteNumber(
          normalized.correct,
        ),
      ),
      0,
      normalized.attempts,
    );

  normalized.accuracy =
    clamp(
      toFiniteNumber(
        normalized.accuracy,
      ),
      0,
      100,
    );

  normalized.recentAccuracy =
    clamp(
      toFiniteNumber(
        normalized.recentAccuracy,
      ),
      0,
      100,
    );

  normalized.averageResponseTime =
    Math.max(
      0,
      toFiniteNumber(
        normalized.averageResponseTime,
      ),
    );

  normalized.recentResponseTime =
    Math.max(
      0,
      toFiniteNumber(
        normalized.recentResponseTime,
      ),
    );

  normalized.fastestResponseTime =
    normalized.fastestResponseTime ===
      null
      ? null
      : Math.max(
          0,
          toFiniteNumber(
            normalized.fastestResponseTime,
          ),
        );

  normalized.timesIntroduced =
    Math.max(
      0,
      Math.floor(
        toFiniteNumber(
          normalized.timesIntroduced,
        ),
      ),
    );

  normalized.timesMissed =
    Math.max(
      0,
      Math.floor(
        toFiniteNumber(
          normalized.timesMissed,
        ),
      ),
    );

  normalized.currentStreak =
    Math.max(
      0,
      Math.floor(
        toFiniteNumber(
          normalized.currentStreak,
        ),
      ),
    );

  normalized.masteryScore =
    clamp(
      toFiniteNumber(
        normalized.masteryScore,
      ),
      0,
      100,
    );

  normalized.hintsUsed =
    Math.max(
      0,
      Math.floor(
        toFiniteNumber(
          normalized.hintsUsed,
        ),
      ),
    );

  return normalized;
}

/* =============================================================================
   Accuracy
   ============================================================================= */

/**
 * Calculate percentage accuracy.
 *
 * @param {number} correct
 * @param {number} attempts
 * @returns {number}
 */
function calculateAccuracy(
  correct,
  attempts,
) {
  if (
    attempts <= 0
  ) {
    return 0;
  }

  return round(
    clamp(
      (correct / attempts) *
        100,
      0,
      100,
    ),
    2,
  );
}

/**
 * Calculate recent accuracy from attempts.
 *
 * Each attempt should have:
 *
 *   correct: boolean
 *
 * @param {Array<Object>} attempts
 * @param {number} limit
 * @returns {number}
 */
function calculateRecentAccuracy(
  attempts = [],
  limit = RECENT_ATTEMPT_LIMIT,
) {
  if (
    !Array.isArray(
      attempts,
    ) ||
    attempts.length === 0
  ) {
    return 0;
  }

  const recent =
    attempts.slice(
      -Math.max(
        1,
        limit,
      ),
    );

  const correct =
    recent.filter(
      (attempt) =>
        attempt?.correct ===
        true,
    ).length;

  return calculateAccuracy(
    correct,
    recent.length,
  );
}

/* =============================================================================
   Response Time
   ============================================================================= */

/**
 * Filter response times for adaptive calculations.
 *
 * Raw attempt history is never modified.
 *
 * @param {Array<Object>} attempts
 * @returns {number[]}
 */
function getUsableResponseTimes(
  attempts = [],
) {
  if (
    !Array.isArray(
      attempts,
    )
  ) {
    return [];
  }

  return attempts
    .map(
      (attempt) =>
        Number(
          attempt?.responseTimeMs,
        ),
    )
    .filter(
      (value) =>
        Number.isFinite(
          value,
        ) &&
        value >= 0 &&
        value <=
          RESPONSE_TIME_ADAPTIVE_CAP_MS,
    );
}

/**
 * Calculate a trimmed mean.
 *
 * The slowest and fastest values are removed when enough samples exist.
 *
 * @param {number[]} values
 * @param {number} trimRatio
 * @returns {number}
 */
function calculateTrimmedMean(
  values,
  trimRatio = 0.1,
) {
  if (
    !Array.isArray(
      values,
    ) ||
    values.length === 0
  ) {
    return 0;
  }

  const sorted =
    [...values].sort(
      (a, b) => a - b,
    );

  if (
    sorted.length < 5
  ) {
    const total =
      sorted.reduce(
        (sum, value) =>
          sum + value,
        0,
      );

    return total /
      sorted.length;
  }

const trimCount =
  Math.max(
    1,
    Math.floor(
      sorted.length *
        trimRatio,
    ),
  );

  const start =
    trimCount;

  const end =
    sorted.length -
    trimCount;

  const trimmed =
    sorted.slice(
      start,
      end,
    );

  const total =
    trimmed.reduce(
      (sum, value) =>
        sum + value,
      0,
    );

  return total /
    trimmed.length;
}

/**
 * Calculate the recent response time using a trimmed mean.
 *
 * @param {Array<Object>} attempts
 * @param {number} limit
 * @returns {number}
 */
function calculateRecentResponseTime(
  attempts = [],
  limit = RECENT_ATTEMPT_LIMIT,
) {
  if (
    !Array.isArray(
      attempts,
    ) ||
    attempts.length === 0
  ) {
    return 0;
  }

  const recent =
    attempts.slice(
      -Math.max(
        1,
        limit,
      ),
    );

  const times =
    getUsableResponseTimes(
      recent,
    );

  if (
    times.length === 0
  ) {
    return 0;
  }

  return round(
    calculateTrimmedMean(
      times,
    ),
    0,
  );
}

/**
 * Calculate long-term average response time.
 *
 * @param {Array<Object>} attempts
 * @returns {number}
 */
function calculateAverageResponseTime(
  attempts = [],
) {
  const times =
    getUsableResponseTimes(
      attempts,
    );

  if (
    times.length === 0
  ) {
    return 0;
  }

  return round(
    calculateTrimmedMean(
      times,
    ),
    0,
  );
}

/**
 * Find the fastest valid response time.
 *
 * @param {Array<Object>} attempts
 * @returns {number|null}
 */
function calculateFastestResponseTime(
  attempts = [],
) {
  const times =
    getUsableResponseTimes(
      attempts,
    );

  if (
    times.length === 0
  ) {
    return null;
  }

  return Math.min(
    ...times,
  );
}

/* =============================================================================
   Response-Time Mastery
   ============================================================================= */

/**
 * Convert response time into a normalized performance score.
 *
 * This deliberately uses a diminishing-return curve instead of a simple
 * pass/fail threshold.
 *
 * @param {number} responseTimeMs
 * @returns {number}
 */
function calculateResponseTimeScore(
  responseTimeMs,
) {
  const time =
    toFiniteNumber(
      responseTimeMs,
      0,
    );

  if (
    time <= 0
  ) {
    return 0;
  }

  /*
   * A response at or below the reference time receives a strong score.
   * Slower responses gradually reduce the contribution.
   */
  const score =
    100 *
    Math.exp(
      -time /
        RESPONSE_TIME_REFERENCE_MS,
    );

  return round(
    clamp(
      score,
      0,
      100,
    ),
    2,
  );
}

/* =============================================================================
   Mastery Score
   ============================================================================= */

/**
 * Calculate the mastery score.
 *
 * With insufficient attempts, the score is intentionally conservative.
 *
 * @param {Object} input
 * @returns {number}
 */
function calculateMasteryScore({
  accuracy = 0,
  recentAccuracy = 0,
  responseTimeMs = 0,
  attempts = 0,
} = {}) {
  if (
    attempts <= 0
  ) {
    return 0;
  }

  const accuracyScore =
    clamp(
      toFiniteNumber(
        accuracy,
      ),
      0,
      100,
    );

  const recentAccuracyScore =
    clamp(
      toFiniteNumber(
        recentAccuracy,
      ),
      0,
      100,
    );

  const responseScore =
    calculateResponseTimeScore(
      responseTimeMs,
    );

  const weighted =
    accuracyScore *
      MASTERY_WEIGHTS
        .LONG_TERM_ACCURACY +
    recentAccuracyScore *
      MASTERY_WEIGHTS
        .RECENT_ACCURACY +
    responseScore *
      MASTERY_WEIGHTS
        .RESPONSE_TIME;

  /*
   * Early attempts should not immediately produce "strong" mastery.
   *
   * This confidence factor makes mastery grow as evidence accumulates.
   */
  const confidence =
    clamp(
      attempts / 10,
      0,
      1,
    );

  return round(
    clamp(
      weighted *
        confidence,
      0,
      100,
    ),
    2,
  );
}

/**
 * Determine the qualitative mastery level.
 *
 * @param {number} masteryScore
 * @returns {string}
 */
function getMasteryLevel(
  masteryScore,
) {
  const score =
    clamp(
      toFiniteNumber(
        masteryScore,
      ),
      0,
      100,
    );

  if (
    score <=
    MASTERY_RANGES
      .UNFAMILIAR.max
  ) {
    return MASTERY_LEVELS.UNFAMILIAR;
  }

  if (
    score <=
    MASTERY_RANGES
      .LEARNING.max
  ) {
    return MASTERY_LEVELS.LEARNING;
  }

  if (
    score <=
    MASTERY_RANGES
      .DEVELOPING.max
  ) {
    return MASTERY_LEVELS.DEVELOPING;
  }

  if (
    score <=
    MASTERY_RANGES
      .COMFORTABLE.max
  ) {
    return MASTERY_LEVELS.COMFORTABLE;
  }

  return MASTERY_LEVELS.STRONG;
}

/* =============================================================================
   Attempt Application
   ============================================================================= */

/**
 * Apply a single attempt to character statistics.
 *
 * This function expects an attempt object containing at least:
 *
 *   correct
 *   responseTimeMs
 *
 * Optional:
 *
 *   timestamp
 *   hintUsed
 *
 * @param {Object|null} currentStats
 * @param {Object} attempt
 * @param {Array<Object>} recentAttempts
 * @returns {Object}
 */
function applyAttempt(
  currentStats,
  attempt,
  recentAttempts = [],
) {
  const stats =
    normalizeCharacterStats(
      currentStats,
    );

  if (
    !attempt ||
    typeof attempt !==
      "object"
  ) {
    throw new TypeError(
      "Attempt must be an object.",
    );
  }

  const correct =
    attempt.correct ===
    true;

  const responseTimeMs =
    Math.max(
      0,
      toFiniteNumber(
        attempt.responseTimeMs,
      ),
    );

  const hintUsed =
    attempt.hintUsed ===
    true;

  const timestamp =
    normalizeTimestamp(
      attempt.timestamp,
    );

  const nextAttempts =
    stats.attempts + 1;

  const nextCorrect =
    stats.correct +
    (correct ? 1 : 0);

  const nextAccuracy =
    calculateAccuracy(
      nextCorrect,
      nextAttempts,
    );

  const nextAttemptHistory =
    [
      ...recentAttempts,
      {
        correct,
        responseTimeMs,
        timestamp,
      },
    ];

  const nextRecentAccuracy =
    calculateRecentAccuracy(
      nextAttemptHistory,
    );

  const nextRecentResponseTime =
    calculateRecentResponseTime(
      nextAttemptHistory,
    );

  const nextAverageResponseTime =
    stats.attempts === 0
      ? responseTimeMs
      : calculateTrimmedMean(
          [
            stats.averageResponseTime,
            responseTimeMs,
          ],
        );

  const nextFastest =
    stats.fastestResponseTime ===
      null
      ? responseTimeMs
      : Math.min(
          stats.fastestResponseTime,
          responseTimeMs,
        );

  const nextStreak =
    correct
      ? stats.currentStreak +
        1
      : 0;

  const masteryScore =
    calculateMasteryScore(
      {
        accuracy:
          nextAccuracy,

        recentAccuracy:
          nextRecentAccuracy,

        responseTimeMs:
          nextRecentResponseTime ||
          nextAverageResponseTime,

        attempts:
          nextAttempts,
      },
    );

  return {
    ...stats,

    attempts:
      nextAttempts,

    correct:
      nextCorrect,

    accuracy:
      nextAccuracy,

    recentAccuracy:
      nextRecentAccuracy,

    averageResponseTime:
      round(
        nextAverageResponseTime,
        0,
      ),

    recentResponseTime:
      nextRecentResponseTime,

    fastestResponseTime:
      nextFastest,

    lastSeen:
      timestamp,

    timesMissed:
      stats.timesMissed +
      (correct ? 0 : 1),

    currentStreak:
      nextStreak,

    masteryScore,

    hintsUsed:
      stats.hintsUsed +
      (hintUsed ? 1 : 0),
  };
}

/* =============================================================================
   Introduction Tracking
   ============================================================================= */

/**
 * Record that a character was introduced.
 *
 * @param {Object|null} currentStats
 * @returns {Object}
 */
function recordIntroduction(
  currentStats,
) {
  const stats =
    normalizeCharacterStats(
      currentStats,
    );

  return {
    ...stats,

    timesIntroduced:
      stats.timesIntroduced +
      1,

    lastSeen:
      stats.lastSeen ??
      new Date().toISOString(),
  };
}

/* =============================================================================
   Performance Helpers
   ============================================================================= */

/**
 * Determine whether a character currently appears weak.
 *
 * This is a signal for adaptive.js, not a practice-selection decision.
 *
 * @param {Object} stats
 * @param {Object} options
 * @returns {boolean}
 */
function isWeakCharacter(
  stats,
  {
    masteryThreshold = 60,
    recentAccuracyThreshold = 80,
    responseTimeThresholdMs = 3_000,
  } = {},
) {
  const normalized =
    normalizeCharacterStats(
      stats,
    );

  if (
    normalized.attempts === 0
  ) {
    return true;
  }

  return (
    normalized.masteryScore <
      masteryThreshold ||
    normalized.recentAccuracy <
      recentAccuracyThreshold ||
    (
      normalized.recentResponseTime >
        responseTimeThresholdMs &&
      normalized.attempts >= 3
    )
  );
}

/**
 * Determine whether a character has sufficient evidence to be considered
 * strong.
 *
 * @param {Object} stats
 * @param {Object} options
 * @returns {boolean}
 */
function isStrongCharacter(
  stats,
  {
    masteryThreshold = 81,
    minimumAttempts = 5,
  } = {},
) {
  const normalized =
    normalizeCharacterStats(
      stats,
    );

  return (
    normalized.attempts >=
      minimumAttempts &&
    normalized.masteryScore >=
      masteryThreshold
  );
}

/**
 * Calculate a simple improvement score.
 *
 * Positive values mean recent performance is better than long-term
 * performance. Negative values indicate deterioration.
 *
 * @param {Object} stats
 * @returns {number}
 */
function calculateImprovement(
  stats,
) {
  const normalized =
    normalizeCharacterStats(
      stats,
    );

  return round(
    normalized.recentAccuracy -
      normalized.accuracy,
    2,
  );
}

/**
 * Return a UI-safe mastery summary.
 *
 * @param {Object} stats
 * @returns {Object}
 */
function getMasterySummary(
  stats,
) {
  const normalized =
    normalizeCharacterStats(
      stats,
    );

  return {
    score:
      normalized.masteryScore,

    level:
      getMasteryLevel(
        normalized.masteryScore,
      ),

    accuracy:
      normalized.accuracy,

    recentAccuracy:
      normalized.recentAccuracy,

    averageResponseTime:
      normalized.averageResponseTime,

    recentResponseTime:
      normalized.recentResponseTime,

    attempts:
      normalized.attempts,

    correct:
      normalized.correct,

    currentStreak:
      normalized.currentStreak,

    improvement:
      calculateImprovement(
        normalized,
      ),
  };
}

/* =============================================================================
   Exports
   ============================================================================= */

export {
  MASTERY_LEVELS,
  MASTERY_RANGES,
  DEFAULT_CHARACTER_STATS,

  RECENT_ATTEMPT_LIMIT,
  RESPONSE_TIME_ADAPTIVE_CAP_MS,
  MASTERY_WEIGHTS,
  RESPONSE_TIME_REFERENCE_MS,

  createCharacterStats,
  normalizeCharacterStats,

  calculateAccuracy,
  calculateRecentAccuracy,

  getUsableResponseTimes,
  calculateTrimmedMean,
  calculateRecentResponseTime,
  calculateAverageResponseTime,
  calculateFastestResponseTime,

  calculateResponseTimeScore,
  calculateMasteryScore,
  getMasteryLevel,

  applyAttempt,
  recordIntroduction,

  isWeakCharacter,
  isStrongCharacter,
  calculateImprovement,
  getMasterySummary,
};

export default {
  createCharacterStats,
  normalizeCharacterStats,
  applyAttempt,
  recordIntroduction,
  calculateMasteryScore,
  getMasteryLevel,
  isWeakCharacter,
  isStrongCharacter,
  getMasterySummary,
};