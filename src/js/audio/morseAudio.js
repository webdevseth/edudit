/**
 * =============================================================================
 * EduDit
 * Morse Audio Engine
 * =============================================================================
 *
 * Single authoritative Morse playback and timing engine.
 *
 * Responsibilities:
 *   - Convert Morse timing rules from WPM
 *   - Build deterministic timing schedules
 *   - Schedule Morse tones using Web Audio API currentTime
 *   - Play dots, dashes, characters, and words
 *   - Provide timing information to other systems
 *   - Respect configured tone frequency and volume
 *
 * Important:
 *
 *   Web Audio API AudioContext.currentTime is the timing authority.
 *
 *   setTimeout() and setInterval() are NEVER used to schedule Morse tones.
 *
 * The same timing model can later be used by Send evaluation so that receive
 * playback and send evaluation share exactly the same definition of Morse
 * timing.
 *
 * This module does NOT:
 *   - choose training material
 *   - evaluate learner answers
 *   - update mastery
 *   - modify progression
 *   - manage sessions
 *
 * Those responsibilities belong to the training layer.
 * =============================================================================
 */


/* =============================================================================
   Constants
   ============================================================================= */


/**
 * Standard Morse timing ratios.
 *
 * One dot is the base unit.
 *
 * Dash       = 3 units
 * Element gap = 1 unit
 * Character gap = 3 units
 * Word gap     = 7 units
 */
const MORSE_TIMING_UNITS =
  Object.freeze({
    DOT: 1,
    DASH: 3,
    ELEMENT_GAP: 1,
    CHARACTER_GAP: 3,
    WORD_GAP: 7,
  });


/**
 * Default Morse audio configuration.
 */
const DEFAULT_MORSE_AUDIO_SETTINGS =
  Object.freeze({
    wpm: 20,
    toneFrequency: 600,
    volume: 0.5,
  });


/**
 * Supported WPM range.
 *
 * The application can expose a narrower range through Settings, but the
 * engine itself remains defensive.
 */
const MIN_WPM = 5;
const MAX_WPM = 60;


/**
 * Supported tone-frequency range.
 */
const MIN_TONE_FREQUENCY = 200;
const MAX_TONE_FREQUENCY = 2000;


/**
 * Supported volume range.
 */
const MIN_VOLUME = 0;
const MAX_VOLUME = 1;


/**
 * Minimum scheduled oscillator duration.
 *
 * This prevents extremely tiny audio events from becoming problematic on
 * some systems while remaining far below normal Morse timing.
 */
const MIN_TONE_DURATION_SECONDS =
  0.005;


/**
 * Default scheduling look-ahead.
 *
 * The engine schedules an entire Morse sequence ahead of the current audio
 * clock rather than reacting to JavaScript timers.
 */
const DEFAULT_SCHEDULE_AHEAD_SECONDS =
  0.05;


/**
 * Characters that represent silence rather than Morse elements.
 */
const SPACE_CHARACTER = " ";


/* =============================================================================
   Utilities
   ============================================================================= */


/**
 * Clamp a numeric value.
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
 * Normalize WPM.
 *
 * @param {*} value
 * @returns {number}
 */
function normalizeWpm(
  value,
) {
  return clamp(
    Math.round(
      Number(value) ||
        DEFAULT_MORSE_AUDIO_SETTINGS.wpm,
    ),
    MIN_WPM,
    MAX_WPM,
  );
}


/**
 * Normalize tone frequency.
 *
 * @param {*} value
 * @returns {number}
 */
function normalizeToneFrequency(
  value,
) {
  return clamp(
    Number(value) ||
      DEFAULT_MORSE_AUDIO_SETTINGS.toneFrequency,
    MIN_TONE_FREQUENCY,
    MAX_TONE_FREQUENCY,
  );
}


/**
 * Normalize volume.
 *
 * @param {*} value
 * @returns {number}
 */
function normalizeVolume(
  value,
) {
  return clamp(
    Number(value),
    MIN_VOLUME,
    MAX_VOLUME,
  );
}


/**
 * Normalize Morse text.
 *
 * Morse input is represented as uppercase characters with whitespace
 * preserved.
 *
 * @param {*} text
 * @returns {string}
 */
function normalizeText(
  text,
) {
  if (
    text === null ||
    text === undefined
  ) {
    return "";
  }

  return String(text)
    .toUpperCase();
}


