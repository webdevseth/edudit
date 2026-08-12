/**
 * =============================================================================
 * EduDit
 * Application Router
 * =============================================================================
 *
 * The router is responsible for:
 *
 * - Navigating between application views.
 * - Updating the active navigation state.
 * - Loading view HTML.
 * - Initializing and destroying feature modules.
 * - Preventing stale listeners/timers from surviving navigation.
 * - Managing browser history.
 *
 * The router does NOT:
 *
 * - Contain learning logic.
 * - Manage persistence.
 * - Own application state.
 * - Directly manipulate training algorithms.
 *
 * Views are treated as short-lived application modules:
 *
 *   mount()
 *   initialize()
 *   start()
 *   ...
 *   destroy()
 *
 * A feature may implement only the lifecycle methods it needs.
 * =============================================================================
 */

import events, { EVENT_NAMES } from "./events.js";

/* =============================================================================
   Configuration
   ============================================================================= */

/**
 * All valid application routes.
 *
 * Keeping the route registry centralized prevents arbitrary HTML paths from
 * being passed into the router.
 */
const ROUTES = Object.freeze({
  dashboard: {
    id: "dashboard",
    label: "Dashboard",
    path: "dashboard.html",
    feature: "dashboard",
    navSelector: '[data-route="dashboard"]',
  },

  lessons: {
    id: "lessons",
    label: "Lessons",
    path: "lessons.html",
    feature: "lessons",
    navSelector: '[data-route="lessons"]',
  },

  receive: {
    id: "receive",
    label: "Receive",
    path: "receive.html",
    feature: "receive",
    navSelector: '[data-route="receive"]',
  },

  send: {
    id: "send",
    label: "Send",
    path: "send.html",
    feature: "send",
    navSelector: '[data-route="send"]',
  },

  progress: {
    id: "progress",
    label: "Progress",
    path: "progress.html",
    feature: "progress",
    navSelector: '[data-route="progress"]',
  },

  settings: {
    id: "settings",
    label: "Settings",
    path: "settings.html",
    feature: "settings",
    navSelector: '[data-route="settings"]',
  },

  profiles: {
    id: "profiles",
    label: "Profiles",
    path: "profiles.html",
    feature: "profiles",
    navSelector: '[data-route="profiles"]',
  },
});

const DEFAULT_ROUTE = "dashboard";

const VIEW_CONTAINER_SELECTOR = "#view-container";

const LOADING_HTML = `
  <div class="view-loading" role="status" aria-live="polite">
    <span class="view-loading__text">Loading…</span>
  </div>
`;

const ERROR_HTML = `
  <section class="view-error" role="alert">
    <div class="view-error__content">
      <h1>Something went wrong</h1>
      <p>
        This part of EduDit could not be loaded.
        Your saved progress has not been changed.
      </p>
      <button type="button" data-router-retry>
        Try again
      </button>
    </div>
  </section>
`;

/* =============================================================================
   Route Helpers
   ============================================================================= */

/**
 * Return a route definition.
 *
 * @param {string} routeId
 * @returns {Object|null}
 */
function getRoute(routeId) {
  return ROUTES[routeId] ?? null;
}

/**
 * Return a defensive copy of the route registry.
 *
 * @returns {Object}
 */
function getRoutes() {
  return Object.fromEntries(
    Object.entries(ROUTES).map(([key, route]) => [
      key,
      { ...route },
    ]),
  );
}

/**
 * Determine whether a route exists.
 *
 * @param {string} routeId
 * @returns {boolean}
 */
function isValidRoute(routeId) {
  return typeof routeId === "string" && Boolean(ROUTES[routeId]);
}

/**
 * Convert a route URL into an application route.
 *
 * Supports:
 *
 *   #dashboard
 *   #lessons
 *   #receive
 *   #receive?mode=adaptive
 *
 * @param {string} hash
 * @returns {{routeId: string, query: URLSearchParams}}
 */
