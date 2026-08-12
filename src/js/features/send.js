/**
 * =============================================================================
 * EduDit
 * Send Training Feature
 * =============================================================================
 *
 * Morse sending practice.
 *
 * Responsibilities:
 *
 * - Prepare the current Send session.
 * - Select a character from the learner's unlocked curriculum.
 * - Display the character target.
 * - Capture keyboard / mouse keying.
 * - Convert key-down / key-up timing into Morse elements.
 * - Compare the learner's Morse against the authoritative curriculum Morse.
 * - Measure sending timing.
 * - Submit completed attempts through SessionService.
 * - Update character mastery statistics.
 * - Render feedback and session progress.
 * - Cleanly stop input capture when the route is left.
 *
 * This module does NOT:
 *
 * - Define Morse timing rules.
 * - Persist data directly.
 * - Implement mastery formulas.
 * - Modify progression.
 *
 * The Morse curriculum, timing, session, mastery, and persistence systems
 * remain authoritative elsewhere.
 * =============================================================================
 */

import state from "../core/state.js";

import storage from "../core/storage.js";

import sessionService from "../services/sessionService.js";

import settingsService from "../services/settingsService.js";

import {
  getCharacters,
} from "../curriculum/characters.js";

import {
  getUnlockedCharacters,
} from "../training/progression.js";

import {
  applyAttempt,
} from "../training/mastery.js";

import {
  createTimingTable,
} from "../audio/morseAudio.js";


/* =============================================================================
   Constants
   ============================================================================= */

const DEFAULT_SESSION_LENGTH = 20;

const DEFAULT_WPM = 20;

const MIN_ELEMENT_MS = 30;

const MAX_ELEMENT_MS = 5000;

const KEY_GAP_TIMEOUT_MS = 2500;

const NEXT_ATTEMPT_DELAY_MS = 900;

const INPUT_KEY = " ";

const TARGET_TYPES = Object.freeze({
  CHARACTER: "character",
});

const INPUT_SOURCES = Object.freeze({
  KEYBOARD: "keyboard",
  MOUSE: "mouse",
});


/* =============================================================================
   Internal State
   ============================================================================= */

let mounted = false;

let activeContext = null;

let rootElement = null;

let sessionStarted = false;

let answerLocked = false;

let currentMaterial = null;

let currentAttempt = null;

let currentInput = null;

let keyDownAt = null;

let lastKeyUpAt = null;

let nextAttemptTimer = null;

let keyboardBound = false;

let pointerBound = false;


/* =============================================================================
   DOM Helpers
   ============================================================================= */

function query(selector) {
  return rootElement?.querySelector(selector) ?? null;
}


function queryAll(selector) {
  return rootElement
    ? Array.from(
        rootElement.querySelectorAll(selector),
      )
    : [];
}


function setText(selector, value) {
  const element = query(selector);

  if (element) {
    element.textContent = String(value ?? "");
  }
}


function setHidden(selector, hidden) {
  const element = query(selector);

  if (element) {
    element.hidden = Boolean(hidden);
  }
}


function setDisabled(selector, disabled) {
  const element = query(selector);

  if (element) {
    element.disabled = Boolean(disabled);
  }
}


function toggleClass(
  selector,
  className,
  enabled,
) {
  const element = query(selector);

  if (element) {
    element.classList.toggle(
      className,
      Boolean(enabled),
    );
  }
}


/* =============================================================================
   Settings
   ============================================================================= */

function getSettings() {
  try {
    return settingsService.getSettings();
  } catch {
    return {};
  }
}


function getLearningSettings() {
  return (
    getSettings().learning ??
    {}
  );
}


function getSendSettings() {
  /*
   * Send-specific settings may not exist in the current settings schema yet.
   *
   * Falling back to Receive WPM keeps the Send feature compatible with the
   * current settings model while leaving room for dedicated Send settings.
   */
  const settings = getSettings();

  return (
    settings.send ??
    settings.receive ??
    {}
  );
}


