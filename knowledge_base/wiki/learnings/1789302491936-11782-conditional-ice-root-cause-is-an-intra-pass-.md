---
title: "#11782 Conditional ICE root cause is an intra-pass ORDERING bug in lowerConditionalType, not a symbolic flag"
type: learning
topic: misc
source: learnings/1789302491936-11782-conditional-ice-root-cause-is-an-intra-pass-.md
---

# #11782 Conditional ICE root cause is an intra-pass ORDERING bug in lowerConditionalType, not a symbolic flag

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1789297507479-182bdy
written_at: 2026-09-13T12:28:11.936Z
---

# #11782 Conditional ICE root cause is an intra-pass ORDERING bug in lowerConditionalType, not a symbolic flag

**Correction to prior #11782 learnings (1782485307814, 1784793304583) and the issue triage.** Those said the `makeConditionalValue` ICE was caused by a *symbolic/non-literal* `hasValue` flag surviving specialization (a "producer-side monomorphization" failure). **An IR dump disproves that for the reported repros.**

Dumping IR right before `lowerConditionalType` (via `slangc repro.slang -target spirv -dump-ir -o x.spv -entry main`) shows the flag is **already a literal `true`** by that point — specialization monomorphized `outer<int>`/`Grid<int>` and `inner<true>` correctly:
```
func %outer {
  let %3 : Conditional(Int, true) = makeConditionalValue(%v)   // literal flag
  call %inner(%3, %r)
}
func %inner : Func(Void, Conditional(Int, true), OutParam(Int)) { ... }   // fully concrete
```
After the pass, the SAME inst survives but re-typed: `let %3 : Int = makeConditionalValue(%v)` → reaches `slang-emit-spirv.cpp` `emitLocalInst` default → `SLANG_UNIMPLEMENTED_X` → ICE.

**Real root cause:** an intra-pass ordering hazard in `slang-ir-lower-conditional-type.cpp`. `processModule` uses ONE LIFO worklist that interleaves the PRODUCER (`processConditionalType`, records `loweredConditionalTypes[condType]`) with the CONSUMERS (`processMakeConditionalValue`/`processGetConditionalValue`, look it up). If a consumer is visited before its `ConditionalType` is recorded, it hit `if (!info) return;` and left the inst; then the terminal `for (…) key->replaceUsesWith(value.loweredType)` loop rewrote the orphan's type to the lowered type. Net: an orphaned `makeConditionalValue` with a lowered result type reaches emit.

**Diagnostic tell:** type recorded (→ inst re-typed from `Conditional(Int,true)` to `Int`) BUT the `makeConditionalValue` inst still present after the pass ⇒ the consumer ran before the producer recorded. Proves ordering, not a symbolic flag.

**Fix (PR #13043):** resolve the conditional type ON DEMAND via an idempotent helper the consumers call (so the type is lowered before use, independent of visitation order), recurse on nested conditionals propagating failure, and replace the silent drop with a centralized once-per-type `Diagnostics::Unimplemented` (deduped, invoked from `processConditionalType` so a type-position-only unresolved conditional is caught too). No producer change was needed.

**Lesson:** when an "unlowered X survives to emit" ICE has a literal/concrete operand at the pass boundary, suspect the lowering pass's own produce/consume ORDERING (single-worklist passes that both populate and consume a map in one walk) before blaming an upstream producer. Dump IR at the pass boundary first — it settles producer-vs-consumer immediately.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1789302491936-11782-conditional-ice-root-cause-is-an-intra-pass-.md`_
