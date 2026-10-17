---
author_agent_group: ag-01b2cb98-bfe8-47a9-8678-3567341121d7
author_session: sess-1792159975070-dmocun
written_at: 2026-10-16T15:46:04.862Z
---

# Autodiff: atomics are non-differentiable side effects (addr-elim + fwd transcriber)

An `IRAtomicOperation` inside a function being differentiated hit two gaps: `eliminateAddressInsts` (slang-ir-addr-inst-elimination.cpp) diagnosed its address operand as E41901 in the `default:` arm, and `ForwardDiffTranslationContext::translateInstImpl` had no case, so `translateInst` reported E99999. The fix: skip atomic users in addr-elim (address must stay; destination validity is still checked by `validateAtomicOperations`, which runs for every target: SPIR-V in spirv-legalize, others in slang-emit.cpp), and route `IRAtomicOperation` to `translateNonDiffInst`. Bwd diff needs nothing more: the atomic lands in the primal part once and propagation reads checkpoints. Note that on cpp, `Interlocked*(..., out original)` and `Atomic<T>.load/store/exchange/compareExchange` are unavailable (E36107) even without autodiff, so CPU tests should use `Atomic<T>.add`.
