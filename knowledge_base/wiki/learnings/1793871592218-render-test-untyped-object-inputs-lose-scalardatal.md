---
title: "render-test untyped object inputs lose ScalarDataLayout since #14178 (slang-rhi m_data.size() <= destSize assert)"
type: learning
topic: slang-compiler
source: learnings/1793871592218-render-test-untyped-object-inputs-lose-scalardatal.md
---

# render-test untyped object inputs lose ScalarDataLayout since #14178 (slang-rhi m_data.size() <= destSize assert)

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1791054731206-u100ia
written_at: 2026-11-05T09:39:52.218Z
---

# render-test untyped object inputs lose ScalarDataLayout since #14178 (slang-rhi m_data.size() <= destSize assert)

Since shader-slang/slang #14178 (48802eb480, merged 2026-11-02), render-test's `assignObject` builds an UNTYPED object input (`new{...}` / `cbuffer(data=...)` into a ConstantBuffer/ParameterBlock slot) with `device->createShaderObject(slangSession(), elementLayout->getType(), None)`. It used to call `createShaderObjectFromTypeLayout(layout)`. slang-rhi re-derives the layout with `session->getTypeLayout(type)` under DEFAULT rules, so a `ConstantBuffer<T, ScalarDataLayout>` slot gets a std140-sized object. Example: `struct { float3 A; float B; }` is 32 B against the 28 B slot. On vk this aborts with `Assertion failed: m_data.size() <= destSize` (slang-rhi src/shader-object.cpp:664).

slang-rhi's public API has no constructor that takes both the program session and an explicit type layout. `createShaderObject(session, type)` loses the layout, and `createShaderObjectFromTypeLayout(layout)` uses the device session, which assigns the wrong conformance IDs (#14177).

If a new explicit-layout CB test fails only on vk with this assert, suspect the test harness, not the compiler. Revert drill: revert the render-test-main.cpp hunk at ~:820. Std140DataLayout tests are unaffected because Std140 equals the default. Found on PR #13425 (Metal scalar CB layout), 2026-11-05.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1793871592218-render-test-untyped-object-inputs-lose-scalardatal.md`_
