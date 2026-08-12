/**
 * =============================================================================
 * EduDit
 * Progression Engine
 * =============================================================================
 *
 * Owns learner progression through the curriculum.
 *
 * This module answers:
 *
 *   "What material has this learner unlocked?"
 *
 * It does NOT answer:
 *
 *   "What should this learner practice right now?"
 *
 * That responsibility belongs to adaptive.js.
 *
 * Important architectural distinction:
 *
 *   Unlocked material
 *        ≠
 *   Currently selected material
 *        ≠
 *   Mastered material
 *        ≠
 *   Material currently needing practice
 *
 * The progression engine owns only the first concept.
 *
 * Progression is data-driven. It does not depend on lesson numbers being
 * hard-coded into UI components.
 * =============================================================================
 */

/* =============================================================================
   Imports
   ============================================================================= */

import {
  LEARNING_PACE,
  getProgressionThreshold,
  isReadyForProgression,
} from "./adaptive.js";

/* =============================================================================
   Constants
   ============================================================================= */

/**
 * Canonical progression field names.
 *
 * These names must remain consistent throughout EduDit.
 */
const PROGRESSION_FIELDS = Object.freeze({
  HIGHEST_UNLOCKED_CHARACTER:
    "highestUnlockedCharacter",

  HIGHEST_UNLOCKED_WORD_LEVEL:
    "highestUnlockedWordLevel",
});

/**
 * Default progression state for a new learner.
 *
 * No character is unlocked until the curriculum/progression layer introduces
 * the first character.
 */
const DEFAULT_PROGRESSION =
  Object.freeze({
    highestUnlockedCharacter:
      null,

    highestUnlockedWordLevel:
      null,
  });

/**
 * Number of characters that may initially be unlocked before the learner
 * begins proving readiness.
 *
 * This gives a new learner an actual starting point rather than requiring the
 * progression system to evaluate an empty statistics collection.
 */
const INITIAL_CHARACTER_COUNT = 2;

/* =============================================================================
   Utilities
   ============================================================================= */

/**
 * Create a defensive copy of progression state.
 *
 * @param {Object|null} progression
 * @returns {Object}
 */
function normalizeProgression(
  progression,
) {
  return {
    ...DEFAULT_PROGRESSION,
    ...(progression || {}),
  };
}

/**
 * Determine whether a value is a valid curriculum index.
 *
 * @param {*} value
 * @returns {boolean}
 */
function isValidIndex(
  value,
) {
  return (
    Number.isInteger(value) &&
    value >= 0
  );
}

/**
 * Clamp an index to a valid curriculum range.
 *
 * @param {number} index
 * @param {number} length
 * @returns {number}
 */
function clampIndex(
  index,
  length,
) {
  if (length <= 0) {
    return -1;
  }

  return Math.min(
    Math.max(0, index),
    length - 1,
  );
}

/**
 * Find the index of a material item.
 *
 * Supports common curriculum representations:
 *
 * - string
 * - { symbol: "K" }
 * - { character: "K" }
 * - { id: "character-k" }
 *
 * @param {Array} curriculum
 * @param {*} value
 * @returns {number}
 */
function findMaterialIndex(
  curriculum,
  value,
) {
  if (
    !Array.isArray(curriculum) ||
    curriculum.length === 0 ||
    value === null ||
    value === undefined
  ) {
    return -1;
  }

  const normalized =
    String(value).toUpperCase();

  return curriculum.findIndex(
    (item) => {
      if (
        typeof item ===
        "string"
      ) {
        return (
          item.toUpperCase() ===
          normalized
        );
      }

      if (
        !item ||
        typeof item !==
          "object"
      ) {
        return false;
      }

      const candidates = [
        item.symbol,
        item.character,
        item.id,
      ];

      return candidates.some(
        (candidate) =>
          candidate !==
            null &&
          candidate !==
            undefined &&
          String(
            candidate,
          ).toUpperCase() ===
            normalized,
      );
    },
  );
}

/**
 * Return the identifier represented by a curriculum item.
 *
 * @param {*} item
 * @returns {string|null}
 */
function getMaterialIdentifier(
  item,
) {
  if (
    typeof item ===
    "string"
  ) {
    return item;
  }

  if (
    !item ||
    typeof item !==
      "object"
  ) {
    return null;
  }

  return (
    item.symbol ??
    item.character ??
    item.id ??
    null
  );
}

