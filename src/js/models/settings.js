/**
 * =============================================================================
 * EduDit
 * Settings Model
 * =============================================================================
 *
 * Canonical learner settings model.
 *
 * Settings are deliberately grouped by responsibility:
 *
 *   learning   - learning strategy and session configuration
 *   receive    - Morse receiving/training configuration
 *   audio      - background audio configuration
 *   appearance - visual/theme configuration
 *
 * This module:
 *   - defines the canonical settings shape
 *   - creates safe defaults
 *   - normalizes persisted/imported settings
 *   - provides immutable update helpers
 *   - validates settings
 *
 * It does NOT:
 *   - persist data
 *   - manipulate the DOM
 *   - control audio
 *   - apply themes
 *
 * Persistence belongs to the storage/service layer.
 * UI/audio/theme behavior belongs to their respective systems.
 * =============================================================================
 */


/* =============================================================================
   Constants
   ============================================================================= */


/**
 * Supported application themes.
 */
const THEME_OPTIONS = Object.freeze([
  "system",
  "light",
  "dark",
]);


/**
 * Supported learning paces.
 */
const LEARNING_PACE_OPTIONS = Object.freeze([
  "slow",
  "standard",
  "fast",
]);


/**
 * Supported training modes.
 */
const TRAINING_MODE_OPTIONS = Object.freeze([
  "adaptive",
  "sequential",
  "custom",
]);


/**
 * Supported receive response timing modes.
 */
const RESPONSE_TIMING_OPTIONS = Object.freeze([
  "after-audio",
  "during-audio",
]);


/**
 * Supported hint behavior modes.
 */
const HINT_BEHAVIOR_OPTIONS = Object.freeze([
  "manual",
  "automatic",
  "disabled",
]);


/**
 * Canonical default settings.
 *
 * Keep this structure synchronized with the architectural settings model in
 * core/state.js.
 */
const DEFAULT_SETTINGS = Object.freeze({
  learning: Object.freeze({
    learningPace: "standard",
    trainingMode: "adaptive",
    sessionLength: 20,
  }),

  receive: Object.freeze({
    wpm: 20,
    toneFrequencyHz: 600,
    responseTiming: "after-audio",
    showKeyboard: true,
    hintBehavior: "manual",
  }),

  audio: Object.freeze({
    backgroundNoiseEnabled: false,
    backgroundVolume: 0.08,
  }),

  appearance: Object.freeze({
    theme: "system",
  }),
});


/* =============================================================================
   Normalization Helpers
   ============================================================================= */


/**
 * Normalize an object.
 *
 * @param {*} value
 * @returns {Object}
 */
function normalizeObject(value) {
  return (
    value &&
    typeof value === "object" &&
    !Array.isArray(value)
  )
    ? value
    : {};
}


/**
 * Normalize a boolean.
 *
 * @param {*} value
 * @param {boolean} fallback
 * @returns {boolean}
 */
function normalizeBoolean(
  value,
  fallback,
) {
  return typeof value === "boolean"
    ? value
    : fallback;
}


/**
 * Normalize a bounded number.
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
 * Normalize a bounded integer.
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
 * Normalize an enum value.
 *
 * @param {*} value
 * @param {Array<string>} options
 * @param {string} fallback
 * @returns {string}
 */
function normalizeOption(
  value,
  options,
  fallback,
) {
  return options.includes(value)
    ? value
    : fallback;
}


/* =============================================================================
   Group Normalizers
   ============================================================================= */


/**
 * Normalize learning settings.
 *
 * @param {*} value
 * @returns {Object}
 */
function normalizeLearningSettings(value) {
  const source =
    normalizeObject(value);

  return {
    learningPace:
      normalizeOption(
        source.learningPace,
        LEARNING_PACE_OPTIONS,
        DEFAULT_SETTINGS.learning.learningPace,
      ),

    trainingMode:
      normalizeOption(
        source.trainingMode,
        TRAINING_MODE_OPTIONS,
        DEFAULT_SETTINGS.learning.trainingMode,
      ),

    sessionLength:
      normalizeInteger(
        source.sessionLength,
        DEFAULT_SETTINGS.learning.sessionLength,
        1,
        100,
      ),
  };
}