function getConfiguredWpm() {
  const sendSettings =
    getSendSettings();

  const value = Number(
    sendSettings.wpm ??
      DEFAULT_WPM,
  );

  return Number.isFinite(value)
    ? Math.max(
        5,
        Math.min(60, value),
      )
    : DEFAULT_WPM;
}


function getSessionLength() {
  const value = Number(
    getLearningSettings()
      .sessionLength ??
      DEFAULT_SESSION_LENGTH,
  );

  return Number.isInteger(value) &&
    value > 0
    ? value
    : DEFAULT_SESSION_LENGTH;
}


/* =============================================================================
   Formatting
   ============================================================================= */

function formatPercentage(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return "0%";
  }

  return `${Math.round(
    Math.max(
      0,
      Math.min(100, number),
    ),
  )}%`;
}


function formatMilliseconds(value) {
  const number = Number(value);

  if (
    !Number.isFinite(number) ||
    number <= 0
  ) {
    return "—";
  }

  if (number < 1000) {
    return `${Math.round(number)} ms`;
  }

  return `${(
    number / 1000
  ).toFixed(1)} s`;
}


function formatDuration(milliseconds) {
  const number =
    Number(milliseconds);

  if (
    !Number.isFinite(number) ||
    number <= 0
  ) {
    return "0m";
  }

  const minutes = Math.round(
    number / 60000,
  );

  if (minutes < 60) {
    return `${minutes}m`;
  }

  const hours =
    Math.floor(minutes / 60);

  const remainingMinutes =
    minutes % 60;

  return remainingMinutes === 0
    ? `${hours}h`
    : `${hours}h ${remainingMinutes}m`;
}


/* =============================================================================
   Curriculum
   ============================================================================= */

function getAvailableCharacters() {
  const allCharacters =
    getCharacters();

  const profile =
    state.getActiveProfile();

  if (!profile) {
    return [];
  }

  const unlocked =
    getUnlockedCharacters(
      profile.progression ?? {},
    );

  const unlockedSymbols =
    new Set(
      unlocked.map(
        (item) =>
          String(
            item?.symbol ??
              item?.id ??
              "",
          )
            .trim()
            .toUpperCase(),
      ),
    );

  return allCharacters.filter(
    (character) =>
      unlockedSymbols.has(
        String(
          character?.symbol ??
            character?.id ??
            "",
        )
          .trim()
          .toUpperCase(),
      ),
  );
}


function getFallbackCharacters() {
  return getCharacters();
}


function chooseNextCharacter() {
  const available =
    getAvailableCharacters();

  const candidates =
    available.length > 0
      ? available
      : getFallbackCharacters();

  if (candidates.length === 0) {
    return null;
  }

  /*
   * Prefer the weakest available character occasionally, while still keeping
   * Send practice varied.
   */
  const stats =
    candidates.map(
      (character) => {
        const symbol =
          normalizeCharacterSymbol(
            character,
          );

        const characterStats =
          state.getCharacterStats(
            symbol,
          ) ?? {};

        const accuracy =
          Number(
            characterStats.accuracy,
          );

        const attempts =
          Number(
            characterStats.attempts,
          );

        return {
          character,
          accuracy:
            Number.isFinite(
              accuracy,
            )
              ? accuracy
              : 0,
          attempts:
            Number.isFinite(
              attempts,
            )
              ? attempts
              : 0,
        };
      },
    );

  const underPracticed =
    stats
      .filter(
        (entry) =>
          entry.attempts < 3,
      )
      .sort(
        (first, second) =>
          first.attempts -
          second.attempts,
      );

  if (
    underPracticed.length > 0 &&
    Math.random() < 0.65
  ) {
    return (
      underPracticed[0]
        .character
    );
  }

  const weakest =
    [...stats].sort(
      (first, second) =>
        first.accuracy -
        second.accuracy,
    )[0];

  if (
    weakest &&
    Math.random() < 0.35
  ) {
    return weakest.character;
  }

  return candidates[
    Math.floor(
      Math.random() *
        candidates.length,
    )
  ];
}


