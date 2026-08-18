---
title: "Slang extension-method name hints drop the Type. qualifier (getNameForNameHint)"
type: learning
topic: slang-compiler
source: learnings/1781199860108-slang-extension-method-name-hints-drop-the-type-qu.md
---

# Slang extension-method name hints drop the Type. qualifier (getNameForNameHint)

## Symptom
SPIR-V `-g3` debug function names (and other name-hint-derived generated identifiers) for methods declared in an `extension Example { ... }` come out UNQUALIFIED (`extensionMethod`) where struct-body methods are correctly qualified (`Example.baseMethod`). Surfaces on `OpString`, `OpName`, and `DebugFunction` records. (shader-slang/slang#11563)

## Root cause
`getNameForNameHint(IRGenContext*, Decl*)` — `source/slang/slang-lower-to-ir.cpp:1506-1585` — builds the qualified name hint by walking `decl->parentDecl` and joining `parentName + "." + leaf`. Its parent-skip block (≈1544-1563) has cases for `GenericDecl`, `FileDecl`, `ModuleDecl` but **no `ExtensionDecl` case**. For an extension method the parent is the *anonymous* `ExtensionDecl` (no `getName()`), so the recursive call hits the no-name early-out (`if (!leafName) return String()`, 1520-1523) → empty parentName → returns the bare leaf. The SPIR-V debug name is simply the function's `IRNameHintDecoration` (emit side correct: `slang-emit-spirv.cpp:10099-10125`, `slang-lower-to-ir.cpp:14181-14200`), so the defect is at the name-hint source, not the emitter.

## Fix pattern (codebase-preferred)
When the parent decl is an `ExtensionDecl`, derive the qualifier from the extension's `targetType` (`slang-ast-decl.h:370`, `class ExtensionDecl` :367) — resolve `as<DeclRefType>(ext->targetType.type)->getDeclRef().getDecl()` and recurse into that, with a null/non-DeclRefType fallback to current behavior. This mirrors the established mangling precedent at `source/slang/slang-mangle.cpp:595-615`, which already emits `getTargetType(...)` for an extension with the comment *"A non generic extension doesn't have a name worth emitting, and we should base things on its target type instead."* Helper: `getTargetType(ASTBuilder*, DeclRef<ExtensionDecl>)` at `slang-syntax.h:309`.

## Blast radius to watch
`getNameForNameHint` feeds ALL name hints, so qualifying extension methods changes generated identifier names across targets (not just SPIR-V debug) → existing FileCheck baselines may shift `extensionMethod`→`Example_extensionMethod`. Expected/cosmetic; run the suite and update baselines. For the regression test, heed the `-g2/-g3 -target spirv-asm` source-embedding trap (the full source incl. `//CHECK` lines is embedded as a DebugSource OpString → naive `CHECK-NOT` self-matches).

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1781199860108-slang-extension-method-name-hints-drop-the-type-qu.md`_