/**
 * Normalize receive settings.
 *
 * @param {*} value
 * @returns {Object}
 */
function normalizeReceiveSettings(value) {
  const source =
    normalizeObject(value);

  return {
    wpm:
      normalizeNumber(
        source.wpm,
        DEFAULT_SETTINGS.receive.wpm,
        5,
        60,
      ),

    toneFrequencyHz:
      normalizeInteger(
        source.toneFrequencyHz,
        DEFAULT_SETTINGS.receive.toneFrequencyHz,
        100,
        2000,
      ),

    responseTiming:
      normalizeOption(
        source.responseTiming,
        RESPONSE_TIMING_OPTIONS,
        DEFAULT_SETTINGS.receive.responseTiming,
      ),

    showKeyboard:
      normalizeBoolean(
        source.showKeyboard,
        DEFAULT_SETTINGS.receive.showKeyboard,
      ),

    hintBehavior:
      normalizeOption(
        source.hintBehavior,
        HINT_BEHAVIOR_OPTIONS,
        DEFAULT_SETTINGS.receive.hintBehavior,
      ),
  };
}


/**
 * Normalize audio settings.
 *
 * @param {*} value
 * @returns {Object}
 */
function normalizeAudioSettings(value) {
  const source =
    normalizeObject(value);

  return {
    backgroundNoiseEnabled:
      normalizeBoolean(
        source.backgroundNoiseEnabled,
        DEFAULT_SETTINGS.audio.backgroundNoiseEnabled,
      ),

    backgroundVolume:
      normalizeNumber(
        source.backgroundVolume,
        DEFAULT_SETTINGS.audio.backgroundVolume,
        0,
        1,
      ),
  };
}


/**
 * Normalize appearance settings.
 *
 * @param {*} value
 * @returns {Object}
 */
function normalizeAppearanceSettings(value) {
  const source =
    normalizeObject(value);

  return {
    theme:
      normalizeOption(
        source.theme,
        THEME_OPTIONS,
        DEFAULT_SETTINGS.appearance.theme,
      ),
  };
}


/* =============================================================================
   Factory / Normalization
   ============================================================================= */


/**
 * Create a fresh settings object.
 *
 * @param {Object} overrides
 * @returns {Object}
 */
function createSettings(
  overrides = {},
) {
  return normalizeSettings(
    overrides,
  );
}


/**
 * Normalize settings into the canonical nested shape.
 *
 * Unknown properties are intentionally discarded.
 *
 * @param {*} settings
 * @returns {Object}
 */
function normalizeSettings(settings) {
  const source =
    normalizeObject(settings);

  return {
    learning:
      normalizeLearningSettings(
        source.learning,
      ),

    receive:
      normalizeReceiveSettings(
        source.receive,
      ),

    audio:
      normalizeAudioSettings(
        source.audio,
      ),

    appearance:
      normalizeAppearanceSettings(
        source.appearance,
      ),
  };
}


/**
 * Update settings immutably.
 *
 * Top-level groups are merged rather than replaced.
 *
 * @param {*} settings
 * @param {Object} updates
 * @returns {Object}
 */
function updateSettings(
  settings,
  updates = {},
) {
  const current =
    normalizeSettings(settings);

  const normalizedUpdates =
    normalizeObject(updates);

  return normalizeSettings({
    ...current,

    ...normalizedUpdates,

    learning: {
      ...current.learning,
      ...normalizeObject(
        normalizedUpdates.learning,
      ),
    },

    receive: {
      ...current.receive,
      ...normalizeObject(
        normalizedUpdates.receive,
      ),
    },

    audio: {
      ...current.audio,
      ...normalizeObject(
        normalizedUpdates.audio,
      ),
    },

    appearance: {
      ...current.appearance,
      ...normalizeObject(
        normalizedUpdates.appearance,
      ),
    },
  });
}


