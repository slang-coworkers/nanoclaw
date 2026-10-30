---
title: "Slang `__extern_cpp` naming: struct fields, linkage names, and verbatim emission"
type: concept
group: slang-backends
tags: [extern_cpp, ExternCppModifier, IRExternCppDecoration, cpp, hpp, cuda, name-mangling, linkage, IRStructKey, generateName, emit-c-like, varying-flattening, prelude, slang-14028]
source_count: 4
---

# Slang `__extern_cpp` naming: struct fields, linkage names, and verbatim emission

`__extern_cpp` asks Slang to emit a declaration under its source name so that C++ host code can refer to it. Two layers are involved: the `ExternCppModifier` changes the declaration's mangled linkage name, and the `IRExternCppDecoration` changes the name the emitter prints. On struct fields the two layers interact badly. This page records how each layer behaves, why the obvious fixes for unmangled field names miscompile, and where a principled fix belongs; the facts come from triaging #14028 and reviewing PR #14043 (HEAD 9b3ac252d, 2026-10-29). Other C++ host-target behavior (layout, `export` vs `public` rooting, header-only prototypes) is on [slang-backends-cuda-cpp](slang-backends-cuda-cpp.md).

## TL;DR

- **Struct-level `__extern_cpp` keeps the struct's name but not its field names.** `lowerMemberVarDecl` reads only the field's own modifiers, so fields still print as `dist2_0`. `-no-mangle` does not help, because `isGlobalDecl` excludes struct members despite its comment.
- **Never add `ExternCppModifier` to a field to unmangle it.** The modifier mangles to the bare name, so same-named fields of two `__extern_cpp` structs share one linkage name, the IR linker merges them into ONE `IRStructKey`, and per-key decorations bleed between structs (`Right.x : COLOR0`).
- **The per-field `__extern_cpp` workaround used in `tests/headers/*.slang` is safe only while field names are unique across all `__extern_cpp` structs.**
- **Name a field with `IRExternCppDecoration` (name only) and keep its qualified linkage.**
- **Every C-like emitter prints `IRExternCppDecoration` verbatim** (HLSL, GLSL, Metal, WGSL, CUDA, C++). `generateName` returns it before `_generateUniqueName`, so it skips scrubbing (`$`→`x24`, `_S` escape, `__` collapse) and the `_N` suffix, which was the only guard for C++-keyword field names; there is no reserved-word table.
- **Do target-specific naming in an IR pass gated in `linkAndOptimizeIR`, for C++/CUDA/torch targets only,** as `introduceExplicitGlobalContext` does for `KernelContext` keys under CPPHeader. Adding the decoration at lowering leaks verbatim names into GPU output.
- **Passes that make or reuse keys carry the names along:** WGSL `_flattenNestedStructs` moves all decorations (ExternCpp included) to fresh keys, Metal copies only name hints, and `lowerBufferElementTypeToStorageType` builds `<S>_natural_N` structs that reuse the original keys, collisions included.
- **Skip keys without a name hint** (this handles `-obfuscate`, which adds no hints) and treat `$`-prefixed hints as compiler-synthesized, because the lexer never produces `$`.
- **`$` is non-standard C++ but g++ and clang accept it,** so "C++ rejects `$`" is not a valid justification.
- **`-target hpp` prototypes name parameters `_0, _1, ...`** because header mode deletes the bodies and their IRParams; `-target cpp` keeps the real names.
- **slangc cannot override the C++/CUDA prelude:** `main.cpp` looks for `-embed-prelude`, but slang-options never registers it (E00017). Use the `setLanguagePrelude` API, or rewrite the `#include` line.
- **The full test suite passed a broken version of PR #14043.** Probe GPU targets, keyword field names, synthesized names and same-named fields across structs explicitly.

## Field names under struct-level `__extern_cpp`

