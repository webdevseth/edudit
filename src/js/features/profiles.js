/**
 * =============================================================================
 * EduDit
 * Profiles Feature
 * =============================================================================
 *
 * Learner profile management UI.
 *
 * Responsibilities:
 *
 * - Render the learner profile list.
 * - Show the active learner.
 * - Create learners.
 * - Select learners.
 * - Rename learners.
 * - Delete learners.
 * - React to application-wide profile events.
 * - Keep DOM concerns out of profileService and state.
 *
 * This module does NOT:
 *
 * - persist profile data directly
 * - manipulate localStorage
 * - own profile state
 * - implement profile data structures
 *
 * Those responsibilities remain in the core/profile-service layers.
 * =============================================================================
 */

import events, {
  EVENT_NAMES,
} from "../core/events.js";

import profileService from "../services/profileService.js";


/* =============================================================================
   Internal State
   ============================================================================= */

let mountedElement = null;

let currentContext = null;

let eventCleanups = [];

let formMode = "create";

let editingProfileId = null;


/* =============================================================================
   Constants
   ============================================================================= */

const MAX_NAME_LENGTH = 40;


/* =============================================================================
   DOM Helpers
   ============================================================================= */

/**
 * Find an element inside the mounted profiles view.
 *
 * @param {string} selector
 * @returns {Element|null}
 */
function query(selector) {
  return mountedElement?.querySelector(selector) ?? null;
}


/**
 * Escape user-provided text before inserting it into HTML.
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
 * Generate a compact learner initial.
 *
 * @param {string} name
 * @returns {string}
 */
function getInitial(name) {
  const normalized = String(name ?? "")
    .trim();

  return normalized
    ? normalized.charAt(0).toUpperCase()
    : "?";
}


/**
 * Format a timestamp for profile metadata.
 *
 * @param {*} timestamp
 * @returns {string}
 */
function formatProfileDate(timestamp) {
  const value = Number(timestamp);

  if (!Number.isFinite(value)) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    year: "numeric",
  }).format(date);
}


/* =============================================================================
   Rendering
   ============================================================================= */

/**
 * Render the complete profile list.
 */
function renderProfiles() {
  if (!mountedElement) {
    return;
  }

  const grid = query(
    "[data-profile-grid]",
  );

  const emptyState = query(
    "[data-profile-empty]",
  );

  if (!grid || !emptyState) {
    return;
  }

  const profiles =
    profileService.getProfiles();

  const activeProfile =
    profileService.getActiveProfile();

  if (profiles.length === 0) {
    grid.innerHTML = "";

    grid.hidden = true;

    emptyState.hidden = false;

    return;
  }

  emptyState.hidden = true;

  grid.hidden = false;

  grid.innerHTML = profiles
    .map((profile) => {
      const isActive =
        profile.id === activeProfile?.id;

      const initial =
        getInitial(profile.name);

      const updated =
        formatProfileDate(
          profile.updatedAt,
        );

      return `
        <article
          class="profile-card${
            isActive
              ? " profile-card-active"
              : ""
          }"
          data-profile-id="${escapeHtml(profile.id)}"
          data-active="${isActive}"
        >
          <div class="profile-card-header">
            <span
              class="profile-avatar"
              aria-hidden="true"
            >
              ${escapeHtml(initial)}
            </span>

            ${
              isActive
                ? `
                  <span class="profile-active-badge">
                    Current learner
                  </span>
                `
                : ""
            }
          </div>

          <div class="profile-card-body">
            <h2 class="profile-card-name">
              ${escapeHtml(profile.name)}
            </h2>

            ${
              updated
                ? `
                  <p class="profile-card-meta">
                    Updated ${escapeHtml(updated)}
                  </p>
                `
                : ""
            }
          </div>

          <div class="profile-card-actions">
            ${
              isActive
                ? `
                  <button
                    type="button"
                    class="button button-secondary"
                    data-profile-action="rename"
                    data-profile-id="${escapeHtml(profile.id)}"
                  >
                    Rename
                  </button>
                `
                : `
                  <button
                    type="button"
                    class="button button-primary"
                    data-profile-action="select"
                    data-profile-id="${escapeHtml(profile.id)}"
                  >
                    Use learner
                  </button>

                  <button
                    type="button"
                    class="button button-secondary"
                    data-profile-action="rename"
                    data-profile-id="${escapeHtml(profile.id)}"
                  >
                    Rename
                  </button>
                `
            }

            <button
              type="button"
              class="button button-danger"
              data-profile-action="delete"
              data-profile-id="${escapeHtml(profile.id)}"
            >
              Delete
            </button>
          </div>
        </article>
      `;
    })
    .join("");
}


