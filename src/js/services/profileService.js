/**
 * =============================================================================
 * EduDit
 * Profile Service
 * =============================================================================
 *
 * Coordinates learner profiles between:
 *
 *   persistence → application state → application events
 *
 * This service does not implement profile data structures itself.
 * The state and storage modules remain authoritative for those concerns.
 * =============================================================================
 */

import events, {
  EVENT_NAMES,
} from "../core/events.js";

import state from "../core/state.js";

import storage from "../core/storage.js";


/* =============================================================================
   Internal State
   ============================================================================= */

let initialized = false;

let eventCleanups = [];


/* =============================================================================
   Initialization
   ============================================================================= */

/**
 * Initialize the profile service.
 *
 * Existing profiles are loaded from persistence into application state.
 *
 * @returns {Promise<Object[]>}
 */
async function initialize() {
  if (initialized) {
    return state.getProfiles();
  }

  const profiles =
    await storage.loadProfiles();

  profiles.forEach(
    (profile) => {
      state.replaceProfile(profile);
    },
  );

  /*
   * The current active profile is application state, not profile data.
   *
   * Until a dedicated application-preferences persistence layer exists,
   * startup selects the first available learner.
   */
  if (profiles.length > 0) {
    state.setActiveProfile(
      profiles[0].id,
    );
  }

  initialized = true;

  return state.getProfiles();
}


/* =============================================================================
   Event Binding
   ============================================================================= */

/**
 * Bind application-wide profile persistence behavior.
 *
 * Profile state changes are persisted through the authoritative core storage
 * service. Individual UI features do not need to know how persistence works.
 */
function bindApplicationEvents() {
  if (!initialized) {
    throw new Error(
      "ProfileService must be initialized before binding events.",
    );
  }

  if (eventCleanups.length > 0) {
    return;
  }

  eventCleanups.push(
    events.on(
      EVENT_NAMES.PROFILE_UPDATED,
      ({ profile }) => {
        if (!profile) {
          return;
        }

        storage.queueProfileWrite(
          profile,
        );
      },
    ),
  );

  eventCleanups.push(
    events.on(
      EVENT_NAMES.PROFILE_CREATED,
      ({ profile }) => {
        if (!profile) {
          return;
        }

        storage.queueProfileWrite(
          profile,
        );
      },
    ),
  );
}


/* =============================================================================
   Profile Creation
   ============================================================================= */

/**
 * Create a new learner profile.
 *
 * @param {string} name
 * @returns {Promise<Object>}
 */
async function createProfile(name) {
  if (!initialized) {
    throw new Error(
      "ProfileService has not been initialized.",
    );
  }

  const profile =
    await storage.createProfile(
      name,
    );

  state.addProfile(
    profile,
  );

  /*
   * If there is no active learner, the first created learner becomes active.
   */
  if (!state.getActiveProfileId()) {
    state.setActiveProfile(
      profile.id,
    );
  }

  return profile;
}


/* =============================================================================
   Profile Selection
   ============================================================================= */

/**
 * Select a learner profile.
 *
 * If the profile has not already been loaded, it is loaded from persistence
 * first.
 *
 * @param {string} profileId
 * @returns {Promise<Object>}
 */
async function selectProfile(profileId) {
  if (!initialized) {
    throw new Error(
      "ProfileService has not been initialized.",
    );
  }

  let profile =
    state.getProfile(
      profileId,
    );

  if (!profile) {
    profile =
      await storage.loadProfile(
        profileId,
      );
  }

  if (!profile) {
    throw new Error(
      `Unable to load profile "${profileId}".`,
    );
  }

  if (!state.getProfile(profile.id)) {
    state.replaceProfile(
      profile,
    );
  }

  return state.setActiveProfile(
    profile.id,
  );
}


/* =============================================================================
   Profile Updates
   ============================================================================= */

/**
 * Rename a learner profile.
 *
 * @param {string} profileId
 * @param {string} name
 * @returns {Object}
 */
function renameProfile(
  profileId,
  name,
) {
  const profile =
    state.renameProfile(
      profileId,
      name,
    );

  storage.queueProfileWrite(
    profile,
  );

  return profile;
}


/**
 * Get the currently active learner.
 *
 * @returns {Object|null}
 */
function getActiveProfile() {
  return state.getActiveProfile();
}


/**
 * Get all loaded learner profiles.
 *
 * @returns {Object[]}
 */
function getProfiles() {
  return state.getProfiles();
}


/* =============================================================================
   Profile Deletion
   ============================================================================= */

/**
 * Delete a learner profile.
 *
 * The active profile cannot simply disappear. If another profile exists,
 * another learner becomes active first. If this is the final profile, the
 * application creates a replacement learner profile.
 *
 * @param {string} profileId
 * @returns {Promise<Object>}
 */
async function deleteProfile(profileId) {
  if (!initialized) {
    throw new Error(
      "ProfileService has not been initialized.",
    );
  }

  const profiles =
    state.getProfiles();

  const target =
    state.getProfile(
      profileId,
    );

  if (!target) {
    throw new Error(
      `Unknown profile "${profileId}".`,
    );
  }

  const wasActive =
    state.getActiveProfileId() ===
    profileId;

  await storage.deleteProfile(
    profileId,
  );

  state.removeProfile(
    profileId,
  );

  if (wasActive) {
    const replacement =
      profiles.find(
        (profile) =>
          profile.id !== profileId,
      );

    if (replacement) {
      await selectProfile(
        replacement.id,
      );
    } else {
      return createProfile(
        "Learner",
      );
    }
  }

  return state.getActiveProfile();
}


/* =============================================================================
   Cleanup
   ============================================================================= */

function destroy() {
  eventCleanups.forEach(
    (unsubscribe) => {
      try {
        unsubscribe();
      } catch (error) {
        console.error(
          "[EduDit] Failed to remove profile listener.",
          error,
        );
      }
    },
  );

  eventCleanups = [];
}


/* =============================================================================
   Exports
   ============================================================================= */

const profileService = Object.freeze({
  initialize,
  bindApplicationEvents,
  createProfile,
  selectProfile,
  renameProfile,
  deleteProfile,
  getActiveProfile,
  getProfiles,
  destroy,
});


export {
  initialize,
  bindApplicationEvents,
  createProfile,
  selectProfile,
  renameProfile,
  deleteProfile,
  getActiveProfile,
  getProfiles,
  destroy,
};


export default profileService;