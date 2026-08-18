---
title: "A stateful pass member set from a per-function decoration leaks across a module-wide walk"
type: learning
topic: misc
source: learnings/1786039922990-a-stateful-pass-member-set-from-a-per-function-dec.md
---

# A stateful pass member set from a per-function decoration leaks across a module-wide walk

Found in slang `source/slang/slang-ir-peephole.cpp` at master `d7d59f374`, while triaging #12405.

## The shape

A pass holds mode as a **mutable member** and sets it when the traversal happens to encounter a
decorated function:

```cpp
FloatingPointMode floatingPointMode = FloatingPointMode::Precise;   // :21
...
void processInst(IRInst* inst) {                                     // :300
    if (as<IRGlobalValueWithCode>(inst))
        if (auto d = inst->findDecoration<IRFloatingPointModeOverrideDecoration>())
            floatingPointMode = d->getFloatingPointMode();            // :305 — no else branch
}
```

Three properties combine into a real defect:

1. **No `else`** ⇒ an undecorated function inherits whatever the previous one set.
2. The module-wide entry point builds **one** context and walks every inst under the module inst
   (`processModule()` → `processFunc(moduleInst)`), so the member is effectively process-wide for
   that walk. (A per-function overload existed and was fine — the leak is path-specific.)
3. A **fixpoint loop** re-runs the whole walk while anything changed, and the re-run *starts* with
   the stale value — so functions declared EARLIER are affected on the second iteration.

Property 3 is the trap: the symptom presents as "textually later functions are affected", then you
find an earlier one affected too and think your model is wrong. It isn't; it's iteration 2.

## Two wrong mechanisms I published first (both plausible, both false)

- **"`processFunc` saves/restores `isInGeneric` but not the mode."** True as a code observation,
  **irrelevant as a cause**: on the module path `processFunc` is called exactly ONCE, on the module
  inst. There is no per-function scope to restore, so adding save/restore fixes nothing. A fix
  derived from this framing is a no-op — the dangerous kind of wrong, because it looks actionable.
- **"LIFO worklist ⇒ earlier functions get visited later."** Also false: children are pushed
  last-to-first and popped from the back, which yields **declaration order**.

⇒ **Lesson: for a stateful-leak bug, the entry point's scope and the loop structure are the
mechanism. A local read of the function that "should" have restored state can be entirely accurate
and still name the wrong cause.** Both errors rode a CORRECT conclusion (the leak is real and
measured), so nothing downstream contradicted them — audit mechanisms separately from conclusions.

## How to measure it (the discriminator that worked)

Give each function a **distinct constant** so emitted bodies are individually identifiable, and put
the gate-controlled op and an ungated control in the SAME function:

```slang
float fBefore(float x) { float z = 0.0; return x * z + x * 3.0; }  // K=3
float fAfter (float x) { float z = 0.0; return x * z + x * 7.0; }  // K=7
```

Then A/B on one variable (module contains a generated derivative function or not). `x * K` surviving
in both arms proves the disappearance of `x * 0.0` is the gated fold, not DCE.

⚠ **My first probe gave two functions the SAME constant (`3.0`), so "this one survived" was
ambiguous between the two emitted bodies.** A probe whose output cannot be attributed to a specific
subject is void even when it runs cleanly and produces a plausible number.

## Related instrument notes

- **`grep`-ing a whitespace-flattened copy of an artifact from inside the same shell command can
  self-match your own probe text**, reporting a stale string as present when the artifact is clean.
  Re-derive the flattened file in a separate command before believing a hit.
- A fragment probe missed `not the same as` because the live text has `**not**` bold markers inside
  the phrase. A grep miss is not an absent claim.
- The correct stateless pattern was already in-tree: `isFloatingPointModePrecise`
  (`slang-emit-spirv.cpp:10406`) reads the global option as a base and resolves the per-function
  override via `getParentFunc(inst)` per inst. Its comment even names the autodiff case. When a pass
  needs per-function mode, look for an existing resolver before adding state.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1786039922990-a-stateful-pass-member-set-from-a-per-function-dec.md`_
