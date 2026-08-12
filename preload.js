'use strict';

/**
 * =============================================================================
 * EduDit
 * Electron Preload Bridge
 * =============================================================================
 *
 * Responsibilities:
 *
 *   - Provide a narrow, explicit API between the Electron main process and the
 *     renderer process.
 *
 *   - Keep Node.js and Electron internals inaccessible to renderer code.
 *
 * Security requirements:
 *
 *   - contextIsolation remains enabled.
 *   - nodeIntegration remains disabled.
 *   - sandbox remains enabled.
 *   - Never expose ipcRenderer, process, fs, path, or other Node/Electron APIs
 *     directly to the renderer.
 *
 * Renderer code should interact only with the specific methods exposed here.
 * =============================================================================
 */

import {
  contextBridge,
  ipcRenderer,
} from 'electron';

import { APP } from './src/constants/app.js';


/* =============================================================================
   Validation
   ============================================================================= */

/**
 * Validate a storage key before sending it through IPC.
 *
 * The renderer is allowed to identify a logical storage record, but it is not
 * allowed to provide arbitrary filesystem paths.
 *
 * @param {*} key
 * @returns {string}
 */
function validateStorageKey(key) {
  if (
    typeof key !== 'string' ||
    key.trim().length === 0
  ) {
    throw new TypeError(
      'Storage key must be a non-empty string.',
    );
  }

  return key;
}


/**
 * Validate a value before sending it through IPC.
 *
 * core/storage.js stores serialized data, so the bridge expects a string.
 *
 * @param {*} value
 * @returns {string}
 */
function validateStorageValue(value) {
  if (typeof value !== 'string') {
    throw new TypeError(
      'Storage value must be a string.',
    );
  }

  return value;
}


/* =============================================================================
   Public EduDit API
   ============================================================================= */

/**
 * Explicit, intentionally small renderer-facing API.
 *
 * Native functionality is exposed only through narrow methods with clearly
 * defined responsibilities.
 */
const eduditAPI = Object.freeze({
  app: Object.freeze({
    getVersion: () =>
      APP.version,
  }),


  /**
   * Persistent application storage.
   *
   * The renderer never receives ipcRenderer itself. Each method is a narrow
   * wrapper around one specific IPC operation.
   */
  storage: Object.freeze({
    read: (key) =>
      ipcRenderer.invoke(
        'storage:read',
        validateStorageKey(key),
      ),

    write: (key, value) =>
      ipcRenderer.invoke(
        'storage:write',
        validateStorageKey(key),
        validateStorageValue(value),
      ),

    remove: (key) =>
      ipcRenderer.invoke(
        'storage:remove',
        validateStorageKey(key),
      ),
  }),
});


/* =============================================================================
   Bridge Exposure
   ============================================================================= */

contextBridge.exposeInMainWorld(
  'edudit',
  eduditAPI,
);