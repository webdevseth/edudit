/**
 * =============================================================================
 * EduDit
 * Receive Training Feature
 * =============================================================================
 *
 * Primary ear-first Morse recognition experience.
 *
 * Responsibilities:
 *
 * - Prepare the current receive session.
 * - Select adaptive or explicitly requested practice material.
 * - Play Morse audio.
 * - Accept and evaluate learner answers through SessionService.
 * - Apply completed attempts to character mastery statistics.
 * - Provide replay and hint controls.
 * - Render session progress and feedback.
 * - Cleanly stop audio/session activity when the route is left.
 *
 * This module does NOT:
 *
 * - Implement Morse timing.
 * - Implement mastery formulas.
 * - Implement adaptive ranking algorithms.
 * - Persist data directly.
 * - Modify permanent progression merely because a lesson was selected.
 *
 * Those responsibilities belong to the audio, mastery, adaptive, storage,
 * state, and progression layers respectively.
 * =============================================================================
 */

import state from "../core/state.js";

import storage from "../core/storage.js";

import sessionService from "../services/sessionService.js";

import settingsService from "../services/settingsService.js";

import curriculumService from "../services/curriculumService.js";

import {
  getCharacters,
} from "../curriculum/characters.js";

import {
  selectAdaptiveCharacters,
  selectReinforcementCharacters,
} from "../training/adaptive.js";

import {
  getUnlockedCharacters,
  resolvePracticeTarget,
} from "../training/progression.js";

import {
  applyAttempt,
} from "../training/mastery.js";

import {
  createMorseAudioEngine,
} from "../audio/morseAudio.js";


/* =============================================================================
   Constants
   ============================================================================= */

const DEFAULT_SESSION_LENGTH = 20;

const DEFAULT_WPM = 20;

const DEFAULT_TONE_FREQUENCY = 600;

const DEFAULT_HINT_BEHAVIOR = "manual";

const ADAPTIVE_CHARACTER_COUNT = 4;

const HINT_VISIBLE_MS = 5000;

const FEEDBACK_NEXT_DELAY_MS = 900;


/* =============================================================================
   Internal State
   ============================================================================= */

let mounted = false;

let activeContext = null;

let rootElement = null;

let audioEngine = null;

let currentMaterial = null;

let currentAttempt = null;

let currentAudioPlayback = null;

let currentAudioTimer = null;

let feedbackTimer = null;

let sessionStarted = false;

let answerLocked = false;

let hintVisible = false;


/* =============================================================================
   Utility
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


function getElement(selector) {
  return query(selector);
}


function setText(selector, value) {
  const element = getElement(selector);

  if (element) {
    element.textContent = String(value ?? "");
  }
}


function setHidden(selector, hidden) {
  const element = getElement(selector);

  if (element) {
    element.hidden = Boolean(hidden);
  }
}


function setDisabled(selector, disabled) {
  const element = getElement(selector);

  if (element) {
    element.disabled = Boolean(disabled);
  }
}


function getSettings() {
  return settingsService.getSettings();
}


function getReceiveSettings() {
  return getSettings().receive ?? {};
}


function getLearningSettings() {
  return getSettings().learning ?? {};
}


function normalizeAnswer(value) {
  return typeof value === "string"
    ? value.trim().toUpperCase()
    : "";
}


function formatPercentage(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return "0%";
  }

  return `${Math.round(number)}%`;
}


function formatResponseTime(milliseconds) {
  const number = Number(milliseconds);

  if (!Number.isFinite(number) || number <= 0) {
    return "—";
  }

  if (number < 1000) {
    return `${Math.round(number)} ms`;
  }

  return `${(number / 1000).toFixed(1)} s`;
}


function getTrainingModeLabel(mode) {
  switch (mode) {
    case "sequential":
      return "Sequential Practice";

    case "review-only":
      return "Review Only";

    case "adaptive":
    default:
      return "Adaptive Practice";
  }
}


/* =============================================================================
   Material Selection
   ============================================================================= */

/**
 * Return all curriculum characters currently available to the learner.
 *
 * @returns {Object[]}
 */
function getAvailableCharacters() {
  const profile = state.getActiveProfile();

  if (!profile) {
    return [];
  }

  const characters = getCharacters();

  return getUnlockedCharacters(
    profile.progression,
    characters,
  );
}


/**
 * Return character candidates enriched with learner statistics.
 *
 * @returns {Object[]}
 */
