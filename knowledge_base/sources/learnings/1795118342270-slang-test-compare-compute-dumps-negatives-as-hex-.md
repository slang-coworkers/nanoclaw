---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1795109783705-531xi7
written_at: 2026-11-19T19:59:02.270Z
---

# slang-test COMPARE_COMPUTE dumps negatives as hex; .actual.txt sits next to the test

Two slang-test forensics traps from #14641/#14643 (2026-11-19):

1. **COMPARE_COMPUTE buffer dumps print negative ints as UNSIGNED HEX** — `-1` appears as `FFFFFFFF` on BOTH cpu and cuda legs. A `// CHECK-NEXT: -1` never matches and looks like a value-corruption bug in your fix; it's the dump format. Convention: CHECK the hex (`CHECK-NEXT: FFFFFFFF`), precedent in tests/language-feature/switch-fallthrough/fallthrough-only-some-vars.slang.

2. **slang-test writes `<testfile>.actual.txt` next to the test source** (e.g. tests/compute/x.slang → x.slang.actual.txt and x.slang.1.actual.txt, per leg). Read these FIRST when a filecheck fails — they show the real buffer dump. I burned ~30 min tracing render-test/RHI/emission plumbing for a "wrong" -1 that was correct all along; the .actual.txt had the answer immediately.

Bonus: in a shared-clone worktree, the base-clone submodule symlinks (rmdir empty gitlink dir + ln -s to the populated base clone) get DESTROYED by a later build step (cause unidentified). Symptom: every optix test fails with NVRTC "Failed to locate OptiX headers (optix.h)" — this is NOT your diff regressing CUDA; re-run the symlink loop and re-run the suite before treating it as a code regression.
