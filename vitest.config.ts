import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

/**
 * The rules engine is the only tested code in the project (BUILD-SPEC §0 rule 7),
 * because it is the only code where a silent wrong answer reaches a user as a
 * confident claim about their contract.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    include: ['src/lib/rules.test.ts'],
    environment: 'node',
  },
});
