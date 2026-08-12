/**
 * =============================================================================
 * EduDit
 * Curriculum Manager
 * =============================================================================
 *
 * The authoritative access layer for EduDit curriculum data.
 *
 * Responsibilities:
 *
 * - Load and validate curriculum data.
 * - Provide access to curriculum categories.
 * - Provide access to curriculum stages/material.
 * - Provide consistent lookup methods for other modules.
 * - Keep curriculum structure separate from learner progression.
 *
 * This module does NOT:
 *
 * - Track what a learner has unlocked.
 * - Track mastery.
 * - Select adaptive practice.
 * - Record training statistics.
 * - Persist learner data.
 *
 * Those responsibilities belong to the progression, training, adaptive,
 * statistics, and persistence layers respectively.
 * =============================================================================
 */

/* =============================================================================
   Constants
   ============================================================================= */

const CURRICULUM_CATEGORIES = Object.freeze({
  LETTERS: "letters",
  NUMBERS: "numbers",
  PUNCTUATION: "punctuation",
  WORDS: "words",
  PHRASES: "phrases",
});

/**
 * Current curriculum schema version.
 *
 * This is separate from the application's persistence schema version.
 */
const CURRICULUM_VERSION = 1;

/* =============================================================================
   Validation Helpers
   ============================================================================= */

/**
 * Determine whether a value is a valid curriculum category.
 *
 * @param {*} category
 * @returns {boolean}
 */
function isValidCategory(category) {
  return Object.values(
    CURRICULUM_CATEGORIES,
  ).includes(category);
}

/**
 * Validate a curriculum item.
 *
 * Curriculum items are intentionally lightweight. Additional metadata can be
 * added later without changing the basic access API.
 *
 * @param {*} item
 * @returns {boolean}
 */
function isValidItem(item) {
  return Boolean(
    item &&
    typeof item === "object" &&
    typeof item.id === "string" &&
    item.id.length > 0 &&
    typeof item.symbol === "string" &&
    item.symbol.length > 0 &&
    typeof item.morse === "string" &&
    item.morse.length > 0 &&
    typeof item.category === "string" &&
    isValidCategory(item.category),
  );
}

/**
 * Validate an entire curriculum object.
 *
 * @param {*} curriculum
 * @returns {boolean}
 */
function isValidCurriculum(curriculum) {
  if (
    !curriculum ||
    typeof curriculum !== "object"
  ) {
    return false;
  }

  if (
    curriculum.version !==
    CURRICULUM_VERSION
  ) {
    return false;
  }

  if (
    !curriculum.categories ||
    typeof curriculum.categories !== "object"
  ) {
    return false;
  }

  return Object.values(
    CURRICULUM_CATEGORIES,
  ).every((category) => {
    const items =
      curriculum.categories[category];

    if (!Array.isArray(items)) {
      return false;
    }

    return items.every(isValidItem);
  });
}

/* =============================================================================
   Normalization
   ============================================================================= */

/**
 * Create a defensive copy of a curriculum item.
 *
 * Consumers should never be able to mutate the authoritative curriculum
 * object directly.
 *
 * @param {Object} item
 * @returns {Object}
 */
function cloneItem(item) {
  return {
    ...item,
  };
}

/**
 * Create a defensive copy of the entire curriculum.
 *
 * @param {Object} curriculum
 * @returns {Object}
 */
function cloneCurriculum(curriculum) {
  return {
    version: curriculum.version,

    categories: Object.fromEntries(
      Object.entries(
        curriculum.categories,
      ).map(([category, items]) => [
        category,
        items.map(cloneItem),
      ]),
    ),
  };
}

/* =============================================================================
   Curriculum Manager
   ============================================================================= */

class CurriculumManager {
  #curriculum = null;

  #initialized = false;

  /**
   * Initialize the curriculum manager.
   *
   * The actual curriculum data will be loaded by app initialization.
   *
   * @param {Object} curriculumData
   */
  initialize(curriculumData) {
    if (this.#initialized) {
      return;
    }

    if (
      !isValidCurriculum(
        curriculumData,
      )
    ) {
      throw new Error(
        "Invalid EduDit curriculum data.",
      );
    }

    this.#curriculum =
      cloneCurriculum(
        curriculumData,
      );

    this.#initialized = true;
  }

  /* ===========================================================================
     General Access
     =========================================================================== */

  /**
   * Determine whether the curriculum has been initialized.
   *
   * @returns {boolean}
   */
  isInitialized() {
    return this.#initialized;
  }