function getCharacterCandidates() {
  return getAvailableCharacters().map(
    (character) => ({
      ...character,

      stat:
        state.getCharacterStats(
          character.symbol,
        ) ?? {
          attempts: 0,
          correct: 0,
          accuracy: 0,
          recentAccuracy: 0,
          averageResponseTime: 0,
          recentResponseTime: 0,
          masteryScore: 0,
          hintsUsed: 0,
        },
    }),
  );
}


/**
 * Resolve a manually requested lesson target.
 *
 * A manually selected target is allowed to influence the current session,
 * but it never changes permanent progression.
 *
 * @returns {Object|null}
 */
function resolveRequestedTarget() {
  const queryParams =
    activeContext?.query;

  const requested =
    queryParams?.get("target");

  if (!requested) {
    return null;
  }

  const profile =
    state.getActiveProfile();

  if (!profile) {
    return null;
  }

  const characters =
    getCharacters();

  return resolvePracticeTarget({
    progression:
      profile.progression,

    curriculum:
      characters,

    character:
      requested,
  });
}


/**
 * Select material for the next attempt.
 *
 * Manual lesson target takes priority for the first attempt. After that,
 * adaptive selection keeps the session moving through the learner's
 * currently available vocabulary.
 *
 * @returns {Object|null}
 */
function selectNextMaterial() {
  const candidates =
    getCharacterCandidates();

  if (candidates.length === 0) {
    return null;
  }

  const requestedTarget =
    resolveRequestedTarget();

  if (
    requestedTarget &&
    requestedTarget.item
  ) {
    const requested =
      candidates.find(
        (candidate) =>
          candidate.symbol ===
          requestedTarget.identifier,
      );

    if (requested) {
      return requested;
    }
  }

  const learning =
    getLearningSettings();

  const pace =
    learning.learningPace ??
    "standard";

  const selection =
    selectAdaptiveCharacters(
      candidates,
      {
        count:
          ADAPTIVE_CHARACTER_COUNT,

        learningPace:
          pace,

        includeNew:
          true,
      },
    );

  if (
    selection.length > 0
  ) {
    return selection[
      Math.floor(
        Math.random() *
          selection.length,
      )
    ];
  }

  const reinforcement =
    selectReinforcementCharacters(
      candidates,
      {
        count:
          ADAPTIVE_CHARACTER_COUNT,

        learningPace:
          pace,
      },
    );

  if (
    reinforcement.length > 0
  ) {
    return reinforcement[
      Math.floor(
        Math.random() *
          reinforcement.length,
      )
    ];
  }

  return candidates[
    Math.floor(
      Math.random() *
        candidates.length,
    )
  ];
}


/* =============================================================================
   Session Setup
   ============================================================================= */

function getSessionMode() {
  const mode =
    getLearningSettings()
      .trainingMode;

  if (
    mode === "sequential"
  ) {
    return "sequential";
  }

  if (
    mode === "review-only"
  ) {
    return "review-only";
  }

  return "adaptive";
}


function getSessionLength() {
  const value =
    Number(
      getLearningSettings()
        .sessionLength,
    );

  return Number.isInteger(value) &&
    value > 0
    ? value
    : DEFAULT_SESSION_LENGTH;
}


function initializeSession() {
  if (sessionStarted) {
    return;
  }

  sessionService.initialize();

  sessionService.bindApplicationEvents();

  sessionService.startSession({
    mode:
      getSessionMode(),

    sessionLength:
      getSessionLength(),

    target:
      resolveRequestedTarget(),
  });

  sessionStarted = true;

  renderSessionState();
}


/* =============================================================================
   Audio
   ============================================================================= */

function createAudioEngine() {
  const receive =
    getReceiveSettings();

  audioEngine =
    createMorseAudioEngine({
      wpm:
        Number(
          receive.wpm,
        ) || DEFAULT_WPM,

      toneFrequency:
        Number(
          receive.toneFrequencyHz,
        ) ||
        DEFAULT_TONE_FREQUENCY,

      volume: 1,
    });
}


function getMorseForMaterial(material) {
  if (
    material &&
    typeof material.morse ===
      "string"
  ) {
    return material.morse;
  }

  const item =
    curriculumService.findCharacter?.(
      material?.symbol,
    );

  return item?.morse ?? "";
}