function normalizeCharacterSymbol(
  character,
) {
  return String(
    character?.symbol ??
      character?.id ??
      "",
  )
    .trim()
    .toUpperCase();
}


function getMaterialMorse(
  material,
) {
  return String(
    material?.morse ?? "",
  ).trim();
}


/* =============================================================================
   Timing
   ============================================================================= */

/**
 * Get the canonical Morse timing table.
 *
 * The Send feature does not invent dot/dash timing. It consumes the same
 * timing definition used by the Morse audio engine.
 */
function getTiming() {
  return createTimingTable(
    getConfiguredWpm(),
  );
}


function getTimingTolerance(
  expectedDuration,
) {
  /*
   * Sending input is human-controlled, so a small proportional tolerance is
   * appropriate. This is deliberately forgiving enough for ordinary typing
   * hardware without turning a wildly incorrect element into a valid one.
   */
  const duration =
    Number(expectedDuration);

  if (
    !Number.isFinite(duration) ||
    duration <= 0
  ) {
    return 120;
  }

  return Math.max(
    80,
    Math.min(
      250,
      duration * 0.45,
    ),
  );
}


/* =============================================================================
   Input State
   ============================================================================= */

function createInputState() {
  return {
    elements: [],
    keyDownAt: null,
    lastKeyUpAt: null,
    startedAt: null,
    endedAt: null,
    source:
      INPUT_SOURCES.KEYBOARD,
  };
}


function resetInputState() {
  currentInput =
    createInputState();

  keyDownAt = null;
  lastKeyUpAt = null;

  renderInput();
}


function isInputActive() {
  return Boolean(
    keyDownAt !== null,
  );
}


/* =============================================================================
   Morse Element Recognition
   ============================================================================= */

function classifyElement(
  durationMs,
) {
  const timing =
    getTiming();

  const dotMs =
    timing.dot * 1000;

  const dashMs =
    timing.dash * 1000;

  const duration =
    Math.max(
      MIN_ELEMENT_MS,
      Math.min(
        MAX_ELEMENT_MS,
        Number(durationMs) || 0,
      ),
    );

  const midpoint =
    (dotMs + dashMs) / 2;

  /*
   * The midpoint between the canonical dot and dash durations provides a
   * simple and predictable first-pass element classifier.
   */
  return duration <= midpoint
    ? "."
    : "-";
}


function calculateElementTimingAccuracy(
  durationMs,
  symbol,
) {
  const timing =
    getTiming();

  const expected =
    symbol === "."
      ? timing.dot * 1000
      : timing.dash * 1000;

  const tolerance =
    getTimingTolerance(
      expected,
    );

  const difference =
    Math.abs(
      Number(durationMs) -
        expected,
    );

  if (
    difference >=
    tolerance
  ) {
    return 0;
  }

  return Math.max(
    0,
    1 -
      difference /
        tolerance,
  );
}


function calculateGapTimingAccuracy(
  gapMs,
) {
  const timing =
    getTiming();

  const expected =
    timing.elementGap * 1000;

  const tolerance =
    getTimingTolerance(
      expected,
    );

  const difference =
    Math.abs(
      Number(gapMs) -
        expected,
    );

  if (
    difference >=
    tolerance
  ) {
    return 0;
  }

  return Math.max(
    0,
    1 -
      difference /
        tolerance,
  );
}


/* =============================================================================
   Input Capture
   ============================================================================= */

function beginKeying(
  source = INPUT_SOURCES.KEYBOARD,
) {
  if (
    answerLocked ||
    !currentAttempt ||
    !currentInput
  ) {
    return;
  }

  if (
    keyDownAt !== null
  ) {
    return;
  }

  const timestamp =
    performance.now();

  if (
    currentInput.startedAt ===
    null
  ) {
    currentInput.startedAt =
      timestamp;
  }

  currentInput.source =
    source;

  keyDownAt =
    timestamp;

  currentInput.keyDownAt =
    timestamp;

  toggleKeyingIndicator(
    true,
  );

  renderInput();
}


