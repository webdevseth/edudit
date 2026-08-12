/**
 * =============================================================================
 * EduDit
 * Audio Constants
 * =============================================================================
 *
 * Centralized configuration for Morse audio and audio-related behavior.
 *
 * Nothing in the application should hard-code WPM, tone frequency, volume,
 * timing limits, or similar audio configuration values.
 *
 * The Morse audio engine consumes these constants, while user-configurable
 * settings may override the appropriate defaults.
 * =============================================================================
 */


/* =============================================================================
   Morse Timing
   ============================================================================= */


/**
 * Default Morse transmission speed.
 *
 * 20 WPM is a reasonable starting point for ear-first training while still
 * allowing enough time for a new learner to process individual characters.
 */
const DEFAULT_WPM = 20;


/**
 * Supported WPM range.
 *
 * These limits prevent accidental or invalid settings from producing unusable
 * audio.
 */
const MIN_WPM = 5;
const MAX_WPM = 60;


/**
 * Default tone frequency in Hertz.
 *
 * 600 Hz is a traditional and comfortable Morse training tone.
 */
const DEFAULT_TONE_FREQUENCY = 600;


/**
 * Supported tone frequency range.
 */
const MIN_TONE_FREQUENCY = 300;
const MAX_TONE_FREQUENCY = 1200;


/**
 * Default oscillator volume.
 *
 * Web Audio gain values range from 0 to 1.
 */
const DEFAULT_AUDIO_VOLUME = 0.7;


/**
 * Supported audio volume range.
 */
const MIN_AUDIO_VOLUME = 0;
const MAX_AUDIO_VOLUME = 1;


/* =============================================================================
   Background Audio
   ============================================================================= */


/**
 * Default background-noise state.
 *
 * Background noise is optional and should never interfere with the core
 * learning experience.
 */
const DEFAULT_BACKGROUND_NOISE_ENABLED = false;


/**
 * Default background-noise volume.
 *
 * Kept deliberately low so that background noise remains a training aid
 * rather than competing with the Morse signal.
 */
const DEFAULT_BACKGROUND_VOLUME = 0.12;


/**
 * Supported background-volume range.
 */
const MIN_BACKGROUND_VOLUME = 0;
const MAX_BACKGROUND_VOLUME = 1;


/* =============================================================================
   Audio Timing
   ============================================================================= */


/**
 * Standard Morse timing ratios.
 *
 * These values follow the conventional Morse timing relationship:
 *
 *   Dot              = 1 unit
 *   Dash             = 3 units
 *   Intra-character  = 1 unit
 *   Character gap    = 3 units
 *   Word gap         = 7 units
 *
 * These values are intentionally centralized because the same timing model
 * will eventually be used by both Receive playback and Send evaluation.
 */
const MORSE_TIMING = Object.freeze({
  DOT_UNITS: 1,
  DASH_UNITS: 3,
  INTRA_CHARACTER_GAP_UNITS: 1,
  CHARACTER_GAP_UNITS: 3,
  WORD_GAP_UNITS: 7,
});


/**
 * Minimum audio scheduling look-ahead.
 *
 * The audio engine schedules Web Audio events ahead of the current audio
 * clock rather than relying on JavaScript timers.
 */
const AUDIO_SCHEDULE_AHEAD_SECONDS = 0.05;


/**
 * Maximum audio scheduling chunk.
 *
 * Longer sequences can be scheduled in manageable chunks instead of creating
 * an unnecessarily large number of Web Audio nodes at once.
 */
const AUDIO_SCHEDULE_CHUNK_SECONDS = 2;


/**
 * Small fade duration used when starting/stopping generated tones.
 *
 * This helps prevent audible clicks without changing Morse timing.
 */
const AUDIO_FADE_SECONDS = 0.005;


/* =============================================================================
   Audio Response / Training Behavior
   ============================================================================= */


/**
 * Default delay before a response opportunity begins.
 *
 * This is intentionally short. The response timer should begin consistently
 * after the Morse audio has finished.
 */
const DEFAULT_RESPONSE_DELAY_MS = 0;