/* =============================================================================
   Timing
   ============================================================================= */


/**
 * Calculate the duration of one Morse timing unit.
 *
 * Standard Morse timing:
 *
 *   dot = 1.2 / WPM seconds
 *
 * @param {number} wpm
 * @returns {number}
 */
function getUnitDuration(
  wpm,
) {
  const normalizedWpm =
    normalizeWpm(wpm);

  return (
    1.2 /
    normalizedWpm
  );
}


/**
 * Convert a Morse timing unit into seconds.
 *
 * @param {number} units
 * @param {number} wpm
 * @returns {number}
 */
function unitsToSeconds(
  units,
  wpm,
) {
  return (
    Math.max(
      0,
      Number(units) || 0,
    ) *
    getUnitDuration(wpm)
  );
}


/**
 * Return the duration of a dot.
 *
 * @param {number} wpm
 * @returns {number}
 */
function getDotDuration(
  wpm,
) {
  return unitsToSeconds(
    MORSE_TIMING_UNITS.DOT,
    wpm,
  );
}


/**
 * Return the duration of a dash.
 *
 * @param {number} wpm
 * @returns {number}
 */
function getDashDuration(
  wpm,
) {
  return unitsToSeconds(
    MORSE_TIMING_UNITS.DASH,
    wpm,
  );
}


/**
 * Return the gap between elements within one character.
 *
 * @param {number} wpm
 * @returns {number}
 */
function getElementGapDuration(
  wpm,
) {
  return unitsToSeconds(
    MORSE_TIMING_UNITS.ELEMENT_GAP,
    wpm,
  );
}


/**
 * Return the gap between Morse characters.
 *
 * @param {number} wpm
 * @returns {number}
 */
function getCharacterGapDuration(
  wpm,
) {
  return unitsToSeconds(
    MORSE_TIMING_UNITS.CHARACTER_GAP,
    wpm,
  );
}


/**
 * Return the gap between Morse words.
 *
 * @param {number} wpm
 * @returns {number}
 */
function getWordGapDuration(
  wpm,
) {
  return unitsToSeconds(
    MORSE_TIMING_UNITS.WORD_GAP,
    wpm,
  );
}


/* =============================================================================
   Timing Tables
   ============================================================================= */


/**
 * Create a timing table from WPM.
 *
 * This object is the canonical timing definition used by the engine.
 *
 * @param {number} wpm
 * @returns {Object}
 */
function createTimingTable(
  wpm,
) {
  const normalizedWpm =
    normalizeWpm(wpm);

  const unitDuration =
    getUnitDuration(
      normalizedWpm,
    );

  return {
    wpm:
      normalizedWpm,

    unitDuration,

    dot:
      unitDuration *
      MORSE_TIMING_UNITS.DOT,

    dash:
      unitDuration *
      MORSE_TIMING_UNITS.DASH,

    elementGap:
      unitDuration *
      MORSE_TIMING_UNITS.ELEMENT_GAP,

    characterGap:
      unitDuration *
      MORSE_TIMING_UNITS.CHARACTER_GAP,

    wordGap:
      unitDuration *
      MORSE_TIMING_UNITS.WORD_GAP,
  };
}


/**
 * Build the timing schedule for one Morse character.
 *
 * Each element contains:
 *
 *   type
 *   startOffset
 *   duration
 *   endOffset
 *
 * @param {string} morse
 * @param {number} wpm
 * @returns {Object}
 */
function buildCharacterSchedule(
  morse,
  wpm,
) {
  const normalizedMorse =
    String(morse || "")
      .trim();

  const timing =
    createTimingTable(wpm);

  const elements = [];

  let offset = 0;

  for (
    let index = 0;
    index <
    normalizedMorse.length;
    index += 1
  ) {
    const symbol =
      normalizedMorse[index];

    let duration;

    if (
      symbol === "."
    ) {
      duration =
        timing.dot;
    } else if (
      symbol === "-"
    ) {
      duration =
        timing.dash;
    } else {
      continue;
    }

    const startOffset =
      offset;

    const endOffset =
      startOffset +
      duration;

    elements.push({
      type:
        symbol === "."
          ? "dot"
          : "dash",

      symbol,

      startOffset,

      duration,

      endOffset,
    });

    offset =
      endOffset;

    /*
     * Element spacing is present between elements, but not after the final
     * element of the character.
     */
    if (
      index <
      normalizedMorse.length - 1
    ) {
      offset +=
        timing.elementGap;
    }
  }

  return {
    morse:
      normalizedMorse,

    duration:
      offset,

    elements,
  };
}