/**
 * Reset settings to defaults.
 *
 * @returns {Object}
 */
function resetSettings() {
  return createSettings(
    DEFAULT_SETTINGS,
  );
}


/* =============================================================================
   Group Update Helpers
   ============================================================================= */


/**
 * Update learning settings.
 *
 * @param {Object} settings
 * @param {Object} updates
 * @returns {Object}
 */
function updateLearningSettings(
  settings,
  updates = {},
) {
  return updateSettings(
    settings,
    {
      learning: updates,
    },
  );
}


/**
 * Update receive settings.
 *
 * @param {Object} settings
 * @param {Object} updates
 * @returns {Object}
 */
function updateReceiveSettings(
  settings,
  updates = {},
) {
  return updateSettings(
    settings,
    {
      receive: updates,
    },
  );
}


/**
 * Update audio settings.
 *
 * @param {Object} settings
 * @param {Object} updates
 * @returns {Object}
 */
function updateAudioSettings(
  settings,
  updates = {},
) {
  return updateSettings(
    settings,
    {
      audio: updates,
    },
  );
}


/**
 * Update appearance settings.
 *
 * @param {Object} settings
 * @param {Object} updates
 * @returns {Object}
 */
function updateAppearanceSettings(
  settings,
  updates = {},
) {
  return updateSettings(
    settings,
    {
      appearance: updates,
    },
  );
}


/* =============================================================================
   Individual Setting Helpers
   ============================================================================= */


/**
 * Set application theme.
 *
 * @param {Object} settings
 * @param {string} theme
 * @returns {Object}
 */
function setTheme(
  settings,
  theme,
) {
  return updateAppearanceSettings(
    settings,
    {
      theme,
    },
  );
}


/**
 * Set learning pace.
 *
 * @param {Object} settings
 * @param {string} learningPace
 * @returns {Object}
 */
function setLearningPace(
  settings,
  learningPace,
) {
  return updateLearningSettings(
    settings,
    {
      learningPace,
    },
  );
}


/**
 * Set training mode.
 *
 * @param {Object} settings
 * @param {string} trainingMode
 * @returns {Object}
 */
function setTrainingMode(
  settings,
  trainingMode,
) {
  return updateLearningSettings(
    settings,
    {
      trainingMode,
    },
  );
}


/**
 * Set session length.
 *
 * @param {Object} settings
 * @param {number} sessionLength
 * @returns {Object}
 */
function setSessionLength(
  settings,
  sessionLength,
) {
  return updateLearningSettings(
    settings,
    {
      sessionLength,
    },
  );
}


/**
 * Set receive WPM.
 *
 * @param {Object} settings
 * @param {number} wpm
 * @returns {Object}
 */
function setReceiveWpm(
  settings,
  wpm,
) {
  return updateReceiveSettings(
    settings,
    {
      wpm,
    },
  );
}


/**
 * Set Morse tone frequency.
 *
 * @param {Object} settings
 * @param {number} toneFrequencyHz
 * @returns {Object}
 */
function setToneFrequency(
  settings,
  toneFrequencyHz,
) {
  return updateReceiveSettings(
    settings,
    {
      toneFrequencyHz,
    },
  );
}


/**
 * Set response timing.
 *
 * @param {Object} settings
 * @param {string} responseTiming
 * @returns {Object}
 */
function setResponseTiming(
  settings,
  responseTiming,
) {
  return updateReceiveSettings(
    settings,
    {
      responseTiming,
    },
  );
}


/**
 * Set keyboard visibility.
 *
 * @param {Object} settings
 * @param {boolean} showKeyboard
 * @returns {Object}
 */
function setKeyboardVisibility(
  settings,
  showKeyboard,
) {
  return updateReceiveSettings(
    settings,
    {
      showKeyboard,
    },
  );
}


