/**
 * =============================================================================
 * EduDit
 * Theme Manager
 * =============================================================================
 *
 * The authoritative theme system for the renderer.
 *
 * Supported themes:
 *
 *   light
 *   dark
 *   system
 *
 * Responsibilities:
 *
 * - Determine the effective theme.
 * - Apply the effective theme to <html>.
 * - Respond to operating-system theme changes.
 * - Provide a single API for changing the application theme.
 * - Keep theme logic out of individual features/components.
 *
 * Important:
 *
 * This module does NOT directly access localStorage or the Electron storage
 * bridge. Persistent settings belong to the application state/persistence
 * layers.
 * =============================================================================
 */

import events, { EVENT_NAMES } from "./events.js";

/* =============================================================================
   Constants
   ============================================================================= */

const THEME_MODES = Object.freeze({
  LIGHT: "light",
  DARK: "dark",
  SYSTEM: "system",
});

const DEFAULT_THEME = THEME_MODES.SYSTEM;

const THEME_ATTRIBUTE = "data-theme";

const THEME_META_SELECTOR =
  'meta[name="theme-color"]';

const LIGHT_THEME_COLOR = "#f5f6f8";

const DARK_THEME_COLOR = "#111318";

/* =============================================================================
   Validation
   ============================================================================= */

/**
 * Determine whether a value is a supported theme mode.
 *
 * @param {*} value
 * @returns {boolean}
 */
function isValidTheme(value) {
  return Object.values(THEME_MODES).includes(
    value,
  );
}

/**
 * Normalize an incoming theme value.
 *
 * Invalid values safely fall back to the system theme.
 *
 * @param {*} value
 * @returns {string}
 */
function normalizeTheme(value) {
  return isValidTheme(value)
    ? value
    : DEFAULT_THEME;
}

/* =============================================================================
   System Theme
   ============================================================================= */

/**
 * Return the browser's dark-mode media query.
 *
 * @returns {MediaQueryList}
 */
function getSystemThemeMediaQuery() {
  return window.matchMedia(
    "(prefers-color-scheme: dark)",
  );
}

/**
 * Determine whether the operating system currently prefers dark mode.
 *
 * @returns {boolean}
 */
function systemPrefersDark() {
  return getSystemThemeMediaQuery().matches;
}

/**
 * Resolve a configured theme into the actual theme being displayed.
 *
 * @param {string} configuredTheme
 * @returns {"light"|"dark"}
 */
function resolveTheme(configuredTheme) {
  const normalized =
    normalizeTheme(configuredTheme);

  if (
    normalized === THEME_MODES.SYSTEM
  ) {
    return systemPrefersDark()
      ? THEME_MODES.DARK
      : THEME_MODES.LIGHT;
  }

  return normalized;
}

/* =============================================================================
   Theme Manager
   ============================================================================= */

class ThemeManager {
  #configuredTheme = DEFAULT_THEME;

  #effectiveTheme = null;

  #initialized = false;

  #mediaQuery = null;

  #boundSystemThemeChange = null;

  /**
   * Initialize the theme manager.
   *
   * @param {string} [configuredTheme]
   * @returns {string}
   */
  initialize(
    configuredTheme = DEFAULT_THEME,
  ) {
    if (this.#initialized) {
      return this.#effectiveTheme;
    }

    this.#configuredTheme =
      normalizeTheme(configuredTheme);

    this.#mediaQuery =
      getSystemThemeMediaQuery();

    this.#boundSystemThemeChange =
      this.#handleSystemThemeChange.bind(
        this,
      );