/**
 * Play the current character.
 *
 * @returns {Promise<Object|null>}
 */
async function playCurrentAudio() {
  if (
    !audioEngine ||
    !currentMaterial
  ) {
    return null;
  }

  clearAudioTimer();

  const morse =
    getMorseForMaterial(
      currentMaterial,
    );

  if (!morse) {
    return null;
  }

  setListeningState(true);

  const receive =
    getReceiveSettings();

  currentAudioPlayback =
    await audioEngine.playText(
      currentMaterial.symbol,
      {
        [currentMaterial.symbol]:
          morse,
      },
      {
        wpm:
          Number(
            receive.wpm,
          ) || DEFAULT_WPM,

        stopPrevious:
          true,
      },
    );

  if (
    currentAudioPlayback
  ) {
    const duration =
      Math.max(
        0,
        Number(
          currentAudioPlayback.duration,
        ) || 0,
      );

    currentAudioTimer =
      window.setTimeout(
        () => {
          setListeningState(false);
          focusAnswerInput();
        },
        duration + 100,
      );
  } else {
    setListeningState(false);
    focusAnswerInput();
  }

  return currentAudioPlayback;
}


function setListeningState(
  listening,
) {
  setHidden(
    "[data-receive-listening]",
    !listening,
  );

  setHidden(
    "[data-receive-answer-area]",
    listening,
  );

  setDisabled(
    "[data-receive-replay]",
    listening,
  );
}


function clearAudioTimer() {
  if (
    currentAudioTimer !== null
  ) {
    window.clearTimeout(
      currentAudioTimer,
    );

    currentAudioTimer = null;
  }
}


function stopAudio() {
  clearAudioTimer();

  if (audioEngine) {
    audioEngine.stop();
  }

  currentAudioPlayback = null;

  setListeningState(false);
}


/* =============================================================================
   Attempt Lifecycle
   ============================================================================= */

async function beginAttempt() {
  if (
    answerLocked ||
    !sessionStarted
  ) {
    return;
  }

  currentMaterial =
    selectNextMaterial();

  if (!currentMaterial) {
    showEmptyState();
    return;
  }

  currentAttempt =
    sessionService.startAttempt({
      expected:
        currentMaterial.symbol,

      item:
        currentMaterial,

      metadata: {
        direction: "receive",
        mode:
          getSessionMode(),
      },
    });

  hintVisible = false;

  renderCurrentMaterial();

  hideFeedback();

  resetAnswerInput();

  setDisabled(
    "[data-receive-submit]",
    true,
  );

  setDisabled(
    "[data-receive-hint]",
    false,
  );

  setDisabled(
    "[data-receive-replay]",
    true,
  );

  await playCurrentAudio();
}


function submitAnswer() {
  if (
    answerLocked ||
    !currentAttempt ||
    !currentMaterial
  ) {
    return;
  }

  const input =
    getElement(
      "[data-receive-answer]",
    );

  if (!input) {
    return;
  }

  const answer =
    normalizeAnswer(
      input.value,
    );

  if (!answer) {
    input.focus();
    return;
  }

  answerLocked = true;

  stopAudio();

  const attempt =
    sessionService.submitAnswer(
      answer,
    );

  applyAttemptToMastery(
    attempt,
  );

  renderFeedback(
    attempt,
  );

  renderSessionState();

  currentAttempt = null;

  setDisabled(
    "[data-receive-submit]",
    true,
  );

  setDisabled(
    "[data-receive-hint]",
    true,
  );

  setDisabled(
    "[data-receive-replay]",
    true,
  );

  const session =
    sessionService.getCurrentSession();

  if (!session) {
    finishSession();
    return;
  }

  feedbackTimer =
    window.setTimeout(
      () => {
        answerLocked = false;
        void beginAttempt();
      },
      FEEDBACK_NEXT_DELAY_MS,
    );
}


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
    currentMaterial.symbol;

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

  storage.queueProfileWrite(
    updatedProfile
      ? state.getActiveProfile()
      : null,
  );
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
        attempt.expected ===
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
   Hint
   ============================================================================= */

