/**
 * =============================================================================
 * EduDit
 * Hint UI
 * =============================================================================
 *
 * Centralized learner-assistance UI.
 *
 * Responsibilities:
 *
 * - Display non-answer-revealing hints.
 * - Support progressive hint levels.
 * - Show timing / rhythm guidance.
 * - Provide a consistent hint container API.
 * - Allow training features to update hints without owning presentation logic.
 *
 * This module does NOT:
 *
 * - Decide when a learner needs a hint.
 * - Calculate mastery.
 * - Reveal the expected answer.
 * - Generate curriculum content.
 * - Persist hint usage.
 *
 * The training system remains responsible for deciding whether a hint should
 * be offered and what information is appropriate.
 * =============================================================================
 */


/* =============================================================================
   Constants
   ============================================================================= */

const HINT_TYPES = Object.freeze({
  CHARACTER: "character",
  RHYTHM: "rhythm",
  TIMING: "timing",
  PROGRESS: "progress",
  ENCOURAGEMENT: "encouragement",
  NEUTRAL: "neutral",
});


const HINT_LEVELS = Object.freeze({
  SUBTLE: 1,
  GUIDED: 2,
  STRONG: 3,
});


const DEFAULT_DURATION_MS = 3000;

const MIN_DURATION_MS = 500;

const MAX_DURATION_MS = 15000;


/* =============================================================================
   Internal State
   ============================================================================= */

let activeContainer = null;

let hideTimer = null;

let mounted = false;

let currentHint = null;


/* =============================================================================
   Utility
   ============================================================================= */

function clampDuration(
  value,
) {
  const number =
    Number(value);

  if (!Number.isFinite(number)) {
    return DEFAULT_DURATION_MS;
  }

  return Math.min(
    MAX_DURATION_MS,
    Math.max(
      MIN_DURATION_MS,
      number,
    ),
  );
}


function normalizeType(
  type,
) {
  const normalized =
    String(type ?? "")
      .trim()
      .toLowerCase();

  if (
    Object.values(
      HINT_TYPES,
    ).includes(normalized)
  ) {
    return normalized;
  }

  return HINT_TYPES.NEUTRAL;
}


function normalizeLevel(
  level,
) {
  const number =
    Number(level);

  if (!Number.isFinite(number)) {
    return HINT_LEVELS.SUBTLE;
  }

  return Math.min(
    HINT_LEVELS.STRONG,
    Math.max(
      HINT_LEVELS.SUBTLE,
      Math.round(number),
    ),
  );
}


function normalizeMessage(
  message,
) {
  if (
    message === null ||
    message === undefined
  ) {
    return "";
  }

  return String(message).trim();
}


function clearHideTimer() {
  if (hideTimer === null) {
    return;
  }

  window.clearTimeout(
    hideTimer,
  );

  hideTimer = null;
}


/* =============================================================================
   DOM Resolution
   ============================================================================= */

function resolveContainer(
  container,
) {
  if (
    typeof Element !==
      "undefined" &&
    container instanceof Element
  ) {
    return container;
  }

  if (
    typeof container ===
    "string"
  ) {
    return document.querySelector(
      container,
    );
  }

  return (
    activeContainer ??
    document.querySelector(
      "[data-hints]",
    ) ??
    document.querySelector(
      ".hints",
    )
  );
}


/* =============================================================================
   Mounting
   ============================================================================= */

function mount(
  container,
) {
  const resolved =
    resolveContainer(
      container,
    );

  if (!resolved) {
    return false;
  }

  activeContainer =
    resolved;

  mounted = true;

  return true;
}


function unmount() {
  clearHideTimer();

  if (activeContainer) {
    clear(activeContainer);
  }

  activeContainer = null;

  currentHint = null;

  mounted = false;
}


/* =============================================================================
   Rendering
   ============================================================================= */

function render({
  type = HINT_TYPES.NEUTRAL,
  level = HINT_LEVELS.SUBTLE,
  message = "",
  duration = DEFAULT_DURATION_MS,
  persistent = false,
  container = null,
} = {}) {
  const target =
    resolveContainer(
      container,
    );

  if (!target) {
    return false;
  }

  const normalizedMessage =
    normalizeMessage(message);

  if (!normalizedMessage) {
    clear(target);
    return false;
  }

  const normalizedType =
    normalizeType(type);

  const normalizedLevel =
    normalizeLevel(level);

  clearHideTimer();

  const messageElement =
    target.querySelector(
      "[data-hint-message]",
    );

  if (messageElement) {
    messageElement.textContent =
      normalizedMessage;
  } else {
    target.textContent =
      normalizedMessage;
  }

  target.dataset.hintType =
    normalizedType;

  target.dataset.hintLevel =
    String(normalizedLevel);

  target.classList.remove(
    "hint-subtle",
    "hint-guided",
    "hint-strong",
    "hint-visible",
  );

  if (
    normalizedLevel ===
    HINT_LEVELS.SUBTLE
  ) {
    target.classList.add(
      "hint-subtle",
    );
  } else if (
    normalizedLevel ===
    HINT_LEVELS.GUIDED
  ) {
    target.classList.add(
      "hint-guided",
    );
  } else {
    target.classList.add(
      "hint-strong",
    );
  }

  target.classList.add(
    "hint-visible",
  );

  target.setAttribute(
    "aria-hidden",
    "false",
  );

  currentHint = Object.freeze({
    type: normalizedType,
    level: normalizedLevel,
    message: normalizedMessage,
  });

  mounted = true;

  if (!persistent) {
    hideTimer =
      window.setTimeout(
        () => {
          hideTimer = null;

          hide(target);
        },
        clampDuration(
          duration,
        ),
      );
  }

  return true;
}