/**
 * Render the create/rename form state.
 *
 * @param {"create"|"rename"} mode
 * @param {Object|null} profile
 */
function renderForm(mode, profile = null) {
  const container = query(
    "[data-profile-form-container]",
  );

  const title = query(
    "[data-profile-form-title]",
  );

  const description = query(
    "[data-profile-form-description]",
  );

  const input = query(
    "[data-profile-name-input]",
  );

  const avatar = query(
    "[data-profile-form-avatar]",
  );

  const submitButton = query(
    '[data-profile-action="submit-form"]',
  );

  const error = query(
    "[data-profile-form-error]",
  );

  if (
    !container ||
    !title ||
    !description ||
    !input ||
    !avatar ||
    !submitButton ||
    !error
  ) {
    return;
  }

  formMode = mode;

  editingProfileId =
    profile?.id ?? null;

  if (mode === "rename") {
    title.textContent =
      "Rename learner";

    description.textContent =
      "Update the name used to identify this learner.";

    submitButton.textContent =
      "Save name";

    input.value =
      profile?.name ?? "";

    avatar.textContent =
      getInitial(profile?.name);

    input.setAttribute(
      "aria-label",
      "Learner name",
    );
  } else {
    title.textContent =
      "Add learner";

    description.textContent =
      "Create a learner profile to keep training progress separate.";

    submitButton.textContent =
      "Create learner";

    input.value = "";

    avatar.textContent = "?";

    input.setAttribute(
      "aria-label",
      "Learner name",
    );
  }

  error.textContent = "";

  error.hidden = true;

  container.hidden = false;

  requestAnimationFrame(() => {
    input.focus();

    input.select();
  });
}


/**
 * Hide the profile form.
 */
function hideForm() {
  const container = query(
    "[data-profile-form-container]",
  );

  const error = query(
    "[data-profile-form-error]",
  );

  if (container) {
    container.hidden = true;
  }

  if (error) {
    error.textContent = "";

    error.hidden = true;
  }

  formMode = "create";

  editingProfileId = null;
}


/**
 * Display a form validation error.
 *
 * @param {string} message
 */
function showFormError(message) {
  const error = query(
    "[data-profile-form-error]",
  );

  if (!error) {
    return;
  }

  error.textContent = message;

  error.hidden = false;
}


/* =============================================================================
   Form Handling
   ============================================================================= */

/**
 * Validate a learner name.
 *
 * @param {*} value
 * @returns {{valid: boolean, name?: string, error?: string}}
 */
function validateName(value) {
  const name =
    String(value ?? "")
      .trim();

  if (!name) {
    return {
      valid: false,
      error: "Please enter a learner name.",
    };
  }

  if (name.length > MAX_NAME_LENGTH) {
    return {
      valid: false,
      error:
        `Learner names must be ${MAX_NAME_LENGTH} characters or fewer.`,
    };
  }

  return {
    valid: true,
    name,
  };
}


/**
 * Handle creation or renaming.
 *
 * @param {SubmitEvent} event
 */
