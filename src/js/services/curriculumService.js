/**
 * =============================================================================
 * EduDit
 * Curriculum Service
 * =============================================================================
 *
 * Application-facing access layer for EduDit curriculum data.
 *
 * Responsibilities:
 *
 *   - Provide a stable API for retrieving curriculum material.
 *   - Keep feature modules independent from curriculum implementation details.
 *   - Expose characters, punctuation, words, and combined curriculum data.
 *   - Provide safe lookup helpers.
 *
 * This service does NOT:
 *
 *   - Modify learner progression.
 *   - Track mastery.
 *   - Select adaptive practice.
 *   - Persist learner data.
 *   - Own curriculum definitions.
 *
 * The authoritative curriculum remains in:
 *
 *   ../curriculum/characters.js
 *   ../curriculum/punctuation.js
 *   ../curriculum/words.js
 *   ../curriculum/curriculum.js
 * =============================================================================
 */

/* =============================================================================
   Imports
   ============================================================================= */

import curriculum, {
  getCurriculum,
  getCharacterCurriculum,
  getPunctuationCurriculum,
  getWordCurriculum,
} from "../curriculum/curriculum.js";

import * as characters from "../curriculum/characters.js";
import * as punctuation from "../curriculum/punctuation.js";
import * as words from "../curriculum/words.js";


/* =============================================================================
   Utilities
   ============================================================================= */

/**
 * Create a defensive copy of curriculum material.
 *
 * Feature modules should never receive a mutable reference to the canonical
 * curriculum arrays.
 *
 * @param {*} value
 * @returns {*}
 */
function clone(value) {
  if (Array.isArray(value)) {
    return value.map((item) =>
      item && typeof item === "object"
        ? { ...item }
        : item,
    );
  }

  if (value && typeof value === "object") {
    return { ...value };
  }

  return value;
}


/**
 * Normalize a curriculum identifier for comparison.
 *
 * @param {*} value
 * @returns {string|null}
 */
function normalizeIdentifier(value) {
  if (
    value === null ||
    value === undefined
  ) {
    return null;
  }

  return String(value)
    .trim()
    .toUpperCase();
}


/**
 * Get the identifier represented by a curriculum item.
 *
 * Supports the curriculum representations used throughout EduDit.
 *
 * @param {*} item
 * @returns {string|null}
 */
function getItemIdentifier(item) {
  if (typeof item === "string") {
    return item;
  }

  if (!item || typeof item !== "object") {
    return null;
  }

  return (
    item.symbol ??
    item.character ??
    item.id ??
    item.letter ??
    null
  );
}


/**
 * Find an item by identifier.
 *
 * @param {Array} source
 * @param {*} identifier
 * @returns {Object|string|null}
 */
function findInCollection(
  source,
  identifier,
) {
  if (!Array.isArray(source)) {
    return null;
  }

  const normalized =
    normalizeIdentifier(identifier);

  if (normalized === null) {
    return null;
  }

  const item = source.find(
    (candidate) =>
      normalizeIdentifier(
        getItemIdentifier(candidate),
      ) === normalized,
  );

  return item === undefined
    ? null
    : clone(item);
}


/* =============================================================================
   Curriculum Access
   ============================================================================= */

/**
 * Return the complete canonical curriculum.
 *
 * @returns {Array|Object}
 */
function getAllCurriculum() {
  return clone(
    typeof getCurriculum === "function"
      ? getCurriculum()
      : curriculum,
  );
}


/**
 * Return the character curriculum.
 *
 * @returns {Array}
 */
function getCharacters() {
  return clone(
    typeof getCharacterCurriculum ===
      "function"
      ? getCharacterCurriculum()
      : characters,
  );
}


/**
 * Return the punctuation curriculum.
 *
 * @returns {Array}
 */
function getPunctuation() {
  return clone(
    typeof getPunctuationCurriculum ===
      "function"
      ? getPunctuationCurriculum()
      : punctuation,
  );
}


/**
 * Return the word curriculum.
 *
 * @returns {Array}
 */
function getWords() {
  return clone(
    typeof getWordCurriculum ===
      "function"
      ? getWordCurriculum()
      : words,
  );
}


/* =============================================================================
   Counts
   ============================================================================= */

/**
 * Return curriculum counts.
 *
 * @returns {Object}
 */
function getCurriculumCounts() {
  const characterList = getCharacters();
  const punctuationList = getPunctuation();
  const wordList = getWords();

  return {
    characters: characterList.length,
    punctuation: punctuationList.length,
    words: wordList.length,
    total:
      characterList.length +
      punctuationList.length +
      wordList.length,
  };
}