function parseHash(hash) {
  const cleanHash = String(hash ?? "")
    .replace(/^#/, "")
    .trim();

  if (!cleanHash) {
    return {
      routeId: DEFAULT_ROUTE,
      query: new URLSearchParams(),
    };
  }

  const [routePart, queryString = ""] =
    cleanHash.split("?");

  const routeId = routePart.trim();

  return {
    routeId: isValidRoute(routeId)
      ? routeId
      : DEFAULT_ROUTE,
    query: new URLSearchParams(queryString),
  };
}

/**
 * Build a hash for a route.
 *
 * @param {string} routeId
 * @param {Object|URLSearchParams} query
 * @returns {string}
 */
function buildHash(routeId, query = {}) {
  if (!isValidRoute(routeId)) {
    throw new Error(
      `Cannot build hash for unknown route "${routeId}".`,
    );
  }

  const params =
    query instanceof URLSearchParams
      ? query
      : new URLSearchParams(query);

  const queryString = params.toString();

  return queryString
    ? `#${routeId}?${queryString}`
    : `#${routeId}`;
}

/* =============================================================================
   Feature Registry
   ============================================================================= */

/**
 * Features register themselves with the router.
 *
 * Example:
 *
 * router.registerFeature("receive", receiveFeature);
 *
 * The router intentionally does not import every feature itself. This avoids
 * creating a large dependency graph where every feature becomes coupled to
 * every other feature.
 */
class FeatureRegistry {
  #features = new Map();

  register(name, feature) {
    if (
      typeof name !== "string" ||
      name.trim().length === 0
    ) {
      throw new TypeError(
        "Feature name must be a non-empty string.",
      );
    }

    if (!feature || typeof feature !== "object") {
      throw new TypeError(
        `Feature "${name}" must be an object.`,
      );
    }

    if (this.#features.has(name)) {
      throw new Error(
        `Feature "${name}" is already registered.`,
      );
    }

    this.#features.set(name, feature);
  }

  get(name) {
    return this.#features.get(name) ?? null;
  }

  has(name) {
    return this.#features.has(name);
  }

  unregister(name) {
    this.#features.delete(name);
  }
}

/* =============================================================================
   Router
   ============================================================================= */

class Router {
  #container = null;

  #featureRegistry = new FeatureRegistry();

  #currentRoute = null;

  #currentFeature = null;

  #currentViewElement = null;

  #isNavigating = false;

  #navigationToken = 0;

  #initialized = false;

  #boundHashChange = null;

  #boundRetry = null;

  /**
   * Initialize the router.
   *
   * @param {Object} options
   * @param {string} [options.containerSelector]
   */
  initialize(options = {}) {
    if (this.#initialized) {
      return;
    }

    const containerSelector =
      options.containerSelector ??
      VIEW_CONTAINER_SELECTOR;

    this.#container =
      document.querySelector(containerSelector);

    if (!this.#container) {
      throw new Error(
        `Router could not find view container "${containerSelector}".`,
      );
    }

    this.#boundHashChange =
      this.#handleHashChange.bind(this);

    window.addEventListener(
      "hashchange",
      this.#boundHashChange,
    );

    this.#boundRetry =
      this.#handleRetry.bind(this);

    this.#container.addEventListener(
      "click",
      this.#boundRetry,
    );

    this.#initialized = true;
  }

  /**
   * Register a feature module.
   *
   * @param {string} name
   * @param {Object} feature
   */
  registerFeature(name, feature) {
    this.#featureRegistry.register(
      name,
      feature,
    );
  }

  /**
   * Navigate to a route.
   *
   * @param {string} routeId
   * @param {Object|URLSearchParams} [query]
   * @param {Object} [options]
   * @param {boolean} [options.replace=false]
   */
  async navigate(
    routeId,
    query = {},
    options = {},
  ) {
    this.#requireInitialized();

    if (!isValidRoute(routeId)) {
      console.warn(
        `[EduDit] Unknown route "${routeId}". Falling back to "${DEFAULT_ROUTE}".`,
      );

      routeId = DEFAULT_ROUTE;
    }

    const {
      replace = false,
    } = options;

    const hash = buildHash(
      routeId,
      query,
    );

    const currentHash =
      window.location.hash;

    if (currentHash === hash) {
      /*
       * The hash will not fire hashchange if it is already identical, so
       * explicitly perform navigation.
       */
      await this.#performNavigation(
        routeId,
        new URLSearchParams(
          query instanceof URLSearchParams
            ? query
            : new URLSearchParams(query),
        ),
      );

      return;
    }

    if (replace) {
      window.history.replaceState(
        null,
        "",
        hash,
      );

      await this.#performNavigation(
        routeId,
        new URLSearchParams(
          query instanceof URLSearchParams
            ? query
            : new URLSearchParams(query),
        ),
      );

      return;
    }

    window.location.hash = hash;
  }

  /**
   * Navigate using a route name while preserving existing query parameters.
   *
   * @param {string} routeId
   */
  async replace(routeId) {
    await this.navigate(
      routeId,
      {},
      { replace: true },
    );
  }

  /**
   * Return the currently active route.
   *
   * @returns {Object|null}
   */
  getCurrentRoute() {
    if (!this.#currentRoute) {
      return null;
    }

    return {
      ...this.#currentRoute,
      query: new URLSearchParams(
        this.#currentRoute.query,
      ),
    };
  }

  /**
   * Return the active route ID.
   *
   * @returns {string|null}
   */
  getCurrentRouteId() {
    return this.#currentRoute?.id ?? null;
  }

  /**
   * Return the active view element.
   *
   * @returns {HTMLElement|null}
   */
  getCurrentViewElement() {
    return this.#currentViewElement;
  }

  /**
   * Return whether a navigation is currently in progress.
   *
   * @returns {boolean}
   */
  isNavigating() {
    return this.#isNavigating;
  }

  /* ===========================================================================
     Internal Navigation
     =========================================================================== */

  async #handleHashChange() {
    const {
      routeId,
      query,
    } = parseHash(
      window.location.hash,
    );

    await this.#performNavigation(
      routeId,
      query,
    );
  }

  async #performNavigation(
    routeId,
    query,
  ) {
    const route = getRoute(routeId);

    if (!route) {
      return;
    }

    /*
     * Each navigation receives a unique token.
     *
     * If navigation A begins, then navigation B begins before A finishes, A's
     * result must not overwrite B's view.
     */
    const navigationToken =
      ++this.#navigationToken;

    this.#isNavigating = true;

    this.#setNavigationState(true);

    events.emit(
      EVENT_NAMES.ROUTE_BEFORE_CHANGE,
      {
        from: this.#currentRoute
          ? {
              id: this.#currentRoute.id,
            }
          : null,
        to: {
          id: route.id,
        },
      },
    );

    try {
      await this.#destroyCurrentFeature();

      if (
        navigationToken !==
        this.#navigationToken
      ) {
        return;
      }

      this.#showLoading();

      const html =
        await this.#loadViewHtml(route);

      if (
        navigationToken !==
        this.#navigationToken
      ) {
        return;
      }

      this.#container.innerHTML = html;

      this.#currentViewElement =
        this.#container.firstElementChild;

      this.#currentRoute = {
        ...route,
        query,
      };

      this.#updateNavigationUI(route.id);

      await this.#initializeCurrentFeature(
        route,
        query,
      );

      if (
        navigationToken !==
        this.#navigationToken
      ) {
        return;
      }

      events.emit(
        EVENT_NAMES.ROUTE_CHANGED,
        {
          route: this.getCurrentRoute(),
        },
      );
    } catch (error) {
      if (
        navigationToken !==
        this.#navigationToken
      ) {
        return;
      }

      console.error(
        `[EduDit] Failed to load route "${route.id}".`,
        error,
      );

      this.#showError();

      events.emit(
        EVENT_NAMES.ROUTE_ERROR,
        {
          route: {
            ...route,
            query,
          },
          error,
        },
      );
    } finally {
      if (
        navigationToken ===
        this.#navigationToken
      ) {
        this.#isNavigating = false;

        this.#setNavigationState(false);
      }
    }
  }

  /* ===========================================================================
     View Loading
     =========================================================================== */

  async #loadViewHtml(route) {
    const path =
      `views/${route.path}`;

    const response =
      await fetch(path);

    if (!response.ok) {
      throw new Error(
        `Unable to load view "${path}" (${response.status}).`,
      );
    }

    return response.text();
  }

  #showLoading() {
    this.#container.innerHTML =
      LOADING_HTML;

    this.#currentViewElement = null;
  }

  #showError() {
    this.#container.innerHTML =
      ERROR_HTML;

    this.#currentViewElement = null;
  }

  /* ===========================================================================
     Feature Lifecycle
     =========================================================================== */

  async #initializeCurrentFeature(
    route,
    query,
  ) {
    const feature =
      this.#featureRegistry.get(
        route.feature,
      );

    /*
     * A view is allowed to exist without a feature module.
     *
     * This is useful during development and for intentionally static views.
     */
    if (!feature) {
      this.#currentFeature = null;

      return;
    }

    this.#currentFeature = feature;

    const context = {
      route: {
        ...route,
        query,
      },

      router: this,

      element:
        this.#currentViewElement,

      query,

      navigate: (
        destination,
        destinationQuery = {},
        options = {},
      ) =>
        this.navigate(
          destination,
          destinationQuery,
          options,
        ),
    };

    /*
     * Lifecycle is intentionally defensive.
     *
     * A feature only needs to implement the methods it actually needs.
     */

    if (
      typeof feature.mount === "function"
    ) {
      await feature.mount(context);
    }

    if (
      typeof feature.initialize ===
      "function"
    ) {
      await feature.initialize(context);
    }

    if (
      typeof feature.start === "function"
    ) {
      await feature.start(context);
    }
  }

  async #destroyCurrentFeature() {
    const feature =
      this.#currentFeature;

    if (!feature) {
      return;
    }

    /*
     * Stop is separate from destroy.
     *
     * Training features can use stop() to terminate active sessions/audio,
     * while destroy() removes event listeners and releases references.
     */

    try {
      if (
        typeof feature.stop ===
        "function"
      ) {
        await feature.stop();
      }

      if (
        typeof feature.destroy ===
        "function"
      ) {
        await feature.destroy();
      }
    } catch (error) {
      /*
       * Cleanup errors should not prevent navigation forever.
       *
       * We report them, then continue with the new route.
       */
      console.error(
        "[EduDit] Feature cleanup failed.",
        error,
      );

      events.emit(
        EVENT_NAMES.FEATURE_CLEANUP_ERROR,
        {
          feature,
          error,
        },
      );
    } finally {
      this.#currentFeature = null;
      this.#currentViewElement = null;
    }
  }

  /* ===========================================================================
     Navigation UI
     =========================================================================== */

  #updateNavigationUI(activeRouteId) {
    document
      .querySelectorAll(
        "[data-route]",
      )
      .forEach((element) => {
        const route =
          element.dataset.route;

        const isActive =
          route === activeRouteId;

        element.classList.toggle(
          "is-active",
          isActive,
        );

        if (isActive) {
          element.setAttribute(
            "aria-current",
            "page",
          );
        } else {
          element.removeAttribute(
            "aria-current",
          );
        }
      });
  }

  #setNavigationState(isNavigating) {
    document.body.classList.toggle(
      "is-navigating",
      isNavigating,
    );

    if (this.#container) {
      this.#container.setAttribute(
        "aria-busy",
        String(isNavigating),
      );
    }
  }

  /* ===========================================================================
     Retry
     =========================================================================== */

  async #handleRetry(event) {
    const retryButton =
      event.target.closest(
        "[data-router-retry]",
      );

    if (!retryButton) {
      return;
    }

    event.preventDefault();

    const route =
      this.#currentRoute;

    if (!route) {
      await this.navigate(
        DEFAULT_ROUTE,
      );

      return;
    }

    await this.navigate(
      route.id,
      route.query,
      {
        replace: true,
      },
    );
  }

  /* ===========================================================================
     Cleanup
     =========================================================================== */

  /**
   * Destroy the router.
   *
   * Normally called only when the renderer itself is shutting down.
   */
  async destroy() {
    await this.#destroyCurrentFeature();

    if (this.#boundHashChange) {
      window.removeEventListener(
        "hashchange",
        this.#boundHashChange,
      );
    }

    if (
      this.#boundRetry &&
      this.#container
    ) {
      this.#container.removeEventListener(
        "click",
        this.#boundRetry,
      );
    }

    this.#boundHashChange = null;
    this.#boundRetry = null;
    this.#container = null;
    this.#currentRoute = null;
    this.#initialized = false;
  }

  /* ===========================================================================
     Validation
     =========================================================================== */

  #requireInitialized() {
    if (!this.#initialized) {
      throw new Error(
        "Router has not been initialized.",
      );
    }
  }
}

/* =============================================================================
   Singleton
   ============================================================================= */

const router = new Router();

/* =============================================================================
   Exports
   ============================================================================= */

export {
  Router,
  ROUTES,
  DEFAULT_ROUTE,
  getRoute,
  getRoutes,
  isValidRoute,
  parseHash,
  buildHash,
};

export default router;