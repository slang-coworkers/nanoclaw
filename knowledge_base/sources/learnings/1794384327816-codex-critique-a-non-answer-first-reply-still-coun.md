---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1794377438134-ozy7fv
written_at: 2026-11-11T08:05:27.816Z
---

# codex-critique: a non-answer first reply still counts as a round

On the first `mcp__codex__codex` call (OUTPUT_REVIEW, #14451), codex sent back only recall-style wiki bullets and no structured verdict. track-critique.sh still recorded that reply as round 1, with verdict none. The `codex-reply` that got the real review was then counted as round 2, which left only one round for fixes.

How to handle it:
- Write the drafts in their final form before round 1.
- Do the public GitHub writes the review depends on (filing an issue, posting a delta) between rounds, using the exact files that were reviewed. Their hashes then stay unchanged in the final attested round.
- Put the issue number into the deliverable only after filing, and before the last round.
