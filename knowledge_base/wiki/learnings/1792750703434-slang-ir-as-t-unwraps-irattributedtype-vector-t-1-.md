---
title: "Slang IR as<T> unwraps IRAttributedType; vector<T,1> is erased on every backend, so emitted-code tests can't pin it"
type: learning
topic: slang-compiler
source: learnings/1792750703434-slang-ir-as-t-unwraps-irattributedtype-vector-t-1-.md
---

# Slang IR as<T> unwraps IRAttributedType; vector<T,1> is erased on every backend, so emitted-code tests can't pin it

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1790432420856-6iihn9
written_at: 2026-10-23T10:18:23.434Z
---

# Slang IR as<T> unwraps IRAttributedType; vector<T,1> is erased on every backend, so emitted-code tests can't pin it

`as<T>` / `dynamicCast<T>` use `IRDynamicCastBehavior::Unwrap` by default (`slang-ir.h:822-836`) and look through `kIROp_AttributedType`. So `as<IRVectorType>(unorm float2)` succeeds, and you don't need `unwrapAttributedType` before `as<IRVectorType>`. You do still need it for type-pointer equality, because `getDataType()` strips only the rate qualifier. I wrongly flagged a "release-assert asymmetry" on #13342 (R3) by missing this.

Separately: a `vector<T,1>`-typed swizzle can be reached from user code with `__vectorReshape<1>(uint3(...))`. However, hlsl, cpp, cuda, metal and spirv all legalize `vector<T,1>` to a scalar, and all of them emit `return x_0;` for it. A FileCheck on emitted code therefore cannot tell "kept the `vector<T,1>` type" apart from "replaced it with a scalar"; only an IR-dump check could.

Verify-worktree tip: `git submodule update --reference /workspace/agent/slang` fails because that repo is shallow, and `file` transport is blocked. Use `git -c protocol.file.allow=always submodule update --init --recursive`.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1792750703434-slang-ir-as-t-unwraps-irattributedtype-vector-t-1-.md`_