  /**
   * Return the curriculum schema version.
   *
   * @returns {number}
   */
  getVersion() {
    this.#requireInitialized();

    return this.#curriculum.version;
  }

  /**
   * Return all supported curriculum categories.
   *
   * @returns {string[]}
   */
  getCategories() {
    return Object.values(
      CURRICULUM_CATEGORIES,
    );
  }

  /**
   * Return all items in a category.
   *
   * @param {string} category
   * @returns {Object[]}
   */
  getItems(category) {
    this.#requireInitialized();

    this.#validateCategory(
      category,
    );

    return this.#curriculum.categories[
      category
    ].map(cloneItem);
  }

  /**
   * Return the number of items in a category.
   *
   * @param {string} category
   * @returns {number}
   */
  getItemCount(category) {
    this.#requireInitialized();

    this.#validateCategory(
      category,
    );

    return this.#curriculum.categories[
      category
    ].length;
  }

  /**
   * Find an item by its ID.
   *
   * @param {string} itemId
   * @returns {Object|null}
   */
  getItemById(itemId) {
    this.#requireInitialized();

    if (
      typeof itemId !== "string" ||
      itemId.length === 0
    ) {
      return null;
    }

    for (const category of this.getCategories()) {
      const item =
        this.#curriculum.categories[
          category
        ].find(
          (candidate) =>
            candidate.id === itemId,
        );

      if (item) {
        return cloneItem(item);
      }
    }

    return null;
  }

  /**
   * Find an item by its Morse symbol.
   *
   * @param {string} symbol
   * @returns {Object|null}
   */
  getItemBySymbol(symbol) {
    this.#requireInitialized();

    if (
      typeof symbol !== "string" ||
      symbol.length === 0
    ) {
      return null;
    }

    for (const category of this.getCategories()) {
      const item =
        this.#curriculum.categories[
          category
        ].find(
          (candidate) =>
            candidate.symbol === symbol,
        );

      if (item) {
        return cloneItem(item);
      }
    }

    return null;
  }

  /**
   * Find an item by its Morse encoding.
   *
   * @param {string} morse
   * @returns {Object|null}
   */
  getItemByMorse(morse) {
    this.#requireInitialized();

    if (
      typeof morse !== "string" ||
      morse.length === 0
    ) {
      return null;
    }

    for (const category of this.getCategories()) {
      const item =
        this.#curriculum.categories[
          category
        ].find(
          (candidate) =>
            candidate.morse === morse,
        );

      if (item) {
        return cloneItem(item);
      }
    }

    return null;
  }

  /* ===========================================================================
     Character Access
     =========================================================================== */

  /**
   * Return all letter characters in curriculum order.
   *
   * This order is authoritative for the initial Koch-style progression.
   *
   * Progression logic must decide how much of this sequence the learner has
   * unlocked. The curriculum itself simply defines the available sequence.
   *
   * @returns {Object[]}
   */
  getCharacters() {
    return this.getItems(
      CURRICULUM_CATEGORIES.LETTERS,
    );
  }

  /**
   * Return a character at a specific curriculum index.
   *
   * @param {number} index
   * @returns {Object|null}
   */
  getCharacterAt(index) {
    this.#requireInitialized();

    if (
      !Number.isInteger(index) ||
      index < 0
    ) {
      return null;
    }

    const characters =
      this.#curriculum.categories[
        CURRICULUM_CATEGORIES.LETTERS
      ];

    const character =
      characters[index];

    return character
      ? cloneItem(character)
      : null;
  }

  /**
   * Return the curriculum index of a character.
   *
   * @param {string} symbol
   * @returns {number}
   */
  getCharacterIndex(symbol) {
    this.#requireInitialized();

    if (
      typeof symbol !== "string" ||
      symbol.length === 0
    ) {
      return -1;
    }

    return this.#curriculum.categories[
      CURRICULUM_CATEGORIES.LETTERS
    ].findIndex(
      (character) =>
        character.symbol === symbol,
    );
  }

  /**
   * Return the first N characters in the curriculum sequence.
   *
   * This is useful for progression calculations without making progression
   * responsible for knowing the curriculum's internal ordering.
   *
   * @param {number} count
   * @returns {Object[]}
   */
  getFirstCharacters(count) {
    this.#requireInitialized();

    if (
      !Number.isInteger(count) ||
      count <= 0
    ) {
      return [];
    }

    return this.#curriculum.categories[
      CURRICULUM_CATEGORIES.LETTERS
    ]
      .slice(0, count)
      .map(cloneItem);
  }

  /* ===========================================================================
     Category-Specific Access
     =========================================================================== */

  /**
   * Return all numbers.
   *
   * @returns {Object[]}
   */
  getNumbers() {
    return this.getItems(
      CURRICULUM_CATEGORIES.NUMBERS,
    );
  }

  /**
   * Return all punctuation.
   *
   * @returns {Object[]}
   */
  getPunctuation() {
    return this.getItems(
      CURRICULUM_CATEGORIES.PUNCTUATION,
    );
  }

  /**
   * Return all words.
   *
   * @returns {Object[]}
   */
  getWords() {
    return this.getItems(
      CURRICULUM_CATEGORIES.WORDS,
    );
  }

  /**
   * Return all phrases.
   *
   * @returns {Object[]}
   */
  getPhrases() {
    return this.getItems(
      CURRICULUM_CATEGORIES.PHRASES,
    );
  }

  /* ===========================================================================
     Filtering
     =========================================================================== */

  /**
   * Return items matching a predicate.
   *
   * This is intentionally read-only. The curriculum manager never modifies
   * curriculum data based on learner performance.
   *
   * @param {string} category
   * @param {Function} predicate
   * @returns {Object[]}
   */
  filter(category, predicate) {
    this.#requireInitialized();

    this.#validateCategory(
      category,
    );

    if (
      typeof predicate !== "function"
    ) {
      throw new TypeError(
        "Curriculum filter predicate must be a function.",
      );
    }

    return this.#curriculum.categories[
      category
    ]
      .filter(predicate)
      .map(cloneItem);
  }

  /**
   * Return items containing only characters from a supplied vocabulary.
   *
   * This will become particularly useful for word selection later.
   *
   * Example:
   *
   *   getItemsUsingCharacters(
   *     ["E", "T", "A", "N"],
   *     "words"
   *   );
   *
   * @param {string[]} symbols
   * @param {string} category
   * @returns {Object[]}
   */
  getItemsUsingCharacters(
    symbols,
    category,
  ) {
    this.#requireInitialized();

    this.#validateCategory(
      category,
    );

    if (!Array.isArray(symbols)) {
      throw new TypeError(
        "Character symbols must be provided as an array.",
      );
    }

    const allowedSymbols =
      new Set(
        symbols.map((symbol) =>
          String(symbol).toUpperCase(),
        ),
      );

    return this.#curriculum.categories[
      category
    ]
      .filter((item) => {
        /*
         * Words and phrases are represented as normal text.
         *
         * Whitespace is ignored because it is not a character requirement.
         */
        const characters =
          item.symbol
            .toUpperCase()
            .replace(/\s/g, "")
            .split("");

        return characters.every(
          (character) =>
            allowedSymbols.has(
              character,
            ),
        );
      })
      .map(cloneItem);
  }

  /* ===========================================================================
     Export / Inspection
     =========================================================================== */

  /**
   * Return a complete defensive copy of the curriculum.
   *
   * This is primarily useful for diagnostics and tests.
   *
   * @returns {Object}
   */
  getSnapshot() {
    this.#requireInitialized();

    return cloneCurriculum(
      this.#curriculum,
    );
  }

  /**
   * Return a summary of the curriculum.
   *
   * @returns {Object}
   */
  getSummary() {
    this.#requireInitialized();

    return {
      version:
        this.#curriculum.version,

      categories:
        Object.fromEntries(
          this.getCategories().map(
            (category) => [
              category,
              this.getItemCount(
                category,
              ),
            ],
          ),
        ),
    };
  }

  /* ===========================================================================
     Internal Validation
     =========================================================================== */

  #validateCategory(category) {
    if (!isValidCategory(category)) {
      throw new Error(
        `Unknown curriculum category "${category}".`,
      );
    }
  }

  #requireInitialized() {
    if (!this.#initialized) {
      throw new Error(
        "Curriculum manager has not been initialized.",
      );
    }
  }
}

/* =============================================================================
   Singleton
   ============================================================================= */

const curriculum =
  new CurriculumManager();

/* =============================================================================
   Exports
   ============================================================================= */

export {
  CurriculumManager,
  CURRICULUM_CATEGORIES,
  CURRICULUM_VERSION,
  isValidCategory,
  isValidItem,
  isValidCurriculum,
};

export default curriculum;