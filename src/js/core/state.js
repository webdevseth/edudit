/**
 * =============================================================================
 * EduDit
 * Application State
 * =============================================================================
 *
 * Central application state store.
 *
 * Important architectural rules:
 *
 * 1. Persistent learner data belongs to a profile.
 * 2. Temporary UI state does NOT belong in a profile.
 * 3. Selected material is NOT the same as unlocked material.
 * 4. Unlocked material is NOT the same as mastered material.
 * 5. The state module does not write to storage directly.
 *
 * Persistence is handled by storage.js.
 * =============================================================================
 */

import events, { EVENT_NAMES } from "./events.js";

/* =============================================================================
   Constants
   ============================================================================= */

/**
 * Current schema version for profile data.
 *
 * This is separate from the storage container version because the shape of an
 * individual profile can evolve independently from the persistence mechanism.
 */
const PROFILE_SCHEMA_VERSION = 1;

/**
 * Application-level defaults.
 */
const DEFAULT_APP_STATE = Object.freeze({
  ui: {
    currentView: "dashboard",
    selectedLessonId: null,
    selectedTrainingTarget: null,
    profileSelectorOpen: false,
  },
});

/**
 * Default learning settings.
 */
const DEFAULT_LEARNING_SETTINGS = Object.freeze({
  learningPace: "standard",
  trainingMode: "adaptive",
  sessionLength: 20,
});

/**
 * Default receive settings.
 */
const DEFAULT_RECEIVE_SETTINGS = Object.freeze({
  wpm: 20,
  toneFrequencyHz: 600,
  responseTiming: "after-audio",
  showKeyboard: true,
  hintBehavior: "manual",
});

/**
 * Default audio settings.
 */
const DEFAULT_AUDIO_SETTINGS = Object.freeze({
  backgroundNoiseEnabled: false,
  backgroundVolume: 0.08,
});

/**
 * Default appearance settings.
 */
const DEFAULT_APPEARANCE_SETTINGS = Object.freeze({
  theme: "system",
});

/**
 * Complete default settings.
 */
const DEFAULT_SETTINGS = Object.freeze({
  learning: DEFAULT_LEARNING_SETTINGS,
  receive: DEFAULT_RECEIVE_SETTINGS,
  audio: DEFAULT_AUDIO_SETTINGS,
  appearance: DEFAULT_APPEARANCE_SETTINGS,
});

/**
 * Default progression state.
 *
 * `highestUnlockedCharacter` is intentionally separate from the currently
 * selected lesson and from character mastery.
 *
 * A null value means the learner has not unlocked any character yet.
 */
const DEFAULT_PROGRESSION = Object.freeze({
  highestUnlockedCharacter: null,
  highestUnlockedWordLevel: null,
});

/**
 * Default aggregate statistics.
 */
const DEFAULT_STATISTICS = Object.freeze({
  totalAttempts: 0,
  totalCorrect: 0,
  totalSessions: 0,
  totalTrainingTimeMs: 0,
  currentStreak: 0,
  bestStreak: 0,
});

/* =============================================================================
   Utility Functions
   ============================================================================= */

/**
 * Create a unique identifier.
 *
 * This uses crypto.randomUUID when available and falls back to a timestamp-
 * based identifier for environments where it is unavailable.
 *
 * @returns {string}
 */
function createId() {
  if (
    typeof globalThis.crypto !== "undefined" &&
    typeof globalThis.crypto.randomUUID === "function"
  ) {
    return globalThis.crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Deep clone plain application data.
 *
 * Structured cloning is preferred because profile state contains nested
 * objects and arrays. The fallback is intentionally limited to JSON-safe data,
 * which is appropriate for our persisted state model.
 *
 * @param {*} value
 * @returns {*}
 */
function clone(value) {
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }

  return JSON.parse(JSON.stringify(value));
}

/**
 * Merge nested plain objects without mutating either source.
 *
 * Arrays and primitive values are replaced rather than merged.
 *
 * @param {Object} base
 * @param {Object} overrides
 * @returns {Object}
 */
function deepMerge(base, overrides) {
  const result = clone(base);

  if (!overrides || typeof overrides !== "object") {
    return result;
  }

  Object.entries(overrides).forEach(([key, value]) => {
    if (
      value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      result[key] &&
      typeof result[key] === "object" &&
      !Array.isArray(result[key])
    ) {
      result[key] = deepMerge(result[key], value);
    } else {
      result[key] = clone(value);
    }
  });

  return result;
}

/* =============================================================================
   Profile Factory
   ============================================================================= */

/**
 * Create a fresh learner profile.
 *
 * @param {string} name
 * @returns {Object}
 */
function createProfile(name) {
  const normalizedName =
    typeof name === "string" && name.trim().length > 0
      ? name.trim()
      : "Learner";

  return {
    schemaVersion: PROFILE_SCHEMA_VERSION,

    id: createId(),

    name: normalizedName,

    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),

    progression: clone(DEFAULT_PROGRESSION),

    statistics: clone(DEFAULT_STATISTICS),

    /**
     * Per-character learner statistics.
     *
     * Key:
     *   character symbol, e.g. "A"
     *
     * Value:
     *   character mastery/attempt data.
     *
     * This starts empty. Character records are created when the learner
     * actually encounters the character.
     */
    characterStats: {},

    /**
     * Word statistics will remain empty until word training is introduced.
     */
    wordStats: {},

    /**
     * Session history.
     *
     * Detailed sessions can eventually be retained here or moved into a
     * separate persistence unit if the data becomes large.
     */
    sessions: [],

    settings: clone(DEFAULT_SETTINGS),
  };
}

