'use strict';

/**
 * =============================================================================
 * EduDit
 * Main Electron Process
 * =============================================================================
 *
 * Responsibilities:
 *
 *   - Create and manage application windows.
 *   - Configure Electron security.
 *   - Manage the application lifecycle.
 *   - Provide the narrow native persistence implementation required by
 *     preload.js.
 *
 * This file must NEVER contain application business logic.
 *
 * Morse training, curriculum, profiles, progression, and UI state belong in
 * the renderer process and dedicated modules.
 * =============================================================================
 */

import {
  app,
  BrowserWindow,
  ipcMain,
} from 'electron';

import fs from 'node:fs/promises';
import path from 'node:path';
import {
  fileURLToPath,
} from 'node:url';

import {
  APP,
  WINDOW,
} from './src/constants/app.js';


/* =============================================================================
   Module Constants
   ============================================================================= */

const __filename =
  fileURLToPath(import.meta.url);

const __dirname =
  path.dirname(__filename);

const STORAGE_DIRECTORY =
  'storage';

let mainWindow = null;


/* =============================================================================
   Native Storage
   ============================================================================= */

/**
 * Return the root directory used by EduDit's native persistence layer.
 *
 * Electron's userData directory is appropriate for application-owned,
 * persistent user data.
 *
 * @returns {string}
 */
function getStorageRoot() {
  return path.join(
    app.getPath('userData'),
    STORAGE_DIRECTORY,
  );
}


/**
 * Resolve a logical storage key into a safe path beneath the EduDit storage
 * directory.
 *
 * The renderer supplies logical keys such as:
 *
 *   profile-index
 *   profile/profile-id
 *
 * It must never be able to escape the storage directory.
 *
 * @param {string} key
 * @returns {string}
 */
function resolveStoragePath(key) {
  if (
    typeof key !== 'string' ||
    key.trim().length === 0
  ) {
    throw new TypeError(
      'Storage key must be a non-empty string.',
    );
  }

  const normalizedKey =
    key.replaceAll('\\', '/');

  if (
    normalizedKey.startsWith('/') ||
    /^[A-Za-z]:\//.test(normalizedKey)
  ) {
    throw new Error(
      'Absolute storage paths are not permitted.',
    );
  }

  const segments =
    normalizedKey.split('/');

  if (
    segments.some(
      (segment) =>
        segment === '' ||
        segment === '.' ||
        segment === '..',
    )
  ) {
    throw new Error(
      'Invalid storage key.',
    );
  }

  const root =
    path.resolve(
      getStorageRoot(),
    );

  const resolved =
    path.resolve(
      root,
      ...segments,
    );

  if (
    resolved !== root &&
    !resolved.startsWith(
      `${root}${path.sep}`,
    )
  ) {
    throw new Error(
      'Storage path escapes the application storage directory.',
    );
  }

  return resolved;
}


/**
 * Register the narrow native storage API used by preload.js.
 */
function registerStorageHandlers() {
  ipcMain.handle(
    'storage:read',
    async (_event, key) => {
      const filePath =
        resolveStoragePath(key);

      try {
        return await fs.readFile(
          filePath,
          'utf8',
        );
      } catch (error) {
        if (
          error?.code === 'ENOENT'
        ) {
          return null;
        }

        throw error;
      }
    },
  );


  ipcMain.handle(
    'storage:write',
    async (
      _event,
      key,
      value,
    ) => {
      const filePath =
        resolveStoragePath(key);

      await fs.mkdir(
        path.dirname(filePath),
        {
          recursive: true,
        },
      );

      await fs.writeFile(
        filePath,
        value,
        'utf8',
      );

      return true;
    },
  );


  ipcMain.handle(
    'storage:remove',
    async (_event, key) => {
      const filePath =
        resolveStoragePath(key);

      try {
        await fs.unlink(
          filePath,
        );
      } catch (error) {
        if (
          error?.code === 'ENOENT'
        ) {
          return false;
        }

        throw error;
      }

      return true;
    },
  );
}


/* =============================================================================
   Window Creation
   ============================================================================= */

/**
 * Creates the primary EduDit application window.
 *
 * @returns {BrowserWindow}
 */
function createMainWindow() {
  const window =
    new BrowserWindow({
      width:
        WINDOW.defaultWidth,

      height:
        WINDOW.defaultHeight,

      minWidth:
        WINDOW.minWidth,

      minHeight:
        WINDOW.minHeight,

      show: false,

      title:
        APP.productName,

      webPreferences: {
        preload:
          path.join(
            __dirname,
            'preload.js',
          ),

        contextIsolation:
          true,

        nodeIntegration:
          false,

        sandbox:
          true,

        devTools:
          !app.isPackaged,
      },
    });


  window.loadFile(
    path.join(
      __dirname,
      'src',
      'index.html',
    ),
  );


  window.once(
    'ready-to-show',
    () => {
      window.show();
    },
  );


  window.on(
    'closed',
    () => {
      mainWindow = null;
    },
  );


  return window;
}


/* =============================================================================
   Application Lifecycle
   ============================================================================= */

registerStorageHandlers();


app.whenReady().then(() => {
  mainWindow =
    createMainWindow();


  app.on(
    'activate',
    () => {
      if (
        BrowserWindow.getAllWindows()
          .length === 0
      ) {
        mainWindow =
          createMainWindow();
      }
    },
  );
});


app.on(
  'window-all-closed',
  () => {
    if (
      process.platform !== 'darwin'
    ) {
      app.quit();
    }
  },
);