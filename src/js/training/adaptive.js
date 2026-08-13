/**
 * =============================================================================
 * EduDit
 * Adaptive Learning Engine
 * =============================================================================
 *
 * Determines what learner material currently deserves practice.
 *
 * Responsibilities:
 *
 * - Calculate training priority
 * - Evaluate recent performance
 * - Account for long-term performance
 * - Account for response time
 * - Account for recency
 * - Account for exposure count
 * - Identify weak characters
 * - Select adaptive practice candidates
 *
 * Does NOT:
 *
 * - Render UI
 * - Play audio
 * - Write persistence data
 * - Change progression directly
 * - Own curriculum definitions
 * - Own training session lifecycle
 *
 * The adaptive engine is deliberately deterministic. Given the same learner
 * statistics, current time, and candidate material, it should produce the same
 * result. This makes the algorithm straightforward to test and tune.
 * =============================================================================
 */

/* =============================================================================
   Constants
   ============================================================================= */

/**
 * Difficulty / progression settings.
 *
 * These affect how aggressively the learner advances.
 */
const LEARNING_PACE = Object.freeze({
  RELAXED: "relaxed",
  STANDARD: "standard",
  FOCUSED: "focused",
  MASTERY: "mastery",
});

/**
 * Centralized adaptive-learning weights.
 *
 * Keep these in one place so the algorithm can be tuned without hunting
 * through the implementation.
 *
 * The weights intentionally sum to 1.
 */
const ADAPTIVE_WEIGHTS = Object.freeze({
  RECENT_ACCURACY: 0.30,
  OVERALL_ACCURACY: 0.20,
  RESPONSE_TIME: 0.15,
  RECENCY: 0.15,
  EXPOSURE: 0.10,
  MASTERY_GAP: 0.10,
});

/**
 * Default assumptions for a brand-new character.
 */
const DEFAULT_CHARACTER_STAT = Object.freeze({
  attempts: 0,
  correct: 0,
  accuracy: 0,
  recentAccuracy: 0,
  averageResponseTimeMs: 0,
  recentResponseTimeMs: 0,
  fastestResponseTimeMs: 0,
  lastSeenAt: null,
  timesIntroduced: 0,
  timesMissed: 0,
  currentStreak: 0,
  masteryScore: 0,
});

/**
 * Response-time bounds used by the adaptive engine.
 *
 * Extremely long pauses can occur because the learner was distracted,
 * interrupted, or temporarily away from the application. They should not
 * dominate adaptive decisions.
 *
 * The raw response time may still be stored in session history.
 */
const RESPONSE_TIME = Object.freeze({
  FLOOR_MS: 250,
  CEILING_MS: 15000,
});

/**
 * Recency configuration.
 *
 * A character practiced very recently should generally receive slightly less
 * priority unless its performance is poor.
 */
const RECENCY = Object.freeze({
  HALF_LIFE_MS:
    1000 * 60 * 60 * 24 * 3,
});

/**
 * Exposure configuration.
 *
 * Characters with very few exposures receive additional priority so that
 * new material has enough opportunity to become familiar.
 */
const EXPOSURE = Object.freeze({
  TARGET_EXPOSURES: 8,
});

/**
 * Mastery thresholds.
 *
 * These are deliberately transparent and correspond to the conceptual scale
 * in the product blueprint.
 */
const MASTERY_LEVELS = Object.freeze({
  UNFAMILIAR: 20,
  LEARNING: 40,
  DEVELOPING: 60,
  COMFORTABLE: 80,
  STRONG: 100,
});

/**
 * Progression thresholds by learning pace.
 *
 * These represent the minimum mastery generally required before new material
 * can be considered ready for introduction.
 */
const PROGRESSION_THRESHOLDS = Object.freeze({
  [LEARNING_PACE.RELAXED]: 60,
  [LEARNING_PACE.STANDARD]: 70,
  [LEARNING_PACE.FOCUSED]: 82,
  [LEARNING_PACE.MASTERY]: 92,
});

/* =============================================================================
   Utilities
   ============================================================================= */

/**
 * Clamp a number to a range.
 *
 * @param {number} value
 * @param {number} minimum
 * @param {number} maximum
 * @returns {number}
 */
function clamp(
  value,
  minimum,
  maximum,
) {
  return Math.min(
    maximum,
    Math.max(minimum, value),
  );
}

