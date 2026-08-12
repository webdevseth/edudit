/**
 * =============================================================================
 * EduDit
 * Storage Service
 * =============================================================================
 *
 * The application's authoritative persistence service.
 *
 * Rules:
 *
 *   - No feature, model, training module, or UI module should access
 *     window.edudit.storage directly.
 *
 *   - No application module should access localStorage directly.
 *
 *   - All persistent application data passes through this service.
 *
 *   - Writes are batched/debounced to reduce unnecessary disk activity.
 *
 *   - Persistence failures are surfaced through the application event bus.
 * =============================================================================
 */


/* =============================================================================
   Imports
   ============================================================================= */


import events, {
  EVENT_NAMES,
} from "../core/events.js";


/* =============================================================================
   Constants
   ============================================================================= */


const STORAGE_NAMESPACE =
  "edudit";


const STORAGE_VERSION = 1;


const WRITE_DEBOUNCE_MS = 100;


const DEFAULT_STORAGE_STATE =
  Object.freeze({
    version: STORAGE_VERSION,

    profiles: {},

    activeProfileId: null,

    settings: {},
  });


/* =============================================================================
   Internal State
   ============================================================================= */


let initialized = false;

let state = createDefaultState();

let writeTimer = null;

let writeInProgress = false;


/* =============================================================================
   Utilities
   ============================================================================= */


/**
 * Create a fresh storage state.
 *
 * @returns {Object}
 */
function createDefaultState() {
  return {
    version:
      DEFAULT_STORAGE_STATE.version,

    profiles: {},

    activeProfileId:
      DEFAULT_STORAGE_STATE.activeProfileId,

    settings: {},
  };
}


/**
 * Create a defensive copy of an object.
 *
 * @param {*} value
 * @returns {*}
 */
function clone(value) {
  if (
    value === null ||
    value === undefined
  ) {
    return value;
  }

  if (
    typeof structuredClone ===
      "function"
  ) {
    return structuredClone(value);
  }

  return JSON.parse(
    JSON.stringify(value),
  );
}


/**
 * Return the underlying persistence adapter.
 *
 * Electron's preload layer should expose this adapter through
 * window.edudit.storage.
 *
 * @returns {Object|null}
 */
function getAdapter() {
  if (
    typeof window ===
      "undefined"
  ) {
    return null;
  }

  const adapter =
    window.edudit?.storage;

  if (
    !adapter ||
    typeof adapter !==
      "object"
  ) {
    return null;
  }

  return adapter;
}


/**
 * Validate the storage state.
 *
 * @param {*} candidate
 * @returns {Object}
 */
function normalizeState(candidate) {
  if (
    !candidate ||
    typeof candidate !==
      "object"
  ) {
    return createDefaultState();
  }

  return {
    version:
      Number.isInteger(
        candidate.version,
      )
        ? candidate.version
        : STORAGE_VERSION,

    profiles:
      candidate.profiles &&
      typeof candidate.profiles ===
        "object"
        ? {
            ...candidate.profiles,
          }
        : {},

    activeProfileId:
      candidate.activeProfileId ??
      null,

    settings:
      candidate.settings &&
      typeof candidate.settings ===
        "object"
        ? {
            ...candidate.settings,
          }
        : {},
  };
}


/* =============================================================================
   Adapter Operations
   ============================================================================= */


/**
 * Read the persisted namespace.
 *
 * The preload adapter may expose either:
 *
 *   get(namespace)
 *
 * or
 *
 *   load(namespace)
 *
 * This service supports both forms so the persistence boundary remains
 * independent of the exact preload implementation.
 *
 * @returns {Promise<*>}
 */
async function readPersistedState() {
  const adapter =
    getAdapter();

  if (!adapter) {
    throw new Error(
      "EduDit storage adapter is unavailable.",
    );
  }

  if (
    typeof adapter.get ===
    "function"
  ) {
    return adapter.get(
      STORAGE_NAMESPACE,
    );
  }

  if (
    typeof adapter.load ===
    "function"
  ) {
    return adapter.load(
      STORAGE_NAMESPACE,
    );
  }

  throw new Error(
    "EduDit storage adapter does not provide get() or load().",
  );
}


/**
 * Persist the current state.
 *
 * Supports both:
 *
 *   set(namespace, value)
 *
 * and:
 *
 *   save(namespace, value)
 *
 * @param {Object} value
 * @returns {Promise<*>}
 */
async function persistState(value) {
  const adapter =
    getAdapter();

  if (!adapter) {
    throw new Error(
      "EduDit storage adapter is unavailable.",
    );
  }

  if (
    typeof adapter.set ===
    "function"
  ) {
    return adapter.set(
      STORAGE_NAMESPACE,
      clone(value),
    );
  }

  if (
    typeof adapter.save ===
    "function"
  ) {
    return adapter.save(
      STORAGE_NAMESPACE,
      clone(value),
    );
  }

  throw new Error(
    "EduDit storage adapter does not provide set() or save().",
  );
}


