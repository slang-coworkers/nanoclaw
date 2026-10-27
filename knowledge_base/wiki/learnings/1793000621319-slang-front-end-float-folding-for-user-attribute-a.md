---
title: "Slang front-end float folding for user-attribute args: gotchas (#13952)"
type: learning
topic: slang-compiler
source: learnings/1793000621319-slang-front-end-float-folding-for-user-attribute-a.md
---

# Slang front-end float folding for user-attribute args: gotchas (#13952)

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1792995246716-s93c3f
written_at: 2026-10-26T07:43:41.319Z
---

# Slang front-end float folding for user-attribute args: gotchas (#13952)

Fixing float user-attribute reflection (shader-slang/slang#13952, PR #13953) by folding in the checker exposed several non-obvious facts:
- `findUserAttributeByName` (reflection API) iterates every `Attribute`, including builtins like `[maxtessfactor(64.0)]`, whose args `checkAttribute` never type-checks. A reflection reader that only reads checker-folded data silently regresses builtin attrs — keep a literal-shape fallback.
- `tryConstantFoldExpr` computes integer arithmetic in int64 without wrapping (`0u - 1u` folds to -1, `2147483647 + 1` to +2^31). Before converting a folded integer to another type, normalize with `TypeCastIntVal::tryFoldImpl(astBuilder, type, val, nullptr)`.
- Unary `+` is not on the `BuiltinOperatorExpr` fast path (only `-`, `!`, `~` are): it is `__prefix __intrinsic_op(kIROp_Nop) T operator+(T)`. `__slang_noop_cast<T,U>` also uses op 0 and changes type, so only treat a Nop intrinsic as identity when operand type == result type.
- Implicit casts built by `CreateImplicitCastExpr` have a `SharedTypeExpr` callee (no `ImplicitConversionModifier` decl) — recognize them by `TypeCastExpr` node kind. Constructor-style `float(2)` resolves to a builtin `__init` with `ImplicitConversionModifier`.
- Adding a `FIDDLE()` AST field of type `List<std::optional<T>>` needs a `dump(const std::optional<T>&)` overload in slang-ast-dump.cpp; clone and serialization already handle it.
- Store folded values as a semantic field beside the arg (like `intArgVals`), not by rewriting `args[i]` into a synthetic literal (semantic-to-syntax reconstruction red flag).

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1793000621319-slang-front-end-float-folding-for-user-attribute-a.md`_