function endKeying() {
  if (
    keyDownAt === null ||
    !currentInput
  ) {
    return;
  }

  const timestamp =
    performance.now();

  const duration =
    Math.max(
      0,
      timestamp -
        keyDownAt,
    );

  const symbol =
    classifyElement(
      duration,
    );

  const previousKeyUp =
    lastKeyUpAt;

  const gap =
    previousKeyUp === null
      ? null
      : Math.max(
          0,
          keyDownAt -
            previousKeyUp,
        );

  currentInput.elements.push(
    {
      symbol,
      durationMs:
        duration,
      gapMs: gap,
      timingAccuracy:
        calculateElementTimingAccuracy(
          duration,
          symbol,
        ),
    },
  );

  lastKeyUpAt =
    timestamp;

  currentInput.lastKeyUpAt =
    timestamp;

  keyDownAt = null;

  currentInput.keyDownAt =
    null;

  toggleKeyingIndicator(
    false,
  );

  renderInput();

  scheduleInputSubmission();
}


function scheduleInputSubmission() {
  clearNextAttemptTimer();

  /*
   * The learner can still add another Morse element immediately. We wait for
   * a natural inter-character pause before interpreting the input as complete.
   */
  nextAttemptTimer =
    window.setTimeout(
      () => {
        nextAttemptTimer = null;

        if (
          !currentInput ||
          currentInput.elements
            .length === 0 ||
          answerLocked
        ) {
          return;
        }

        submitCurrentInput();
      },
      KEY_GAP_TIMEOUT_MS,
    );
}


function cancelInput() {
  clearNextAttemptTimer();

  keyDownAt = null;
  lastKeyUpAt = null;

  currentInput =
    createInputState();

  toggleKeyingIndicator(
    false,
  );

  renderInput();
}


function clearNextAttemptTimer() {
  if (
    nextAttemptTimer === null
  ) {
    return;
  }

  window.clearTimeout(
    nextAttemptTimer,
  );

  nextAttemptTimer = null;
}


/* =============================================================================
   Input Evaluation
   ============================================================================= */

function evaluateInput(
  input,
  expectedMorse,
) {
  const elements =
    Array.isArray(
      input?.elements,
    )
      ? input.elements
      : [];

  const expected =
    String(
      expectedMorse ?? "",
    ).trim();

  const actual =
    elements
      .map(
        (element) =>
          element.symbol,
      )
      .join("");

  const symbolCorrect =
    actual === expected;

  const elementCountCorrect =
    actual.length ===
    expected.length;

  const elementTimingAccuracy =
    elements.length === 0
      ? 0
      : elements.reduce(
          (
            total,
            element,
          ) =>
            total +
            Number(
              element.timingAccuracy,
            ),
          0,
        ) /
        elements.length;

  const gapValues =
    elements
      .map(
        (element) =>
          element.gapMs,
      )
      .filter(
        (value) =>
          Number.isFinite(
            value,
          ),
      );

  const gapTimingAccuracy =
    gapValues.length === 0
      ? 1
      : gapValues.reduce(
          (
            total,
            value,
          ) =>
            total +
            calculateGapTimingAccuracy(
              value,
            ),
          0,
        ) /
        gapValues.length;

  const actualDuration =
    input?.startedAt !== null &&
    input?.endedAt !== null
      ? Math.max(
          0,
          input.endedAt -
            input.startedAt,
        )
      : 0;

  const timingAccuracy =
    (
      elementTimingAccuracy *
      0.75
    ) +
    (
      gapTimingAccuracy *
      0.25
    );

  /*
   * For the actual training result, Morse correctness remains binary. Timing
   * is reported separately so a learner cannot accidentally receive mastery
   * credit for a wrong character merely because the rhythm was close.
   */
  return {
    expected,
    actual,
    correct:
      symbolCorrect,
    elementCountCorrect,
    timingAccuracy,
    elementTimingAccuracy,
    gapTimingAccuracy,
    actualDuration,
  };
}


