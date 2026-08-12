/**
 * =============================================================================
 * EduDit
 * Background Audio Engine
 * =============================================================================
 *
 * Owns optional background/noise audio used during training.
 *
 * Responsibilities:
 *   - Load and manage background audio
 *   - Start / stop playback
 *   - Control volume
 *   - Respect enabled/disabled state
 *   - Cleanly release audio resources
 *
 * This module does NOT control Morse tone playback.
 * Morse timing and tone generation belong exclusively to morseAudio.js.
 *
 * Background audio is intentionally optional and should never interfere with
 * the timing authority used by the Morse engine.
 * =============================================================================
 */


/* =============================================================================
   Constants
   ============================================================================= */


/**
 * Default background-audio settings.
 */
const DEFAULT_BACKGROUND_AUDIO_SETTINGS =
  Object.freeze({
    enabled: false,
    volume: 0.08,
    source: null,
  });


/**
 * Safe volume boundaries.
 */
const MIN_VOLUME = 0;

const MAX_VOLUME = 1;


/* =============================================================================
   Utilities
   ============================================================================= */


/**
 * Clamp a numeric value between two boundaries.
 *
 * @param {*} value
 * @param {number} minimum
 * @param {number} maximum
 * @returns {number}
 */
function clamp(
  value,
  minimum,
  maximum,
) {
  const numericValue =
    Number(value);

  if (
    !Number.isFinite(
      numericValue,
    )
  ) {
    return minimum;
  }

  return Math.min(
    Math.max(
      numericValue,
      minimum,
    ),
    maximum,
  );
}


/**
 * Normalize background-audio settings.
 *
 * @param {Object|null} settings
 * @returns {Object}
 */
function normalizeBackgroundAudioSettings(
  settings,
) {
  const source =
    settings?.source ??
    DEFAULT_BACKGROUND_AUDIO_SETTINGS.source;

  return {
    enabled:
      settings?.enabled === true,

    volume:
      clamp(
        settings?.volume ??
          DEFAULT_BACKGROUND_AUDIO_SETTINGS.volume,
        MIN_VOLUME,
        MAX_VOLUME,
      ),

    source:
      typeof source ===
      "string" &&
      source.trim().length > 0
        ? source
        : null,
  };
}


/* =============================================================================
   Background Audio Engine
   ============================================================================= */


class BackgroundAudioEngine {
  #audio = null;

  #settings;

  #destroyed = false;


  /**
   * @param {Object} settings
   */
  constructor(
    settings = {},
  ) {
    this.#settings =
      normalizeBackgroundAudioSettings(
        settings,
      );
  }