/**
 * Convert a value into a finite number.
 *
 * @param {*} value
 * @param {number} fallback
 * @returns {number}
 */
function toFiniteNumber(
  value,
  fallback = 0,
) {
  return Number.isFinite(value)
    ? value
    : fallback;
}

/**
 * Calculate standard accuracy from attempts and correct answers.
 *
 * @param {number} attempts
 * @param {number} correct
 * @returns {number}
 */
function calculateAccuracy(
  attempts,
  correct,
) {
  if (
    attempts <= 0
  ) {
    return 0;
  }

  return clamp(
    correct / attempts,
    0,
    1,
  );
}

/**
 * Normalize a character statistic object.
 *
 * Missing fields are filled with safe defaults.
 *
 * @param {Object|null} stat
 * @returns {Object}
 */
function normalizeCharacterStat(
  stat,
) {
  return {
    ...DEFAULT_CHARACTER_STAT,
    ...(stat || {}),
  };
}

/**
 * Calculate how much a character's accuracy needs improvement.
 *
 * @param {number} accuracy
 * @returns {number}
 */
function accuracyNeed(
  accuracy,
) {
  return clamp(
    1 - accuracy,
    0,
    1,
  );
}

/**
 * Calculate a normalized response-time difficulty score.
 *
 * Fast responses result in low priority.
 * Slow responses result in higher priority.
 *
 * @param {number} responseTimeMs
 * @returns {number}
 */
function responseTimeNeed(
  responseTimeMs,
) {
  if (!Number.isFinite(responseTimeMs)) {
  return 0.5;
}

if (responseTimeMs < 0) {
  return 0;
}

if (responseTimeMs === 0) {
  return 0.5;
}

  const bounded =
    clamp(
      responseTimeMs,
      RESPONSE_TIME.FLOOR_MS,
      RESPONSE_TIME.CEILING_MS,
    );

  const range =
    RESPONSE_TIME.CEILING_MS -
    RESPONSE_TIME.FLOOR_MS;

  return clamp(
    (bounded -
      RESPONSE_TIME.FLOOR_MS) /
      range,
    0,
    1,
  );
}

/**
 * Calculate a recency need score.
 *
 * A character that has not been seen recently receives more priority.
 *
 * @param {number|string|null} lastSeenAt
 * @param {number} currentTime
 * @returns {number}
 */
function recencyNeed(
  lastSeenAt,
  currentTime = Date.now(),
) {
  if (!lastSeenAt) {
    return 1;
  }

  const timestamp =
    typeof lastSeenAt ===
    "number"
      ? lastSeenAt
      : Date.parse(lastSeenAt);

  if (
    !Number.isFinite(
      timestamp,
    )
  ) {
    return 1;
  }

  const elapsed =
    Math.max(
      0,
      currentTime - timestamp,
    );

  /*
   * Exponential decay with a three-day half-life.
   *
   * This produces:
   *
   * 0 days → approximately 0
   * 3 days → 0.5
   * 6 days → 0.75
   * 9 days → 0.875
   */
  return clamp(
    1 -
      Math.pow(
        0.5,
        elapsed /
          RECENCY.HALF_LIFE_MS,
      ),
    0,
    1,
  );
}

/**
 * Calculate exposure need.
 *
 * Characters with fewer exposures receive additional practice.
 *
 * @param {number} attempts
 * @returns {number}
 */
function exposureNeed(
  attempts,
) {
  const safeAttempts =
    Math.max(
      0,
      toFiniteNumber(
        attempts,
      ),
    );

  if (
    safeAttempts >=
    EXPOSURE.TARGET_EXPOSURES
  ) {
    return 0;
  }

  return clamp(
    1 -
      safeAttempts /
        EXPOSURE.TARGET_EXPOSURES,
    0,
    1,
  );
}

/**
 * Calculate mastery gap.
 *
 * @param {number} masteryScore
 * @returns {number}
 */
function masteryGap(
  masteryScore,
) {
  return clamp(
    1 -
      clamp(
        toFiniteNumber(
          masteryScore,
        ),
        0,
        100,
      ) /
        100,
    0,
    1,
  );
}

/**
 * Return the configured progression threshold.
 *
 * @param {string} learningPace
 * @returns {number}
 */