function showHint() {
  if (
    answerLocked ||
    !currentAttempt ||
    !currentMaterial
  ) {
    return;
  }

  const behavior =
    getReceiveSettings()
      .hintBehavior ??
    DEFAULT_HINT_BEHAVIOR;

  if (
    behavior === "disabled"
  ) {
    return;
  }

  sessionService.markHintUsed();

  hintVisible = true;

  const hint =
    getElement(
      "[data-receive-hint-content]",
    );

  const morse =
    getMorseForMaterial(
      currentMaterial,
    );

  if (hint) {
    hint.textContent =
      morse;
  }

  const section =
    getElement(
      "[data-receive-hint]",
    );

  if (section) {
    section.classList.add(
      "receive-hint-visible",
    );
  }

  window.setTimeout(
    () => {
      if (!hintVisible) {
        return;
      }

      hintVisible = false;

      if (hint) {
        hint.textContent = "";
      }

      section?.classList.remove(
        "receive-hint-visible",
      );
    },
    HINT_VISIBLE_MS,
  );
}


/* =============================================================================
   Rendering
   ============================================================================= */

function renderCurrentMaterial() {
  setText(
    "[data-receive-attempt-number]",
    getAttemptNumber(),
  );

  setText(
    "[data-receive-material-label]",
    "Listen carefully",
  );

  setText(
    "[data-receive-answer-instruction]",
    "Enter the character you hear.",
  );

  setText(
    "[data-receive-feedback-answer]",
    "",
  );

  setText(
    "[data-receive-feedback-morse]",
    "",
  );

  const input =
    getElement(
      "[data-receive-answer]",
    );

  if (input) {
    input.value = "";
    input.setAttribute(
      "aria-label",
      "Enter the Morse character you heard",
    );
  }
}


function renderSessionState() {
  const session =
    sessionService.getCurrentSession();

  const total =
    getSessionLength();

  const completed =
    session?.total ?? 0;

  const accuracy =
    session &&
    session.total > 0
      ? session.correct /
        session.total *
        100
      : 0;

  const progress =
    total > 0
      ? Math.min(
          100,
          completed /
            total *
            100,
        )
      : 0;

  const progressBar =
    getElement(
      "[data-receive-progress-bar]",
    );

  if (progressBar) {
    progressBar.style.width =
      `${progress}%`;

    progressBar.setAttribute(
      "aria-valuenow",
      String(
        Math.round(progress),
      ),
    );
  }

  setText(
    "[data-receive-progress-label]",
    `${completed} / ${total}`,
  );

  setText(
    "[data-receive-stat-attempts]",
    completed,
  );

  setText(
    "[data-receive-stat-accuracy]",
    completed > 0
      ? formatPercentage(
          accuracy,
        )
      : "—",
  );

  setText(
    "[data-receive-stat-response]",
    formatResponseTime(
      session?.averageResponseTimeMs,
    ),
  );

  const paused =
    sessionService.isPaused();

  setHidden(
    "[data-receive-pause]",
    !session || paused,
  );

  setHidden(
    "[data-receive-resume]",
    !session || !paused,
  );
}


function getAttemptNumber() {
  const session =
    sessionService.getCurrentSession();

  return (
    (session?.total ?? 0) + 1
  );
}


function renderFeedback(attempt) {
  const correct =
    attempt.correct === true;

  const status =
    getElement(
      "[data-receive-feedback-status]",
    );

  if (status) {
    status.textContent =
      correct
        ? "Correct"
        : "Not quite";

    status.classList.toggle(
      "receive-feedback-correct",
      correct,
    );

    status.classList.toggle(
      "receive-feedback-incorrect",
      !correct,
    );
  }

  setText(
    "[data-receive-feedback-detail]",
    correct
      ? `Recognized in ${formatResponseTime(
          attempt.responseTimeMs,
        )}.`
      : "Listen again and keep practicing.",
  );

  setText(
    "[data-receive-feedback-answer]",
    currentMaterial?.symbol ?? "",
  );

  setText(
    "[data-receive-feedback-morse]",
    getMorseForMaterial(
      currentMaterial,
    ),
  );

  setHidden(
    "[data-receive-feedback]",
    false,
  );
}


function hideFeedback() {
  setHidden(
    "[data-receive-feedback]",
    true,
  );
}


function resetAnswerInput() {
  const input =
    getElement(
      "[data-receive-answer]",
    );

  if (input) {
    input.value = "";
  }
}


function focusAnswerInput() {
  const input =
    getElement(
      "[data-receive-answer]",
    );

  if (
    input &&
    !input.disabled
  ) {
    input.focus();
  }

  setDisabled(
    "[data-receive-submit]",
    false,
  );
}


