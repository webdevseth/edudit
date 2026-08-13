import { beforeAll, describe, expect, it } from "vitest";

import curriculum, {
  CurriculumManager,
  CURRICULUM_CATEGORIES,
  CURRICULUM_VERSION,
  isValidCategory,
  isValidItem,
  isValidCurriculum,
} from "../../src/js/curriculum/curriculum.js";

import {
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
} from "../../src/js/curriculum/characters.js";

import {
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
} from "../../src/js/curriculum/words.js";

import {
  PUNCTUATION_CATEGORY,
  getPunctuation,
  getPunctuationCount,
  getPunctuationItem,
  getPunctuationById,
  hasPunctuation,
  getPunctuationBySymbols,
  areValidPunctuation,
  normalizePunctuationSymbols,
  getPunctuationByDifficulty,
  getPunctuationUpToDifficulty,
  getPunctuationByMorse,
  hasMorseSequence,
  filterPunctuation,
  queryPunctuation,
} from "../../src/js/curriculum/punctuation.js";


/* ============================================================================
   Test Curriculum Fixture
   ========================================================================== */

const TEST_CURRICULUM = {
  version: CURRICULUM_VERSION,

  categories: {
    [CURRICULUM_CATEGORIES.LETTERS]: [
      {
        id: "K",
        symbol: "K",
        morse: "-.-",
        category: "letters",
        difficulty: 1,
      },
      {
        id: "M",
        symbol: "M",
        morse: "--",
        category: "letters",
        difficulty: 1,
      },
      {
        id: "A",
        symbol: "A",
        morse: ".-",
        category: "letters",
        difficulty: 2,
      },
      {
        id: "T",
        symbol: "T",
        morse: "-",
        category: "letters",
        difficulty: 2,
      },
      {
        id: "E",
        symbol: "E",
        morse: ".",
        category: "letters",
        difficulty: 3,
      },
    ],

    [CURRICULUM_CATEGORIES.NUMBERS]: [
      {
        id: "1",
        symbol: "1",
        morse: ".----",
        category: "numbers",
        difficulty: 3,
      },
    ],

    [CURRICULUM_CATEGORIES.PUNCTUATION]: [
      {
        id: "PERIOD",
        symbol: ".",
        morse: ".-.-.-",
        category: "punctuation",
        difficulty: 1,
      },
      {
        id: "QUESTION",
        symbol: "?",
        morse: "..--..",
        category: "punctuation",
        difficulty: 2,
      },
      {
        id: "COMMA",
        symbol: ",",
        morse: "--..--",
        category: "punctuation",
        difficulty: 3,
      },
    ],

    [CURRICULUM_CATEGORIES.WORDS]: [
      {
        id: "TEA",
        symbol: "TEA",
        morse: "- . .-",
        category: "words",
        difficulty: 1,
        frequency: "common",
      },
      {
        id: "TEAM",
        symbol: "TEAM",
        morse: "- . .- --",
        category: "words",
        difficulty: 2,
        frequency: "common",
      },
      {
        id: "MEET",
        symbol: "MEET",
        morse: "-- . . -",
        category: "words",
        difficulty: 3,
        frequency: "very-common",
      },
    ],

    [CURRICULUM_CATEGORIES.PHRASES]: [
      {
        id: "PHRASE-1",
        symbol: "MEET ME",
        morse: "-- . . - / -- .",
        category: "phrases",
        difficulty: 2,
      },
    ],
  },
};


/* ============================================================================
   Initialization
   ========================================================================== */

beforeAll(() => {
  if (!curriculum.isInitialized()) {
    curriculum.initialize(TEST_CURRICULUM);
  }
});


/* ============================================================================
   Curriculum Validation
   ========================================================================== */