function submitCurrentInput() {
  if (
    answerLocked ||
    !currentAttempt ||
    !currentInput
  ) {
    return;
  }

  if (
    currentInput.elements
      .length === 0
  ) {
    return;
  }

  answerLocked = true;

  clearNextAttemptTimer();

  currentInput.endedAt =
    performance.now();

  const evaluation =
    evaluateInput(
      currentInput,
      getMaterialMorse(
        currentMaterial,
      ),
    );

  const answer =
    evaluation.actual;

  const attempt =
    sessionService.submitAnswer(
      answer,
    );

  const enrichedAttempt = {
    ...attempt,

    metadata: {
      ...(attempt.metadata ??
        {}),
      targetType:
        TARGET_TYPES.CHARACTER,
      expectedMorse:
        evaluation.expected,
      actualMorse:
        evaluation.actual,
      timingAccuracy:
        evaluation.timingAccuracy,
      elementTimingAccuracy:
        evaluation.elementTimingAccuracy,
      gapTimingAccuracy:
        evaluation.gapTimingAccuracy,
      sendDurationMs:
        evaluation.actualDuration,
      inputSource:
        currentInput.source,
    },
  };

  applyAttemptToMastery(
    enrichedAttempt,
  );

  renderFeedback(
    evaluation,
    enrichedAttempt,
  );

  renderSessionState();

  currentAttempt = null;

  setDisabled(
    "[data-send-submit]",
    true,
  );

  setDisabled(
    "[data-send-clear]",
    true,
  );

  const session =
    sessionService.getCurrentSession();

  if (!session) {
    finishSession();
    return;
  }

  nextAttemptTimer =
    window.setTimeout(
      () => {
        nextAttemptTimer = null;

        answerLocked = false;

        void beginAttempt();
      },
      NEXT_ATTEMPT_DELAY_MS,
    );
}


/* =============================================================================
   Mastery
   ============================================================================= */

function applyAttemptToMastery(
  attempt,
) {
  if (
    !attempt ||
    !currentMaterial
  ) {
    return;
  }

  const character =
    normalizeCharacterSymbol(
      currentMaterial,
    );

  const previous =
    state.getCharacterStats(
      character,
    );

  const recentAttempts =
    getRecentSessionAttempts(
      character,
    );

  const next =
    applyAttempt(
      previous,
      {
        ...attempt,

        timestamp:
          attempt.completedAt ??
          new Date().toISOString(),
      },
      recentAttempts,
    );

  const updatedProfile =
    state.updateCharacterStats(
      character,
      (stats) => {
        Object.assign(
          stats,
          next,
        );
      },
    );

  if (
    updatedProfile
  ) {
    storage.queueProfileWrite(
      state.getActiveProfile(),
    );
  }
}


function getRecentSessionAttempts(
  character,
) {
  const session =
    sessionService.getCurrentSession();

  if (
    !session ||
    !Array.isArray(
      session.attempts,
    )
  ) {
    return [];
  }

  return session.attempts
    .filter(
      (attempt) =>
        String(
          attempt.expected ??
            "",
        )
          .trim()
          .toUpperCase() ===
        character,
    )
    .slice(-10)
    .map(
      (attempt) => ({
        correct:
          attempt.correct === true,

        responseTimeMs:
          attempt.responseTimeMs,

        timestamp:
          attempt.completedAt ??
          attempt.startedAt,
      }),
    );
}


/* =============================================================================
   Session
   ============================================================================= */

function initializeSession() {
  const profile =
    state.getActiveProfile();

  if (!profile) {
    showEmptyState();
    return;
  }

  const characters =
    getAvailableCharacters();

  if (
    characters.length === 0
  ) {
    showEmptyState();
    return;
  }

  const session =
    sessionService.startSession(
      {
        mode: "sequential",
        sessionLength:
          getSessionLength(),
        target: {
          type:
            TARGET_TYPES.CHARACTER,
          direction: "send",
        },
      },
    );

  sessionStarted =
    Boolean(session);

  setHidden(
    "[data-send-training]",
    !sessionStarted,
  );

  setHidden(
    "[data-send-empty]",
    sessionStarted,
  );

  if (
    sessionStarted
  ) {
    renderSessionState();
  }
}


