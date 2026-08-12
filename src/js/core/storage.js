/**
 * =============================================================================
 * EduDit
 * Persistence Service
 * =============================================================================
 *
 * The authoritative persistence abstraction for the renderer.
 *
 * Nothing outside this module should access:
 *
 *   window.edudit.storage
 *   localStorage
 *   filesystem APIs
 *   Electron persistence APIs
 *
 * Persistence responsibilities:
 *
 * - Load the profile index.
 * - Load individual profiles.
 * - Save individual profiles.
 * - Delete individual profiles.
 * - Batch/debounce profile writes.
 * - Flush pending writes.
 * - Maintain schema versions.
 * - Recover from malformed persisted data.
 * - Provide a migration boundary for future schema changes.
 *
 * The renderer never performs filesystem operations directly.
 * =============================================================================
 */

import events, { EVENT_NAMES } from "./events.js";
import {
  PROFILE_SCHEMA_VERSION,
  createProfile,
  normalizeProfile,
} from "./state.js";

/* =============================================================================
   Storage Constants
   ============================================================================= */

const STORAGE_VERSION = 1;

const PROFILE_INDEX_VERSION = 1;

/**
 * The persistence layer intentionally owns these names.
 *
 * The native Electron implementation behind window.edudit.storage may map
 * these logical names to actual files.
 */
const STORAGE_KEYS = Object.freeze({
  PROFILE_INDEX: "profile-index",
  PROFILE: "profile",
});

/**
 * Persistence batching configuration.
 *
 * A receive attempt may occur every few seconds, so we do not want to rewrite
 * the profile file after every attempt.
 */
const DEFAULT_FLUSH_DELAY_MS = 2500;

const MAX_PENDING_WRITES = 20;

/**
 * A profile should always have a reasonable upper bound on the amount of
 * retained session history.
 *
 * This is not intended to be the final analytics storage strategy. It simply
 * prevents an indefinitely growing profile file during the MVP.
 */
const MAX_SESSION_HISTORY = 500;

/* =============================================================================
   Errors
   ============================================================================= */

class StorageError extends Error {
  constructor(message, options = {}) {
    super(message);

    this.name = "StorageError";

    this.operation = options.operation ?? null;
    this.profileId = options.profileId ?? null;
    this.cause = options.cause ?? null;
    this.recoverable = options.recoverable ?? false;
  }
}

/* =============================================================================
   Native Storage Bridge
   ============================================================================= */

/**
 * Get the narrow storage bridge exposed by preload.js.
 *
 * We deliberately do not fall back to localStorage.
 *
 * If the preload bridge is unavailable, that is an application configuration
 * error and should be surfaced rather than silently introducing a second
 * persistence system.
 *
 * @returns {Object}
 */
function getStorageBridge() {
  const bridge = globalThis.window?.edudit?.storage;

  if (!bridge) {
    throw new StorageError(
      "EduDit storage bridge is unavailable. Check preload.js.",
      {
        operation: "get-bridge",
        recoverable: false,
      },
    );
  }

  return bridge;
}

/**
 * Validate the storage bridge's required API.
 *
 * The exact Electron implementation lives in preload/main and can change
 * independently as long as this contract remains stable.
 *
 * @param {Object} bridge
 */
function validateStorageBridge(bridge) {
  const requiredMethods = [
    "read",
    "write",
    "remove",
  ];

  requiredMethods.forEach((method) => {
    if (typeof bridge[method] !== "function") {
      throw new StorageError(
        `EduDit storage bridge is missing "${method}()."`,
        {
          operation: "validate-bridge",
          recoverable: false,
        },
      );
    }
  });
}

/* =============================================================================
   Serialization Helpers
   ============================================================================= */

/**
 * Clone JSON-safe application data.
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
 * Safely serialize an object for persistence.
 *
 * This intentionally uses JSON because the persisted EduDit data model is
 * designed to contain plain JSON-compatible data.
 *
 * @param {*} value
 * @returns {string}
 */
