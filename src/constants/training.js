/**
 * =============================================================================
 * EduDit
 * Training Constants
 * =============================================================================
 *
 * Centralized configuration for training behavior.
 *
 * Learning algorithms should consume these values rather than embedding
 * thresholds and weights throughout individual modules.
 * =============================================================================
 */


/* =============================================================================
   Learning Pace
   ============================================================================= */


/**
 * Controls how quickly new material is introduced.
 *
 * These values are intentionally descriptive rather than numerical so the
 * adaptive and progression engines can own the actual interpretation.
 */
const LEARNING_PACE = Object.freeze({
  RELAXED: "relaxed",
  STANDARD: "standard",
  FOCUSED: "focused",
  MASTERY: "mastery",
});


/**
 * Default learning pace.
 */
const DEFAULT_LEARNING_PACE = LEARNING_PACE.STANDARD;


/* =============================================================================
   Training Modes
   ============================================================================= */


/**
 * Adaptive:
 * EduDit determines what the learner should practice.
 *
 * Sequential:
 * Follows the curriculum progression more traditionally.
 *
 * Review Only:
 * Never introduces new material.
 */
const TRAINING_MODE = Object.freeze({
  ADAPTIVE: "adaptive",
  SEQUENTIAL: "sequential",
  REVIEW_ONLY: "review-only",
});


/**
 * Default training mode.
 */
const DEFAULT_TRAINING_MODE = TRAINING_MODE.ADAPTIVE;


/* =============================================================================
   Session Configuration
   ============================================================================= */


/**
 * Supported session lengths.
 *
 * These represent approximate numbers of attempts rather than minutes.
 * Keeping the session target attempt-based makes behavior predictable even
 * when audio or response times vary.
 */
const SESSION_LENGTH = Object.freeze({
  SHORT: 10,
  STANDARD: 20,
  LONG: 40,
});


/**
 * Default session length.
 */
const DEFAULT_SESSION_LENGTH = SESSION_LENGTH.STANDARD;


/**
 * Minimum and maximum supported session lengths.
 */
const MIN_SESSION_LENGTH = 5;
const MAX_SESSION_LENGTH = 100;


/* =============================================================================
   Progression Thresholds
   ============================================================================= */


/**
 * Minimum number of attempts before a character can contribute toward
 * progression.
 *
 * This prevents a learner from unlocking material after only a handful of
 * lucky answers.
 */
const MIN_ATTEMPTS_FOR_PROGRESSION = 5;


/**
 * Accuracy/mastery thresholds associated with each learning pace.
 *
 * The progression engine should use these values rather than hard-coding
 * percentages.
 */
const PROGRESSION_THRESHOLDS = Object.freeze({
  [LEARNING_PACE.RELAXED]: 70,
  [LEARNING_PACE.STANDARD]: 80,
  [LEARNING_PACE.FOCUSED]: 88,
  [LEARNING_PACE.MASTERY]: 95,
});


/* =============================================================================
   Mastery
   ============================================================================= */


/**
 * Mastery scale.
 *
 * Mastery remains a continuously changing score rather than a simple
 * learned/unlearned flag.
 */
const MASTERY_LEVELS = Object.freeze({
  UNFAMILIAR: {
    MIN: 0,
    MAX: 20,
  },

  LEARNING: {
    MIN: 21,
    MAX: 40,
  },

  DEVELOPING: {
    MIN: 41,
    MAX: 60,
  },

  COMFORTABLE: {
    MIN: 61,
    MAX: 80,
  },

  STRONG: {
    MIN: 81,
    MAX: 100,
  },
});


const MIN_MASTERY_SCORE = 0;
const MAX_MASTERY_SCORE = 100;


/**
 * Default mastery score for a character with no history.
 */
const DEFAULT_MASTERY_SCORE = 0;


/* =============================================================================
   Adaptive Learning
   ============================================================================= */


/**
 * Number of recent attempts used when evaluating short-term performance.
 */
const RECENT_ATTEMPT_WINDOW = 10;


/**
 * Number of recent attempts used when calculating a more stable performance
 * trend.
 */
const PERFORMANCE_HISTORY_WINDOW = 20;


/**
 * Relative weighting used by the adaptive engine.
 *
 * These are intentionally kept together so the algorithm can be tuned without
 * hunting through multiple files.
 *
 * The exact scoring formula belongs to adaptive.js.
 */
const ADAPTIVE_WEIGHTS = Object.freeze({
  RECENT_ACCURACY: 0.35,
  LONG_TERM_ACCURACY: 0.2,
  RESPONSE_TIME: 0.2,
  RECENCY: 0.15,
  EXPOSURE: 0.1,
});


