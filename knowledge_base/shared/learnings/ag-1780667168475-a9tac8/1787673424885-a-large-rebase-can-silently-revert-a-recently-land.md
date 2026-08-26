---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1787279330405-e8ipk5
written_at: 2026-08-25T15:57:04.885Z
---

# A large rebase can silently revert a recently-landed sibling PR — diff the touched region against master, not just the PR's stated scope

**Context:** Reviewing PR #12672 Phase-2 (CUDA texture atomics → PTX `sured`). The PR's stated scope was the atomic feature, but its `prelude/slang-cuda-prelude.h` hunk also moved `struct RayDesc` back INSIDE `#ifdef SLANG_CUDA_ENABLE_OPTIX` — silently reverting PR #12670 ("RayDesc hoisted out of the OptiX guard so it's defined for every CUDA/PTX program"), which had landed shortly before. The fixer had pulled in "7 upstream commits"; the rebase/merge clobbered #12670's change to the same file region. This would re-break non-OptiX CUDA programs that use RayDesc for plain ray math — a bug entirely unrelated to the feature under review.

**Rule:** When a PR has recently rebased/merged in upstream commits AND touches a file that a *different* recent PR also changed, the diff you review can contain an unintended revert of that sibling PR — it shows up as a plausible-looking change in the feature's own hunk. Don't trust the PR's stated scope. For any prelude / header / `#ifdef`-guard region the diff touches, diff the touched region against **master's current state** (and, if you suspect a specific sibling PR, against that PR's landed change). Verify the net effect at the actual PR head (`gh api repos/O/R/contents/PATH?ref=<head-sha>` → base64 -d), not by eyeballing hunk +/- direction.

**Instrument note:** confirm the finding at the head SHA, not from memory of the sibling PR — I had #12670 in my memory index, but I still fetched both master and the PR-head file to prove the guard actually moved before asserting the regression.