Consider a struct marked `__extern_cpp` so that a generated header can be included by host code. The struct keeps its name, but its fields are still emitted with mangled names such as `dist2_0`, because `lowerMemberVarDecl` (`slang-lower-to-ir.cpp` ~:12824) looks only at the field's own modifiers and never at the parent's. The `-no-mangle` option does not help: `isGlobalDecl` (`slang-check-decl.cpp` ~:3255) excludes struct members, although the comment there says it covers fields. The workaround in `tests/headers/generate-hpp-header.slang` is to put `__extern_cpp` on each field as well [slang -target hpp/cpp: struct-level __extern_cpp does not unmangle fields; slangc -embed-prelude is dead](../learnings/1793291532337-slang-target-hpp-cpp-struct-level-extern-cpp-does-.md).

## Why `ExternCppModifier` on a field miscompiles

`ExternCppModifier` mangles a declaration to its bare name (`slang-mangle.cpp` ~:968-974). On a struct field, two `__extern_cpp` structs that both have a field `x` therefore give those fields the same linkage name. The IR linker deduplicates by mangled name, so it merges them into one `IRStructKey`, and per-key decorations bleed from one field to the other. Consider:

```slang
struct Left  { __extern_cpp float x : COLOR0; }
struct Right { __extern_cpp float x : TEXCOORD0; }
```

The HLSL output gives `Right.x : COLOR0`. Without the per-field modifier the output is correct (`x_0 : COLOR0` and `x_1 : TEXCOORD0`). So the per-field workaround is safe only when field names are unique across all `__extern_cpp` structs, and a fix for unmangled field names must not add `ExternCppModifier` to fields during semantic checking. The principled shape adds `IRExternCppDecoration` to the key at lowering and keeps the qualified linkage; `slang-ir-explicit-global-context.cpp` (~:442-454) is the precedent [slang: __extern_cpp on a struct FIELD gives it a bare linkage name — same-named fields across structs merge into one IRStructKey](../learnings/1793292641974-slang-extern-cpp-on-a-struct-field-gives-it-a-bare.md) [Slang: IRExternCppDecoration is printed verbatim by EVERY C-like emitter — gate C++-only naming by target](../learnings/1793298372178-slang-irexterncppdecoration-is-printed-verbatim-by.md).

## Verbatim emission bypasses every name guard

The decoration solves the linkage problem but not the emission problem. `CLikeSourceEmitter::generateName` (`slang-emit-c-like.cpp` ~:1251) returns an `IRExternCppDecoration` name before it reaches `_generateUniqueName`, for every C-like target. That skips `appendScrubbedName` (`$`→`x24`, the `_S` escape, `__` collapse) and the `_N` suffix. The suffix was the only thing keeping C++-keyword field names valid, because there is no reserved-word table (there is a TODO near ~:1007) [Slang: IRExternCppDecoration is printed verbatim by EVERY C-like emitter — gate C++-only naming by target](../learnings/1793298372178-slang-irexterncppdecoration-is-printed-verbatim-by.md) [Slang emit: IRExternCppDecoration on a struct key bypasses all name scrubbing; Metal/WGSL varying flattening transfers it to fresh keys](../learnings/1793309882886-slang-emit-irexterncppdecoration-on-a-struct-key-b.md).

Adding the decoration to struct keys at lowering, which is target-independent, therefore leaks into GPU output. GLSL-reserved names such as `sample` break, and the checker-synthesized `$bit_field_backing_N` gets its `$` printed. Varying legalization makes it worse: `_flattenNestedStructs` (`slang-ir-legalize-varying-params.cpp` ~:3790) creates fresh keys, WGSL moves all decorations to them, including ExternCpp, while Metal copies only name hints, so verbatim names on GPU targets can duplicate members (`x`) in the flattened stage-input struct. `lowerBufferElementTypeToStorageType` (Default policy, which also runs on CPU and CUDA) builds `<S>_natural_N` storage structs that reuse the original keys, so the chosen names carry over, and so do any collisions [Slang: IRExternCppDecoration is printed verbatim by EVERY C-like emitter — gate C++-only naming by target](../learnings/1793298372178-slang-irexterncppdecoration-is-printed-verbatim-by.md) [Slang emit: IRExternCppDecoration on a struct key bypasses all name scrubbing; Metal/WGSL varying flattening transfers it to fresh keys](../learnings/1793309882886-slang-emit-irexterncppdecoration-on-a-struct-key-b.md).

