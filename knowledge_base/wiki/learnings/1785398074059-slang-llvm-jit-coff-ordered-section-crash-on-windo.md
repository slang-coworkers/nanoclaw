---
title: "slang-llvm JIT COFF ordered-section crash on Windows (default LLJIT, #12283)"
type: learning
topic: slang-compiler
source: learnings/1785398074059-slang-llvm-jit-coff-ordered-section-crash-on-windo.md
---

# slang-llvm JIT COFF ordered-section crash on Windows (default LLJIT, #12283)

**Symptom:** Windows (x64) test-server.exe intermittently aborts (Event Viewer: faulting module `slang-llvm.dll`, exception `0xc0000409`), more often at higher `-server-count`, active test varies. Recovered LLVM fatal string: `IMAGE_REL_AMD64_ADDR32NB relocation requires an ordered section layout`.

**Root cause (verified @HEAD 7c58a326b, shader-slang/slang#12283):** `source/slang-llvm/slang-llvm-jit-shared-library.cpp:63-68` `createAVX512SafeLLJIT()` calls `llvm::orc::LLJITBuilder::create()` with the DEFAULT object-linking layer — no `setObjectLinkingLayerCreator`, no custom `RTDyld::MemoryManager`. On Windows x64 that's `RTDyldObjectLinkingLayer` + a fresh per-object `SectionMemoryManager`, which allocates code/rodata/writable as SEPARATE VM regions. `IMAGE_REL_AMD64_ADDR32NB` is an UNSIGNED 32-bit image-relative offset ⇒ RuntimeDyld requires target sections in increasing address order; if Windows can't place a later allocation above the first (address-space fragmentation in long-lived workers), RuntimeDyld hits its fatal ordered-layout abort. Both JIT paths (`slang-llvm.cpp:910` host-callable, `slang-llvm-builder.cpp:2328` generateJITLibrary) funnel through the one helper → single insertion point.

**Not AVX-512.** That's a DISTINCT mode: SIGILL on *executing* generated AVX-512 (#11062, mitigation PR #12056 sets `SLANG_DISABLE_AVX512=1`). The COFF bug fires even in compile-only tests and ends in a *relocation* abort. Don't conflate the two intermittent-test-server-drop root causes (see also #12114 JIT-teardown UAF — a third distinct one).

**Fix direction (maintainer's, validated):** keep RTDyld, supply a Windows-x64 memory manager overriding `reserveAllocationSpace` to reserve ONE contiguous region per object, place code→rodata→writable in order with page/section alignment, apply X/R/W at finalize, reject objects outside the unsigned-32-bit image-relative range. Object-linking-layer concern is orthogonal to the `stdc` `absoluteSymbols` resolution and the AVX-512 target-machine config (low blast radius).

**Shipping gotcha:** `SLANG_SLANG_LLVM_FLAVOR` defaults to `FETCH_BINARY_IF_POSSIBLE` (CMakeLists.txt:386) — the default build fetches a PREBUILT slang-llvm; edits to `source/slang-llvm/*.cpp` are only compiled with `USE_SYSTEM_LLVM` (source build against LLVM 21), and the prebuilt binary must be re-rolled to reach default builds/CI. So this class of fix is not verifiable in a default preset build.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785398074059-slang-llvm-jit-coff-ordered-section-crash-on-windo.md`_
