/**
 * =============================================================================
 * EduDit
 * Application Bootstrap
 * =============================================================================
 *
 * This is the renderer-process composition root.
 *
 * Responsibilities:
 *
 * - Initialize persistent storage.
 * - Load learner profiles.
 * - Establish the active learner.
 * - Initialize the theme system.
 * - Register application features with the router.
 * - Start routing.
 * - Keep application-wide lifecycle concerns out of individual features.
 *
 * This file does NOT contain:
 *
 * - training algorithms
 * - curriculum rules
 * - mastery calculations
 * - persistence implementation
 * - view-specific UI logic
 *
 * Those responsibilities remain in their dedicated modules.
 * =============================================================================
 */

import events, {
  EVENT_NAMES,
} from "./core/events.js";

import router from "./core/router.js";

import state from "./core/state.js";

import storage from "./core/storage.js";

import theme from "./core/theme.js";

import profileService from "./services/profileService.js";

import settingsService from "./services/settingsService.js";

import dashboardFeature from "./features/dashboard.js";

import lessonsFeature from "./features/lessons.js";

import receiveFeature from "./features/receive.js";

import sendFeature from "./features/send.js";

import progressFeature from "./features/progress.js";

import settingsFeature from "./features/settings.js";

import profilesFeature from "./features/profiles.js";


/* =============================================================================
   Application State
   ============================================================================= */

let initialized = false;

let shuttingDown = false;

let cleanupFunctions = [];


/* =============================================================================
   Utility
   ============================================================================= */

/**
 * Register a cleanup callback.
 *
 * @param {Function} cleanup
 */
function registerCleanup(cleanup) {
  if (typeof cleanup !== "function") {
    throw new TypeError(
      "Application cleanup must be a function.",
    );
  }

  cleanupFunctions.push(cleanup);
}


/**
 * Run registered cleanup callbacks in reverse order.
 *
 * @returns {Promise<void>}
 */
async function runCleanup() {
  const callbacks = cleanupFunctions.reverse();

  cleanupFunctions = [];

  for (const cleanup of callbacks) {
    try {
      await cleanup();
    } catch (error) {
      console.error(
        "[EduDit] Application cleanup failed.",
        error,
      );
    }
  }
}


/**
 * Report an application-level error.
 *
 * @param {*} error
 * @param {string} phase
 */
function reportApplicationError(
  error,
  phase,
) {
  console.error(
    `[EduDit] Application initialization failed during ${phase}.`,
    error,
  );

  events.emit(
    EVENT_NAMES.APP_ERROR,
    {
      error,
      phase,
    },
  );
}


/* =============================================================================
   Feature Registration
   ============================================================================= */

/**
 * Register every route feature with the router.
 *
 * Features are imported here rather than by the router so the router remains
 * independent of application-specific modules.
 */
function registerFeatures() {
  const features = [
    [
      "dashboard",
      dashboardFeature,
    ],

    [
      "lessons",
      lessonsFeature,
    ],

    [
      "receive",
      receiveFeature,
    ],

    [
      "send",
      sendFeature,
    ],

    [
      "progress",
      progressFeature,
    ],

    [
      "settings",
      settingsFeature,
    ],

    [
      "profiles",
      profilesFeature,
    ],
  ];

  features.forEach(
    ([name, feature]) => {
      router.registerFeature(
        name,
        feature,
      );
    },
  );
}


/* =============================================================================
   Profile Initialization
   ============================================================================= */

/**
 * Initialize learner profiles.
 *
 * Existing persisted profiles are loaded into application state.
 *
 * If no profiles exist, a first learner profile is created. This gives the
 * application a valid learner context without putting profile-creation logic
 * inside individual views.
 *
 * @returns {Promise<Object>}
 */
async function initializeProfiles() {
  const profiles =
    await profileService.initialize();

  if (profiles.length === 0) {
    const profile =
      await profileService.createProfile(
        "Learner",
      );

    return profile;
  }

  const activeProfile =
    profileService.getActiveProfile();

  return (
    activeProfile ??
    profiles[0]
  );
}


/* =============================================================================
   Theme Initialization
   ============================================================================= */

/**
 * Initialize the visual theme from the active learner's settings.
 */
function initializeTheme() {
  const settings =
    settingsService.getSettings();

  theme.initialize(
    settings.appearance.theme,
  );
}


/* =============================================================================
   Application Initialization
   ============================================================================= */

/**
 * Initialize the renderer application.
 *
 * This function is intentionally idempotent.
 *
 * @returns {Promise<void>}
 */
async function initialize() {
  if (initialized) {
    return;
  }

  try {
    /*
     * Persistence must be available before profiles are loaded.
     */
    await storage.initialize();

    registerCleanup(
      () => storage.shutdown(),
    );

    /*
     * Establish the learner context before feature modules start.
     */
    await initializeProfiles();

    /*
     * Apply learner-specific visual preferences.
     */
    initializeTheme();

    /*
     * Register all route features before the router begins navigation.
     */
    registerFeatures();

    /*
     * Initialize navigation only after the application foundation exists.
     */
    router.initialize();

    registerCleanup(
      () => router.destroy(),
    );

    /*
     * Synchronize application UI with the active profile.
     */
    profileService.bindApplicationEvents();

    registerCleanup(
      () => profileService.destroy(),
    );

    /*
     * Begin routing from the current URL.
     *
     * Router navigation is intentionally started last so no feature can mount
     * before storage, profile state, theme, and feature registration exist.
     */
    await router.navigate(
      router.getCurrentRouteId() ??
        "dashboard",
      {},
      {
        replace: true,
      },
    );

    initialized = true;

    events.emit(
      EVENT_NAMES.APP_READY,
      {
        profile:
          state.getActiveProfile(),
      },
    );
  } catch (error) {
    reportApplicationError(
      error,
      "initialization",
    );

    const container =
      document.querySelector(
        "#view-container",
      );

    if (container) {
      container.innerHTML = `
        <section
          class="view-error"
          role="alert"
        >
          <div class="view-error__content">
            <h1>EduDit could not start</h1>

            <p>
              The application encountered a startup problem.
              Your saved learner data has not been intentionally changed.
            </p>

            <button
              type="button"
              data-app-retry
            >
              Try again
            </button>
          </div>
        </section>
      `;
    }
  }
}


/* =============================================================================
   Retry Handling
   ============================================================================= */

function handleRetry(event) {
  const button =
    event.target.closest(
      "[data-app-retry]",
    );

  if (!button) {
    return;
  }

  event.preventDefault();

  void initialize();
}


/* =============================================================================
   Shutdown
   ============================================================================= */

async function shutdown() {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;

  try {
    await runCleanup();
  } finally {
    initialized = false;
    shuttingDown = false;
  }
}


/* =============================================================================
   Browser Lifecycle
   ============================================================================= */

document.addEventListener(
  "click",
  handleRetry,
);

window.addEventListener(
  "beforeunload",
  () => {
    /*
     * beforeunload cannot reliably await asynchronous operations.
     *
     * The primary Electron shutdown path is handled below through the
     * application lifecycle bridge when available.
     */
    void shutdown();
  },
);


/* =============================================================================
   Startup
   ============================================================================= */

void initialize();


/* =============================================================================
   Exports
   ============================================================================= */

export {
  initialize,
  shutdown,
};