function serialize(value) {
  try {
    return JSON.stringify(value);
  } catch (error) {
    throw new StorageError("Unable to serialize data for persistence.", {
      operation: "serialize",
      cause: error,
      recoverable: false,
    });
  }
}

/**
 * Safely parse persisted JSON.
 *
 * @param {string} raw
 * @param {string} context
 * @returns {*}
 */
function parse(raw, context) {
  if (raw === null || raw === undefined || raw === "") {
    return null;
  }

  if (typeof raw !== "string") {
    throw new StorageError(
      `Invalid persisted data received for ${context}.`,
      {
        operation: "parse",
        recoverable: true,
      },
    );
  }

  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new StorageError(
      `Persisted data for ${context} is malformed.`,
      {
        operation: "parse",
        cause: error,
        recoverable: true,
      },
    );
  }
}

/* =============================================================================
   Default Containers
   ============================================================================= */

/**
 * Create a fresh profile index.
 *
 * The index intentionally contains only lightweight metadata.
 *
 * @returns {Object}
 */
function createDefaultProfileIndex() {
  return {
    version: PROFILE_INDEX_VERSION,
    profiles: [],
  };
}

/**
 * Create a versioned storage envelope for a profile.
 *
 * @param {Object} profile
 * @returns {Object}
 */
function createProfileEnvelope(profile) {
  return {
    storageVersion: STORAGE_VERSION,
    profileSchemaVersion: PROFILE_SCHEMA_VERSION,
    savedAt: new Date().toISOString(),
    profile: clone(profile),
  };
}

/* =============================================================================
   Validation
   ============================================================================= */

/**
 * Normalize a profile index loaded from disk.
 *
 * Invalid individual entries are discarded rather than making the entire
 * application unusable.
 *
 * @param {*} value
 * @returns {Object}
 */
function normalizeProfileIndex(value) {
  if (!value || typeof value !== "object") {
    return createDefaultProfileIndex();
  }

  const profiles = Array.isArray(value.profiles)
    ? value.profiles
    : [];

  const normalizedProfiles = profiles
    .filter((entry) => entry && typeof entry === "object")
    .filter(
      (entry) =>
        typeof entry.id === "string" &&
        entry.id.trim().length > 0,
    )
    .map((entry) => ({
      id: entry.id,
      name:
        typeof entry.name === "string" && entry.name.trim()
          ? entry.name.trim()
          : "Learner",
      createdAt:
        typeof entry.createdAt === "string"
          ? entry.createdAt
          : null,
      updatedAt:
        typeof entry.updatedAt === "string"
          ? entry.updatedAt
          : null,
    }));

  return {
    version: PROFILE_INDEX_VERSION,
    profiles: deduplicateProfiles(normalizedProfiles),
  };
}

/**
 * Remove duplicate profile IDs from an index.
 *
 * @param {Array} profiles
 * @returns {Array}
 */
function deduplicateProfiles(profiles) {
  const seen = new Set();

  return profiles.filter((profile) => {
    if (seen.has(profile.id)) {
      return false;
    }

    seen.add(profile.id);
    return true;
  });
}

/* =============================================================================
   Migrations
   ============================================================================= */

/**
 * Migrate a persisted profile envelope to the current schema.
 *
 * This is deliberately explicit even though MVP currently has only version 1.
 * Future changes should be added here rather than scattered throughout the
 * application.
 *
 * @param {Object} envelope
 * @returns {Object}
 */
