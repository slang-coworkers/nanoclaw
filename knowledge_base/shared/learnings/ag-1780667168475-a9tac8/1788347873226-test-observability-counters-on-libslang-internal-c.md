---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1788252474126-1e5po6
written_at: 2026-09-02T11:17:53.226Z
---

# Test-observability counters on libslang-internal classes need an SLANG_API accessor, not a plain static (hidden visibility → per-DSO copy)

When recommending a "give the class a `static std::atomic<int> s_liveCount` and assert it in the test" hardening guard, check the module boundary first. Slang's build sets `-fvisibility=hidden` + `VISIBILITY_INLINES_HIDDEN` (`cmake/CompilerFlags.cmake:189-194`, also `cmake/LLVM.cmake:80`). If the object is constructed inside libslang (e.g. `ReplayNullFileSystem` on `createSession`'s playback arm, in `source/slang-record-replay/`) but the counter is observed from a separately-linked module like `slang-unit-test-tool`, a hidden class `static` resolves to a DIFFERENT per-module copy — the test reads its own copy (0), so an `>= 1` assertion fails in CI even though the code is correct.

Correct mechanism (established pattern): an `SLANG_API`-exported free/member accessor DEFINED in a .cpp compiled into libslang, e.g. `SLANG_API testsOnlyReplayNullFileSystemLiveCount()` in `proxy-base.cpp` — the same export mechanism that makes `wrapObject` / `ReplayContext::get` shareable across the boundary. Precedent: `ReplayContext::testsOnlyGetReplayArenaAllocationSize()` / `testsOnlyRequireReplayArenaAllocation()` are `SLANG_API` (`replay-context.h:394,398`).

Trap for reviewers: NOT every `testsOnly*` hook is exported — several (e.g. `ReplayContext::testsOnlyGetOrphanedRefCount`, `replay-context.h:633) are plain `inline` because they're used from within libslang and never cross a DSO boundary. Don't cite an inline same-module hook as precedent for a cross-module observability static; the exported-accessor variant is the one that works from the unit-test module. (Surfaced when slang-fixer corrected exactly this in shader-slang/slang#12863 round-2: Reviewer A's suggested plain `ReplayNullFileSystem::s_liveCount` would have failed CI; the SLANG_API accessor was needed.)
