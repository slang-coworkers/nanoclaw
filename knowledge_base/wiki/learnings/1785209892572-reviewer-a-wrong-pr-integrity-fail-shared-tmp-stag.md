---
title: "Reviewer A wrong-PR integrity fail: shared tmp/ staging collision between concurrent runs"
type: learning
topic: review-process
source: learnings/1785209892572-reviewer-a-wrong-pr-integrity-fail-shared-tmp-stag.md
---

# Reviewer A wrong-PR integrity fail: shared tmp/ staging collision between concurrent runs

**Symptom:** `slang-pr-review-runner` Reviewer A (compose-and-run.sh) exits WITHOUT `final-review.md`, leaving `INTEGRITY-FAIL.txt` in the run dir listing "reviewed: <files of a DIFFERENT PR>" vs "actual PR files: <the files you asked for>". The `pr-diff.reference` in the run dir is CORRECT (your PR); only what the inner reviewer consumed was wrong.

**Root cause:** compose-and-run.sh stages the diff into `$REPO_ROOT/tmp/{context.json,pr-diff.patch,pr-files.txt}` (default `REPO_ROOT=/workspace/agent/slang`) and at start-of-run does `rm -f tmp/{...}` then re-stages (repro.sh line ~84). When TWO review runs share the same `/workspace/agent/slang` checkout, the second run's re-stage CLOBBERS the first's `tmp/` mid-flight. The first reviewer then reads the second PR's staged diff and reviews the WRONG PR. Confirmed by comparing `tmp/context.json` (`"pr": <other>`) against your run dir's `pr-diff.reference` (`"pr": <yours>`). The integrity net (repro.sh ~line 188) catches the file-set mismatch and refuses to emit — so no wrong-PR review ever leaks. This is a race, not a code bug in the runner.

**Fix:** re-run Reviewer A in an ISOLATED git worktree so its `tmp/` can't be touched by a peer run:
```
cd /workspace/agent/slang
git worktree add --detach /workspace/agent/wt-<PR>-reviewerA HEAD   # HEAD must == the PR's base_sha
REPO_ROOT=/workspace/agent/wt-<PR>-reviewerA nohup bash <skill>/scripts/compose-and-run.sh --mode pr --pr <PR> --repo shader-slang/slang ...
```
REVIEW.md + `.claude/agents/` are git-TRACKED, so a worktree at base HEAD has them (no install.sh re-run needed). Name the worktree `wt-<num>-<tag>` so the supervisor GC reaps it. Reviewer C already isolates itself (`wt-clarity-*`); Reviewer B (Devin) is remote — neither is affected by this collision.

**Prevention idea (not yet implemented):** compose-and-run.sh could stage into a per-run temp dir or acquire a lock on `tmp/` rather than a fixed `$REPO_ROOT/tmp/`. Until then, if you dispatch reviews for multiple PRs concurrently, give each its own REPO_ROOT worktree from the start.

---
_Topic: [Review & process](wiki/topics/review-process.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785209892572-reviewer-a-wrong-pr-integrity-fail-shared-tmp-stag.md`_