async function handleFormSubmit(event) {
  event.preventDefault();

  const input = query(
    "[data-profile-name-input]",
  );

  if (!input) {
    return;
  }

  const validation =
    validateName(input.value);

  if (!validation.valid) {
    showFormError(
      validation.error,
    );

    input.focus();

    return;
  }

  const submitButton = query(
    '[data-profile-action="submit-form"]',
  );

  if (submitButton) {
    submitButton.disabled = true;
  }

  try {
    if (formMode === "rename") {
      if (!editingProfileId) {
        throw new Error(
          "No learner was selected for renaming.",
        );
      }

      profileService.renameProfile(
        editingProfileId,
        validation.name,
      );
    } else {
      await profileService.createProfile(
        validation.name,
      );
    }

    hideForm();

    renderProfiles();
  } catch (error) {
    console.error(
      "[EduDit] Failed to save learner profile.",
      error,
    );

    showFormError(
      error instanceof Error
        ? error.message
        : "Unable to save this learner.",
    );
  } finally {
    if (submitButton) {
      submitButton.disabled = false;
    }
  }
}


/* =============================================================================
   Profile Actions
   ============================================================================= */

/**
 * Select a learner.
 *
 * @param {string} profileId
 */
async function handleSelect(profileId) {
  if (!profileId) {
    return;
  }

  try {
    await profileService.selectProfile(
      profileId,
    );

    renderProfiles();
  } catch (error) {
    console.error(
      "[EduDit] Failed to select learner.",
      error,
    );

    showActionError(
      error instanceof Error
        ? error.message
        : "Unable to select this learner.",
    );
  }
}


/**
 * Begin renaming a learner.
 *
 * @param {string} profileId
 */
function handleRename(profileId) {
  const profile =
    profileService
      .getProfiles()
      .find(
        (candidate) =>
          candidate.id === profileId,
      );

  if (!profile) {
    showActionError(
      "That learner could not be found.",
    );

    return;
  }

  renderForm(
    "rename",
    profile,
  );
}


/**
 * Delete a learner.
 *
 * @param {string} profileId
 */
async function handleDelete(profileId) {
  if (!profileId) {
    return;
  }

  const profile =
    profileService
      .getProfiles()
      .find(
        (candidate) =>
          candidate.id === profileId,
      );

  if (!profile) {
    showActionError(
      "That learner could not be found.",
    );

    return;
  }

  const confirmed =
    window.confirm(
      `Delete the learner "${profile.name}"?\n\n` +
      "This removes the learner's saved profile data " +
      "from this application.",
    );

  if (!confirmed) {
    return;
  }

  try {
    await profileService.deleteProfile(
      profileId,
    );

    renderProfiles();
  } catch (error) {
    console.error(
      "[EduDit] Failed to delete learner.",
      error,
    );

    showActionError(
      error instanceof Error
        ? error.message
        : "Unable to delete this learner.",
    );
  }
}


/**
 * Display a feature-level action error.
 *
 * @param {string} message
 */
function showActionError(message) {
  const existing =
    query("[data-profile-action-error]");

  if (existing) {
    existing.textContent = message;

    existing.hidden = false;

    return;
  }

  const header =
    query(".profiles-header");

  if (!header) {
    return;
  }

  const error =
    document.createElement("p");

  error.className =
    "form-error profile-action-error";

  error.dataset.profileActionError =
    "";

  error.setAttribute(
    "role",
    "alert",
  );

  error.textContent = message;

  header.appendChild(error);

  window.setTimeout(() => {
    error.remove();
  }, 5000);
}


/* =============================================================================
   Event Handling
   ============================================================================= */

/**
 * Handle profile view clicks.
 *
 * @param {MouseEvent} event
 */
