---
title: "C-like emitter names: name hints, linkage names, `_generateUniqueName`, and passes that emit source names verbatim"
type: concept
group: slang-backends
tags: [slang, emit, c-like, naming, name-hint, _generateUniqueName, generateName, extern_cpp, IRExternCppDecoration, obfuscate, linkage, cpp, cuda, nvrtc, wgsl]
source_count: 3
---

# C-like emitter names: name hints, linkage names, `_generateUniqueName`, and passes that emit source names verbatim

The C-like source emitters (HLSL, GLSL, Metal, WGSL, C++, CUDA) name each declaration in `CLikeSourceEmitter::generateName` (`slang-emit-c-like.cpp`). Hinted names normally go through `_generateUniqueName`, a module-wide namer that appends `_0`, `_1`, ... so two declarations with the same hint never collide. Two paths skip that namer: a function named from its linkage name (always under `-obfuscate`) and a field emitted under its source name (`__extern_cpp`). Each skip has produced duplicate-name compile errors in downstream compilers. Type-name rendering for opaque IR types (`getTypeNameHint`) is a separate mechanism, covered on [[wiki/concepts/slang-compiler-probe-discipline-and-type-naming.md]].

## TL;DR

- **`_generateUniqueName` is what keeps emitted names distinct.** Its counter is module-wide and stateful, so code outside the emitter cannot reliably predict the name it will produce.
- **A linkage name is emitted verbatim.** Under `-obfuscate`, name hints are stripped and `generateName` (~1270) uses the export name with no uniquing, so an IR clone that keeps `IRExportDecoration` duplicates its original's `_Sh<hash>` name (WGSL redeclaration error, #14004). Strip linkage from clones; the rule is on the clone/linkage page.
- **A `$`-prefixed name hint does not mark every compiler-synthesized member.** Checker-synthesized `VarDecl`s use `$` names, but the base-subobject key from `visitInheritanceDecl` is hinted plain `base`, so `struct Derived : Base { float base; }` has two fields hinted `base`.
- **If an IR pass must make names unique, it assigns every name in that scope itself**, with a local used-name set: reserve explicit names first, keep unshared source names, then number the rest `hint_<smallest unused n>`. Guards that leave some names to the emitter's namer kept colliding.
- **Bypassing uniquing also bypasses the only C++ keyword protection.** Slang accepts many C++ keywords as field names (`default`, `new`, `long`, `int`, `bool`, `union`, `template`), only the `_N` suffix keeps them valid C++, and no keyword dictionary exists.
- **The C++ and CUDA *runtime* paths are affected too**, because `-cpu` and `-cuda` builds go through CPPSource/CUDASource intermediate text.
- **Probe:** compile with and without `-obfuscate` and compare the emitted name lists for duplicates; for verbatim field names, test inheritance with a field named like the base key, a field named like a generated name (`base_0`), and C++ keyword field names.

## Linkage names under `-obfuscate`

Under `-obfuscate`, name hints are stripped. `CLikeSourceEmitter::generateName` (`slang-emit-c-like.cpp` ~1270) then names a function from its linkage (export) name verbatim, with no `_generateUniqueName`. So any IR pass that clones a function and keeps the original's `IRExportDecoration` creates two emitted functions with the same `_Sh<hash>` name, and WGSL fails with a redeclaration error; without `-obfuscate` the hint path hides the collision as `foo_0`/`foo_1`. Address-space specialization had this bug (#14004) ([-obfuscate: IR clones that keep [export] get the same emitted name](../learnings/1793263779351-obfuscate-ir-clones-that-keep-export-get-the-same-.md)). Which clones may keep linkage, and which dependent decorations must go with it, is on [[wiki/concepts/slang-compiler-ir-clones-linkage-and-pass-roots.md]].

## `__extern_cpp` fields under their source names (#14028, PR #14043)

PR #14043 emits `__extern_cpp` struct fields under their source names via `IRExternCppDecoration`, which means bypassing `_generateUniqueName`. The bypass collided twice.

First, the pass needed to tell user-declared fields from compiler-synthesized ones, and `nameHint.startsWith("$")` is incomplete. Checker-synthesized `VarDecl`s do use `$` names (`$bit_field_backing_N`, `$init`, `$__syn_*`). But `visitInheritanceDecl` (`slang-lower-to-ir.cpp` ~11091) creates the base-subobject `IRStructKey` with the plain hint `base`. Consider this example:

```hlsl
struct Base { float x; };
struct Derived : Base { float base; };
```

When `Derived` is emitted with `__extern_cpp` field names, it has two fields hinted `base`: the base subobject and the source field. Normally `_generateUniqueName` names them `base_0` and `base_1`; emitted verbatim, C++ and NVRTC reject the duplicate member. That also breaks `-cpu` and `-cuda` runtime builds, because their intermediate source is CPPSource/CUDASource. The two possible fixes are a per-struct duplicate-hint guard, or recording "declared in source" at the producer, `lowerMemberVarDecl` ([a `$`-prefixed name hint is not a reliable compiler-synthesized marker](../learnings/1793305640614-slang-ir-a-prefixed-name-hint-is-not-a-reliable-co.md)).

Second, the duplicate-hint guard ("a duplicated hint keeps its generated name") looked fine but still collided. The emitter's generated name, from the module-wide counter in `_generateUniqueName`, can equal a verbatim source field named `base_0`, an explicit per-field `__extern_cpp base_0`, or a source field that matches the scrubbed `$bit_field_backing` spelling. Each patch that tried to predict the emitter's output missed a case. What worked was for the pass to name every hinted field of the struct itself, with a local used-name set: reserve the explicit `ExternCpp` names, keep unshared non-`$` source names, then number the rest as `hint_<smallest unused n>`. The result is distinct by construction and deterministic per struct. The general rule: if an IR pass must make names unique, it assigns all names in that scope rather than leaving some to a later, stateful namer it cannot see ([naming members from an IR pass: own the struct's whole name set](../learnings/1793310523863-naming-members-from-an-ir-pass-own-the-struct-s-wh.md)).

Any change that bypasses uniquing also needs its own keyword and collision handling. Slang accepts many C++ keywords as field names (`default`, `new`, `long`, `int`, `bool`, `union`, `template`, and others), only the `_N` suffix keeps them valid C++, and no keyword dictionary exists (the TODO at `slang-emit-c-like.cpp` ~1007) ([same](../learnings/1793305640614-slang-ir-a-prefixed-name-hint-is-not-a-reliable-co.md)). The broader C++/CUDA emitter is on [[wiki/concepts/slang-backends-cuda-cpp.md]].

**Source learnings (3):**
- [-obfuscate: IR clones that keep [export] get the same emitted name](../learnings/1793263779351-obfuscate-ir-clones-that-keep-export-get-the-same-.md) — `generateName` uses the linkage name verbatim under `-obfuscate`, so a clone keeping export duplicates its original's name (#14004)
- [A `$`-prefixed name hint is not a reliable compiler-synthesized marker](../learnings/1793305640614-slang-ir-a-prefixed-name-hint-is-not-a-reliable-co.md) — base-subobject key hinted `base` duplicates a source field; C++ keyword field names need the `_N` suffix (#14043)
- [Naming members from an IR pass: own the struct's whole name set](../learnings/1793310523863-naming-members-from-an-ir-pass-own-the-struct-s-wh.md) — generated `base_0` collides with source and explicit names; assign all names per struct with a local used-name set

_Catalog: [[wiki/index.md]]_
