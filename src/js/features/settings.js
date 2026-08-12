/**
 * =============================================================================
 * EduDit
 * Settings Feature
 * =============================================================================
 *
 * Responsibilities:
 *
 * - Bind the Settings view controls.
 * - Read the active learner's settings.
 * - Write setting changes through SettingsService.
 * - Keep controls synchronized with persisted settings.
 * - Apply theme changes through the settings system.
 * - Provide navigation to profile management.
 * - Cleanly remove all listeners when the route is left.
 *
 * This module does NOT:
 *
 * - Persist data directly.
 * - Modify localStorage or window.edudit.storage.
 * - Define the settings schema.
 * - Implement theme logic.
 *
 * SettingsService, State, Storage, and Theme remain authoritative elsewhere.
 * =============================================================================
 */

import settingsService from "../services/settingsService.js";

import profileService from "../services/profileService.js";


/* =============================================================================
   Constants
   ============================================================================= */

const DEFAULT_SECTION = "learning";

const SETTINGS_SECTIONS = Object.freeze([
  "learning",
  "receive",
  "audio",
  "appearance",
  "profile",
]);


/* =============================================================================
   Internal State
   ============================================================================= */

let mounted = false;

let rootElement = null;

let cleanupFunctions = [];

let activeSection = DEFAULT_SECTION;


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


function addListener(
  element,
  eventName,
  handler,
) {
  if (!element) {
    return;
  }

  element.addEventListener(
    eventName,
    handler,
  );

  cleanupFunctions.push(
    () => {
      element.removeEventListener(
        eventName,
        handler,
      );
    },
  );
}


function setText(
  selector,
  value,
) {
  const element = query(selector);

  if (element) {
    element.textContent =
      String(value ?? "");
  }
}


/* =============================================================================
   Settings Path Helpers
   ============================================================================= */

/**
 * Resolve a dotted settings path.
 *
 * Example:
 *
 *   learning.sessionLength
 *
 * becomes:
 *
 *   {
 *     group: "learning",
 *     key: "sessionLength"
 *   }
 */
function parseSettingPath(path) {
  const parts =
    String(path ?? "")
      .split(".")
      .map((part) => part.trim())
      .filter(Boolean);

  if (parts.length !== 2) {
    return null;
  }

  return {
    group: parts[0],
    key: parts[1],
  };
}


/**
 * Read a nested setting value.
 */
function getSettingValue(
  settings,
  path,
) {
  const parsed =
    parseSettingPath(path);

  if (!parsed) {
    return undefined;
  }

  return settings?.[
    parsed.group
  ]?.[
    parsed.key
  ];
}


/* =============================================================================
   Settings Reading / Writing
   ============================================================================= */

function getSettings() {
  return settingsService.getSettings();
}


function updateSetting(
  path,
  value,
) {
  const parsed =
    parseSettingPath(path);

  if (!parsed) {
    console.warn(
      `[EduDit] Ignoring invalid setting path "${path}".`,
    );

    return;
  }

  try {
    settingsService.updateGroup(
      parsed.group,
      {
        [parsed.key]: value,
      },
    );

    syncControls();
  } catch (error) {
    console.error(
      `[EduDit] Failed to update setting "${path}".`,
      error,
    );
  }
}


/* =============================================================================
   Value Normalization
   ============================================================================= */

function normalizeInputValue(
  input,
) {
  if (!input) {
    return undefined;
  }

  if (
    input.type ===
    "checkbox"
  ) {
    return input.checked;
  }

  if (
    input.type ===
    "number"
  ) {
    const number =
      Number(input.value);

    return Number.isFinite(number)
      ? number
      : undefined;
  }

  if (
    input.type ===
    "range"
  ) {
    const number =
      Number(input.value);

    return Number.isFinite(number)
      ? number
      : undefined;
  }

  return input.value;
}


/* =============================================================================
   Section Navigation
   ============================================================================= */

function isValidSection(
  section,
) {
  return SETTINGS_SECTIONS.includes(
    section,
  );
}


