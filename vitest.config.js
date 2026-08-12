/**
 * =============================================================================
 * EduDit
 * Vitest Configuration
 * =============================================================================
 *
 * Vitest is used for unit and integration testing of EduDit's application
 * logic.
 *
 * Browser/Electron UI behavior should be tested separately when needed. The
 * core learning systems—Morse encoding, curriculum, mastery, progression,
 * adaptive selection, sessions, and persistence—should remain highly
 * testable
 * without requiring an Electron window.
 * =============================================================================
 */

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',

    globals: false,

    include: ['tests/**/*.test.js'],

    exclude: [
      'node_modules/**',
      'dist/**',
      'build/**',
      'release/**'
    ],

    coverage: {
      provider: 'v8',

      reporter: ['text', 'html', 'lcov'],

      reportsDirectory: './coverage',

      include: ['src/js/**/*.js'],

      exclude: [
        'src/js/app.js',
        'src/js/features/**',
        'src/js/ui/**'
      ]
    },

    testTimeout: 5000,

    hookTimeout: 5000,

    clearMocks: true,

    restoreMocks: true,

    unstubGlobals: true
  }
});