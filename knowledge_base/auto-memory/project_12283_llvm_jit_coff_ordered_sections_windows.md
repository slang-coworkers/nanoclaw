---
name: project-12283-llvm-jit-coff-ordered-sections-windows
description: "slang#12283 LLVM JIT workers abort on Windows (unordered COFF sections) — PARKED, maintainer self-filed+self-assigned with validated fix"
metadata: 
  node_type: memory
  type: project
  originSessionId: 475aa600-c443-401e-9579-0c708c027105
---

# slang#12283 — LLVM JIT workers intermittently abort on Windows (unordered COFF sections)

**State:** TRIAGED → **PARKED**. Bug · medium · **P2** · component CPU/host-callable JIT (slang-llvm). Issue Type set to `Bug`. No `reproduced` label (Windows-x64 + LLVM-21-specific; not reproducible in the Linux triage env). No `regression` (latent bug exposed by LLVM 21's default LLJIT, not framed as a regression by author).

**Author:** jkwak-work (maintainer) — self-filed AND self-assigned, with an already-validated fix. Per standing policy [no-autofixer on maintainer self-filed+self-assigned], **NO slang-fixer dispatch**.

**Verdict (triager, verified @ HEAD 7c58a326b):** author's root cause CORRECT.
- `createAVX512SafeLLJIT()` (`source/slang-llvm/slang-llvm-jit-shared-library.cpp:63-68`) uses default `LLJITBuilder::create()` with no custom memory manager → Windows-x64 default RTDyld + per-object `SectionMemoryManager` violates the ordered-layout invariant that `IMAGE_REL_AMD64_ADDR32NB` (unsigned 32-bit image-base-relative offset) requires. Windows can place a fallback allocation *below* the first → RuntimeDyld fatal abort `IMAGE_REL_AMD64_ADDR32NB relocation requires an ordered section layout` (exception 0xc0000409 via CRT).
- Manifests intermittently; higher `-server-count` → more likely (depends on accumulated address-space layout). Repro: 7/30 focused LLVM-heavy runs at 8 servers; single-server did not repro.
- AVX-512 correctly ruled out (distinct SIGILL-on-execution mode; #11062/#12056). `SLANG_DISABLE_AVX512=1` does not prevent it.

**Recommended fix = author's Approach A:** contiguous Windows-x64 RTDyld memory manager via `setObjectLinkingLayerCreator`, platform-gated. Uses RuntimeDyld `reserveAllocationSpace` to size code/rodata/writable per object, reserves one contiguous allocation, places code→rodata→writable with page+section alignment, applies X/R/W at finalization, rejects objects exceeding the unsigned-32-bit image-relative range. Alternatives (JITLink migration / retry-suppress) documented as not-recommended. Author validation: 40 clean 8-server runs; 10,216/10,217 broad suite (the one gfx-smoke teardown failure repro'd identically with allocator disabled → independent).

**Shipping caveat / blocker:** `SLANG_SLANG_LLVM_FLAVOR` defaults to `FETCH_BINARY_IF_POSSIBLE`, so a `source/slang-llvm/*.cpp` fix only compiles when built from source against LLVM 21 (`USE_SYSTEM_LLVM`); the prebuilt slang-llvm binary must be re-rolled to reach the default build/CI.

**RESUME trigger:** jkwak's explicit "make a PR" / a linked PR / a substantive human comment. Verdict comment: https://github.com/shader-slang/slang/issues/12283#issuecomment-5128135103 · triage memo at inbox/a2a-1785398050476-qqtysm/triage-12283.md (triager's fs).

**2026-07-30 update (comment #5128310021, jkwak):** more validation, NOT a "make a PR" — three consecutive full Debug suites at `-server-count 8` with the proposed allocator: 0 test-server.exe crashes, 0 ADDR32NB aborts, 10,216/10,217 each run; sole failure = pre-existing independent `tests/cpu-program/gfx-smoke.slang (cpu)` teardown AV (repros identically with allocator disabled). Strengthens the fix; does not change disposition. Forwarded to slang-triager on canonical thread; chain remains PARKED (no PR requested yet).

Related: [[reference-slang-maintainer-handles]] (jkwak = jkwak-work).
