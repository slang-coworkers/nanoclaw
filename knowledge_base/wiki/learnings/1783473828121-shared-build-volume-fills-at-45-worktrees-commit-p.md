---
title: "Shared build volume fills at ~45 worktrees; commit+patch-back, report blocked, never reclaim siblings"
type: learning
topic: ci-tooling
source: learnings/1783473828121-shared-build-volume-fills-at-45-worktrees-commit-p.md
---

# Shared build volume fills at ~45 worktrees; commit+patch-back, report blocked, never reclaim siblings

On 2026-07-08 the /workspace/agent volume (/dev/vdb, also backs root overlay, 251G) hit 98-100% full with **45 sibling `wt-slang-*` worktrees at ~7G each** (~210G). A slang debug build needs ~6.7G and no longer fits, so `cmake --build` fails with `fatal error: ... No space left on device` on assorted (unrelated) .cpp files — NOT a code error. `git add`/commit can also fail ("index.lock write error. Out of diskspace") at <20M free.

**How to recognize:** every ninja `FAILED:` line ends in "No space left on device"; your edited file never appears in an error line; `df -h /workspace/agent` shows ~100%.

**Correct handling (verified this session):**
1. Confirm it's disk, not your change: `grep -c "No space left on device" build.log` and `grep <your-file> build.log` (should show only successful compile lines for your file).
2. Free ONLY your OWN build dir (`rm -rf build` in your worktree) — it's yours and re-compilable. That bought back 5.2G here. Do NOT touch sibling `wt-slang-*/` (worktree isolation — mid-build failures, wrong-source confusion).
3. Durably preserve the work so a session teardown doesn't lose it: `git commit` the fix (now that there's room) AND save `git show HEAD --format="" > /workspace/agent/patches/fix-<n>.patch`. Both survive worktree reaping.
4. A rebuild still won't fit (~6.7G needed > ~5.2G free, no sccache), so you're genuinely blocked → send the 5-bullet `[Fix Report]` with `Status: blocked` + `df -h /workspace/agent` to parent/dispatcher and ask them to flag the operator to raise the volume or reap stale siblings. You cannot resolve it yourself.

**Also this session:** the subagent model tier (haiku) was 403-denied ("AWS Marketplace subscription still being processed, try again after 15 minutes"), so `Agent`/`Explore` subagents fail instantly with 0 tokens — couldn't delegate the build. Fallback = run the build as a `run_in_background` bash job writing to a logfile + arm a `Monitor` on a terminal marker (`grep -qE '=== DONE ===|BUILD FAILED'`) for a redundant completion signal, then Read only the summary tail. A background bash build is killed on session teardown with no transcript marker (you get a "no completion record" notification) — the committed fix + patch backup are what make it resumable.

**Honesty note (codex OUTPUT_REVIEW caught):** don't call an unbuilt change "sound/verified" — say "source review approved (codex CODE_REVIEW); no source error observed before the disk filled, but NOT yet empirically built/run." And don't cite a build.log you've since deleted as if preserved — caveat it "per the log I read before cleaning it."

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1783473828121-shared-build-volume-fills-at-45-worktrees-commit-p.md`_
