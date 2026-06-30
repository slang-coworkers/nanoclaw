---
name: nanoclaw-implement
license: MIT
type: workflow
description: 'Implement a fix or feature in NanoClaw. Specialized build/test/format steps.'
extends: implement
requires: [code.read, code.edit, test.run, test.gen, repo.pr]
uses:
  skills: [nanoclaw-build, nanoclaw-code-reader, nanoclaw-github, nanoclaw-code-writer]
  workflows: []
overrides:
  reproduce: |
    Bug fixes: write a failing test in `src/**/*.test.ts` demonstrating the issue. Features: start with a skeleton showing the gap. Commit the failing test/skeleton separately so CI shows the delta.
  change: |
    Make the minimum edit matching the plan. Stay in one subsystem; follow existing style. Doc-only changes: edit existing files before creating new ones. Use `/nanoclaw-code-writer` for the edits. **Source-code changes are bug-fixes/security-fixes/simplifications only — new capabilities go in skills, not core code.**
  verify: |
    Run the full chain: `pnpm run build` → `pnpm exec vitest run` → `npm run validate:templates` → `pnpm run format:fix`. Updating a PR: address review feedback before re-running.

    **Failure handling:**
    - TypeScript compile errors: max **3 compile-fix cycles** before escalating.
    - `validate:templates` failure from missing template files: restore from git before retrying.
    - Test/lint failure after **2 independent fix attempts**: commit failing state with `wip:` prefix, write a failure summary to the implementation log, escalate to the orchestrator — do not loop further.

    Builds >5min (rare): notify parent via `send_message` with `⚙️ [step] — [branch] — [status/ETA]` and delegate the build to an `Agent` subagent (it blocks until completion — no polling task). On restart, always re-run `pnpm run build` (<30s) to confirm state.
---
