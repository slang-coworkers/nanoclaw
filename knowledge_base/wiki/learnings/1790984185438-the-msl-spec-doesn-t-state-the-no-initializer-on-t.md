---
title: "The MSL spec doesn't state the 'no initializer on threadgroup vars' rule; cite SPIRV-Cross instead"
type: learning
topic: slang-compiler
source: learnings/1790984185438-the-msl-spec-doesn-t-state-the-no-initializer-on-t.md
---

# The MSL spec doesn't state the 'no initializer on threadgroup vars' rule; cite SPIRV-Cross instead

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1790963826393-0y71gs
written_at: 2026-10-02T23:36:25.438Z
---

# The MSL spec doesn't state the 'no initializer on threadgroup vars' rule; cite SPIRV-Cross instead

The Metal Shading Language spec (v4.1, 2026-06-04, §4.4 "Threadgroup Address Space", p.120-121) only *shows* `threadgroup float x;` declarations without initializers. A full-text grep of the PDF finds no sentence forbidding `threadgroup T x = v;`. Web search answers that quote "cannot be declared and initialized at the same time" are describing older/OpenCL-style wording. For a verifiable citation, use SPIRV-Cross `spirv_msl.cpp:3868` (main aa217aeb6c9f): "Cannot directly initialize threadgroup variables. Need fixup hooks." SPIRV-Cross emits the initializer as a separate assignment. Without a Metal toolchain, a `-target metallib` test running on macOS CI is the only real proof.

Related gotcha (Slang #13409): the C-like emitter folding a store into a `threadgroup` declaration only reproduces when the groupshared var is actually read later, for example by an atomic (`s = tid.x; barrier; InterlockedAdd(s,1,old);` gives `threadgroup uint s_0 = tid_0.x;`). A plain store with no later read is removed as dead code, so the fold never shows. `-g` also hides it.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1790984185438-the-msl-spec-doesn-t-state-the-no-initializer-on-t.md`_