/**
 * Build a complete schedule for Morse text.
 *
 * The schedule contains tone events and silence gaps. It does not create any
 * Web Audio nodes and is therefore safe to use for Send evaluation later.
 *
 * @param {string} text
 * @param {Object} morseMap
 * @param {number} wpm
 * @returns {Object}
 */
function buildMorseSchedule(
  text,
  morseMap,
  wpm,
) {
  const normalizedText =
    normalizeText(text);

  const timing =
    createTimingTable(wpm);

  const characters = [];

  let offset = 0;

  for (
    let index = 0;
    index <
    normalizedText.length;
    index += 1
  ) {
    const character =
      normalizedText[index];

    if (
      character ===
      SPACE_CHARACTER
    ) {
      /*
       * A word gap is 7 units. If this follows a character, the preceding
       * character normally receives its 3-unit character gap separately.
       *
       * To avoid double-counting, remove the character gap and replace it
       * with the full word gap.
       */
      if (
        characters.length > 0
      ) {
        offset -=
          timing.characterGap;
      }

      offset +=
        timing.wordGap;

      characters.push({
        character,
        type: "word-gap",
        startOffset:
          offset -
          timing.wordGap,
        duration:
          timing.wordGap,
        endOffset:
          offset,
      });

      continue;
    }

    const morse =
      morseMap?.[character];

    if (
      typeof morse !==
        "string" ||
      morse.length === 0
    ) {
      /*
       * Unknown characters are skipped rather than producing accidental
       * timing or audio.
       */
      continue;
    }

    const characterSchedule =
      buildCharacterSchedule(
        morse,
        timing.wpm,
      );

    const startOffset =
      offset;

    const shiftedElements =
      characterSchedule.elements.map(
        (element) => ({
          ...element,

          startOffset:
            element.startOffset +
            startOffset,

          endOffset:
            element.endOffset +
            startOffset,
        }),
      );

    characters.push({
      character,

      morse,

      type:
        "character",

      startOffset,

      duration:
        characterSchedule.duration,

      endOffset:
        startOffset +
        characterSchedule.duration,

      elements:
        shiftedElements,
    });

    offset =
      startOffset +
      characterSchedule.duration;

    /*
     * Character spacing is added after every character except when the next
     * character is a word separator.
     *
     * The next iteration will replace this with a word gap where appropriate.
     */
    if (
      index <
      normalizedText.length - 1
    ) {
      offset +=
        timing.characterGap;
    }
  }

  /*
   * The final character does not require trailing silence for playback.
   */
  if (
    characters.length > 0
  ) {
    const last =
      characters[
        characters.length - 1
      ];

    if (
      last.type ===
      "character"
    ) {
      offset =
        last.endOffset;
    }
  }

  const toneEvents =
    characters
      .filter(
        (entry) =>
          entry.type ===
          "character",
      )
      .flatMap(
        (entry) =>
          entry.elements,
      );

  return {
    text:
      normalizedText,

    wpm:
      timing.wpm,

    timing,

    duration:
      Math.max(
        0,
        offset,
      ),

    characters,

    toneEvents,
  };
}


/* =============================================================================
   Audio Engine
   ============================================================================= */


class MorseAudioEngine {
  #audioContext = null;

  #masterGain = null;

  #settings;

  #activeSources = new Set();

  #destroyed = false;


  /**
   * @param {Object} settings
   */
  constructor(
    settings = {},
  ) {
    this.#settings = {
      ...DEFAULT_MORSE_AUDIO_SETTINGS,
      ...settings,
    };

    this.#settings.wpm =
      normalizeWpm(
        this.#settings.wpm,
      );

    this.#settings.toneFrequency =
      normalizeToneFrequency(
        this.#settings.toneFrequency,
      );

