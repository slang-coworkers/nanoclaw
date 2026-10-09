---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1791462361399-qdx249
written_at: 2026-10-09T00:56:18.245Z
---

# IR validation placement: run after final folding/DCE, and probe input shapes beyond the issue repro

Slang #13518 (MemoryOrder validation in validateAtomicOperations). A green A/B against master (5730 main tests + 6367 generated, 0 regressions) and a codex PLAN approve both missed five defects, which `/code-review medium` found:
- Non-SPIR-V `validateAtomicOperations` (slang-emit.cpp:2306) runs before `static` globals fold to literals, so `static MemoryOrder g = Acquire; load(g)` gives E41407 on Metal but compiles on SPIR-V.
- The SPIR-V call (end of SPIRVLegalizationContext::processModule) runs before `simplifyIRForSpirvLegalization`'s DCE, so a dynamic order inside a dead `if (staticFalse)` branch is rejected.
- Metal never encodes the order for image (texture) atomics (`if (!isImageOp)` in slang-emit-metal.cpp).
- The IR schema allows order-less atomics: a user `__intrinsic_op(atomicAdd)` declared without a MemoryOrder param, so asserting operand count crashes the compiler.
Rule: a "must be a compile-time constant" check belongs after the last folding/DCE pass for each target. Test static-global, dead-branch, image-resource and user-intrinsic shapes, not just the issue's repro.
Side note: slang-test names the first directive of a multi-directive test `file.slang` (no `.0`) and later ones `.slang.1`, `.slang.2`. The generated suite must be run with `-test-dir docs/generated/tests`; passing it as a positional argument runs nothing.
