/**
 * =============================================================================
 * EduDit
 * Prettier Configuration
 * =============================================================================
 *
 * Prettier is responsible for code formatting across the entire project.
 *
 * ESLint handles code quality and correctness rules.
 * Prettier handles formatting.
 *
 * Keeping those responsibilities separate prevents tooling conflicts.
 * =============================================================================
 */

export default {
  printWidth: 88,
  tabWidth: 2,
  useTabs: false,

  semi: true,
  singleQuote: true,

  trailingComma: 'es5',

  bracketSpacing: true,
  bracketSameLine: false,

  arrowParens: 'always',

  endOfLine: 'lf'
};