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
 * - Managing feature lifecycle.
 * - Preventing stale navigation results.
 * - Managing browser history.
 * - Providing a consistent feature context.
 *
 * The router does NOT:
 *
 * - Contain learning logic.
 * - Manage persistence.
 * - Own application state.
 * - Implement training algorithms.
 *
 * Feature lifecycle
 *
 *   mount(context)
 *   initialize(context)
 *   start(context)
 *   ...
 *   stop()
 *   destroy()
 *   unmount()
 *
 * A feature only needs to implement the lifecycle methods it actually needs.
 *
 * =============================================================================
 */

import events, { EVENT_NAMES } from "./events.js";

/* =============================================================================
   Configuration
   ============================================================================= */

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

function getRoute(routeId) {
  return ROUTES[routeId] ?? null;
}

function getRoutes() {
  return Object.fromEntries(
    Object.entries(ROUTES).map(([key, route]) => [
      key,
      { ...route },
    ]),
  );
}

function isValidRoute(routeId) {
  return (
    typeof routeId === "string" &&
    Boolean(ROUTES[routeId])
  );
}

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

  const questionMarkIndex =
    cleanHash.indexOf("?");

  const routePart =
    questionMarkIndex === -1
      ? cleanHash
      : cleanHash.slice(
          0,
          questionMarkIndex,
        );

  const queryString =
    questionMarkIndex === -1
      ? ""
      : cleanHash.slice(
          questionMarkIndex + 1,
        );

  const routeId = routePart.trim();

  return {
    routeId: isValidRoute(routeId)
      ? routeId
      : DEFAULT_ROUTE,

    query: new URLSearchParams(
      queryString,
    ),
  };
}

function buildHash(
  routeId,
  query = {},
) {
  if (!isValidRoute(routeId)) {
    throw new Error(
      `Cannot build hash for unknown route "${routeId}".`,
    );
  }

  const params =
    query instanceof URLSearchParams
      ? new URLSearchParams(query)
      : new URLSearchParams(query);

  const queryString =
    params.toString();

  return queryString
    ? `#${routeId}?${queryString}`
    : `#${routeId}`;
}

/* =============================================================================
   Feature Registry
   ============================================================================= */

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

    if (
      !feature ||
      (
        typeof feature !== "object" &&
        typeof feature !== "function"
      )
    ) {
      throw new TypeError(
        `Feature "${name}" must be an object or function.`,
      );
    }

    if (this.#features.has(name)) {
      throw new Error(
        `Feature "${name}" is already registered.`,
      );
    }

    this.#features.set(
      name,
      feature,
    );
  }

  get(name) {
    return (
      this.#features.get(name) ??
      null
    );
  }

  has(name) {
    return this.#features.has(name);
  }

  unregister(name) {
    this.#features.delete(name);
  }

  clear() {
    this.#features.clear();
  }
}

/* =============================================================================
   Router
   ============================================================================= */

class Router {
  #container = null;

  #featureRegistry =
    new FeatureRegistry();

  #currentRoute = null;

  #currentFeature = null;

  #currentFeatureCleanup = null;

  #currentViewElement = null;

  #isNavigating = false;

  #navigationToken = 0;

  #initialized = false;

  #boundHashChange = null;

  #boundRetry = null;

  /* ===========================================================================
     Initialization
     =========================================================================== */

  initialize(options = {}) {
    if (this.#initialized) {
      return;
    }

    const containerSelector =
      options.containerSelector ??
      VIEW_CONTAINER_SELECTOR;

    this.#container =
      document.querySelector(
        containerSelector,
      );

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

  /* ===========================================================================
     Feature Registration
     =========================================================================== */

  registerFeature(
    name,
    feature,
  ) {
    this.#featureRegistry.register(
      name,
      feature,
    );
  }

