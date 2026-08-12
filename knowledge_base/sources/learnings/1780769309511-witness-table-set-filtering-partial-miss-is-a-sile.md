# Witness-table-set filtering: partial-miss is a silent-misdispatch trap, and miss-handling policy must match each site's role

# Witness-table-set filtering: partial-miss is a silent-misdispatch trap

Extends the earlier learning "Slang inherited witness-table requirements live on nested base-interface tables" (#11487 / PR #11492). When you route a dynamic-dispatch lookup through a walk that can *miss* (e.g. `findWitnessTableEntryInInheritanceClosure`, or any lookup that returns null on a key not present), the miss-handling policy is not free-choice — it must match the site's role in the pipeline, and a careless "skip on miss" can produce a silent miscompile.

## The partial-miss → singleton-misdispatch trap (the non-obvious one)

In `analyzeLookupWitnessMethod` (`slang-ir-typeflow-specialize.cpp`), the analyzer iterates a witness-table *set* (one entry per concrete type a runtime tag can select) and builds a *result-value set* by looking up the requirement key in each. The original fix did `if (auto v = walk(table, key)) results.add(v);` — i.e. silently skip a table that misses.

The trap: if N-of-M tables hit and the rest miss, `results` shrinks to a **strict non-empty subset**. Downstream, the singleton-shortcut path replaces the dynamic lookup with the *one surviving entry for every runtime tag* — so the tags whose tables actually missed get dispatched to the wrong function. This is worse than a crash: it's a silent wrong-dispatch that no assert catches.

Fix: track `bool sawResidualMiss`; on any miss, free the partial set and `return none()` so the lookup stays dynamic. The empty-set case (all miss) was already safe (emits poison), and the all-hit case is correct — only the *partial* miss was the bug. CodeRabbit (ASSERTIVE profile) and a clarity reviewer both independently flagged this; I'd originally reasoned it unreachable via front-end conformance enforcement, but "unreachable today" ≠ "safe invariant" — a future malformed-IR/refactor reintroduces it.

## Miss-handling policy must match the site's role

Same key, same walk, different correct policy per site:

- **Analyzer / producer sites** (`analyzeLookupWitnessMethod`, `specializeWitnessLookup`, `specializeLookupWitnessMethod` early in the pipeline): a miss means "can't resolve yet" → leave the lookup unspecialized (`return false` / `return none()` / skip the rewrite). A later pass may resolve it.
- **Consumer / downstream-consistency sites** (`getDispatcher`'s `Lookup` action, `lowerGetTagForMappedSet`): by the time these run, the analyzer above has *already* validated every set element against the same key via the same walk. A miss here is internally-corrupt IR, not a deferrable state → fail loudly (`SLANG_RELEASE_ASSERT` / `SLANG_UNEXPECTED`) with a clear message, NOT a silent `return false`.

The asymmetry trap: `specializeLookupWitnessMethod` looked like an analyzer site so I mirrored `maybeSpecializeWitnessLookup`'s `return false` on miss. But once its operand is *already a concrete `IRWitnessTable`*, no later typeflow step can resurrect the lookup, AND the post-pass diagnostic walker skips concrete-table operands — so `return false` left an unresolved `lookupWitnessMethod` that silently escaped all diagnostics. It should be a hard assert. The "is this site a producer or a consumer?" question is the one to ask before choosing `return false` vs assert.

## Verification note

`tests/autodiff/` is the de-facto regression suite for any change to witness-table walking — it exercises the self-referential differential-pair tables (`buildDifferentiablePairWitness` self-edges) that break naive recursion and would trip over-eager asserts. Run it (365/365) alongside the targeted dynamic-dispatch sweep on any miss-handling change.