/**
 * Set hint behavior.
 *
 * @param {Object} settings
 * @param {string} hintBehavior
 * @returns {Object}
 */
function setHintBehavior(
  settings,
  hintBehavior,
) {
  return updateReceiveSettings(
    settings,
    {
      hintBehavior,
    },
  );
}


/**
 * Set background noise state.
 *
 * @param {Object} settings
 * @param {boolean} enabled
 * @returns {Object}
 */
function setBackgroundNoiseEnabled(
  settings,
  enabled,
) {
  return updateAudioSettings(
    settings,
    {
      backgroundNoiseEnabled: enabled,
    },
  );
}


/**
 * Set background audio volume.
 *
 * @param {Object} settings
 * @param {number} volume
 * @returns {Object}
 */
function setBackgroundVolume(
  settings,
  volume,
) {
  return updateAudioSettings(
    settings,
    {
      backgroundVolume: volume,
    },
  );
}


/* =============================================================================
   Queries
   ============================================================================= */


/**
 * Get the configured theme.
 *
 * @param {Object} settings
 * @returns {string}
 */
function getTheme(settings) {
  return normalizeSettings(
    settings,
  ).appearance.theme;
}


/**
 * Get the learning pace.
 *
 * @param {Object} settings
 * @returns {string}
 */
function getLearningPace(settings) {
  return normalizeSettings(
    settings,
  ).learning.learningPace;
}


/**
 * Get the training mode.
 *
 * @param {Object} settings
 * @returns {string}
 */
function getTrainingMode(settings) {
  return normalizeSettings(
    settings,
  ).learning.trainingMode;
}


/**
 * Get the session length.
 *
 * @param {Object} settings
 * @returns {number}
 */
function getSessionLength(settings) {
  return normalizeSettings(
    settings,
  ).learning.sessionLength;
}


/**
 * Get receive WPM.
 *
 * @param {Object} settings
 * @returns {number}
 */
function getReceiveWpm(settings) {
  return normalizeSettings(
    settings,
  ).receive.wpm;
}


/**
 * Get tone frequency.
 *
 * @param {Object} settings
 * @returns {number}
 */
function getToneFrequency(settings) {
  return normalizeSettings(
    settings,
  ).receive.toneFrequencyHz;
}


/**
 * Determine whether the keyboard should be displayed.
 *
 * @param {Object} settings
 * @returns {boolean}
 */
function isKeyboardVisible(settings) {
  return normalizeSettings(
    settings,
  ).receive.showKeyboard;
}


/**
 * Determine whether background noise is enabled.
 *
 * @param {Object} settings
 * @returns {boolean}
 */
function isBackgroundNoiseEnabled(settings) {
  return normalizeSettings(
    settings,
  ).audio.backgroundNoiseEnabled;
}


/**
 * Get background volume.
 *
 * @param {Object} settings
 * @returns {number}
 */
function getBackgroundVolume(settings) {
  return normalizeSettings(
    settings,
  ).audio.backgroundVolume;
}


/* =============================================================================
   Validation
   ============================================================================= */


/**
 * Validate settings.
 *
 * Validation checks the canonical nested shape rather than silently
 * normalizing it. This makes malformed persisted data visible to callers.
 *
 * @param {*} settings
 * @returns {{valid: boolean, errors: string[]}}
 */