/* =============================================================================
   Initialization
   ============================================================================= */


/**
 * Initialize the storage service.
 *
 * Safe to call more than once.
 *
 * @returns {Promise<Object>}
 */
async function initializeStorage() {
  if (initialized) {
    return clone(state);
  }

  try {
    const persisted =
      await readPersistedState();

    state =
      normalizeState(
        persisted,
      );

    initialized = true;

    return clone(state);
  } catch (error) {
    /*
     * Storage being unavailable should not leave the entire application
     * unusable. We start with clean in-memory state and report the failure.
     */
    state =
      createDefaultState();

    initialized = true;

    events.emit(
      EVENT_NAMES.STORAGE_ERROR,
      {
        operation: "read",
        error,
      },
    );

    return clone(state);
  }
}


/**
 * Determine whether storage has been initialized.
 *
 * @returns {boolean}
 */
function isStorageInitialized() {
  return initialized;
}


/* =============================================================================
   State Access
   ============================================================================= */


/**
 * Return the complete current storage state.
 *
 * @returns {Object}
 */
function getState() {
  return clone(state);
}


/**
 * Get a value from the top-level storage state.
 *
 * @param {string} key
 * @returns {*}
 */
function get(key) {
  if (
    typeof key !==
    "string"
  ) {
    return undefined;
  }

  return clone(
    state[key],
  );
}


/**
 * Replace a top-level storage value.
 *
 * @param {string} key
 * @param {*} value
 * @returns {*}
 */
function set(
  key,
  value,
) {
  if (
    typeof key !==
    "string" ||
    key.length === 0
  ) {
    throw new TypeError(
      "Storage key must be a non-empty string.",
    );
  }

  state = {
    ...state,

    [key]:
      clone(value),
  };

  scheduleWrite();

  events.emit(
    EVENT_NAMES.STORAGE_DIRTY,
    {
      key,
    },
  );

  return clone(
    state[key],
  );
}


/**
 * Update multiple top-level values.
 *
 * @param {Object} updates
 * @returns {Object}
 */
function update(updates = {}) {
  if (
    !updates ||
    typeof updates !==
      "object"
  ) {
    throw new TypeError(
      "Storage updates must be an object.",
    );
  }

  state = {
    ...state,
    ...clone(updates),
  };

  scheduleWrite();

  events.emit(
    EVENT_NAMES.STORAGE_DIRTY,
    {
      keys:
        Object.keys(updates),
    },
  );

  return clone(state);
}


/* =============================================================================
   Profiles
   ============================================================================= */


/**
 * Get all persisted profiles.
 *
 * @returns {Object}
 */
function getProfiles() {
  return clone(
    state.profiles,
  );
}


/**
 * Get one profile.
 *
 * @param {string} profileId
 * @returns {Object|null}
 */
function getProfile(profileId) {
  if (
    profileId === null ||
    profileId === undefined
  ) {
    return null;
  }

  return clone(
    state.profiles[
      profileId
    ] ?? null,
  );
}


/**
 * Save one profile.
 *
 * @param {Object} profile
 * @returns {Object}
 */
function saveProfile(profile) {
  if (
    !profile ||
    typeof profile !==
      "object"
  ) {
    throw new TypeError(
      "Profile must be an object.",
    );
  }

  if (
    profile.id === null ||
    profile.id === undefined ||
    String(profile.id).length ===
      0
  ) {
    throw new TypeError(
      "Profile must have an id.",
    );
  }

  const profileId =
    String(profile.id);

  state = {
    ...state,

    profiles: {
      ...state.profiles,

      [profileId]:
        clone(profile),
    },
  };

  scheduleWrite();

  events.emit(
    EVENT_NAMES.STORAGE_DIRTY,
    {
      key:
        `profiles.${profileId}`,
    },
  );

  return clone(profile);
}


/**
 * Delete a profile.
 *
 * @param {string} profileId
 * @returns {boolean}
 */
function deleteProfile(profileId) {
  if (
    profileId === null ||
    profileId === undefined
  ) {
    return false;
  }

  const id =
    String(profileId);

  if (
    !Object.prototype.hasOwnProperty.call(
      state.profiles,
      id,
    )
  ) {
    return false;
  }

  const profiles = {
    ...state.profiles,
  };

  delete profiles[id];

  state = {
    ...state,

    profiles,

    activeProfileId:
      state.activeProfileId === id
        ? null
        : state.activeProfileId,
  };

  scheduleWrite();

  events.emit(
    EVENT_NAMES.STORAGE_DIRTY,
    {
      key:
        `profiles.${id}`,
    },
  );

  return true;
}


/* =============================================================================
   Active Profile
   ============================================================================= */


/**
 * Get the active profile ID.
 *
 * @returns {string|null}
 */
function getActiveProfileId() {
  return (
    state.activeProfileId ??
    null
  );
}


/**
 * Set the active profile ID.
 *
 * @param {string|null} profileId
 * @returns {string|null}
 */
