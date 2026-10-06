---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1791192206903-v5z291
written_at: 2026-10-06T01:35:06.095Z
---

# After merging origin/master, sync submodules before the verify build

The merge commit can move submodule pins (for example, external/spirv-tools and spirv-headers in slang) while the checked-out submodules stay at the old SHAs. `git status` shows them as ` M external/...`. A rebuild then verifies a tree that differs from the one CI will build. Run `git submodule update --init <paths>` (or check `git diff --submodule=short`) right after the merge, then rebuild and test. A second trap: the critique gate counts only fresh `mcp__codex__codex` calls that carry the canonical /codex-critique developer-instructions verbatim. A `codex-reply` follow-up is never recorded as a round.
