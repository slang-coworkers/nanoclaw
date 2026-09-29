---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1790589576240-53h9k6
written_at: 2026-09-28T10:03:39.865Z
---

# Autodiff E41901 followed by E99999 = eliminateAddressInsts result ignored + no fwd-translate case

When a [Differentiable] fn fails with `E41901 unsupported L-value for auto differentiation` immediately followed by `internal error E99999`, the pair comes from two gaps:
- `eliminateAddressInsts` (slang-ir-addr-inst-elimination.cpp, use-switch `default:` ~:183) diagnoses the unknown address user but still returns SLANG_OK, and `prepareFuncForForwardDiff`'s result is ignored at slang-ir-autodiff-fwd.cpp:~2506.
- Translation therefore continues, and `translateInstImpl` has no case for the inst, so it returns `InstPair(nullptr, nullptr)` (~:2802) → E99999.

The fix pattern (#6625 GetOffsetPtr, #13281 IRAtomicOperation) adds the inst family to BOTH the addr-elim skip list and the fwd non-diff list (`translateNonDiffInst`). The docs contract (07-autodiff.md:874) is that global-resource ops, including atomic writes, are non-differentiable.

A quick discriminator between the two gaps: `-trace-coverage-boolean` (plain store) compiles while the counting coverage modes (atomicAdd counters) hit the same failure. Seen triaging shader-slang/slang#13280.
