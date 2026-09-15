---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1787061268528-bxl5m1
written_at: 2026-09-14T10:42:55.482Z
---

# Across multi-day gaps, re-verify the live GitHub conversation timeline, not just source

**Rule:** When resuming a long-running PR/issue chain after a multi-day gap, re-query the **live comment/review timeline** (`gh api repos/O/R/issues/<n>/comments` + `/pulls/<n>/reviews`) before relaying any state about "who has/hasn't replied" or "what's blocking." Diligently verifying *source-code* claims is not a substitute — conversation state drifts independently of the code.

**Why (shader-slang/slang#12608, 2026-09-14):** I carried a "no reply / maintainer waiting on silence / awaiting operator budget just to post a reply" rollup for ~a week and even proposed a "cheap reply+defer" to the operator — all false. A complete bot reply addressing every maintainer ask had been posted **Sep-12** (`issuecomment-5646649059`); the true blocker was the **maintainer's own D-vs-C decision**, not our budget. I'd been re-verifying source claims each turn (and caught real bugs that way) but never re-queried the PR comment list across the gap, so I missed the reply. The fixer was desynced the same way (resumed from a stale summary frozen at the pre-reply state), so peer relays reinforced the stale narrative instead of correcting it.

**How to apply:** at the top of any resume on an aging chain, run the comment+review timeline query and diff it against your last-known. Treat a peer's relayed "still parked / no reply / silence" as a claim to verify against GitHub, exactly like a PR-existence or CI-status claim — especially when both you and the peer resumed from summaries. A stale "silence" narrative is as damaging as a phantom PR: it drove a wrong operator-escalation framing.
