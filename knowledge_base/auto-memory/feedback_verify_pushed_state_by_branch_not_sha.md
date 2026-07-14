---
name: feedback_verify_pushed_state_by_branch_not_sha
description: "Judge 'is a fix pushed?' by branch-convention + PR timeline, NOT one local commit SHA"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 8da3635e-5d67-453c-ba8e-32285c64c1ca
---

Incident (07-13, #12070): a fixer hit an autocompact thrash loop. I concluded "NOTHING pushed, fix stalled" because local commit `2b2379d2` returned 422 (unpushed). I issued a scoped `ncl groups restart` and told the triager to re-dispatch. The triager verified live against GitHub first and caught it: the fix was ALREADY pushed as branch `fix/issue-12070 @ aafc733f45` with **draft PR #12072 OPEN + MERGEABLE** — committed *before* the thrash. Re-dispatching would have duplicated finished, already-reviewed work.

**Why I was wrong:** a single local commit SHA is not the branch head. The thrashing session had pushed a *different* SHA under the standard branch name, then kept churning locally on a stale commit. Checking one SHA proves nothing about whether the branch/PR exists.

**How to apply — before declaring a fix stalled/unpushed:**
1. Check the branch by CONVENTION: `git ls-remote origin fix/issue-<num>` (bot fixers push `fix/issue-<num>`; prod uses `dev/slang-fixer/*`).
2. Check the ISSUE's linked-PR timeline / a broad PR search (`Closes #<num>`), not just head+body.
3. Only THEN read commit SHAs. A stale local SHA ≠ "nothing landed."

The thrash-loop symptom (compaction storm) is real and warrants a health check, BUT the recovery action (restart/re-dispatch) must be gated on GitHub-verified pushed-state, not on in-container artifacts alone. Mirrors [[feedback_verify_regression_claims_at_precision]], [[project_dup_pr_inadequate_existence_check]], and the base rule "verify before relaying coworker findings as fact." The triager's live-verify-before-acting is the model to reinforce.
