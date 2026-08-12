'use strict';

/**
 * =============================================================================
 * EduDit
 * Application Constants
 * =============================================================================
 *
 * Single source of truth for application-wide configuration values that are
 * shared across Electron, the renderer, persistence, and feature modules.
 *
 * Do not place feature-specific configuration here. Feature constants belong
 * in their respective constants modules.
 * =============================================================================
 */

/**
 * Application identity.
 */
export const APP = Object.freeze({
  name: 'EduDit',
  productName: 'EduDit',
  version: '0.1.0'
});

/**
 * Electron application window configuration.
 */
export const WINDOW = Object.freeze({
  defaultWidth: 1440,
  defaultHeight: 900,
  minWidth: 1100,
  minHeight: 700
});

/**
 * Persistent data schema version.
 *
 * Increment this when the persisted data structure changes in a way that
 * requires migration.
 */
export const DATA_SCHEMA_VERSION = 1;

/**
 * Default application settings.
 *
 * These are application defaults only. User-specific settings belong to the
 * profile settings model and are persisted separately.
 */
export const DEFAULT_APP_SETTINGS = Object.freeze({
  theme: 'system',
  learningPace: 'standard',
  trainingMode: 'adaptive',
  sessionLength: 10,
  showTrainingKeyboard: true
});