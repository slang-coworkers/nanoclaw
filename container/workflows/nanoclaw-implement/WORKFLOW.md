---
name: nanoclaw-implement
license: MIT
type: workflow
description: "Implement a fix or feature in NanoClaw. Specialized build/test/format steps."
extends: implement
requires: [code.read, code.edit, test.run, test.gen, repo.pr]
uses:
  skills: [nanoclaw-build, nanoclaw-code-reader, nanoclaw-github, nanoclaw-code-writer]
  workflows: []
overrides:
  reproduce: "Write a failing test in src/**/*.test.ts that demonstrates the issue."
  change: "Use /nanoclaw-code-writer. Source changes only for bug fixes — new capabilities go in skills."
  verify: "Build: pnpm run build. Test: pnpm exec vitest run. Templates: npm run validate:templates. Format: pnpm run format:fix. Autonomy additions: TypeScript build errors are usually fast to fix — max 3 compile-fix cycles before escalating. `npm run validate:templates` must pass before ship — if it fails due to missing template files, restore them from git before retrying. On restart: `pnpm run build` is fast (<30s), always re-run it to confirm state."
---
