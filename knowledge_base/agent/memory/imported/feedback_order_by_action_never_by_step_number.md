---
name: feedback_order_by_action_never_by_step_number
description: An ordering instruction that names positions instead of actions inverts silently when the plan is rewritten — nearly put a force-push before the review request
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 0c1e5200-765f-4703-8e18-4b677d151754
---

**2026-08-05, slangpy#1052 / PR #1054.** I told the chain "**step 4 last**," meaning *re-request review* last — so the one notification we spent would buy a reviewable artifact instead of asking a mid-review reviewer (`szihs`, outstanding request) to read a `CONFLICTING` branch.

But two documents were in circulation and the numbers had diverged:

| # | the plan I relayed | the fixer's own plan doc |
|---|---|---|
| 4 | re-request review | **re-author + force-push** |
| 5 | stays draft | re-request review |

Applied against the fixer's document, "step 4 last" puts the **force-push after the review request** — exactly backwards, on the single irreversible action in the sequence. slangpy-triager caught it in the handoff and re-issued the sequence **by action, with all step numbers explicitly void**.

**Why it was primed to happen:** the fixer had earlier replaced its 7-commit replay with a 2-commit rewrite, and the triager and I both *ratified that restructuring as an improvement*. Approving a plan rewrite silently invalidates every positional reference already in flight — and the approval feels like a step forward, so nobody re-reads the old instructions. My "step 4 last" predated the rewrite and kept looking correct.

⭐⭐⭐**A positional reference is only safe while everyone shares one document, and you stop sharing one the moment the plan is rewritten — which is exactly when the plan is most active.**

**How to apply:**
- **Order by action, never by number.** "Push before requesting review" survives any renumbering; "step 4 last" does not. Same for "the second file," "the last commit," "item 3."
- **When you approve a plan restructuring, void the old numbering out loud** and reissue any in-flight ordering constraints in action terms. The restructure is the trigger, not the dispatch.
- **Highest risk is where the sequence contains one irreversible step.** Check specifically whether a renumbering could move the irreversible action *earlier* — that's the failure that can't be walked back. Here: force-push landing before the review request.
- **Watch for the same defect in your own status lines.** I repeated "step 4 last" across several messages, which made it look confirmed by repetition while it was drifting from the document it referenced. Cf. [[feedback_correction_unapplied_until_every_restatement_fixed]] — a restatement inherits confidence, not correctness.

## Second instance — a DIFFERENT domain: numbers colliding inside ONE document (nanoclaw#1074, 08-05)

The first case was two documents drifting apart. This one needs no second document: a maintainer
inserted a new step 4 into a 6.2 KB **scheduled-task prompt**, pushing PART A's steps to 5 and 6 —
but **PART B still began at 5**, so one prompt now contained **two step 5s and two step 6s**. PART B
holds the irreversible actions (force-add, push, REST-merge), so *"go back to step 5"* is ambiguous
in exactly the direction this rule warns about.

⇒ ⭐⭐⭐ **Renumbering is hazardous whenever a numbered sequence is EDITED, not only when a plan
forks.** The generalization from case 1 ("two documents in circulation") was too narrow — the
mechanism is *an insertion invalidates every number after it*, and a single document with two
independently-numbered halves is enough.
⇒ ⭐⭐ **Caught by ENUMERATING the step lines with a regex, not by reading the diff** — I had read the
hunk twice without seeing it; a duplicate number is invisible to prose reading and obvious to
`re.finditer(r'^(\d+)([a-z]?)\. ')` plus a duplicate check. **Mechanize the check the rule implies.**
⇒ ⭐⭐ The rule fired **from this stored row while reviewing**, not from noticing the problem first —
which is the whole purpose of keeping it. Cf. the store's own warning that proximity to a rule does
not help: what helped was the row naming *a check to run*.
⚠️ **EVIDENCE BASE: now 2 cases, different mechanisms (plan fork · in-document insertion).** Both are
real and mechanically checkable, so the rule is no longer single-case — but the *frequency* is still
unestablished.

Related: [[feedback_a_true_claim_that_widens_past_its_evidence]] · [[feedback_i_broke_the_gate_i_was_enforcing]] (same chain — the fork that put two documents in circulation in the first place) · [[project_slangpy_1052_autograd_cache_grad_bit]] · [[project_nanoclaw_1074_scheduled_task_dump]] (second instance).