/**
 * Maximum response time that meaningfully influences adaptive calculations.
 *
 * Raw response times can still be retained in history. This value is used
 * when calculating adaptive priority.
 */
const ADAPTIVE_RESPONSE_TIME_CAP_MS = 10000;


/**
 * Number of recent response-time observations to use.
 */
const RECENT_RESPONSE_TIME_WINDOW = 10;


/**
 * Percentage of observations trimmed from each side when calculating a
 * trimmed response-time mean.
 */
const RESPONSE_TIME_TRIM_RATIO = 0.1;


/* =============================================================================
   New Character Introduction
   ============================================================================= */


/**
 * Maximum number of new characters that may be introduced during one
 * session.
 *
 * This keeps adaptive learning from turning into a large block of new
 * material.
 */
const MAX_NEW_CHARACTERS_PER_SESSION = 2;


/**
 * Minimum number of practice attempts between new-character introductions.
 */
const MIN_ATTEMPTS_BETWEEN_NEW_CHARACTERS = 3;


/* =============================================================================
   Reinforcement
   ============================================================================= */


/**
 * Minimum mastery score below which a character becomes a candidate for
 * additional reinforcement.
 */
const REINFORCEMENT_MASTERY_THRESHOLD = 60;


/**
 * Maximum number of reinforcement characters in a normal session.
 */
const MAX_REINFORCEMENT_CHARACTERS = 4;


/* =============================================================================
   Hints
   ============================================================================= */


/**
 * Whether hints are enabled by default.
 */
const DEFAULT_HINTS_ENABLED = true;


/**
 * Whether hint usage should be recorded in attempt statistics.
 */
const TRACK_HINT_USAGE = true;


/* =============================================================================
   Exports
   ============================================================================= */


export {
  LEARNING_PACE,
  DEFAULT_LEARNING_PACE,

  TRAINING_MODE,
  DEFAULT_TRAINING_MODE,

  SESSION_LENGTH,
  DEFAULT_SESSION_LENGTH,
  MIN_SESSION_LENGTH,
  MAX_SESSION_LENGTH,

  MIN_ATTEMPTS_FOR_PROGRESSION,
  PROGRESSION_THRESHOLDS,

  MASTERY_LEVELS,
  MIN_MASTERY_SCORE,
  MAX_MASTERY_SCORE,
  DEFAULT_MASTERY_SCORE,

  RECENT_ATTEMPT_WINDOW,
  PERFORMANCE_HISTORY_WINDOW,
  ADAPTIVE_WEIGHTS,
  ADAPTIVE_RESPONSE_TIME_CAP_MS,
  RECENT_RESPONSE_TIME_WINDOW,
  RESPONSE_TIME_TRIM_RATIO,

  MAX_NEW_CHARACTERS_PER_SESSION,
  MIN_ATTEMPTS_BETWEEN_NEW_CHARACTERS,

  REINFORCEMENT_MASTERY_THRESHOLD,
  MAX_REINFORCEMENT_CHARACTERS,

  DEFAULT_HINTS_ENABLED,
  TRACK_HINT_USAGE,
};


export default {
  LEARNING_PACE,
  DEFAULT_LEARNING_PACE,

  TRAINING_MODE,
  DEFAULT_TRAINING_MODE,

  SESSION_LENGTH,
  DEFAULT_SESSION_LENGTH,
  MIN_SESSION_LENGTH,
  MAX_SESSION_LENGTH,

  MIN_ATTEMPTS_FOR_PROGRESSION,
  PROGRESSION_THRESHOLDS,

  MASTERY_LEVELS,
  MIN_MASTERY_SCORE,
  MAX_MASTERY_SCORE,
  DEFAULT_MASTERY_SCORE,

  RECENT_ATTEMPT_WINDOW,
  PERFORMANCE_HISTORY_WINDOW,
  ADAPTIVE_WEIGHTS,
  ADAPTIVE_RESPONSE_TIME_CAP_MS,
  RECENT_RESPONSE_TIME_WINDOW,
  RESPONSE_TIME_TRIM_RATIO,

  MAX_NEW_CHARACTERS_PER_SESSION,
  MIN_ATTEMPTS_BETWEEN_NEW_CHARACTERS,

  REINFORCEMENT_MASTERY_THRESHOLD,
  MAX_REINFORCEMENT_CHARACTERS,

  DEFAULT_HINTS_ENABLED,
  TRACK_HINT_USAGE,
};