/* =============================================================================
   Progression State
   ============================================================================= */

/**
 * Create a fresh progression state.
 *
 * @returns {Object}
 */
function createInitialProgression() {
  return {
    ...DEFAULT_PROGRESSION,
  };
}

/**
 * Determine whether a learner has unlocked any character material.
 *
 * @param {Object|null} progression
 * @returns {boolean}
 */
function hasUnlockedCharacters(
  progression,
) {
  const normalized =
    normalizeProgression(
      progression,
    );

  return (
    normalized.highestUnlockedCharacter !==
      null &&
    normalized.highestUnlockedCharacter !==
      undefined
  );
}

/**
 * Get the highest unlocked character index.
 *
 * Returns -1 when no character has been unlocked.
 *
 * @param {Object|null} progression
 * @param {Array} curriculum
 * @returns {number}
 */
function getHighestUnlockedIndex(
  progression,
  curriculum,
) {
  const normalized =
    normalizeProgression(
      progression,
    );

  if (
    !Array.isArray(
      curriculum,
    )
  ) {
    return -1;
  }

  return findMaterialIndex(
    curriculum,
    normalized.highestUnlockedCharacter,
  );
}

/**
 * Get all currently unlocked character material.
 *
 * @param {Object|null} progression
 * @param {Array} curriculum
 * @returns {Array}
 */
function getUnlockedCharacters(
  progression,
  curriculum,
) {
  if (
    !Array.isArray(
      curriculum,
    )
  ) {
    return [];
  }

  const highestIndex =
    getHighestUnlockedIndex(
      progression,
      curriculum,
    );

  if (
    highestIndex < 0
  ) {
    return [];
  }

  return curriculum
    .slice(
      0,
      highestIndex + 1,
    )
    .map(
      (item) =>
        typeof item ===
        "object"
          ? { ...item }
          : item,
    );
}

/* =============================================================================
   Unlocking
   ============================================================================= */

/**
 * Determine the material that should initially be unlocked.
 *
 * The first two curriculum characters are intentionally treated as the
 * learner's starting material. The exact Koch ordering belongs to the
 * curriculum data, not this module.
 *
 * @param {Array} curriculum
 * @returns {Array}
 */
function getInitialCharacters(
  curriculum,
) {
  if (
    !Array.isArray(
      curriculum,
    ) ||
    curriculum.length === 0
  ) {
    return [];
  }

  return curriculum
    .slice(
      0,
      INITIAL_CHARACTER_COUNT,
    )
    .map(
      (item) =>
        typeof item ===
        "object"
          ? { ...item }
          : item,
    );
}

/**
 * Initialize progression against a curriculum.
 *
 * This function is safe to call more than once. Once progression exists,
 * it will not relock the learner.
 *
 * @param {Object|null} progression
 * @param {Array} curriculum
 * @returns {Object}
 */
function initializeProgression(
  progression,
  curriculum,
) {
  const current =
    normalizeProgression(
      progression,
    );

  if (
    hasUnlockedCharacters(
      current,
    )
  ) {
    return current;
  }

  const initial =
    getInitialCharacters(
      curriculum,
    );

  if (
    initial.length === 0
  ) {
    return current;
  }

  const lastInitial =
    initial[
      initial.length - 1
    ];

  const identifier =
    getMaterialIdentifier(
      lastInitial,
    );

  return {
    ...current,

    highestUnlockedCharacter:
      identifier,
  };
}

/**
 * Determine the next character after the highest currently unlocked one.
 *
 * @param {Object|null} progression
 * @param {Array} curriculum
 * @returns {Object|string|null}
 */
function getNextCharacter(
  progression,
  curriculum,
) {
  if (
    !Array.isArray(
      curriculum,
    ) ||
    curriculum.length === 0
  ) {
    return null;
  }

  const highestIndex =
    getHighestUnlockedIndex(
      progression,
      curriculum,
    );

  const nextIndex =
    highestIndex < 0
      ? 0
      : highestIndex + 1;

  if (
    nextIndex >=
    curriculum.length
  ) {
    return null;
  }

  const item =
    curriculum[nextIndex];

  return typeof item ===
    "object"
    ? { ...item }
    : item;
}

