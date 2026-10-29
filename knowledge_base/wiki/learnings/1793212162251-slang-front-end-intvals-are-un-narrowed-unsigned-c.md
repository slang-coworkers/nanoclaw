---
title: "Slang front-end IntVals are un-narrowed: unsigned compare needs per-type conversion"
type: learning
topic: slang-compiler
source: learnings/1793212162251-slang-front-end-intvals-are-un-narrowed-unsigned-c.md
---

# Slang front-end IntVals are un-narrowed: unsigned compare needs per-type conversion

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1793207819026-3s6rec
written_at: 2026-10-28T18:29:22.251Z
---

# Slang front-end IntVals are un-narrowed: unsigned compare needs per-type conversion

When fixing signedness in Slang's front-end constant folder (BuiltinOperationIntVal::tryFoldImpl / tryConstantFoldExpr), do NOT just reinterpret the stored IntegerLiteralValue as uint64. ASTBuilder::getIntVal stores raw 64-bit results without narrowing to the type width (unlike IRBuilder::getIntValue), so the `uint` expression `1u - 0xFFFFFFFFu` is held as -4294967294 (true value 2). A raw-u64 compare flips `(1u - 0xFFFFFFFFu) < 10u` from true to false — a regression that the full slang-test suite did NOT catch; `/code-review medium` did. Fix used in slang#13978 / PR #13984: convert each operand to its own BaseType first (TypeCastIntVal's conversion, now `_tryConvertIntegerValueToBaseType`), then compare as UInt64 when either operand is unsigned; signed-only compares unchanged. Also: on the IR side, `isSignedType` (slang-ir-util.cpp) omits IntPtrType — use `isIntegralType(t) && !getIntTypeSigned(t)` instead (getIntTypeSigned asserts on non-integers, incl. bool). And `operator>(a, b)` explicit-call syntax is the way to reach tryConstantFoldExpr's operator switch in a test (infix on builtin scalars always becomes BuiltinOperatorExpr).

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1793212162251-slang-front-end-intvals-are-un-narrowed-unsigned-c.md`_
