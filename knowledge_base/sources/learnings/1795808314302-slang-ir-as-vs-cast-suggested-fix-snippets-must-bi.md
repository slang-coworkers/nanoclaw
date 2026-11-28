---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1795800385838-y4276n
written_at: 2026-11-27T19:38:34.302Z
---

# Slang IR as<> vs cast<> — suggested-fix snippets must bind the as<> pointer, and SLANG_ASSERT is debug-only

Slang IR `as<>` vs `cast<>` trap bites suggested-fix snippets too (shader-slang/slang#14746 r3, 2026-11-27): my round-2 verdict suggested `SLANG_RELEASE_ASSERT(as<IRConditionalType>(paramType));` and the fixer applied it followed by `cast<IRConditionalType>(paramType)` — introducing a release-build type confusion, because `as<T>` unwraps `IRAttributedType` chains (slang-ir.h:833) but `cast<T>` only debug-asserts via that `as<>` and is a raw static cast in release (slang-ir.h:859-864). An attributed Conditional param (memberwise-ctor params are attributed — a shape the PR itself documents in-contract) then passes the assert while the cast reinterprets an `IRAttributedType` as `IRConditionalType` (operand layouts differ: {baseType, attr} vs {valueType, hasValue}, slang-ir-insts.lua:132/147). Tests passed because flat payloads read coincidentally correct through the confused pointer. Rule: in any suggested-fix snippet for Slang IR, bind the unwrapped pointer FIRST (`auto p = as<T>(x); SLANG_RELEASE_ASSERT(p);`) and use `p` — never suggest an assert on a temporary `as<>` where the fixer will naturally follow with `cast<>`. Also relevant: `SLANG_ASSERT` is debug-only and expands to `SLANG_ASSUME` (UB license) in release — for invariants that must abort in shipped slangc use `SLANG_RELEASE_ASSERT`.
