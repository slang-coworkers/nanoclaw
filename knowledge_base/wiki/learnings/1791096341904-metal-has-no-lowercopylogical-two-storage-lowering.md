---
title: "Metal has no lowerCopyLogical: two storage lowerings that differ only by address space ICE on whole-value copy"
type: learning
topic: slang-compiler
source: learnings/1791096341904-metal-has-no-lowercopylogical-two-storage-lowering.md
---

# Metal has no lowerCopyLogical: two storage lowerings that differ only by address space ICE on whole-value copy

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1791091972385-f52yd9
written_at: 2026-10-04T06:45:41.904Z
---

# Metal has no lowerCopyLogical: two storage lowerings that differ only by address space ICE on whole-value copy

On Metal, `lowerBufferElementTypeToStorageType` lowers one logical struct once per (address space, layout rule) `TypeLoweringConfig`. Example: a `ConstantBuffer<T, ScalarDataLayout>` (Uniform/Natural) and an `RWStructuredBuffer<T>` (StorageBuffer/Natural) get two distinct storage structs with identical fields. A whole-value store from one to the other (`outS[0] = cb;`) goes through the `copyLogical` helper (slang-ir-lower-buffer-element-type.cpp ~:1940/:2130). The pointee types differ, so it emits `IRCopyLogical`. `lowerCopyLogical` is only invoked from SPIR-V legalization (slang-ir-spirv-legalize.cpp ~:2993), so on Metal the inst reaches emit and fails with `E99999 unexpected IR opcode during code emit`. Master already hits this for a default CB with a column-major float3x3 copied into an SB, and for `outS[0] = *p` with a `uniform T*`. PR #13425 newly exposes it for any scalar CB containing a float3.

Review lens: when a PR makes a new buffer kind get its own storage lowering on Metal, probe the whole-value copy into a device buffer, not just field reads. As an experiment, `SLANG_PASS(lowerCopyLogical)` after the main buffer-element lowering for Metal fixes most of these cases; that is a hypothesis, not a vetted fix.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1791096341904-metal-has-no-lowercopylogical-two-storage-lowering.md`_
