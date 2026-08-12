/**
 * =============================================================================
 * EduDit
 * Feedback UI
 * =============================================================================
 *
 * Centralized visual feedback for training interactions.
 *
 * Responsibilities:
 *
 * - Show correct / incorrect feedback.
 * - Show neutral status messages.
 * - Manage transient feedback timing.
 * - Respect reduced-motion preferences when possible.
 * - Keep feedback rendering independent from training logic.
 *
 * This module does NOT:
 *
 * - Decide whether an answer is correct.
 * - Calculate mastery.
 * - Reveal answers.
 * - Persist anything.
 * =============================================================================
 */


/* =============================================================================
   Constants
   ============================================================================= */

const FEEDBACK_TYPES = Object.freeze({
  CORRECT: "correct",
  INCORRECT: "incorrect",
  NEUTRAL: "neutral",
  WARNING: "warning",
  INFO: "info",
});


const DEFAULT_DURATION_MS = 1600;

const MIN_DURATION_MS = 250;

const MAX_DURATION_MS = 10000;


/* =============================================================================
   Internal State
   ============================================================================= */

let activeContainer = null;

let hideTimer = null;

let mounted = false;


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
      FEEDBACK_TYPES,
    ).includes(normalized)
  ) {
    return normalized;
  }

  return FEEDBACK_TYPES.NEUTRAL;
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
   Reduced Motion
   ============================================================================= */

function prefersReducedMotion() {
  if (
    typeof window ===
      "undefined" ||
    typeof window.matchMedia !==
      "function"
  ) {
    return false;
  }

  return window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;
}


/* =============================================================================
   Container Resolution
   ============================================================================= */

function resolveContainer(
  container,
) {
  if (
    container instanceof
    Element
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
      "[data-feedback]",
    ) ??
    document.querySelector(
      ".feedback",
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

  mounted = false;
}


/* =============================================================================
   Rendering
   ============================================================================= */

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
    "is-visible",
    "is-correct",
    "is-incorrect",
    "is-neutral",
    "is-warning",
    "is-info",
  );

  target.removeAttribute(
    "data-feedback-type",
  );

  target.setAttribute(
    "aria-hidden",
    "true",
  );

  const message =
    target.querySelector(
      "[data-feedback-message]",
    );

  if (message) {
    message.textContent = "";
  }
}


function render({
  type = FEEDBACK_TYPES.NEUTRAL,
  message = "",
  duration = DEFAULT_DURATION_MS,
  container = null,
} = {}) {
  const target =
    resolveContainer(
      container,
    );

  if (!target) {
    return false;
  }

  const normalizedType =
    normalizeType(type);

  const normalizedMessage =
    normalizeMessage(message);

  if (!normalizedMessage) {
    clear(target);
    return false;
  }

  clearHideTimer();

  const messageElement =
    target.querySelector(
      "[data-feedback-message]",
    );

  if (messageElement) {
    messageElement.textContent =
      normalizedMessage;
  } else {
    target.textContent =
      normalizedMessage;
  }

  target.dataset.feedbackType =
    normalizedType;

  target.classList.remove(
    "is-correct",
    "is-incorrect",
    "is-neutral",
    "is-warning",
    "is-info",
  );

  target.classList.add(
    `is-${normalizedType}`,
  );

  target.setAttribute(
    "aria-hidden",
    "false",
  );

  /*
   * Avoid animation-specific assumptions when reduced motion is enabled.
   */
  if (prefersReducedMotion()) {
    target.classList.add(
      "is-visible",
    );
  } else {
    /*
     * Force the browser to observe the class transition if the same feedback
     * type is being displayed repeatedly.
     */
    void target.offsetWidth;

    target.classList.add(
      "is-visible",
    );
  }

  mounted = true;

  const normalizedDuration =
    clampDuration(
      duration,
    );

  if (
    normalizedDuration > 0
  ) {
    hideTimer =
      window.setTimeout(
        () => {
          hideTimer = null;

          target.classList.remove(
            "is-visible",
          );

          target.setAttribute(
            "aria-hidden",
            "true",
          );
        },
        normalizedDuration,
      );
  }

  return true;
}


/* =============================================================================
   Convenience Methods
   ============================================================================= */

function showCorrect(
  message = "Correct!",
  options = {},
) {
  return render({
    ...options,
    type:
      FEEDBACK_TYPES.CORRECT,
    message,
  });
}


function showIncorrect(
  message = "Not quite.",
  options = {},
) {
  return render({
    ...options,
    type:
      FEEDBACK_TYPES.INCORRECT,
    message,
  });
}


function showNeutral(
  message,
  options = {},
) {
  return render({
    ...options,
    type:
      FEEDBACK_TYPES.NEUTRAL,
    message,
  });
}


function showWarning(
  message,
  options = {},
) {
  return render({
    ...options,
    type:
      FEEDBACK_TYPES.WARNING,
    message,
  });
}


function showInfo(
  message,
  options = {},
) {
  return render({
    ...options,
    type:
      FEEDBACK_TYPES.INFO,
    message,
  });
}


/* =============================================================================
   State
   ============================================================================= */

function isMounted() {
  return mounted;
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

const feedback =
  Object.freeze({
    FEEDBACK_TYPES,

    mount,
    unmount,
    destroy,

    render,
    clear,

    showCorrect,
    showIncorrect,
    showNeutral,
    showWarning,
    showInfo,

    isMounted,
    getContainer,
  });


export {
  FEEDBACK_TYPES,

  mount,
  unmount,
  destroy,

  render,
  clear,

  showCorrect,
  showIncorrect,
  showNeutral,
  showWarning,
  showInfo,

  isMounted,
  getContainer,
};


export default feedback;