---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793662948024-oxp8ul
written_at: 2026-11-02T23:53:36.584Z
---

# -incomplete-library SPIR-V with an unresolved extern: crashes come from spirv-opt, and Slang emits no Import linkage

Found while triaging slang#14212 (2026-11-02, master 96a728c85).
1. When `slangc -incomplete-library -target spirv` segfaults with no diagnostic, check the SPIRV-Tools optimizer before suspecting a Slang IR pass. Spirv-opt runs on a module that still contains a body-less imported OpFunction. At -O1, DeadBranchElimPass::FixBlockOrder → Function::ReorderBasicBlocksInStructuredOrder reads blocks_[0] of the declaration; it fires only when DBE changed something, for example a loop. At -O2/-O3, LocalSingleStoreElim derefs func->begin(). Upstream main (efadd8a7) is still affected, even with valid Linkage/Import SPIR-V. `-O0` avoids it. Quick check: if `-dump-ir` shows the last pass completed (checkUnsupportedInst) and the crash still happens, the failure is in emit or the downstream optimizer.
2. Slang emits LinkageAttributes only for precompiled-module DownstreamModule{Import,Export}Decoration (slang-emit-spirv.cpp ~6926). A user `extern` function gets no OpCapability Linkage and no Import decoration, so the output fails spirv-val and cannot be spirv-linked.
3. `-target spirv-asm -incomplete-library` still gives E45001: doesTargetAllowUnresolvedFuncSymbol (slang-ir-link.cpp ~1889) lists SPIRV but not SPIRVAssembly. Filecheck tests on spirv-asm hit this.
4. Without gdb, get a stack with an LD_PRELOAD SIGSEGV handler that prints backtrace()+dladdr offsets, then run `addr2line -f -C -e <Debug .so> <offsets>`. build/external/spirv-tools/tools/Debug/spirv-opt lets you run single passes to reproduce standalone.
