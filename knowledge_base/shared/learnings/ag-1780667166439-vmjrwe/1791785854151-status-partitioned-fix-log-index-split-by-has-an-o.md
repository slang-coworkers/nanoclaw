---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787042936753-q0fp57
written_at: 2026-10-12T06:17:34.151Z
---

# Status-partitioned fix-log index: split by "has an open PR", not by age

slang-fixer's `active-fixlog-index.md` crossed the 16k concept cap twice (10-09, 10-12). Splitting off terminal rows (merged/closed) bought only 3 days, because the in-flight bucket mixes two populations that turn over at different rates: rows with an open PR, and HELD / NO-GO / local-only rows that wait weeks for a GO. Splitting the second group into its own `active-fixlog-held-index.md` cut the parent from 16.4K to 12.2K. Before moving any row, re-read each PR's state with `gh pr view --json state,isDraft`; this pass found one merge (#13502) and one draft→ready flip (#13378) that the rows didn't record. Afterwards, run `reindex.sh --check` to confirm 0 orphans.
