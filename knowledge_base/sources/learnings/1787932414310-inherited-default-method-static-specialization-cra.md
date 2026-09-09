---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1787931516215-my0qeg
written_at: 2026-08-28T15:53:34.310Z
---

# Inherited default-method static-specialization crash is a checker producer bug, not flat witness lookup

**Context:** shader-slang/slang#12814 — static generic `combine<Value>` calling a DEFAULT method (`combineInPlace`) declared on base `IBase`, where `struct Value : IDerived` and `interface IDerived : IBase {}`. Aborts `assert slang-ir.cpp(9011): other` (i.e. `SLANG_ASSERT(other)` in `_replaceInstUsesWith`). Same symptom family as #11487 (dynamic-dispatch variant).

**Key correction to the #11487 recall (verified on ToT, checkout HEAD 7bb69cfc9, Aug 2026):**
1. **The #11487 fix (recursive `findWitnessTableEntryInInheritanceClosure`) NEVER merged.** `findWitnessTableEntry` (slang-ir-util.cpp:1724) is still flat; there is NO closure-lookup helper in-tree. Don't assume prior shared learnings' proposed fixes actually landed — grep the current source.
2. **Root cause is a PRODUCER (semantic checker) bug, NOT the flat-lookup consumer.** Via `-dump-ir`: the nested `Value:IBase` witness table's default-impl entry is `specialize(defaultImplGeneric, Value, <Value:IDerived table>)` — it passes the WRONG (outer, IDerived) witness table where the default-impl generic expects a `witness_table_t(IBase)`. The IDerived table only carries the `$inheritance` entry, so the default impl's inner `lookupWitness(IBase.combine)` misses → null → crash.
3. **Precise mechanism:** `slang-check-decl.cpp:11298` sets `context.conformingWitness = subIsSuperWitness` ONCE to the outer witness and never refreshes it; the nested-table recursion at :10390 passes the CORRECT witness (`subIsReqWitness`) only as a parameter, while `findDefaultInterfaceImpl` (:9930) reads the STALE `context->conformingWitness` field at :9999-10001. A mutable context field that goes stale across recursion. (grep confirms: only writer :11298, only reader :10001.)

**Fix layer:** producer, in slang-check-decl.cpp — set the nested conformance context's `conformingWitness` to the base-interface witness before populating the nested table (save/restore, or better: thread the already-available `subIsSuperWitness` param and stop using the context field). A consumer-side closure lookup or null-guard at slang-ir-translate.cpp:348 would MASK the malformed witness table (CLAUDE.md "do not mask").

**Also:** the two flat-lookup consumers behave differently — `maybeSpecializeWitnessLookup` (slang-ir-specialize.cpp:1240) IS null-guarded (`if(!satisfyingVal) return false`), but its twin `specializeWitnessLookup` (slang-ir-translate.cpp:346-348) is UNGUARDED and is the one that actually fires the assert. When two near-identical helpers exist, check WHICH one is on the crash path.

**Reproduce/verify tip:** this is CPU-independent IR-gen — reproduces with any `-target` (hlsl/spirv), no GPU. Debug build shows the assert message; Release SIGSEGVs (exit 139). `SLANG_ASSERT=release-assert-only` SKIPS the debug assert (compiles "clean" but produces wrong/null IR) — so to SEE the crash, leave SLANG_ASSERT unset.
