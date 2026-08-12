/**
 * =============================================================================
 * EduDit
 * Character Curriculum
 * =============================================================================
 *
 * Character-specific curriculum helpers.
 *
 * Responsibilities:
 *
 * - Provide access to the letter curriculum.
 * - Expose the authoritative Koch-style character sequence.
 * - Provide character lookup helpers.
 * - Provide utilities for working with character collections.
 *
 * This module does NOT:
 *
 * - Track learner progression.
 * - Track mastery.
 * - Decide what the learner should practice.
 * - Modify curriculum data.
 * - Persist learner data.
 *
 * Those responsibilities belong to the appropriate progression, mastery,
 * adaptive, training, and persistence modules.
 * =============================================================================
 */

import curriculum, {
  CURRICULUM_CATEGORIES,
} from "./curriculum.js";

/* =============================================================================
   Constants
   ============================================================================= */

/**
 * The initial Koch-inspired character progression.
 *
 * The actual ordering lives in curriculum.json.
 *
 * This module deliberately does not duplicate that ordering.
 */
const CHARACTER_CATEGORY =
  CURRICULUM_CATEGORIES.LETTERS;

/* =============================================================================
   Character Access
   ============================================================================= */

/**
 * Return every letter in authoritative curriculum order.
 *
 * @returns {Object[]}
 */
function getCharacters() {
  return curriculum.getItems(
    CHARACTER_CATEGORY,
  );
}

/**
 * Return the number of characters currently defined.
 *
 * @returns {number}
 */
function getCharacterCount() {
  return curriculum.getItemCount(
    CHARACTER_CATEGORY,
  );
}

/**
 * Find a character by its symbol.
 *
 * Matching is case-insensitive.
 *
 * @param {string} symbol
 * @returns {Object|null}
 */
function getCharacter(symbol) {
  if (
    typeof symbol !== "string" ||
    symbol.length === 0
  ) {
    return null;
  }

  const normalizedSymbol =
    symbol.trim().toUpperCase();

  return (
    getCharacters().find(
      (character) =>
        character.symbol ===
        normalizedSymbol,
    ) ?? null
  );
}

/**
 * Find the curriculum index of a character.
 *
 * @param {string} symbol
 * @returns {number}
 */
function getCharacterIndex(symbol) {
  if (
    typeof symbol !== "string" ||
    symbol.length === 0
  ) {
    return -1;
  }

  return curriculum.getCharacterIndex(
    symbol.trim().toUpperCase(),
  );
}

/**
 * Return a character at a specific curriculum index.
 *
 * @param {number} index
 * @returns {Object|null}
 */
function getCharacterAt(index) {
  return curriculum.getCharacterAt(
    index,
  );
}

/**
 * Return the first N characters in curriculum order.
 *
 * @param {number} count
 * @returns {Object[]}
 */
function getFirstCharacters(count) {
  return curriculum.getFirstCharacters(
    count,
  );
}

/* =============================================================================
   Character Collections
   ============================================================================= */

/**
 * Return characters whose symbols are contained in the supplied collection.
 *
 * The returned characters remain in authoritative curriculum order.
 *
 * @param {string[]} symbols
 * @returns {Object[]}
 */
function getCharactersBySymbols(
  symbols,
) {
  if (!Array.isArray(symbols)) {
    throw new TypeError(
      "Character symbols must be provided as an array.",
    );
  }

  const requestedSymbols =
    new Set(
      symbols
        .map((symbol) =>
          String(symbol)
            .trim()
            .toUpperCase(),
        )
        .filter(Boolean),
    );

  return getCharacters().filter(
    (character) =>
      requestedSymbols.has(
        character.symbol,
      ),
  );
}

/**
 * Return characters that appear before a specified character in the
 * curriculum sequence.
 *
 * The supplied character itself is not included.
 *
 * @param {string} symbol
 * @returns {Object[]}
 */
function getCharactersBefore(
  symbol,
) {
  const index =
    getCharacterIndex(symbol);

  if (index <= 0) {
    return [];
  }

  return getCharacters().slice(
    0,
    index,
  );
}

