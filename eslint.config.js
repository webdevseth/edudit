/**
 * =============================================================================
 * EduDit
 * ESLint Configuration
 * =============================================================================
 *
 * ESLint 9 flat configuration.
 *
 * The project uses native ES modules throughout.
 *
 * Environments:
 *
 *   - Electron main process
 *   - Electron preload
 *   - Browser renderer
 *   - Tests
 *
 * Prettier remains responsible for formatting.
 * =============================================================================
 */

import eslint from '@eslint/js';
import prettier from 'eslint-config-prettier';


/* =============================================================================
   Shared Rules
   ============================================================================= */

const sharedRules = {
  /*
   * Error prevention
   */
  'no-console': 'off',
  'no-debugger': 'error',
  'no-duplicate-imports': 'error',
  'no-constant-binary-expression': 'error',
  'no-unreachable': 'error',

  'no-unused-vars': [
    'error',
    {
      args: 'after-used',
      argsIgnorePattern: '^_',
      caughtErrors: 'none',
      ignoreRestSiblings: true,
      varsIgnorePattern: '^_',
    },
  ],

  /*
   * Code quality
   *
   * Complexity remains a warning during development rather than a build
   * blocker. Some validation and normalization functions naturally contain
   * several branches.
   */
  complexity: ['warn', 12],

  'no-else-return': 'error',
  'no-implicit-coercion': 'error',
  'no-lonely-if': 'error',
  'no-multi-assign': 'error',
  'no-new-wrappers': 'error',
  'no-return-assign': 'error',
  'no-self-compare': 'error',
  'no-throw-literal': 'error',
  'no-unmodified-loop-condition': 'error',

  /*
   * Modern JavaScript
   */
  'prefer-const': 'error',
  'no-var': 'error',
  'object-shorthand': 'error',
  'prefer-template': 'error',
  'prefer-arrow-callback': 'error',

  /*
   * Safety / maintainability
   */
  'no-eval': 'error',
  'no-implied-eval': 'error',
  'no-new-func': 'error',
  'no-script-url': 'error',
  'no-with': 'error',
};


/* =============================================================================
   Configuration
   ============================================================================= */

export default [
  {
    ignores: [
      'node_modules/**',
      'coverage/**',
      'dist/**',
      'build/**',
      'release/**',
      '*.min.js',
    ],
  },


  /*
   * ESLint's recommended JavaScript rules.
   */
  eslint.configs.recommended,


  /*
   * Shared JavaScript configuration.
   */
  {
    files: ['**/*.js'],

    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
    },

    rules: sharedRules,
  },


  /*
   * Electron main process.
   *
   * main.js has access to Node/Electron globals.
   */
  {
    files: [
      'main.js',
    ],

    languageOptions: {
      globals: {
        process: 'readonly',
      },
    },
  },


  /*
   * Electron preload.
   *
   * preload.js imports Electron APIs explicitly, but process is also an
   * available Electron/Node global.
   */
  {
    files: [
      'preload.js',
    ],

    languageOptions: {
      globals: {
        process: 'readonly',
      },
    },
  },


  /*
   * Renderer environment.
   *
   * EduDit's application code executes inside an Electron renderer with
   * browser APIs available.
   *
   * These are declared explicitly rather than adding browser globals to
   * every source file individually.
   */
  {
    files: [
      'src/js/**/*.js',
    ],

    languageOptions: {
      globals: {
        Audio: 'readonly',
        Blob: 'readonly',
        CustomEvent: 'readonly',
        CSS: 'readonly',
        DOMParser: 'readonly',
        Event: 'readonly',
        EventTarget: 'readonly',
        FileReader: 'readonly',
        FormData: 'readonly',
        HTMLElement: 'readonly',
        HTMLAudioElement: 'readonly',
        HTMLButtonElement: 'readonly',
        HTMLDivElement: 'readonly',
        HTMLInputElement: 'readonly',
        HTMLSelectElement: 'readonly',
        HTMLTextAreaElement: 'readonly',
        KeyboardEvent: 'readonly',
        MouseEvent: 'readonly',
        Node: 'readonly',
        NodeList: 'readonly',
        Performance: 'readonly',
        Promise: 'readonly',
        Request: 'readonly',
        Response: 'readonly',
        URL: 'readonly',
        URLSearchParams: 'readonly',
        WebSocket: 'readonly',
        Window: 'readonly',

        cancelAnimationFrame: 'readonly',
        clearInterval: 'readonly',
        clearTimeout: 'readonly',
        console: 'readonly',
        document: 'readonly',
        fetch: 'readonly',
        globalThis: 'readonly',
        location: 'readonly',
        navigator: 'readonly',
        requestAnimationFrame: 'readonly',
        setInterval: 'readonly',
        setTimeout: 'readonly',
        structuredClone: 'readonly',
        window: 'readonly',
      },
    },
  },


  /*
   * Prettier owns formatting. ESLint should not fight it.
   */
  prettier,
];