    /*
     * Modern browsers support addEventListener on MediaQueryList.
     *
     * The fallback is retained for compatibility with Electron versions where
     * older behavior may still be encountered.
     */
    if (
      typeof this.#mediaQuery.addEventListener ===
      "function"
    ) {
      this.#mediaQuery.addEventListener(
        "change",
        this.#boundSystemThemeChange,
      );
    } else if (
      typeof this.#mediaQuery.addListener ===
      "function"
    ) {
      this.#mediaQuery.addListener(
        this.#boundSystemThemeChange,
      );
    }

    this.#effectiveTheme =
      resolveTheme(this.#configuredTheme);

    this.#applyTheme(
      this.#effectiveTheme,
    );

    this.#initialized = true;

    return this.#effectiveTheme;
  }

  /* ===========================================================================
     Theme Selection
     =========================================================================== */

  /**
   * Set the configured application theme.
   *
   * This changes the active theme immediately.
   *
   * Persistence is intentionally handled by the caller/state layer.
   *
   * @param {"light"|"dark"|"system"} theme
   * @returns {"light"|"dark"}
   */
  setTheme(theme) {
    const normalized =
      normalizeTheme(theme);

    const previousConfigured =
      this.#configuredTheme;

    const previousEffective =
      this.#effectiveTheme;

    this.#configuredTheme =
      normalized;

    const effective =
      resolveTheme(normalized);

    this.#effectiveTheme =
      effective;

    this.#applyTheme(effective);

    /*
     * Emit only when something actually changed.
     *
     * This prevents unnecessary UI work when a setting is assigned the same
     * value repeatedly.
     */
    if (
      previousConfigured !== normalized ||
      previousEffective !== effective
    ) {
      events.emit(
        EVENT_NAMES.THEME_CHANGED,
        {
          configuredTheme:
            normalized,

          effectiveTheme:
            effective,

          previousConfiguredTheme:
            previousConfigured,

          previousEffectiveTheme:
            previousEffective,
        },
      );
    }

    return effective;
  }

  /**
   * Return the configured theme.
   *
   * This may be "system".
   *
   * @returns {string}
   */
  getConfiguredTheme() {
    return this.#configuredTheme;
  }

  /**
   * Return the actual theme currently being displayed.
   *
   * This is always "light" or "dark".
   *
   * @returns {"light"|"dark"|null}
   */
  getEffectiveTheme() {
    return this.#effectiveTheme;
  }

  /**
   * Determine whether dark mode is currently active.
   *
   * @returns {boolean}
   */
  isDark() {
    return (
      this.#effectiveTheme ===
      THEME_MODES.DARK
    );
  }

  /**
   * Determine whether light mode is currently active.
   *
   * @returns {boolean}
   */
  isLight() {
    return (
      this.#effectiveTheme ===
      THEME_MODES.LIGHT
    );
  }

  /**
   * Determine whether the application is following the operating system.
   *
   * @returns {boolean}
   */
  isSystem() {
    return (
      this.#configuredTheme ===
      THEME_MODES.SYSTEM
    );
  }

  /* ===========================================================================
     Theme Application
     =========================================================================== */

  /**
   * Apply the effective theme to the document.
   *
   * @param {"light"|"dark"} theme
   */
  #applyTheme(theme) {
    const root =
      document.documentElement;

    root.setAttribute(
      THEME_ATTRIBUTE,
      theme,
    );

    /*
     * This class is useful for CSS that needs to distinguish the effective
     * theme without duplicating the data-theme selector.
     */
    root.classList.toggle(
      "theme-light",
      theme === THEME_MODES.LIGHT,
    );

    root.classList.toggle(
      "theme-dark",
      theme === THEME_MODES.DARK,
    );

    this.#updateThemeColor(theme);
  }

  /**
   * Update the browser/Electron window theme-color metadata.
   *
   * This is intentionally centralized here so individual views never need to
   * know which color the application chrome should use.
   *
   * @param {"light"|"dark"} theme
   */
  #updateThemeColor(theme) {
    const meta =
      document.querySelector(
        THEME_META_SELECTOR,
      );

    if (!meta) {
      return;
    }

    meta.setAttribute(
      "content",
      theme === THEME_MODES.DARK
        ? DARK_THEME_COLOR
        : LIGHT_THEME_COLOR,
    );
  }

  /* ===========================================================================
     System Theme Changes
     =========================================================================== */

  /**
   * React to operating-system theme changes.
   *
   * This only changes the UI when the configured setting is "system".
   *
   * @param {MediaQueryListEvent} event
   */
  #handleSystemThemeChange(event) {
    if (!this.isSystem()) {
      return;
    }

    const previousTheme =
      this.#effectiveTheme;

    const nextTheme = event.matches
      ? THEME_MODES.DARK
      : THEME_MODES.LIGHT;

    if (previousTheme === nextTheme) {
      return;
    }

    this.#effectiveTheme =
      nextTheme;

    this.#applyTheme(nextTheme);

    events.emit(
      EVENT_NAMES.THEME_CHANGED,
      {
        configuredTheme:
          THEME_MODES.SYSTEM,

        effectiveTheme:
          nextTheme,

        previousConfiguredTheme:
          THEME_MODES.SYSTEM,

        previousEffectiveTheme:
          previousTheme,

        source:
          "system",
      },
    );
  }

  /* ===========================================================================
     Cleanup
     =========================================================================== */

  /**
   * Destroy the theme manager.
   *
   * Normally only needed during application shutdown/testing.
   */
  destroy() {
    if (
      !this.#mediaQuery ||
      !this.#boundSystemThemeChange
    ) {
      return;
    }

    if (
      typeof this.#mediaQuery.removeEventListener ===
      "function"
    ) {
      this.#mediaQuery.removeEventListener(
        "change",
        this.#boundSystemThemeChange,
      );
    } else if (
      typeof this.#mediaQuery.removeListener ===
      "function"
    ) {
      this.#mediaQuery.removeListener(
        this.#boundSystemThemeChange,
      );
    }

    this.#mediaQuery = null;
    this.#boundSystemThemeChange = null;
    this.#initialized = false;
  }
}

/* =============================================================================
   Singleton
   ============================================================================= */

const theme = new ThemeManager();

/* =============================================================================
   Exports
   ============================================================================= */

export {
  ThemeManager,
  THEME_MODES,
  DEFAULT_THEME,
  THEME_ATTRIBUTE,
  isValidTheme,
  normalizeTheme,
  resolveTheme,
};

export default theme;