describe("curriculum manager > validation", () => {
  it("defines all supported curriculum categories", () => {
    expect(CURRICULUM_CATEGORIES).toEqual({
      LETTERS: "letters",
      NUMBERS: "numbers",
      PUNCTUATION: "punctuation",
      WORDS: "words",
      PHRASES: "phrases",
    });
  });

  it("defines the current curriculum version", () => {
    expect(CURRICULUM_VERSION).toBe(1);
  });

  it("recognizes valid categories", () => {
    expect(isValidCategory("letters")).toBe(true);
    expect(isValidCategory("numbers")).toBe(true);
    expect(isValidCategory("punctuation")).toBe(true);
    expect(isValidCategory("words")).toBe(true);
    expect(isValidCategory("phrases")).toBe(true);
  });

  it("rejects unknown categories", () => {
    expect(isValidCategory("unknown")).toBe(false);
    expect(isValidCategory("")).toBe(false);
    expect(isValidCategory(null)).toBe(false);
    expect(isValidCategory(undefined)).toBe(false);
  });

  it("recognizes a valid curriculum item", () => {
    expect(
      isValidItem(TEST_CURRICULUM.categories.letters[0]),
    ).toBe(true);
  });

  it("rejects malformed curriculum items", () => {
    expect(isValidItem(null)).toBe(false);
    expect(isValidItem({})).toBe(false);
    expect(
      isValidItem({
        id: "X",
        symbol: "X",
        morse: ".-",
        category: "unknown",
      }),
    ).toBe(false);
  });

  it("recognizes a valid complete curriculum", () => {
    expect(isValidCurriculum(TEST_CURRICULUM)).toBe(true);
  });

  it("rejects a missing curriculum", () => {
    expect(isValidCurriculum(null)).toBe(false);
    expect(isValidCurriculum(undefined)).toBe(false);
  });

  it("rejects an incorrect curriculum version", () => {
    expect(
      isValidCurriculum({
        ...TEST_CURRICULUM,
        version: 999,
      }),
    ).toBe(false);
  });

  it("rejects a curriculum with missing categories", () => {
    const invalid = {
      ...TEST_CURRICULUM,
    };

    delete invalid.categories;

    expect(isValidCurriculum(invalid)).toBe(false);
  });

  it("rejects a curriculum with a missing category array", () => {
    const invalid = structuredClone(TEST_CURRICULUM);

    delete invalid.categories.words;

    expect(isValidCurriculum(invalid)).toBe(false);
  });
});


/* ============================================================================
   Curriculum Manager
   ========================================================================== */