function getProgressionThreshold(
  learningPace = LEARNING_PACE.STANDARD,
) {
  return (
    PROGRESSION_THRESHOLDS[
      learningPace
    ] ??
    PROGRESSION_THRESHOLDS[
      LEARNING_PACE.STANDARD
    ]
  );
}

/* =============================================================================
   Character Analysis
   ============================================================================= */

/**
 * Calculate a transparent adaptive priority score for a character.
 *
 * Higher score = greater need for practice.
 *
 * @param {Object|null} stat
 * @param {Object} options
 * @returns {Object}
 */
function calculateCharacterPriority(
  stat,
  {
    currentTime = Date.now(),
    learningPace =
      LEARNING_PACE.STANDARD,
  } = {},
) {
  const normalized =
    normalizeCharacterStat(
      stat,
    );

  const recentAccuracy =
    clamp(
      toFiniteNumber(
        normalized.recentAccuracy,
      ),
      0,
      1,
    );

  const overallAccuracy =
    normalized.attempts > 0
      ? calculateAccuracy(
          normalized.attempts,
          normalized.correct,
        )
      : clamp(
          toFiniteNumber(
            normalized.accuracy,
          ),
          0,
          1,
        );

  const responseTime =
    normalized.recentResponseTimeMs ||
    normalized.averageResponseTimeMs;

  const recentAccuracyNeed =
    accuracyNeed(
      recentAccuracy,
    );

  const overallAccuracyNeed =
    accuracyNeed(
      overallAccuracy,
    );

  const responseNeed =
    responseTimeNeed(
      responseTime,
    );

  const recency =
    recencyNeed(
      normalized.lastSeenAt,
      currentTime,
    );

  const exposure =
    exposureNeed(
      normalized.attempts,
    );

  const mastery =
    masteryGap(
      normalized.masteryScore,
    );

  let priority =
    recentAccuracyNeed *
      ADAPTIVE_WEIGHTS.RECENT_ACCURACY +
    overallAccuracyNeed *
      ADAPTIVE_WEIGHTS.OVERALL_ACCURACY +
    responseNeed *
      ADAPTIVE_WEIGHTS.RESPONSE_TIME +
    recency *
      ADAPTIVE_WEIGHTS.RECENCY +
    exposure *
      ADAPTIVE_WEIGHTS.EXPOSURE +
    mastery *
      ADAPTIVE_WEIGHTS.MASTERY_GAP;

  /*
   * Brand-new characters need enough exposure to become established.
   *
   * They receive a modest boost, but not enough to overwhelm a genuinely
   * struggling character.
   */
  if (
    normalized.attempts === 0
  ) {
    priority += 0.15;
  }

  /*
   * Adjust the strength of reinforcement according to learning pace.
   *
   * Mastery mode emphasizes weak material more heavily.
   */
  const paceMultiplier =
    {
      [LEARNING_PACE.RELAXED]: 0.85,
      [LEARNING_PACE.STANDARD]: 1,
      [LEARNING_PACE.FOCUSED]: 1.1,
      [LEARNING_PACE.MASTERY]: 1.2,
    }[
      learningPace
    ] ??
    1;

  priority *=
    paceMultiplier;

  return {
    priority: clamp(
      priority,
      0,
      1,
    ),

    recentAccuracy,
    overallAccuracy,
    responseTimeNeed:
      responseNeed,
    recencyNeed: recency,
    exposureNeed: exposure,
    masteryGap: mastery,
  };
}

/* =============================================================================
   Weakness Detection
   ============================================================================= */

/**
 * Determine whether a character should currently be considered weak.
 *
 * @param {Object|null} stat
 * @param {Object} options
 * @returns {boolean}
 */
function isWeakCharacter(
  stat,
  {
    learningPace =
      LEARNING_PACE.STANDARD,
  } = {},
) {
  const normalized =
    normalizeCharacterStat(
      stat,
    );

  const threshold =
    getProgressionThreshold(
      learningPace,
    );

  const mastery =
    clamp(
      toFiniteNumber(
        normalized.masteryScore,
      ),
      0,
      100,
    );

  const recentAccuracy =
    clamp(
      toFiniteNumber(
        normalized.recentAccuracy,
      ),
      0,
      1,
    );

  const overallAccuracy =
    normalized.attempts > 0
      ? calculateAccuracy(
          normalized.attempts,
          normalized.correct,
        )
      : 0;

  /*
   * A character can be weak either because its mastery is low or because
   * recent performance has deteriorated.
   */
  if (
    mastery <
    threshold
  ) {
    return true;
  }

  if (
    recentAccuracy < 0.75 &&
    normalized.attempts >= 3
  ) {
    return true;
  }

  if (
    overallAccuracy < 0.70 &&
    normalized.attempts >= 5
  ) {
    return true;
  }

  return false;
}

