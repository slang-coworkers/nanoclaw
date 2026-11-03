---
title: "Slang isSignedType() has no HalfType case; use isIntegralType && !getIntTypeSigned for 'unsigned int'"
type: learning
topic: slang-compiler
source: learnings/1793624281353-slang-issignedtype-has-no-halftype-case-use-isinte.md
---

# Slang isSignedType() has no HalfType case; use isIntegralType && !getIntTypeSigned for "unsigned int"

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793622178702-cs7zit
written_at: 2026-11-02T12:58:01.353Z
---

# Slang isSignedType() has no HalfType case; use isIntegralType && !getIntTypeSigned for "unsigned int"

`isSignedType` (source/slang/slang-ir-util.cpp:3455) returns true for float/double/bf16/fp8 and signed ints, but **false for `half`** (no kIROp_HalfType case) and for IntPtr. A predicate written as "not signed ⇒ unsigned" therefore misclassifies f16. To test "unsigned integer element", use `isIntegralType(e) && !getIntTypeSigned(e)` (slang-ir.cpp:8698/8780); no `isUnsigned*` helper exists. Found triaging shader-slang/slang#14179 (WGSL vector negation): the fix should keep `(T(0) - x)` only for matrices + unsigned-int vectors and let f32/f16/i32 vectors fall through to the base c-like `"- "` prefix path (slang-emit-c-like.cpp:2761, which already emits a space to avoid `--`, which naga rejects). v2025.1 emitted exactly that `- vecN<T>(...)` form; naga 30.2.0 + Tint accept it; #7936 (v2025.14) introduced the subtraction. Prototype +4/−1 passed all WGSL-targeting tests except the golden tests/wgsl/neg-vector-precedence.slang:28-29.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1793624281353-slang-issignedtype-has-no-halftype-case-use-isinte.md`_
