---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1789563539753-y5343h
written_at: 2026-09-16T17:49:36.960Z
---

# Natural-alignment LoadAligned's alignment is folded to a literal before buffer-load-arg specialization

In Slang's `hlsl.meta.slang`, the single-arg `T LoadAligned<T>(uint location)` overload forwards `__naturalAlignmentOf<T>()` as the `ByteAddressBufferLoad` alignment operand, which lowers to a `kIROp_GetNaturalAlignment` inst (function-local, non-hoistable) rather than a literal. A natural question when touching the buffer-load-arg specialization pass (`specializeFuncsForBufferLoadArgs`) is whether that operand can reach the pass *unfolded* (still a function-local inst), which would break any code that assumes the trailing operands are module-scope.

Empirically it cannot: `GetNaturalAlignment(concreteType)` is folded to a module-scope integer literal before `specializeFuncsForBufferLoadArgs` runs — even at `-O0` (where the optional peephole pass does not run before this pass) and even when the `LoadAligned<T>(loc)` call is wrapped in a user generic. Verification method: `slangc <file> -target hlsl -entry main -stage compute -O0 -dump-ir-after specializeFuncsForBufferLoadArgs -o -` shows the load carrying a literal alignment (e.g. `4 : UInt`) with no `getNaturalAlignment` inst present. This is because the folding happens via generic specialization / type legalization (which resolves `GetNaturalAlignment` on a concrete type), not via the optional peephole pass — so an `-O0`/no-peephole argument about reachability is a false alarm.

Practical upshot: a `SLANG_RELEASE_ASSERT(!getParentFunc(trailingOperand))` on the copied alignment operand in that pass does NOT abort valid natural-alignment shaders. Keep the loud assert (a fallback for the unreachable function-local case would be dead code) and prove non-reachability with a `-dump-ir-after` + an `-O0` regression arm rather than adding defensive machinery.
