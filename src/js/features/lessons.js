/**
 * =============================================================================
 * EduDit
 * Lessons Feature
 * =============================================================================
 *
 * Owns the Lessons screen.
 *
 * Responsibilities:
 *
 *   - Render curriculum material.
 *   - Show learner progression through the curriculum.
 *   - Allow the learner to select practice material.
 *   - Navigate into the appropriate training experience.
 *
 * This module does NOT:
 *
 *   - Define curriculum data.
 *   - Calculate mastery.
 *   - Modify progression directly.
 *   - Persist learner data.
 *   - Implement Morse audio.
 *
 * Those responsibilities belong to the curriculum, training, state, storage,
 * and audio layers respectively.
 * =============================================================================
 */

import curriculumService from "../services/curriculumService.js";
import state from "../core/state.js";
import router from "../core/router.js";
import events, {
  EVENT_NAMES,
} from "../core/events.js";


/* =============================================================================
   Constants
   ============================================================================= */

const FEATURE_ID = "lessons";

const SELECTORS = Object.freeze({
  root: '[data-feature="lessons"]',

  summaryTitle:
    "[data-lessons-summary-title]",

  summaryDescription:
    "[data-lessons-summary-description]",

  summaryProgressBar:
    "[data-lessons-summary-progress-bar]",

  summaryProgressLabel:
    "[data-lessons-summary-progress-label]",

  materialTabs:
    "[data-material-tabs]",

  materialTab:
    "[data-material-tab]",

  materialPanel:
    "[data-material-panel]",

  characterLessons:
    "[data-character-lessons]",

  characterLessonsEmpty:
    "[data-character-lessons-empty]",
});





const DEFAULT_SUMMARY = Object.freeze({
  title: "Getting started",
  description:
    "Build recognition one character at a time. Previously unlocked material remains available for review.",
});


/* =============================================================================
   Utilities
   ============================================================================= */

/**
 * Return a safe document root.
 *
 * @returns {Document|null}
 */
function getDocument() {
  if (
    typeof document === "undefined"
  ) {
    return null;
  }

  return document;
}


/**
 * Find the Lessons root.
 *
 * @param {ParentNode} root
 * @returns {HTMLElement|null}
 */
function findRoot(root = getDocument()) {
  if (!root) {
    return null;
  }

  return root.querySelector(
    SELECTORS.root,
  );
}


/**
 * Normalize a curriculum item identifier.
 *
 * @param {*} item
 * @returns {string}
 */
function getIdentifier(item) {
  if (
    item === null ||
    item === undefined
  ) {
    return "";
  }

  if (typeof item === "string") {
    return item;
  }

  return String(
    item.symbol ??
      item.character ??
      item.id ??
      item.letter ??
      "",
  );
}


/**
 * Get the display label for a curriculum item.
 *
 * @param {*} item
 * @returns {string}
 */
function getDisplayLabel(item) {
  const identifier =
    getIdentifier(item);

  if (identifier) {
    return identifier;
  }

  return "Unknown";
}


/**
 * Get the Morse representation for a curriculum item.
 *
 * @param {*} item
 * @returns {string}
 */
function getMorse(item) {
  if (
    !item ||
    typeof item !== "object"
  ) {
    return "";
  }

  return String(
    item.morse ??
      item.code ??
      item.sequence ??
      "",
  );
}


/**
 * Get an item's description.
 *
 * @param {*} item
 * @returns {string}
 */
function getDescription(item) {
  if (
    !item ||
    typeof item !== "object"
  ) {
    return "";
  }

  return String(
    item.description ??
      item.name ??
      item.label ??
      "",
  );
}


/**
 * Escape text before inserting it into HTML.
 *
 * @param {*} value
 * @returns {string}
 */
function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}


/**
 * Convert a value to a finite number.
 *
 * @param {*} value
 * @param {number} fallback
 * @returns {number}
 */
function toNumber(
  value,
  fallback = 0,
) {
  const number = Number(value);

  return Number.isFinite(number)
    ? number
    : fallback;
}


/**
 * Clamp a number.
 *
 * @param {number} value
 * @param {number} minimum
 * @param {number} maximum
 * @returns {number}
 */
function clamp(
  value,
  minimum,
  maximum,
) {
  return Math.min(
    maximum,
    Math.max(minimum, value),
  );
}


/* =============================================================================
   State
   ============================================================================= */

/**
 * Get the current application state safely.
 *
 * @returns {Object}
 */
function getStateSnapshot() {
  if (
    state &&
    typeof state.getState === "function"
  ) {
    return state.getState();
  }

  return {};
}


/**
 * Get the active learner profile.
 *
 * @returns {Object|null}
 */