describe("curriculum manager", () => {
  it("starts uninitialized when constructed directly", () => {
    const manager = new CurriculumManager();

    expect(manager.isInitialized()).toBe(false);
  });

  it("throws when accessing an uninitialized manager", () => {
    const manager = new CurriculumManager();

    expect(() => manager.getVersion()).toThrow();
    expect(() => manager.getItems("letters")).toThrow();
  });

  it("initializes with valid curriculum data", () => {
    const manager = new CurriculumManager();

    manager.initialize(TEST_CURRICULUM);

    expect(manager.isInitialized()).toBe(true);
    expect(manager.getVersion()).toBe(1);
  });

  it("rejects invalid curriculum data during initialization", () => {
    const manager = new CurriculumManager();

    expect(() => {
      manager.initialize({
        version: 1,
        categories: {},
      });
    }).toThrow();
  });

  it("does not reinitialize an already initialized manager", () => {
    const manager = new CurriculumManager();

    manager.initialize(TEST_CURRICULUM);

    expect(() => {
      manager.initialize({
        version: 999,
        categories: {},
      });
    }).not.toThrow();

    expect(manager.getVersion()).toBe(1);
  });

  it("returns every supported category", () => {
    expect(curriculum.getCategories()).toEqual([
      "letters",
      "numbers",
      "punctuation",
      "words",
      "phrases",
    ]);
  });

  it("returns items for a category", () => {
    expect(curriculum.getItems("letters")).toHaveLength(5);
    expect(curriculum.getItems("words")).toHaveLength(3);
  });

  it("returns a defensive copy of category items", () => {
    const letters = curriculum.getItems("letters");

    letters[0].symbol = "CHANGED";

    expect(
      curriculum.getItems("letters")[0].symbol,
    ).toBe("K");
  });

  it("returns category item counts", () => {
    expect(curriculum.getItemCount("letters")).toBe(5);
    expect(curriculum.getItemCount("numbers")).toBe(1);
    expect(curriculum.getItemCount("punctuation")).toBe(3);
    expect(curriculum.getItemCount("words")).toBe(3);
    expect(curriculum.getItemCount("phrases")).toBe(1);
  });

  it("rejects unknown categories", () => {
    expect(() => {
      curriculum.getItems("invalid");
    }).toThrow();
  });

  it("finds an item by ID", () => {
    expect(
      curriculum.getItemById("A"),
    ).toMatchObject({
      symbol: "A",
      morse: ".-",
    });
  });

  it("returns null for an unknown item ID", () => {
    expect(
      curriculum.getItemById("UNKNOWN"),
    ).toBeNull();
  });

  it("returns null for invalid item IDs", () => {
    expect(curriculum.getItemById("")).toBeNull();
    expect(curriculum.getItemById(null)).toBeNull();
    expect(curriculum.getItemById(undefined)).toBeNull();
  });

  it("finds an item by symbol", () => {
    expect(
      curriculum.getItemBySymbol("A"),
    ).toMatchObject({
      id: "A",
      morse: ".-",
    });
  });

  it("finds an item by Morse encoding", () => {
    expect(
      curriculum.getItemByMorse(".-"),
    ).toMatchObject({
      id: "A",
      symbol: "A",
    });
  });

  it("returns null when symbol lookup fails", () => {
    expect(
      curriculum.getItemBySymbol("UNKNOWN"),
    ).toBeNull();
  });

  it("returns null when Morse lookup fails", () => {
    expect(
      curriculum.getItemByMorse("......."),
    ).toBeNull();
  });

  it("returns characters in authoritative order", () => {
    expect(
      curriculum.getCharacters().map(
        (character) => character.symbol,
      ),
    ).toEqual([
      "K",
      "M",
      "A",
      "T",
      "E",
    ]);
  });

  it("gets a character by index", () => {
    expect(
      curriculum.getCharacterAt(2),
    ).toMatchObject({
      symbol: "A",
    });
  });

  it("returns null for an invalid character index", () => {
    expect(curriculum.getCharacterAt(-1)).toBeNull();
    expect(curriculum.getCharacterAt(999)).toBeNull();
    expect(curriculum.getCharacterAt("2")).toBeNull();
  });

  it("gets a character index by symbol", () => {
    expect(
      curriculum.getCharacterIndex("A"),
    ).toBe(2);
  });

  it("returns -1 for an unknown character", () => {
    expect(
      curriculum.getCharacterIndex("Z"),
    ).toBe(-1);
  });

  it("returns the first requested characters", () => {
    expect(
      curriculum.getFirstCharacters(3).map(
        (character) => character.symbol,
      ),
    ).toEqual([
      "K",
      "M",
      "A",
    ]);
  });

  it("returns no characters for an invalid count", () => {
    expect(curriculum.getFirstCharacters(0)).toEqual([]);
    expect(curriculum.getFirstCharacters(-1)).toEqual([]);
    expect(curriculum.getFirstCharacters("3")).toEqual([]);
  });

  it("returns category-specific accessors", () => {
    expect(curriculum.getNumbers()).toHaveLength(1);
    expect(curriculum.getPunctuation()).toHaveLength(3);
    expect(curriculum.getWords()).toHaveLength(3);
    expect(curriculum.getPhrases()).toHaveLength(1);
  });

  it("filters category items with a predicate", () => {
    expect(
      curriculum
        .filter(
          "letters",
          (item) => item.difficulty === 1,
        )
        .map((item) => item.symbol),
    ).toEqual([
      "K",
      "M",
    ]);
  });

  it("rejects a non-function curriculum filter", () => {
    expect(() => {
      curriculum.filter("letters", null);
    }).toThrow(TypeError);
  });

  it("filters items using an available character set", () => {
    expect(
      curriculum.getItemsUsingCharacters(
        ["T", "E", "A", "M"],
        "words",
      ).map((word) => word.symbol),
    ).toEqual([
      "TEA",
      "TEAM",
      "MEET",
    ]);
  });

  it("excludes words containing unavailable characters", () => {
    expect(
      curriculum.getItemsUsingCharacters(
        ["T", "E", "A"],
        "words",
      ).map((word) => word.symbol),
    ).toEqual([
      "TEA",
    ]);
  });

  it("rejects a non-array character collection", () => {
    expect(() => {
      curriculum.getItemsUsingCharacters(
        "TEAM",
        "words",
      );
    }).toThrow(TypeError);
  });

  it("returns a defensive curriculum snapshot", () => {
    const snapshot = curriculum.getSnapshot();

    snapshot.categories.letters[0].symbol = "CHANGED";

    expect(
      curriculum.getCharacters()[0].symbol,
    ).toBe("K");
  });

  it("returns a category summary", () => {
    expect(curriculum.getSummary()).toEqual({
      version: 1,
      categories: {
        letters: 5,
        numbers: 1,
        punctuation: 3,
        words: 3,
        phrases: 1,
      },
    });
  });
});


/* ============================================================================
   Character Curriculum
   ========================================================================== */