  /**
   * Determine whether the browser environment supports audio elements.
   *
   * @returns {boolean}
   */
  #isSupported() {
    return (
      typeof Audio !==
      "undefined"
    );
  }


  /**
   * Create the audio element if necessary.
   *
   * @returns {HTMLAudioElement|null}
   */
  #ensureAudio() {
    if (
      this.#destroyed ||
      !this.#isSupported()
    ) {
      return null;
    }


    if (
      this.#audio
    ) {
      return this.#audio;
    }


    if (
      !this.#settings.source
    ) {
      return null;
    }


    const audio =
      new Audio(
        this.#settings.source,
      );


    audio.loop = true;

    audio.preload =
      "auto";

    audio.volume =
      this.#settings.volume;


    this.#audio =
      audio;


    return audio;
  }


  /**
   * Apply current settings to the audio element.
   */
  #applySettings() {
    if (
      !this.#audio
    ) {
      return;
    }


    this.#audio.volume =
      this.#settings.volume;


    this.#audio.loop =
      true;
  }


  /**
   * Start background audio.
   *
   * If background audio is disabled or no source is configured, this is a
   * harmless no-op.
   *
   * @returns {Promise<boolean>}
   */
  async start() {
    if (
      this.#destroyed ||
      !this.#settings.enabled
    ) {
      return false;
    }


    const audio =
      this.#ensureAudio();


    if (
      !audio
    ) {
      return false;
    }


    this.#applySettings();


    try {
      await audio.play();

      return true;
    } catch (error) {
      /*
       * Browser autoplay restrictions or an unavailable source should never
       * break Morse training.
       */
      console.warn(
        "[EduDit] Background audio could not start.",
        error,
      );

      return false;
    }
  }


  /**
   * Stop background audio.
   *
   * @param {boolean} resetPosition
   */
  stop(
    resetPosition = true,
  ) {
    if (
      !this.#audio
    ) {
      return;
    }


    this.#audio.pause();


    if (
      resetPosition
    ) {
      try {
        this.#audio.currentTime =
          0;
      } catch {
        /*
         * Some media sources may not permit seeking.
         */
      }
    }
  }


  /**
   * Pause background audio without resetting its position.
   */
  pause() {
    if (
      !this.#audio
    ) {
      return;
    }


    this.#audio.pause();
  }


  /**
   * Resume background audio.
   *
   * @returns {Promise<boolean>}
   */
  async resume() {
    if (
      this.#destroyed ||
      !this.#settings.enabled ||
      !this.#audio
    ) {
      return false;
    }


    try {
      await this.#audio.play();

      return true;
    } catch (error) {
      console.warn(
        "[EduDit] Background audio could not resume.",
        error,
      );

      return false;
    }
  }


  /**
   * Enable or disable background audio.
   *
   * @param {boolean} enabled
   */
  setEnabled(
    enabled,
  ) {
    this.#settings = {
      ...this.#settings,

      enabled:
        enabled === true,
    };


    if (
      !this.#settings.enabled
    ) {
      this.stop();
    }
  }


  /**
   * Set background volume.
   *
   * @param {number} volume
   */
  setVolume(
    volume,
  ) {
    const nextVolume =
      clamp(
        volume,
        MIN_VOLUME,
        MAX_VOLUME,
      );


    this.#settings = {
      ...this.#settings,

      volume:
        nextVolume,
    };


    if (
      this.#audio
    ) {
      this.#audio.volume =
        nextVolume;
    }
  }


  /**
   * Change the audio source.
   *
   * The current audio element is discarded and recreated lazily when needed.
   *
   * @param {string|null} source
   */
  setSource(
    source,
  ) {
    const normalizedSource =
      typeof source ===
        "string" &&
      source.trim().length > 0
        ? source
        : null;


    this.stop();


    if (
      this.#audio
    ) {
      this.#audio.src =
        "";

      this.#audio.load();
    }


    this.#audio =
      null;


    this.#settings = {
      ...this.#settings,

      source:
        normalizedSource,
    };
  }


  /**
   * Return current settings.
   *
   * @returns {Object}
   */
  getSettings() {
    return {
      ...this.#settings,
    };
  }


  /**
   * Determine whether audio is currently playing.
   *
   * @returns {boolean}
   */
  isPlaying() {
    return Boolean(
      this.#audio &&
      !this.#audio.paused,
    );
  }


  /**
   * Release all audio resources.
   */
  destroy() {
    if (
      this.#destroyed
    ) {
      return;
    }


    this.stop();


    if (
      this.#audio
    ) {
      this.#audio.src =
        "";

      this.#audio.load();
    }


    this.#audio =
      null;

    this.#destroyed =
      true;
  }
}


/* =============================================================================
   Factory
   ============================================================================= */


/**
 * Create a background audio engine.
 *
 * @param {Object} settings
 * @returns {BackgroundAudioEngine}
 */
function createBackgroundAudioEngine(
  settings = {},
) {
  return new BackgroundAudioEngine(
    settings,
  );
}


/* =============================================================================
   Exports
   ============================================================================= */


export {
  DEFAULT_BACKGROUND_AUDIO_SETTINGS,

  MIN_VOLUME,
  MAX_VOLUME,

  normalizeBackgroundAudioSettings,

  BackgroundAudioEngine,
  createBackgroundAudioEngine,
};


export default BackgroundAudioEngine;