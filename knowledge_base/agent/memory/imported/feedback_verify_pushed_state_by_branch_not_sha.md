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

## Recurrence 2026-08-12 (#12394 / draft PR #12358) — a SPECIFIC-HEAD reading put INTO a downstream brief, twice in one chain

I checked #12358 at head `57a4d4171c`, found the macOS `brew install …` line still uncaveated, and **told `slang-fixer` in a dispatch: "I'll take the brew line — it belongs on a new issue."** That's a specific-head measurement escalated into an *instruction*. The triager re-derived at HEAD rather than inherit and caught it: head had moved to `d92491e49a` (pushed 08-11), where `:61` now carries *"These formulae are unpinned … rely on `--no-version-check`."* — **the exact gap I was about to file.** Provenance-confirmed on my own edge: caveat ABSENT at `57a4d4171c`, PRESENT at `d92491e49a`. Filing it would have sent the code owner (`jkiviluoto-nv`, just handed the issue by a human) chasing an already-closed gap.

⭐⭐⭐ **A commit SHA in a message to a peer is a claim that will be *acted on*, and it silently expires between my read and their action — on an OPEN draft PR the head moves without any signal to me.** Same asymmetry as [[feedback_an_instruction_to_edit_an_artifact_needs_the_artifact_read]]: my directive gets executed by someone who assumes I checked *now*, not 13 minutes and one force-push ago.

**How to apply — when a brief/dispatch references a PR's content:**
- Cite the PR by **number + "at current head"**, and have the recipient re-read at HEAD before acting — never pin a downstream action to a SHA I measured.
- If I *must* name a SHA (provenance, "the caveat landed between X and Y"), stamp it: *"at `<sha>`, verified `<time>` — re-check, an open PR moves."*
- **A near-identical earlier miss in THIS chain** (I told the triager the `17-18` line was context-only "confirmed by construction" from a head-pinned diff) is the tell: two head-pinned claims into one peer's brief means the class is live for me this session — slow down on the third.

⭐ The triager naming it *"the same head-moved-under-a-stored-reading lesson from last week's chain"* is the reusable frame: my facts were all TRUE (rewrite done, `Closes #12394`, cross-ref at 16:41Z); the only one that expired was the one bound to a *specific head* on a file that got another push. **True-at-a-SHA is not true-now for anything still open.** Related: [[feedback_a_freshness_reading_expires_the_moment_you_stop_looking]] · [[feedback_ci_checks_at_a_sha_expire_source_at_a_sha_does_not]] · [[feedback_a_claim_about_master_is_a_timestamp_not_a_version]].
