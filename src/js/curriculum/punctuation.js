 /**
  * =============================================================================
  * EduDit
  * Punctuation Curriculum
  * =============================================================================
  *
  * Punctuation-specific curriculum helpers.
  *
  * Responsibilities:
  *
  * - Provide access to punctuation curriculum items.
  * - Provide punctuation lookup helpers.
  * - Filter punctuation by difficulty.
  * - Provide utilities for working with punctuation collections.
  *
  * This module does NOT:
  *
  * - Decide when punctuation is unlocked.
  * - Track punctuation mastery.
  * - Select adaptive punctuation practice.
  * - Record learner statistics.
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

 const PUNCTUATION_CATEGORY =
   CURRICULUM_CATEGORIES.PUNCTUATION;

 /* =============================================================================
    Access
    ============================================================================= */

 /**
  * Return all punctuation items in authoritative curriculum order.
  *
  * @returns {Object[]}
  */
 function getPunctuation() {
   return curriculum.getPunctuation();
 }

 /**
  * Return the number of punctuation items currently defined.
  *
  * @returns {number}
  */
 function getPunctuationCount() {
   return curriculum.getItemCount(
     PUNCTUATION_CATEGORY,
   );
 }

 /**
  * Find punctuation by its symbol.
  *
  * @param {string} symbol
  * @returns {Object|null}
  */
 function getPunctuationItem(symbol) {
   if (
     typeof symbol !== "string" ||
     symbol.length === 0
   ) {
     return null;
   }

   const normalizedSymbol =
     symbol.trim();

   return (
     getPunctuation().find(
       (item) =>
         item.symbol ===
         normalizedSymbol,
     ) ?? null
   );
 }

 /**
  * Find punctuation by curriculum ID.
  *
  * @param {string} id
  * @returns {Object|null}
  */
 function getPunctuationById(id) {
   if (
     typeof id !== "string" ||
     id.length === 0
   ) {
     return null;
   }

   return (
     getPunctuation().find(
       (item) =>
         item.id === id,
     ) ?? null
   );
 }

 /**
  * Determine whether a punctuation symbol exists.
  *
  * @param {string} symbol
  * @returns {boolean}
  */
 function hasPunctuation(symbol) {
   return (
     getPunctuationItem(symbol) !==
     null
   );
 }

 /* =============================================================================
    Collections
    ============================================================================= */

 /**
  * Return punctuation matching the supplied symbols.
  *
  * Results remain in authoritative curriculum order.
  *
  * @param {string[]} symbols
  * @returns {Object[]}
  */
 function getPunctuationBySymbols(
   symbols,
 ) {
   if (!Array.isArray(symbols)) {
     throw new TypeError(
       "Punctuation symbols must be provided as an array.",
     );
   }

   const requestedSymbols =
     new Set(
       symbols
         .map((symbol) =>
           String(symbol).trim(),
         )
         .filter(Boolean),
     );

   return getPunctuation().filter(
     (item) =>
       requestedSymbols.has(
         item.symbol,
       ),
   );
 }

 /**
  * Determine whether every supplied symbol is valid punctuation.
  *
  * @param {string[]} symbols
  * @returns {boolean}
  */
 function areValidPunctuation(
   symbols,
 ) {
   if (!Array.isArray(symbols)) {
     return false;
   }

   return symbols.every(
     (symbol) =>
       typeof symbol === "string" &&
       hasPunctuation(symbol),
   );
 }

 /**
  * Normalize punctuation symbols.
  *
  * Removes surrounding whitespace and duplicate entries while preserving
  * curriculum order.
  *
  * @param {string[]} symbols
  * @returns {string[]}
  */
 function normalizePunctuationSymbols(
   symbols,
 ) {
   if (!Array.isArray(symbols)) {
     throw new TypeError(
       "Punctuation symbols must be provided as an array.",
     );
   }

   const requestedSymbols =
     new Set(
       symbols
         .map((symbol) =>
           String(symbol).trim(),
         )
         .filter(Boolean),
     );

   return getPunctuation()
     .filter((item) =>
       requestedSymbols.has(
         item.symbol,
       ),
     )
     .map(
       (item) =>
         item.symbol,
     );
 }

 /* =============================================================================
    Difficulty
    ============================================================================= */

 /**
  * Return punctuation matching a specific curriculum difficulty.
  *
  * Difficulty is curriculum metadata. It is not learner mastery.
  *
  * @param {number|string} difficulty
  * @returns {Object[]}
  */
 function getPunctuationByDifficulty(
   difficulty,
 ) {
   return getPunctuation().filter(
     (item) =>
       item.difficulty ===
       difficulty,
   );
 }

 /**
  * Return punctuation up to a maximum difficulty.
  *
  * @param {number} maximumDifficulty
  * @returns {Object[]}
  */
 function getPunctuationUpToDifficulty(
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

   return getPunctuation().filter(
     (item) =>
       typeof item.difficulty ===
         "number" &&
       item.difficulty <=
         maximumDifficulty,
   );
 }

 /* =============================================================================
    Morse Relationships
    ============================================================================= */

 /**
  * Find punctuation by its Morse encoding.
  *
  * @param {string} morse
  * @returns {Object|null}
  */
 function getPunctuationByMorse(
   morse,
 ) {
   if (
     typeof morse !== "string" ||
     morse.length === 0
   ) {
     return null;
   }

   return (
     getPunctuation().find(
       (item) =>
         item.morse === morse,
     ) ?? null
   );
 }

 /**
  * Determine whether a Morse sequence belongs to a punctuation item.
  *
  * @param {string} morse
  * @returns {boolean}
  */
 function hasMorseSequence(morse) {
   return (
     getPunctuationByMorse(morse) !==
     null
   );
 }

 /* =============================================================================
    Filtering
    ============================================================================= */

 /**
  * Filter punctuation with a caller-supplied predicate.
  *
  * This remains a curriculum operation and does not involve learner state.
  *
  * @param {Function} predicate
  * @returns {Object[]}
  */
 function filterPunctuation(
   predicate,
 ) {
   if (
     typeof predicate !== "function"
   ) {
     throw new TypeError(
       "Punctuation filter predicate must be a function.",
     );
   }

   return getPunctuation().filter(
     predicate,
   );
 }

 /**
  * Query punctuation using multiple curriculum constraints.
  *
  * @param {Object} options
  * @param {number|string|null} options.difficulty
  * @param {number|null} options.maximumDifficulty
  * @returns {Object[]}
  */
 function queryPunctuation({
   difficulty = null,
   maximumDifficulty = null,
 } = {}) {
   return getPunctuation().filter(
     (item) => {
       if (
         difficulty !== null &&
         item.difficulty !==
           difficulty
       ) {
         return false;
       }

       if (
         maximumDifficulty !==
           null &&
         (
           typeof item.difficulty !==
             "number" ||
           item.difficulty >
             maximumDifficulty
         )
       ) {
         return false;
       }

       return true;
     },
   );
 }

 /* =============================================================================
    Exports
    ============================================================================= */

 export {
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
 };