async function beginAttempt() {
  if (
    !mounted ||
    !sessionStarted ||
    answerLocked
  ) {
    return;
  }

  const material =
    chooseNextCharacter();

  if (!material) {
    showEmptyState();
    return;
  }

  currentMaterial =
    material;

  resetInputState();

  currentAttempt =
    sessionService.startAttempt(
      {
        expected:
          normalizeCharacterSymbol(
            material,
          ),
        item: {
          id:
            material.id ??
            material.symbol,
          symbol:
            normalizeCharacterSymbol(
              material,
            ),
          morse:
            getMaterialMorse(
              material,
            ),
        },
        metadata: {
          targetType:
            TARGET_TYPES.CHARACTER,
          direction: "send",
        },
      },
    );

  renderCurrentMaterial();

  setDisabled(
    "[data-send-clear]",
    false,
  );

  setDisabled(
    "[data-send-submit]",
    false,
  );
}


function finishSession() {
  clearNextAttemptTimer();

  toggleKeyingIndicator(
    false,
  );

  setHidden(
    "[data-send-training]",
    true,
  );

  setHidden(
    "[data-send-empty]",
    true,
  );

  setHidden(
    "[data-send-complete]",
    false,
  );

  const session =
    sessionService.getCurrentSession();

  if (
    session
  ) {
    renderCompletion(
      session,
    );
  }
}


function showEmptyState() {
  clearNextAttemptTimer();

  setHidden(
    "[data-send-training]",
    true,
  );

  setHidden(
    "[data-send-complete]",
    true,
  );

  setHidden(
    "[data-send-empty]",
    false,
  );
}


/* =============================================================================
   Rendering
   ============================================================================= */

function renderCurrentMaterial() {
  const symbol =
    normalizeCharacterSymbol(
      currentMaterial,
    );

  setText(
    "[data-send-target]",
    symbol,
  );

  setText(
    "[data-send-attempt-number]",
    getAttemptNumber(),
  );

  setText(
    "[data-send-target-label]",
    "Send this character",
  );

  setText(
    "[data-send-input-placeholder]",
    "Press and hold the key to send Morse",
  );

  setText(
    "[data-send-timing-wpm]",
    `${getConfiguredWpm()} WPM`,
  );

  setText(
    "[data-send-expected]",
    "—",
  );

  setHidden(
    "[data-send-feedback]",
    true,
  );
}


function renderInput() {
  const display =
    query(
      "[data-send-input-display]",
    );

  if (!display) {
    return;
  }

  const symbols =
    currentInput?.elements
      ?.map(
        (element) =>
          element.symbol,
      )
      .join(" ");

  display.textContent =
    symbols ||
    "";

  display.classList.toggle(
    "send-input-empty",
    !symbols,
  );

  const placeholder =
    query(
      "[data-send-input-placeholder]",
    );

  if (placeholder) {
    placeholder.hidden =
      Boolean(symbols);
  }

  setText(
    "[data-send-input-count]",
    currentInput?.elements
      ?.length ?? 0,
  );
}


function renderFeedback(
  evaluation,
  attempt,
) {
  const correct =
    evaluation.correct === true;

  const status =
    query(
      "[data-send-feedback-status]",
    );

  if (status) {
    status.textContent =
      correct
        ? "Correct"
        : "Not quite";

    status.classList.toggle(
      "send-feedback-correct",
      correct,
    );

    status.classList.toggle(
      "send-feedback-incorrect",
      !correct,
    );
  }

  setText(
    "[data-send-feedback-detail]",
    correct
      ? `Sent correctly in ${formatMilliseconds(
          evaluation.actualDuration,
        )}.`
      : "The Morse sequence did not match the target.",
  );

  setText(
    "[data-send-feedback-expected]",
    evaluation.expected,
  );

  setText(
    "[data-send-feedback-actual]",
    evaluation.actual ||
      "—",
  );

  setText(
    "[data-send-feedback-timing]",
    formatPercentage(
      evaluation.timingAccuracy *
        100,
    ),
  );

  setText(
    "[data-send-feedback-response]",
    formatMilliseconds(
      attempt.responseTimeMs,
    ),
  );

  setHidden(
    "[data-send-feedback]",
    false,
  );
}