function migrateProfileEnvelope(envelope) {
  if (!envelope || typeof envelope !== "object") {
    throw new StorageError("Invalid profile storage envelope.", {
      operation: "migrate",
      recoverable: true,
    });
  }

  const storageVersion = Number(envelope.storageVersion ?? 1);

  if (!Number.isInteger(storageVersion) || storageVersion < 1) {
    throw new StorageError("Invalid profile storage version.", {
      operation: "migrate",
      recoverable: true,
    });
  }

  let migrated = clone(envelope);

  /*
   * Future example:
   *
   * if (storageVersion === 1) {
   *   migrated = migrateV1ToV2(migrated);
   * }
   */

  if (storageVersion > STORAGE_VERSION) {
    throw new StorageError(
      `Profile was created by a newer EduDit version (${storageVersion}).`,
      {
        operation: "migrate",
        recoverable: false,
      },
    );
  }

  migrated.storageVersion = STORAGE_VERSION;

  if (!migrated.profile) {
    throw new StorageError("Profile storage envelope has no profile.", {
      operation: "migrate",
      recoverable: true,
    });
  }

  migrated.profile = normalizeProfile(migrated.profile);

  return migrated;
}

/**
 * Migrate a profile index to the current version.
 *
 * @param {*} value
 * @returns {Object}
 */
function migrateProfileIndex(value) {
  if (!value || typeof value !== "object") {
    return createDefaultProfileIndex();
  }

  const version = Number(value.version ?? 1);

  if (!Number.isInteger(version) || version < 1) {
    return createDefaultProfileIndex();
  }

  if (version > PROFILE_INDEX_VERSION) {
    throw new StorageError(
      `Profile index was created by a newer EduDit version (${version}).`,
      {
        operation: "migrate-index",
        recoverable: false,
      },
    );
  }

  return normalizeProfileIndex(value);
}

/* =============================================================================
   Storage Service
   ============================================================================= */

class StorageService {
  #initialized = false;

  #pendingProfiles = new Map();

  #flushTimer = null;

  #flushInProgress = false;

  #flushRequested = false;

  #flushDelayMs;

  #profileIndex = createDefaultProfileIndex();

  constructor(options = {}) {
    this.#flushDelayMs =
      Number.isFinite(options.flushDelayMs) &&
      options.flushDelayMs >= 0
        ? options.flushDelayMs
        : DEFAULT_FLUSH_DELAY_MS;
  }

  /* ===========================================================================
     Initialization
     =========================================================================== */

  /**
   * Initialize the persistence service.
   *
   * Must be called once during application startup.
   */
  async initialize() {
    if (this.#initialized) {
      return this.getProfileIndex();
    }

    const bridge = getStorageBridge();

    validateStorageBridge(bridge);

    this.#profileIndex = await this.#loadProfileIndex();

    this.#initialized = true;

    return this.getProfileIndex();
  }

