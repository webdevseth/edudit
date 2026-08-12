/**
 * =============================================================================
 * EduDit
 * Settings Model
 * =============================================================================
 *
 * Canonical application and learner settings.
 *
 * This model defines the shape and normalization rules for settings.
 * It does not persist settings and does not directly manipulate the UI,
 * audio engine, or theme system.
 * =============================================================================
 */


/* =============================================================================
   Constants
   ============================================================================= */


const DEFAULT_SETTINGS = Object.freeze({
  /* Appearance */
  theme: "system",

  /* Audio */
  soundEnabled: true,
  backgroundAudioEnabled: false,
  masterVolume: 0.8,
  toneFrequency: 600,

  /* Training */
  characterSpeedWpm: 20,
  effectiveSpeedWpm: 15,
  farnsworthEnabled: true,
  farnsworthSpacing: 15,

  /* Learning */
  learningPace: "standard",

  /* Feedback */
  showHints: true,
  showImmediateFeedback: true,

  /* Accessibility */
  reducedMotion: false,

  /* Interface */
  showKeyboard: true,
});


const THEME_OPTIONS = Object.freeze([
  "system",
  "light",
  "dark",
]);


const LEARNING_PACE_OPTIONS = Object.freeze([
  "slow",
  "standard",
  "fast",
]);


/* =============================================================================
   Normalization Helpers
   ============================================================================= */


/**
 * Normalize a boolean setting.
 *
 * @param {*} value
 * @param {boolean} fallback
 * @returns {boolean}
 */
function normalizeBoolean(
  value,
  fallback,
) {
  if (typeof value === "boolean") {
    return value;
  }

  return fallback;
}


/**
 * Normalize a bounded numeric setting.
 *
 * @param {*} value
 * @param {number} fallback
 * @param {number} minimum
 * @param {number} maximum
 * @returns {number}
 */
function normalizeNumber(
  value,
  fallback,
  minimum,
  maximum,
) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return fallback;
  }

  return Math.min(
    maximum,
    Math.max(minimum, number),
  );
}


/**
 * Normalize an integer setting.
 *
 * @param {*} value
 * @param {number} fallback
 * @param {number} minimum
 * @param {number} maximum
 * @returns {number}
 */
function normalizeInteger(
  value,
  fallback,
  minimum,
  maximum,
) {
  const number = Number(value);

  if (!Number.isInteger(number)) {
    return fallback;
  }

  return Math.min(
    maximum,
    Math.max(minimum, number),
  );
}


/**
 * Normalize theme.
 *
 * @param {*} value
 * @returns {string}
 */
function normalizeTheme(value) {
  return THEME_OPTIONS.includes(value)
    ? value
    : DEFAULT_SETTINGS.theme;
}


/**
 * Normalize learning pace.
 *
 * @param {*} value
 * @returns {string}
 */
function normalizeLearningPace(value) {
  return LEARNING_PACE_OPTIONS.includes(value)
    ? value
    : DEFAULT_SETTINGS.learningPace;
}


/* =============================================================================
   Factory
   ============================================================================= */


/**
 * Create a fresh settings object.
 *
 * @param {Object} overrides
 * @returns {Object}
 */
function createSettings(overrides = {}) {
  return normalizeSettings({
    ...DEFAULT_SETTINGS,
    ...overrides,
  });
}


/**
 * Normalize settings into the canonical shape.
 *
 * Unknown properties are intentionally discarded.
 *
 * @param {Object|null} settings
 * @returns {Object}
 */
