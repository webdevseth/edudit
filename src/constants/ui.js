/**
 * =============================================================================
 * EduDit
 * UI Constants
 * =============================================================================
 *
 * Centralized configuration for application-level UI behavior.
 * =============================================================================
 */


/* =============================================================================
   Views
   ============================================================================= */


const VIEW_NAMES = Object.freeze({
  DASHBOARD: "dashboard",
  LESSONS: "lessons",
  RECEIVE: "receive",
  SEND: "send",
  PROGRESS: "progress",
  SETTINGS: "settings",
  PROFILES: "profiles",
});


/**
 * The initial application view.
 */
const DEFAULT_VIEW = VIEW_NAMES.DASHBOARD;


/* =============================================================================
   Theme
   ============================================================================= */


const THEME = Object.freeze({
  LIGHT: "light",
  DARK: "dark",
  SYSTEM: "system",
});


const DEFAULT_THEME = THEME.SYSTEM;


/* =============================================================================
   Animation
   ============================================================================= */


/**
 * Standard animation durations in milliseconds.
 *
 * Keep these values centralized so motion remains consistent throughout the
 * application.
 */
const ANIMATION_DURATION = Object.freeze({
  FAST: 120,
  NORMAL: 180,
  MEDIUM: 240,
  SLOW: 360,
});


/**
 * Delay between sequential UI animation steps.
 */
const ANIMATION_STAGGER_MS = 40;


/* =============================================================================
   Feedback
   ============================================================================= */


/**
 * Duration for transient feedback messages.
 */
const FEEDBACK_DURATION_MS = 1200;


/**
 * Duration for incorrect/correct visual feedback.
 */
const ANSWER_FEEDBACK_DURATION_MS = 500;


/* =============================================================================
   Dashboard
   ============================================================================= */


/**
 * Maximum number of recently unlocked characters shown on the dashboard.
 */
const RECENTLY_LEARNED_LIMIT = 4;


/**
 * Maximum number of dashboard statistics shown in the primary summary.
 */
const DASHBOARD_STATISTICS_LIMIT = 6;


/* =============================================================================
   Progress
   ============================================================================= */


/**
 * Maximum number of characters displayed in compact weakness summaries.
 */
const WEAK_CHARACTER_DISPLAY_LIMIT = 5;


/**
 * Maximum number of recent sessions displayed in compact views.
 */
const RECENT_SESSION_DISPLAY_LIMIT = 5;


/* =============================================================================
   Keyboard
   ============================================================================= */


/**
 * Whether the training keyboard is visible by default.
 */
const DEFAULT_SHOW_TRAINING_KEYBOARD = true;


/**
 * Whether unknown curriculum characters should be visually muted.
 */
const DEFAULT_MUTE_UNKNOWN_KEYS = true;


/* =============================================================================
   Accessibility
   ============================================================================= */


/**
 * Default reduced-motion behavior.
 *
 * `auto` means the application follows the user's
 * `prefers-reduced-motion` preference.
 */
const REDUCED_MOTION_MODE = Object.freeze({
  AUTO: "auto",
  REDUCED: "reduced",
  FULL: "full",
});


const DEFAULT_REDUCED_MOTION_MODE =
  REDUCED_MOTION_MODE.AUTO;


/* =============================================================================
   Responsive Layout
   ============================================================================= */


/**
 * Useful layout breakpoints.
 *
 * These are primarily consumed by CSS/JS that needs to make a UI decision
 * based on available space.
 */
const BREAKPOINTS = Object.freeze({
  MOBILE: 640,
  TABLET: 900,
  DESKTOP: 1200,
});


/* =============================================================================
   Exports
   ============================================================================= */


export {
  VIEW_NAMES,
  DEFAULT_VIEW,

  THEME,
  DEFAULT_THEME,

  ANIMATION_DURATION,
  ANIMATION_STAGGER_MS,

  FEEDBACK_DURATION_MS,
  ANSWER_FEEDBACK_DURATION_MS,

  RECENTLY_LEARNED_LIMIT,
  DASHBOARD_STATISTICS_LIMIT,

  WEAK_CHARACTER_DISPLAY_LIMIT,
  RECENT_SESSION_DISPLAY_LIMIT,

  DEFAULT_SHOW_TRAINING_KEYBOARD,
  DEFAULT_MUTE_UNKNOWN_KEYS,

  REDUCED_MOTION_MODE,
  DEFAULT_REDUCED_MOTION_MODE,

  BREAKPOINTS,
};


export default {
  VIEW_NAMES,
  DEFAULT_VIEW,

  THEME,
  DEFAULT_THEME,

  ANIMATION_DURATION,
  ANIMATION_STAGGER_MS,

  FEEDBACK_DURATION_MS,
  ANSWER_FEEDBACK_DURATION_MS,

  RECENTLY_LEARNED_LIMIT,
  DASHBOARD_STATISTICS_LIMIT,

  WEAK_CHARACTER_DISPLAY_LIMIT,
  RECENT_SESSION_DISPLAY_LIMIT,

  DEFAULT_SHOW_TRAINING_KEYBOARD,
  DEFAULT_MUTE_UNKNOWN_KEYS,

  REDUCED_MOTION_MODE,
  DEFAULT_REDUCED_MOTION_MODE,

  BREAKPOINTS,
};