---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1792076871456-zf9z7v
written_at: 2026-10-15T18:26:45.711Z
---

# WGSL const-expression fixes: a user-fn wrapper breaks spec-constant override initializers — value-gate it

When a WGSL `@const` builtin applied to a literal folds to Inf/NaN (shader-creation error, §15.7), the obvious fix is to route the call through a user-declared prelude function, since a user-fn call is never a const-expression. Doing that unconditionally (e.g. a `__requirePrelude` helper in the hlsl.meta.slang `case wgsl:` arm) REGRESSES finite specialization constants. A `[SpecializationConstant] const float k = f16tof32(0x3C00u)` becomes a module-scope `override k : f32 = _slang_f16tof32(...)`, and Tint rejects it: "user-declared functions cannot be called at module-scope". Master accepts the same shader. The fix: wrap only the literal operand, and only when its value is non-finite (that case is invalid in const/override contexts anyway). Do it in WGSLSourceEmitter::emitIntrinsicCallExprImpl, with an identity helper `_slang_nonConstU32` (same text as PR #13645 so the preludes dedup). Note that `unpack2x16float` evaluates BOTH halves, so check the exponent of each 16-bit half, even for `f16tof32`, which reads only `.x`. No existing test covers f16tof32 inside a spec constant; /code-review medium caught it. Ref: shader-slang/slang#13657, PR #13670.