function normalizeSettings(settings) {
  const source =
    settings &&
    typeof settings === "object"
      ? settings
      : {};

  return {
    /* Appearance */

    theme:
      normalizeTheme(
        source.theme,
      ),

    /* Audio */

    soundEnabled:
      normalizeBoolean(
        source.soundEnabled,
        DEFAULT_SETTINGS.soundEnabled,
      ),

    backgroundAudioEnabled:
      normalizeBoolean(
        source.backgroundAudioEnabled,
        DEFAULT_SETTINGS.backgroundAudioEnabled,
      ),

    masterVolume:
      normalizeNumber(
        source.masterVolume,
        DEFAULT_SETTINGS.masterVolume,
        0,
        1,
      ),

    toneFrequency:
      normalizeInteger(
        source.toneFrequency,
        DEFAULT_SETTINGS.toneFrequency,
        100,
        2000,
      ),

    /* Training */

    characterSpeedWpm:
      normalizeNumber(
        source.characterSpeedWpm,
        DEFAULT_SETTINGS.characterSpeedWpm,
        5,
        60,
      ),

    effectiveSpeedWpm:
      normalizeNumber(
        source.effectiveSpeedWpm,
        DEFAULT_SETTINGS.effectiveSpeedWpm,
        5,
        60,
      ),

    farnsworthEnabled:
      normalizeBoolean(
        source.farnsworthEnabled,
        DEFAULT_SETTINGS.farnsworthEnabled,
      ),

    farnsworthSpacing:
      normalizeNumber(
        source.farnsworthSpacing,
        DEFAULT_SETTINGS.farnsworthSpacing,
        5,
        60,
      ),

    /* Learning */

    learningPace:
      normalizeLearningPace(
        source.learningPace,
      ),

    /* Feedback */

    showHints:
      normalizeBoolean(
        source.showHints,
        DEFAULT_SETTINGS.showHints,
      ),

    showImmediateFeedback:
      normalizeBoolean(
        source.showImmediateFeedback,
        DEFAULT_SETTINGS.showImmediateFeedback,
      ),

    /* Accessibility */

    reducedMotion:
      normalizeBoolean(
        source.reducedMotion,
        DEFAULT_SETTINGS.reducedMotion,
      ),

    /* Interface */

    showKeyboard:
      normalizeBoolean(
        source.showKeyboard,
        DEFAULT_SETTINGS.showKeyboard,
      ),
  };
}


/* =============================================================================
   Updates
   ============================================================================= */


/**
 * Return a new settings object with updates applied.
 *
 * The original settings object is never mutated.
 *
 * @param {Object|null} settings
 * @param {Object} updates
 * @returns {Object}
 */
function updateSettings(
  settings,
  updates = {},
) {
  const current =
    normalizeSettings(settings);

  return normalizeSettings({
    ...current,
    ...updates,
  });
}


/**
 * Reset settings to defaults.
 *
 * @returns {Object}
 */
function resetSettings() {
  return createSettings();
}


/* =============================================================================
   Individual Setting Helpers
   ============================================================================= */


/**
 * Set the application theme.
 *
 * @param {Object} settings
 * @param {string} theme
 * @returns {Object}
 */
function setTheme(
  settings,
  theme,
) {
  return updateSettings(
    settings,
    {
      theme,
    },
  );
}


/**
 * Set the learning pace.
 *
 * @param {Object} settings
 * @param {string} learningPace
 * @returns {Object}
 */
function setLearningPace(
  settings,
  learningPace,
) {
  return updateSettings(
    settings,
    {
      learningPace,
    },
  );
}


/**
 * Set master volume.
 *
 * @param {Object} settings
 * @param {number} volume
 * @returns {Object}
 */
function setMasterVolume(
  settings,
  volume,
) {
  return updateSettings(
    settings,
    {
      masterVolume: volume,
    },
  );
}


/**
 * Set Morse character speed.
 *
 * @param {Object} settings
 * @param {number} wpm
 * @returns {Object}
 */
function setCharacterSpeed(
  settings,
  wpm,
) {
  return updateSettings(
    settings,
    {
      characterSpeedWpm: wpm,
    },
  );
}


/**
 * Set effective Morse speed.
 *
 * @param {Object} settings
 * @param {number} wpm
 * @returns {Object}
 */
function setEffectiveSpeed(
  settings,
  wpm,
) {
  return updateSettings(
    settings,
    {
      effectiveSpeedWpm: wpm,
    },
  );
}


/* =============================================================================
   Queries
   ============================================================================= */


/**
 * Determine whether sound is available to the learner.
 *
 * @param {Object} settings
 * @returns {boolean}
 */
function isSoundEnabled(settings) {
  const normalized =
    normalizeSettings(settings);

  return normalized.soundEnabled;
}


/**
 * Determine whether background audio is enabled.
 *
 * @param {Object} settings
 * @returns {boolean}
 */
function isBackgroundAudioEnabled(settings) {
  const normalized =
    normalizeSettings(settings);

  return (
    normalized.soundEnabled &&
    normalized.backgroundAudioEnabled
  );
}


