---
title: "getTypeNameHint is shared: naming an opaque IR type churns Metal/CUDA struct names + -fspv-reflect, not just debug info"
type: learning
topic: slang-compiler
source: learnings/1788774792668-gettypenamehint-is-shared-naming-an-opaque-ir-type.md
---

# getTypeNameHint is shared: naming an opaque IR type churns Metal/CUDA struct names + -fspv-reflect, not just debug info

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1788753981776-z88j51
written_at: 2026-09-07T09:53:12.668Z
---

# getTypeNameHint is shared: naming an opaque IR type churns Metal/CUDA struct names + -fspv-reflect, not just debug info

When you add a `getTypeNameHint()` case (source/slang/slang-ir-util.cpp) to give a previously-"unnamed" opaque builtin (DescriptorHandle, RayQuery, CoopVec/Mat, TensorLayout/View) a name, the effect is NOT limited to SPIR-V debug info. `getTypeNameHint` is a single shared renderer with ~19 call sites. Two consumers that will surprise you:

1. **Metal (and other emitters') cbuffer-element wrapper struct name** — `slang-ir-wrap-cbuffer-element.cpp:23-24` builds `"wrapper_" + getTypeNameHint(elementType)`. So `ParameterBlock<DescriptorHandle<Buffer>>` now emits a struct `wrapper_DescriptorHandlex3CBufferx3E_default_0` (`x3C`/`x3E` = escaped `<`/`>`). This broke `tests/metal/test_descriptor_handle.slang`'s `// METAL-NOT: DescriptorHandle` on ALL CI platforms — it's a device-free `-target metal` text FileCheck test, so it runs even on CPU-only CI jobs. That negative check was green ONLY because of the unnamed bug; fix is to replace it with a positive assertion of the real lowering (`// METAL: texture_buffer<uint, access::read>` + `inner_N.read(`).

2. **-fspv-reflect UserTypeGOOGLE** — `addUserTypeHintDecorations` (slang-ir-user-type-hint.cpp) decorates an `IRGlobalParam` with `UserTypeGOOGLE "<lowercased typeNameHint>"` gated on getTypeNameHint being non-empty. A global whose type now has a name gains a reflection string it didn't have.

LESSON: after adding a getTypeNameHint case, run the FULL local suite (`slang-test -use-test-server -server-count 8`), not just tests/spirv + tests/diagnostics — the churn lands in bindless/Metal/reflection tests elsewhere. Full-suite reds that are CUDA-PTX-JIT / "Failed to load DLL gfx" / dispatcher are pre-existing GPU/env failures on GPU-less runners, not your change.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1788774792668-gettypenamehint-is-shared-naming-an-opaque-ir-type.md`_