/* =============================================================================
   Application State Store
   ============================================================================= */

class StateStore {
  #state;

  #listeners = new Set();

  constructor() {
    this.#state = {
      ...clone(DEFAULT_APP_STATE),

      /**
       * Profiles are kept in memory only for profiles that have been loaded.
       *
       * The persistence layer is responsible for deciding how profiles are
       * physically stored.
       */
      profiles: {},

      /**
       * The active profile ID is application state, not profile data.
       */
      activeProfileId: null,

      /**
       * Temporary active training state.
       *
       * This must never be persisted as learner progress.
       */
      training: {
        active: false,
        sessionId: null,
        mode: null,
        target: null,
      },
    };
  }

  /* ===========================================================================
     Subscription
     =========================================================================== */

  /**
   * Subscribe to state changes.
   *
   * @param {Function} listener
   * @returns {Function} unsubscribe function
   */
  subscribe(listener) {
    if (typeof listener !== "function") {
      throw new TypeError("State listener must be a function.");
    }

    this.#listeners.add(listener);

    return () => {
      this.#listeners.delete(listener);
    };
  }

  /**
   * Notify subscribers after a state mutation.
   *
   * @param {Object} change
   */
  #notify(change) {
    const snapshot = this.getState();

    this.#listeners.forEach((listener) => {
      try {
        listener(snapshot, change);
      } catch (error) {
        console.error("[EduDit] State listener failed.", error);
      }
    });
  }

  /* ===========================================================================
     State Access
     =========================================================================== */

  /**
   * Get a defensive snapshot of the complete application state.
   *
   * Consumers cannot mutate internal state through this object.
   *
   * @returns {Object}
   */
  getState() {
    return clone(this.#state);
  }

  /**
   * Get the currently active profile.
   *
   * @returns {Object|null}
   */
  getActiveProfile() {
    const profileId = this.#state.activeProfileId;

    if (!profileId) {
      return null;
    }

    return this.#state.profiles[profileId]
      ? clone(this.#state.profiles[profileId])
      : null;
  }

  /**
   * Get a specific profile.
   *
   * @param {string} profileId
   * @returns {Object|null}
   */
  getProfile(profileId) {
    if (!profileId || !this.#state.profiles[profileId]) {
      return null;
    }

    return clone(this.#state.profiles[profileId]);
  }

  /**
   * Get the active profile ID.
   *
   * @returns {string|null}
   */
  getActiveProfileId() {
    return this.#state.activeProfileId;
  }

  /**
   * Get all loaded profiles.
   *
   * This returns lightweight profile information suitable for UI display.
   *
   * @returns {Array}
   */
  getProfiles() {
    return Object.values(this.#state.profiles).map((profile) => ({
      id: profile.id,
      name: profile.name,
      createdAt: profile.createdAt,
      updatedAt: profile.updatedAt,
    }));
  }

  /* ===========================================================================
     Profile Management
     =========================================================================== */

  /**
   * Add a newly created profile to state.
   *
   * This does not persist the profile. The storage layer handles persistence.
   *
   * @param {Object} profile
   * @returns {Object}
   */
  addProfile(profile) {
    const normalizedProfile = normalizeProfile(profile);

    if (this.#state.profiles[normalizedProfile.id]) {
      throw new Error(
        `A profile with ID "${normalizedProfile.id}" is already loaded.`,
      );
    }

    this.#state.profiles[normalizedProfile.id] = normalizedProfile;

    this.#touchProfile(normalizedProfile.id);

    this.#notify({
      type: "profile-added",
      profileId: normalizedProfile.id,
    });

    events.emit(EVENT_NAMES.PROFILE_CREATED, {
      profile: clone(normalizedProfile),
    });

    return clone(normalizedProfile);
  }

  /**
   * Create and add a profile.
   *
   * @param {string} name
   * @returns {Object}
   */
  createProfile(name) {
    const profile = createProfile(name);

    return this.addProfile(profile);
  }

  /**
   * Replace a loaded profile.
   *
   * Primarily used when loading profile data from persistence or during
   * controlled profile updates.
   *
   * @param {Object} profile
   * @returns {Object}
   */
  replaceProfile(profile) {
    const normalizedProfile = normalizeProfile(profile);

    this.#state.profiles[normalizedProfile.id] = normalizedProfile;

    this.#touchProfile(normalizedProfile.id);

    this.#notify({
      type: "profile-replaced",
      profileId: normalizedProfile.id,
    });

    return clone(normalizedProfile);
  }

  /**
   * Remove a profile from application state.
   *
   * Deleting the physical profile data is the responsibility of storage.js.
   *
   * @param {string} profileId
   */
  removeProfile(profileId) {
    if (!this.#state.profiles[profileId]) {
      return false;
    }

    const wasActive = this.#state.activeProfileId === profileId;

    delete this.#state.profiles[profileId];

    if (wasActive) {
      this.#state.activeProfileId = null;
    }

    this.#notify({
      type: "profile-removed",
      profileId,
    });

    events.emit(EVENT_NAMES.PROFILE_DELETED, {
      profileId,
      wasActive,
    });

    return true;
  }

  /**
   * Rename a profile.
   *
   * @param {string} profileId
   * @param {string} name
   * @returns {Object}
   */
  renameProfile(profileId, name) {
    const profile = this.#requireProfile(profileId);

    const normalizedName =
      typeof name === "string" ? name.trim() : "";

    if (!normalizedName) {
      throw new Error("Profile name cannot be empty.");
    }

    profile.name = normalizedName;
    this.#touchProfile(profileId);

    this.#notify({
      type: "profile-renamed",
      profileId,
    });

    events.emit(EVENT_NAMES.PROFILE_UPDATED, {
      profile: clone(profile),
      changes: {
        name: normalizedName,
      },
    });

    return clone(profile);
  }

  /**
   * Set the active profile.
   *
   * @param {string|null} profileId
   * @returns {Object|null}
   */
  setActiveProfile(profileId) {
    if (profileId !== null && !this.#state.profiles[profileId]) {
      throw new Error(`Cannot activate unknown profile "${profileId}".`);
    }

    const previousProfileId = this.#state.activeProfileId;

    if (previousProfileId === profileId) {
      return this.getActiveProfile();
    }

    events.emit(EVENT_NAMES.PROFILE_SWITCHING, {
      previousProfileId,
      nextProfileId: profileId,
    });

    this.#state.activeProfileId = profileId;

    this.#notify({
      type: "active-profile-changed",
      previousProfileId,
      profileId,
    });

    if (profileId) {
      events.emit(EVENT_NAMES.PROFILE_SELECTED, {
        profile: this.getProfile(profileId),
        previousProfileId,
      });
    }

    return this.getActiveProfile();
  }

  /* ===========================================================================
     Profile Updates
     =========================================================================== */

  /**
   * Update a profile using a controlled updater function.
   *
   * The updater receives a mutable internal profile reference. This method
   * exists specifically so profile mutations remain centralized.
   *
   * @param {string} profileId
   * @param {Function} updater
   * @returns {Object}
   */
  updateProfile(profileId, updater) {
    const profile = this.#requireProfile(profileId);

    if (typeof updater !== "function") {
      throw new TypeError("Profile updater must be a function.");
    }

    updater(profile);

    const normalizedProfile = normalizeProfile(profile);

    this.#state.profiles[profileId] = normalizedProfile;

    this.#touchProfile(profileId);

    this.#notify({
      type: "profile-updated",
      profileId,
    });

    events.emit(EVENT_NAMES.PROFILE_UPDATED, {
      profile: clone(normalizedProfile),
    });

    return clone(normalizedProfile);
  }

  /**
   * Update the active profile.
   *
   * @param {Function} updater
   * @returns {Object}
   */
  updateActiveProfile(updater) {
    const profileId = this.#requireActiveProfileId();

    return this.updateProfile(profileId, updater);
  }

  /* ===========================================================================
     Progression
     =========================================================================== */

  /**
   * Update progression without confusing it with selected training material.
   *
   * @param {Object} progression
   * @returns {Object}
   */
  updateProgression(progression) {
    return this.updateActiveProfile((profile) => {
      profile.progression = deepMerge(
        profile.progression,
        progression,
      );
    });
  }

  /**
   * Set the highest unlocked character.
   *
   * The value represents permanent progression and must never be reduced by
   * selecting an older lesson.
   *
   * @param {string} character
   * @returns {Object}
   */
  setHighestUnlockedCharacter(character) {
    const normalizedCharacter =
      typeof character === "string"
        ? character.trim().toUpperCase()
        : "";

    if (!normalizedCharacter) {
      throw new Error("Character cannot be empty.");
    }

    const profile = this.#requireActiveProfile();
    const previous = profile.progression.highestUnlockedCharacter;

    profile.progression.highestUnlockedCharacter = normalizedCharacter;

    this.#touchProfile(profile.id);

    this.#notify({
      type: "highest-character-unlocked",
      profileId: profile.id,
      previous,
      character: normalizedCharacter,
    });

    events.emit(EVENT_NAMES.CHARACTER_UNLOCKED, {
      profileId: profile.id,
      previous,
      character: normalizedCharacter,
    });

    return clone(profile.progression);
  }

  /* ===========================================================================
     Character Statistics
     =========================================================================== */

  /**
   * Get statistics for a character.
   *
   * @param {string} character
   * @returns {Object|null}
   */
  getCharacterStats(character) {
    const profile = this.#requireActiveProfile();
    const normalizedCharacter = normalizeCharacter(character);

    const stats = profile.characterStats[normalizedCharacter];

    return stats ? clone(stats) : null;
  }

  /**
   * Update statistics for a character.
   *
   * @param {string} character
   * @param {Function} updater
   * @returns {Object}
   */
  updateCharacterStats(character, updater) {
    const profile = this.#requireActiveProfile();
    const normalizedCharacter = normalizeCharacter(character);

    if (typeof updater !== "function") {
      throw new TypeError("Character statistics updater must be a function.");
    }

    if (!profile.characterStats[normalizedCharacter]) {
      profile.characterStats[normalizedCharacter] =
        createDefaultCharacterStats(normalizedCharacter);
    }

    updater(profile.characterStats[normalizedCharacter]);

    profile.characterStats[normalizedCharacter] = normalizeCharacterStats(
      profile.characterStats[normalizedCharacter],
      normalizedCharacter,
    );

    this.#touchProfile(profile.id);

    this.#notify({
      type: "character-stats-updated",
      profileId: profile.id,
      character: normalizedCharacter,
    });

    return clone(profile.characterStats[normalizedCharacter]);
  }

  /* ===========================================================================
     Session History
     =========================================================================== */

  /**
   * Add a completed session to the active profile.
   *
   * @param {Object} session
   * @returns {Object}
   */
  addSession(session) {
    const profile = this.#requireActiveProfile();

    if (!session || typeof session !== "object") {
      throw new TypeError("Session must be an object.");
    }

    const normalizedSession = {
      ...clone(session),
      id: session.id || createId(),
      profileId: profile.id,
    };

    profile.sessions.push(normalizedSession);

    profile.statistics.totalSessions += 1;

    this.#touchProfile(profile.id);

    this.#notify({
      type: "session-added",
      profileId: profile.id,
      sessionId: normalizedSession.id,
    });

    return clone(normalizedSession);
  }

  /* ===========================================================================
     UI State
     =========================================================================== */

  /**
   * Update temporary UI state.
   *
   * This state is intentionally not part of learner profiles.
   *
   * @param {Object} changes
   */
  updateUI(changes) {
    this.#state.ui = {
      ...this.#state.ui,
      ...clone(changes),
    };

    this.#notify({
      type: "ui-updated",
    });
  }

  /**
   * Set the current route/view.
   *
   * @param {string} view
   */
  setCurrentView(view) {
    if (typeof view !== "string" || !view.trim()) {
      throw new Error("View must be a non-empty string.");
    }

    this.updateUI({
      currentView: view.trim(),
    });
  }

  /**
   * Set currently selected lesson.
   *
   * This does NOT change progression.
   *
   * @param {string|null} lessonId
   */
  setSelectedLesson(lessonId) {
    this.updateUI({
      selectedLessonId: lessonId,
    });
  }

  /**
   * Set the current training target.
   *
   * This is temporary session state and does NOT represent progression.
   *
   * @param {Object|null} target
   */
  setSelectedTrainingTarget(target) {
    this.updateUI({
      selectedTrainingTarget: target ? clone(target) : null,
    });
  }

  /* ===========================================================================
     Training State
     =========================================================================== */

  /**
   * Start temporary training state.
   *
   * The actual session object belongs to the training/session system.
   *
   * @param {Object} trainingState
   */
  startTraining(trainingState) {
    this.#state.training = {
      active: true,
      sessionId: trainingState.sessionId ?? null,
      mode: trainingState.mode ?? null,
      target: trainingState.target
        ? clone(trainingState.target)
        : null,
    };

    this.#notify({
      type: "training-started",
    });
  }

  /**
   * Update temporary training state.
   *
   * @param {Object} changes
   */
  updateTraining(changes) {
    this.#state.training = {
      ...this.#state.training,
      ...clone(changes),
    };

    this.#notify({
      type: "training-updated",
    });
  }

  /**
   * Clear temporary training state.
   */
  clearTraining() {
    this.#state.training = {
      active: false,
      sessionId: null,
      mode: null,
      target: null,
    };

    this.#notify({
      type: "training-cleared",
    });
  }

  /* ===========================================================================
     Internal Helpers
     =========================================================================== */

  /**
   * Require a profile to exist.
   *
   * @param {string} profileId
   * @returns {Object}
   */
  #requireProfile(profileId) {
    const profile = this.#state.profiles[profileId];

    if (!profile) {
      throw new Error(`Unknown profile "${profileId}".`);
    }

    return profile;
  }

  /**
   * Require an active profile.
   *
   * @returns {Object}
   */
  #requireActiveProfile() {
    return this.#requireProfile(this.#requireActiveProfileId());
  }

  /**
   * Require an active profile ID.
   *
   * @returns {string}
   */
  #requireActiveProfileId() {
    const profileId = this.#state.activeProfileId;

    if (!profileId) {
      throw new Error("No active learner profile.");
    }

    return profileId;
  }

  /**
   * Update the profile's modification timestamp.
   *
   * @param {string} profileId
   */
  #touchProfile(profileId) {
    const profile = this.#state.profiles[profileId];

    if (profile) {
      profile.updatedAt = new Date().toISOString();
    }

    events.emit(EVENT_NAMES.STORAGE_DIRTY, {
      profileId,
    });
  }
}