/* =============================================================================
   Lookup
   ============================================================================= */

/**
 * Find a character by its identifier.
 *
 * @param {*} identifier
 * @returns {Object|string|null}
 */
function findCharacter(identifier) {
  return findInCollection(
    getCharacters(),
    identifier,
  );
}


/**
 * Find punctuation by its identifier.
 *
 * @param {*} identifier
 * @returns {Object|string|null}
 */
function findPunctuation(identifier) {
  return findInCollection(
    getPunctuation(),
    identifier,
  );
}


/**
 * Find a word by its identifier.
 *
 * @param {*} identifier
 * @returns {Object|string|null}
 */
function findWord(identifier) {
  return findInCollection(
    getWords(),
    identifier,
  );
}


/**
 * Find any curriculum item.
 *
 * Characters are searched first, followed by punctuation and words.
 *
 * @param {*} identifier
 * @returns {Object|string|null}
 */
function findItem(identifier) {
  const character =
    findCharacter(identifier);

  if (character !== null) {
    return character;
  }

  const punctuationItem =
    findPunctuation(identifier);

  if (punctuationItem !== null) {
    return punctuationItem;
  }

  return findWord(identifier);
}


/**
 * Determine whether a curriculum item exists.
 *
 * @param {*} identifier
 * @returns {boolean}
 */
function hasItem(identifier) {
  return findItem(identifier) !== null;
}


/* =============================================================================
   Index Helpers
   ============================================================================= */

/**
 * Find the index of an identifier in a collection.
 *
 * @param {Array} source
 * @param {*} identifier
 * @returns {number}
 */
function findIndex(
  source,
  identifier,
) {
  if (!Array.isArray(source)) {
    return -1;
  }

  const normalized =
    normalizeIdentifier(identifier);

  if (normalized === null) {
    return -1;
  }

  return source.findIndex(
    (item) =>
      normalizeIdentifier(
        getItemIdentifier(item),
      ) === normalized,
  );
}


/**
 * Find a character's curriculum index.
 *
 * @param {*} identifier
 * @returns {number}
 */
function findCharacterIndex(
  identifier,
) {
  return findIndex(
    getCharacters(),
    identifier,
  );
}


/**
 * Find a punctuation item's curriculum index.
 *
 * @param {*} identifier
 * @returns {number}
 */
function findPunctuationIndex(
  identifier,
) {
  return findIndex(
    getPunctuation(),
    identifier,
  );
}


/**
 * Find a word's curriculum index.
 *
 * @param {*} identifier
 * @returns {number}
 */
function findWordIndex(identifier) {
  return findIndex(
    getWords(),
    identifier,
  );
}


/* =============================================================================
   Material Classification
   ============================================================================= */

/**
 * Determine which curriculum collection contains an item.
 *
 * @param {*} identifier
 * @returns {"character"|"punctuation"|"word"|null}
 */
function getMaterialType(identifier) {
  if (
    findCharacter(identifier) !== null
  ) {
    return "character";
  }

  if (
    findPunctuation(identifier) !== null
  ) {
    return "punctuation";
  }

  if (
    findWord(identifier) !== null
  ) {
    return "word";
  }

  return null;
}


/**
 * Return a normalized curriculum descriptor.
 *
 * This gives feature modules a consistent representation without changing the
 * underlying curriculum data.
 *
 * @param {*} identifier
 * @returns {Object|null}
 */
function getMaterial(identifier) {
  const item = findItem(identifier);

  if (item === null) {
    return null;
  }

  return {
    type: getMaterialType(identifier),
    identifier: getItemIdentifier(item),
    item,
  };
}


/* =============================================================================
   Public API
   ============================================================================= */

const curriculumService = Object.freeze({
  getAllCurriculum,
  getCharacters,
  getPunctuation,
  getWords,

  getCurriculumCounts,

  findCharacter,
  findPunctuation,
  findWord,
  findItem,
  hasItem,

  findCharacterIndex,
  findPunctuationIndex,
  findWordIndex,

  getMaterialType,
  getMaterial,
});


/* =============================================================================
   Exports
   ============================================================================= */

export {
  getAllCurriculum,
  getCharacters,
  getPunctuation,
  getWords,

  getCurriculumCounts,

  findCharacter,
  findPunctuation,
  findWord,
  findItem,
  hasItem,

  findCharacterIndex,
  findPunctuationIndex,
  findWordIndex,

  getMaterialType,
  getMaterial,
};


export default curriculumService;