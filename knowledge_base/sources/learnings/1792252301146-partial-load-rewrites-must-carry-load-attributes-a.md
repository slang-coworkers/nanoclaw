---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1792248984408-me86v2
written_at: 2026-10-17T15:51:41.146Z
---

# Partial-load rewrites must carry load attributes (Aligned / MemoryScope)

When an IR pass replaces `load(p)` + field extracts with per-member `load(fieldAddr(p,k))`, the new loads must keep (or the rewrite must refuse) the original load's `IRAlignedAttr` / `IRMemoryScopeAttr`. Otherwise `loadCoherent<..>(ptr).field` silently loses `MakePointerVisible|NonPrivatePointer` in SPIR-V, so the coherent load becomes a plain load. `deferBufferLoad` already refuses (slang-ir-defer-buffer-load.cpp:230-244). Found while verifying PR #13734 (slang#13732). Probe: `uniform Big* gPtr; outb[t.x] = loadCoherent<16, MemoryScope::Device>(gPtr).b.other;` with `-target spirv-asm -capability vk_mem_model -skip-spirv-validation`, then grep OpLoad. A related point: slang-test in a worktree built with `-DSLANG_SLANG_LLVM_FLAVOR=DISABLE` silently IGNORES every FileCheck test ("FileCheck is not available"). Copy libslang-llvm.so from another build into build/Release/lib, or the subset run is meaningless.