/* =============================================================================
   Profile Normalization
   ============================================================================= */

/**
 * Normalize profile data loaded from persistence.
 *
 * This provides a defensive boundary between stored data and application
 * state. Future schema migrations can be introduced before normalization.
 *
 * @param {Object} profile
 * @returns {Object}
 */
function normalizeProfile(profile) {
  if (!profile || typeof profile !== "object") {
    throw new TypeError("Profile must be an object.");
  }

  if (!profile.id || typeof profile.id !== "string") {
    throw new Error("Profile is missing a valid ID.");
  }

  const normalized = deepMerge(createProfile(profile.name), profile);

  normalized.schemaVersion = PROFILE_SCHEMA_VERSION;
  normalized.id = profile.id;

  normalized.name =
    typeof profile.name === "string" && profile.name.trim()
      ? profile.name.trim()
      : "Learner";

  normalized.createdAt =
    typeof profile.createdAt === "string"
      ? profile.createdAt
      : new Date().toISOString();

  normalized.updatedAt =
    typeof profile.updatedAt === "string"
      ? profile.updatedAt
      : new Date().toISOString();

  normalized.progression = deepMerge(
    DEFAULT_PROGRESSION,
    profile.progression,
  );

  normalized.statistics = deepMerge(
    DEFAULT_STATISTICS,
    profile.statistics,
  );

  normalized.settings = deepMerge(
    DEFAULT_SETTINGS,
    profile.settings,
  );

  normalized.characterStats =
    profile.characterStats &&
    typeof profile.characterStats === "object" &&
    !Array.isArray(profile.characterStats)
      ? profile.characterStats
      : {};

  normalized.wordStats =
    profile.wordStats &&
    typeof profile.wordStats === "object" &&
    !Array.isArray(profile.wordStats)
      ? profile.wordStats
      : {};

  normalized.sessions = Array.isArray(profile.sessions)
    ? profile.sessions
    : [];

  Object.entries(normalized.characterStats).forEach(
    ([character, stats]) => {
      normalized.characterStats[character] =
        normalizeCharacterStats(stats, character);
    },
  );

  return normalized;
}