/**
 * Rank candidate characters by adaptive priority.
 *
 * @param {Array<Object>} candidates
 * @param {Object} options
 * @returns {Array<Object>}
 */
function rankCandidates(
  candidates = [],
  options = {},
) {
  if (
    !Array.isArray(candidates)
  ) {
    return [];
  }

  return candidates
    .map(
      (candidate) => {
        const stat =
          candidate.stat ??
          candidate;

        const analysis =
          calculateCharacterPriority(
            stat,
            options,
          );

        return {
          ...candidate,
          adaptive: analysis,
        };
      },
    )
    .sort(
      (
        first,
        second,
      ) =>
        second.adaptive.priority -
        first.adaptive.priority,
    );
}

/* =============================================================================
   Adaptive Selection
   ============================================================================= */

/**
 * Select a set of characters for an adaptive session.
 *
 * This function does not alter learner state.
 *
 * @param {Array<Object>} candidates
 * @param {Object} options
 * @returns {Array<Object>}
 */
function selectAdaptiveCharacters(
  candidates = [],
  {
    count = 4,
    currentTime = Date.now(),
    learningPace =
      LEARNING_PACE.STANDARD,
    includeNew = true,
  } = {},
) {
  if (
    !Array.isArray(candidates) ||
    candidates.length === 0
  ) {
    return [];
  }

  const ranked =
    rankCandidates(
      candidates,
      {
        currentTime,
        learningPace,
      },
    );

  const weak =
  ranked.filter(
    (candidate) => {
      const stat =
        candidate.stat ??
        candidate;

      if (
        !includeNew &&
        stat.attempts === 0
      ) {
        return false;
      }

      return isWeakCharacter(
        stat,
        {
          learningPace,
        },
      );
    },
  );

  const newCharacters =
    includeNew
      ? ranked.filter(
          (candidate) =>
            (
              candidate.stat ??
              candidate
            ).attempts === 0,
        )
      : [];

  const selected =
    [];

  /**
   * Add a candidate if it is not already selected.
   *
   * @param {Object} candidate
   */
  const addUnique = (
    candidate,
  ) => {
    if (
      selected.length >= count
    ) {
      return;
    }

    const alreadySelected =
      selected.some(
        (item) =>
          getCandidateKey(
            item,
          ) ===
          getCandidateKey(
            candidate,
          ),
      );

    if (
      !alreadySelected
    ) {
      selected.push(
        candidate,
      );
    }
  };

  /*
   * First priority:
   * genuinely weak characters.
   */
  weak.forEach(
    addUnique,
  );

  /*
   * Second priority:
   * recently/newly introduced material.
   */
  newCharacters.forEach(
    addUnique,
  );

  /*
 * Fill remaining slots using overall adaptive priority.
 *
 * When includeNew is false, completely unpracticed characters
 * must remain excluded from the final fill as well.
 */
ranked
  .filter(
    (candidate) =>
      includeNew ||
      (
        candidate.stat ??
        candidate
      ).attempts > 0,
  )
  .forEach(
    addUnique,
  );

  return selected.slice(
    0,
    count,
  );
}

/**
 * Get a stable candidate key.
 *
 * @param {Object} candidate
 * @returns {string}
 */
function getCandidateKey(
  candidate,
) {
  if (
    candidate &&
    typeof candidate ===
      "object"
  ) {
    if (
      typeof candidate.id ===
      "string"
    ) {
      return candidate.id;
    }

    if (
      typeof candidate.symbol ===
      "string"
    ) {
      return candidate.symbol;
    }

    if (
      typeof candidate.character ===
      "string"
    ) {
      return candidate.character;
    }
  }

  return String(
    candidate,
  );
}

/* =============================================================================
   Progression Readiness
   ============================================================================= */

/**
 * Determine whether a character is ready to support advancement.
 *
 * @param {Object|null} stat
 * @param {Object} options
 * @returns {boolean}
 */