function validateSettings(settings) {
  const errors = [];

  if (
    !settings ||
    typeof settings !== "object" ||
    Array.isArray(settings)
  ) {
    return {
      valid: false,
      errors: [
        "Settings must be an object.",
      ],
    };
  }

  const learning =
    normalizeObject(
      settings.learning,
    );

  const receive =
    normalizeObject(
      settings.receive,
    );

  const audio =
    normalizeObject(
      settings.audio,
    );

  const appearance =
    normalizeObject(
      settings.appearance,
    );

  if (
    !LEARNING_PACE_OPTIONS.includes(
      learning.learningPace,
    )
  ) {
    errors.push(
      "learning.learningPace is invalid.",
    );
  }

  if (
    !TRAINING_MODE_OPTIONS.includes(
      learning.trainingMode,
    )
  ) {
    errors.push(
      "learning.trainingMode is invalid.",
    );
  }

  if (
    !Number.isInteger(
      learning.sessionLength,
    ) ||
    learning.sessionLength < 1 ||
    learning.sessionLength > 100
  ) {
    errors.push(
      "learning.sessionLength must be an integer between 1 and 100.",
    );
  }

  if (
    !Number.isFinite(
      receive.wpm,
    ) ||
    receive.wpm < 5 ||
    receive.wpm > 60
  ) {
    errors.push(
      "receive.wpm must be between 5 and 60.",
    );
  }

  if (
    !Number.isInteger(
      receive.toneFrequencyHz,
    ) ||
    receive.toneFrequencyHz < 100 ||
    receive.toneFrequencyHz > 2000
  ) {
    errors.push(
      "receive.toneFrequencyHz must be an integer between 100 and 2000.",
    );
  }

  if (
    !RESPONSE_TIMING_OPTIONS.includes(
      receive.responseTiming,
    )
  ) {
    errors.push(
      "receive.responseTiming is invalid.",
    );
  }

  if (
    typeof receive.showKeyboard !==
    "boolean"
  ) {
    errors.push(
      "receive.showKeyboard must be a boolean.",
    );
  }

  if (
    !HINT_BEHAVIOR_OPTIONS.includes(
      receive.hintBehavior,
    )
  ) {
    errors.push(
      "receive.hintBehavior is invalid.",
    );
  }

  if (
    typeof audio.backgroundNoiseEnabled !==
    "boolean"
  ) {
    errors.push(
      "audio.backgroundNoiseEnabled must be a boolean.",
    );
  }

  if (
    !Number.isFinite(
      audio.backgroundVolume,
    ) ||
    audio.backgroundVolume < 0 ||
    audio.backgroundVolume > 1
  ) {
    errors.push(
      "audio.backgroundVolume must be between 0 and 1.",
    );
  }

  if (
    !THEME_OPTIONS.includes(
      appearance.theme,
    )
  ) {
    errors.push(
      "appearance.theme is invalid.",
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
  TRAINING_MODE_OPTIONS,
  RESPONSE_TIMING_OPTIONS,
  HINT_BEHAVIOR_OPTIONS,

  createSettings,
  normalizeSettings,
  updateSettings,
  resetSettings,

  updateLearningSettings,
  updateReceiveSettings,
  updateAudioSettings,
  updateAppearanceSettings,

  setTheme,
  setLearningPace,
  setTrainingMode,
  setSessionLength,
  setReceiveWpm,
  setToneFrequency,
  setResponseTiming,
  setKeyboardVisibility,
  setHintBehavior,
  setBackgroundNoiseEnabled,
  setBackgroundVolume,

  getTheme,
  getLearningPace,
  getTrainingMode,
  getSessionLength,
  getReceiveWpm,
  getToneFrequency,
  isKeyboardVisible,
  isBackgroundNoiseEnabled,
  getBackgroundVolume,

  validateSettings,
};


export default {
  createSettings,
  normalizeSettings,
  updateSettings,
  resetSettings,

  updateLearningSettings,
  updateReceiveSettings,
  updateAudioSettings,
  updateAppearanceSettings,

  setTheme,
  setLearningPace,
  setTrainingMode,
  setSessionLength,
  setReceiveWpm,
  setToneFrequency,
  setResponseTiming,
  setKeyboardVisibility,
  setHintBehavior,
  setBackgroundNoiseEnabled,
  setBackgroundVolume,

  getTheme,
  getLearningPace,
  getTrainingMode,
  getSessionLength,
  getReceiveWpm,
  getToneFrequency,
  isKeyboardVisible,
  isBackgroundNoiseEnabled,
  getBackgroundVolume,

  validateSettings,
};

