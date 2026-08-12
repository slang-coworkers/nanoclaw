---
title: "slang-pr-review: verify reviewer runs survived + cleared the guard before trusting output"
type: learning
topic: review-process
source: learnings/1783971373048-slang-pr-review-verify-reviewer-runs-survived-clea.md
---

# slang-pr-review: verify reviewer runs survived + cleared the guard before trusting output

When driving `/slang-pr-review` across multiple PR revisions (long-lived chain with an approver consuming each revision's doc), two failure modes recur and both silently look like "success":

**1. Background runs die at session teardown.** `compose-and-run.sh` / `run-clarity.sh` launched with `run_in_background` are killed when the Claude session tears down between turns. The task-notification then arrives as `status: stopped` ("No completion record… may have been running when the process exited"), and — critically — the transcript run_dir may be **deleted** or left with a sub-floor stub (e.g. a 445B `clarity-review.md`). Do NOT assume completion. Always: (a) locate the run_dir (persist its path to a stable file like `/workspace/agent/pr<N>-review/runA.path` right after dispatch so a teardown can't strand you), (b) check the deliverable exists and is ≥500B, (c) confirm it reviewed the *current* live head (the PR head often moves between dispatch and completion — re-check `gh api …/pulls/<N> --jq .head.sha`).

**2. Reviewer A can fail the review guard with exit 0.** The inner claude CLI sometimes terminates early (observed: a permission-denial on a compound `gh pr diff … ; echo …` Bash command) after announcing "I'll dispatch the reviewers…" but **before any Agent/Task subagent runs**. Result: a ~400B `final-review.md`, `0 bugs/0 gaps/0 questions`, and `Run state: success` — indistinguishable from a clean review unless you check. The runner prints `!!! REVIEW-GUARD FAIL: zero Task/Agent subagent dispatches` / `final review is <N> bytes (<500)` to its log. **Before trusting an A run, verify: `final-review.md` ≥500B, `grep -c '"name":"Agent"' stream.jsonl` ≥3 (the reviewers actually dispatched), and no `REVIEW-GUARD FAIL` in the bg log.** A 0/0/0 verdict from a run with zero subagent dispatches is a failed run, not a clean PR — re-dispatch it.

**Cross-check A and C reviewed the same diff:** A's `sha256sum pr-diff.reference` (short 12 chars) must equal C's `run-key.json` `bundle_hash`. Put that verified full sha256 in the combined doc's RESULT_JSON `diff_hash` so the approver can pin it to the head commit. Set `reviewers_complete: false` whenever Devin/B is skipped (no in-container Chrome — `DevToolsActivePort`/dbus launch failure, an infra gap not a PR fault) and state A✓/B✗skip/C✓ explicitly.

---
_Topic: [Review & process](../topics/review-process.md) · [catalog](../index.md) · source: `sources/learnings/1783971373048-slang-pr-review-verify-reviewer-runs-survived-clea.md`_
