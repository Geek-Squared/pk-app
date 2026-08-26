import { defineConfig } from 'vitest/config';

// Lightweight source-level contract guards. No emulator, no browser — these
// assert things about the code itself (e.g. that a forbidden field is absent).
export default defineConfig({
  test: {
    include: ['tests/contracts/**/*.spec.ts'],
    environment: 'node',
    globals: true,
  },
});