function getActiveProfile() {
  const snapshot =
    getStateSnapshot();

  const activeProfileId =
    snapshot.activeProfileId;

  if (
    !activeProfileId ||
    !snapshot.profiles
  ) {
    return null;
  }

  return (
    snapshot.profiles[
      activeProfileId
    ] ?? null
  );
}


/**
 * Get progression from the active profile.
 *
 * @returns {Object}
 */
function getProgression() {
  const profile =
    getActiveProfile();

  if (!profile) {
    return {};
  }

  return profile.progression ?? {};
}


/**
 * Get the highest unlocked character.
 *
 * Supports the progression representations currently used by EduDit.
 *
 * @returns {number}
 */
function getHighestUnlockedIndex() {
  const progression =
    getProgression();

  const directIndex =
    progression.highestUnlockedIndex;

  if (
    Number.isFinite(
      Number(directIndex),
    )
  ) {
    return Math.max(
      0,
      Number(directIndex),
    );
  }

  const character =
    progression.highestUnlockedCharacter;

  if (character) {
    const index =
      curriculumService.findCharacterIndex(
        character,
      );

    if (index >= 0) {
      return index;
    }
  }

  return 0;
}


/**
 * Determine whether an item is unlocked.
 *
 * @param {Object|string} item
 * @param {number} index
 * @returns {boolean}
 */
function isCharacterUnlocked(
  item,
  index,
) {
  const progression =
    getProgression();

  if (
    Array.isArray(
      progression.unlockedCharacters,
    )
  ) {
    const identifier =
      getIdentifier(item)
        .trim()
        .toUpperCase();

    return progression.unlockedCharacters
      .map((value) =>
        String(value)
          .trim()
          .toUpperCase(),
      )
      .includes(identifier);
  }

  return (
    index <=
    getHighestUnlockedIndex()
  );
}


/**
 * Determine whether a character has been introduced.
 *
 * @param {Object|string} item
 * @returns {boolean}
 */
function isCharacterIntroduced(item) {
  const identifier =
    getIdentifier(item);

  if (!identifier) {
    return false;
  }

  const progression =
    getProgression();

  if (
    Array.isArray(
      progression.introducedCharacters,
    )
  ) {
    return progression.introducedCharacters
      .map((value) =>
        String(value)
          .trim()
          .toUpperCase(),
      )
      .includes(
        identifier
          .trim()
          .toUpperCase(),
      );
  }

  return isCharacterUnlocked(
    item,
    curriculumService.findCharacterIndex(
      identifier,
    ),
  );
}


/**
 * Get character mastery data.
 *
 * @param {string} identifier
 * @returns {Object|null}
 */
function getCharacterStats(
  identifier,
) {
  const profile =
    getActiveProfile();

  if (!profile) {
    return null;
  }

  const stats =
    profile.characterStats;

  if (!stats || typeof stats !== "object") {
    return null;
  }

  const normalized =
    String(identifier)
      .trim()
      .toUpperCase();

  return (
    stats[normalized] ??
    stats[identifier] ??
    null
  );
}


/**
 * Get a useful mastery percentage.
 *
 * @param {Object|string|null} stats
 * @returns {number}
 */
function getMasteryPercent(stats) {
  if (!stats || typeof stats !== "object") {
    return 0;
  }

  const mastery =
    stats.mastery ??
    stats.masteryScore ??
    stats.score ??
    0;

  return clamp(
    toNumber(mastery),
    0,
    100,
  );
}


/* =============================================================================
   Summary
   ============================================================================= */

/**
 * Build the summary state for the page.
 *
 * @returns {Object}
 */
function buildSummary() {
  const characters =
    curriculumService.getCharacters();

  const total =
    characters.length;

  const highestIndex =
    getHighestUnlockedIndex();

  const unlockedCount =
    total === 0
      ? 0
      : clamp(
          highestIndex + 1,
          0,
          total,
        );

  if (total === 0) {
    return {
      title: DEFAULT_SUMMARY.title,
      description:
        DEFAULT_SUMMARY.description,
      total: 0,
      unlockedCount: 0,
      percentage: 0,
    };
  }

  const currentItem =
    characters[
      clamp(
        highestIndex,
        0,
        total - 1,
      )
    ];

  const currentLabel =
    getDisplayLabel(currentItem);

  return {
    title:
      unlockedCount >= total
        ? "Curriculum unlocked"
        : `You're working through ${currentLabel}`,

    description:
      unlockedCount >= total
        ? "All available character material is unlocked. Keep practicing to strengthen recognition."
        : "Build recognition one character at a time. Previously unlocked material remains available for review.",

    total,
    unlockedCount,

    percentage:
      total === 0
        ? 0
        : Math.round(
            (unlockedCount / total) *
              100,
          ),
  };
}


/**
 * Render the curriculum summary.
 *
 * @param {HTMLElement} root
 */
