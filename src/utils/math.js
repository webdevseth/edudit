/**
 * =============================================================================
 * EduDit
 * Math Utilities
 * =============================================================================
 *
 * Pure mathematical helpers used throughout the application.
 *
 * No DOM, storage, state, or application-specific dependencies belong here.
 * =============================================================================
 */


/* =============================================================================
   Clamping
   ============================================================================= */


/**
 * Clamp a number between a minimum and maximum value.
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
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return minimum;
  }

  if (minimum > maximum) {
    throw new RangeError(
      "Minimum cannot be greater than maximum.",
    );
  }

  return Math.min(
    maximum,
    Math.max(minimum, number),
  );
}


/**
 * Clamp a number between 0 and 1.
 *
 * @param {number} value
 * @returns {number}
 */
function clamp01(value) {
  return clamp(value, 0, 1);
}


/* =============================================================================
   Rounding
   ============================================================================= */


/**
 * Round a number to a specified number of decimal places.
 *
 * @param {number} value
 * @param {number} decimalPlaces
 * @returns {number}
 */
function roundTo(
  value,
  decimalPlaces = 0,
) {
  const number = Number(value);
  const places = Number(decimalPlaces);

  if (!Number.isFinite(number)) {
    return 0;
  }

  if (
    !Number.isInteger(places) ||
    places < 0
  ) {
    throw new RangeError(
      "Decimal places must be a non-negative integer.",
    );
  }

  const factor =
    10 ** places;

  return (
    Math.round(
      (number + Number.EPSILON) *
      factor,
    ) / factor
  );
}


/* =============================================================================
   Percentages
   ============================================================================= */


/**
 * Convert a ratio to a percentage.
 *
 * @param {number} ratio
 * @returns {number}
 */
function ratioToPercent(ratio) {
  return clamp01(ratio) * 100;
}


/**
 * Convert a percentage to a ratio.
 *
 * @param {number} percent
 * @returns {number}
 */
function percentToRatio(percent) {
  return clamp01(
    Number(percent) / 100,
  );
}


/**
 * Calculate percentage from a part and total.
 *
 * @param {number} part
 * @param {number} total
 * @returns {number}
 */
function percentage(
  part,
  total,
) {
  const numerator = Number(part);
  const denominator = Number(total);

  if (
    !Number.isFinite(numerator) ||
    !Number.isFinite(denominator) ||
    denominator === 0
  ) {
    return 0;
  }

  return (
    numerator /
    denominator
  ) * 100;
}


/* =============================================================================
   Averages
   ============================================================================= */


/**
 * Calculate the arithmetic mean.
 *
 * @param {number[]} values
 * @returns {number}
 */
function average(values) {
  if (
    !Array.isArray(values) ||
    values.length === 0
  ) {
    return 0;
  }

  const validValues =
    values
      .map(Number)
      .filter(Number.isFinite);

  if (validValues.length === 0) {
    return 0;
  }

  return (
    validValues.reduce(
      (sum, value) =>
        sum + value,
      0,
    ) /
    validValues.length
  );
}


/**
 * Calculate a weighted average.
 *
 * @param {Array<{value:number, weight:number}>} values
 * @returns {number}
 */
function weightedAverage(values) {
  if (
    !Array.isArray(values) ||
    values.length === 0
  ) {
    return 0;
  }

  let weightedTotal = 0;
  let totalWeight = 0;

  values.forEach(
    ({
      value,
      weight,
    }) => {
      const numericValue =
        Number(value);

      const numericWeight =
        Number(weight);

      if (
        Number.isFinite(numericValue) &&
        Number.isFinite(numericWeight) &&
        numericWeight > 0
      ) {
        weightedTotal +=
          numericValue *
          numericWeight;

        totalWeight +=
          numericWeight;
      }
    },
  );

  if (totalWeight === 0) {
    return 0;
  }

  return (
    weightedTotal /
    totalWeight
  );
}


/* =============================================================================
   Ratios / Progress
   ============================================================================= */


/**
 * Calculate progress toward a target.
 *
 * @param {number} current
 * @param {number} target
 * @returns {number}
 */
function progressRatio(
  current,
  target,
) {
  const currentValue =
    Number(current);

  const targetValue =
    Number(target);

  if (
    !Number.isFinite(currentValue) ||
    !Number.isFinite(targetValue) ||
    targetValue <= 0
  ) {
    return 0;
  }

  return clamp01(
    currentValue /
    targetValue,
  );
}


/**
 * Calculate a linear interpolation.
 *
 * @param {number} start
 * @param {number} end
 * @param {number} amount
 * @returns {number}
 */
function lerp(
  start,
  end,
  amount,
) {
  const normalizedAmount =
    clamp01(amount);

  return (
    Number(start) +
    (
      Number(end) -
      Number(start)
    ) *
    normalizedAmount
  );
}


/* =============================================================================
   Exports
   ============================================================================= */


export {
  clamp,
  clamp01,

  roundTo,

  ratioToPercent,
  percentToRatio,
  percentage,

  average,
  weightedAverage,

  progressRatio,
  lerp,
};


export default {
  clamp,
  clamp01,
  roundTo,
  ratioToPercent,
  percentToRatio,
  percentage,
  average,
  weightedAverage,
  progressRatio,
  lerp,
};