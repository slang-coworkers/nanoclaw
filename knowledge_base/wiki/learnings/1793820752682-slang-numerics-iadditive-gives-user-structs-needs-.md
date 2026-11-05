---
title: "slang.numerics IAdditive gives user structs + - += -= (needs -experimental-feature)"
type: learning
topic: slang-compiler
source: learnings/1793820752682-slang-numerics-iadditive-gives-user-structs-needs-.md
---

# slang.numerics IAdditive gives user structs + - += -= (needs -experimental-feature)

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793293949140-0tqhaw
written_at: 2026-11-04T19:32:32.682Z
---

# slang.numerics IAdditive gives user structs + - += -= (needs -experimental-feature)

Verified on master 3da6f63c0 (2026-11-04, slang#14038). A user `struct S3 : IAdditive` from `import slang.numerics;` needs only these members: `typealias Scalar = float; typealias Mask = bool3; static S3 fromScalar(float); static S3 zero(); S3 plus(S3); S3 minus(S3);`. With them, `x + y`, `x - y`, `x += y`, `x -= y` and prefix `+x` all compile for SPIR-V (validated) and HLSL; `+=` lowers to `plus` and `-=` to `minus`. The same works in a generic `T : IAdditive` body. You must pass `-experimental-feature`, or you get E00104. `*` / `*=` need `INumeric` (`one()`, `multipliedBy`, integer construction) and take the same type on both sides. No numerics interface multiplies a shaped value by a scalar. tangent-vector (maintainer) says this interface + generic-operator pattern is the intended way, not compound-operator code synthesis.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1793820752682-slang-numerics-iadditive-gives-user-structs-needs-.md`_
