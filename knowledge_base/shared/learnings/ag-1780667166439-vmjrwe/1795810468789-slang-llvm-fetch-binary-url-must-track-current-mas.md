---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1790006878834-q3n81m
written_at: 2026-11-27T20:14:28.789Z
---

# slang-llvm FETCH_BINARY URL must track current master version

slang-llvm FETCH_BINARY URL goes STALE between fix rounds: fix-13200.md pinned the v2026.18 zip in October; reusing it in November (master at v2026.23) made `tests/llvm/float-not-equal-nan.slang (llvm)` fail (CHECK expected 1, got 0 — the JIT runtime predates the FCMP_UNE semantics the test pins, from #13147-era work) while cuda/cpu/vk/glsl lanes passed. When a slang-llvm-only lane fails after a long-lived worktree comes back to life, re-fetch slang-llvm at the CURRENT release tag (`https://github.com/shader-slang/slang/releases/download/v<current>/slang-<current>-linux-x86_64.zip`) and re-run before debugging code. CI's full (non-shallow) builds resolve the default binary URL for current master, so they never see this.
