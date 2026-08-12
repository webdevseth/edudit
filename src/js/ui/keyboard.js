/**
 * =============================================================================
 * EduDit
 * Keyboard UI
 * =============================================================================
 *
 * Centralized keyboard/input event management.
 *
 * Responsibilities:
 *
 * - Register keyboard handlers.
 * - Remove handlers cleanly.
 * - Normalize KeyboardEvent information.
 * - Support scoped keyboard handling.
 * - Prevent duplicate registrations.
 * - Provide a consistent abstraction to training features.
 *
 * This module does NOT:
 *
 * - Decide what a key means to the learner.
 * - Calculate Morse code.
 * - Manage training state.
 * - Persist keyboard activity.
 * =============================================================================
 */


/* =============================================================================
   Constants
   ============================================================================= */

const DEFAULT_TARGET =
  typeof document !== "undefined"
    ? document
    : null;


const IGNORED_EDITABLE_ELEMENTS =
  Object.freeze([
    "INPUT",
    "TEXTAREA",
    "SELECT",
  ]);


/* =============================================================================
   Internal State
   ============================================================================= */

const bindings =
  new Map();

let bindingSequence = 0;


/* =============================================================================
   Utility
   ============================================================================= */

function createBindingId() {
  bindingSequence += 1;

  return `keyboard-${bindingSequence}`;
}


function normalizeKey(
  event,
) {
  if (!event) {
    return "";
  }

  return String(
    event.key ?? "",
  );
}


function normalizeCode(
  event,
) {
  if (!event) {
    return "";
  }

  return String(
    event.code ?? "",
  );
}


function isEditableElement(
  element,
) {
  if (!element) {
    return false;
  }

  const tagName =
    String(
      element.tagName ?? "",
    ).toUpperCase();

  if (
    IGNORED_EDITABLE_ELEMENTS.includes(
      tagName,
    )
  ) {
    return true;
  }

  return (
    element.isContentEditable ===
    true
  );
}


function shouldIgnoreEvent(
  event,
  options,
) {
  if (
    options.allowInEditable
  ) {
    return false;
  }

  return isEditableElement(
    event?.target,
  );
}


function normalizeOptions(
  options = {},
) {
  return {
    target:
      options.target ??
      DEFAULT_TARGET,

    event:
      options.event ??
      "keydown",

    capture:
      options.capture === true,

    once:
      options.once === true,

    passive:
      options.passive === true,

    preventDefault:
      options.preventDefault ===
      true,

    stopPropagation:
      options.stopPropagation ===
      true,

    allowInEditable:
      options.allowInEditable ===
      false,

    priority:
      Number.isFinite(
        Number(options.priority),
      )
        ? Number(options.priority)
        : 0,
  };
}


/* =============================================================================
   Event Matching
   ============================================================================= */

function matchesKey(
  event,
  key,
) {
  if (!key) {
    return true;
  }

  const normalizedKey =
    normalizeKey(event);

  const normalizedCode =
    normalizeCode(event);

  if (
    Array.isArray(key)
  ) {
    return key.some(
      (candidate) =>
        matchesKey(
          event,
          candidate,
        ),
    );
  }

  const normalizedExpected =
    String(key);

  return (
    normalizedKey ===
      normalizedExpected ||
    normalizedCode ===
      normalizedExpected
  );
}


function matchesModifiers(
  event,
  modifiers = {},
) {
  if (
    modifiers.ctrl !==
    undefined
  ) {
    if (
      event.ctrlKey !==
      Boolean(modifiers.ctrl)
    ) {
      return false;
    }
  }

  if (
    modifiers.meta !==
    undefined
  ) {
    if (
      event.metaKey !==
      Boolean(modifiers.meta)
    ) {
      return false;
    }
  }

  if (
    modifiers.shift !==
    undefined
  ) {
    if (
      event.shiftKey !==
      Boolean(modifiers.shift)
    ) {
      return false;
    }
  }

  if (
    modifiers.alt !==
    undefined
  ) {
    if (
      event.altKey !==
      Boolean(modifiers.alt)
    ) {
      return false;
    }
  }

  return true;
}


/* =============================================================================
   Binding Registration
   ============================================================================= */

