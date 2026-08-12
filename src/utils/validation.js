/**
 * =============================================================================
 * EduDit
 * Validation Utilities
 * =============================================================================
 *
 * Generic validation helpers.
 *
 * These functions validate values and structures. They do not contain
 * application-specific business rules.
 * =============================================================================
 */


/* =============================================================================
   Basic Type Checks
   ============================================================================= */


/**
 * Determine whether a value is a non-empty string.
 *
 * @param {*} value
 * @returns {boolean}
 */
function isNonEmptyString(value) {
  return (
    typeof value === "string" &&
    value.trim().length > 0
  );
}


/**
 * Determine whether a value is a finite number.
 *
 * @param {*} value
 * @returns {boolean}
 */
function isFiniteNumber(value) {
  return Number.isFinite(
    Number(value),
  );
}


/**
 * Determine whether a value is a positive number.
 *
 * @param {*} value
 * @returns {boolean}
 */
function isPositiveNumber(value) {
  const number =
    Number(value);

  return (
    Number.isFinite(number) &&
    number > 0
  );
}


/**
 * Determine whether a value is a non-negative number.
 *
 * @param {*} value
 * @returns {boolean}
 */
function isNonNegativeNumber(value) {
  const number =
    Number(value);

  return (
    Number.isFinite(number) &&
    number >= 0
  );
}


/**
 * Determine whether a value is a non-negative integer.
 *
 * @param {*} value
 * @returns {boolean}
 */
function isNonNegativeInteger(value) {
  return (
    Number.isInteger(value) &&
    value >= 0
  );
}


/**
 * Determine whether a value is a plain object.
 *
 * @param {*} value
 * @returns {boolean}
 */
function isPlainObject(value) {
  if (
    value === null ||
    typeof value !== "object"
  ) {
    return false;
  }

  const prototype =
    Object.getPrototypeOf(value);

  return (
    prototype ===
      Object.prototype ||
    prototype === null
  );
}


/* =============================================================================
   Collections
   ============================================================================= */


/**
 * Determine whether an array is non-empty.
 *
 * @param {*} value
 * @returns {boolean}
 */
function isNonEmptyArray(value) {
  return (
    Array.isArray(value) &&
    value.length > 0
  );
}


/**
 * Determine whether an array contains a value.
 *
 * @param {*} value
 * @param {Array} allowedValues
 * @returns {boolean}
 */
function isOneOf(
  value,
  allowedValues,
) {
  return (
    Array.isArray(allowedValues) &&
    allowedValues.includes(value)
  );
}


/* =============================================================================
   Strings
   ============================================================================= */


/**
 * Normalize a string for comparison.
 *
 * @param {*} value
 * @returns {string}
 */
function normalizeString(value) {
  if (
    value === null ||
    value === undefined
  ) {
    return "";
  }

  return String(value)
    .trim()
    .toUpperCase();
}


/**
 * Determine whether two values represent the same normalized string.
 *
 * @param {*} first
 * @param {*} second
 * @returns {boolean}
 */
function stringsEqual(
  first,
  second,
) {
  return (
    normalizeString(first) ===
    normalizeString(second)
  );
}


/* =============================================================================
   Range Validation
   ============================================================================= */


/**
 * Determine whether a numeric value falls within a range.
 *
 * @param {*} value
 * @param {number} minimum
 * @param {number} maximum
 * @returns {boolean}
 */
function isInRange(
  value,
  minimum,
  maximum,
) {
  const number =
    Number(value);

  return (
    Number.isFinite(number) &&
    number >= minimum &&
    number <= maximum
  );
}


/* =============================================================================
   Result Objects
   ============================================================================= */


/**
 * Create a validation result.
 *
 * @param {boolean} valid
 * @param {string[]} errors
 * @returns {Object}
 */
function validationResult(
  valid,
  errors = [],
) {
  return {
    valid:
      Boolean(valid),

    errors:
      Array.isArray(errors)
        ? [...errors]
        : [],
  };
}


/**
 * Require a non-empty string.
 *
 * @param {*} value
 * @param {string} fieldName
 * @returns {Object}
 */
function requireString(
  value,
  fieldName = "Value",
) {
  if (!isNonEmptyString(value)) {
    return validationResult(
      false,
      [
        `${fieldName} must be a non-empty string.`,
      ],
    );
  }

  return validationResult(
    true,
  );
}


/**
 * Require a positive number.
 *
 * @param {*} value
 * @param {string} fieldName
 * @returns {Object}
 */
function requirePositiveNumber(
  value,
  fieldName = "Value",
) {
  if (!isPositiveNumber(value)) {
    return validationResult(
      false,
      [
        `${fieldName} must be a positive number.`,
      ],
    );
  }

  return validationResult(
    true,
  );
}


/* =============================================================================
   Exports
   ============================================================================= */


export {
  isNonEmptyString,
  isFiniteNumber,
  isPositiveNumber,
  isNonNegativeNumber,
  isNonNegativeInteger,
  isPlainObject,

  isNonEmptyArray,
  isOneOf,

  normalizeString,
  stringsEqual,

  isInRange,

  validationResult,
  requireString,
  requirePositiveNumber,
};


export default {
  isNonEmptyString,
  isFiniteNumber,
  isPositiveNumber,
  isNonNegativeNumber,
  isNonNegativeInteger,
  isPlainObject,
  isNonEmptyArray,
  isOneOf,
  normalizeString,
  stringsEqual,
  isInRange,
  validationResult,
  requireString,
  requirePositiveNumber,
};