/**
 * Return characters that appear through a specified character in the
 * curriculum sequence.
 *
 * The supplied character is included.
 *
 * @param {string} symbol
 * @returns {Object[]}
 */
function getCharactersThrough(
  symbol,
) {
  const index =
    getCharacterIndex(symbol);

  if (index < 0) {
    return [];
  }

  return getCharacters().slice(
    0,
    index + 1,
  );
}

/**
 * Return characters beginning with a specified character.
 *
 * The supplied character is included.
 *
 * @param {string} symbol
 * @returns {Object[]}
 */
function getCharactersFrom(
  symbol,
) {
  const index =
    getCharacterIndex(symbol);

  if (index < 0) {
    return [];
  }

  return getCharacters().slice(index);
}

/* =============================================================================
   Curriculum Relationships
   ============================================================================= */

/**
 * Determine whether a character exists in the curriculum.
 *
 * @param {string} symbol
 * @returns {boolean}
 */
function hasCharacter(symbol) {
  return getCharacter(symbol) !== null;
}

/**
 * Determine whether one character occurs before another in the curriculum.
 *
 * This describes curriculum order only.
 * It does NOT mean that the learner has unlocked either character.
 *
 * @param {string} firstSymbol
 * @param {string} secondSymbol
 * @returns {boolean}
 */
function comesBefore(
  firstSymbol,
  secondSymbol,
) {
  const firstIndex =
    getCharacterIndex(firstSymbol);

  const secondIndex =
    getCharacterIndex(secondSymbol);

  if (
    firstIndex < 0 ||
    secondIndex < 0
  ) {
    return false;
  }

  return firstIndex < secondIndex;
}

/**
 * Determine whether a collection of characters is valid.
 *
 * @param {string[]} symbols
 * @returns {boolean}
 */
function areValidCharacters(
  symbols,
) {
  if (!Array.isArray(symbols)) {
    return false;
  }

  return symbols.every(
    (symbol) =>
      typeof symbol === "string" &&
      hasCharacter(symbol),
  );
}

/**
 * Remove duplicate characters while preserving curriculum order.
 *
 * @param {string[]} symbols
 * @returns {string[]}
 */
function normalizeCharacterSymbols(
  symbols,
) {
  if (!Array.isArray(symbols)) {
    throw new TypeError(
      "Character symbols must be provided as an array.",
    );
  }

  const requestedSymbols =
    new Set(
      symbols
        .map((symbol) =>
          String(symbol)
            .trim()
            .toUpperCase(),
        )
        .filter(Boolean),
    );

  return getCharacters()
    .filter((character) =>
      requestedSymbols.has(
        character.symbol,
      ),
    )
    .map(
      (character) =>
        character.symbol,
    );
}

/* =============================================================================
   Character Difficulty / Metadata
   ============================================================================= */

/**
 * Return characters matching a difficulty value.
 *
 * Difficulty is curriculum metadata.
 *
 * It must NOT be confused with learner mastery.
 *
 * @param {number} difficulty
 * @returns {Object[]}
 */
function getCharactersByDifficulty(
  difficulty,
) {
  if (
    typeof difficulty !== "number" ||
    !Number.isFinite(difficulty)
  ) {
    return [];
  }

  return getCharacters().filter(
    (character) =>
      character.difficulty ===
      difficulty,
  );
}

/**
 * Return the curriculum position of a character as a human-readable
 * one-based position.
 *
 * Example:
 *
 *   E → 1
 *   T → 2
 *
 * @param {string} symbol
 * @returns {number}
 */
function getCharacterPosition(
  symbol,
) {
  const index =
    getCharacterIndex(symbol);

  return index >= 0
    ? index + 1
    : -1;
}

/* =============================================================================
   Exports
   ============================================================================= */

export {
  CHARACTER_CATEGORY,

  getCharacters,
  getCharacterCount,
  getCharacter,
  getCharacterIndex,
  getCharacterAt,
  getFirstCharacters,

  getCharactersBySymbols,
  getCharactersBefore,
  getCharactersThrough,
  getCharactersFrom,

  hasCharacter,
  comesBefore,
  areValidCharacters,
  normalizeCharacterSymbols,

  getCharactersByDifficulty,
  getCharacterPosition,
};