function setActiveProfileId(
  profileId,
) {
  const normalized =
    profileId === null ||
    profileId === undefined
      ? null
      : String(profileId);

  if (
    normalized !== null &&
    !Object.prototype.hasOwnProperty.call(
      state.profiles,
      normalized,
    )
  ) {
    throw new Error(
      `Cannot activate unknown profile "${normalized}".`,
    );
  }

  state = {
    ...state,

    activeProfileId:
      normalized,
  };

  scheduleWrite();

  events.emit(
    EVENT_NAMES.STORAGE_DIRTY,
    {
      key:
        "activeProfileId",
    },
  );

  return normalized;
}


/* =============================================================================
   Settings
   ============================================================================= */


/**
 * Get persisted application settings.
 *
 * @returns {Object}
 */
function getSettings() {
  return clone(
    state.settings,
  );
}


/**
 * Save application settings.
 *
 * @param {Object} settings
 * @returns {Object}
 */
function saveSettings(settings) {
  if (
    !settings ||
    typeof settings !==
      "object"
  ) {
    throw new TypeError(
      "Settings must be an object.",
    );
  }

  state = {
    ...state,

    settings:
      clone(settings),
  };

  scheduleWrite();

  events.emit(
    EVENT_NAMES.STORAGE_DIRTY,
    {
      key:
        "settings",
    },
  );

  return clone(
    state.settings,
  );
}


/* =============================================================================
   Writes
   ============================================================================= */


/**
 * Schedule a debounced persistence write.
 *
 * @returns {void}
 */
function scheduleWrite() {
  if (writeTimer !== null) {
    clearTimeout(
      writeTimer,
    );
  }

  writeTimer =
    setTimeout(
      () => {
        writeTimer = null;

        void flush();
      },
      WRITE_DEBOUNCE_MS,
    );
}


/**
 * Immediately persist all pending changes.
 *
 * @returns {Promise<boolean>}
 */
async function flush() {
  if (writeInProgress) {
    return false;
  }

  writeInProgress = true;

  try {
    await persistState(
      state,
    );

    events.emit(
      EVENT_NAMES.STORAGE_FLUSHED,
      {
        timestamp:
          Date.now(),
      },
    );

    return true;
  } catch (error) {
    events.emit(
      EVENT_NAMES.STORAGE_ERROR,
      {
        operation: "write",
        error,
      },
    );

    return false;
  } finally {
    writeInProgress = false;
  }
}


/**
 * Flush pending changes before application shutdown.
 *
 * @returns {Promise<boolean>}
 */
async function shutdownStorage() {
  if (writeTimer !== null) {
    clearTimeout(
      writeTimer,
    );

    writeTimer = null;
  }

  return flush();
}


/* =============================================================================
   Reset
   ============================================================================= */


/**
 * Clear all application storage.
 *
 * This is intentionally explicit and should only be called by a deliberate
 * reset/import workflow.
 *
 * @returns {Promise<boolean>}
 */
async function clear() {
  state =
    createDefaultState();

  if (writeTimer !== null) {
    clearTimeout(
      writeTimer,
    );

    writeTimer = null;
  }

  const adapter =
    getAdapter();

  if (!adapter) {
    events.emit(
      EVENT_NAMES.STORAGE_ERROR,
      {
        operation: "clear",
        error:
          new Error(
            "EduDit storage adapter is unavailable.",
          ),
      },
    );

    return false;
  }

  try {
    if (
      typeof adapter.remove ===
      "function"
    ) {
      await adapter.remove(
        STORAGE_NAMESPACE,
      );
    } else if (
      typeof adapter.delete ===
      "function"
    ) {
      await adapter.delete(
        STORAGE_NAMESPACE,
      );
    } else {
      await persistState(
        state,
      );
    }

    events.emit(
      EVENT_NAMES.STORAGE_FLUSHED,
      {
        operation: "clear",
        timestamp:
          Date.now(),
      },
    );

    return true;
  } catch (error) {
    events.emit(
      EVENT_NAMES.STORAGE_ERROR,
      {
        operation: "clear",
        error,
      },
    );

    return false;
  }
}


/* =============================================================================
   Exports
   ============================================================================= */


export {
  STORAGE_NAMESPACE,
  STORAGE_VERSION,
  WRITE_DEBOUNCE_MS,
  DEFAULT_STORAGE_STATE,

  initializeStorage,
  isStorageInitialized,

  getState,
  get,
  set,
  update,

  getProfiles,
  getProfile,
  saveProfile,
  deleteProfile,

  getActiveProfileId,
  setActiveProfileId,

  getSettings,
  saveSettings,

  flush,
  shutdownStorage,
  clear,
};


export default {
  initializeStorage,
  isStorageInitialized,

  getState,
  get,
  set,
  update,

  getProfiles,
  getProfile,
  saveProfile,
  deleteProfile,

  getActiveProfileId,
  setActiveProfileId,

  getSettings,
  saveSettings,

  flush,
  shutdownStorage,
  clear,
};