describe("character curriculum", () => {
  it("exposes the correct category", () => {
    expect(CHARACTER_CATEGORY).toBe("letters");
  });

  it("returns all characters", () => {
    expect(getCharacters()).toHaveLength(5);
  });

  it("returns the character count", () => {
    expect(getCharacterCount()).toBe(5);
  });

  it("finds characters case-insensitively", () => {
    expect(getCharacter("a")).toMatchObject({
      symbol: "A",
    });
  });

  it("returns null for an invalid character lookup", () => {
    expect(getCharacter("")).toBeNull();
    expect(getCharacter(null)).toBeNull();
  });

  it("gets a character index", () => {
    expect(getCharacterIndex("a")).toBe(2);
  });

  it("gets a character by index", () => {
    expect(getCharacterAt(0)).toMatchObject({
      symbol: "K",
    });
  });

  it("gets the first characters", () => {
    expect(
      getFirstCharacters(2).map(
        (character) => character.symbol,
      ),
    ).toEqual([
      "K",
      "M",
    ]);
  });

  it("gets characters by symbols", () => {
    expect(
      getCharactersBySymbols([
        "e",
        "a",
      ]).map(
        (character) => character.symbol,
      ),
    ).toEqual([
      "A",
      "E",
    ]);
  });

  it("rejects invalid character symbol collections", () => {
    expect(() => {
      getCharactersBySymbols(null);
    }).toThrow(TypeError);
  });

  it("gets characters before a character", () => {
    expect(
      getCharactersBefore("A").map(
        (character) => character.symbol,
      ),
    ).toEqual([
      "K",
      "M",
    ]);
  });

  it("gets characters through a character", () => {
    expect(
      getCharactersThrough("A").map(
        (character) => character.symbol,
      ),
    ).toEqual([
      "K",
      "M",
      "A",
    ]);
  });

  it("gets characters from a character onward", () => {
    expect(
      getCharactersFrom("A").map(
        (character) => character.symbol,
      ),
    ).toEqual([
      "A",
      "T",
      "E",
    ]);
  });

  it("returns an empty collection for an unknown boundary", () => {
    expect(getCharactersBefore("Z")).toEqual([]);
    expect(getCharactersThrough("Z")).toEqual([]);
    expect(getCharactersFrom("Z")).toEqual([]);
  });

  it("checks character existence", () => {
    expect(hasCharacter("A")).toBe(true);
    expect(hasCharacter("Z")).toBe(false);
  });

  it("determines curriculum order", () => {
    expect(comesBefore("K", "A")).toBe(true);
    expect(comesBefore("A", "K")).toBe(false);
  });

  it("returns false for invalid curriculum-order comparisons", () => {
    expect(comesBefore("Z", "A")).toBe(false);
    expect(comesBefore("A", "Z")).toBe(false);
  });

  it("validates character collections", () => {
    expect(
      areValidCharacters([
        "K",
        "A",
        "E",
      ]),
    ).toBe(true);

    expect(
      areValidCharacters([
        "K",
        "Z",
      ]),
    ).toBe(false);

    expect(areValidCharacters("KAE")).toBe(false);
  });

  it("normalizes character symbols in curriculum order", () => {
    expect(
      normalizeCharacterSymbols([
        "e",
        "a",
        "a",
        "K",
      ]),
    ).toEqual([
      "K",
      "A",
      "E",
    ]);
  });

  it("rejects invalid normalization input", () => {
    expect(() => {
      normalizeCharacterSymbols(null);
    }).toThrow(TypeError);
  });

  it("filters characters by difficulty", () => {
    expect(
      getCharactersByDifficulty(1).map(
        (character) => character.symbol,
      ),
    ).toEqual([
      "K",
      "M",
    ]);
  });

  it("returns the one-based character position", () => {
    expect(getCharacterPosition("K")).toBe(1);
    expect(getCharacterPosition("A")).toBe(3);
  });

  it("returns -1 for an unknown character position", () => {
    expect(getCharacterPosition("Z")).toBe(-1);
  });
});


/* ============================================================================
   Word Curriculum
   ========================================================================== */

