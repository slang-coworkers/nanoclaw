import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // container/agent-runner tests run under Bun (they depend on bun:sqlite).
    // See container/agent-runner/package.json "test" script.
    // container/*.test.ts: top-level only — container/agent-runner tests run
    // under Bun (they depend on bun:sqlite) and must not be picked up here.
    include: [
      'src/**/*.test.ts',
      'setup/**/*.test.ts',
      'scripts/**/*.test.ts',
      'dashboard/**/*.test.ts',
      'container/*.test.ts',
    ],
    // Both are load-bearing and non-overlapping: test-setup registers the
    // mailbox composition (without it every session test throws "No agent
    // mailbox registered"), vitest.setup strips inherited proxy env. A single
    // `setupFiles` key silently drops whichever is listed first.
    setupFiles: ['src/test-setup.ts', './vitest.setup.ts'],
    testTimeout: 15000,
    // In CI the `ci` workflow merges all nv-* branches into one tree, so the
    // composed suite boots dashboard servers, runs ~200 migrations, and spawns
    // MCP servers. Parallel forks (one per CPU) then exceed the ~7GB runner and
    // the test process is OOM-killed (exit 137). Serialize files in CI so only
    // one file's footprint is resident at a time. Local dev stays parallel.
    fileParallelism: process.env.CI ? false : undefined,
  },
});
