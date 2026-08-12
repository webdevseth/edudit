/**
 * =============================================================================
 * EduDit
 * Random Utilities
 * =============================================================================
 *
 * Pure random-selection helpers.
 *
 * These utilities intentionally do not contain adaptive-learning decisions.
 * The adaptive engine decides WHAT should be selected; these functions only
 * provide generic selection mechanics.
 * =============================================================================
 */


/* =============================================================================
   Numbers
   ============================================================================= */


/**
 * Return a random floating-point number between minimum and maximum.
 *
 * @param {number} minimum
 * @param {number} maximum
 * @returns {number}
 */
function randomBetween(
  minimum,
  maximum,
) {
  const min = Number(minimum);
  const max = Number(maximum);

  if (
    !Number.isFinite(min) ||
    !Number.isFinite(max)
  ) {
    throw new TypeError(
      "Random range values must be finite numbers.",
    );
  }

  if (min > max) {
    throw new RangeError(
      "Minimum cannot be greater than maximum.",
    );
  }

  return (
    Math.random() *
    (max - min) +
    min
  );
}


/**
 * Return a random integer between minimum and maximum, inclusive.
 *
 * @param {number} minimum
 * @param {number} maximum
 * @returns {number}
 */
function randomInteger(
  minimum,
  maximum,
) {
  const min =
    Math.ceil(Number(minimum));

  const max =
    Math.floor(Number(maximum));

  if (
    !Number.isFinite(min) ||
    !Number.isFinite(max)
  ) {
    throw new TypeError(
      "Random range values must be finite numbers.",
    );
  }

  if (min > max) {
    throw new RangeError(
      "Minimum cannot be greater than maximum.",
    );
  }

  return (
    Math.floor(
      Math.random() *
      (max - min + 1),
    ) +
    min
  );
}


/* =============================================================================
   Array Selection
   ============================================================================= */


/**
 * Select a random item from an array.
 *
 * @param {Array} items
 * @returns {*}
 */
function randomItem(items) {
  if (
    !Array.isArray(items) ||
    items.length === 0
  ) {
    return undefined;
  }

  return items[
    randomInteger(
      0,
      items.length - 1,
    )
  ];
}


/**
 * Select a random index from an array.
 *
 * @param {Array} items
 * @returns {number}
 */
function randomIndex(items) {
  if (
    !Array.isArray(items) ||
    items.length === 0
  ) {
    return -1;
  }

  return randomInteger(
    0,
    items.length - 1,
  );
}


/**
 * Shuffle an array using Fisher-Yates.
 *
 * Returns a new array and never mutates the original.
 *
 * @param {Array} items
 * @returns {Array}
 */
function shuffle(items) {
  if (!Array.isArray(items)) {
    return [];
  }

  const result = [
    ...items,
  ];

  for (
    let index =
      result.length - 1;
    index > 0;
    index -= 1
  ) {
    const swapIndex =
      randomInteger(
        0,
        index,
      );

    [
      result[index],
      result[swapIndex],
    ] = [
      result[swapIndex],
      result[index],
    ];
  }

  return result;
}


/**
 * Return a random subset of an array.
 *
 * @param {Array} items
 * @param {number} count
 * @returns {Array}
 */
function sample(
  items,
  count,
) {
  if (!Array.isArray(items)) {
    return [];
  }

  const requestedCount =
    Number(count);

  if (
    !Number.isInteger(requestedCount) ||
    requestedCount <= 0
  ) {
    return [];
  }

  if (
    requestedCount >=
    items.length
  ) {
    return shuffle(items);
  }

  return shuffle(items).slice(
    0,
    requestedCount,
  );
}


/* =============================================================================
   Weighted Selection
   ============================================================================= */


/**
 * Select an item according to numeric weights.
 *
 * Each item should have the form:
 *
 * {
 *   value: ...,
 *   weight: number
 * }
 *
 * @param {Array} items
 * @returns {*}
 */
function weightedRandomItem(items) {
  if (
    !Array.isArray(items) ||
    items.length === 0
  ) {
    return undefined;
  }

  const weightedItems =
    items.filter(
      (item) =>
        item &&
        Number.isFinite(
          Number(item.weight),
        ) &&
        Number(item.weight) > 0,
    );

  if (
    weightedItems.length === 0
  ) {
    return undefined;
  }

  const totalWeight =
    weightedItems.reduce(
      (sum, item) =>
        sum +
        Number(item.weight),
      0,
    );

  let threshold =
    Math.random() *
    totalWeight;

  for (
    const item of weightedItems
  ) {
    threshold -=
      Number(item.weight);

    if (threshold <= 0) {
      return item.value;
    }
  }

  return weightedItems[
    weightedItems.length - 1
  ].value;
}


/* =============================================================================
   Exports
   ============================================================================= */


export {
  randomBetween,
  randomInteger,

  randomItem,
  randomIndex,

  shuffle,
  sample,

  weightedRandomItem,
};


export default {
  randomBetween,
  randomInteger,
  randomItem,
  randomIndex,
  shuffle,
  sample,
  weightedRandomItem,
};