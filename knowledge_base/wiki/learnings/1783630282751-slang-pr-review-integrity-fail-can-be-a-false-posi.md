---
title: "slang-pr-review: INTEGRITY-FAIL can be a false positive from concurrent-run shared tmp/ contention"
type: learning
topic: slang-compiler
source: learnings/1783630282751-slang-pr-review-integrity-fail-can-be-a-false-posi.md
---

# slang-pr-review: INTEGRITY-FAIL can be a false positive from concurrent-run shared tmp/ contention

**What:** `slang-pr-review-runner`'s `compose-and-run.sh` post-run guard can emit `INTEGRITY-FAIL` ("reviewed diff != PR N files — review targeted the WRONG diff") even when the review is correct, if a *second* PR-review run executes concurrently. The staged inputs live in a **shared** path in the checkout — `/workspace/agent/slang/tmp/{pr-diff.patch,pr-files.txt,context.json}` — so a parallel run for a different PR overwrites `tmp/pr-files.txt`/`context.json` between your run's dispatch and its own post-run check. The guard then compares the *other* PR's clobbered file list against your live PR's files and cries wolf.

**Observed (PR #11954, 2026-07-09):** marker fired claiming the reviewer looked at `slang-check-constraint.cpp` + an autodiff test; those were PR **#12029**'s files (its `context.json` was sitting in the shared `tmp/`). The #11954 review was actually correct.

**How to tell false-positive from real (three independent checks — all must agree):**
1. `run_dir_A/pr-diff.reference` is the **per-run immutable** copy staged at dispatch (NOT the shared `tmp/`). `diff` its `+++ b/` file list against `gh pr diff <PR> --name-only`, and `sha256sum` it against `gh pr diff <PR> | sha256sum`. Match on both = your run reviewed the right diff. (The per-run `diff_hash` also appears verbatim in the clarity runner's run-dir name, e.g. `...-1a753697bed8-...`.)
2. Parse `stream.jsonl` tool_use inputs and count references to the *expected* PR's files vs the *clobbering* PR's files — should be many-vs-zero.
3. `summarize.py` drift line: "Non-COMMENT review submission attempts: 0".

**Why:** Recovering a good review beats re-running (2.5h wall, ~$24). The marker is a coarse heuristic against the shared `tmp/`; the per-run `pr-diff.reference` + `stream.jsonl` are the ground truth.

**How to apply:** On `INTEGRITY-FAIL`, don't auto-discard or auto-route. Run the three checks. If they confirm the correct diff was reviewed, set `reviewers_complete:true` as a **manual override** in RESULT_JSON with a `notes` field explaining the false positive, and flag it transparently in the upstream report + to the approver (their `commit_match` clause keys on `diff_hash`, so give them the verified hash). Reviewer A also self-notes this in `final-review.md` when it detects mid-run that `tmp/pr-diff.patch` was overwritten. Related: [[slang-11780-simplifyir-half-of-9808-perf-regressio]].

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1783630282751-slang-pr-review-integrity-fail-can-be-a-false-posi.md`_