function renderSessionState() {
  const session =
    sessionService.getCurrentSession();

  const total =
    session?.total ?? 0;

  const length =
    getSessionLength();

  const progress =
    length > 0
      ? Math.min(
          100,
          (total / length) *
            100,
        )
      : 0;

  const progressBar =
    query(
      "[data-send-progress-fill]",
    );

  if (progressBar) {
    progressBar.style.width =
      `${progress}%`;
  }

  setText(
    "[data-send-progress-label]",
    `${Math.min(
      total,
      length,
    )} / ${length}`,
  );

  setText(
    "[data-send-stat-total]",
    total,
  );

  setText(
    "[data-send-stat-correct]",
    session?.correct ?? 0,
  );

  setText(
    "[data-send-stat-accuracy]",
    formatPercentage(
      Number(
        session?.accuracy ?? 0,
      ) * 100,
    ),
  );

  setText(
    "[data-send-stat-response]",
    formatMilliseconds(
      session?.averageResponseTimeMs,
    ),
  );
}


function renderCompletion(
  session,
) {
  setText(
    "[data-send-complete-attempts]",
    session?.total ?? 0,
  );

  setText(
    "[data-send-complete-correct]",
    session?.correct ?? 0,
  );

  setText(
    "[data-send-complete-accuracy]",
    formatPercentage(
      Number(
        session?.accuracy ?? 0,
      ) * 100,
    ),
  );

  setText(
    "[data-send-complete-response]",
    formatMilliseconds(
      session?.averageResponseTimeMs,
    ),
  );
}


function getAttemptNumber() {
  const session =
    sessionService.getCurrentSession();

  return (
    (session?.total ?? 0) + 1
  );
}


function toggleKeyingIndicator(
  active,
) {
  toggleClass(
    "[data-send-keying]",
    "send-keying-active",
    active,
  );

  const label =
    query(
      "[data-send-keying-label]",
    );

  if (label) {
    label.textContent =
      active
        ? "Keying…"
        : "Ready";
  }

  const key =
    query(
      "[data-send-key]",
    );

  if (key) {
    key.classList.toggle(
      "send-key-active",
      Boolean(active),
    );
  }
}


/* =============================================================================
   Event Handlers
   ============================================================================= */

function handleKeyDown(
  event,
) {
  if (
    event.repeat ||
    answerLocked ||
    !currentAttempt
  ) {
    return;
  }

  /*
   * Space is the primary Morse key. We prevent normal page scrolling while
   * Send training is active.
   */
  if (
    event.code !== "Space"
  ) {
    return;
  }

  event.preventDefault();

  beginKeying(
    INPUT_SOURCES.KEYBOARD,
  );
}


function handleKeyUp(
  event,
) {
  if (
    event.code !== "Space"
  ) {
    return;
  }

  event.preventDefault();

  endKeying();
}


function handlePointerDown(
  event,
) {
  if (
    answerLocked ||
    !currentAttempt
  ) {
    return;
  }

  const key =
    event.target.closest(
      "[data-send-key]",
    );

  if (!key) {
    return;
  }

  event.preventDefault();

  beginKeying(
    INPUT_SOURCES.MOUSE,
  );
}


function handlePointerUp(
  event,
) {
  const key =
    event.target.closest(
      "[data-send-key]",
    );

  if (!key) {
    return;
  }

  event.preventDefault();

  endKeying();
}


function handleClear() {
  if (
    answerLocked ||
    !currentAttempt
  ) {
    return;
  }

  cancelInput();
}


function handleSubmit() {
  if (
    answerLocked ||
    !currentAttempt
  ) {
    return;
  }

  clearNextAttemptTimer();

  if (
    currentInput?.elements
      ?.length === 0
  ) {
    return;
  }

  submitCurrentInput();
}