function isReadyForProgression(
  stat,
  {
    learningPace =
      LEARNING_PACE.STANDARD,
    minimumAttempts = 5,
  } = {},
) {
  const normalized =
    normalizeCharacterStat(
      stat,
    );

  if (
    normalized.attempts <
    minimumAttempts
  ) {
    return false;
  }

  const threshold =
    getProgressionThreshold(
      learningPace,
    );

  const mastery =
    clamp(
      toFiniteNumber(
        normalized.masteryScore,
      ),
      0,
      100,
    );

  const recentAccuracy =
    clamp(
      toFiniteNumber(
        normalized.recentAccuracy,
      ),
      0,
      1,
    );

  return (
    mastery >= threshold &&
    recentAccuracy >=
      0.80
  );
}

/**
 * Determine whether a collection of characters is ready for advancement.
 *
 * @param {Array<Object>} stats
 * @param {Object} options
 * @returns {boolean}
 */
function isReadyForNextMaterial(
  stats = [],
  options = {},
) {
  if (
    !Array.isArray(stats) ||
    stats.length === 0
  ) {
    return false;
  }

  return stats.every(
    (stat) =>
      isReadyForProgression(
        stat,
        options,
      ),
  );
}

/* =============================================================================
   Reinforcement
   ============================================================================= */

/**
 * Select characters specifically for reinforcement.
 *
 * Unlike normal adaptive selection, this intentionally excludes completely
 * unpracticed material. Reinforcement is for characters the learner has
 * already encountered.
 *
 * @param {Array<Object>} candidates
 * @param {Object} options
 * @returns {Array<Object>}
 */
function selectReinforcementCharacters(
  candidates = [],
  {
    count = 4,
    currentTime = Date.now(),
    learningPace =
      LEARNING_PACE.STANDARD,
  } = {},
) {
  if (
    !Array.isArray(candidates)
  ) {
    return [];
  }

  const practiced =
    candidates.filter(
      (candidate) =>
        (
          candidate.stat ??
          candidate
        ).attempts > 0,
    );

  return selectAdaptiveCharacters(
    practiced,
    {
      count,
      currentTime,
      learningPace,
      includeNew: false,
    },
  );
}

/* =============================================================================
   Public Helpers
   ============================================================================= */

/**
 * Return a human-readable mastery level.
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
    MASTERY_LEVELS.UNFAMILIAR
  ) {
    return "unfamiliar";
  }

  if (
    score <=
    MASTERY_LEVELS.LEARNING
  ) {
    return "learning";
  }

  if (
    score <=
    MASTERY_LEVELS.DEVELOPING
  ) {
    return "developing";
  }

  if (
    score <=
    MASTERY_LEVELS.COMFORTABLE
  ) {
    return "comfortable";
  }

  return "strong";
}

/**
 * Return all adaptive configuration values.
 *
 * Useful for diagnostics and tests.
 *
 * @returns {Object}
 */
function getAdaptiveConfig() {
  return {
    weights: {
      ...ADAPTIVE_WEIGHTS,
    },

    responseTime: {
      ...RESPONSE_TIME,
    },

    recency: {
      ...RECENCY,
    },

    exposure: {
      ...EXPOSURE,
    },

    masteryLevels: {
      ...MASTERY_LEVELS,
    },

    progressionThresholds: {
      ...PROGRESSION_THRESHOLDS,
    },
  };
}

/* =============================================================================
   Exports
   ============================================================================= */

export {
  LEARNING_PACE,
  ADAPTIVE_WEIGHTS,
  DEFAULT_CHARACTER_STAT,
  RESPONSE_TIME,
  RECENCY,
  EXPOSURE,
  MASTERY_LEVELS,
  PROGRESSION_THRESHOLDS,

  clamp,
  calculateAccuracy,
  normalizeCharacterStat,
  responseTimeNeed,
  recencyNeed,
  exposureNeed,
  masteryGap,

  getProgressionThreshold,
  calculateCharacterPriority,
  isWeakCharacter,
  rankCandidates,
  selectAdaptiveCharacters,
  selectReinforcementCharacters,

  isReadyForProgression,
  isReadyForNextMaterial,

  getMasteryLevel,
  getAdaptiveConfig,
};

export default {
  calculateCharacterPriority,
  isWeakCharacter,
  selectAdaptiveCharacters,
  selectReinforcementCharacters,
  isReadyForProgression,
  isReadyForNextMaterial,
};