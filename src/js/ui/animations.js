/**
 * =============================================================================
 * EduDit
 * Animation UI
 * =============================================================================
 *
 * Centralized animation orchestration.
 *
 * CSS owns the actual animation definitions.
 * This module owns:
 *
 * - Applying animation classes.
 * - Restarting/replaying animations.
 * - Removing animations safely.
 * - Respecting reduced-motion preferences.
 * - Providing small semantic helpers for common UI feedback.
 *
 * This module does NOT:
 *
 * - Define animation keyframes.
 * - Contain feature-specific business logic.
 * - Manage training state.
 * - Persist animation preferences.
 * =============================================================================
 */


/* =============================================================================
   Constants
   ============================================================================= */

const DEFAULT_ANIMATION_DURATION_MS =
  500;

const ANIMATION_CLASSES =
  Object.freeze({
    FADE_IN: "animate-fade-in",
    FADE_OUT: "animate-fade-out",

    SLIDE_IN: "animate-slide-in",
    SLIDE_OUT: "animate-slide-out",

    SCALE_IN: "animate-scale-in",

    SHAKE: "animate-shake",
    PULSE: "animate-pulse",
    BOUNCE: "animate-bounce",

    SUCCESS: "animate-success",
    ERROR: "animate-error",

    ATTENTION: "animate-attention",

    CORRECT: "animate-correct",
    INCORRECT: "animate-incorrect",
  });


/* =============================================================================
   Internal State
   ============================================================================= */

const activeAnimations =
  new WeakMap();


/* =============================================================================
   Utility
   ============================================================================= */

function resolveElement(
  element,
) {
  if (
    typeof Element !==
      "undefined" &&
    element instanceof Element
  ) {
    return element;
  }

  if (
    typeof element ===
    "string"
  ) {
    return document.querySelector(
      element,
    );
  }

  return null;
}


function normalizeClassName(
  className,
) {
  return String(
    className ?? "",
  ).trim();
}


function normalizeDuration(
  duration,
) {
  const number =
    Number(duration);

  if (
    !Number.isFinite(number) ||
    number < 0
  ) {
    return DEFAULT_ANIMATION_DURATION_MS;
  }

  return number;
}


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


function shouldAnimate(
  options = {},
) {
  if (
    options.force === true
  ) {
    return true;
  }

  if (
    options.respectReducedMotion ===
    false
  ) {
    return true;
  }

  return !prefersReducedMotion();
}


function forceReflow(
  element,
) {
  return element.offsetWidth;
}


/* =============================================================================
   Animation Tracking
   ============================================================================= */

function getElementAnimations(
  element,
) {
  let animations =
    activeAnimations.get(
      element,
    );

  if (!animations) {
    animations = new Set();

    activeAnimations.set(
      element,
      animations,
    );
  }

  return animations;
}


function trackAnimation(
  element,
  className,
) {
  const animations =
    getElementAnimations(
      element,
    );

  animations.add(
    className,
  );
}


function untrackAnimation(
  element,
  className,
) {
  const animations =
    activeAnimations.get(
      element,
    );

  if (!animations) {
    return;
  }

  animations.delete(
    className,
  );

  if (animations.size === 0) {
    activeAnimations.delete(
      element,
    );
  }
}


/* =============================================================================
   Core Animation API
   ============================================================================= */

function play(
  element,
  className,
  options = {},
) {
  const target =
    resolveElement(
      element,
    );

  const normalizedClass =
    normalizeClassName(
      className,
    );

  if (
    !target ||
    !normalizedClass
  ) {
    return false;
  }

  if (
    !shouldAnimate(
      options,
    )
  ) {
    return false;
  }

  const {
    restart = true,
    duration =
      DEFAULT_ANIMATION_DURATION_MS,
  } = options;

  if (restart) {
    target.classList.remove(
      normalizedClass,
    );

    forceReflow(
      target,
    );
  }

  target.classList.add(
    normalizedClass,
  );

  trackAnimation(
    target,
    normalizedClass,
  );

  if (
    options.remove !== false
  ) {
    const durationMs =
      normalizeDuration(
        duration,
      );

    window.setTimeout(
      () => {
        remove(
          target,
          normalizedClass,
        );
      },
      durationMs,
    );
  }

  return true;
}


function remove(
  element,
  className,
) {
  const target =
    resolveElement(
      element,
    );

  const normalizedClass =
    normalizeClassName(
      className,
    );

  if (
    !target ||
    !normalizedClass
  ) {
    return false;
  }

  target.classList.remove(
    normalizedClass,
  );

  untrackAnimation(
    target,
    normalizedClass,
  );

  return true;
}