function handlePause() {
  if (
    !sessionStarted
  ) {
    return;
  }

  try {
    if (
      isInputActive()
    ) {
      endKeying();
    }

    sessionService.pauseSession();

    setHidden(
      "[data-send-paused]",
      false,
    );
  } catch (error) {
    console.error(
      "[EduDit] Unable to pause Send training.",
      error,
    );
  }
}


function handleResume() {
  if (
    !sessionStarted
  ) {
    return;
  }

  try {
    sessionService.resumeSession();

    setHidden(
      "[data-send-paused]",
      true,
    );
  } catch (error) {
    console.error(
      "[EduDit] Unable to resume Send training.",
      error,
    );
  }
}


function handleRestart() {
  activeContext?.navigate(
    "send",
    {},
    {
      replace: true,
    },
  );
}


/* =============================================================================
   Event Binding
   ============================================================================= */

function bindEvents() {
  if (
    !keyboardBound
  ) {
    window.addEventListener(
      "keydown",
      handleKeyDown,
    );

    window.addEventListener(
      "keyup",
      handleKeyUp,
    );

    keyboardBound = true;
  }

  if (
    !pointerBound
  ) {
    rootElement?.addEventListener(
      "pointerdown",
      handlePointerDown,
    );

    rootElement?.addEventListener(
      "pointerup",
      handlePointerUp,
    );

    pointerBound = true;
  }

  query(
    "[data-send-clear]",
  )?.addEventListener(
    "click",
    handleClear,
  );

  query(
    "[data-send-submit]",
  )?.addEventListener(
    "click",
    handleSubmit,
  );

  query(
    "[data-send-pause]",
  )?.addEventListener(
    "click",
    handlePause,
  );

  query(
    "[data-send-resume]",
  )?.addEventListener(
    "click",
    handleResume,
  );

  query(
    "[data-send-restart]",
  )?.addEventListener(
    "click",
    handleRestart,
  );
}


function unbindEvents() {
  if (
    keyboardBound
  ) {
    window.removeEventListener(
      "keydown",
      handleKeyDown,
    );

    window.removeEventListener(
      "keyup",
      handleKeyUp,
    );

    keyboardBound = false;
  }

  if (
    pointerBound
  ) {
    rootElement?.removeEventListener(
      "pointerdown",
      handlePointerDown,
    );

    rootElement?.removeEventListener(
      "pointerup",
      handlePointerUp,
    );

    pointerBound = false;
  }
}


/* =============================================================================
   Lifecycle
   ============================================================================= */

async function mount(
  context,
) {
  activeContext =
    context;

  rootElement =
    context?.element ??
    null;

  if (!rootElement) {
    throw new Error(
      "Send feature requires a mounted view element.",
    );
  }

  mounted = true;

  bindEvents();

  setHidden(
    "[data-send-training]",
    true,
  );

  setHidden(
    "[data-send-empty]",
    true,
  );

  setHidden(
    "[data-send-complete]",
    true,
  );

  setHidden(
    "[data-send-paused]",
    true,
  );

  initializeSession();

  if (
    sessionStarted
  ) {
    await beginAttempt();
  }
}


function start() {
  if (
    !mounted ||
    !sessionStarted
  ) {
    return;
  }

  answerLocked = false;
}


function stop() {
  clearNextAttemptTimer();

  unbindEvents();

  if (
    isInputActive()
  ) {
    keyDownAt = null;
    lastKeyUpAt = null;
  }

  toggleKeyingIndicator(
    false,
  );

  if (
    sessionStarted
  ) {
    try {
      sessionService.stopSession();
    } catch {
      /*
       * The session may already have completed automatically.
       */
    }
  }

  sessionStarted = false;
  currentAttempt = null;
  currentMaterial = null;
  currentInput = null;
}


function destroy() {
  stop();

  rootElement = null;
  activeContext = null;

  mounted = false;

  answerLocked = false;

  nextAttemptTimer = null;
}


const sendFeature =
  Object.freeze({
    mount,
    start,
    stop,
    destroy,
  });


export {
  mount,
  start,
  stop,
  destroy,
};


export default sendFeature;