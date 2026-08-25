import { describe, expect, it } from 'bun:test';
import fs from 'fs';
import path from 'path';

// Structural guard for the provider self-registration barrel (index.ts).
//
// A behavior test (import the barrel, assert listProviderNames()) is NOT
// reliable here: `bun test` runs every test file in one process with a shared
// module cache, so a sibling *.factory.test.ts that imports a provider module
// directly self-registers it and would keep a behavior assertion green even if
// the barrel's import line were deleted (the provider trap in
// docs/skill-guidelines.md). Asserting the barrel SOURCE contains each import
// line goes red on deletion regardless of cross-file registration pollution.
//
// (The host twin — src/providers/barrel-registration.test.ts — can and does
// use a real behavior test, because Vitest isolates modules per file.)
describe('container provider registration barrel', () => {
  const barrel = fs.readFileSync(path.join(import.meta.dir, 'index.ts'), 'utf8');
  for (const provider of ['claude', 'codex', 'opencode', 'pi']) {
    it(`barrel self-registers ./${provider}.js`, () => {
      expect(barrel).toMatch(new RegExp(`import\\s+'\\./${provider}\\.js'`));
    });
  }
});
