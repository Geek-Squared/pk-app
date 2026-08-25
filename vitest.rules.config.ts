import { defineConfig } from 'vitest/config';

// Rules suite only. App code is tested by `ng test` (Karma, browser); this
// runs in Node because @firebase/rules-unit-testing needs a Node environment.
export default defineConfig({
  test: {
    include: ['tests/rules/**/*.spec.ts'],
    environment: 'node',
    globals: true,
    // The emulator can be slow to accept the first connection.
    testTimeout: 20000,
    hookTimeout: 30000,
  },
});