/**
 * Unlock a specific character without ever moving progression backwards.
 *
 * This is useful when importing/restoring data or when a progression rule
 * explicitly determines a new unlock.
 *
 * @param {Object|null} progression
 * @param {*} character
 * @param {Array} curriculum
 * @returns {Object}
 */
function unlockCharacter(
  progression,
  character,
  curriculum,
) {
  const current =
    normalizeProgression(
      progression,
    );

  const requestedIndex =
    findMaterialIndex(
      curriculum,
      character,
    );

  if (
    requestedIndex < 0
  ) {
    throw new Error(
      `Cannot unlock character "${character}": it does not exist in the curriculum.`,
    );
  }

  const currentIndex =
    getHighestUnlockedIndex(
      current,
      curriculum,
    );

  /*
   * Never move the learner backwards.
   */
  if (
    requestedIndex <=
    currentIndex
  ) {
    return current;
  }

  const item =
    curriculum[
      requestedIndex
    ];

  return {
    ...current,

    highestUnlockedCharacter:
      getMaterialIdentifier(
        item,
      ),
  };
}

/**
 * Unlock exactly the next character.
 *
 * @param {Object|null} progression
 * @param {Array} curriculum
 * @returns {Object}
 */
function unlockNextCharacter(
  progression,
  curriculum,
) {
  const next =
    getNextCharacter(
      progression,
      curriculum,
    );

  if (
    next === null
  ) {
    return normalizeProgression(
      progression,
    );
  }

  return unlockCharacter(
    progression,
    getMaterialIdentifier(
      next,
    ),
    curriculum,
  );
}

/* =============================================================================
   Advancement
   ============================================================================= */

/**
 * Determine whether the learner's current material is ready for the next
 * character.
 *
 * @param {Array<Object>} characterStats
 * @param {Object} options
 * @returns {boolean}
 */
function isReadyToAdvance(
  characterStats = [],
  {
    learningPace =
      LEARNING_PACE.STANDARD,
    minimumAttempts = 5,
  } = {},
) {
  if (
    !Array.isArray(
      characterStats,
    ) ||
    characterStats.length === 0
  ) {
    return false;
  }

  return characterStats.every(
    (stat) =>
      isReadyForProgression(
        stat,
        {
          learningPace,
          minimumAttempts,
        },
      ),
  );
}

/**
 * Determine whether a learner should be introduced to another character.
 *
 * This keeps progression policy separate from session selection.
 *
 * @param {Object} options
 * @returns {boolean}
 */
function shouldIntroduceNewCharacter({
  progression,
  curriculum,
  characterStats = [],
  learningPace =
    LEARNING_PACE.STANDARD,
  minimumAttempts = 5,
} = {}) {
  if (
    !Array.isArray(
      curriculum,
    ) ||
    curriculum.length === 0
  ) {
    return false;
  }

  const next =
    getNextCharacter(
      progression,
      curriculum,
    );

  /*
   * No next character means the character curriculum is complete.
   */
  if (
    next === null
  ) {
    return false;
  }

  /*
   * If nothing has been unlocked yet, initialization should handle this.
   */
  if (
    characterStats.length ===
    0
  ) {
    return false;
  }

  return isReadyToAdvance(
    characterStats,
    {
      learningPace,
      minimumAttempts,
    },
  );
}

/**
 * Attempt to advance progression by one character.
 *
 * Returns the unchanged progression if the learner is not ready.
 *
 * @param {Object} options
 * @returns {Object}
 */
function advanceIfReady({
  progression,
  curriculum,
  characterStats = [],
  learningPace =
    LEARNING_PACE.STANDARD,
  minimumAttempts = 5,
} = {}) {
  const current =
    normalizeProgression(
      progression,
    );

  const ready =
    shouldIntroduceNewCharacter(
      {
        progression: current,
        curriculum,
        characterStats,
        learningPace,
        minimumAttempts,
      },
    );

  if (!ready) {
    return current;
  }

  return unlockNextCharacter(
    current,
    curriculum,
  );
}

/* =============================================================================
   Lesson / Material Selection
   ============================================================================= */

/**
 * Determine whether a character is unlocked.
 *
 * @param {Object|null} progression
 * @param {*} character
 * @param {Array} curriculum
 * @returns {boolean}
 */