function renderSummary(root) {
  const summary =
    buildSummary();

  const title =
    root.querySelector(
      SELECTORS.summaryTitle,
    );

  const description =
    root.querySelector(
      SELECTORS.summaryDescription,
    );

  const progressBar =
    root.querySelector(
      SELECTORS.summaryProgressBar,
    );

  const progressLabel =
    root.querySelector(
      SELECTORS.summaryProgressLabel,
    );

  if (title) {
    title.textContent =
      summary.title;
  }

  if (description) {
    description.textContent =
      summary.description;
  }

  if (progressBar) {
    progressBar.style.width =
      `${summary.percentage}%`;

    progressBar.setAttribute(
      "aria-valuenow",
      String(summary.percentage),
    );
  }

  if (progressLabel) {
    progressLabel.textContent =
      `${summary.unlockedCount} of ${summary.total} characters`;
  }
}


/* =============================================================================
   Character Cards
   ============================================================================= */

/**
 * Create a character lesson card.
 *
 * @param {Object|string} item
 * @param {number} index
 * @returns {string}
 */
function renderCharacterCard(
  item,
  index,
) {
  const identifier =
    getDisplayLabel(item);

  const morse =
    getMorse(item);

  const description =
    getDescription(item);

  const unlocked =
    isCharacterUnlocked(
      item,
      index,
    );

  const introduced =
    isCharacterIntroduced(item);

  const stats =
    getCharacterStats(identifier);

  const mastery =
    getMasteryPercent(stats);

  const stateClass =
    unlocked
      ? "lesson-card-unlocked"
      : "lesson-card-locked";

  const statusLabel =
    unlocked
      ? introduced
        ? "Practice"
        : "Available"
      : "Locked";

  const detail =
    description ||
    (unlocked
      ? "Practice this character in Receive."
      : "Continue your progression to unlock this character.");

  return `
    <article
      class="lesson-card ${stateClass}"
      data-lesson-card
      data-character="${escapeHtml(identifier)}"
      data-unlocked="${String(unlocked)}"
    >
      <div class="lesson-card-header">
        <span class="lesson-card-index">
          ${String(index + 1).padStart(2, "0")}
        </span>

        <span class="lesson-card-status">
          ${escapeHtml(statusLabel)}
        </span>
      </div>

      <div class="lesson-card-character">
        ${escapeHtml(identifier)}
      </div>

      ${
        morse
          ? `
            <div class="lesson-card-morse">
              ${escapeHtml(morse)}
            </div>
          `
          : ""
      }

      <p class="lesson-card-description">
        ${escapeHtml(detail)}
      </p>

      ${
        unlocked
          ? `
            <div class="lesson-card-progress">
              <div class="progress">
                <div
                  class="progress-bar"
                  style="width: ${mastery}%"
                ></div>
              </div>

              <span class="lesson-card-progress-label">
                ${mastery}% mastery
              </span>
            </div>

            <button
              type="button"
              class="button button-primary lesson-card-action"
              data-lesson-action="practice"
              data-character="${escapeHtml(identifier)}"
            >
              Practice
            </button>
          `
          : `
            <button
              type="button"
              class="button button-secondary lesson-card-action"
              disabled
            >
              Locked
            </button>
          `
      }
    </article>
  `;
}


/**
 * Render character lessons.
 *
 * @param {HTMLElement} root
 */
function renderCharacterLessons(root) {
  const container =
    root.querySelector(
      SELECTORS.characterLessons,
    );

  const empty =
    root.querySelector(
      SELECTORS.characterLessonsEmpty,
    );

  if (!container) {
    return;
  }

  const characters =
    curriculumService.getCharacters();

  if (
    !Array.isArray(characters) ||
    characters.length === 0
  ) {
    container.innerHTML = "";

    if (empty) {
      empty.hidden = false;
    }

    return;
  }

  if (empty) {
    empty.hidden = true;
  }

  container.innerHTML =
    characters
      .map(
        (item, index) =>
          renderCharacterCard(
            item,
            index,
          ),
      )
      .join("");
}


/* =============================================================================
   Material Tabs
   ============================================================================= */

/**
 * Activate a material tab.
 *
 * @param {HTMLElement} root
 * @param {string} material
 */
function activateMaterial(
  root,
  material,
) {
  const tabs =
    root.querySelectorAll(
      SELECTORS.materialTab,
    );

  const panels =
    root.querySelectorAll(
      SELECTORS.materialPanel,
    );

  tabs.forEach((tab) => {
    const active =
      tab.dataset.materialTab ===
      material;

    tab.classList.toggle(
      "material-tab-active",
      active,
    );

    tab.setAttribute(
      "aria-selected",
      String(active),
    );
  });

  panels.forEach((panel) => {
    const active =
      panel.dataset.materialPanel ===
      material;

    panel.hidden = !active;
  });
}


