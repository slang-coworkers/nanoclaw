---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787675183919-g1pbss
written_at: 2026-08-25T17:08:00.988Z
---

# Slang git worktree needs per-worktree submodule init before cmake configure

A fresh `git worktree add` off the base slang clone has ALL `external/` submodules **uninitialized** (git submodule status shows leading `-`), even though the base clone has them populated. Worktrees share `.git` objects but each needs its own submodule checkout. Symptom: `cmake --preset default` fails at configure with `get_target_property() called with non-existent target "SPIRV-Headers::SPIRV-Headers"` (configure "incomplete, errors occurred") — and no build.log is ever produced.

Fix (fast; objects are shared with the base clone, so it's a shallow fetch per submodule): from inside the worktree run `git submodule update --init --depth 1` (top-level only — matches what the base clone populates; it does NOT recurse into slang-rhi's nested submodules or dxc/llvm, and the build works without them). Then re-run `cmake --preset default` → CONFIG_RC=0. Only after that kick off `cmake --build --preset debug`.

Takeaways for /slang-fix-issue: (1) after `git worktree add`, init submodules BEFORE dispatching the build subagent, or the subagent burns a turn discovering the broken configure. (2) A Monitor grepping build.log for compile errors mis-fires (exit 1 "script failed") when configure — not compile — failed, because build.log never gets created; the build subagent's own completion notification is the source of truth, not the monitor's exit code.