    this.#settings.volume =
      normalizeVolume(
        this.#settings.volume,
      );
  }


  /**
   * Get the browser's AudioContext constructor.
   *
   * @returns {Function|null}
   */
  #getAudioContextConstructor() {
    if (
      typeof window ===
      "undefined"
    ) {
      return null;
    }

    return (
      window.AudioContext ||
      window.webkitAudioContext ||
      null
    );
  }


  /**
   * Lazily create the AudioContext.
   *
   * @returns {AudioContext|null}
   */
  #ensureAudioContext() {
    if (
      this.#destroyed
    ) {
      return null;
    }

    if (
      this.#audioContext
    ) {
      return this.#audioContext;
    }

    const AudioContextConstructor =
      this.#getAudioContextConstructor();

    if (
      !AudioContextConstructor
    ) {
      return null;
    }

    this.#audioContext =
      new AudioContextConstructor();

    this.#masterGain =
      this.#audioContext.createGain();

    this.#masterGain.gain.value =
      this.#settings.volume;

    this.#masterGain.connect(
      this.#audioContext.destination,
    );

    return this.#audioContext;
  }


  /**
   * Resume a suspended AudioContext.
   *
   * @returns {Promise<boolean>}
   */
  async #resumeContext() {
    const context =
      this.#ensureAudioContext();

    if (
      !context
    ) {
      return false;
    }

    if (
      context.state ===
      "suspended"
    ) {
      try {
        await context.resume();
      } catch (error) {
        console.warn(
          "[EduDit] Unable to resume Morse AudioContext.",
          error,
        );

        return false;
      }
    }

    return true;
  }


  /**
   * Schedule one oscillator tone.
   *
   * @param {number} startTime
   * @param {number} duration
   * @returns {Object|null}
   */
  #scheduleTone(
    startTime,
    duration,
  ) {
    const context =
      this.#audioContext;

    const gain =
      this.#masterGain;

    if (
      !context ||
      !gain
    ) {
      return null;
    }

    const oscillator =
      context.createOscillator();

    const envelope =
      context.createGain();

    oscillator.type =
      "sine";

    oscillator.frequency.setValueAtTime(
      this.#settings.toneFrequency,
      startTime,
    );

    /*
     * A tiny envelope prevents hard oscillator edges from producing clicks.
     *
     * The envelope is extremely short compared with normal Morse timing and
     * therefore does not alter the intended timing structure.
     */
    const attack =
      Math.min(
        0.005,
        duration / 4,
      );

    const release =
      Math.min(
        0.005,
        duration / 4,
      );

    const safeDuration =
      Math.max(
        duration,
        MIN_TONE_DURATION_SECONDS,
      );

    const endTime =
      startTime +
      safeDuration;

    envelope.gain.setValueAtTime(
      0,
      startTime,
    );

    envelope.gain.linearRampToValueAtTime(
      1,
      startTime + attack,
    );

    envelope.gain.setValueAtTime(
      1,
      Math.max(
        startTime + attack,
        endTime - release,
      ),
    );

    envelope.gain.linearRampToValueAtTime(
      0,
      endTime,
    );

    oscillator.connect(
      envelope,
    );

    envelope.connect(
      gain,
    );

    oscillator.start(
      startTime,
    );

    oscillator.stop(
      endTime,
    );

    const source =
      {
        oscillator,
        envelope,
        endTime,
      };

    this.#activeSources.add(
      source,
    );

    oscillator.addEventListener(
      "ended",
      () => {
        this.#activeSources.delete(
          source,
        );

        try {
          oscillator.disconnect();
        } catch {
          // Already disconnected.
        }

        try {
          envelope.disconnect();
        } catch {
          // Already disconnected.
        }
      },
      {
        once: true,
      },
    );

    return source;
  }


  /**
   * Play a pre-built Morse schedule.
   *
   * @param {Object} schedule
   * @param {Object} options
   * @returns {Promise<Object|null>}
   */
  async playSchedule(
    schedule,
    {
      startTime,
      stopPrevious = true,
    } = {},
  ) {
    if (
      this.#destroyed ||
      !schedule ||
      !Array.isArray(
        schedule.toneEvents,
      )
    ) {
      return null;
    }

    if (
      stopPrevious
    ) {
      this.stop();
    }

    const contextReady =
      await this.#resumeContext();

    if (
      !contextReady ||
      !this.#audioContext
    ) {
      return null;
    }

    const context =
      this.#audioContext;

    const scheduledStart =
      Number.isFinite(
        Number(startTime),
      )
        ? Number(startTime)
        : context.currentTime +
          DEFAULT_SCHEDULE_AHEAD_SECONDS;

    const sources =
      [];

    for (
      const event of
      schedule.toneEvents
    ) {
      const toneStart =
        scheduledStart +
        event.startOffset;

      const source =
        this.#scheduleTone(
          toneStart,
          event.duration,
        );

      if (
        source
      ) {
        sources.push(
          source,
        );
      }
    }

    return {
      startTime:
        scheduledStart,

      endTime:
        scheduledStart +
        schedule.duration,

      duration:
        schedule.duration,

      sources,
    };
  }


  /**
   * Play Morse text using the supplied Morse map.
   *
   * @param {string} text
   * @param {Object} morseMap
   * @param {Object} options
   * @returns {Promise<Object|null>}
   */
  async playText(
    text,
    morseMap,
    options = {},
  ) {
    const schedule =
      buildMorseSchedule(
        text,
        morseMap,
        options.wpm ??
          this.#settings.wpm,
      );

    return this.playSchedule(
      schedule,
      options,
    );
  }


  /**
   * Stop all scheduled/current Morse tones.
   *
   * Already-scheduled Web Audio nodes are stopped immediately relative to the
   * audio clock. No JavaScript timers are involved.
   */
  stop() {
    if (
      !this.#audioContext
    ) {
      return;
    }

    const now =
      this.#audioContext.currentTime;

    for (
      const source of
      this.#activeSources
    ) {
      try {
        source.oscillator.stop(
          now,
        );
      } catch {
        /*
         * Oscillator may already have stopped.
         */
      }
    }

    this.#activeSources.clear();
  }


  /**
   * Set WPM.
   *
   * @param {number} wpm
   */
  setWpm(
    wpm,
  ) {
    this.#settings.wpm =
      normalizeWpm(wpm);
  }


  /**
   * Set tone frequency.
   *
   * @param {number} frequency
   */
  setToneFrequency(
    frequency,
  ) {
    this.#settings.toneFrequency =
      normalizeToneFrequency(
        frequency,
      );
  }


  /**
   * Set master volume.
   *
   * @param {number} volume
   */
  setVolume(
    volume,
  ) {
    const normalized =
      normalizeVolume(
        volume,
      );

    this.#settings.volume =
      normalized;

    if (
      this.#masterGain &&
      this.#audioContext
    ) {
      this.#masterGain.gain.setValueAtTime(
        normalized,
        this.#audioContext.currentTime,
      );
    }
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
   * Return the AudioContext current time.
   *
   * Useful for synchronization with future visual hint playback.
   *
   * @returns {number}
   */
  getCurrentTime() {
    return (
      this.#audioContext
        ?.currentTime ?? 0
    );
  }


  /**
   * Determine whether the engine has an active AudioContext.
   *
   * @returns {boolean}
   */
  isInitialized() {
    return Boolean(
      this.#audioContext,
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
      this.#audioContext
    ) {
      this.#audioContext
        .close()
        .catch(() => {
          /*
           * AudioContext cleanup failure should never break application
           * shutdown.
           */
        });
    }

    this.#audioContext =
      null;

    this.#masterGain =
      null;

    this.#destroyed =
      true;
  }
}


/* =============================================================================
   Factory
   ============================================================================= */


/**
 * Create a Morse audio engine.
 *
 * @param {Object} settings
 * @returns {MorseAudioEngine}
 */
function createMorseAudioEngine(
  settings = {},
) {
  return new MorseAudioEngine(
    settings,
  );
}


/* =============================================================================
   Exports
   ============================================================================= */


export {
  MORSE_TIMING_UNITS,

  DEFAULT_MORSE_AUDIO_SETTINGS,

  MIN_WPM,
  MAX_WPM,

  MIN_TONE_FREQUENCY,
  MAX_TONE_FREQUENCY,

  MIN_VOLUME,
  MAX_VOLUME,

  clamp,

  normalizeWpm,
  normalizeToneFrequency,
  normalizeVolume,
  normalizeText,

  getUnitDuration,
  unitsToSeconds,

  getDotDuration,
  getDashDuration,
  getElementGapDuration,
  getCharacterGapDuration,
  getWordGapDuration,

  createTimingTable,
  buildCharacterSchedule,
  buildMorseSchedule,

  MorseAudioEngine,
  createMorseAudioEngine,
};


export default MorseAudioEngine;