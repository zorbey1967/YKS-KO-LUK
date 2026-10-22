import { defineConfig } from 'vitest/config';

/** Yalnız yerel Supabase (supabase start) testleri. `npm test` bu dosyaları ÇALIŞTIRMAZ. */
export default defineConfig({
  test: {
    include: ['scripts/local-auth/**/*.localtest.ts'],
    testTimeout: 60_000,
    hookTimeout: 60_000,
    fileParallelism: false,
  },
});
