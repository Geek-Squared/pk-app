import { defineConfig } from 'vitest/config';

// Cloud Functions suite. Runs in Node, like the rules suite, and for the same
// reason: this is server code that never sees a browser.
//
// It covers the pure modules under functions/src — never functions/src/index.ts
// itself, which calls admin.initializeApp() at import time and would try to
// reach a live project. Logic that needs a test belongs in its own module and
// is imported by index.ts; that constraint is the point, not a workaround.
export default defineConfig({
  test: {
    include: ['tests/functions/**/*.spec.ts'],
    environment: 'node',
    globals: true,
  },
});