function handleClick(event) {
  const action =
    event.target.closest(
      "[data-profile-action]",
    );

  if (!action || !mountedElement?.contains(action)) {
    return;
  }

  const actionName =
    action.dataset.profileAction;

  const profileId =
    action.dataset.profileId ?? null;

  if (actionName === "show-create") {
    renderForm("create");

    return;
  }

  if (actionName === "cancel-form") {
    hideForm();

    return;
  }

  if (actionName === "select") {
    void handleSelect(profileId);

    return;
  }

  if (actionName === "rename") {
    handleRename(profileId);

    return;
  }

  if (actionName === "delete") {
    void handleDelete(profileId);
  }
}


/**
 * Keep the form avatar synchronized with the typed name.
 *
 * @param {InputEvent} event
 */
function handleInput(event) {
  const input =
    event.target.closest(
      "[data-profile-name-input]",
    );

  if (!input) {
    return;
  }

  const avatar =
    query("[data-profile-form-avatar]");

  if (avatar) {
    avatar.textContent =
      getInitial(input.value);
  }

  const error =
    query("[data-profile-form-error]");

  if (error) {
    error.hidden = true;

    error.textContent = "";
  }
}


/**
 * Handle profile form submission.
 *
 * @param {SubmitEvent} event
 */
function handleSubmit(event) {
  const form =
    event.target.closest(
      "[data-profile-form]",
    );

  if (!form) {
    return;
  }

  void handleFormSubmit(event);
}


/**
 * Handle application profile events.
 */
function bindEvents() {
  if (eventCleanups.length > 0) {
    return;
  }

  const rerenderEvents = [
    EVENT_NAMES.PROFILE_CREATED,
    EVENT_NAMES.PROFILE_SELECTED,
    EVENT_NAMES.PROFILE_UPDATED,
    EVENT_NAMES.PROFILE_DELETED,
  ];

  rerenderEvents.forEach(
    (eventName) => {
      eventCleanups.push(
        events.on(
          eventName,
          () => {
            renderProfiles();
          },
        ),
      );
    },
  );
}


/**
 * Remove all feature event subscriptions.
 */
function unbindEvents() {
  eventCleanups.forEach(
    (unsubscribe) => {
      try {
        unsubscribe();
      } catch (error) {
        console.error(
          "[EduDit] Failed to remove profiles listener.",
          error,
        );
      }
    },
  );

  eventCleanups = [];
}


/* =============================================================================
   Lifecycle
   ============================================================================= */

/**
 * Mount the feature.
 *
 * @param {Object} context
 */
function mount(context) {
  currentContext = context;

  mountedElement =
    context?.element ?? null;

  if (!mountedElement) {
    throw new Error(
      "Profiles feature requires a mounted view element.",
    );
  }

  mountedElement.addEventListener(
    "click",
    handleClick,
  );

  mountedElement.addEventListener(
    "input",
    handleInput,
  );

  mountedElement.addEventListener(
    "submit",
    handleSubmit,
  );

  bindEvents();

  renderProfiles();
}


/**
 * Initialize the feature.
 *
 * @returns {Promise<void>}
 */
async function initialize() {
  /*
   * ProfileService is initialized by the application bootstrap before the
   * router mounts this feature. This method intentionally remains async so
   * the feature conforms cleanly to the router lifecycle contract.
   */
  renderProfiles();
}


/**
 * Start the feature.
 *
 * @returns {Promise<void>}
 */
async function start() {
  renderProfiles();
}


/**
 * Destroy the feature.
 */
function destroy() {
  if (mountedElement) {
    mountedElement.removeEventListener(
      "click",
      handleClick,
    );

    mountedElement.removeEventListener(
      "input",
      handleInput,
    );

    mountedElement.removeEventListener(
      "submit",
      handleSubmit,
    );
  }

  unbindEvents();

  mountedElement = null;

  currentContext = null;

  formMode = "create";

  editingProfileId = null;
}


/* =============================================================================
   Public API
   ============================================================================= */

const profilesFeature = Object.freeze({
  mount,
  initialize,
  start,
  destroy,
});


export {
  mount,
  initialize,
  start,
  destroy,
};


export default profilesFeature;