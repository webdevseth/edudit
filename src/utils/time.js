/**
 * =============================================================================
 * EduDit
 * Time Utilities
 * =============================================================================
 *
 * Pure time and duration helpers.
 *
 * All durations are represented internally in milliseconds unless explicitly
 * stated otherwise.
 * =============================================================================
 */


/* =============================================================================
   Constants
   ============================================================================= */


const SECOND_MS = 1000;
const MINUTE_MS = 60 * SECOND_MS;
const HOUR_MS = 60 * MINUTE_MS;


/* =============================================================================
   Timestamps
   ============================================================================= */


/**
 * Return the current timestamp.
 *
 * @returns {number}
 */
function now() {
  return Date.now();
}


/**
 * Return elapsed milliseconds since a timestamp.
 *
 * @param {number} timestamp
 * @param {number} currentTime
 * @returns {number}
 */
function elapsedMs(
  timestamp,
  currentTime = now(),
) {
  const start =
    Number(timestamp);

  const current =
    Number(currentTime);

  if (
    !Number.isFinite(start) ||
    !Number.isFinite(current)
  ) {
    return 0;
  }

  return Math.max(
    0,
    current - start,
  );
}


/* =============================================================================
   Duration Conversion
   ============================================================================= */


/**
 * Convert seconds to milliseconds.
 *
 * @param {number} seconds
 * @returns {number}
 */
function secondsToMs(seconds) {
  return (
    Number(seconds) *
    SECOND_MS
  );
}


/**
 * Convert milliseconds to seconds.
 *
 * @param {number} milliseconds
 * @returns {number}
 */
function msToSeconds(milliseconds) {
  return (
    Number(milliseconds) /
    SECOND_MS
  );
}


/**
 * Convert minutes to milliseconds.
 *
 * @param {number} minutes
 * @returns {number}
 */
function minutesToMs(minutes) {
  return (
    Number(minutes) *
    MINUTE_MS
  );
}


/**
 * Convert milliseconds to minutes.
 *
 * @param {number} milliseconds
 * @returns {number}
 */
function msToMinutes(milliseconds) {
  return (
    Number(milliseconds) /
    MINUTE_MS
  );
}


/* =============================================================================
   Formatting
   ============================================================================= */


/**
 * Format a duration for display.
 *
 * Examples:
 *
 *   42000  -> "0:42"
 *   125000 -> "2:05"
 *   3661000 -> "1:01:01"
 *
 * @param {number} milliseconds
 * @returns {string}
 */
function formatDuration(milliseconds) {
  const totalSeconds =
    Math.max(
      0,
      Math.floor(
        Number(milliseconds) /
        SECOND_MS,
      ),
    );

  const seconds =
    totalSeconds % 60;

  const totalMinutes =
    Math.floor(
      totalSeconds / 60,
    );

  const minutes =
    totalMinutes % 60;

  const hours =
    Math.floor(
      totalMinutes / 60,
    );

  const pad =
    (value) =>
      String(value).padStart(
        2,
        "0",
      );

  if (hours > 0) {
    return `${hours}:${pad(minutes)}:${pad(seconds)}`;
  }

  return `${minutes}:${pad(seconds)}`;
}


/**
 * Format a duration as a compact human-readable string.
 *
 * @param {number} milliseconds
 * @returns {string}
 */
function formatDurationLong(milliseconds) {
  const totalSeconds =
    Math.max(
      0,
      Math.floor(
        Number(milliseconds) /
        SECOND_MS,
      ),
    );

  const hours =
    Math.floor(
      totalSeconds / 3600,
    );

  const minutes =
    Math.floor(
      (totalSeconds % 3600) /
      60,
    );

  const seconds =
    totalSeconds % 60;

  const parts = [];

  if (hours > 0) {
    parts.push(
      `${hours}h`,
    );
  }

  if (
    minutes > 0 ||
    hours > 0
  ) {
    parts.push(
      `${minutes}m`,
    );
  }

  parts.push(
    `${seconds}s`,
  );

  return parts.join(" ");
}


/* =============================================================================
   Debounce / Scheduling Helpers
   ============================================================================= */


/**
 * Create a cancellable delay.
 *
 * @param {number} milliseconds
 * @returns {Promise<void>}
 */
function delay(milliseconds) {
  const duration =
    Math.max(
      0,
      Number(milliseconds) || 0,
    );

  return new Promise(
    (resolve) => {
      setTimeout(
        resolve,
        duration,
      );
    },
  );
}


/* =============================================================================
   Exports
   ============================================================================= */


export {
  SECOND_MS,
  MINUTE_MS,
  HOUR_MS,

  now,
  elapsedMs,

  secondsToMs,
  msToSeconds,
  minutesToMs,
  msToMinutes,

  formatDuration,
  formatDurationLong,

  delay,
};


export default {
  now,
  elapsedMs,
  secondsToMs,
  msToSeconds,
  minutesToMs,
  msToMinutes,
  formatDuration,
  formatDurationLong,
  delay,
};