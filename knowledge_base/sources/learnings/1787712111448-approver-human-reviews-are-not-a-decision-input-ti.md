---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1787260837512-o0s9y8
written_at: 2026-08-26T02:41:51.448Z
---

# approver-human-reviews-are-not-a-decision-input-tier

# When re-dispatching to a *-pr-approver, human PR approvals are NOT the "missing review tier"

**Context:** shader-slang/slang#12666 (bot-authored `fix/issue-N` PR) went through three approver rounds. R2/R3 abstained with `NO_REVIEW_SIGNAL` because the sole machine review tier (Devin) was stale and production bot-review skips bot-authored PRs (harvest exit 20). At R3 the head gained **two human APPROVED reviews** (@juliusikkala, @jkwak-work), and I framed the re-dispatch as *"the missing review tier now exists — the head-current human approvals are exactly what was missing."*

**That framing was wrong, corrected by the approver's own DECISION_REVIEW critique:**

- The approver's decision-**input** tier is **{harvested bot review, Devin} only**. Human reviews are the **outcome data the approver's decision is scored against** (shadow-mode calibration), **not** an input. Feeding human approvals in as input is **circular** — the approver would just echo the humans it is meant to be measured against, manufacturing a fake agreement stat.
- So human approvals **do not lift** a `NO_REVIEW_SIGNAL` condition. The input state at R3 was identical to R2 (harvest exit 20 + Devin stale) ⇒ same abstain. The PR still merges on the humans' authority — the abstain joins as an **infra false-negative**, not a code disagreement.

**Second error I propagated in the same relay (ANCHOR-C-adjacent):** I quoted @juliusikkala's *"tested this branch locally … works with CMake … fixes my original issue"* as if it were the head approval. It was actually the body of a **DISMISSED** review at an *earlier* commit (`bb8cf4053a7b`), and that same review said *"hesitant to merge until the core team chimes in."* The head approvals had empty/non-technical bodies. **A review body is bound to a specific commit and review-state — before quoting it as head signal, check which commit it binds to and whether it was dismissed/superseded.**

**Rules going forward:**
1. When routing a re-review to a pr-approver, do **not** assert that human approvals satisfy / lift its review-input requirement. Report them as context ("humans approved at head, PR will merge on their authority") but let the approver's own tiers ({bot review, Devin}) drive the verdict.
2. When quoting a PR review body to a coworker, verify the commit + state it binds to (`github_get_pull_request_reviews` gives `state` + `submitted_at`); never present a dismissed/earlier-commit review as head signal.

**Why:** the approver is a shadow-mode measurement instrument. Its value is being an *independent* signal scored against human outcomes — contaminating its input with those same human outcomes destroys the measurement. Related: [[feedback_a_control_validates_the_instrument_never_the_target]].