function bind({
  key = null,
  keys = null,
  modifiers = {},
  handler,
  options = {},
} = {}) {
  if (
    typeof handler !==
    "function"
  ) {
    throw new TypeError(
      "Keyboard handler must be a function.",
    );
  }

  const normalizedOptions =
    normalizeOptions(
      options,
    );

  const target =
    normalizedOptions.target;

  if (
    !target ||
    typeof target.addEventListener !==
      "function"
  ) {
    throw new TypeError(
      "Keyboard binding target must support addEventListener.",
    );
  }

  const bindingId =
    createBindingId();

  const acceptedKeys =
    keys ??
    key;

  const listener =
    (event) => {
      if (
        shouldIgnoreEvent(
          event,
          normalizedOptions,
        )
      ) {
        return;
      }

      if (
        !matchesKey(
          event,
          acceptedKeys,
        )
      ) {
        return;
      }

      if (
        !matchesModifiers(
          event,
          modifiers,
        )
      ) {
        return;
      }

      if (
        normalizedOptions.preventDefault
      ) {
        event.preventDefault();
      }

      if (
        normalizedOptions.stopPropagation
      ) {
        event.stopPropagation();
      }

      handler(
        normalizeKeyboardEvent(
          event,
        ),
      );
    };

  target.addEventListener(
    normalizedOptions.event,
    listener,
    {
      capture:
        normalizedOptions.capture,
      once:
        normalizedOptions.once,
      passive:
        normalizedOptions.passive,
    },
  );

  bindings.set(
    bindingId,
    {
      id: bindingId,
      target,
      event:
        normalizedOptions.event,
      listener,
      key: acceptedKeys,
      modifiers,
      options:
        normalizedOptions,
    },
  );

  return () =>
    unbind(bindingId);
}


function bindKey(
  key,
  handler,
  options = {},
) {
  return bind({
    key,
    handler,
    options,
  });
}


function bindKeys(
  keys,
  handler,
  options = {},
) {
  return bind({
    keys,
    handler,
    options,
  });
}


/* =============================================================================
   Event Normalization
   ============================================================================= */

function normalizeKeyboardEvent(
  event,
) {
  return Object.freeze({
    originalEvent: event,

    key:
      normalizeKey(event),

    code:
      normalizeCode(event),

    repeat:
      event.repeat === true,

    ctrlKey:
      event.ctrlKey === true,

    metaKey:
      event.metaKey === true,

    shiftKey:
      event.shiftKey === true,

    altKey:
      event.altKey === true,

    target:
      event.target ?? null,

    timestamp:
      Number.isFinite(
        Number(event.timeStamp),
      )
        ? Number(event.timeStamp)
        : Date.now(),

    preventDefault() {
      event.preventDefault();
    },

    stopPropagation() {
      event.stopPropagation();
    },
  });
}


/* =============================================================================
   Unbinding
   ============================================================================= */

function unbind(
  bindingId,
) {
  const binding =
    bindings.get(
      bindingId,
    );

  if (!binding) {
    return false;
  }

  binding.target.removeEventListener(
    binding.event,
    binding.listener,
    binding.options.capture,
  );

  bindings.delete(
    bindingId,
  );

  return true;
}


function unbindAll() {
  for (
    const bindingId of
      bindings.keys()
  ) {
    unbind(bindingId);
  }
}


/* =============================================================================
   Binding Inspection
   ============================================================================= */

function hasBinding(
  bindingId,
) {
  return bindings.has(
    bindingId,
  );
}


function getBindingCount() {
  return bindings.size;
}


function getBindings() {
  return Array.from(
    bindings.values(),
    (binding) => ({
      id: binding.id,
      event: binding.event,
      key: binding.key,
      modifiers:
        binding.modifiers,
      options:
        binding.options,
    }),
  );
}


/* =============================================================================
   Convenience Bindings
   ============================================================================= */

function onKeyDown(
  handler,
  options = {},
) {
  return bind({
    handler,
    options: {
      ...options,
      event: "keydown",
    },
  });
}


function onKeyUp(
  handler,
  options = {},
) {
  return bind({
    handler,
    options: {
      ...options,
      event: "keyup",
    },
  });
}


function onKeyPress(
  handler,
  options = {},
) {
  return bind({
    handler,
    options: {
      ...options,
      event: "keypress",
    },
  });
}


/* =============================================================================
   Public API
   ============================================================================= */

const keyboard =
  Object.freeze({
    bind,
    bindKey,
    bindKeys,

    onKeyDown,
    onKeyUp,
    onKeyPress,

    unbind,
    unbindAll,

    normalizeKeyboardEvent,

    hasBinding,
    getBindingCount,
    getBindings,
  });


export {
  bind,
  bindKey,
  bindKeys,

  onKeyDown,
  onKeyUp,
  onKeyPress,

  unbind,
  unbindAll,

  normalizeKeyboardEvent,

  hasBinding,
  getBindingCount,
  getBindings,
};


export default keyboard;