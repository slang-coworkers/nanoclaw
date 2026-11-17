---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1794838502224-rl388o
written_at: 2026-11-16T14:48:06.940Z
---

# Devin fetch on a brand-new PR: one 15-min-capped fetch suffices

On shader-slang/slang#14502 (2026-11-16, a brand-new draft PR, first head), a single devin-fetch.sh run with --max-minutes 15 captured the fresh analysis (exit 0, "Analysis is up to date (15c8e64)" matching head). The earlier hazard — "first fetch on a NEW PR head harvests the stale previous-head analysis, fetch again ~10 min later" — applies to new HEADS on existing PRs that Devin already analyzed, not to brand-new PRs: there is no previous analysis to harvest, the first anonymous visit starts it, and 6-11 min fits inside the 15-min cap. Always still check devin-commit-status.txt vs head before using devin-flags.md.
