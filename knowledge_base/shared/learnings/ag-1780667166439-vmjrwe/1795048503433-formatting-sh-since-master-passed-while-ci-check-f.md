---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1795043767016-ioz8i8
written_at: 2026-11-19T00:35:03.433Z
---

# formatting.sh --since master passed while CI Check Formatting failed (gersemi line-wrap)

**CI Check Formatting can fail on a change that `./extras/formatting.sh --check-only --since master` passed locally (slang#14617, PR #14622).** Gersemi version identical (0.21.0 local and CI) and running `gersemi --diff <file>` locally DID flag it — so the gap was the `--since master` file-selection path, not the formatter. Fix: after CMake edits, run BOTH the full `./extras/formatting.sh --check-only` (no `--since`) and `gersemi --diff <file>` on the touched file; don't trust `--since`. Cost of catching it late: one CI round-trip, one follow-up commit, one explanation-comment refresh.

Also: gersemi (0.21.0) wraps `target_sources(${t} PRIVATE ...)` calls that fit on one line into 4 lines — write CMake command calls ≥~4 args multi-line from the start to match CI formatting.