describe("word curriculum", () => {
  it("exposes the correct category", () => {
    expect(WORD_CATEGORY).toBe("words");
  });

  it("returns all words", () => {
    expect(getWords()).toHaveLength(3);
  });

  it("returns the word count", () => {
    expect(getWordCount()).toBe(3);
  });

  it("finds a word by ID", () => {
    expect(getWordById("TEA")).toMatchObject({
      symbol: "TEA",
    });
  });

  it("returns null for an unknown word ID", () => {
    expect(getWordById("UNKNOWN")).toBeNull();
  });

  it("finds words case-insensitively", () => {
    expect(getWord(" tea ")).toMatchObject({
      id: "TEA",
    });
  });

  it("checks word existence", () => {
    expect(hasWord("TEAM")).toBe(true);
    expect(hasWord("NOPE")).toBe(false);
  });

  it("extracts characters from a word", () => {
    expect(
      getWordCharacters("MEET ME"),
    ).toEqual([
      "M",
      "E",
      "E",
      "T",
      "M",
      "E",
    ]);
  });

  it("returns an empty character list for invalid input", () => {
    expect(getWordCharacters(null)).toEqual([]);
  });

  it("determines whether a word can be formed", () => {
    expect(
      canFormWord("TEAM", [
        "T",
        "E",
        "A",
        "M",
      ]),
    ).toBe(true);

    expect(
      canFormWord("TEAM", [
        "T",
        "E",
        "A",
      ]),
    ).toBe(false);
  });

  it("accepts a curriculum word object in canFormWord", () => {
    const word = getWord("TEAM");

    expect(
      canFormWord(word, [
        "T",
        "E",
        "A",
        "M",
      ]),
    ).toBe(true);
  });

  it("rejects invalid available-character input", () => {
    expect(
      canFormWord("TEAM", null),
    ).toBe(false);
  });

  it("returns words that can be formed from available characters", () => {
    expect(
      getWordsForCharacters([
        "T",
        "E",
        "A",
      ]).map(
        (word) => word.symbol,
      ),
    ).toEqual([
      "TEA",
    ]);
  });

  it("rejects invalid word-character collections", () => {
    expect(() => {
      getWordsForCharacters(null);
    }).toThrow(TypeError);
  });

  it("calculates word length without spaces", () => {
    expect(getWordLength("MEET ME")).toBe(6);
    expect(getWordLength(getWord("TEAM"))).toBe(4);
  });

  it("returns zero length for invalid input", () => {
    expect(getWordLength(null)).toBe(0);
  });

  it("filters words by length", () => {
    expect(
      getWordsByLength(3).map(
        (word) => word.symbol,
      ),
    ).toEqual([
      "TEA",
    ]);

    expect(
      getWordsByLength(4).map(
        (word) => word.symbol,
      ),
    ).toEqual([
      "TEAM",
      "MEET",
    ]);
  });

  it("filters words by a length range", () => {
    expect(
      getWordsByLength(3, 4),
    ).toHaveLength(3);
  });

  it("returns no words for an invalid length range", () => {
    expect(getWordsByLength(0)).toEqual([]);
    expect(getWordsByLength(4, 3)).toEqual([]);
    expect(getWordsByLength("3")).toEqual([]);
  });

  it("filters words by difficulty", () => {
    expect(
      getWordsByDifficulty(2).map(
        (word) => word.symbol,
      ),
    ).toEqual([
      "TEAM",
    ]);
  });

  it("filters words up to a maximum difficulty", () => {
    expect(
      getWordsUpToDifficulty(2).map(
        (word) => word.symbol,
      ),
    ).toEqual([
      "TEA",
      "TEAM",
    ]);
  });

  it("returns no words for an invalid maximum difficulty", () => {
    expect(getWordsUpToDifficulty("2")).toEqual([]);
    expect(getWordsUpToDifficulty(Infinity)).toEqual([]);
  });

  it("filters words by frequency", () => {
    expect(
      getWordsByFrequency("common").map(
        (word) => word.symbol,
      ),
    ).toEqual([
      "TEA",
      "TEAM",
    ]);
  });

  it("returns no words for an invalid frequency", () => {
    expect(getWordsByFrequency("")).toEqual([]);
    expect(getWordsByFrequency(null)).toEqual([]);
  });

  it("filters words with a custom predicate", () => {
    expect(
      filterWords(
        (word) => word.symbol.startsWith("T"),
      ).map(
        (word) => word.symbol,
      ),
    ).toEqual([
      "TEA",
      "TEAM",
    ]);
  });

  it("rejects an invalid word predicate", () => {
    expect(() => {
      filterWords(null);
    }).toThrow(TypeError);
  });

  it("supports combined word queries", () => {
    expect(
      queryWords({
        availableCharacters: [
          "T",
          "E",
          "A",
          "M",
        ],
        minimumLength: 4,
        maximumDifficulty: 2,
        frequency: "common",
      }).map(
        (word) => word.symbol,
      ),
    ).toEqual([
      "TEAM",
    ]);
  });

  it("normalizes words for comparison", () => {
    expect(normalizeWord("  team ")).toBe("TEAM");
    expect(normalizeWord(null)).toBe("");
  });

  it("compares words without case or surrounding whitespace", () => {
    expect(wordsEqual(" team ", "TEAM")).toBe(true);
    expect(wordsEqual("TEAM", "MEET")).toBe(false);
  });
});


