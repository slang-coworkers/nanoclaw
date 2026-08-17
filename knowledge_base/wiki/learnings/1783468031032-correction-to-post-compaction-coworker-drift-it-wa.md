---
title: "CORRECTION to 'post-compaction coworker drift' — it was a real authorization on an invisible edge, not drift; verify the external artifact before concluding 'invented'"
type: learning
topic: verification
source: learnings/1783468031032-correction-to-post-compaction-coworker-drift-it-wa.md
---

# CORRECTION to "post-compaction coworker drift" — it was a real authorization on an invisible edge, not drift; verify the external artifact before concluding "invented"

**This supersedes the earlier same-session learning titled "Post-compaction coworker drift: verify against the canonical thread and halt before any external artifact" (slang#11917, 2026-07-07).** That note was filed mid-incident and its DIAGNOSIS turned out wrong. The actionable "halt before the artifact" rule survives; the "it was hallucination/drift" framing does NOT. Corrected account:

**What actually happened.** A fixer coworker (post 868k-token compaction) prepped a draft PR citing an authorization ("parent said proceed", pdeayton "#1 worklist / #2 early-scan") that matched NOTHING in the triager's dispatch record. It looked exactly like post-compaction hallucination. The triager issued a hard STOP. But on verification: the authorization was **REAL** — the orchestrator had dispatched that follow-up (`legalizeMatrixTypes` optimization) **directly on the Main↔fixer edge, bypassing the triager**, on the issue author's explicit GitHub request (a real PR comment carrying exactly the "#1/#2" framing the fixer cited). The fixer was NOT drifting; it acted on a dispatch the triager structurally could not see. The STOP was correct for a *different* pair of un-dispatched passes, but over-extended onto the legitimately-authorized one.

**The real lesson: a parallel/invisible dispatch edge is indistinguishable from hallucination from the dispatcher's seat.** When a coworker cites an authorization you have no record of, "it invented this" and "someone authorized it on an edge I can't see" look identical from your side. Do NOT resolve that ambiguity by presuming invention.

**Corrected rule:**
1. **Halt before the artifact, always** — cheap and correct under either hypothesis. Nothing reached GitHub, which is the win. (This part of the original was right.)
2. **Then VERIFY against external ground truth before calling it invented** — check the actual GitHub issue/PR for the cited request, and ask for the exact dispatching message-id. Here one `gh api` on the PR would have shown the issue-author's comment existed and said exactly what the fixer claimed — BEFORE framing it as drift.
3. **Reference work by explicit name, never "#1/#2" shorthand** — that shorthand is exactly what let the triager conflate the authorized pass with the un-authorized pair.
4. **Escalate to reconcile ("did you authorize this on another edge?"), not to accuse.**

**Root cause + fix:** a parallel authorization channel (parent → fixer both directly and via triager). Structural fix: **single-source dispatch** — all authorizations for a chain route through the one coworker holding that chain's dispatch edge; no parallel direct channel. An invisible edge keeps manufacturing "phantom hallucination" incidents until closed.

**On the post-compaction angle:** drift IS a real failure mode and a hold is only lifted by explicit new authorization through the dispatcher — but "it just compacted" is not evidence that a specific cited authorization is fake. Both coworkers behaved correctly here (fixer surfaced instead of self-resolving; held on the safe side).

---
_Topic: [Verification & evidence discipline](wiki/topics/verification.md) · [catalog](wiki/index.md) · source: `sources/learnings/1783468031032-correction-to-post-compaction-coworker-drift-it-wa.md`_
