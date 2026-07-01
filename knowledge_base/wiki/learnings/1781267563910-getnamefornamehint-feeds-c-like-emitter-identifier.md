---
title: "getNameForNameHint feeds C-like emitter identifiers (not just SPIR-V debug); ExtensionDecl is anonymous"
type: learning
topic: slang-compiler
source: learnings/1781267563910-getnamefornamehint-feeds-c-like-emitter-identifier.md
---

# getNameForNameHint feeds C-like emitter identifiers (not just SPIR-V debug); ExtensionDecl is anonymous

# getNameForNameHint feeds C-like emitter identifiers (not just SPIR-V debug); ExtensionDecl name-hint qualification

From fixing shader-slang/slang#11563 (extension methods emitted unqualified SPIR-V debug names; PR #11581).

## Where qualified IR name hints come from

`getNameForNameHint(IRGenContext*, Decl*)` in `source/slang/slang-lower-to-ir.cpp:1506` builds a qualified hint (`Parent.leaf`) by recursing into `decl->parentDecl` and joining names, **skipping parents that shouldn't contribute**: `GenericDecl`, `FileDecl`, and `ModuleDecl` (the module has a name but is deliberately skipped to avoid long module-qualified global names). It feeds `IRNameHintDecoration` (`addNameHint`).

## Two non-obvious facts

1. **The name hint is NOT SPIR-V-debug-only.** `IRNameHintDecoration` drives SPIR-V `OpName`/`DebugFunction` debug names **and** the basis for generated identifiers in the C-like emitters (HLSL/CUDA/etc., e.g. a lowered helper named `Example_extensionMethod`). It does **not** drive mangled symbol names (those have separate handling) and has no semantic/runtime effect. When changing name-hint logic, do NOT claim "debug output only" — say "name hints → SPIR-V debug names + C-like generated identifiers, cosmetic, mangled names/runtime unchanged." (codex CODE_REVIEW caught this overclaim.)

2. **`ExtensionDecl` is anonymous** (`getName()` is null). A method in `extension Example { ... }` has parent chain `method → (anonymous) ExtensionDecl`, so `getNameForNameHint(ExtensionDecl)` returns empty at the no-name early-out and the qualifier is dropped — the method gets the bare leaf `extensionMethod` instead of `Example.extensionMethod`. Struct-body methods work because their parent is the named `StructDecl`.

## The fix pattern (and a compile trap)

To qualify an extension member, redirect through the extended type's decl before the existing recursion:
```cpp
if (auto extensionParentDecl = as<ExtensionDecl>(parentDecl))
{
    if (auto targetDeclRefType = as<DeclRefType>(extensionParentDecl->targetType))
        parentDecl = as<ContainerDecl>(targetDeclRefType->getDeclRef().getDecl());
}
```
**Compile trap:** `Decl::parentDecl` is typed `ContainerDecl*`, but `getDeclRef().getDecl()` returns `Decl*`. Assigning directly fails to compile (`invalid conversion from Decl* to ContainerDecl*`). Wrap in `as<ContainerDecl>(...)`. The cast doubles as a fallback gate: a `DeclRefType` target whose decl isn't a `ContainerDecl` → null → the `if (!parentDecl)` guard returns the leaf; a non-`DeclRefType` target (extension on a builtin/vector/array) leaves `parentDecl` as the anonymous ExtensionDecl → empty recursive hint → the empty-parent-name guard returns the leaf. Both preserve the prior unqualified behavior. This mirrors the target-type basis that symbol mangling uses for extensions (`slang-mangle.cpp` emits an extension marker + the target type), though the mechanism differs.

## Test/verify note (recurring)

`//TEST:SIMPLE(filecheck=...)` tests are IGNORED by `slang-test` when FileCheck isn't installed locally ("FileCheck is not available"). Verify the actual output with `slangc -target spirv-asm ... | grep` instead; CI runs the real FileCheck. At `-g3` the embedded source lives in an OpString, so a CHECK for `"Example.method"` is self-match-proof only because interior quotes are escaped `\"` in the embed and call sites use a different case — do NOT add CHECK-NOT on the bare name.

Verified at HEAD 89985ed35 of fix/issue-11563 (master eb9403ef5).

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1781267563910-getnamefornamehint-feeds-c-like-emitter-identifier.md`_
