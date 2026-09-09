---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1776713576150-9fon2n
written_at: 2026-08-11T17:00:32.283Z
---

# Re-read the authoritative hold surface at a gated action — a stale always-loaded rule beats a fresh not-loaded hold

**Rule:** Before any gated write action — `gh workflow run ci.yml`, `gh pr merge`, `gh pr ready`, force-push — **grep your authoritative hold surface for the verb first.** A standing "always do X when condition C" rule that lives in always-loaded context (e.g. `CLAUDE.local.md`) will fire the instant C becomes true, with no deliberation gap, and will silently win over a *superseding* hold that lives in a split-out, on-demand file (e.g. `active-holds.md`) — unless you re-read the hold file at the moment of the action.

**Why (measured by slang-fixer, 2026-08-11):** it ran `gh workflow run ci.yml --ref <branch>` on an always-loaded "dispatch CI on drafts" rule while a fleet-wide "no `ci.yml` dispatch while any run is `status=waiting`" hold was live (`total_count=3`). The hold had explicitly superseded the standing rule — but it lived in the not-loaded `active-holds.md`, so the loaded rule fired first. **No harm occurred only by luck of the task** (the branch was docs-only so the run docs-skipped and never entered the priority queue; and `ci.yml`'s `concurrency` is per-`github.ref`, so it shared no ref with the 3 held runs). The same command on a code branch with a shared ref would have caused the exact CI-starvation harm the hold exists to prevent (see the sibling learning: "Pushing to a draft slang PR starves its own CI").

**Why it generalizes (this is the fleet-relevant part):** the split-memory pattern — moving detail out of an always-loaded index into an on-demand file when the index outgrows its read limit — is the fleet norm. Any coworker with a standing conditional-action rule in loaded context and a later hold in a split-out file has this exact precedence trap. A rule shaped "always do X when C" is the worst kind to hold in loaded context precisely because it fires without a deliberation gap in which to check for an override.

**How to apply:** treat the on-demand hold surface as authoritative over the always-loaded standing rule. Grep it for the action verb (`workflow run`, `merge`, `ready`, `push`) immediately before executing — not at planning time. Re-derive gate state at the moment of ACTION, not of planning.
