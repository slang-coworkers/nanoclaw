---
title: "Slang getOrCreate interns on syntax class — DeclRefType vs ThisType dual-representation bugs"
type: learning
topic: slang-compiler
source: learnings/1780529958264-slang-getorcreate-interns-on-syntax-class-declreft.md
---

# Slang getOrCreate interns on syntax class — DeclRefType vs ThisType dual-representation bugs

## Slang type interning keys on the syntax class, not just operands

`ASTBuilder::getOrCreate<T>(...)` (`source/slang/slang-ast-builder.h:287-296`) builds a `ValNodeDesc` whose key includes `getSyntaxClass<T>()` **plus** the operands, then dedups via `m_cachedNodes`. Consequence: `getOrCreate<ThisType>(base)` and `getOrCreate<DeclRefType>(base)` over the **identical** `base` operand produce two **distinct** `Type*`. This is a recurring source of type-identity bugs — anything relying on pointer-equality type comparison sees the "same" logical type as two objects.

## DeclRefType::create routes by DeclRef base kind

`DeclRefType::create` (`source/slang/slang-syntax.cpp`, ThisTypeDecl branch ~896-908) special-cases a `ThisTypeDecl` only for:
- `DirectDeclRef` base → `getOrCreate<ThisType>` (a `ThisType`);
- `LookupDeclRef` base → `lookupDeclRef->getWitness()->getSub()` (the witness sub-type).

Any other base — notably a `MemberDeclRef` (the `This` of a substituted generic interface like `IFoo<int,N>`) — falls through to `getOrCreate<DeclRefType>` (~917-918), yielding a plain `DeclRefType` instead of a `ThisType`. That's the #11465 bug: the same interface-`This` exists as both a `ThisType` and a `DeclRefType`.

`ThisType : public DeclRefType` (`slang-ast-type.h:1308`, same single DeclRefBase operand), so unifying these is representation-safe and substitutions are preserved (`This.<assoc>` lookups still resolve). The catch when fixing: `createDefaultSubstitutionsIfNeeded(...)` currently lives only in the `DirectDeclRef` arm — a unifying fix must keep that call.

## Risk surface when changing which node a `This` lowers to
IR lowering has distinct `ValLoweringVisitor::visitThisType` vs `visitDeclRefType` (`slang-lower-to-ir.cpp`); `visitThisType` relies on `context->thisType.irType` / emits `IRThisType`. Also `maybeUseSynthesizedDeclForLookupResult`, `_isTrivialLookupFromInterfaceThis`, canonicalization `DeclRefType::_substituteImplOverride`, and `ASTBuilder::getMemberDeclRef` all special-case `ThisTypeDecl`. Changing the node kind shifts these paths — build + run frontend/semantic tests before claiming done.

Source: triage of shader-slang/slang#11465 (DeclRefType↔ThisType via MemberDeclRef), 2026-06-04. Related: #11368 worked around this with structural matching.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1780529958264-slang-getorcreate-interns-on-syntax-class-declreft.md`_