  unregisterFeature(name) {
    this.#featureRegistry.unregister(
      name,
    );
  }

  hasFeature(name) {
    return this.#featureRegistry.has(
      name,
    );
  }

  /* ===========================================================================
     Navigation
     =========================================================================== */

  async navigate(
    routeId,
    query = {},
    options = {},
  ) {
    this.#requireInitialized();

    let targetRouteId = routeId;

    if (!isValidRoute(targetRouteId)) {
      console.warn(
        `[EduDit] Unknown route "${targetRouteId}". Falling back to "${DEFAULT_ROUTE}".`,
      );

      targetRouteId =
        DEFAULT_ROUTE;
    }

    const {
      replace = false,
    } = options;

    const params =
      query instanceof URLSearchParams
        ? new URLSearchParams(query)
        : new URLSearchParams(query);

    const hash = buildHash(
      targetRouteId,
      params,
    );

    const currentHash =
      window.location.hash;

    if (currentHash === hash) {
      await this.#performNavigation(
        targetRouteId,
        params,
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
        targetRouteId,
        params,
      );

      return;
    }

    window.location.hash = hash;
  }

  async replace(
    routeId,
    query = {},
  ) {
    await this.navigate(
      routeId,
      query,
      {
        replace: true,
      },
    );
  }

  async start() {
    this.#requireInitialized();

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

  /* ===========================================================================
     Current State
     =========================================================================== */

  getCurrentRoute() {
    if (!this.#currentRoute) {
      return null;
    }

    return {
      ...this.#currentRoute,

      query:
        new URLSearchParams(
          this.#currentRoute.query,
        ),
    };
  }

  getCurrentRouteId() {
    return (
      this.#currentRoute?.id ??
      null
    );
  }

  getCurrentViewElement() {
    return this.#currentViewElement;
  }

  getCurrentFeature() {
    return this.#currentFeature;
  }

  isNavigating() {
    return this.#isNavigating;
  }

  /* ===========================================================================
     Hash Handling
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

  /* ===========================================================================
     Navigation Pipeline
     =========================================================================== */

  async #performNavigation(
    routeId,
    query,
  ) {
    const route =
      getRoute(routeId);

    if (!route) {
      return;
    }

    const navigationToken =
      ++this.#navigationToken;

    this.#isNavigating = true;

    this.#setNavigationState(
      true,
    );

    events.emit(
      EVENT_NAMES.ROUTE_BEFORE_CHANGE,
      {
        from: this.#currentRoute
          ? {
              id:
                this.#currentRoute.id,
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
        await this.#loadViewHtml(
          route,
        );

      if (
        navigationToken !==
        this.#navigationToken
      ) {
        return;
      }

      this.#container.innerHTML =
        html;

      this.#currentViewElement =
        this.#container
          .firstElementChild;

      this.#currentRoute = {
        ...route,

        query:
          new URLSearchParams(
            query,
          ),
      };

      this.#updateNavigationUI(
        route.id,
      );

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
          route:
            this.getCurrentRoute(),
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

            query:
              new URLSearchParams(
                query,
              ),
          },

          error,
        },
      );
    } finally {
      if (
        navigationToken ===
        this.#navigationToken
      ) {
        this.#isNavigating =
          false;

        this.#setNavigationState(
          false,
        );
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

    this.#currentViewElement =
      null;
  }

  #showError() {
    this.#container.innerHTML =
      ERROR_HTML;

    this.#currentViewElement =
      null;
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

    if (!feature) {
      this.#currentFeature =
        null;

      this.#currentFeatureCleanup =
        null;

      return;
    }

    this.#currentFeature =
      feature;

    const context = {
      route: {
        ...route,

        query:
          new URLSearchParams(
            query,
          ),
      },

      router: this,

      element:
        this.#currentViewElement,

      container:
        this.#container,

      query:
        new URLSearchParams(
          query,
        ),

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

      replace: (
        destination,
        destinationQuery = {},
      ) =>
        this.replace(
          destination,
          destinationQuery,
        ),
    };

    let lifecycleResult =
      null;

    /*
     * Preferred lifecycle:
     *
     * mount(context)
     */
    if (
      typeof feature.mount ===
      "function"
    ) {
      lifecycleResult =
        await feature.mount(
          context,
        );
    }

    /*
     * Secondary lifecycle:
     *
     * initialize(context)
     */
    if (
      typeof feature.initialize ===
      "function"
    ) {
      await feature.initialize(
        context,
      );
    }

    /*
     * Compatibility lifecycle:
     *
     * init(context)
     *
     * Some of our existing feature modules were written with init/destroy
     * semantics before the router contract was standardized.
     */
    if (
      typeof feature.init ===
      "function" &&
      typeof feature.mount !==
        "function"
    ) {
      lifecycleResult =
        await feature.init(
          context,
        );
    }

    /*
     * Optional active lifecycle.
     *
     * This is especially useful for training modules that should not begin
     * timers/audio/session activity until the view has completely mounted.
     */
    if (
      typeof feature.start ===
      "function"
    ) {
      await feature.start(
        context,
      );
    }

    /*
     * A feature may return a cleanup function from mount/init.
     */
    if (
      typeof lifecycleResult ===
      "function"
    ) {
      this.#currentFeatureCleanup =
        lifecycleResult;

      return;
    }

    /*
     * Or it may return an object containing an unmount callback.
     */
    if (
      lifecycleResult &&
      typeof lifecycleResult ===
        "object"
    ) {
      if (
        typeof lifecycleResult.unmount ===
        "function"
      ) {
        this.#currentFeatureCleanup =
          lifecycleResult.unmount;
      }
    }
  }

  async #destroyCurrentFeature() {
    const feature =
      this.#currentFeature;

    const cleanup =
      this.#currentFeatureCleanup;

    if (
      !feature &&
      !cleanup
    ) {
      return;
    }

    try {
      /*
       * First stop active work.
       *
       * Training features can use stop() to halt timers, audio, and active
       * sessions before their DOM is removed.
       */
      if (
        feature &&
        typeof feature.stop ===
          "function"
      ) {
        await feature.stop();
      }

      /*
       * Then run cleanup returned by mount/init.
       */
      if (
        typeof cleanup ===
        "function"
      ) {
        await cleanup();
      }

      /*
       * Destroy is the primary permanent cleanup lifecycle.
       */
      if (
        feature &&
        typeof feature.destroy ===
          "function"
      ) {
        await feature.destroy();
      }

      /*
       * Unmount is supported for components that prefer a mount/unmount
       * lifecycle.
       *
       * Do not call unmount if the returned cleanup function already came from
       * the feature's mount lifecycle and is therefore the unmount operation.
       */
      if (
        feature &&
        typeof feature.unmount ===
          "function" &&
        cleanup !==
          feature.unmount
      ) {
        await feature.unmount();
      }
    } catch (error) {
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
      this.#currentFeature =
        null;

      this.#currentFeatureCleanup =
        null;

      this.#currentViewElement =
        null;
    }
  }

  /* ===========================================================================
     Navigation UI
     =========================================================================== */

  #updateNavigationUI(
    activeRouteId,
  ) {
    document
      .querySelectorAll(
        "[data-route]",
      )
      .forEach((element) => {
        const route =
          element.dataset.route;

        const isActive =
          route ===
          activeRouteId;

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

  #setNavigationState(
    isNavigating,
  ) {
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
    const target =
      event.target;

    if (
      !target ||
      typeof target.closest !==
        "function"
    ) {
      return;
    }

    const retryButton =
      target.closest(
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

  async destroy() {
    ++this.#navigationToken;

    await this.#destroyCurrentFeature();

    if (
      this.#boundHashChange
    ) {
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

    this.#boundHashChange =
      null;

    this.#boundRetry =
      null;

    this.#container =
      null;

    this.#currentRoute =
      null;

    this.#currentFeature =
      null;

    this.#currentFeatureCleanup =
      null;

    this.#currentViewElement =
      null;

    this.#isNavigating =
      false;

    this.#initialized =
      false;
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

const router =
  new Router();

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