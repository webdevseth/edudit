/**
 * =============================================================================
 * EduDit
 * Profile Model
 * =============================================================================
 *
 * Represents a learner profile.
 *
 * A profile owns identity and learner-level preferences/state references.
 * Detailed attempt history and character statistics are maintained separately.
 * =============================================================================
 */


/* =============================================================================
   Constants
   ============================================================================= */


const PROFILE_STATUS = Object.freeze({
  ACTIVE: "active",
  ARCHIVED: "archived",
});


/* =============================================================================
   Factory
   ============================================================================= */


/**
 * Create a new learner profile.
 *
 * @param {Object} options
 * @returns {Object}
 */
function createProfile({
  id = null,
  name = "",
  createdAt = Date.now(),
  updatedAt = Date.now(),

  status = PROFILE_STATUS.ACTIVE,

  progression = null,

  settings = null,
} = {}) {
  return {
    id,

    name:
      String(name).trim(),

    createdAt:
      normalizeTimestamp(createdAt),

    updatedAt:
      normalizeTimestamp(updatedAt),

    status:
      normalizeStatus(status),

    progression:
      progression
        ? { ...progression }
        : null,

    settings:
      settings
        ? { ...settings }
        : null,
  };
}


/* =============================================================================
   Normalization
   ============================================================================= */


/**
 * Normalize a timestamp.
 *
 * @param {*} value
 * @returns {number}
 */
function normalizeTimestamp(value) {
  const timestamp =
    Number(value);

  return Number.isFinite(timestamp) &&
    timestamp > 0
    ? timestamp
    : Date.now();
}


/**
 * Normalize profile status.
 *
 * @param {*} status
 * @returns {string}
 */
function normalizeStatus(status) {
  return Object.values(
    PROFILE_STATUS,
  ).includes(status)
    ? status
    : PROFILE_STATUS.ACTIVE;
}


/**
 * Normalize a profile.
 *
 * @param {Object|null} profile
 * @returns {Object}
 */
function normalizeProfile(profile) {
  if (
    !profile ||
    typeof profile !== "object"
  ) {
    return createProfile();
  }

  return {
    ...profile,

    name:
      typeof profile.name === "string"
        ? profile.name.trim()
        : "",

    createdAt:
      normalizeTimestamp(
        profile.createdAt,
      ),

    updatedAt:
      normalizeTimestamp(
        profile.updatedAt,
      ),

    status:
      normalizeStatus(
        profile.status,
      ),

    progression:
      profile.progression &&
      typeof profile.progression === "object"
        ? { ...profile.progression }
        : null,

    settings:
      profile.settings &&
      typeof profile.settings === "object"
        ? { ...profile.settings }
        : null,
  };
}


/* =============================================================================
   Updates
   ============================================================================= */


/**
 * Update profile fields without mutating the original profile.
 *
 * @param {Object} profile
 * @param {Object} updates
 * @returns {Object}
 */
function updateProfile(profile, updates = {}) {
  const current =
    normalizeProfile(profile);

  return {
    ...current,

    ...updates,

    id:
      current.id,

    createdAt:
      current.createdAt,

    updatedAt:
      Date.now(),

    name:
      updates.name !== undefined
        ? String(updates.name).trim()
        : current.name,

    status:
      updates.status !== undefined
        ? normalizeStatus(updates.status)
        : current.status,
  };
}


/**
 * Mark a profile as archived.
 *
 * @param {Object} profile
 * @returns {Object}
 */
function archiveProfile(profile) {
  return updateProfile(
    profile,
    {
      status:
        PROFILE_STATUS.ARCHIVED,
    },
  );
}


/**
 * Mark a profile as active.
 *
 * @param {Object} profile
 * @returns {Object}
 */
function activateProfile(profile) {
  return updateProfile(
    profile,
    {
      status:
        PROFILE_STATUS.ACTIVE,
    },
  );
}


/* =============================================================================
   Queries
   ============================================================================= */


/**
 * Determine whether a profile is active.
 *
 * @param {Object} profile
 * @returns {boolean}
 */
function isProfileActive(profile) {
  return (
    normalizeProfile(profile).status ===
    PROFILE_STATUS.ACTIVE
  );
}


/**
 * Determine whether a profile is archived.
 *
 * @param {Object} profile
 * @returns {boolean}
 */
function isProfileArchived(profile) {
  return (
    normalizeProfile(profile).status ===
    PROFILE_STATUS.ARCHIVED
  );
}


/**
 * Validate a profile.
 *
 * @param {*} profile
 * @returns {Object}
 */
function validateProfile(profile) {
  const errors = [];

  if (!profile || typeof profile !== "object") {
    errors.push("Profile must be an object.");
  }

  if (
    profile &&
    (
      typeof profile.name !== "string" ||
      profile.name.trim().length === 0
    )
  ) {
    errors.push("Profile name is required.");
  }

  return {
    valid:
      errors.length === 0,

    errors,
  };
}


/* =============================================================================
   Exports
   ============================================================================= */


export {
  PROFILE_STATUS,

  createProfile,
  normalizeProfile,
  updateProfile,

  archiveProfile,
  activateProfile,

  isProfileActive,
  isProfileArchived,

  validateProfile,
};


export default {
  createProfile,
  normalizeProfile,
  updateProfile,
  archiveProfile,
  activateProfile,
  isProfileActive,
  isProfileArchived,
  validateProfile,
};