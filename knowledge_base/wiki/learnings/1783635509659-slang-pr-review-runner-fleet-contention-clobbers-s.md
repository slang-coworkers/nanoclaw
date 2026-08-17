---
title: "slang-pr-review-runner fleet contention clobbers shared checkout staging"
type: learning
topic: slang-compiler
source: learnings/1783635509659-slang-pr-review-runner-fleet-contention-clobbers-s.md
---

# slang-pr-review-runner fleet contention clobbers shared checkout staging

**Symptom:** Running `/slang-pr-review` for PR X, but the run dir under `slang-pr-review-runner/transcripts/` ends up with a `prompt.txt`/`pr-diff.reference` for a *different* PR, plus an `INTEGRITY-FAIL.txt` (and no `final-review.md`). The runner's own integrity check (reviewed-files vs actual-PR-files) catches the mismatch.

**Root cause:** `scripts/repro.sh` (Reviewer A) does `cd "$REPO_ROOT"` into the single shared checkout `/workspace/agent/slang` and stages the diff into `$REPO_ROOT/tmp/{pr-diff.patch,pr-files.txt,context.json}`. When multiple review runs execute concurrently (a fleet of webhook-triggered reviews), they all clobber that same `tmp/` staging area and each other's `git checkout`, so a run silently reviews another PR's diff. Reviewer C (`run-clarity.sh`) is NOT affected — it self-isolates into its own `git worktree` derived from the shared repo (see run-clarity.sh ~L95-153).

**Fix:** Give Reviewer A a private `REPO_ROOT`. `compose-and-run.sh` honors `REPO_ROOT` env override (L16: `REPO_ROOT="${REPO_ROOT:-/workspace/agent/slang}"`). Create a dedicated `git worktree add --detach <iso> origin/master` (it inherits the installed REVIEW.md + `.claude/agents/` + clarity skills since install.sh writes them into the working tree and worktrees share them... actually verify: they were present in the fresh worktree here), then dispatch with `REPO_ROOT=<iso> bash scripts/compose-and-run.sh ...`. Reviewer C needs no override (self-isolates).

**Also:** `gh auth status` may print "token invalid" yet `gh pr view/diff` still work for reads — don't abort on the warning; test an actual read. And `gh pr diff --patch` emits a `git format-patch` series whose `From <sha>` header is the FIRST commit of the series, not the head — do not use it to detect head advancement; use `gh pr view --json headRefOid` + commit `committedDate`s instead.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1783635509659-slang-pr-review-runner-fleet-contention-clobbers-s.md`_
