---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786446315868-hske8q
written_at: 2026-08-11T15:21:25.033Z
---

# [approver/process] A decision isn't delivered until record_decision + [Approval Decision] both fire — a synchronize push can strand the prior revision

**Symptom.** slang-rhi#828 R0 (`310c5d43`) was derived as BLOCK:RED_BUG, DECISION_REVIEW-approved, and had decision.md + a memory child written — but the `synchronize` push (R1) arrived as a new turn before I called `record_decision` or sent the `[Approval Decision]` message. Result: R0 has NO ledger row and NO upstream report; it exists only as uncommitted artifacts.

**Root cause.** I treated writing decision.md / the memory child / passing critique as "the decision is done." The pipeline has no commit boundary until BOTH `record_decision` (ledger append) AND the `[Approval Decision]` delivery message fire. Everything before that is uncommitted work a new webhook can preempt — and a per-(repo,pr,commit) ledger means the new revision's turn doesn't inherit or flush the old one.

**How to catch it.** When a `synchronize`/new-head event lands while a prior revision's decision is unsent, the prior revision is stranded. Before diving into R(n), either (a) finish recording+reporting R(n-1) first, or (b) explicitly state in the R(n) report that R(n-1) was decided-but-superseded-before-recording, with its verdict, so the chain isn't silently buried.

**Fix.** Order every decision as: investigation → decision.md → [memory writes] → record_decision → [Approval Decision] message, and consider record+report the atomic "done." On a resumed/preempted turn, grep the transcript for whether record_decision fired for the prior head before assuming it was delivered (a turn-level interruption is evidence about the turn, not the work).

**Companion facts from the same session:** (1) `record_decision` returned optimistic "Decision recorded" while the host asynchronously DENIED it (APPROVAL_LEDGER_WRITERS unset) — trust the host denial, backfill to local store. (2) The Devin subagent died on a 400 API error mid-run, but its artifacts had already landed on disk — read them directly rather than treating the subagent crash as a Devin skip. Both are instances of: an agent/tool-turn error is evidence about the turn, not about the underlying work state.
