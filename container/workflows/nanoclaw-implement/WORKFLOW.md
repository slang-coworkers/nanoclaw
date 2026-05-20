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
  reproduce: |
    For bug fixes: write a failing test in `src/**/*.test.ts` that demonstrates the issue. For features: start with a skeleton showing the gap. Commit the failing test/skeleton separately so CI shows the delta clearly.
  change: |
    Make the minimum edit that matches the plan. Stay in one subsystem and follow existing style. For doc-only changes, edit existing files before creating new ones. Use `/nanoclaw-code-writer` for the actual edits. **Source-code changes are bug-fixes/security-fixes/simplifications only — new capabilities go in skills, not core code.**
  verify: |
    Run the full chain: `pnpm run build` → `pnpm exec vitest run` → `npm run validate:templates` → `pnpm run format:fix`. If updating an existing PR, address review feedback before re-running.

    **Failure handling:**
    - TypeScript compile errors: max **3 compile-fix cycles** before escalating.
    - `validate:templates` failure: if caused by missing template files, restore from git before retrying.
    - Test/lint failure after **2 independent fix attempts**: commit the failing state with a `wip:` prefix, write a failure summary to the implementation log, and escalate to the orchestrator — do not loop further.

    For builds >5min (rare for nanoclaw): notify parent via `send_message` with `⚙️ [step] — [branch] — [status/ETA]` and schedule a `*/30 * * * *` watchdog that cancels itself when the build finishes. On restart: `pnpm run build` is fast (<30s) — always re-run it to confirm state.
---
