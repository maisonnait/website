import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'node',
    // The first PGlite start compiles the WebAssembly build of Postgres and the seed hashes a password.
    testTimeout: 30_000,
    hookTimeout: 120_000,
    // One file at a time: each file owns a temporary database and the DATABASE_URL / NAIT_* variables.
    fileParallelism: false,
  },
});