/**
 * Display a safe fallback if no curriculum material is available.
 */
function showEmptyState() {
  stopAudio();

  setHidden(
    "[data-receive-training]",
    true,
  );

  setHidden(
    "[data-receive-empty]",
    false,
  );
}


/**
 * Finish the active session and return to the dashboard.
 */
function finishSession() {
  stopAudio();

  const status =
    sessionService.getStatus();

  if (
    status.active ||
    status.paused
  ) {
    try {
      sessionService.stopSession();
    } catch {
      // The engine may already have completed automatically.
    }
  }

  setHidden(
    "[data-receive-training]",
    true,
  );

  setHidden(
    "[data-receive-complete]",
    false,
  );

  setText(
    "[data-receive-complete-attempts]",
    status.sessionId
      ? getAttemptNumber() - 1
      : 0,
  );
}


/* =============================================================================
   Controls
   ============================================================================= */

function handleSubmit(event) {
  event.preventDefault();
  submitAnswer();
}


function handleAnswerKeydown(event) {
  if (
    event.key === "Enter"
  ) {
    event.preventDefault();
    submitAnswer();
  }
}


function handleReplay() {
  if (
    answerLocked ||
    !currentAttempt
  ) {
    return;
  }

  void playCurrentAudio();
}


function handleHint() {
  showHint();
}


function handlePause() {
  if (
    !sessionStarted
  ) {
    return;
  }

  try {
    stopAudio();

    sessionService.pauseSession();

    setHidden(
      "[data-receive-paused]",
      false,
    );

    renderSessionState();
  } catch (error) {
    console.error(
      "[EduDit] Unable to pause receive training.",
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
      "[data-receive-paused]",
      true,
    );

    renderSessionState();

    void playCurrentAudio();
  } catch (error) {
    console.error(
      "[EduDit] Unable to resume receive training.",
      error,
    );
  }
}


function handleRestart() {
  activeContext?.navigate(
    "receive",
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
  const form =
    getElement(
      "[data-receive-answer-form]",
    );

  form?.addEventListener(
    "submit",
    handleSubmit,
  );

  const input =
    getElement(
      "[data-receive-answer]",
    );

  input?.addEventListener(
    "keydown",
    handleAnswerKeydown,
  );

  getElement(
    "[data-receive-replay]",
  )?.addEventListener(
    "click",
    handleReplay,
  );

  getElement(
    "[data-receive-hint]",
  )?.addEventListener(
    "click",
    handleHint,
  );

  getElement(
    "[data-receive-pause]",
  )?.addEventListener(
    "click",
    handlePause,
  );

  getElement(
    "[data-receive-resume]",
  )?.addEventListener(
    "click",
    handleResume,
  );

  getElement(
    "[data-receive-restart]",
  )?.addEventListener(
    "click",
    handleRestart,
  );
}


/* =============================================================================
   Feature Lifecycle
   ============================================================================= */

async function mount(context) {
  activeContext = context;

  rootElement =
    context?.element ??
    null;

  if (!rootElement) {
    throw new Error(
      "Receive feature requires a mounted view element.",
    );
  }

  mounted = true;

  createAudioEngine();

  bindEvents();

  initializeSession();

  setHidden(
    "[data-receive-training]",
    false,
  );

  setHidden(
    "[data-receive-empty]",
    true,
  );

  setHidden(
    "[data-receive-complete]",
    true,
  );

  setHidden(
    "[data-receive-paused]",
    true,
  );

  hideFeedback();

  renderSessionState();
}


async function start() {
  if (
    !mounted ||
    !sessionStarted
  ) {
    return;
  }

  answerLocked = false;

  await beginAttempt();
}


function stop() {
  stopAudio();

  if (feedbackTimer !== null) {
    window.clearTimeout(
      feedbackTimer,
    );

    feedbackTimer = null;
  }

  if (
    sessionStarted
  ) {
    try {
      sessionService.stopSession();
    } catch {
      // Session may already have completed.
    }
  }

  sessionStarted = false;
}


function destroy() {
  stop();

  if (audioEngine) {
    audioEngine.destroy();
  }

  audioEngine = null;

  currentMaterial = null;

  currentAttempt = null;

  rootElement = null;

  activeContext = null;

  mounted = false;

  answerLocked = false;

  hintVisible = false;
}


const receiveFeature = Object.freeze({
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


export default receiveFeature;