/**
 * Create the initial character statistics record.
 *
 * @param {string} character
 * @returns {Object}
 */
function createDefaultCharacterStats(character) {
  return {
    character,

    attempts: 0,
    correct: 0,

    accuracy: 0,
    recentAccuracy: 0,

    averageResponseTimeMs: null,
    recentResponseTimeMs: null,
    fastestResponseTimeMs: null,

    lastSeenAt: null,
    timesIntroduced: 0,
    timesMissed: 0,

    currentStreak: 0,

    masteryScore: 0,

    hintsUsed: 0,
  };
}

/**
 * Normalize character statistics.
 *
 * @param {Object} stats
 * @param {string} character
 * @returns {Object}
 */
function normalizeCharacterStats(stats, character) {
  const normalizedCharacter = normalizeCharacter(character);

  const defaults = createDefaultCharacterStats(normalizedCharacter);

  const normalized = {
    ...defaults,
    ...(stats && typeof stats === "object" ? clone(stats) : {}),
  };

  normalized.character = normalizedCharacter;

  normalized.attempts = nonNegativeInteger(normalized.attempts);
  normalized.correct = Math.min(
    nonNegativeInteger(normalized.correct),
    normalized.attempts,
  );

  normalized.accuracy = clamp(
    numericOrZero(normalized.accuracy),
    0,
    100,
  );

  normalized.recentAccuracy = clamp(
    numericOrZero(normalized.recentAccuracy),
    0,
    100,
  );

  normalized.averageResponseTimeMs =
    nullablePositiveNumber(normalized.averageResponseTimeMs);

  normalized.recentResponseTimeMs =
    nullablePositiveNumber(normalized.recentResponseTimeMs);

  normalized.fastestResponseTimeMs =
    nullablePositiveNumber(normalized.fastestResponseTimeMs);

  normalized.timesIntroduced = nonNegativeInteger(
    normalized.timesIntroduced,
  );

  normalized.timesMissed = nonNegativeInteger(
    normalized.timesMissed,
  );

  normalized.currentStreak = nonNegativeInteger(
    normalized.currentStreak,
  );

  normalized.masteryScore = clamp(
    numericOrZero(normalized.masteryScore),
    0,
    100,
  );

  normalized.hintsUsed = nonNegativeInteger(
    normalized.hintsUsed,
  );

  return normalized;
}