function setActiveSection(
  section,
) {
  const normalized =
    isValidSection(section)
      ? section
      : DEFAULT_SECTION;

  activeSection =
    normalized;

  queryAll(
    "[data-settings-section]",
  ).forEach(
    (button) => {
      const isActive =
        button.dataset
          .settingsSection ===
        normalized;

      button.classList.toggle(
        "settings-nav-button-active",
        isActive,
      );

      if (isActive) {
        button.setAttribute(
          "aria-current",
          "true",
        );
      } else {
        button.removeAttribute(
          "aria-current",
        );
      }
    },
  );

  queryAll(
    "[data-settings-panel]",
  ).forEach(
    (panel) => {
      const isActive =
        panel.dataset
          .settingsPanel ===
        normalized;

      panel.hidden =
        !isActive;

      panel.classList.toggle(
        "settings-section-active",
        isActive,
      );
    },
  );
}


/* =============================================================================
   Option Controls
   ============================================================================= */

function syncOptionControls(
  settings,
) {
  queryAll(
    "[data-setting-path]",
  ).forEach(
    (button) => {
      const path =
        button.dataset
          .settingPath;

      const value =
        button.dataset
          .settingValue;

      const current =
        getSettingValue(
          settings,
          path,
        );

      const isActive =
        String(current) ===
        String(value);

      button.classList.toggle(
        "setting-option-active",
        isActive,
      );

      button.setAttribute(
        "aria-pressed",
        String(isActive),
      );
    },
  );
}


function syncToggleControls(
  settings,
) {
  queryAll(
    "[data-setting-toggle]",
  ).forEach(
    (toggle) => {
      const path =
        toggle.dataset
          .settingToggle;

      const value =
        Boolean(
          getSettingValue(
            settings,
            path,
          ),
        );

      toggle.classList.toggle(
        "toggle-active",
        value,
      );

      toggle.setAttribute(
        "aria-checked",
        String(value),
      );
    },
  );
}


function syncInputControls(
  settings,
) {
  queryAll(
    "[data-setting-input]",
  ).forEach(
    (input) => {
      const path =
        input.dataset
          .settingInput;

      const value =
        getSettingValue(
          settings,
          path,
        );

      if (
        value === undefined ||
        value === null
      ) {
        return;
      }

      input.value =
        String(value);
    },
  );
}


function syncRangeLabels(
  settings,
) {
  queryAll(
    "[data-setting-range-value]",
  ).forEach(
    (label) => {
      const path =
        label.dataset
          .settingRangeValue;

      const value =
        getSettingValue(
          settings,
          path,
        );

      if (value === undefined) {
        return;
      }

      const normalizedPath =
        String(path);

      if (
        normalizedPath ===
        "receive.wpm"
      ) {
        label.textContent =
          `${value} WPM`;

        return;
      }

      if (
        normalizedPath ===
        "receive.toneFrequencyHz"
      ) {
        label.textContent =
          `${value} Hz`;

        return;
      }

      if (
        normalizedPath ===
        "audio.backgroundVolume"
      ) {
        label.textContent =
          `${Math.round(
            Number(value) * 100,
          )}%`;

        return;
      }

      label.textContent =
        String(value);
    },
  );
}


function syncProfileDisplay() {
  const profile =
    profileService.getActiveProfile();

  if (!profile) {
    return;
  }

  const name =
    String(
      profile.name ?? "",
    ).trim();

  setText(
    "[data-settings-profile-name]",
    name,
  );

  setText(
    "[data-profile-name]",
    name,
  );
}


/**
 * Synchronize every Settings control from the authoritative settings state.
 */
function syncControls() {
  if (!rootElement) {
    return;
  }

  let settings;

  try {
    settings =
      getSettings();
  } catch (error) {
    console.error(
      "[EduDit] Unable to read settings.",
      error,
    );

    return;
  }

  syncOptionControls(
    settings,
  );

  syncToggleControls(
    settings,
  );

  syncInputControls(
    settings,
  );

  syncRangeLabels(
    settings,
  );

  syncProfileDisplay();
}


/* =============================================================================
   Event Handlers
   ============================================================================= */

function handleSectionClick(
  event,
) {
  const button =
    event.target.closest(
      "[data-settings-section]",
    );

  if (
    !button ||
    !rootElement?.contains(button)
  ) {
    return;
  }

  event.preventDefault();

  setActiveSection(
    button.dataset
      .settingsSection,
  );
}


