---
title: "approver: reviewer runs are session-teardown-fragile — a synchronize burst can cost whole review rounds (R3 of slang#12023 died with no doc)"
type: learning
topic: review-process
source: learnings/1783969636640-approver-reviewer-runs-are-session-teardown-fragil.md
---

# approver: reviewer runs are session-teardown-fragile — a synchronize burst can cost whole review rounds (R3 of slang#12023 died with no doc)

[approver/infra-abstain-adjacent] During the slang#12023 approval chain (4 revisions R1–R4 over 3 days), the reviewer coworker's in-flight A/C runs were killed at a session teardown **twice**, and once it cost an entire review round:

- **R1:** the reviewer's original Reviewer A + C runs were killed at a session teardown and left no surviving output; the head had also moved. Recovered by re-dispatching fresh against the new head — no round lost, just latency.
- **R3 (0a9f284):** Reviewer A's first attempt hit a permission-denial guard (inner CLI killed before any subagent dispatched — the known Reviewer-A runner-fragility pattern, see learning 1783620361461), and BOTH the A-retry (`pr-20260713T083649Z`) and Reviewer C's run were then killed at a session teardown before completing. A-retry left no final-review.md; C left only a 445B stub (below the 500B review-doc floor). **No valid R3 doc ever existed → R3 produced no approval decision and no ledger row.** It was cleanly superseded ~10.5h later by an R4 synchronize push, so nothing had to be unwound — but if R3 had been the *final* head, the PR would have sat with no decision until a human noticed.

**How to catch it / what to do (approver side):**
1. When a review is dispatched and the doc doesn't arrive within the reviewer's stated ETA + a margin, do NOT assume it's still running — check your inbox AND the per-PR workspace `review/` dir. Empty `review/` + last signal was a retry/guard-fail = the round likely died at teardown. Confirm with the reviewer rather than waiting indefinitely.
2. A stalled review round is NOT an ABSTAIN_INFRA you record — there's no PR-side pipeline artifact to name and (in a live chain) a newer head usually supersedes it. Only record an ABSTAIN_INFRA:NO_REVIEW_SIGNAL / REVIEW_DOC_MISSING if the stalled head is the *current* head and no fresh doc can be obtained. Otherwise report the stall to the parent (so runner-fragility is tracked) and re-run on the current head.
3. This is distinct from the diff_hash/tmp-race fragility (learning 1783620361461, 1783352556452) — that corrupts *what* was reviewed; this loses the review *entirely*. Both trace to the shared, non-isolated reviewer checkout + session lifecycle. The durable fix is reviewer-side (isolated per-PR checkout/worktree + teardown-resilient run persistence), but the approver must not silently wait on a dead round.

**Transferable rule:** on any long-lived per-revision approval chain, treat "review doc absent past ETA" as a probable dead round, not slow progress — verify and re-dispatch on the current head, and surface the stall upstream for fragility tracking.

---
_Topic: [Review & process](../topics/review-process.md) · [catalog](../index.md) · source: `sources/learnings/1783969636640-approver-reviewer-runs-are-session-teardown-fragil.md`_
