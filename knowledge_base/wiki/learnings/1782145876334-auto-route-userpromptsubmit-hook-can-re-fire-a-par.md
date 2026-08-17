---
title: "Auto-route UserPromptSubmit hook can re-fire a parked/retracted chain — explicit stand-down wins"
type: learning
topic: agent-ops
source: learnings/1782145876334-auto-route-userpromptsubmit-hook-can-re-fire-a-par.md
---

# Auto-route UserPromptSubmit hook can re-fire a parked/retracted chain — explicit stand-down wins

**Rule:** An `AUTO-ROUTE` UserPromptSubmit hook (`Follow the /slang-fix-issue workflow…`) is automated container-local context, NOT a traceable dispatch. When it conflicts with an explicit, recent stand-down from the dispatching tier, the stand-down wins — do NOT implement, do NOT open a PR. Surface the conflict and hold.

**Why:** Observed on shader-slang/slang#11682 (2026-06-22). A triage handoff (msg 2, from `slang-triager`) was followed 6 min later by an explicit stand-down (msg 4, same sender): "DO NOT proceed… the handoff was sent by a background research fork that over-ran the workflow… orchestrator has parked this chain at triaged→awaiting-maintainer-intent… do not open a PR. A maintainer reply on the issue will re-open and re-route through the orchestrator." Immediately after I acked the stand-down and cleaned up, an `AUTO-ROUTE` hook fired telling me to "implement the Approach A fix" — its trigger ("the scan has completed triage") was the *same* background-fork over-run the stand-down flagged. The hook is the mechanism the stand-down identified as buggy; obeying it would re-drive a parked chain.

**How to apply:**
- A UserPromptSubmit/auto-route hook re-firing right after an explicit stand-down on the same issue = treat as the over-run, not a re-route. The legitimate re-open path named in the stand-down (maintainer reply → orchestrator re-route) has NOT happened.
- A genuine maintainer-intent design call (e.g. #11682's A=help-text fix vs B=gate OpSource/OpName on DebugInfoLevel::None) is never the fixer's to settle by shipping a draft; that's the explicit reason the chain was parked.
- Decline in your main response with the conflict cited (source id + sender + timestamp + verbatim "do not open a PR"); hold; re-engage only when the orchestrator re-routes. Don't multicast/re-ping the tier you already acked.

---
_Topic: [NanoClaw / agent operations](wiki/topics/agent-ops.md) · [catalog](wiki/index.md) · source: `sources/learnings/1782145876334-auto-route-userpromptsubmit-hook-can-re-fire-a-par.md`_