function removeAll(
  element,
) {
  const target =
    resolveElement(
      element,
    );

  if (!target) {
    return false;
  }

  const animations =
    activeAnimations.get(
      target,
    );

  if (!animations) {
    return true;
  }

  for (
    const className of
      animations
  ) {
    target.classList.remove(
      className,
    );
  }

  activeAnimations.delete(
    target,
  );

  return true;
}


function replay(
  element,
  className,
  options = {},
) {
  return play(
    element,
    className,
    {
      ...options,
      restart: true,
    },
  );
}


/* =============================================================================
   Semantic Animation Helpers
   ============================================================================= */

function fadeIn(
  element,
  options = {},
) {
  return play(
    element,
    ANIMATION_CLASSES.FADE_IN,
    options,
  );
}


function fadeOut(
  element,
  options = {},
) {
  return play(
    element,
    ANIMATION_CLASSES.FADE_OUT,
    options,
  );
}


function slideIn(
  element,
  options = {},
) {
  return play(
    element,
    ANIMATION_CLASSES.SLIDE_IN,
    options,
  );
}


function slideOut(
  element,
  options = {},
) {
  return play(
    element,
    ANIMATION_CLASSES.SLIDE_OUT,
    options,
  );
}


function scaleIn(
  element,
  options = {},
) {
  return play(
    element,
    ANIMATION_CLASSES.SCALE_IN,
    options,
  );
}


function shake(
  element,
  options = {},
) {
  return play(
    element,
    ANIMATION_CLASSES.SHAKE,
    options,
  );
}


function pulse(
  element,
  options = {},
) {
  return play(
    element,
    ANIMATION_CLASSES.PULSE,
    options,
  );
}


function bounce(
  element,
  options = {},
) {
  return play(
    element,
    ANIMATION_CLASSES.BOUNCE,
    options,
  );
}


/* =============================================================================
   Training Feedback Helpers
   ============================================================================= */

function showCorrect(
  element,
  options = {},
) {
  return play(
    element,
    ANIMATION_CLASSES.CORRECT,
    options,
  );
}


function showIncorrect(
  element,
  options = {},
) {
  return play(
    element,
    ANIMATION_CLASSES.INCORRECT,
    options,
  );
}


function showSuccess(
  element,
  options = {},
) {
  return play(
    element,
    ANIMATION_CLASSES.SUCCESS,
    options,
  );
}


function showError(
  element,
  options = {},
) {
  return play(
    element,
    ANIMATION_CLASSES.ERROR,
    options,
  );
}


function showAttention(
  element,
  options = {},
) {
  return play(
    element,
    ANIMATION_CLASSES.ATTENTION,
    options,
  );
}


/* =============================================================================
   Animation State
   ============================================================================= */

function isAnimating(
  element,
) {
  const target =
    resolveElement(
      element,
    );

  if (!target) {
    return false;
  }

  const animations =
    activeAnimations.get(
      target,
    );

  return Boolean(
    animations &&
    animations.size > 0,
  );
}


function getActiveAnimations(
  element,
) {
  const target =
    resolveElement(
      element,
    );

  if (!target) {
    return [];
  }

  const animations =
    activeAnimations.get(
      target,
    );

  if (!animations) {
    return [];
  }

  return Array.from(
    animations,
  );
}


/* =============================================================================
   Accessibility
   ============================================================================= */

function isReducedMotionPreferred() {
  return prefersReducedMotion();
}


/* =============================================================================
   Public API
   ============================================================================= */

const animations =
  Object.freeze({
    ANIMATION_CLASSES,

    play,
    replay,
    remove,
    removeAll,

    fadeIn,
    fadeOut,

    slideIn,
    slideOut,

    scaleIn,

    shake,
    pulse,
    bounce,

    showCorrect,
    showIncorrect,
    showSuccess,
    showError,
    showAttention,

    isAnimating,
    getActiveAnimations,

    isReducedMotionPreferred,
  });


export {
  ANIMATION_CLASSES,

  play,
  replay,
  remove,
  removeAll,

  fadeIn,
  fadeOut,

  slideIn,
  slideOut,

  scaleIn,

  shake,
  pulse,
  bounce,

  showCorrect,
  showIncorrect,
  showSuccess,
  showError,
  showAttention,

  isAnimating,
  getActiveAnimations,

  isReducedMotionPreferred,
};


export default animations;