function isCharacterUnlocked(
  progression,
  character,
  curriculum,
) {
  const highestIndex =
    getHighestUnlockedIndex(
      progression,
      curriculum,
    );

  const requestedIndex =
    findMaterialIndex(
      curriculum,
      character,
    );

  return (
    requestedIndex >= 0 &&
    requestedIndex <=
      highestIndex
  );
}

/**
 * Validate a requested practice target.
 *
 * This is important because manually selecting an old lesson must NEVER alter
 * progression.
 *
 * @param {Object} options
 * @returns {Object}
 */
function validatePracticeTarget({
  progression,
  curriculum,
  character,
} = {}) {
  const unlocked =
    isCharacterUnlocked(
      progression,
      character,
      curriculum,
    );

  if (!unlocked) {
    return {
      valid: false,
      reason:
        "character-locked",
    };
  }

  return {
    valid: true,
    reason: null,
  };
}

/**
 * Resolve a requested lesson/material into a safe practice target.
 *
 * This function does not change progression.
 *
 * @param {Object} options
 * @returns {Object|null}
 */
function resolvePracticeTarget({
  progression,
  curriculum,
  character,
} = {}) {
  const validation =
    validatePracticeTarget(
      {
        progression,
        curriculum,
        character,
      },
    );

  if (
    !validation.valid
  ) {
    return null;
  }

  const index =
    findMaterialIndex(
      curriculum,
      character,
    );

  if (
    index < 0
  ) {
    return null;
  }

  const item =
    curriculum[index];

  return {
    index,

    item:
      typeof item ===
      "object"
        ? { ...item }
        : item,

    identifier:
      getMaterialIdentifier(
        item,
      ),
  };
}

/* =============================================================================
   Progression Summary
   ============================================================================= */

/**
 * Return a concise progression summary.
 *
 * @param {Object} options
 * @returns {Object}
 */
function getProgressionSummary({
  progression,
  curriculum = [],
} = {}) {
  const normalized =
    normalizeProgression(
      progression,
    );

  const highestIndex =
    getHighestUnlockedIndex(
      normalized,
      curriculum,
    );

  const unlockedCount =
    highestIndex >= 0
      ? highestIndex + 1
      : 0;

  const totalCount =
    Array.isArray(
      curriculum,
    )
      ? curriculum.length
      : 0;

  const complete =
    totalCount > 0 &&
    unlockedCount >=
      totalCount;

  return {
    highestUnlockedCharacter:
      normalized.highestUnlockedCharacter,

    highestUnlockedIndex:
      highestIndex,

    unlockedCount,

    totalCount,

    complete,

    highestUnlockedWordLevel:
      normalized.highestUnlockedWordLevel,
  };
}

/* =============================================================================
   Progression Configuration
   ============================================================================= */

/**
 * Return progression configuration for a learning pace.
 *
 * @param {string} learningPace
 * @returns {Object}
 */
function getProgressionConfig(
  learningPace =
    LEARNING_PACE.STANDARD,
) {
  return {
    learningPace,

    masteryThreshold:
      getProgressionThreshold(
        learningPace,
      ),

    minimumAttempts: 5,
  };
}

/* =============================================================================
   Exports
   ============================================================================= */

export {
  PROGRESSION_FIELDS,
  DEFAULT_PROGRESSION,
  INITIAL_CHARACTER_COUNT,

  normalizeProgression,
  createInitialProgression,

  hasUnlockedCharacters,
  getHighestUnlockedIndex,
  getUnlockedCharacters,

  getInitialCharacters,
  getNextCharacter,

  initializeProgression,
  unlockCharacter,
  unlockNextCharacter,

  isReadyToAdvance,
  shouldIntroduceNewCharacter,
  advanceIfReady,

  isCharacterUnlocked,
  validatePracticeTarget,
  resolvePracticeTarget,

  getProgressionSummary,
  getProgressionConfig,

  findMaterialIndex,
  getMaterialIdentifier,
};

export default {
  initializeProgression,
  getNextCharacter,
  unlockCharacter,
  unlockNextCharacter,
  advanceIfReady,
  isCharacterUnlocked,
  resolvePracticeTarget,
  getProgressionSummary,
};