  /**
   * Ensure initialization has happened.
   */
  #requireInitialized() {
    if (!this.#initialized) {
      throw new StorageError(
        "StorageService has not been initialized.",
        {
          operation: "require-initialized",
          recoverable: false,
        },
      );
    }
  }

  /* ===========================================================================
     Profile Index
     =========================================================================== */

  /**
   * Load the lightweight profile index.
   *
   * @returns {Promise<Object>}
   */
  async #loadProfileIndex() {
    try {
      const bridge = getStorageBridge();

      const raw = await bridge.read(
        STORAGE_KEYS.PROFILE_INDEX,
      );

      if (!raw) {
        return createDefaultProfileIndex();
      }

      const parsed = parse(raw, "profile index");

      return migrateProfileIndex(parsed);
    } catch (error) {
      const normalizedError = this.#normalizeError(
        error,
        "load-profile-index",
      );

      /*
       * A damaged index should not make the application permanently unusable.
       * We return an empty index and allow the application to continue.
       *
       * The original problem is still reported through the application event
       * bus so diagnostics can be added later.
       */
      this.#emitStorageError(normalizedError);

      return createDefaultProfileIndex();
    }
  }

  /**
   * Persist the profile index.
   *
   * @returns {Promise<void>}
   */
  async #saveProfileIndex() {
    const bridge = getStorageBridge();

    const payload = serialize(this.#profileIndex);

    await bridge.write(
      STORAGE_KEYS.PROFILE_INDEX,
      payload,
    );
  }

  /**
   * Get a defensive copy of the profile index.
   *
   * @returns {Object}
   */
  getProfileIndex() {
    return clone(this.#profileIndex);
  }

  /**
   * Update the index entry for a profile.
   *
   * @param {Object} profile
   */
  async #upsertProfileIndex(profile) {
    const existingIndex = this.#profileIndex.profiles.findIndex(
      (entry) => entry.id === profile.id,
    );

    const entry = {
      id: profile.id,
      name: profile.name,
      createdAt: profile.createdAt,
      updatedAt: profile.updatedAt,
    };

    if (existingIndex === -1) {
      this.#profileIndex.profiles.push(entry);
    } else {
      this.#profileIndex.profiles[existingIndex] = entry;
    }

    this.#profileIndex.profiles = deduplicateProfiles(
      this.#profileIndex.profiles,
    );

    await this.#saveProfileIndex();
  }

  /**
   * Remove a profile from the index.
   *
   * @param {string} profileId
   */
  async #removeProfileFromIndex(profileId) {
    this.#profileIndex.profiles =
      this.#profileIndex.profiles.filter(
        (profile) => profile.id !== profileId,
      );

    await this.#saveProfileIndex();
  }

  /* ===========================================================================
     Profile Loading
     =========================================================================== */

  /**
   * Load one complete profile.
   *
   * @param {string} profileId
   * @returns {Promise<Object|null>}
   */
  async loadProfile(profileId) {
    this.#requireInitialized();

    this.#validateProfileId(profileId);

    /*
     * If a profile has pending unsaved changes, return the in-memory pending
     * version instead of loading an older copy from disk.
     */
    if (this.#pendingProfiles.has(profileId)) {
      return clone(this.#pendingProfiles.get(profileId));
    }

    try {
      const bridge = getStorageBridge();

      const raw = await bridge.read(
        `${STORAGE_KEYS.PROFILE}/${profileId}`,
      );

      if (!raw) {
        return null;
      }

      const parsed = parse(
        raw,
        `profile "${profileId}"`,
      );

      const envelope = migrateProfileEnvelope(parsed);

      return clone(envelope.profile);
    } catch (error) {
      const normalizedError = this.#normalizeError(
        error,
        "load-profile",
        profileId,
      );

      this.#emitStorageError(normalizedError);

      /*
       * Do not silently fabricate a replacement profile here.
       *
       * Returning null lets the profile manager decide how to recover without
       * risking accidental overwriting of valid data.
       */
      if (normalizedError.recoverable) {
        return null;
      }

      throw normalizedError;
    }
  }

  /**
   * Load every profile listed in the lightweight index.
   *
   * This is primarily useful during application startup/profile selection.
   *
   * @returns {Promise<Object[]>}
   */
  async loadProfiles() {
    this.#requireInitialized();

    const profiles = [];

    for (const entry of this.#profileIndex.profiles) {
      const profile = await this.loadProfile(entry.id);

      if (profile) {
        profiles.push(profile);
      }
    }

    return profiles;
  }

  /* ===========================================================================
     Profile Writes
     =========================================================================== */

  /**
   * Queue a profile for persistence.
   *
   * This is the primary write method used by the application.
   *
   * It does NOT immediately rewrite the profile file.
   *
   * @param {Object} profile
   */
  queueProfileWrite(profile) {
    this.#requireInitialized();

    const normalizedProfile = normalizeProfile(profile);

    /*
     * Keep the session history bounded for the MVP.
     *
     * The complete analytics architecture can eventually move detailed
     * sessions into separate persistence records.
     */
    if (
      Array.isArray(normalizedProfile.sessions) &&
      normalizedProfile.sessions.length > MAX_SESSION_HISTORY
    ) {
      normalizedProfile.sessions =
        normalizedProfile.sessions.slice(
          -MAX_SESSION_HISTORY,
        );
    }

    this.#pendingProfiles.set(
      normalizedProfile.id,
      normalizedProfile,
    );

    /*
     * Keep the pending queue bounded. In normal operation there should only be
     * one entry per profile, but this protects us against unexpected future
     * persistence patterns.
     */
    if (this.#pendingProfiles.size > MAX_PENDING_WRITES) {
      void this.flush();
      return;
    }

    this.#scheduleFlush();
  }

  /**
   * Schedule a debounced persistence flush.
   */
  #scheduleFlush() {
    if (this.#flushTimer !== null) {
      return;
    }

    this.#flushTimer = setTimeout(() => {
      this.#flushTimer = null;

      void this.flush();
    }, this.#flushDelayMs);
  }

  /**
   * Immediately persist all pending profile changes.
   *
   * This is called:
   *
   * - after a session ends
   * - when leaving training
   * - before application shutdown
   * - when explicitly requested
   *
   * @returns {Promise<void>}
   */
  async flush() {
    this.#requireInitialized();

    if (this.#flushInProgress) {
      this.#flushRequested = true;
      return;
    }

    if (this.#pendingProfiles.size === 0) {
      return;
    }

    this.#flushInProgress = true;

    const pending = new Map(this.#pendingProfiles);

    /*
     * Remove the entries from the pending queue before writing.
     *
     * If a new attempt occurs while the writes are in progress, it gets placed
     * into a fresh pending queue instead of being accidentally cleared.
     */
    pending.forEach((_profile, profileId) => {
      this.#pendingProfiles.delete(profileId);
    });

    try {
      for (const profile of pending.values()) {
        await this.#writeProfile(profile);
      }

      await this.#saveProfileIndex();

      events.emit(EVENT_NAMES.STORAGE_FLUSHED, {
        profileIds: [...pending.keys()],
      });
    } catch (error) {
      /*
       * Requeue any profiles that failed to persist.
       *
       * This gives a later flush another opportunity rather than silently
       * losing the in-memory update.
       */
      pending.forEach((profile, profileId) => {
        if (!this.#pendingProfiles.has(profileId)) {
          this.#pendingProfiles.set(
            profileId,
            profile,
          );
        }
      });

      const normalizedError = this.#normalizeError(
        error,
        "flush",
      );

      this.#emitStorageError(normalizedError);

      throw normalizedError;
    } finally {
      this.#flushInProgress = false;

      if (this.#flushRequested) {
        this.#flushRequested = false;

        if (this.#pendingProfiles.size > 0) {
          void this.flush();
        }
      } else if (this.#pendingProfiles.size > 0) {
        this.#scheduleFlush();
      }
    }
  }

  /**
   * Write one profile.
   *
   * @param {Object} profile
   * @returns {Promise<void>}
   */
  async #writeProfile(profile) {
    const bridge = getStorageBridge();

    const envelope = createProfileEnvelope(profile);

    const payload = serialize(envelope);

    await bridge.write(
      `${STORAGE_KEYS.PROFILE}/${profile.id}`,
      payload,
    );

    await this.#upsertProfileIndex(profile);
  }

  /**
   * Immediately save a profile.
   *
   * This bypasses the debounce queue and is useful for critical operations
   * such as profile creation or deletion.
   *
   * @param {Object} profile
   * @returns {Promise<void>}
   */
  async saveProfileNow(profile) {
    this.#requireInitialized();

    const normalizedProfile = normalizeProfile(profile);

    /*
     * Remove any stale queued copy. The immediately saved version becomes the
     * authoritative persisted copy.
     */
    this.#pendingProfiles.delete(
      normalizedProfile.id,
    );

    await this.#writeProfile(normalizedProfile);

    events.emit(EVENT_NAMES.STORAGE_FLUSHED, {
      profileIds: [normalizedProfile.id],
    });
  }

  /* ===========================================================================
     Profile Creation
     =========================================================================== */

  /**
   * Create and immediately persist a new profile.
   *
   * @param {string} name
   * @returns {Promise<Object>}
   */
  async createProfile(name) {
    this.#requireInitialized();

    const profile = createProfile(name);

    await this.saveProfileNow(profile);

    return clone(profile);
  }

  /* ===========================================================================
     Profile Deletion
     =========================================================================== */

  /**
   * Permanently delete a profile.
   *
   * This first flushes any pending changes for the profile so that deletion
   * cannot accidentally race an outstanding write.
   *
   * @param {string} profileId
   * @returns {Promise<void>}
   */
  async deleteProfile(profileId) {
    this.#requireInitialized();

    this.#validateProfileId(profileId);

    /*
     * Remove any queued write so a future timer cannot recreate the profile.
     */
    this.#pendingProfiles.delete(profileId);

    const bridge = getStorageBridge();

    await bridge.remove(
      `${STORAGE_KEYS.PROFILE}/${profileId}`,
    );

    await this.#removeProfileFromIndex(profileId);
  }

  /* ===========================================================================
     Shutdown
     =========================================================================== */

  /**
   * Flush all pending persistence before application shutdown.
   *
   * @returns {Promise<void>}
   */
  async shutdown() {
    if (!this.#initialized) {
      return;
    }

    if (this.#flushTimer !== null) {
      clearTimeout(this.#flushTimer);
      this.#flushTimer = null;
    }

    await this.flush();
  }

  /* ===========================================================================
     Status
     =========================================================================== */

  /**
   * Determine whether there are unsaved changes.
   *
   * @returns {boolean}
   */
  hasPendingWrites() {
    return this.#pendingProfiles.size > 0;
  }

  /**
   * Return pending profile IDs.
   *
   * @returns {string[]}
   */
  getPendingProfileIds() {
    return [...this.#pendingProfiles.keys()];
  }

  /**
   * Determine whether the service has been initialized.
   *
   * @returns {boolean}
   */
  isInitialized() {
    return this.#initialized;
  }

  /* ===========================================================================
     Validation / Error Handling
     =========================================================================== */

  /**
   * Validate profile IDs before passing them to the native bridge.
   *
   * This is also an important defense against malformed IDs becoming path-like
   * values in the Electron main process.
   *
   * @param {string} profileId
   */
  #validateProfileId(profileId) {
    if (
      typeof profileId !== "string" ||
      profileId.trim().length === 0
    ) {
      throw new StorageError(
        "Profile ID must be a non-empty string.",
        {
          operation: "validate-profile-id",
          profileId,
          recoverable: false,
        },
      );
    }

    /*
     * IDs generated by createProfile() are UUIDs, but validating against a
     * conservative character set keeps the persistence boundary safe if an
     * imported profile ever supplies an ID.
     */
    if (!/^[a-zA-Z0-9_-]+$/.test(profileId)) {
      throw new StorageError(
        "Profile ID contains invalid characters.",
        {
          operation: "validate-profile-id",
          profileId,
          recoverable: false,
        },
      );
    }
  }

  /**
   * Convert unknown errors into StorageError instances.
   *
   * @param {*} error
   * @param {string} operation
   * @param {string|null} profileId
   * @returns {StorageError}
   */
  #normalizeError(
    error,
    operation,
    profileId = null,
  ) {
    if (error instanceof StorageError) {
      return error;
    }

    return new StorageError(
      error instanceof Error
        ? error.message
        : String(error),
      {
        operation,
        profileId,
        cause: error,
        recoverable: false,
      },
    );
  }

  /**
   * Emit a standardized storage error event.
   *
   * @param {StorageError} error
   */
  #emitStorageError(error) {
    console.error(
      "[EduDit] Storage error:",
      error,
    );

    events.emit(EVENT_NAMES.STORAGE_ERROR, {
      error,
    });
  }
}

/* =============================================================================
   Singleton
   ============================================================================= */

const storage = new StorageService();

/* =============================================================================
   Exports
   ============================================================================= */

export {
  STORAGE_VERSION,
  PROFILE_INDEX_VERSION,
  STORAGE_KEYS,
  DEFAULT_FLUSH_DELAY_MS,
  MAX_PENDING_WRITES,
  MAX_SESSION_HISTORY,
  StorageError,
  StorageService,
};

export default storage;