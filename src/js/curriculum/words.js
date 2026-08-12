/**
 * =============================================================================
 * EduDit
 * Word Curriculum
 * =============================================================================
 *
 * Word-specific curriculum helpers.
 *
 * Responsibilities:
 *
 * - Provide access to curriculum words.
 * - Filter words by learner-available characters.
 * - Filter words by difficulty and metadata.
 * - Provide word lookup helpers.
 *
 * This module does NOT:
 *
 * - Track which words the learner has mastered.
 * - Decide when word training becomes available.
 * - Select adaptive word practice.
 * - Record word-training statistics.
 * - Persist learner data.
 *
 * Those responsibilities belong to progression, mastery, adaptive, training,
 * and persistence modules.
 * =============================================================================
 */

import curriculum, {
  CURRICULUM_CATEGORIES,
} from "./curriculum.js";

/* =============================================================================
   Constants
   ============================================================================= */

const WORD_CATEGORY =
  CURRICULUM_CATEGORIES.WORDS;

/* =============================================================================
   Word Access
   ============================================================================= */

/**
 * Return every word in curriculum order.
 *
 * @returns {Object[]}
 */
function getWords() {
  return curriculum.getWords();
}

/**
 * Return the number of words currently defined.
 *
 * @returns {number}
 */
function getWordCount() {
  return curriculum.getItemCount(
    WORD_CATEGORY,
  );
}

/**
 * Find a word by its curriculum ID.
 *
 * @param {string} id
 * @returns {Object|null}
 */
function getWordById(id) {
  if (
    typeof id !== "string" ||
    id.length === 0
  ) {
    return null;
  }

  return (
    getWords().find(
      (word) => word.id === id,
    ) ?? null
  );
}

/**
 * Find a word by its displayed symbol/text.
 *
 * Matching is case-insensitive.
 *
 * @param {string} symbol
 * @returns {Object|null}
 */
function getWord(symbol) {
  if (
    typeof symbol !== "string" ||
    symbol.length === 0
  ) {
    return null;
  }

  const normalized =
    symbol.trim().toUpperCase();

  return (
    getWords().find(
      (word) =>
        word.symbol.toUpperCase() ===
        normalized,
    ) ?? null
  );
}

/**
 * Determine whether a word exists in the curriculum.
 *
 * @param {string} symbol
 * @returns {boolean}
 */
function hasWord(symbol) {
  return getWord(symbol) !== null;
}

/* =============================================================================
   Character Constraints
   ============================================================================= */

/**
 * Extract the non-space characters from a word.
 *
 * This helper intentionally works with the displayed word rather than Morse
 * encoding. Morse encoding belongs to the Morse engine.
 *
 * @param {string} word
 * @returns {string[]}
 */
function getWordCharacters(word) {
  if (
    typeof word !== "string"
  ) {
    return [];
  }

  return word
    .toUpperCase()
    .replace(/\s/g, "")
    .split("");
}

/**
 * Determine whether a word can be formed using a supplied character set.
 *
 * Example:
 *
 *   canFormWord("TEA", ["T", "E", "A"]) → true
 *
 * @param {string|Object} word
 * @param {string[]} availableCharacters
 * @returns {boolean}
 */
function canFormWord(
  word,
  availableCharacters,
) {
  if (
    !Array.isArray(
      availableCharacters,
    )
  ) {
    return false;
  }

  const wordText =
    typeof word === "string"
      ? word
      : word?.symbol;

  if (
    typeof wordText !== "string" ||
    wordText.length === 0
  ) {
    return false;
  }

  const allowedCharacters =
    new Set(
      availableCharacters
        .map((character) =>
          String(character)
            .trim()
            .toUpperCase(),
        )
        .filter(Boolean),
    );

  return getWordCharacters(
    wordText,
  ).every((character) =>
    allowedCharacters.has(
      character,
    ),
  );
}

/**
 * Return words that can be formed using only the supplied characters.
 *
 * The returned words remain in authoritative curriculum order.
 *
 * @param {string[]} availableCharacters
 * @returns {Object[]}
 */
function getWordsForCharacters(
  availableCharacters,
) {
  if (
    !Array.isArray(
      availableCharacters,
    )
  ) {
    throw new TypeError(
      "Available characters must be provided as an array.",
    );
  }

  return getWords().filter(
    (word) =>
      canFormWord(
        word,
        availableCharacters,
      ),
  );
}

/* =============================================================================
   Word Length
   ============================================================================= */

/**
 * Return the number of non-space characters in a word.
 *
 * @param {string|Object} word
 * @returns {number}
 */
function getWordLength(word) {
  const wordText =
    typeof word === "string"
      ? word
      : word?.symbol;

  if (
    typeof wordText !== "string"
  ) {
    return 0;
  }

  return getWordCharacters(
    wordText,
  ).length;
}

/**
 * Return words within a specified length range.
 *
 * @param {number} minimumLength
 * @param {number} maximumLength
 * @returns {Object[]}
 */
