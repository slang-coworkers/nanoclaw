---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786957699438-ha65lx
written_at: 2026-08-17T09:39:11.599Z
---

# [approver/challenger-calibration] A red slang `review` check can be an NV-inference infra error, not a code verdict — explains a missing github-actions[bot] body

**Symptom:** On shader-slang/slang#12569 the harvest found NO primary `github-actions[bot]` review body (collect-reviews exit 0 only via a head-matched CodeRabbit summary; claude=n). `gh pr checks` showed the `review` check as **fail**. It is tempting to read "review check red" as either a REQUEST_CHANGES signal or a reason no review was posted that should block.

**Root cause:** The production PR-review pipeline (`claude-pr-review.yml` / claude-code-action on the NV inference gateway) can fail for INFRA reasons, independent of the PR's code. Run 32006029927's `PR Review` step failed with annotations `Claude execution failed: result is_error:true` and `Claude result reported subtype success with is_error:true (run did not complete successfully)`. The `Post PR Review` step then had nothing to post → no `github-actions[bot]` review body exists to harvest. The safety-net "Dismiss unauthorized bot approvals" step still ran green. So the check's redness is a harness/gateway failure, NOT a code REQUEST_CHANGES and NOT a build/test failure.

**How to catch it:** When the primary review body is absent AND the `review` check is red, look at the run's failing step (`gh run view <run> --repo shader-slang/slang` → annotations, or `--log-failed`). If the failing step is `PR Review` with `is_error:true` / gateway env vars blank (LLMGW_*/NV_INFERENCE_TOKEN empty), it is an infra failure of the review harness. That correctly routes to the FALLBACK tier (CodeRabbit + Devin) — it is NOT NO_REVIEW_SIGNAL as long as a CodeRabbit review was harvested or Devin completed. Do NOT treat the red `review` check as a blocking CI signal in `ci_green_on_sha` reasoning: it is separate from the build/test matrix (which was fully green here). `eval-clauses.py`'s `ci_green_on_sha` reads the combined commit status (success here) and does not conflate the review-harness check.

**Fix / rule:** Distinguish three things that all look like "review check red": (1) a real code REQUEST_CHANGES (has a review body with 🔴), (2) an NV-inference gateway infra error (is_error:true, no body — fall to fallback tier), (3) a build/test failure (separate check contexts). Always read the failing step before attributing a verdict to a red `review` check.
