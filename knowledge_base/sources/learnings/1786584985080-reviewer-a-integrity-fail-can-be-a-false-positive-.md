---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1786582695406-fp047r
written_at: 2026-08-13T01:36:25.080Z
---

# Reviewer-A INTEGRITY-FAIL can be a false positive from a CONCURRENT PR review on the shared checkout

**What:** `slang-pr-review-runner`'s `compose-and-run.sh` post-run guard checks diff integrity by re-reading `$REPO_ROOT/tmp/pr-diff.patch` (a SHARED, non-run-namespaced file in `/workspace/agent/slang/tmp/`) and comparing its `+++ b/` file set to the live `gh pr view <PR> --json files`. If a *different* PR review ran concurrently (or recently) on the same checkout, that shared file holds the OTHER PR's diff → guard raises `INTEGRITY-FAIL: reviewed diff != PR N files` even though the review is correct.

**Observed (2026-08-13, #12506):** guard reported reviewed files as PR #12493's (`tests/bugs/12493-*`, `core.meta.slang`, `glsl.meta.slang`) while `tmp/` also held 12508/12509/12514 artifacts — several reviews sharing one checkout. The review itself was 100% about #12506.

**How to adjudicate (positive binding, don't assert from prose):**
1. `sha256sum <run_dir>/pr-diff.reference` — this is the run's OWN captured `gh pr diff <PR>` at start. Compare to the `diff sha256 …` in `final-review.md`'s footer. Match ⇒ the review's declared diff IS the target PR.
2. `gh pr view <PR> --json files` ⇒ compare to `final-review.md`'s Changes Overview file list.
3. Grep `<run_dir>/stream.jsonl` for target fingerprints (diagnostic codes, symbols, filenames) — should saturate; the wrong-PR fingerprints should appear only as the model READING the stale file then rejecting it.
4. `summarize.py <run_dir>` — confirm drift==0 and subagents produced substantive per-PR reviews.

**Bonus:** REVIEW.md Step 1 ("Verify the pre-staged PR diff") makes the inner model self-correct: two subagents refused with "Cannot Review: Staged Diff Does not match", then the model regenerated an ISOLATED `tmp/pr12506iso-diff.patch` (sha256 identical to the real diff) and re-dispatched the 5 real reviewers against it. So a spurious INTEGRITY-FAIL often coincides with a *correct* review.

**Prevention:** avoid running multiple `compose-and-run.sh` reviews against the same `/workspace/agent/slang` checkout simultaneously, OR treat INTEGRITY-FAIL as advisory and always run the sha256-match check before believing it. Companion to the existing "INTEGRITY-FAIL dismissal hazard" learning — that one warns NOT to dismiss reflexively; this one gives the concrete concurrent-review cause + the positive-binding proof procedure.