/**
 * Get the effective master volume.
 *
 * @param {Object} settings
 * @returns {number}
 */
function getMasterVolume(settings) {
  return normalizeSettings(
    settings,
  ).masterVolume;
}


/**
 * Determine whether hints should be displayed.
 *
 * @param {Object} settings
 * @returns {boolean}
 */
function areHintsEnabled(settings) {
  return normalizeSettings(
    settings,
  ).showHints;
}


/**
 * Determine whether immediate feedback is enabled.
 *
 * @param {Object} settings
 * @returns {boolean}
 */
function isImmediateFeedbackEnabled(settings) {
  return normalizeSettings(
    settings,
  ).showImmediateFeedback;
}


/**
 * Determine whether reduced motion is requested.
 *
 * @param {Object} settings
 * @returns {boolean}
 */
function prefersReducedMotion(settings) {
  return normalizeSettings(
    settings,
  ).reducedMotion;
}


/**
 * Get the configured theme.
 *
 * @param {Object} settings
 * @returns {string}
 */
function getTheme(settings) {
  return normalizeSettings(
    settings,
  ).theme;
}


/**
 * Get the configured learning pace.
 *
 * @param {Object} settings
 * @returns {string}
 */
function getLearningPace(settings) {
  return normalizeSettings(
    settings,
  ).learningPace;
}


/* =============================================================================
   Validation
   ============================================================================= */


/**
 * Validate a settings object.
 *
 * @param {*} settings
 * @returns {Object}
 */
function validateSettings(settings) {
  const errors = [];

  if (
    !settings ||
    typeof settings !== "object"
  ) {
    return {
      valid: false,
      errors: [
        "Settings must be an object.",
      ],
    };
  }

  if (
    !THEME_OPTIONS.includes(
      settings.theme,
    )
  ) {
    errors.push(
      "Theme is invalid.",
    );
  }

  if (
    !LEARNING_PACE_OPTIONS.includes(
      settings.learningPace,
    )
  ) {
    errors.push(
      "Learning pace is invalid.",
    );
  }

  if (
    typeof settings.soundEnabled !==
    "boolean"
  ) {
    errors.push(
      "soundEnabled must be a boolean.",
    );
  }

  if (
    typeof settings.backgroundAudioEnabled !==
    "boolean"
  ) {
    errors.push(
      "backgroundAudioEnabled must be a boolean.",
    );
  }

  if (
    !Number.isFinite(
      settings.masterVolume,
    ) ||
    settings.masterVolume < 0 ||
    settings.masterVolume > 1
  ) {
    errors.push(
      "masterVolume must be between 0 and 1.",
    );
  }

  if (
    !Number.isFinite(
      settings.characterSpeedWpm,
    ) ||
    settings.characterSpeedWpm < 5 ||
    settings.characterSpeedWpm > 60
  ) {
    errors.push(
      "characterSpeedWpm must be between 5 and 60.",
    );
  }

  if (
    !Number.isFinite(
      settings.effectiveSpeedWpm,
    ) ||
    settings.effectiveSpeedWpm < 5 ||
    settings.effectiveSpeedWpm > 60
  ) {
    errors.push(
      "effectiveSpeedWpm must be between 5 and 60.",
    );
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
  DEFAULT_SETTINGS,
  THEME_OPTIONS,
  LEARNING_PACE_OPTIONS,

  createSettings,
  normalizeSettings,
  updateSettings,
  resetSettings,

  setTheme,
  setLearningPace,
  setMasterVolume,
  setCharacterSpeed,
  setEffectiveSpeed,

  isSoundEnabled,
  isBackgroundAudioEnabled,
  getMasterVolume,
  areHintsEnabled,
  isImmediateFeedbackEnabled,
  prefersReducedMotion,
  getTheme,
  getLearningPace,

  validateSettings,
};


export default {
  createSettings,
  normalizeSettings,
  updateSettings,
  resetSettings,

  setTheme,
  setLearningPace,
  setMasterVolume,
  setCharacterSpeed,
  setEffectiveSpeed,

  isSoundEnabled,
  isBackgroundAudioEnabled,
  getMasterVolume,
  areHintsEnabled,
  isImmediateFeedbackEnabled,
  prefersReducedMotion,
  getTheme,
  getLearningPace,
};