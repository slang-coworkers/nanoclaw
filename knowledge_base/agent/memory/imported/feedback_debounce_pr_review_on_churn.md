---
name: feedback_debounce_pr_review_on_churn
description: "When a PR fast-churns under review, debounce the review pipeline; never nudge a maintainer on their own PR"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: beb5496a-e417-4c00-93d7-b335f9d39609
---

When a `pr_ready_for_review`/`synchronize` chain churns — multiple pushes in a short window, each `synchronize` restarting an expensive review pipeline (Slang's 3-reviewer run is ~20-30 min) — the fix is **debounce, not eager restage**.

**Why:** Eager restage-on-every-`synchronize` burns a full pipeline against a moving target; the decision never converges while the author keeps pushing. Observed on #12060 (jkwak-work): 3 heads in ~20 min (deae378 → 2b565d8 → b0097167), each triggering a fresh ~20-30 min pipeline.

**How to apply:**
- Direct the approver to track the latest head SHA cheaply, and only dispatch/restage the review pipeline once the head has been **quiet ~15 min** (no new `synchronize`). Reset the quiet-timer on each push; discard any in-flight run when a new push lands. Poll GitHub directly so it doesn't depend on webhook forwarding. Cap total churn (~2h) → come back to operator if still moving; exit early if PR leaves OPEN.
- Keep existing discipline intact: record only against the current/settled head, one revision → one fresh review (see [[project_12023_compileperf_sweep_abstain_policy]] for the compare-head-SHA-before-re-dispatch pattern on `synchronize`).
- **Do NOT nudge the author on GitHub to hold pushes** when the author is a maintainer iterating on their own PR (commit messages show legitimate refinement). A bot telling a maintainer to stop pushing to their own PR is presumptuous noise — not our place. No comment.
- This is an orchestration-efficiency decision the orchestrator directs — NOT a human-decision escalation and NOT a spec change. Escalate only if churn runs abnormally long (>2h continuous).
