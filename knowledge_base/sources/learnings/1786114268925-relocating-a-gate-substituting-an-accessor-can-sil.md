# Relocating a gate: substituting an accessor can silently swap the OBJECT

Moving a condition from a call site into a pass, I rewrote

```cpp
if (!targetProgram->getOptionSet().shouldPerformMinimumOptimizations())   // before, at call site
const bool gated = !target->getOptionSet().shouldPerformMinimumOptimizations();  // after, inside pass
```

Same method name, same option name, **different object**. In Slang, `TargetProgram`'s option set is
`overrideWith(component)` then `inheritFrom(targetReq)` (`slang-target-program.cpp:19-20`), so an
option supplied via `IComponentType::linkWithOptions` is visible on the `TargetProgram` and invisible
on the `TargetRequest`. Result: the pass's pre-existing diagnostics would have started firing for API
callers who had requested minimum optimization — a path no `.slang` test directive can reach.

**The generalizable part — why my own audit couldn't catch it.** I enumerated the five diagnostic
sites the gate protected, twice, and an independent reviewer confirmed the count. Both of us were
right about *which checks are gated* while the *gate read the wrong object*. A complete answer to the
wrong question is indistinguishable from safety. When you relocate a condition, the population to
audit is **the condition's operands**, not the flag's consumers.

Practical rules:
- Diff the **receiver**, not just the predicate. Write old and new expressions side by side and name
  each receiver's type. `a->getX()` vs `b->getX()` is a different measurement whenever the types
  differ, however similar the accessor reads.
- An "effective settings" object layered over a base (`overrideWith`/`inheritFrom`, config merge,
  scope chain) is the canonical trap: the base is reachable from the derived object, so the wrong
  choice compiles and is usually correct — diverging only on the untested path.
- Fix at the signature. I changed the pass to take `TargetProgram*` and derive `getTargetReq()`
  internally for target-kind predicates. Precedent existed already
  (`lowerReinterpretOptional(IRModule*, TargetProgram*, DiagnosticSink*)`) — grep for a pass that
  already takes the object you need before inventing a parameter.
- Cover the divergent path even when no test directive reaches it: a CPU-only unit test can do
  `loadModuleFromSourceString` + `createCompositeComponentType` + `linkWithOptions` with no device.
  `tools/slang-unit-test/` sources are globbed by CMake, so a new file needs no registration.

⚠ Also: a **fresh** reviewer thread found this after a long thread had approved the same change
twice. A long converging review shares its blind spots rather than accumulating independence — when
a change's premise shifted mid-thread, start a new review rather than replying into the old one.
