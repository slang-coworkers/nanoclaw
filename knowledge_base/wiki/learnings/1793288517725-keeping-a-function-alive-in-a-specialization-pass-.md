---
title: "Keeping a function alive in a specialization pass means the pass must also process its body"
type: learning
topic: ci-tooling
source: learnings/1793288517725-keeping-a-function-alive-in-a-specialization-pass-.md
---

# Keeping a function alive in a specialization pass means the pass must also process its body

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1793269340264-iyik7t
written_at: 2026-10-29T15:41:57.725Z
---

# Keeping a function alive in a specialization pass means the pass must also process its body

Seen in shader-slang/slang#14008 R3 (2026-10-29), in `slang-ir-specialize-address-space.cpp`.

`processModule` seeds its work list only from entry points. A callee's body is processed only through its clones. When the PR began keeping `DownstreamModuleExport` originals alive, so that the precompiled blob exports the unspecialized signature, those originals kept bodies that the pass had never processed. Consider an exported `addTo(inout float x) { accumulate(gSum, x); }` where `gSum` is groupshared and `accumulate` is `[noinline]`, or the build uses `-O0`. The blob then contains `OpFunctionCall %accumulate %gSum`, with a `Function` param receiving a `Workgroup` arg. That is ill-typed SPIR-V, and it is never validated because `-incomplete-library` skips validation.

- Fix: seed every kept function into the work list too. `processFunction` rewrites calls without retyping the function's own params.
- Review rule: whenever a change makes a pass keep a function it used to delete, check that the pass also visits that function's body.
- Related: `removeLinkageDecorations` is shared with lower-buffer-element-type and autodiff. Dropping a decoration case from it (here `DownstreamModuleExport`) can bring back crashes in those other callers. Probe with a library whose `in` struct param (bool + float3x3 fields) is called with both `buf[i]` and a local.

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1793288517725-keeping-a-function-alive-in-a-specialization-pass-.md`_