/* =============================================================================
   Progressive Hint Helpers
   ============================================================================= */

/**
 * Show a subtle hint.
 *
 * Example:
 *
 * "Listen for the difference between the short and long tone."
 */
function showSubtle(
  message,
  options = {},
) {
  return render({
    ...options,
    level:
      HINT_LEVELS.SUBTLE,
    message,
  });
}


/**
 * Show a guided hint.
 *
 * This should provide useful direction without giving away the answer.
 */
function showGuided(
  message,
  options = {},
) {
  return render({
    ...options,
    level:
      HINT_LEVELS.GUIDED,
    message,
  });
}


/**
 * Show the strongest allowed hint.
 *
 * Even the strong level should remain non-answer-revealing unless the calling
 * training system explicitly decides otherwise.
 */
function showStrong(
  message,
  options = {},
) {
  return render({
    ...options,
    level:
      HINT_LEVELS.STRONG,
    message,
  });
}


/* =============================================================================
   Specialized Hint Helpers
   ============================================================================= */

function showCharacterHint(
  message,
  options = {},
) {
  return render({
    ...options,
    type:
      HINT_TYPES.CHARACTER,
    message,
  });
}


function showRhythmHint(
  message,
  options = {},
) {
  return render({
    ...options,
    type:
      HINT_TYPES.RHYTHM,
    message,
  });
}


function showTimingHint(
  message,
  options = {},
) {
  return render({
    ...options,
    type:
      HINT_TYPES.TIMING,
    message,
  });
}


function showProgressHint(
  message,
  options = {},
) {
  return render({
    ...options,
    type:
      HINT_TYPES.PROGRESS,
    message,
  });
}


function showEncouragement(
  message,
  options = {},
) {
  return render({
    ...options,
    type:
      HINT_TYPES.ENCOURAGEMENT,
    message,
  });
}


/* =============================================================================
   Visibility
   ============================================================================= */

function hide(
  container = activeContainer,
) {
  const target =
    resolveContainer(
      container,
    );

  if (!target) {
    return;
  }

  clearHideTimer();

  target.classList.remove(
    "hint-visible",
  );

  target.setAttribute(
    "aria-hidden",
    "true",
  );

  currentHint = null;
}


function clear(
  container = activeContainer,
) {
  const target =
    resolveContainer(
      container,
    );

  if (!target) {
    return;
  }

  clearHideTimer();

  target.classList.remove(
    "hint-visible",
    "hint-subtle",
    "hint-guided",
    "hint-strong",
  );

  target.removeAttribute(
    "data-hint-type",
  );

  target.removeAttribute(
    "data-hint-level",
  );

  target.setAttribute(
    "aria-hidden",
    "true",
  );

  const messageElement =
    target.querySelector(
      "[data-hint-message]",
    );

  if (messageElement) {
    messageElement.textContent =
      "";
  } else {
    target.textContent =
      "";
  }

  currentHint = null;
}


/* =============================================================================
   State
   ============================================================================= */

function isMounted() {
  return mounted;
}


function isVisible() {
  return (
    currentHint !== null
  );
}


function getCurrentHint() {
  return currentHint;
}


function getContainer() {
  return activeContainer;
}


/* =============================================================================
   Cleanup
   ============================================================================= */

function destroy() {
  unmount();
}


/* =============================================================================
   Public API
   ============================================================================= */

const hints =
  Object.freeze({
    HINT_TYPES,
    HINT_LEVELS,

    mount,
    unmount,
    destroy,

    render,

    showSubtle,
    showGuided,
    showStrong,

    showCharacterHint,
    showRhythmHint,
    showTimingHint,
    showProgressHint,
    showEncouragement,

    hide,
    clear,

    isMounted,
    isVisible,
    getCurrentHint,
    getContainer,
  });


export {
  HINT_TYPES,
  HINT_LEVELS,

  mount,
  unmount,
  destroy,

  render,

  showSubtle,
  showGuided,
  showStrong,

  showCharacterHint,
  showRhythmHint,
  showTimingHint,
  showProgressHint,
  showEncouragement,

  hide,
  clear,

  isMounted,
  isVisible,
  getCurrentHint,
  getContainer,
};


export default hints;