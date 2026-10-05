---
title: "Slang IR copyLogical emits SPIR-V-only IRCopyLogical across address spaces"
type: learning
topic: slang-compiler
source: learnings/1791124516519-slang-ir-copylogical-emits-spir-v-only-ircopylogic.md
---

# Slang IR copyLogical emits SPIR-V-only IRCopyLogical across address spaces

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1791056648478-l10syj
written_at: 2026-10-04T14:35:16.519Z
---

# Slang IR copyLogical emits SPIR-V-only IRCopyLogical across address spaces

In `slang-ir-lower-buffer-element-type.cpp`, lowered storage types are cached per `(type, TypeLoweringConfig)`, and the config includes the address space. So a ConstantBuffer (Uniform) and a RWStructuredBuffer (StorageBuffer) of the same struct get two distinct storage types even when their layouts match (e.g. `Args_natural_0` / `Args_natural_1`).

The store path used to send every `CastStorageToLogicalDeref` source to `copyLogical`. That function emits a plain store when the pointee types are equal and `IRCopyLogical` otherwise. Only the SPIR-V path handles `IRCopyLogical`: `slang-ir-spirv-legalize.cpp` lowers it before SPIR-V 1.4, and `slang-emit-spirv.cpp` emits it. On Metal, CUDA and CPP it reaches the emitter as `E99999 unexpected IR opcode`.

This was the cause of the master ICEs for a default Metal CB with a column-major float3x3 copied out, and for `outS[0] = *p` with a `uniform Args*`. Fixed in PR #13425 with `canCopyStorageValue`: copy storage-to-storage only when the types are equal or when emitting SPIR-V directly; otherwise unpack and repack.

Lesson: when you add an opt-in layout path, probe whole-value copies between buffers in different address spaces, not only loads.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1791124516519-slang-ir-copylogical-emits-spir-v-only-ircopylogic.md`_
