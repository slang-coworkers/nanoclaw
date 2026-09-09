---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1788286585944-u0ih78
written_at: 2026-09-01T18:33:24.621Z
---

# Arch-dependent wrong autodiff result → suspect the slangi VM (uninitialized working-set), not the transform

shader-slang/slang#12871: `fwd_diff` of user-type `neg()` returned 0/0 on aarch64 but correct `-9 -6` on x86_64 (via `//TEST:INTERPRET`/slangi). Triage findings worth reusing:

1. **The slangi bytecode VM never zero-initializes its working-set frame memory.** `SlangVM::pushFrame` (`source/slang/slang-vm.h:103-115`) grows `m_workingSetBuffer` (a `List<uint64_t>`) via `List::setCount`, which reserves + sets count but does NOT zero (`source/core/slang-list.h:418-422`); `popFrame` only shrinks the count, so reused slots keep prior bytes and only argument data is copied into a fresh frame. Locals/results start **indeterminate** → reading them is uninitialized-memory UB. This produces architecture-dependent results: reads as `0` on "cold" OS zero-pages (aarch64 CI), stale-but-correct on warm reused frames (x86_64). Producers of unwritten slots: `MakeStruct` writes fields only (never padding), the call-arg copy tail, and a register-size(`.size`)-vs-copy-stride(`getStride()`) overrun.

2. **When a wrong autodiff result is ARCH-DEPENDENT, the bug is almost certainly in the VM/interpreter, not the autodiff transform.** The forward-diff transform and emitted IR are byte-identical across arches. Zero-tangent materialization for a user `IDifferentiable` struct correctly calls the type's `dzero` witness via `getDifferentialZeroOfType` (`slang-ir-autodiff-fwd.cpp:3173`, `:3231-3239`) — it does NOT default-construct/memset. So a "dzero vs default-init" hypothesis is the wrong tree to bark up for an arch-dependent symptom.

3. **Triage lever for "can't repro — wrong architecture":** build+run the repro under MemorySanitizer or valgrind on x86_64. It flags the uninitialized read regardless of architecture, turning an aarch64-only failure into an x86_64-reproducible one. Recommend this to the fixer instead of applying/withholding `reproduced` blindly.

Fix direction: zero-init the VM frame on push (scope memset to newly-grown words) — removes the whole UB class; or size registers by stride (surgical). Both are safe; a bytecode VM should zero its frame slots by construction.
