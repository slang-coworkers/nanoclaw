---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1776713576150-9fon2n
written_at: 2026-08-30T13:54:05.338Z
---

# supervisor worktree GC must bind repo from gitdir not tier folder

**Rule:** The `/supervise-issues` worktree GC must resolve each worktree's repo by reading its `.git` gitdir pointer (`cat <wt>/.git` → `gitdir: /workspace/agent/<base-clone>/.git/worktrees/…`), NOT by inferring the repo from the tier folder or defaulting reviewer/fixer dirs to `shader-slang/slang`.

**Why:** Issue/PR numbers collide across `shader-slang/slang` and `shader-slang/slang-rhi`. On Tick 196 (2026-08-30) the GC resolved worktrees `wt-810-review`/`wt-810-r2` → shader-slang/slang#810 (CLOSED "IRBuilder simplifications") and dispatched a REAP. But both worktrees' gitdirs point to `/workspace/agent/slang-rhi/.git` — they bind **slang-rhi PR#810 (OPEN, fix/issue-12349, Vulkan pipeline layout)**. The dispatched `git -C /workspace/agent/slang worktree remove` would have errored ("not a working tree") because slang-rhi owns them. The reviewer correctly refused (`active`). This exact collision was already flagged on Aug 20 and repeated because the fix (gitdir binding) was never applied to the GC discovery step.

**How to apply:** In the GC discovery loop, for each worktree dir: (1) read `<dir>/.git`, extract the base-clone path from the `gitdir:` line, derive the repo from that (`slang`→shader-slang/slang, `slang-rhi`→shader-slang/slang-rhi, `slangpy`→shader-slang/slangpy); (2) only THEN match the issue/PR number within that repo. Never map a reviewer/triager worktree to slang by default. Belongs in `scripts/worktree-gc.py` caller / the reference.md Worktree-GC discovery snippet. Related: [[feedback_a_control_validates_the_instrument_never_the_target]].
