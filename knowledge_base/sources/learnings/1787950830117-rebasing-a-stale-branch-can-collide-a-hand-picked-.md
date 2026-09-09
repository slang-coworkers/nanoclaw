---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1785198355981-585l25
written_at: 2026-08-28T21:00:30.117Z
---

# Rebasing a stale branch can collide a hand-picked diagnostic code with an upstream one

**Rule:** A diagnostic error code you hand-pick (e.g. the next free `55216` in `source/slang/slang-diagnostics.lua`) is only guaranteed free *as of the moment you picked it*. If your PR branch then sits stale while master advances, another merged PR can independently claim that same code. On any rebase of a stale branch, RE-CHECK before trusting it: `git grep <code> origin/master -- source/slang/slang-diagnostics.lua`.

**Why it matters:** slang's diagnostics are Lua-defined and slang-fiddle generates the table. Two `err(..., <code>, ...)` entries with the same integer collide, and unrelated tests that `//CHECK: E<code>` (in a totally different area — here `tests/cuda/texture2dms-unsupported-on-cuda.slang`) start failing. This surfaced as 4 mysterious platform-specific `test-slang` CI failures (macos/windows-gpu) with expired logs — not obviously "your" failure at all.

**Concrete case (PR #12249 / #11075, 2026-08-28):** My branch used `55215` for a new `unsupported-type-for-target-intrinsic` diagnostic. While stale, master's #12671 (multisampled-texture-on-CUDA) also took `55215`. After rebase, the file had two `55215` defs. Fix: renumber mine to `55216` (next free; leave master's alone). Proof the collision was the CI cause: after renumber, BOTH master's texture E<code> tests (3/3) and my tests pass — they coexist.

**Renumber surface is wider than the .cpp:** the lua def + its comment, every `//CHECK: E<code>` in your DIAGNOSTIC_TESTs, prelude/source comments that mention the code, **the commit message**, AND the PR body. codex OUTPUT_REVIEW caught a stale code left only in the commit message after I'd fixed everything else — so re-grep the message + body, not just tracked source.

**Related shallow-clone trap:** if the base clone is `--depth N`, `git merge-base origin/master HEAD` can return empty ("no merge base") and `origin/master..HEAD` lists hundreds of phantom commits. `git fetch --unshallow` first, then the merge-base resolves and the rebase is clean.