function getWordsByLength(
  minimumLength,
  maximumLength = minimumLength,
) {
  if (
    !Number.isInteger(
      minimumLength,
    ) ||
    !Number.isInteger(
      maximumLength,
    ) ||
    minimumLength < 1 ||
    maximumLength < minimumLength
  ) {
    return [];
  }

  return getWords().filter(
    (word) => {
      const length =
        getWordLength(word);

      return (
        length >= minimumLength &&
        length <= maximumLength
      );
    },
  );
}

/* =============================================================================
   Difficulty
   ============================================================================= */

/**
 * Return words matching a curriculum difficulty.
 *
 * Difficulty is curriculum metadata and does not represent learner mastery.
 *
 * @param {number|string} difficulty
 * @returns {Object[]}
 */
function getWordsByDifficulty(
  difficulty,
) {
  return getWords().filter(
    (word) =>
      word.difficulty ===
      difficulty,
  );
}

/**
 * Return words up to a specified difficulty.
 *
 * @param {number} maximumDifficulty
 * @returns {Object[]}
 */
function getWordsUpToDifficulty(
  maximumDifficulty,
) {
  if (
    typeof maximumDifficulty !==
      "number" ||
    !Number.isFinite(
      maximumDifficulty,
    )
  ) {
    return [];
  }

  return getWords().filter(
    (word) =>
      typeof word.difficulty ===
        "number" &&
      word.difficulty <=
        maximumDifficulty,
  );
}

/* =============================================================================
   Frequency / Metadata
   ============================================================================= */

/**
 * Return words matching a frequency classification.
 *
 * The curriculum may eventually use values such as:
 *
 *   very-common
 *   common
 *   normal
 *   uncommon
 *
 * No assumptions are made here about the final vocabulary taxonomy.
 *
 * @param {string} frequency
 * @returns {Object[]}
 */
function getWordsByFrequency(
  frequency,
) {
  if (
    typeof frequency !== "string" ||
    frequency.length === 0
  ) {
    return [];
  }

  return getWords().filter(
    (word) =>
      word.frequency ===
      frequency,
  );
}

/* =============================================================================
   Filtering
   ============================================================================= */

/**
 * Filter words using a caller-supplied predicate.
 *
 * This is useful for future adaptive selection without putting adaptive logic
 * inside the curriculum layer.
 *
 * @param {Function} predicate
 * @returns {Object[]}
 */
function filterWords(
  predicate,
) {
  if (
    typeof predicate !== "function"
  ) {
    throw new TypeError(
      "Word filter predicate must be a function.",
    );
  }

  return getWords().filter(predicate);
}

/**
 * Return words satisfying multiple curriculum constraints.
 *
 * This helper is intentionally generic. It allows future callers to combine
 * character, length, and difficulty constraints without duplicating filtering
 * logic.
 *
 * @param {Object} options
 * @returns {Object[]}
 */
function queryWords({
  availableCharacters = null,
  minimumLength = null,
  maximumLength = null,
  difficulty = null,
  maximumDifficulty = null,
  frequency = null,
} = {}) {
  return getWords().filter(
    (word) => {
      if (
        availableCharacters !==
          null &&
        !canFormWord(
          word,
          availableCharacters,
        )
      ) {
        return false;
      }

      const length =
        getWordLength(word);

      if (
        minimumLength !== null &&
        length <
          minimumLength
      ) {
        return false;
      }

      if (
        maximumLength !== null &&
        length >
          maximumLength
      ) {
        return false;
      }

      if (
        difficulty !== null &&
        word.difficulty !==
          difficulty
      ) {
        return false;
      }

      if (
        maximumDifficulty !==
          null &&
        (
          typeof word.difficulty !==
            "number" ||
          word.difficulty >
            maximumDifficulty
        )
      ) {
        return false;
      }

      if (
        frequency !== null &&
        word.frequency !==
          frequency
      ) {
        return false;
      }

      return true;
    },
  );
}

/* =============================================================================
   Normalization
   ============================================================================= */

/**
 * Normalize a word for comparison.
 *
 * This does not modify the curriculum item.
 *
 * @param {string} word
 * @returns {string}
 */
function normalizeWord(word) {
  if (
    typeof word !== "string"
  ) {
    return "";
  }

  return word
    .trim()
    .toUpperCase();
}

/**
 * Compare two words without regard to case or surrounding whitespace.
 *
 * @param {string} first
 * @param {string} second
 * @returns {boolean}
 */
function wordsEqual(
  first,
  second,
) {
  return (
    normalizeWord(first) ===
    normalizeWord(second)
  );
}

/* =============================================================================
   Exports
   ============================================================================= */

export {
  WORD_CATEGORY,

  getWords,
  getWordCount,
  getWordById,
  getWord,
  hasWord,

  getWordCharacters,
  canFormWord,
  getWordsForCharacters,

  getWordLength,
  getWordsByLength,

  getWordsByDifficulty,
  getWordsUpToDifficulty,

  getWordsByFrequency,

  filterWords,
  queryWords,

  normalizeWord,
  wordsEqual,
};