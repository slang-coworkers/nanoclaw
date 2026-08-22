---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787077420797-6srmf1
written_at: 2026-08-21T11:39:54.373Z
---

# [approver/confirmed-safe] Accepted-but-unpushed reviewer feedback → abstain on the stale head, approve the rewrite: #12410 merged at the exact head I approved

**Outcome (calibration join):** shader-slang/slang#12410 merged by jvepsalainen-nv at head `2972086c` — the EXACT commit I recorded WOULD_APPROVE against (no interval commits between decision and merge; verified live). Merged = APPROVED-equivalent → my WOULD_APPROVE was a true positive. My earlier R1 abstain (OPEN_GAP @601a5406) was also vindicated: that head was superseded by the announced rewrite exactly as predicted.

**The transferable pattern (two-revision arc, both calls correct):**
1. **R1 head (601a5406):** code was correct, CI green, but the author had publicly ACCEPTED two reviewer asks (drop a fixture + a macro→template CORE rewrite) and pushed NEITHER. Correct call = ABSTAIN_POLICY/OPEN_GAP — do not approve a head the author has announced they will materially replace. (A `COMMENTED`-state review does not make accepted-and-pending feedback non-blocking.)
2. **R2 head (2972086c):** both accepted changes landed (the template rewrite `0415ecec` + fixture removal). Re-gated fresh on R2's own evidence → WOULD_APPROVE, which matched the human APPROVED + merge at that head.

**Why this shape is safe to approve (for the next reviewer of similar CUDA-prelude / codegen changes):** a purely mechanical rewrite of runtime-library operators (loop-with-reinterpret-accessor → SFINAE-constrained templates with `if constexpr` width dispatch) that (a) touches only the prelude + tests, not the emitter or include/ (ABI-safe), (b) has a CPU differential control (the .slang test runs -cpu AND -cuda against the same expected buffer; CPU uses a separate prelude), and (c) is exercised by the real CUDA GPU test-slang corpus on hardware CI — is low-risk. The one subtle risk in a concrete→template operator rewrite is the deduction-contract narrowing (templates require exact operand type match; the old concrete overloads accepted implicit conversions); it is inert for Slang-emitted operands because `unifyBinaryExprOperands` (slang-ir-simplify-for-emit.cpp:344) splats any scalar binary-op operand up to the other's vector type before emit, and any break is a loud compile error (no fallback operator), not a silent miscompile.

**Sharpens Step-0 recall:** when a PR's history shows accepted-but-unpushed reviewer feedback, abstain on the stale head and expect a rewrite revision; re-gate that revision fresh. When the change is a mechanical prelude/runtime-op rewrite with a differential CPU control + real GPU CI, the residual risk is compile-time-only and CI-covered.
