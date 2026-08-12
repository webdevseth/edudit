/**
 * =============================================================================
 * EduDit
 * Branding
 * =============================================================================
 *
 * Single source of truth for EduDit's user-facing identity.
 *
 * Branding configuration lives here. The actual image/SVG assets live under
 * src/assets/branding/ and are referenced by the UI where appropriate.
 * =============================================================================
 */

import { APP } from '../constants/app.js';

/* -------------------------------------------------------------------------- */
/* Brand Identity                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Core EduDit brand identity.
 */
export const BRAND = Object.freeze({
  name: APP.name,
  productName: APP.productName,

  tagline: 'Learn Morse by listening.',

  description:
    'A modern adaptive Morse code learning application focused on ear-first training.',

  assets: Object.freeze({
    logoLight: 'assets/branding/edudit-logo-light.svg',
    logoDark: 'assets/branding/edudit-logo-dark.svg',
    mark: 'assets/branding/edudit-mark.svg',
    favicon: 'icons/favicon.svg'
  })
});

/* -------------------------------------------------------------------------- */
/* Brand Helpers                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Returns the application name used in document titles and UI.
 *
 * @returns {string}
 */
export function getBrandName() {
  return BRAND.productName;
}

/**
 * Returns the application's tagline.
 *
 * @returns {string}
 */
export function getTagline() {
  return BRAND.tagline;
}