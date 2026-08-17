---
title: "Slang any-value-inference recursion: #10686 pointer guard is partial; IRSpecialize-operand path bypasses it"
type: learning
topic: slang-compiler
source: learnings/1780353989621-slang-any-value-inference-recursion-10686-pointer-.md
---

# Slang any-value-inference recursion: #10686 pointer guard is partial; IRSpecialize-operand path bypasses it

**Context:** Triaged shader-slang/slang#11409 — `slangc` SIGSEGV (stack overflow) in `_findDependenciesOfTypeInSet` (`source/slang/slang-ir-any-value-inference.cpp:13-66`) on a self-referencing generic used through an interface.

**Finding (corrected assumption):** PR #10686 (commit `8d31ea363`) added a pointer-case guard so the dependency walk *breaks cycles at pointer-like types*. It's easy to assume that fully fixes self-referencing-generic-via-pointer cycles. It does NOT. `_findDependenciesOfTypeInSet` has **no general visited-set guard** — `targetSet` is a filter, not a visited set. Its only cycle protection is the hard-coded pointer/fixed-size `break` cases.

**Why the guard misses:** `diagnoseCircularConformances` runs **before** generic specialization (`slang-emit.cpp:1266`), so `Foo<Bar>` is still an `IRSpecialize(Foo, Bar)`. The walker's `default` case (l.56-64) recurses into every IRType operand — including the type argument `Bar` — so it loops `Bar→Foo<Bar>→Bar→…`. It never reaches `Foo`'s instantiated `T* t` field, so the pointer guard never fires. Confirmed: reproducer still SIGSEGVs at HEAD `b305a4df4` which contains #10686.

**Trigger requires two features (empirically confirmed):** (1) a generic specialized with its surrounding struct (`struct Bar { Foo<Bar> b; }`); (2) usage through an interface (emits the witness table that triggers the dependency walk via `collectInterfaceTypes`). Remove the interface → no witness table → walk never runs → no crash.

**Fix shape:** add a `HashSet<IRType*>& visited` guard at function entry, mirroring `_sortTopologically` (l.84-87) and Tarjan `strongConnect` (l.282-287) already in the same file. Must NOT regress the `diagnose-circular-*` tests (genuine by-value unsatisfiable cycles must still be diagnosed).

**Env note:** triage containers can't load `slang-glslang`/`spirv-opt`; a clean compile fails late with a dylib-load error (exit 255), not a segfault. The crash manifests before downstream emit, so "no segfault" is the fix signal — use direct-SPIRV or CPU/interpreter test directives to dodge glslang.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1780353989621-slang-any-value-inference-recursion-10686-pointer-.md`_
