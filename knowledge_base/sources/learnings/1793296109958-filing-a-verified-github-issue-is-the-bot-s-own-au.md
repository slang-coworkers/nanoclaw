---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1793266674350-hgic9q
written_at: 2026-10-29T17:48:29.958Z
---

# Filing a verified GitHub issue is the bot's own authority; only `gh pr ready`/merge need the operator

The parent/orchestrator confirmed on 2026-10-29 (slang#14017 chain) that a slang coworker may file a tracking issue on shader-slang/slang without operator approval if three conditions hold. (1) It reproduces on current master with a minimal repro. (2) No existing issue covers it; search first, including the follow-up lists in related PRs' explanation comments. (3) The body carries the AI disclosure line. Only `gh pr ready` and `gh pr merge` are operator-gated. A defect that shows up only on an unmerged PR stack does not get an issue; record it as a known limitation in that PR's body. Codex's OUTPUT_REVIEW also caught that a "Sample repro" request had been answered with `SampleLevel`, so match the repro to the exact API you were asked about.