function handleOptionClick(
  event,
) {
  const button =
    event.target.closest(
      "[data-setting-path][data-setting-value]",
    );

  if (
    !button ||
    !rootElement?.contains(button)
  ) {
    return;
  }

  event.preventDefault();

  updateSetting(
    button.dataset
      .settingPath,
    button.dataset
      .settingValue,
  );
}


function handleToggleClick(
  event,
) {
  const toggle =
    event.target.closest(
      "[data-setting-toggle]",
    );

  if (
    !toggle ||
    !rootElement?.contains(toggle)
  ) {
    return;
  }

  event.preventDefault();

  const settings =
    getSettings();

  const path =
    toggle.dataset
      .settingToggle;

  const current =
    Boolean(
      getSettingValue(
        settings,
        path,
      ),
    );

  updateSetting(
    path,
    !current,
  );
}


function handleInputChange(
  event,
) {
  const input =
    event.target.closest(
      "[data-setting-input]",
    );

  if (
    !input ||
    !rootElement?.contains(input)
  ) {
    return;
  }

  const value =
    normalizeInputValue(
      input,
    );

  if (value === undefined) {
    syncControls();
    return;
  }

  updateSetting(
    input.dataset
      .settingInput,
    value,
  );
}


function handleInputImmediateUpdate(
  event,
) {
  const input =
    event.target.closest(
      "[data-setting-input]",
    );

  if (
    !input ||
    input.type !== "range" ||
    !rootElement?.contains(input)
  ) {
    return;
  }

  const value =
    normalizeInputValue(
      input,
    );

  if (value === undefined) {
    return;
  }

  updateSetting(
    input.dataset
      .settingInput,
    value,
  );
}


function handleReset(
  event,
) {
  const button =
    event.target.closest(
      "[data-settings-reset]",
    );

  if (
    !button ||
    !rootElement?.contains(button)
  ) {
    return;
  }

  event.preventDefault();

  try {
    settingsService.resetSettings();

    syncControls();
  } catch (error) {
    console.error(
      "[EduDit] Failed to reset settings.",
      error,
    );
  }
}


function handleProfileAction(
  event,
  context,
) {
  const button =
    event.target.closest(
      "[data-profile-action]",
    );

  if (
    !button ||
    !rootElement?.contains(button)
  ) {
    return;
  }

  event.preventDefault();

  const action =
    button.dataset
      .profileAction;

  if (
    action === "switch" ||
    action === "manage"
  ) {
    void context.navigate(
      "profiles",
    );

    return;
  }

  if (
    action === "rename"
  ) {
    void context.navigate(
      "profiles",
      {
        action: "rename",
      },
    );
  }
}


/* =============================================================================
   Mount / Cleanup
   ============================================================================= */

async function mount(
  context = {},
) {
  if (mounted) {
    return;
  }

  rootElement =
    context.element ??
    context.container ??
    null;

  if (!rootElement) {
    throw new Error(
      "Settings feature requires a root element.",
    );
  }

  mounted = true;

  addListener(
    rootElement,
    "click",
    handleSectionClick,
  );

  addListener(
    rootElement,
    "click",
    handleOptionClick,
  );

  addListener(
    rootElement,
    "click",
    handleToggleClick,
  );

  addListener(
    rootElement,
    "change",
    handleInputChange,
  );

  addListener(
    rootElement,
    "input",
    handleInputImmediateUpdate,
  );

  addListener(
    rootElement,
    "click",
    handleReset,
  );

  addListener(
    rootElement,
    "click",
    (event) =>
      handleProfileAction(
        event,
        context,
      ),
  );

  syncControls();

  setActiveSection(
    activeSection,
  );

  return unmount;
}


function unmount() {
  cleanupFunctions.forEach(
    (cleanup) => {
      try {
        cleanup();
      } catch (error) {
        console.error(
          "[EduDit] Settings cleanup failed.",
          error,
        );
      }
    },
  );

  cleanupFunctions = [];

  rootElement = null;

  mounted = false;
}


/* =============================================================================
   Compatibility Lifecycle
   ============================================================================= */

function init(context) {
  return mount(context);
}


function destroy() {
  unmount();
}


/* =============================================================================
   Exports
   ============================================================================= */

const settingsFeature =
  Object.freeze({
    mount,
    init,
    destroy,
    unmount,
  });


export {
  mount,
  init,
  destroy,
  unmount,
};


export default settingsFeature;