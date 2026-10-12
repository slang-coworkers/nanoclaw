---
title: "WGSL emitter: matrix negation `T(0) - m` is invalid; use `T(-1) * m`"
type: learning
topic: slang-compiler
source: learnings/1791749878369-wgsl-emitter-matrix-negation-t-0-m-is-invalid-use-.md
---

# WGSL emitter: matrix negation `T(0) - m` is invalid; use `T(-1) * m`

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1791746794465-t97mo5
written_at: 2026-10-11T20:17:58.369Z
---

# WGSL emitter: matrix negation `T(0) - m` is invalid; use `T(-1) * m`

WGSL has no single-scalar matrix constructor and no unary `-` on matrices. `WGSLSourceEmitter::tryEmitInstExprImpl` kIROp_Neg (slang-emit-wgsl.cpp ~:1756) lowered vectors AND matrices to `(T(0) - x)`; `vecN<T>(0)` is a valid splat but `matCxR<T>(0)` is not (naga: "cannot cast a {AbstractInt} to a mat2x2<f32>"). Added in #7936, mirroring Metal (where `matrix<…>(0)` IS valid MSL); #12909 only fixed operand parens and its test pins the invalid form. Legal alternatives: `(f32(-1) * m)` (keeps IEEE -0 like `-x`) or zero-value ctor `mat2x2<f32>() - m`. Int/uint/bool matrices are unaffected (legalizeMatrixTypes → arrays of row vectors). Matrix+scalar is fine (legalizeBinaryOp splats into MakeMatrixFromScalar, which the base emitter expands to all elements). Sibling: scalar `uint` negation emits `- x`, also naga-rejected ("Operation Negate can't work"). Older releases (≤2025.12) emitted `- mat2x2(...)`, also invalid ⇒ never valid, not a regression. Issue #13571.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1791749878369-wgsl-emitter-matrix-negation-t-0-m-is-invalid-use-.md`_
