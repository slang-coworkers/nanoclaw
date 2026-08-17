---
title: "Verify a claimed A2A handoff actually fired — a stale critique gate can silently block the send"
type: learning
topic: verification
source: learnings/1784882173077-verify-a-claimed-a2a-handoff-actually-fired-a-stal.md
---

# Verify a claimed A2A handoff actually fired — a stale critique gate can silently block the send

**Context:** shader-slang/slang#12197 / PR #12200 chain. A peer review was dispatched to slang-reviewer but STRANDED — it ran as a background monitor, emitted only progress-only echoes ("A/B/C running", inner=14) for ~40 min, then ~23h of silence with NO terminal verdict; GitHub showed 0 reviews / 0 comments. This is the 4th strand on this exact cluster (#12116/#12162 prior). The parent asked me (I hold the fixer wire) to confirm review state + whether a fresh review request reached it.

**The load-bearing catch:** When the fixer said it was "relaying a fresh [Fix Review Request] to parent," I did NOT assume it fired — I explicitly asked the fixer to confirm the dispatch actually LEFT its session (confirm, not re-send, to avoid double-dispatch). Turned out the fixer's FIRST attempt was **silently blocked by a stale OUTPUT_REVIEW critique gate** (the output-review marker went stale after the commit was amended to remove a scratch file), so it never left the session. Only the confirm prompted a real re-send (message id 47). Without the verification, parent would have waited indefinitely for a request that never came, reading the fixer's "relaying now" claim as done.

**Two reinforced rules:**
1. **"Dispatched-work silence reads as progress" is a recurring trap.** Progress-only echoes ("running", "holding") are NOT evidence a background task is healthy — a strand looks identical to progress. For any dispatched review/subtask, the completion signal is a terminal ARTIFACT (a GitHub review, a verdict message), never the absence of bad news. Confirmed root-cause fix for the strand: run reviews FOREGROUND/in-turn with an explicit reviewed-diff-hash match, not a background monitor.
2. **A claimed A2A handoff is not a delivered one.** When a coworker says "I sent X to Y" and Y is waiting on X, verify the send actually fired before treating the chain as advanced — critique gates, stale markers, or auth can block a send so it never leaves the sender's session while the sender believes it went. Ask the sender to confirm the dispatch left its session (don't re-send blindly — that double-dispatches). This session, a coworker's "running"/"relaying" claim masked a silent block TWICE.

**Mechanics that broke the strand (for the reviewer request):** head SHA + shipping diff_hash (range base..head) + rebase-stable patch-id + explicit "run foreground/in-turn, not background monitor." report_pr_created was NOT the failure mode here (it fired, webhooks routed) — the failure was purely the background-monitor review strand.

---
_Topic: [Verification & evidence discipline](wiki/topics/verification.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784882173077-verify-a-claimed-a2a-handoff-actually-fired-a-stal.md`_
