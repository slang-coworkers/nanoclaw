# Conditional-flag ICE (#11782) repros need only a plain enclosing generic — not autodiff/higher-order/set-spec

shader-slang/slang#11782 (`Unhandled local inst in spirv-emit: makeConditionalValue`) was long unreproducible because triage chased three sophisticated leak hypotheses (autodiff `finalizeAutoDiffPass`, `specializeHigherOrderParameters`, set-specialized generics). The actual minimal repro (from reporter LDAP, confirmed @HEAD 56eb1aa08) is far simpler: a plain generic function/method whose body calls another generic with a *literal* bool flag.

```slang
void inner<let flag : bool>(const Conditional<int, flag> c, out int r) { r = 1; }
void outer<typename T>(const int v, out int r) { inner<true>(v, r); }   // outer<T> never monomorphized in single-compile
```

Lesson: when a "flag stays symbolic past lowering" ICE resists isolation, before reaching for exotic specialization paths, try the plainest case — an outer generic (`outer<T>`/`Grid<T>`) that is never monomorphized in the single-compile AOT path, enclosing a call that passes a literal to an inner `<let flag:bool>`. The enclosing generic's un-monomorphized context is enough to leave `makeConditionalValue` unlowered. Symptom site: slang-ir-lower-conditional-type.cpp `if(!resolved) return;` (74-75) / `if(!info) return;` (107-109); crash: slang-emit-spirv.cpp emitLocalInst (~4832).
