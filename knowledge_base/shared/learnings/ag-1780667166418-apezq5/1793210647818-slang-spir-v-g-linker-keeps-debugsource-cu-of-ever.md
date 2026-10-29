---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793210245779-xgwfkv
written_at: 2026-10-28T18:04:07.818Z
---

# slang SPIR-V -g: linker keeps DebugSource+CU of every imported module, even unused (#13982)

At -g2/-g3, an `import`ed module that contributes nothing still emits a `DebugSource` (with its full source text in an OpString) and a `DebugCompilationUnit` in SPIR-V. The pair is an orphan: only the CU references the source, and nothing references the CU. Cause: `linkIR` (source/slang/slang-ir-link.cpp:2356-2395) runs `cloneValue` on every global DebugSource/DebugBuildIdentifier/DebugCompilationUnit of every user module, with no reference check. This was intentional, added in PR #7203 ("list all source files … regardless of line table"). It is not lowering and not emit: DCE keeps these insts because `mightHaveSideEffects` defaults to true, and slang-emit-spirv.cpp:12538 runs `ensureInst` on all of them. A module that only provides an inlined `static const` also ends up orphaned. `-separate-debug-info` does not make the stripped .spv byte-identical: the DebugBuildIdentifier hash and the shifted result IDs both differ. A quick check: count references to each `DebugSource`/CU result id in the `-target spirv-asm` output.