/* ============================================================================
   Punctuation Curriculum
   ========================================================================== */

describe("punctuation curriculum", () => {
  it("exposes the correct category", () => {
    expect(PUNCTUATION_CATEGORY).toBe("punctuation");
  });

  it("returns all punctuation", () => {
    expect(getPunctuation()).toHaveLength(3);
  });

  it("returns the punctuation count", () => {
    expect(getPunctuationCount()).toBe(3);
  });

  it("finds punctuation by symbol", () => {
    expect(
      getPunctuationItem("?"),
    ).toMatchObject({
      id: "QUESTION",
    });
  });

  it("finds punctuation by ID", () => {
    expect(
      getPunctuationById("COMMA"),
    ).toMatchObject({
      symbol: ",",
    });
  });

  it("returns null for invalid punctuation lookups", () => {
    expect(getPunctuationItem("")).toBeNull();
    expect(getPunctuationById("UNKNOWN")).toBeNull();
    expect(getPunctuationItem(null)).toBeNull();
  });

  it("checks punctuation existence", () => {
    expect(hasPunctuation("?")).toBe(true);
    expect(hasPunctuation("@")).toBe(false);
  });

  it("filters punctuation by symbols", () => {
    expect(
      getPunctuationBySymbols([
        "?",
        ".",
      ]).map(
        (item) => item.symbol,
      ),
    ).toEqual([
      ".",
      "?",
    ]);
  });

  it("rejects invalid punctuation collections", () => {
    expect(() => {
      getPunctuationBySymbols(null);
    }).toThrow(TypeError);
  });

  it("validates punctuation collections", () => {
    expect(
      areValidPunctuation([
        ".",
        "?",
      ]),
    ).toBe(true);

    expect(
      areValidPunctuation([
        ".",
        "@",
      ]),
    ).toBe(false);

    expect(
      areValidPunctuation(".?"),
    ).toBe(false);
  });

  it("normalizes punctuation symbols in curriculum order", () => {
    expect(
      normalizePunctuationSymbols([
        "?",
        ".",
        "?",
      ]),
    ).toEqual([
      ".",
      "?",
    ]);
  });

  it("rejects invalid punctuation normalization input", () => {
    expect(() => {
      normalizePunctuationSymbols(null);
    }).toThrow(TypeError);
  });

  it("filters punctuation by difficulty", () => {
    expect(
      getPunctuationByDifficulty(2).map(
        (item) => item.symbol,
      ),
    ).toEqual([
      "?",
    ]);
  });

  it("filters punctuation up to a difficulty", () => {
    expect(
      getPunctuationUpToDifficulty(2).map(
        (item) => item.symbol,
      ),
    ).toEqual([
      ".",
      "?",
    ]);
  });

  it("returns no punctuation for invalid maximum difficulty", () => {
    expect(
      getPunctuationUpToDifficulty("2"),
    ).toEqual([]);

    expect(
      getPunctuationUpToDifficulty(Infinity),
    ).toEqual([]);
  });

  it("finds punctuation by Morse encoding", () => {
    expect(
      getPunctuationByMorse("..--.."),
    ).toMatchObject({
      symbol: "?",
    });
  });

  it("checks punctuation Morse sequences", () => {
    expect(hasMorseSequence("..--..")).toBe(true);
    expect(hasMorseSequence("........")).toBe(false);
  });

  it("filters punctuation with a custom predicate", () => {
    expect(
      filterPunctuation(
        (item) => item.difficulty >= 2,
      ).map(
        (item) => item.symbol,
      ),
    ).toEqual([
      "?",
      ",",
    ]);
  });

  it("rejects an invalid punctuation predicate", () => {
    expect(() => {
      filterPunctuation(null);
    }).toThrow(TypeError);
  });

  it("supports combined punctuation queries", () => {
    expect(
      queryPunctuation({
        maximumDifficulty: 2,
      }).map(
        (item) => item.symbol,
      ),
    ).toEqual([
      ".",
      "?",
    ]);
  });

  it("supports exact difficulty queries", () => {
    expect(
      queryPunctuation({
        difficulty: 3,
      }).map(
        (item) => item.symbol,
      ),
    ).toEqual([
      ",",
    ]);
  });
});
