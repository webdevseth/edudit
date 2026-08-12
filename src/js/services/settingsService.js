/**
 * =============================================================================
 * EduDit
 * Settings Service
 * =============================================================================
 *
 * Coordinates learner settings between application state, theme, and
 * persistence.
 *
 * Settings remain part of the active learner profile.
 * =============================================================================
 */

import events, {
  EVENT_NAMES,
} from "../core/events.js";

import state from "../core/state.js";

import storage from "../core/storage.js";

import theme from "../core/theme.js";

import {
  createSettings,
  normalizeSettings,
} from "../models/settings.js";


/* =============================================================================
   Settings Access
   ============================================================================= */

/**
 * Return settings for the active learner.
 *
 * @returns {Object}
 */
function getSettings() {
  const profile =
    state.getActiveProfile();

  if (!profile) {
    return createSettings();
  }

  return normalizeSettings(
    profile.settings,
  );
}


/* =============================================================================
   Settings Updates
   ============================================================================= */

/**
 * Update active learner settings.
 *
 * @param {Object} updates
 * @returns {Object}
 */
function updateSettings(
  updates = {},
) {
  const current =
    getSettings();

  const next =
    normalizeSettings({
      ...current,
      ...updates,
    });

  const profile =
    state.updateActiveProfile(
      (activeProfile) => {
        activeProfile.settings =
          next;
      },
    );

  /*
   * Theme is applied immediately, while persistence remains owned by the
   * storage service.
   */
  theme.setTheme(
    next.appearance.theme,
  );

  storage.queueProfileWrite(
    profile,
  );

  events.emit(
    EVENT_NAMES.SETTINGS_CHANGED,
    {
      settings: next,
    },
  );

  return next;
}


/**
 * Update one nested settings group.
 *
 * @param {string} group
 * @param {Object} updates
 * @returns {Object}
 */
function updateGroup(
  group,
  updates = {},
) {
  const current =
    getSettings();

  if (
    !current[group] ||
    typeof current[group] !== "object"
  ) {
    throw new Error(
      `Unknown settings group "${group}".`,
    );
  }

  return updateSettings({
    [group]: {
      ...current[group],
      ...updates,
    },
  });
}


/**
 * Set the application theme.
 *
 * @param {"light"|"dark"|"system"} value
 * @returns {Object}
 */
function setTheme(value) {
  return updateGroup(
    "appearance",
    {
      theme: value,
    },
  );
}


/**
 * Reset learner settings to defaults.
 *
 * @returns {Object}
 */
function resetSettings() {
  const defaults =
    createSettings();

  return updateSettings(
    defaults,
  );
}


/* =============================================================================
   Exports
   ============================================================================= */

const settingsService = Object.freeze({
  getSettings,
  updateSettings,
  updateGroup,
  setTheme,
  resetSettings,
});


export {
  getSettings,
  updateSettings,
  updateGroup,
  setTheme,
  resetSettings,
};


export default settingsService;