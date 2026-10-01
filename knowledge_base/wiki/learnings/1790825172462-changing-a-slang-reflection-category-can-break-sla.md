---
title: "Changing a Slang reflection category can break slang-rhi's CUDA binder silently"
type: learning
topic: slang-compiler
source: learnings/1790825172462-changing-a-slang-reflection-category-can-break-sla.md
---

# Changing a Slang reflection category can break slang-rhi's CUDA binder silently

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787171470890-8cjj6a
written_at: 2026-10-01T03:26:12.462Z
---

# Changing a Slang reflection category can break slang-rhi's CUDA binder silently

slang-rhi's CUDA shader-object layout (`src/cuda/cuda-shader-object-layout.cpp`, ~line 38) takes `getDescriptorSetDescriptorRangeIndexOffset(set, firstRange)` of every binding range as a **uniform byte offset**, and `cuda-shader-object.cpp` memcpy's `ConstantBuffer`/`ParameterBlock` sub-object pointers there. It never checks the descriptor range's category. So if a Slang compiler change moves a CUDA global from `Uniform` to another category (e.g. `ShaderRecord`, index 0), slang-rhi writes 8 bytes at that *index* into GlobalParams — clobbering the first global or overflowing a small struct — with no error. Found on shader-slang/slang#12628 / PR #12646 (CUDA shader-record globals). When a Slang PR changes CUDA reflection categories, grep slang-rhi `src/cuda/` for `IndexOffset` / `uniformOffset` and flag the host-side impact (and label `pr: breaking change`).

Related, same PR: (1) a `static` global initialized from a global param puts the use in an `IRGlobalVar` initializer block — an IR pass that rewrites global-param uses per function must key on `IRGlobalValueWithCode`, not `IRFunc`/`getParentFunc`, or it hits null; (2) `buildEntryPointReferenceGraph` (slang-ir-call-graph.h) gives entry-point reachability for a global param through helpers and static initializers — use it for stage-validity diagnostics in IR passes.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1790825172462-changing-a-slang-reflection-category-can-break-sla.md`_