/**
 * Normalize a character symbol.
 *
 * @param {string} character
 * @returns {string}
 */
function normalizeCharacter(character) {
  if (typeof character !== "string") {
    throw new TypeError("Character must be a string.");
  }

  const normalized = character.trim().toUpperCase();

  if (!normalized) {
    throw new Error("Character cannot be empty.");
  }

  return normalized;
}

/**
 * @param {*} value
 * @returns {number}
 */
function numericOrZero(value) {
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}

/**
 * @param {*} value
 * @returns {number}
 */
function nonNegativeInteger(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return 0;
  }

  return Math.max(0, Math.floor(number));
}

/**
 * @param {*} value
 * @returns {number|null}
 */
function nullablePositiveNumber(value) {
  if (value === null || value === undefined) {
    return null;
  }

  const number = Number(value);

  if (!Number.isFinite(number) || number < 0) {
    return null;
  }

  return number;
}

/**
 * @param {number} value
 * @param {number} minimum
 * @param {number} maximum
 * @returns {number}
 */
function clamp(value, minimum, maximum) {
  return Math.min(Math.max(value, minimum), maximum);
}

/* =============================================================================
   Store
   ============================================================================= */

const state = new StateStore();

/* =============================================================================
   Exports
   ============================================================================= */

export {
  PROFILE_SCHEMA_VERSION,
  DEFAULT_APP_STATE,
  DEFAULT_LEARNING_SETTINGS,
  DEFAULT_RECEIVE_SETTINGS,
  DEFAULT_AUDIO_SETTINGS,
  DEFAULT_APPEARANCE_SETTINGS,
  DEFAULT_SETTINGS,
  DEFAULT_PROGRESSION,
  DEFAULT_STATISTICS,
  createProfile,
  createDefaultCharacterStats,
  normalizeProfile,
  normalizeCharacterStats,
  state,
};

export default state;