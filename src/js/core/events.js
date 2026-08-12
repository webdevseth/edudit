/**
 * =============================================================================
 * EduDit
 * Application Event Bus
 * =============================================================================
 *
 * Provides one lightweight event system for communication between otherwise
 * independent modules.
 *
 * Rules:
 *
 * - Features should not reach into other features directly when an event is
 *   sufficient.
 *
 * - Event names are centralized here.
 *
 * - Event listeners must be removable.
 *
 * - The event bus contains no application state.
 *
 * - New event names must be added to EVENT_NAMES before they can be emitted.
 * =============================================================================
 */

const EVENT_NAMES = Object.freeze({
  // ===========================================================================
  // Application
  // ===========================================================================

  APP_READY: "app:ready",
  APP_ERROR: "app:error",

  // ===========================================================================
  // Navigation
  // ===========================================================================

  ROUTE_BEFORE_CHANGE: "route:before-change",
  ROUTE_CHANGED: "route:changed",
  ROUTE_ERROR: "route:error",
  FEATURE_CLEANUP_ERROR: "feature:cleanup-error",

  // ===========================================================================
  // Profiles
  // ===========================================================================

  PROFILE_CREATED: "profile:created",
  PROFILE_SELECTED: "profile:selected",
  PROFILE_UPDATED: "profile:updated",
  PROFILE_DELETED: "profile:deleted",
  PROFILE_SWITCHING: "profile:switching",

  // ===========================================================================
  // Settings
  // ===========================================================================

  SETTINGS_CHANGED: "settings:changed",

  // ===========================================================================
  // Theme
  // ===========================================================================

  THEME_CHANGED: "theme:changed",

  // ===========================================================================
  // Curriculum / Progression
  // ===========================================================================

  CURRICULUM_UPDATED: "curriculum:updated",
  CHARACTER_UNLOCKED: "character:unlocked",
  MATERIAL_UNLOCKED: "material:unlocked",

  // ===========================================================================
  // Training
  // ===========================================================================

  TRAINING_STARTED: "training:started",
  TRAINING_PAUSED: "training:paused",
  TRAINING_RESUMED: "training:resumed",
  TRAINING_STOPPED: "training:stopped",
  TRAINING_COMPLETED: "training:completed",

  // ===========================================================================
  // Attempts
  // ===========================================================================

  ATTEMPT_STARTED: "attempt:started",
  ATTEMPT_COMPLETED: "attempt:completed",

  // ===========================================================================
  // Audio
  // ===========================================================================

  AUDIO_STARTED: "audio:started",
  AUDIO_STOPPED: "audio:stopped",

  // ===========================================================================
  // Persistence
  // ===========================================================================

  STORAGE_DIRTY: "storage:dirty",
  STORAGE_FLUSHED: "storage:flushed",
  STORAGE_ERROR: "storage:error",
});

/* =============================================================================
   Event Bus
   ============================================================================= */

class EventBus {
  #listeners = new Map();

  /* ===========================================================================
     Subscribe
     =========================================================================== */

  /**
   * Subscribe to an event.
   *
   * @param {string} eventName
   * @param {Function} listener
   * @returns {Function} unsubscribe function
   */
  on(eventName, listener) {
    this.#validateEventName(eventName);

    if (typeof listener !== "function") {
      throw new TypeError(
        "Event listener must be a function.",
      );
    }

    let listeners =
      this.#listeners.get(eventName);

    if (!listeners) {
      listeners = new Set();

      this.#listeners.set(
        eventName,
        listeners,
      );
    }

    listeners.add(listener);

    return () => {
      this.off(
        eventName,
        listener,
      );
    };
  }

  /**
   * Subscribe to an event once.
   *
   * @param {string} eventName
   * @param {Function} listener
   * @returns {Function} unsubscribe function
   */
  once(eventName, listener) {
    this.#validateEventName(eventName);

    if (typeof listener !== "function") {
      throw new TypeError(
        "Event listener must be a function.",
      );
    }

    let unsubscribe;

    const wrappedListener = (payload) => {
      unsubscribe();
      listener(payload);
    };

    unsubscribe = this.on(
      eventName,
      wrappedListener,
    );

    return unsubscribe;
  }

  /* ===========================================================================
     Unsubscribe
     =========================================================================== */

  /**
   * Remove a specific listener.
   *
   * @param {string} eventName
   * @param {Function} listener
   */
  off(eventName, listener) {
    this.#validateEventName(eventName);

    const listeners =
      this.#listeners.get(eventName);

    if (!listeners) {
      return;
    }

    listeners.delete(listener);

    if (listeners.size === 0) {
      this.#listeners.delete(eventName);
    }
  }

  /**
   * Remove every listener registered for an event.
   *
   * @param {string} eventName
   */
  clear(eventName) {
    this.#validateEventName(eventName);

    this.#listeners.delete(eventName);
  }

  /**
   * Remove every listener from the event bus.
   *
   * Primarily useful during teardown and tests.
   */
  clearAll() {
    this.#listeners.clear();
  }

  /* ===========================================================================
     Emit
     =========================================================================== */

  /**
   * Emit an event.
   *
   * Listeners are invoked synchronously in registration order.
   *
   * A listener throwing an error does not prevent other listeners from
   * receiving the event.
   *
   * @param {string} eventName
   * @param {*} payload
   */
  emit(eventName, payload) {
    this.#validateEventName(eventName);

    const listeners =
      this.#listeners.get(eventName);

    if (!listeners) {
      return;
    }

    /*
     * Copy the Set before dispatching.
     *
     * This allows a listener to safely unsubscribe itself or another listener
     * while the current event is being dispatched.
     */
    [...listeners].forEach((listener) => {
      try {
        listener(payload);
      } catch (error) {
        console.error(
          `[EduDit] Error in event listener for "${eventName}".`,
          error,
        );

        /*
         * Event listeners must not be able to break the rest of the event
         * dispatch chain.
         */
      }
    });
  }

  /* ===========================================================================
     Inspection
     =========================================================================== */

  /**
   * Determine whether an event currently has listeners.
   *
   * @param {string} eventName
   * @returns {boolean}
   */
  hasListeners(eventName) {
    this.#validateEventName(eventName);

    const listeners =
      this.#listeners.get(eventName);

    return Boolean(
      listeners &&
      listeners.size > 0,
    );
  }

  /**
   * Return the number of listeners registered for an event.
   *
   * @param {string} eventName
   * @returns {number}
   */
  listenerCount(eventName) {
    this.#validateEventName(eventName);

    return (
      this.#listeners.get(eventName)?.size ??
      0
    );
  }

  /**
   * Return the number of events currently containing listeners.
   *
   * @returns {number}
   */
  eventCount() {
    return this.#listeners.size;
  }

  /* ===========================================================================
     Validation
     =========================================================================== */

  /**
   * Validate event names so accidental typos do not silently create a new
   * event channel.
   *
   * @param {string} eventName
   */
  #validateEventName(eventName) {
    if (
      typeof eventName !== "string" ||
      eventName.length === 0
    ) {
      throw new TypeError(
        "Event name must be a non-empty string.",
      );
    }

    if (
      !Object.values(EVENT_NAMES).includes(
        eventName,
      )
    ) {
      throw new Error(
        `Unknown EduDit event "${eventName}". ` +
        "Add it to EVENT_NAMES first.",
      );
    }
  }
}

/* =============================================================================
   Singleton
   ============================================================================= */

const events = new EventBus();

/* =============================================================================
   Exports
   ============================================================================= */

export {
  EVENT_NAMES,
  EventBus,
};

export default events;