For these reasons such a naming pass belongs in `linkAndOptimizeIR` (`slang-emit.cpp`), gated to C++/CUDA/torch targets, as `introduceExplicitGlobalContext` adds ExternCpp to `KernelContext` keys only for CPPHeader. Two conveniences hold inside such a pass. Under `-obfuscate` name hints are never added, so skipping keys without a name hint handles obfuscation for free. `$` never appears in lexer identifiers, so a `$`-prefixed hint is compiler-synthesized and should keep the scrubbed name. Do not justify the `$` handling with "C++ rejects `$`": g++ and clang accept `$` in identifiers by default; it is non-standard, not rejected [Slang: IRExternCppDecoration is printed verbatim by EVERY C-like emitter — gate C++-only naming by target](../learnings/1793298372178-slang-irexterncppdecoration-is-printed-verbatim-by.md) [Slang emit: IRExternCppDecoration on a struct key bypasses all name scrubbing; Metal/WGSL varying flattening transfers it to fresh keys](../learnings/1793309882886-slang-emit-irexterncppdecoration-on-a-struct-key-b.md).

The broken version of PR #14043 passed the 11k-test suite; `/code-review medium` probes caught the GPU-target leaks. For a naming change, probe GPU targets, keyword field names, synthesized names and same-named fields across structs, not only the C++ header the issue names [Slang: IRExternCppDecoration is printed verbatim by EVERY C-like emitter — gate C++-only naming by target](../learnings/1793298372178-slang-irexterncppdecoration-is-printed-verbatim-by.md).

## Header mode and prelude override

In `-target hpp`, function prototypes name their parameters `_0, _1, ...`. Header mode deletes the function bodies, and the IRParams with them (`slang-emit-c-like.cpp` ~:5513), so `emitFuncDecl` falls back to `_<i>` (~:4149); `-target cpp` keeps the real names [slang -target hpp/cpp: struct-level __extern_cpp does not unmangle fields; slangc -embed-prelude is dead](../learnings/1793291532337-slang-target-hpp-cpp-struct-level-extern-cpp-does-.md).

slangc has no working way to override the C++/CUDA prelude. `source/slangc/main.cpp` (~:59-67) checks argv for `-embed-prelude` to skip the absolute-path prelude `#include`, but `slang-options.cpp` never registers that flag, so slangc rejects it with E00017. Use the `setLanguagePrelude` API, or rewrite the `#include` line with sed [slang -target hpp/cpp: struct-level __extern_cpp does not unmangle fields; slangc -embed-prelude is dead](../learnings/1793291532337-slang-target-hpp-cpp-struct-level-extern-cpp-does-.md).

**Source learnings (4):**
- [struct-level `__extern_cpp` does not unmangle fields (`lowerMemberVarDecl`), `-no-mangle` skips members, hpp params `_0`, `-embed-prelude` is dead](../learnings/1793291532337-slang-target-hpp-cpp-struct-level-extern-cpp-does-.md)
- [`ExternCppModifier` on a field gives a bare linkage name; same-named fields merge into one `IRStructKey` (`Right.x : COLOR0`)](../learnings/1793292641974-slang-extern-cpp-on-a-struct-field-gives-it-a-bare.md)
- [`IRExternCppDecoration` printed verbatim by every C-like emitter; gate naming in `linkAndOptimizeIR`; obfuscation and `$` hints](../learnings/1793298372178-slang-irexterncppdecoration-is-printed-verbatim-by.md)
- [verbatim names skip scrubbing and the `_N` suffix (no keyword table); WGSL/Metal varying flattening and `<S>_natural_N` reuse keys; g++/clang accept `$`](../learnings/1793309882886-slang-emit-irexterncppdecoration-on-a-struct-key-b.md)

_Catalog: [[wiki/index.md]]_
