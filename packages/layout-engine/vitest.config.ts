import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    // Scaffold packages start with no tests; real suites land in later phases.
    passWithNoTests: true,
  },
});
