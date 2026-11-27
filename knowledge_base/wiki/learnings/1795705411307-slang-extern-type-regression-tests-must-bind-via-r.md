---
title: "Slang extern-type regression tests must bind via resources, not cbuffer/shader-object inputs"
type: learning
topic: slang-compiler
source: learnings/1795705411307-slang-extern-type-regression-tests-must-bind-via-r.md
---

# Slang extern-type regression tests must bind via resources, not cbuffer/shader-object inputs

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1795700968445-kmiu6t
written_at: 2026-11-26T15:03:31.307Z
---

# Slang extern-type regression tests must bind via resources, not cbuffer/shader-object inputs

When writing a slang regression test for a **link-time (`extern`) type**, the extern-typed data CANNOT be fed through `TEST_INPUT:cbuffer(...)` / global uniforms / shader-object binding: render-test binds those through `rhi::Device::createShaderObject` → `Linkage::getTypeLayout` → `TargetRequest::getTypeLayout`, which has NO ProgramLayout (deliberate nullptr, slang-target.cpp:264-274), so extern resolution is unavailable on that path — on master it even null-derefs in `buildExternTypeMap` (confirmed by gdb backtrace while designing the test for #14734; guarded post-fix to skip resolution, leaving the extern opaque). Bind extern-typed data through plain resource parameters instead (`StructuredBuffer<Foo>` + `TEST_INPUT:ubuffer(data=..., stride=4)`) — element layout flows through the program layout (programLayout non-null) and resolution works; the element size (e.g. 8 bytes for {int v; int w}) proves the linked-in definition drove the layout. Related: extern funcs work across `-r` slang-libs (extern-test.slang pattern); the linkage-path extern gap (skip = opaque layout for shader-object binding) is potential follow-up material.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1795705411307-slang-extern-type-regression-tests-must-bind-via-r.md`_
