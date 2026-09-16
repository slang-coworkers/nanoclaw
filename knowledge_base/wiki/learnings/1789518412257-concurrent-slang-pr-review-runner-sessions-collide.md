---
title: "Concurrent slang-pr-review-runner sessions collide on tmp/pr-diff.patch → false-positive integrity guard (rc=1)"
type: learning
topic: slang-compiler
source: learnings/1789518412257-concurrent-slang-pr-review-runner-sessions-collide.md
---

# Concurrent slang-pr-review-runner sessions collide on tmp/pr-diff.patch → false-positive integrity guard (rc=1)

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1789515773207-5bkzub
written_at: 2026-09-16T00:26:52.257Z
---

# Concurrent slang-pr-review-runner sessions collide on tmp/pr-diff.patch → false-positive integrity guard (rc=1)

**Symptom:** `slang-pr-review-runner`'s `compose-and-run.sh` exits **rc=1** with an `INTEGRITY-FAIL.txt` in the run dir showing "reviewed" files that belong to a *completely different PR* than the one requested, while "actual PR files" are correct.

**Root cause:** Two `slang-pr-review-runner` (Reviewer A) sessions reviewing *different* PRs at the same time share the same checkout `/workspace/agent/slang` and both write the model's scratch diff to `$REPO_ROOT/tmp/pr-diff.patch`. One session's file clobbers the other's. The **post-run** integrity guard (compose-and-run.sh ~L188) compares that scratch file's file-list against the requested PR's file-list and trips on the foreign files. Reviewer C is immune (it isolates in its own `wt-clarity-*` git worktree); Reviewer B is immune (scrapes Devin).

**Why it's usually a FALSE positive:** the inner model's own subagents detect the pre-staged-diff mismatch, get stopped (visible as several `TaskStop` calls + "Pre-staged diff does not match" subagent error reports in the summarizer), and are relaunched against the correct `gh pr diff`. The `final-review.md` is then produced against the CORRECT diff even though the stale scratch file still trips the guard.

**How to confirm the review is valid despite rc=1 (do ALL of these before overriding):**
1. `final-review.md` footer records `reviewed: <sha> · diff sha256 <hash>` — the `<sha>` must equal the PR's real head (`gh pr view <N> --json headRefOid`).
2. That `diff sha256` must match `sha256sum <run_dir>/pr-diff.reference` (the runner's own recorded reference diff — this file is NOT the clobbered scratch file).
3. The findings must cite the requested PR's actual files.
4. `summarize.py` shows drift==0 (no non-COMMENT review submitted) and an authoritative verdict line.

If all four hold, the findings are valid; set `reviewers_complete: true` in the combined-review result block but **prominently document the rc=1 override with this evidence** in the verdict message — do not silently swallow it.

**Mitigation for the future:** pre-warm `git fetch origin master` on the shared checkout before dispatch (shrinks git-lock races between A and C), but the `tmp/pr-diff.patch` collision is inherent to two A-sessions sharing one checkout — the real fix would be per-run collision-proof scratch dirs in the skill (the model already tries to do this mid-run). Do NOT delete another session's `tmp/pr-diff.patch` to "fix" your guard — it may be in active use.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1789518412257-concurrent-slang-pr-review-runner-sessions-collide.md`_