/* =============================================================================
   Navigation
   ============================================================================= */

/**
 * Navigate into Receive training for a character.
 *
 * The actual training session remains owned by the Receive feature.
 *
 * @param {string} character
 */
function practiceCharacter(
  character,
) {
  const normalized =
    String(character ?? "")
      .trim()
      .toUpperCase();

  if (!normalized) {
    return;
  }

  const material =
    curriculumService.getMaterial(
      normalized,
    );

  if (!material) {
    return;
  }

  if (
    typeof router.navigate ===
    "function"
  ) {
    router.navigate(
      "receive",
      {
        character: normalized,
        source: FEATURE_ID,
      },
    );

    return;
  }

  if (
    typeof window !== "undefined"
  ) {
    window.location.hash =
      `#/receive?character=${encodeURIComponent(
        normalized,
      )}&source=${FEATURE_ID}`;
  }
}


/* =============================================================================
   Event Handling
   ============================================================================= */

/**
 * Handle click events from the Lessons view.
 *
 * @param {MouseEvent} event
 */
function handleClick(event) {
  const target =
    event.target;

  if (
    !target ||
    typeof target.closest !==
      "function"
  ) {
    return;
  }

  const practiceButton =
    target.closest(
      '[data-lesson-action="practice"]',
    );

  if (practiceButton) {
    practiceCharacter(
      practiceButton.dataset.character,
    );

    return;
  }

  const tab =
    target.closest(
      SELECTORS.materialTab,
    );

  if (tab) {
    activateMaterial(
      findRoot(),
      tab.dataset.materialTab,
    );
  }
}


/**
 * Subscribe to application events that can affect the page.
 *
 * @returns {Function|null}
 */
function subscribeToState() {
  const unsubscribeFunctions =
    [];

  if (
    events &&
    typeof events.on === "function"
  ) {
    const stateUnsubscribe =
      events.on(
        EVENT_NAMES.STATE_CHANGED,
        () => {
          const root =
            findRoot();

          if (root) {
            render(root);
          }
        },
      );

    if (
      typeof stateUnsubscribe ===
      "function"
    ) {
      unsubscribeFunctions.push(
        stateUnsubscribe,
      );
    }

    const profileUnsubscribe =
      events.on(
        EVENT_NAMES.PROFILE_CHANGED,
        () => {
          const root =
            findRoot();

          if (root) {
            render(root);
          }
        },
      );

    if (
      typeof profileUnsubscribe ===
      "function"
    ) {
      unsubscribeFunctions.push(
        profileUnsubscribe,
      );
    }
  }

  if (
    unsubscribeFunctions.length ===
    0
  ) {
    return null;
  }

  return () => {
    unsubscribeFunctions.forEach(
      (unsubscribe) => {
        try {
          unsubscribe();
        } catch {
          // Event cleanup should never
          // break the application lifecycle.
        }
      },
    );
  };
}


/* =============================================================================
   Rendering
   ============================================================================= */

/**
 * Render the complete Lessons feature.
 *
 * @param {HTMLElement} root
 */
function render(root) {
  if (!root) {
    return;
  }

  renderSummary(root);
  renderCharacterLessons(root);
}


/* =============================================================================
   Lifecycle
   ============================================================================= */

let initialized = false;
let cleanupStateSubscriptions =
  null;


/**
 * Initialize the Lessons feature.
 *
 * @param {Object} options
 * @returns {Object}
 */
function init(options = {}) {
  if (initialized) {
    const root =
      findRoot(
        options.root ??
          getDocument(),
      );

    if (root) {
      render(root);
    }

    return {
      id: FEATURE_ID,
      initialized: true,
      destroy,
    };
  }

  const root =
    findRoot(
      options.root ??
        getDocument(),
    );

  if (!root) {
    return {
      id: FEATURE_ID,
      initialized: false,
      destroy,
    };
  }

  root.addEventListener(
    "click",
    handleClick,
  );

  cleanupStateSubscriptions =
    subscribeToState();

  render(root);

  initialized = true;

  return {
    id: FEATURE_ID,
    initialized: true,
    destroy,
  };
}


/**
 * Destroy the Lessons feature.
 */
function destroy() {
  const root =
    findRoot();

  if (root) {
    root.removeEventListener(
      "click",
      handleClick,
    );
  }

  if (
    typeof cleanupStateSubscriptions ===
    "function"
  ) {
    cleanupStateSubscriptions();
  }

  cleanupStateSubscriptions =
    null;

  initialized = false;
}


/* =============================================================================
   Public API
   ============================================================================= */

const lessonsFeature =
  Object.freeze({
    id: FEATURE_ID,
    init,
    destroy,
    render,
    practiceCharacter,
  });


export {
  init,
  destroy,
  render,
  practiceCharacter,
};


export default lessonsFeature;