/**
 * Maximum duration for which an answer remains an active response.
 *
 * This does NOT necessarily discard the raw response time. The adaptive
 * engine is responsible for deciding whether an unusually long response
 * should influence learning calculations.
 */
const DEFAULT_RESPONSE_TIMEOUT_MS = 15000;


/* =============================================================================
   Utility Collections
   ============================================================================= */


/**
 * Frozen default audio configuration.
 *
 * Services can use this as the authoritative source for initial settings.
 */
const DEFAULT_AUDIO_SETTINGS = Object.freeze({
  wpm: DEFAULT_WPM,
  toneFrequency: DEFAULT_TONE_FREQUENCY,
  volume: DEFAULT_AUDIO_VOLUME,
  backgroundNoiseEnabled: DEFAULT_BACKGROUND_NOISE_ENABLED,
  backgroundVolume: DEFAULT_BACKGROUND_VOLUME,
});


/**
 * Frozen WPM configuration.
 */
const WPM_LIMITS = Object.freeze({
  MIN: MIN_WPM,
  MAX: MAX_WPM,
  DEFAULT: DEFAULT_WPM,
});


/**
 * Frozen tone-frequency configuration.
 */
const TONE_FREQUENCY_LIMITS = Object.freeze({
  MIN: MIN_TONE_FREQUENCY,
  MAX: MAX_TONE_FREQUENCY,
  DEFAULT: DEFAULT_TONE_FREQUENCY,
});


/**
 * Frozen volume configuration.
 */
const VOLUME_LIMITS = Object.freeze({
  MIN: MIN_AUDIO_VOLUME,
  MAX: MAX_AUDIO_VOLUME,
  DEFAULT: DEFAULT_AUDIO_VOLUME,
});


/* =============================================================================
   Exports
   ============================================================================= */


export {
  DEFAULT_WPM,
  MIN_WPM,
  MAX_WPM,

  DEFAULT_TONE_FREQUENCY,
  MIN_TONE_FREQUENCY,
  MAX_TONE_FREQUENCY,

  DEFAULT_AUDIO_VOLUME,
  MIN_AUDIO_VOLUME,
  MAX_AUDIO_VOLUME,

  DEFAULT_BACKGROUND_NOISE_ENABLED,
  DEFAULT_BACKGROUND_VOLUME,
  MIN_BACKGROUND_VOLUME,
  MAX_BACKGROUND_VOLUME,

  MORSE_TIMING,

  AUDIO_SCHEDULE_AHEAD_SECONDS,
  AUDIO_SCHEDULE_CHUNK_SECONDS,
  AUDIO_FADE_SECONDS,

  DEFAULT_RESPONSE_DELAY_MS,
  DEFAULT_RESPONSE_TIMEOUT_MS,

  DEFAULT_AUDIO_SETTINGS,
  WPM_LIMITS,
  TONE_FREQUENCY_LIMITS,
  VOLUME_LIMITS,
};


export default {
  DEFAULT_WPM,
  MIN_WPM,
  MAX_WPM,

  DEFAULT_TONE_FREQUENCY,
  MIN_TONE_FREQUENCY,
  MAX_TONE_FREQUENCY,

  DEFAULT_AUDIO_VOLUME,
  MIN_AUDIO_VOLUME,
  MAX_AUDIO_VOLUME,

  DEFAULT_BACKGROUND_NOISE_ENABLED,
  DEFAULT_BACKGROUND_VOLUME,
  MIN_BACKGROUND_VOLUME,
  MAX_BACKGROUND_VOLUME,

  MORSE_TIMING,

  AUDIO_SCHEDULE_AHEAD_SECONDS,
  AUDIO_SCHEDULE_CHUNK_SECONDS,
  AUDIO_FADE_SECONDS,

  DEFAULT_RESPONSE_DELAY_MS,
  DEFAULT_RESPONSE_TIMEOUT_MS,

  DEFAULT_AUDIO_SETTINGS,
  WPM_LIMITS,
  TONE_FREQUENCY_LIMITS,
  VOLUME_LIMITS,
};